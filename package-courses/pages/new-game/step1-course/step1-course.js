const { calculateDistance, formatDistance } = require('../../../../utils/geo-utils.js')
const OCRService = require('../../../../utils/ocr-service.js')
const { COURSE_CATALOG_VERSION, buildCourseCatalog } = require('../../../../utils/course-catalog.js')

Page({
  data: {
    userLocation: null,
    recommendedCourse: null,
    selectedCourseId: '',
    coursesLoaded: false,
    holeCount: 18,
    // OCR识别弹窗
    showOcrVerifyModal: false,
    ocrHoles: [],
    ocrTotalPar: 0,
    frontNinePar: 0,
    backNinePar: 0,
    ocrReviewCount: 0,
    ocrSource: '',
    ocrImagePath: '',
    // 修改PAR弹窗
    showEditParModal: false,
    editingIndex: -1,
    editingHoleNumber: 1,
    editingParSource: 'ocr',
    currentPar: 3
  },

  onLoad() {
    this.initHoleCount()
    this.loadCoursesLocal()
    this.getUserLocation()
  },

  onShow() {
    // 检查是否从全部球场页面返回并带回了选中球场
    const selectedCourse = wx.getStorageSync('selectedCourseForNewGame')
    if (selectedCourse && selectedCourse.id) {
      if (selectedCourse.isTemporary) {
        wx.removeStorageSync('selectedCourseForNewGame')
        return
      }
      let patchedCourse = selectedCourse
      const userLoc = this.data.userLocation
      if (userLoc && selectedCourse.latitude && selectedCourse.longitude) {
        const d = calculateDistance(
          userLoc.latitude,
          userLoc.longitude,
          selectedCourse.latitude,
          selectedCourse.longitude
        )
        patchedCourse = {
          ...selectedCourse,
          distance: d,
          distanceFormatted: formatDistance(d),
          matchConfidence: this.getMatchConfidence(d)
        }
      }
      this.setData({
        selectedCourseId: selectedCourse.id,
        recommendedCourse: patchedCourse
      })
      wx.removeStorageSync('selectedCourseForNewGame')
    }
  },

  getMatchConfidence: function(distance) {
    if (!isFinite(distance)) return { level: 'low', text: '低匹配' }
    if (distance <= 12000) return { level: 'high', text: '高匹配' }
    if (distance <= 35000) return { level: 'medium', text: '中匹配' }
    return { level: 'low', text: '低匹配' }
  },

  initHoleCount: function() {
    var saved = parseInt(wx.getStorageSync('newGameHoleCount'), 10)
    var holeCount = saved === 9 ? 9 : 18
    this.setData({ holeCount: holeCount })
  },

  setHoleCount: function(e) {
    var value = parseInt(e.currentTarget.dataset.value, 10)
    var holeCount = value === 9 ? 9 : 18
    this.setData({ holeCount: holeCount })
    wx.setStorageSync('newGameHoleCount', holeCount)
  },

  // 从本地加载全部球场数据（打包在本地，不需要云端）
  loadCoursesLocal: function() {
    var self = this
    var localCourses = wx.getStorageSync('courses') || []
    var mergedCourses = buildCourseCatalog(localCourses)

    // 保存到缓存
    wx.setStorageSync('courses', mergedCourses)
    wx.setStorageSync('coursesInitialized', true)
    wx.setStorageSync('coursesDataVersion', COURSE_CATALOG_VERSION)
    this.setData({ coursesLoaded: true })

    // 如果已有位置信息，立刻计算推荐
    if (self.data.userLocation) {
      self.calculateNearbyCourses(self.data.userLocation)
    }
  },

  // 获取用户位置
  getUserLocation: function() {
    const self = this
    function handleLocationFail() {
      // 定位失败，不使用默认位置，保持等待状态
      self.setData({ userLocation: null })
    }

    wx.authorize({
      scope: 'scope.userFuzzyLocation',
      success: function() {
        wx.getFuzzyLocation({
          type: 'gcj02',
          success: function(res) {
            const location = { latitude: res.latitude, longitude: res.longitude }
            self.setData({ userLocation: location })
            self.calculateNearbyCourses(location)
          },
          fail: handleLocationFail
        })
      },
      fail: handleLocationFail
    })
  },

  // 计算附近球场
  calculateNearbyCourses: function(userLoc) {
    const self = this
    const allCourses = wx.getStorageSync('courses') || []
    const builtinCourses = allCourses.filter(function(c) {
      return c &&
        !c.isTemporary &&
        !c.isCustom &&
        !String(c.id || '').startsWith('mock-') &&
        !String(c.id || '').startsWith('custom-') &&
        isFinite(parseFloat(c.latitude)) &&
        isFinite(parseFloat(c.longitude))
    })

    const coursesWithDistance = builtinCourses.map(function(course) {
      const distance = calculateDistance(
        userLoc.latitude, userLoc.longitude,
        course.latitude, course.longitude
      )
      return {
        ...course,
        distance: distance,
        distanceFormatted: formatDistance(distance),
        matchConfidence: self.getMatchConfidence(distance),
        totalDistanceFormatted: course.totalDistance > 0 ? (course.totalDistance / 1000).toFixed(1) + 'k' : '-'
      }
    })

    // 按距离排序；距离接近时优先推荐有标准杆的数据源
    coursesWithDistance.sort(function(a, b) {
      var distanceDiff = a.distance - b.distance
      if (Math.abs(distanceDiff) <= 500) {
        if (!!b.hasStandardPar !== !!a.hasStandardPar) return b.hasStandardPar ? 1 : -1
        if (!!b.isPublicScorecard !== !!a.isPublicScorecard) return b.isPublicScorecard ? 1 : -1
      }
      return distanceDiff
    })

    // 取最近的作为推荐
    const recommendedCourse = coursesWithDistance.length > 0 ? coursesWithDistance[0] : null
    const selectedCourseId = recommendedCourse ? recommendedCourse.id : ''

    this.setData({
      recommendedCourse: recommendedCourse,
      selectedCourseId: selectedCourseId
    })

    if (recommendedCourse) {
      wx.setStorageSync('currentCourseId', recommendedCourse.id)
    }
  },

  // 用户手动选择使用默认位置
  useDefaultLocation: function() {
    const DEFAULT_LOCATION = { latitude: 39.90, longitude: 116.40 }
    this.setData({ userLocation: DEFAULT_LOCATION })
    this.calculateNearbyCourses(DEFAULT_LOCATION)
    wx.showToast({ title: '已使用默认位置', icon: 'none' })
  },

  // 跳转到全部球场页面
  goToAllCourses: function() {
    wx.navigateTo({
      url: '/package-courses/pages/all-courses/all-courses?from=new-game',
      fail: function(err) {
        console.error('navigateTo fail:', err)
        wx.showToast({ title: '页面加载失败', icon: 'none' })
      }
    })
  },

  // 下一步
  goNext: function() {
    if (!this.data.selectedCourseId) {
      wx.showToast({ title: '请先选择球场', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: '/pages/new-game/step2-players/step2-players'
    })
  },

  // ========== OCR识别功能 ==========
  startOcrVerify: function() {
    const course = this.data.recommendedCourse
    if (!course) {
      wx.showToast({ title: '请先选择球场', icon: 'none' })
      return
    }

    // 彻底清空所有识别数据 - 每次识别都是全新开始
    this.setData({
      ocrHoles: [],
      ocrTotalPar: 0,
      frontNinePar: 0,
      backNinePar: 0,
      ocrImagePath: '',
      showOcrVerifyModal: false
    }, () => {
      // 清空完成后再打开相机
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        camera: 'back',
        success: function(res) {
          const tempFilePath = res.tempFiles[0].tempFilePath
          this.setData({ ocrImagePath: tempFilePath })
          wx.showLoading({ title: '识别中...', mask: true })
          this.recognizeScorecard(tempFilePath)
        }.bind(this),
        fail: function() {
          wx.showToast({ title: '取消选择', icon: 'none' })
        }
      })
    })
  },

  recognizeScorecard: function(imagePath) {
    OCRService.recognize(imagePath).then(result => {
      wx.hideLoading()
      if (result.success && result.holes && result.holes.length > 0) {
        // 纯AI直接识别，直接使用识别结果
        const fullOcrHoles = result.holes.map((h, idx) => ({
          hole: h.hole || idx + 1,
          par: h.par,
          confidence: h.confidence,
          source: h.source,
          needs_review: h.needs_review === true
        }))

        const ocrTotalPar = fullOcrHoles.reduce((sum, h) => sum + h.par, 0)
        const frontNinePar = fullOcrHoles.filter(h => h.hole <= 9).reduce((sum, h) => sum + h.par, 0)
        const backNinePar = fullOcrHoles.filter(h => h.hole > 9).reduce((sum, h) => sum + h.par, 0)
        const ocrReviewCount = fullOcrHoles.filter(h => h.needs_review).length

        this.setData({
          ocrHoles: fullOcrHoles,
          ocrTotalPar,
          frontNinePar,
          backNinePar,
          ocrReviewCount,
          ocrSource: 'AI直接识别',
          showOcrVerifyModal: true
        })
      } else {
        wx.showModal({
          title: '识别失败',
          content: result.error || '未能识别出有效的计分卡数据，请确保图片清晰并包含完整的18洞标准杆信息',
          showCancel: false
        })
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('OCR识别失败:', err)
      wx.showToast({ title: '识别失败', icon: 'none' })
    })
  },

  hideOcrVerifyModal: function() {
    // 关闭弹窗时彻底清空所有识别数据
    this.setData({
      showOcrVerifyModal: false,
      ocrHoles: [],
      ocrTotalPar: 0,
      frontNinePar: 0,
      backNinePar: 0,
      ocrReviewCount: 0,
      ocrImagePath: ''
    })
  },

  confirmReplaceData: function() {
    const { recommendedCourse, ocrHoles, ocrTotalPar } = this.data
    if (!recommendedCourse) return

    // 保存到云端共享数据
    OCRService.saveCourseHoles(recommendedCourse.id, ocrHoles, 'ocr')

    // 更新 courses 存储
    let allCourses = wx.getStorageSync('courses') || []
    const courseIndex = allCourses.findIndex(c => c.id === recommendedCourse.id)

    const updatedCourse = {
      ...recommendedCourse,
      holes: ocrHoles,
      totalPar: ocrTotalPar,
      holesVerified: true,
      updatedAt: new Date().toISOString()
    }

    if (courseIndex >= 0) {
      allCourses[courseIndex] = updatedCourse
    } else {
      allCourses.push(updatedCourse)
    }

    wx.setStorageSync('courses', allCourses)

    this.setData({
      recommendedCourse: updatedCourse,
      showOcrVerifyModal: false
    })

    wx.setStorageSync('currentCourseId', recommendedCourse.id)
    wx.showToast({ title: '数据已更新', icon: 'success' })
  },

  previewOcrImage: function() {
    const { ocrImagePath } = this.data
    if (ocrImagePath) {
      wx.previewImage({
        current: ocrImagePath,
        urls: [ocrImagePath]
      })
    }
  },

  // 点击修改某个洞的PAR值
  editPar: function(e) {
    const index = Number(e.currentTarget.dataset.index)
    const targetHole = this.data.ocrHoles[index]
    if (!targetHole) return

    this.setData({
      showEditParModal: true,
      editingIndex: index,
      editingHoleNumber: targetHole.hole || index + 1,
      editingParSource: 'ocr',
      currentPar: targetHole.par
    })
  },

  // 点击主表格校准某个洞的PAR值
  editCoursePar: function(e) {
    const index = Number(e.currentTarget.dataset.index)
    const holes = (this.data.recommendedCourse && this.data.recommendedCourse.holes) || []
    const targetHole = holes[index]
    if (!targetHole) return

    this.setData({
      showEditParModal: true,
      editingIndex: index,
      editingHoleNumber: targetHole.hole || index + 1,
      editingParSource: 'course',
      currentPar: targetHole.par
    })
  },

  // 点击选项直接确认修改
  confirmSelectPar: function(e) {
    const newPar = parseInt(e.currentTarget.dataset.par)
    const { editingIndex, currentPar, editingParSource } = this.data

    if (newPar === currentPar) {
      this.hideEditParModal()
      return
    }

    if (editingParSource === 'course') {
      this.updateCoursePar(editingIndex, newPar)
      return
    }

    // 不可变更新ocrHoles
    const newOcrHoles = this.data.ocrHoles.map((h, i) => {
      if (i === editingIndex) {
        return { ...h, par: newPar, needs_review: false }
      }
      return h
    })

    // 重新计算小计和总计
    const ocrTotalPar = newOcrHoles.reduce((sum, h) => sum + h.par, 0)
    const frontNinePar = newOcrHoles.filter(h => h.hole <= 9).reduce((sum, h) => sum + h.par, 0)
    const backNinePar = newOcrHoles.filter(h => h.hole > 9).reduce((sum, h) => sum + h.par, 0)
    const ocrReviewCount = newOcrHoles.filter(h => h.needs_review).length

    this.setData({
      ocrHoles: newOcrHoles,
      ocrTotalPar,
      frontNinePar,
      backNinePar,
      ocrReviewCount,
      showEditParModal: false,
      editingIndex: -1
    })
  },

  updateCoursePar: function(index, newPar) {
    const recommendedCourse = this.data.recommendedCourse
    if (!recommendedCourse || !Array.isArray(recommendedCourse.holes) || !recommendedCourse.holes[index]) {
      this.hideEditParModal()
      return
    }

    const newHoles = recommendedCourse.holes.map(function(hole, i) {
      if (i === index) {
        return {
          ...hole,
          par: newPar,
          needs_review: false,
          source: hole.source || 'manual'
        }
      }
      return hole
    })
    const totalPar = newHoles.reduce(function(sum, hole) {
      return sum + (parseInt(hole.par) || 0)
    }, 0)
    const updatedCourse = {
      ...recommendedCourse,
      holes: newHoles,
      totalPar: totalPar,
      holesVerified: true,
      updatedAt: new Date().toISOString()
    }

    let allCourses = wx.getStorageSync('courses') || []
    const courseIndex = allCourses.findIndex(function(course) {
      return course && course.id === updatedCourse.id
    })
    if (courseIndex >= 0) {
      allCourses[courseIndex] = {
        ...allCourses[courseIndex],
        ...updatedCourse
      }
    } else {
      allCourses.push(updatedCourse)
    }

    wx.setStorageSync('courses', allCourses)
    wx.setStorageSync('currentCourseId', updatedCourse.id)

    this.setData({
      recommendedCourse: updatedCourse,
      showEditParModal: false,
      editingIndex: -1,
      editingParSource: 'course',
      currentPar: newPar
    })
    wx.showToast({ title: '已校准第' + (newHoles[index].hole || index + 1) + '洞', icon: 'success' })

    // 异步贡献到云端；本地先立即生效，避免弱网影响创建比赛。
    try {
      const saveTask = OCRService.saveCourseHoles(updatedCourse.id, newHoles, 'manual')
      if (saveTask && saveTask.catch) {
        saveTask.catch(function(err) {
          console.warn('保存球场标准杆到云端失败，本地数据已生效:', err)
        })
      }
    } catch (err) {
      console.warn('保存球场标准杆到云端异常，本地数据已生效:', err)
    }
  },

  // 关闭修改弹窗
  hideEditParModal: function() {
    this.setData({
      showEditParModal: false,
      editingIndex: -1
    })
  },

  // 阻止弹窗背景点击关闭
  preventHide: function() {}
})
