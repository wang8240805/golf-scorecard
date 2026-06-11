const app = getApp()
const { calculateDistance } = require('../../../utils/geo-utils.js')
const OCRService = require('../../../utils/ocr-service.js')
const { COURSE_CATALOG_VERSION, buildCourseCatalog } = require('../../utils/course-catalog.js')

// 开发模式开关
const DEV_MODE = false

Page({
  data: {
    courses: [],
    filteredCourses: [],
    favoriteCourseIds: [],
    showDetailModal: false,
    detailCourse: { holes: [] },
    userCity: '', // 用户所在城市
    userLocation: null,
    showOcrResult: false,
    recognizedCourse: { name: '', holes: [] }
  },

  onLoad() {
    // 先加载本地数据，再获取位置
    this.loadCoursesLocal()
    // 先初始化默认空数组，再加载数据
    this.setData({ favoriteCourseIds: [] }, () => {
      this.loadUserData()
      this.getUserLocation()
    })
  },

  onShow() {
    this.loadUserData()
    // 本地数据已经加载过
    if (this.data.courses.length === 0) {
      this.loadCoursesLocal()
    }
    // 球场页面不是 TabBar 页面，不设置 selected
    // TabBar 只包含：首页(0)、我的(1)
  },

  // 从本地加载全部球场数据
  loadCoursesLocal: function() {
    var localAllCourses = wx.getStorageSync('courses') || []
    var mergedCourses = buildCourseCatalog(localAllCourses)

    // 保存到缓存
    wx.setStorageSync('courses', mergedCourses)
    wx.setStorageSync('coursesDataVersion', COURSE_CATALOG_VERSION)
    this.setData({ courses: mergedCourses })
  },

  // 获取用户位置
  getUserLocation() {
    var self = this
    if (app && app.runAfterPrivacyAuthorization) {
      app.runAfterPrivacyAuthorization(function() {
        self.requestUserLocation()
      }, function() {
        self.processAndDisplayCourses()
      })
      return
    }
    this.requestUserLocation()
  },

  requestUserLocation() {
    // 开发模式：使用模拟位置
    if (DEV_MODE) {
      this.setData({
        userLocation: { latitude: 39.90, longitude: 116.40 }
      }, () => {
        this.loadCourses()
      })
      return
    }

    const self = this
    function handleLocationFail() {
      // 获取位置失败，继续处理显示
      self.processAndDisplayCourses()
    }

    wx.authorize({
      scope: 'scope.userFuzzyLocation',
      success: () => {
        wx.getFuzzyLocation({
          type: 'gcj02',
          success: (res) => {
            const location = {
              latitude: res.latitude,
              longitude: res.longitude
            }
            this.setData({ userLocation: location })

            // 使用逆地理编码获取城市名称
            this.getCityFromLocation(location)
          },
          fail: handleLocationFail
        })
      },
      fail: handleLocationFail
    })
  },

  // 根据坐标获取城市（简化版，使用内置数据匹配）
  getCityFromLocation: function(location) {
    var self = this
    // 从本地缓存拿所有球场数据
    var allCourses = wx.getStorageSync('courses') || []

    // 找到最近的球场，以其城市为准
    var nearestCourse = null
    var minDistance = Infinity

    allCourses.forEach(function(course) {
      var distance = calculateDistance(
        location.latitude, location.longitude,
        course.latitude, course.longitude
      )
      if (distance < minDistance) {
        minDistance = distance
        nearestCourse = course
      }
    })

    var userCity = '北京'
    if (nearestCourse) {
      if (nearestCourse.province === nearestCourse.city) {
        userCity = nearestCourse.province
      } else {
        userCity = nearestCourse.province + ' ' + nearestCourse.city
      }
    }
    this.setData({ userCity: userCity }, function() {
      self.loadCourses()
    })
  },

  // 加载用户数据（收藏）
  loadUserData: function() {
    try {
      var favoriteCourseIds = wx.getStorageSync('favoriteCourseIds')
      // 确保是数组
      if (Array.isArray(favoriteCourseIds)) {
        this.setData({ favoriteCourseIds: favoriteCourseIds })
      } else {
        this.setData({ favoriteCourseIds: [] })
        wx.setStorageSync('favoriteCourseIds', [])
      }
    } catch (e) {
      this.setData({ favoriteCourseIds: [] })
    }
  },

  // 处理并显示球场数据（统计、筛选、排序）
  loadCourses: function() {
    this.processAndDisplayCourses()
  },

  // 处理并显示球场数据（统计、筛选、排序）
  processAndDisplayCourses: function() {
    var allCourses = wx.getStorageSync('courses') || []
    var games = wx.getStorageSync('games') || []
    var favoriteCourseIds = this.data.favoriteCourseIds
    var userLocation = this.data.userLocation
    var self = this

    // 确保 favoriteCourseIds 是数组
    var safeFavoriteIds = Array.isArray(favoriteCourseIds) ? favoriteCourseIds : []

    // 统计每个球场的打球次数
    var playCountMap = {}
    games.forEach(function(game) {
      if (game.courseId) {
        playCountMap[game.courseId] = (playCountMap[game.courseId] || 0) + 1
      }
    })

    // 处理所有球场数据，计算距离
    var coursesWithStats = allCourses.map(function(course) {
      var newCourse = {}
      for (var key in course) {
        newCourse[key] = course[key]
      }
      // 计算距离
      var distance = Infinity
      if (userLocation && course.latitude && course.longitude) {
        distance = calculateDistance(
          userLocation.latitude, userLocation.longitude,
          course.latitude, course.longitude
        )
      }
      // 如果已有 holes 数据，计算 par，否则跳过（不显示在列表）
      var totalPar = 0
      if (course.holes && Array.isArray(course.holes)) {
        totalPar = course.holes.reduce(function(sum, h) { return sum + (h.par || 0) }, 0)
      }
      newCourse.totalPar = totalPar
      newCourse.playCount = playCountMap[course.id] || 0
      newCourse.isFavorite = course.id ? safeFavoriteIds.indexOf(course.id) >= 0 : false
      newCourse.distance = distance
      // 只显示有 holes 数据的球场，或者用户自定义的球场
      var hasValidHoles = course.holes && Array.isArray(course.holes) && course.holes.length > 0
      if (!hasValidHoles && !newCourse.isCustom) {
        return null
      }
      return newCourse
    }).filter(function(c) { return c !== null }) // 过滤掉无效数据

    // 1. 先筛选收藏的球场
    var favoriteCourses = coursesWithStats.filter(function(c) { return c.isFavorite })

    // 2. 筛选最近的10个球场（排除已经在收藏里的）
    var nonFavoriteCourses = coursesWithStats
      .filter(function(c) { return !c.isFavorite })
      .sort(function(a, b) { return a.distance - b.distance }) // 按距离升序
      .slice(0, 10) // 取前10个

    // 合并：收藏的在前，最近的在后
    var mergedCourses = favoriteCourses.concat(nonFavoriteCourses)

    this.setData({
      courses: mergedCourses,
      filteredCourses: mergedCourses
    })
  },

  // 跳转到全部球场页面
  goToAllCourses() {
    wx.navigateTo({
      url: '/package-courses/pages/all-courses/all-courses?from=new-game'
    })
  },

  // 切换收藏状态
  toggleFavorite(e) {
    const courseId = e.currentTarget.dataset.courseId
    if (!courseId) return

    const { favoriteCourseIds } = this.data
    // 确保是数组
    const safeFavorites = Array.isArray(favoriteCourseIds) ? favoriteCourseIds : []

    let newFavorites
    if (safeFavorites.includes(courseId)) {
      newFavorites = safeFavorites.filter(id => id !== courseId)
      wx.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      newFavorites = [...safeFavorites, courseId]
      wx.showToast({ title: '已收藏', icon: 'success' })
    }

    wx.setStorageSync('favoriteCourseIds', newFavorites)
    this.setData({ favoriteCourseIds: newFavorites }, () => {
      this.loadCourses()
    })
  },

  // 添加球场
  addCourse() {
    // 初始化18洞数据
    const holes = []
    for (let i = 1; i <= 18; i++) {
      holes.push({
        hole: i,
        par: 4,
        distance: 0,
        handicap: i
      })
    }

    this.setData({
      showModal: true,
      editingCourse: null,
      formData: {
        name: '',
        location: '',
        holes
      }
    })
  },

  // 编辑球场
  editCourse(e) {
    const course = e.currentTarget.dataset.course
    if (!course.isCustom) {
      wx.showToast({ title: '预设球场不可编辑', icon: 'none' })
      return
    }

    this.setData({
      showModal: true,
      editingCourse: course,
      formData: {
        name: course.name,
        location: course.location || '',
        holes: course.holes.map(h => ({ ...h }))
      }
    })
  },

  // 查看球场详情
  viewCourseDetail(e) {
    const course = e.currentTarget.dataset.course
    this.setData({
      showDetailModal: true,
      detailCourse: course
    })
  },

  // 关闭详情弹窗
  closeDetailModal() {
    this.setData({ showDetailModal: false })
  },

  preventHide() {
    // 阻止冒泡
  },

  // OCR识别计分卡
  openOcrScanner() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      camera: 'back',
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '识别中...' })
        this.recognizeScorecard(tempFilePath)
      },
      fail: () => {
        wx.showToast({ title: '取消选择', icon: 'none' })
      }
    })
  },

  // 识别计分卡图片 - 使用腾讯云表格识别V3
  async recognizeScorecard(imagePath) {
    try {
      const result = await OCRService.recognize(imagePath)

      if (result.success && result.holes && result.holes.length > 0) {
        const courseData = {
          name: '',
          par: result.validation?.totalPar || result.holes.reduce((sum, h) => sum + h.par, 0),
          holes: result.holes
        }

        if (result.holes.length === 18) {
          this.setData({
            showOcrResult: true,
            recognizedCourse: courseData
          })
        } else {
          wx.showModal({
            title: '识别不完整',
            content: `仅识别到${result.holes.length}个洞，是否保存并手动补充剩余洞数据？`,
            confirmText: '保存',
            success: (res) => {
              if (res.confirm) {
                this.setData({
                  showOcrResult: true,
                  recognizedCourse: courseData
                })
              }
            }
          })
        }
      } else {
        wx.showModal({
          title: '识别失败',
          content: result.error || '未能识别到任何洞数据，请确保图片清晰包含完整计分卡',
          showCancel: false
        })
      }
    } catch (err) {
      console.error('OCR识别失败:', err)
      wx.showModal({
        title: '识别失败',
        content: err.message || '请稍后重试',
        showCancel: false
      })
    }
  },

  // 解析OCR文本提取洞数据
  parseOcrText(text) {
    const course = {
      name: '',
      par: 0,
      holes: []
    }

    // 尝试提取球场名称
    const nameMatch = text.match(/(.*?)(高尔夫|球场|俱乐部)/)
    if (nameMatch) {
      course.name = nameMatch[0]
    }

    // 匹配洞数据：洞号 + Par + 距离
    const holePattern = /[第洞]*(\d{1,2})\D*?[Pp][Aa][Rr]*\s*(\d)\D*?(\d{2,4})\s*[码|Y]/g
    let match
    const holesMap = {}

    while ((match = holePattern.exec(text)) !== null) {
      const holeNum = parseInt(match[1])
      const par = parseInt(match[2])
      const distance = parseInt(match[3])

      if (1 <= holeNum <= 18 && 3 <= par <=5 && 100 <= distance <= 700) {
        holesMap[holeNum] = {
          hole: holeNum,
          par: par,
          distance: distance,
          handicap: 0
        }
      }
    }

    // 转换为数组并排序
    course.holes = Object.values(holesMap).sort((a, b) => a.hole - b.hole)
    course.par = course.holes.reduce((sum, h) => sum + h.par, 0)

    return course
  },

  // 确认识别结果
  onRecognizedCourseNameInput(e) {
    this.setData({
      'recognizedCourse.name': e.detail.value
    })
  },

  // 确认识别结果
  confirmRecognizedCourse() {
    const { recognizedCourse, userCity, userLocation } = this.data
    const customCourses = wx.getStorageSync('customCourses') || []

    // 生成新球场ID
    const newCourseId = `custom-${Date.now()}`
    const newCourse = {
      id: newCourseId,
      name: recognizedCourse.name || '自定义球场',
      location: userCity || '',
      province: userCity || '',
      city: userCity || '',
      latitude: userLocation?.latitude || 0,
      longitude: userLocation?.longitude || 0,
      par: recognizedCourse.par,
      holes: recognizedCourse.holes,
      isCustom: true,
      playCount: 0
    }

    // 保存到本地存储
    customCourses.push(newCourse)
    wx.setStorageSync('customCourses', customCourses)

    // 同时更新 courses 存储，确保首页能加载到
    const allCourses = wx.getStorageSync('courses') || []
    if (!allCourses.find(c => c.id === newCourseId)) {
      allCourses.push(newCourse)
      wx.setStorageSync('courses', allCourses)
    }

    // 刷新球场列表
    this.loadCourses()

    this.setData({ showOcrResult: false })
    wx.showToast({ title: '球场添加成功', icon: 'success' })
  },

  // 关闭OCR结果弹窗
  closeOcrModal() {
    this.setData({ showOcrResult: false })
  },

  // 获取排序方式文本
  getSortByText() {
    const texts = { playCount: '按次数', name: '按名称', distance: '按距离' }
    return texts[this.data.sortBy] || '排序'
  }
})
