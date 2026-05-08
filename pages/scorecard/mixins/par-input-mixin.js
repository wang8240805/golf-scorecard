/**
 * Par数据管理Mixin
 * 处理球场Par数据缺失时的手动输入和OCR识别
 */

const OCRService = require('../../../utils/ocr-service.js')

module.exports = {
  data: {
    // Par数据状态
    showParInputGuide: false,      // 是否显示Par输入引导
    showParInputModal: false,      // 是否显示Par输入弹窗
    parInputHole: 1,               // 当前输入的洞号
    parInputValue: 4,              // 当前输入的Par值
    parInputProgress: 0,           // 输入进度（已输入洞数）
    parInputMode: 'single',        // 输入模式: 'single' 单洞输入, 'batch' 批量输入
    tempHoles: [],                 // 临时存储用户输入的洞数据
    // OCR相关
    ocrLoading: false
  },

  // 检查球场是否有完整的Par数据
  checkCourseParData(course) {
    if (!course) return { hasData: false, holesCount: 0 }

    const holes = course.holes
    const hasVerified = course.holesVerified

    // 检查holes数组是否存在且完整
    if (holes && Array.isArray(holes) && holes.length >= 18) {
      // 检查每洞是否都有par值
      const validHoles = holes.filter(h => h && h.par >= 2 && h.par <= 6)
      if (validHoles.length >= 18) {
        return { hasData: true, holesCount: validHoles.length, verified: hasVerified }
      }
    }

    // 检查用户贡献的数据
    const userCourseHoles = wx.getStorageSync('userCourseHoles') || {}
    const userHoles = userCourseHoles[course.id]
    if (userHoles && userHoles.holes && userHoles.holes.length >= 18) {
      return { hasData: true, holesCount: userHoles.holes.length, verified: true, fromUser: true }
    }

    return { hasData: false, holesCount: holes ? holes.length : 0 }
  },

  // 显示Par数据缺失引导
  showParDataGuide() {
    this.setData({ showParInputGuide: true })
  },

  // 隐藏Par数据缺失引导
  hideParDataGuide() {
    this.setData({ showParInputGuide: false })
  },

  // 选择获取Par数据的方式
  selectParDataSource(e) {
    const source = e.currentTarget.dataset.source

    this.hideParDataGuide()

    switch (source) {
      case 'ocr':
        this.startParOCR()
        break
      case 'manual':
        this.startManualParInput()
        break
      case 'skip':
        // 使用默认Par值
        this.useDefaultParData()
        break
    }
  },

  // 使用默认Par数据（全部Par 4，共72）
  useDefaultParData() {
    const defaultHoles = []
    for (let i = 1; i <= 18; i++) {
      defaultHoles.push({ hole: i, par: 4 })
    }

    this.applyHolesData(defaultHoles, 'default')
    wx.showToast({ title: '使用默认Par值', icon: 'none' })
  },

  // 开始OCR识别Par数据
  async startParOCR() {
    try {
      // 选择图片
      const chooseResult = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['camera', 'album'],
          success: resolve,
          fail: reject
        })
      })

      const imagePath = chooseResult.tempFiles[0].tempFilePath

      this.setData({ ocrLoading: true })

      // 调用OCR服务
      const result = await OCRService.recognize(imagePath)

      this.setData({ ocrLoading: false })

      if (result.success && result.holes && result.holes.length > 0) {
        // 显示识别结果确认
        const confirmed = await OCRService.showResultConfirm(result)

        if (confirmed) {
          this.applyHolesData(result.holes, 'ocr')
          wx.showToast({ title: '识别成功', icon: 'success' })
        } else {
          // 用户取消，提供手动输入选项
          wx.showModal({
            title: '手动输入',
            content: '是否手动输入每洞Par值？',
            confirmText: '开始输入',
            cancelText: '使用默认值',
            success: res => {
              if (res.confirm) {
                this.startManualParInput()
              } else {
                this.useDefaultParData()
              }
            }
          })
        }
      } else {
        // OCR识别失败
        wx.showModal({
          title: '识别失败',
          content: result.error || '未能识别出Par数据，请确保图片清晰并包含完整的记分卡信息。',
          confirmText: '手动输入',
          cancelText: '使用默认值',
          success: res => {
            if (res.confirm) {
              this.startManualParInput()
            } else {
              this.useDefaultParData()
            }
          }
        })
      }
    } catch (err) {
      this.setData({ ocrLoading: false })
      console.error('OCR error:', err)
      wx.showToast({ title: '识别失败', icon: 'none' })
    }
  },

  // 开始手动输入Par数据
  startManualParInput() {
    const tempHoles = []
    for (let i = 1; i <= 18; i++) {
      tempHoles.push({ hole: i, par: 4 }) // 默认Par 4
    }

    this.setData({
      showParInputModal: true,
      parInputHole: 1,
      parInputValue: 4,
      parInputProgress: 0,
      tempHoles
    })
  },

  // 关闭Par输入弹窗
  hideParInputModal() {
    this.setData({ showParInputModal: false })
  },

  // 选择Par值（快捷按钮）
  selectParValue(e) {
    const par = parseInt(e.currentTarget.dataset.par)
    this.setData({ parInputValue: par })
    this.confirmParInput()
  },

  // 确认当前洞的Par输入
  confirmParInput() {
    const { parInputHole, parInputValue, tempHoles } = this.data

    // 更新当前洞的Par值
    tempHoles[parInputHole - 1].par = parInputValue

    // 计算已输入的洞数
    const progress = tempHoles.filter(h => h.par > 0).length

    this.setData({
      tempHoles,
      parInputProgress: progress
    })

    // 自动跳到下一洞
    if (parInputHole < 18) {
      this.setData({
        parInputHole: parInputHole + 1,
        parInputValue: 4 // 重置为默认值
      })
    } else {
      // 全部输入完成
      this.finishParInput()
    }
  },

  // 跳转到指定洞输入
  jumpToParInputHole(e) {
    const hole = e.currentTarget.dataset.hole
    const currentPar = this.data.tempHoles[hole - 1]?.par || 4
    this.setData({
      parInputHole: hole,
      parInputValue: currentPar
    })
  },

  // 完成Par输入
  finishParInput() {
    const { tempHoles } = this.data

    // 检查是否完整
    const validCount = tempHoles.filter(h => h.par >= 2 && h.par <= 6).length

    if (validCount < 18) {
      wx.showModal({
        title: '数据不完整',
        content: `已输入${validCount}/18洞，是否继续？`,
        confirmText: '继续输入',
        cancelText: '保存已输入数据',
        success: res => {
          if (!res.confirm) {
            this.applyHolesData(tempHoles, 'manual')
          }
        }
      })
      return
    }

    this.applyHolesData(tempHoles, 'manual')
  },

  // 应用洞数据到比赛
  applyHolesData(holes, source) {
    const currentGame = this.data.currentGame
    if (!currentGame) return

    // 更新比赛数据
    currentGame.holes = holes
    currentGame.totalPar = holes.reduce((sum, h) => sum + h.par, 0)

    // 保存到球场数据
    const courseId = currentGame.courseId
    if (courseId) {
      OCRService.saveCourseHoles(courseId, holes, source)
    }

    // 更新页面数据
    this.setData({
      currentGame,
      holes: holes,
      totalHoles: holes.length,
      totalPar: currentGame.totalPar,
      currentHoleData: holes[0],
      showParInputModal: false,
      showParInputGuide: false
    })

    // 更新记分卡网格
    if (this.updateScoreGrid) {
      this.updateScoreGrid()
    }

    // 保存游戏
    this.saveGame()
  },

  // 获取当前洞的Par值（兼容holes不存在的情况）
  getCurrentHolePar(holeNumber) {
    const holes = this.data.holes
    if (holes && holes[holeNumber - 1]) {
      return holes[holeNumber - 1].par
    }
    // 默认Par 4
    return 4
  }
}
