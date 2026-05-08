const { calculateDistance, formatDistance } = require('../../../../utils/geo-utils.js')
const OCRService = require('../../../../utils/ocr-service.js')
const ALL_COURSES = require('../../../../data/courses-accurate.js')

Page({
  data: {
    userLocation: null,
    recommendedCourse: null,
    selectedCourseId: '',
    coursesLoaded: false,
    // OCR识别弹窗
    showOcrVerifyModal: false,
    ocrHoles: [],
    ocrTotalPar: 0,
    frontNinePar: 0,
    backNinePar: 0,
    ocrSource: '',
    ocrImagePath: '',
    // 修改PAR弹窗
    showEditParModal: false,
    editingIndex: -1,
    currentPar: 3
  },

  onLoad() {
    this.loadCoursesLocal()
    this.getUserLocation()
  },

  onShow() {
    // 检查是否从全部球场页面返回并带回了选中球场
    const selectedCourse = wx.getStorageSync('selectedCourseForNewGame')
    if (selectedCourse && selectedCourse.id) {
      this.setData({
        selectedCourseId: selectedCourse.id,
        recommendedCourse: selectedCourse
      })
      wx.removeStorageSync('selectedCourseForNewGame')
    }
  },

  // 从本地加载全部球场数据（打包在本地，不需要云端）
  loadCoursesLocal: function() {
    var self = this
    var courses = ALL_COURSES || []

    // 预处理：确保格式正确，标记holes为null需要云端匹配
    courses = courses.map(function(course) {
      var newCourse = {}
      for (var key in course) {
        newCourse[key] = course[key]
      }
      if (!newCourse.holesVerified) {
        newCourse.holes = null
        newCourse.holesVerified = false
      }
      return newCourse
    })

    // 保存到缓存
    wx.setStorageSync('courses', courses)
    wx.setStorageSync('coursesInitialized', true)
    wx.setStorageSync('coursesDataVersion', 'local-v1')
    this.setData({ coursesLoaded: true })

    // 如果已有位置信息，立刻计算推荐
    if (self.data.userLocation) {
      self.calculateNearbyCourses(self.data.userLocation)
    }
  },

  // 获取用户位置
  getUserLocation: function() {
    wx.getLocation({
      type: 'gcj02',
      success: function(res) {
        const location = { latitude: res.latitude, longitude: res.longitude }
        this.setData({ userLocation: location })
        this.calculateNearbyCourses(location)
      }.bind(this),
      fail: function() {
        // 定位失败，不使用默认位置，保持等待状态
        this.setData({ userLocation: null })
      }.bind(this)
    })
  },

  // 计算附近球场
  calculateNearbyCourses: function(userLoc) {
    const allCourses = wx.getStorageSync('courses') || []
    const builtinCourses = allCourses.filter(function(c) { return !c.id.startsWith('mock-') && !c.id.startsWith('custom-') })

    const coursesWithDistance = builtinCourses.map(function(course) {
      const distance = calculateDistance(
        userLoc.latitude, userLoc.longitude,
        course.latitude, course.longitude
      )
      return {
        ...course,
        distance: distance,
        distanceFormatted: formatDistance(distance),
        totalDistanceFormatted: course.totalDistance > 0 ? (course.totalDistance / 1000).toFixed(1) + 'k' : '-'
      }
    })

    // 按距离排序
    coursesWithDistance.sort(function(a, b) { return a.distance - b.distance })

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
          par: h.par
        }))

        const ocrTotalPar = fullOcrHoles.reduce((sum, h) => sum + h.par, 0)
        const frontNinePar = fullOcrHoles.filter(h => h.hole <= 9).reduce((sum, h) => sum + h.par, 0)
        const backNinePar = fullOcrHoles.filter(h => h.hole > 9).reduce((sum, h) => sum + h.par, 0)

        this.setData({
          ocrHoles: fullOcrHoles,
          ocrTotalPar,
          frontNinePar,
          backNinePar,
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
    const index = e.currentTarget.dataset.index;
    const currentPar = this.data.ocrHoles[index].par;

    this.setData({
      showEditParModal: true,
      editingIndex: index,
      currentPar: currentPar
    });
  },

  // 点击选项直接确认修改
  confirmSelectPar: function(e) {
    const newPar = parseInt(e.currentTarget.dataset.par);
    const { editingIndex, currentPar } = this.data;

    if (newPar === currentPar) {
      this.hideEditParModal();
      return;
    }

    // 不可变更新ocrHoles
    const newOcrHoles = this.data.ocrHoles.map((h, i) => {
      if (i === editingIndex) {
        return { ...h, par: newPar };
      }
      return h;
    });

    // 重新计算小计和总计
    const ocrTotalPar = newOcrHoles.reduce((sum, h) => sum + h.par, 0);
    const frontNinePar = newOcrHoles.filter(h => h.hole <= 9).reduce((sum, h) => sum + h.par, 0);
    const backNinePar = newOcrHoles.filter(h => h.hole > 9).reduce((sum, h) => sum + h.par, 0);

    this.setData({
      ocrHoles: newOcrHoles,
      ocrTotalPar,
      frontNinePar,
      backNinePar,
      showEditParModal: false,
      editingIndex: -1
    });
  },

  // 关闭修改弹窗
  hideEditParModal: function() {
    this.setData({
      showEditParModal: false,
      editingIndex: -1
    });
  },

  // 阻止弹窗背景点击关闭
  preventHide: function() {}
})
