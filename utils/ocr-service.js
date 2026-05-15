/**
 * OCR服务工具类
 * 封装记分卡OCR识别功能
 */

const DebugLog = require('./debug-log.js')
const OCR_GUIDE_KEY = '__ocr_capture_guide_seen__'

const OCRService = {
  /**
   * 识别记分卡图片
   * @param {string} imagePath - 图片临时路径
   * @returns {Promise<Object>} 识别结果
   */
  async recognize(imagePath) {
    await this.showCaptureGuideOnce()
    DebugLog.log('[OCR] 开始识别, 图片路径:', imagePath)
    wx.showLoading({ title: '上传中...', mask: true })

    try {
      // 1. 上传图片到云存储
      const cloudPath = `ocr/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`

      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: imagePath
      })

      DebugLog.log('[OCR] 上传成功, fileID:', uploadResult.fileID)
      wx.showLoading({ title: '识别中...', mask: true })

      // 2. 调用云函数（传递fileID而不是base64）
      const result = await wx.cloud.callFunction({
        name: 'ocr-scorecard',
        data: { fileID: uploadResult.fileID }
      })

      DebugLog.log('[OCR] 云函数返回:', JSON.stringify(result.result))
      if (result.result.aiError) {
        DebugLog.log('[OCR] AI识别错误:', result.result.aiError)
      }
      // 输出OCR识别详情（每个文字块的坐标）
      if (result.result.ocrDetails && result.result.ocrDetails.length > 0) {
        DebugLog.log('[OCR] ===== 步骤1: OCR识别详情 =====')
        DebugLog.log('[OCR] 共识别到', result.result.ocrDetails.length, '个文字块:')
        result.result.ocrDetails.forEach((item, idx) => {
          DebugLog.log(`[OCR] 文字块[${idx}]: "${item.text}" X=${item.x} Y=${item.y}`)
        })
        DebugLog.log('[OCR] ===== 步骤1结束 =====')
      }
      if (result.result.debugInfo && result.result.debugInfo.rows) {
        DebugLog.log('[OCR] 识别到的文字行:')
        result.result.debugInfo.rows.forEach(row => {
          DebugLog.log(`  第${row.index}行 (Y=${row.y}): ${row.text}`)
        })
      }

      wx.hideLoading()

      if (result.errMsg !== 'cloud.callFunction:ok') {
        throw new Error('云函数调用失败')
      }

      // result.result 就是云函数返回的 {success, data, ...}
      const response = result.result
      const data = response.data

      if (!response.success) {
        throw new Error(response.error || '识别失败')
      }

      DebugLog.log('[OCR] 识别成功, 洞数:', data.holes?.length, '来源:', data.source)
      // 输出详细的PAR值
      if (data.holes && data.holes.length > 0) {
        const parList = data.holes.map(h => h.par).join(',')
        const totalPar = data.holes.reduce((s, h) => s + h.par, 0)
        DebugLog.log(`[OCR] PAR值: [${parList}] 总杆: ${totalPar}`)
        if (data.validation) {
          DebugLog.log('[OCR] 校验结果:', JSON.stringify(data.validation))
        }
        // 输出推断的PAR值
        const inferred = data.holes.filter(h =>
          h.source === 'rule_infer' ||
          h.source === 'default_fill' ||
          h.needs_review
        )
        if (inferred.length > 0) {
          DebugLog.log(`[OCR] 推断的洞: ${inferred.map(h => `#${h.hole}=${h.par}`).join(', ')}`)
        }
      }
      // 输出调试信息
      if (data.debugInfo) {
        DebugLog.log('[OCR] 调试信息:', JSON.stringify(data.debugInfo))
      }

      return {
        success: true,
        holes: data.holes,
        confidence: data.confidence,
        validation: data.validation,
        source: data.source
      }

    } catch (err) {
      wx.hideLoading()
      DebugLog.log('[OCR] 识别失败:', err.message || err.errMsg)

      // 降级提示
      if (err.errMsg && err.errMsg.includes('FunctionName')) {
        wx.showModal({
          title: '功能未开通',
          content: 'OCR功能需要部署云函数，请在微信开发者工具中上传并部署 cloudfunctions/ocr-scorecard 云函数',
          showCancel: false
        })
      }

      return {
        success: false,
        error: err.message || err.errMsg || '识别失败'
      }
    }
  },

  /**
   * 显示识别结果确认弹窗
   * @param {Object} result - OCR识别结果
   * @param {Object} options - 配置选项
   * @returns {Promise<boolean>} 用户是否确认
   */
  showResultConfirm(result, options = {}) {
    const { holes, validation } = result

    let content = ''

    if (holes.length === 0) {
      content = '未能识别出标准杆数据，请确保图片清晰且包含完整的记分卡信息。'
      return new Promise(resolve => {
        wx.showModal({
          title: '识别失败',
          content,
          showCancel: false,
          confirmText: '我知道了',
          success: () => resolve(false)
        })
      })
    }

    if (validation && !validation.valid) {
      content = `识别到${holes.length}洞数据，但数据可能不准确：${validation.reason}\n\n是否使用该数据？`
    } else {
      // 计算总标准杆
      const totalPar = holes.reduce((sum, h) => sum + h.par, 0)
      content = `成功识别${holes.length}洞数据，总标准杆：${totalPar}`
    }

    return new Promise(resolve => {
      wx.showModal({
        title: '识别结果',
        content,
        confirmText: '确认使用',
        cancelText: '取消',
        success: res => resolve(res.confirm)
      })
    })
  },

  showCaptureGuideOnce() {
    return new Promise(resolve => {
      try {
        const seen = wx.getStorageSync(OCR_GUIDE_KEY)
        if (seen) {
          resolve()
          return
        }
        wx.showModal({
          title: '拍照小提示',
          content: '请把整张记分卡完整拍入画面，四角都要露出；尽量正对拍摄，避免反光和阴影，底部后9洞不要贴边裁切。',
          showCancel: false,
          confirmText: '知道了',
          success: function() {
            wx.setStorageSync(OCR_GUIDE_KEY, Date.now())
            resolve()
          },
          fail: function() {
            resolve()
          }
        })
      } catch (e) {
        resolve()
      }
    })
  },

  /**
   * 保存球场洞数据到本地 + 同步云端共享
   * @param {string} courseId - 球场ID
   * @param {Array} holes - 洞数据
   * @param {string} source - 数据来源 ('ocr' | 'manual')
   */
  saveCourseHoles(courseId, holes, source = 'ocr') {
    // 保存到本地
    const userCourseHoles = wx.getStorageSync('userCourseHoles') || {}

    userCourseHoles[courseId] = {
      holes: holes,
      verifiedAt: new Date().toISOString().split('T')[0],
      source: source
    }

    wx.setStorageSync('userCourseHoles', userCourseHoles)

    // 同时更新courses存储中的数据
    const courses = wx.getStorageSync('courses') || []
    const courseIndex = courses.findIndex(c => c.id === courseId)
    const totalPar = holes.reduce((sum, h) => sum + h.par, 0)
    if (courseIndex !== -1) {
      courses[courseIndex].holes = holes
      courses[courseIndex].totalPar = totalPar
      courses[courseIndex].holesVerified = true
      wx.setStorageSync('courses', courses)
    }

    // 同步到云端公开共享数据库（通过云函数，服务端验证数据）
    const app = getApp()
    if (app && app.cloud) {
      const totalPar = holes.reduce((sum, h) => sum + h.par, 0)
      // 调用云函数保存数据（服务端会验证数据合法性）
      wx.cloud.callFunction({
        name: 'savePublicCourseData',
        data: {
          courseId: courseId,
          holes: holes,
          totalPar: totalPar,
          source: source
        },
        success: res => {
          if (res.result && res.result.success) {
            console.log('[OCR] 同步云端共享数据成功:', courseId)
            wx.showToast({
              title: '感谢贡献数据🌹',
              icon: 'success',
              duration: 2000
            })
          } else {
            console.error('[OCR] 同步云端失败:', res.result?.error)
            wx.showToast({
              title: res.result?.error || '同步失败，数据仅保存在本地',
              icon: 'none',
              duration: 3000
            })
          }
        },
        fail: err => {
          console.error('[OCR] 调用云函数失败:', err)
          wx.showToast({
            title: '同步失败，数据仅保存在本地',
            icon: 'none',
            duration: 3000
          })
        }
      })
    }
  },

  /**
   * 获取球场的洞数据
   * @param {string} courseId - 球场ID
   * @returns {Object|null} 洞数据或null
   */
  getCourseHoles(courseId) {
    // 优先从用户贡献数据获取
    const userCourseHoles = wx.getStorageSync('userCourseHoles') || {}
    if (userCourseHoles[courseId]) {
      return userCourseHoles[courseId].holes
    }

    // 其次从courses存储获取
    const courses = wx.getStorageSync('courses') || []
    const course = courses.find(c => c.id === courseId)
    if (course && course.holes && course.holes.length > 0) {
      return course.holes
    }

    return null
  },

  /**
   * 检查球场是否有已验证的洞数据
   * @param {string} courseId - 球场ID
   * @returns {boolean}
   */
  hasVerifiedHoles(courseId) {
    const courses = wx.getStorageSync('courses') || []
    const course = courses.find(c => c.id === courseId)
    return course?.holesVerified === true
  },

  /**
   * 从云端拉取公开贡献的数据，合并到本地
   * 数据优先级：用户本地 > 云端公开 > 内置静态
   * 支持分页获取所有数据（微信云开发单次get最多返回100条）
   */
  syncPublicCourseData() {
    const app = getApp()
    if (!app || !app.cloud) {
      return Promise.resolve()
    }

    const db = app.cloud.database()
    const _ = app.cloud.database().command

    // 分页获取所有数据
    return this._getAllPublicData(db)
      .then(allData => {
        if (!allData || allData.length === 0) {
          console.log('[OCR] 无公开数据需要同步')
          return []
        }

        // 合并到本地 courses
        let courses = wx.getStorageSync('courses') || []
        let userCourseHoles = wx.getStorageSync('userCourseHoles') || {}
        let mergedCount = 0

        allData.forEach(publicItem => {
          const courseId = publicItem.courseId
          // 用户本地已有，跳过
          if (!userCourseHoles[courseId] && courses.length > 0) {
            const courseIndex = courses.findIndex(c => c.id === courseId)
            if (courseIndex >= 0 && publicItem.holes && publicItem.holes.length >= 9) {
              // 更新本地courses
              courses[courseIndex].holes = publicItem.holes
              courses[courseIndex].totalPar = publicItem.totalPar
              courses[courseIndex].holesVerified = true
              // 保存到用户本地缓存
              userCourseHoles[courseId] = {
                holes: publicItem.holes,
                verifiedAt: publicItem.verifiedAt,
                source: 'cloud-public'
              }
              mergedCount++
              console.log('[OCR] 合并云端公开数据:', courseId)
            }
          }
        })

        // 保存更新
        wx.setStorageSync('courses', courses)
        wx.setStorageSync('userCourseHoles', userCourseHoles)
        console.log('[OCR] 同步公开数据完成，共', allData.length, '条，合并', mergedCount, '条')
        return allData
      })
      .catch(err => {
        console.error('[OCR] 同步公开数据失败:', err)
        return Promise.reject(err)
      })
  },

  /**
   * 分页获取所有公开数据（处理超过100条的情况）
   * 微信云开发单次查询最多返回100条，需要循环获取
   */
  async _getAllPublicData(db) {
    let allData = []
    let skip = 0
    const batchSize = 100

    // 获取第一页
    let res = await db.collection('public_course_data').skip(skip).get()
    allData = allData.concat(res.data)

    // 如果刚好等于100条，说明可能还有下一页
    while (res.data.length === batchSize) {
      skip += batchSize
      res = await db.collection('public_course_data').skip(skip).get()
      allData = allData.concat(res.data)
    }

    return allData
  }
}

module.exports = OCRService
