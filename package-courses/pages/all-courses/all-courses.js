const app = getApp()
const { calculateDistance } = require('../../../utils/geo-utils.js')
const ALL_COURSES = require('../../../data/courses-accurate.js')

// 开发模式开关
const DEV_MODE = false

Page({
  data: {
    courses: [],
    filteredCourses: [],
    favoriteCourseIds: [],
    searchKeyword: '',
    showFavoritesOnly: false,
    sortBy: 'playCount', // 'playCount' | 'name' | 'distance'
    showDetailModal: false,
    detailCourse: { holes: [] },
    userCity: '', // 用户所在城市
    userLocation: null,
    fromNewGame: false, // 是否从创建比赛页面进入
    currentCourseId: '',
    showAddCourseModal: false,
    newCourseName: '',
    newCourseLocation: '',
    sampleCourseNames: [
      '北京高尔夫球俱乐部',
      '观澜湖高尔夫球会',
      '佘山国际高尔夫俱乐部',
      '深圳高尔夫俱乐部'
    ],
    onlineSyncing: false
  },

  onLoad(options) {
    const fromNewGame = options && options.from === 'new-game'
    wx.setNavigationBarTitle({ title: '全部球场' })
    // 标记是否从创建比赛页面进入
    this.setData({
      fromNewGame: fromNewGame,
      sortBy: fromNewGame ? 'distance' : 'playCount',
      currentCourseId: wx.getStorageSync('currentCourseId') || '',
      favoriteCourseIds: []
    }, () => {
      this.loadUserData()
      this.loadCoursesLocal()
      this.getUserLocation()
    })
  },

  onShow() {
    this.loadUserData()
    this.setData({
      currentCourseId: wx.getStorageSync('currentCourseId') || ''
    })
    // 本地数据已经加载过，不需要重新加载
    if (this.data.courses.length === 0) {
      this.loadCoursesLocal()
    }
  },

  // 从本地加载全部球场数据
  loadCoursesLocal: function() {
    var self = this
    var courses = ALL_COURSES || []
    var localAllCourses = wx.getStorageSync('courses') || []
    var localMap = {}
    localAllCourses.forEach(function(course) {
      if (course && course.id) {
        localMap[course.id] = course
      }
    })

    // 预处理
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

    // 合并本地动态数据，避免覆盖用户已校对/贡献的数据
    var mergedCourses = courses.map(function(course) {
      var localCourse = localMap[course.id]
      if (!localCourse) {
        return course
      }
      return {
        ...course,
        ...localCourse
      }
    })

    // 保留仅存在于本地的自定义球场
    localAllCourses.forEach(function(course) {
      if (!course || !course.id) return
      var exists = mergedCourses.find(function(c) { return c.id === course.id })
      if (!exists && course.isCustom) {
        mergedCourses.push(course)
      }
    })

    // 保存到缓存
    wx.setStorageSync('courses', mergedCourses)
    this.setData({ courses: mergedCourses })
    this.processAndDisplayCourses()
  },

  // 获取用户位置
  getUserLocation() {
    // 开发模式：使用模拟位置
    if (DEV_MODE) {
      this.setData({
        userLocation: { latitude: 39.90, longitude: 116.40 }
      }, () => {
        this.processAndDisplayCourses()
      })
      return
    }

    wx.getLocation({
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
      fail: () => {
        // 获取位置失败，继续处理显示
        this.processAndDisplayCourses()
      }
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

    var userCity = nearestCourse ? nearestCourse.province : '北京'
    this.setData({ userCity: userCity }, function() {
      self.processAndDisplayCourses()
    })
  },

  // 加载用户数据
  loadUserData: function() {
    var favoriteIds = wx.getStorageSync('favoriteCourseIds') || []
    this.setData({ favoriteCourseIds: favoriteIds })
  },

  // 处理并显示球场数据（统计、筛选、排序）
  processAndDisplayCourses: function() {
    var allCourses = wx.getStorageSync('courses') || []
    var games = wx.getStorageSync('games') || []
    var favoriteCourseIds = this.data.favoriteCourseIds
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

    // 计算球场统计并添加打球次数、收藏状态、地理距离
    var coursesWithStats = allCourses.map(function(course) {
      var newCourse = {}
      for (var key in course) {
        newCourse[key] = course[key]
      }
      // 如果已有 holes 数据（用户验证过），保留它
      // 如果没有 holes，totalPar 会是 0，显示为空
      var totalPar = 0
      var totalDistance = 0
      if (course.holes && Array.isArray(course.holes)) {
        totalPar = course.holes.reduce(function(sum, h) { return sum + (h.par || 0) }, 0)
        totalDistance = course.holes.reduce(function(sum, h) { return sum + (h.distance || 0) }, 0)
      }
      newCourse.totalPar = totalPar
      newCourse.totalDistance = totalDistance
      var geoDistance = Infinity
      if (self.data.userLocation && course.latitude && course.longitude) {
        geoDistance = calculateDistance(
          self.data.userLocation.latitude,
          self.data.userLocation.longitude,
          course.latitude,
          course.longitude
        )
      }
      newCourse.geoDistance = geoDistance
      newCourse.playCount = playCountMap[course.id] || 0
      newCourse.isFavorite = course.id ? safeFavoriteIds.indexOf(course.id) >= 0 : false
      newCourse.isCustom = course.id ? (!course.id.startsWith('china-') && !course.id.startsWith('scraped-')) : false
      // 即使没有 holes 数据也显示，让用户可以选择
      return newCourse
    })

    this.setData({ courses: coursesWithStats }, function() {
      self.applyFilters()
    })
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value }, () => {
      this.applyFilters()
    })
  },

  // 清除搜索
  clearSearch() {
    this.setData({ searchKeyword: '' }, () => {
      this.applyFilters()
    })
  },

  // 切换只显示收藏
  toggleFavoritesOnly() {
    this.setData({ showFavoritesOnly: !this.data.showFavoritesOnly }, () => {
      this.applyFilters()
    })
  },

  // 切换排序方式
  toggleSortBy() {
    const sortOptions = ['playCount', 'name', 'distance']
    const currentIndex = sortOptions.indexOf(this.data.sortBy)
    const nextSortBy = sortOptions[(currentIndex + 1) % sortOptions.length]
    this.setData({ sortBy: nextSortBy }, () => {
      this.applyFilters()
    })
  },

  // 应用筛选和排序
  applyFilters() {
    const { courses, searchKeyword, showFavoritesOnly, sortBy } = this.data

    // 确保 courses 是数组
    if (!Array.isArray(courses)) {
      this.setData({ filteredCourses: [] })
      return
    }

    let result = [...courses]

    // 1. 按收藏筛选
    if (showFavoritesOnly) {
      result = result.filter(c => c.isFavorite)
    }

    // 2. 按搜索关键词筛选
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase()
      result = result.filter(c =>
        String(c.name || '').toLowerCase().includes(keyword) ||
        String(c.location || '').toLowerCase().includes(keyword) ||
        String(c.city || '').toLowerCase().includes(keyword)
      )
    }

    // 3. 排序
    switch (sortBy) {
      case 'playCount':
        result.sort((a, b) => b.playCount - a.playCount)
        break
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        break
      case 'distance':
        result.sort((a, b) => (a.geoDistance || Infinity) - (b.geoDistance || Infinity))
        break
    }

    this.setData({ filteredCourses: result })
  },

  // 切换收藏状态
  toggleFavorite(e) {
    const courseId = e.currentTarget.dataset.courseId
    let favoriteIds = this.data.favoriteCourseIds || []

    if (favoriteIds.includes(courseId)) {
      // 取消收藏
      favoriteIds = favoriteIds.filter(id => id !== courseId)
      wx.showToast({ title: '已取消收藏', icon: 'success' })
    } else {
      // 添加收藏
      favoriteIds.push(courseId)
      wx.showToast({ title: '收藏成功', icon: 'success' })
    }

    // 保存到本地存储
    wx.setStorageSync('favoriteCourseIds', favoriteIds)
    this.setData({ favoriteCourseIds: favoriteIds }, () => {
      this.processAndDisplayCourses()
    })
  },

  // 查看球场详情
  viewCourseDetail(e) {
    const course = e.currentTarget.dataset.course
    const safeCourse = {
      ...course,
      holes: Array.isArray(course.holes) ? course.holes : []
    }
    this.setData({
      showDetailModal: true,
      detailCourse: safeCourse
    })
  },

  // 球场卡片点击：创建比赛场景下直接选中返回
  onCourseTap(e) {
    const course = e.currentTarget.dataset.course
    if (!course || !course.id) return
    if (this.data.fromNewGame) {
      this.quickSelectCourse(course)
      return
    }
    this.viewCourseDetail(e)
  },

  quickSelectCourse(course) {
    wx.setStorageSync('currentCourseId', course.id)
    wx.setStorageSync('selectedCourseForNewGame', course)
    this.setData({ currentCourseId: course.id })
    wx.showToast({ title: '已选中球场', icon: 'success' })
    setTimeout(() => {
      wx.navigateBack()
    }, 250)
  },

  // 关闭详情弹窗
  closeDetailModal() {
    this.setData({ showDetailModal: false })
  },

  // 选择此球场并返回（从创建比赛页面进入时）
  selectCourseAndBack() {
    const course = this.data.detailCourse
    if (!course || !course.id) {
      wx.showToast({ title: '球场数据无效', icon: 'none' })
      return
    }

    // 保存选中的球场ID
    wx.setStorageSync('currentCourseId', course.id)

    // 保存选中的球场完整数据供创建比赛页面使用
    wx.setStorageSync('selectedCourseForNewGame', course)

    // 返回上一页
    wx.navigateBack({
      success: () => {
        console.log('已选择球场并返回:', course.name)
      }
    })
  },

  preventHide() {
    // 阻止冒泡
  },

  normalizeCourseName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[（）()\-·]/g, '')
      .replace(/高尔夫(球场|俱乐部)?/g, '高尔夫')
  },

  mergeOnlineCourses(pois) {
    const allCourses = wx.getStorageSync('courses') || []
    const merged = Array.isArray(allCourses) ? [...allCourses] : []
    let addedCount = 0
    let updatedCount = 0

    ;(pois || []).forEach((poi) => {
      const normalized = this.normalizeCourseName(poi.name)
      if (!normalized) return

      let hitIndex = merged.findIndex((c) => {
        const n = this.normalizeCourseName(c.name)
        if (n && n === normalized) return true
        if (c.latitude && c.longitude && poi.latitude && poi.longitude) {
          const d = calculateDistance(c.latitude, c.longitude, poi.latitude, poi.longitude)
          if (d < 1200 && n.indexOf(normalized.slice(0, 4)) >= 0) return true
        }
        return false
      })

      if (hitIndex >= 0) {
        const existing = merged[hitIndex]
        merged[hitIndex] = {
          ...existing,
          location: existing.location || poi.location || poi.address || '',
          province: existing.province || poi.province || '',
          city: existing.city || poi.city || '',
          latitude: existing.latitude || poi.latitude || 0,
          longitude: existing.longitude || poi.longitude || 0,
          source: existing.source || poi.source || 'amap-poi',
          sourceId: existing.sourceId || poi.sourceId || '',
          updatedAt: new Date().toISOString()
        }
        updatedCount += 1
      } else {
        merged.push({
          id: `amap-${poi.sourceId}`,
          name: poi.name,
          location: poi.location || poi.address || '',
          province: poi.province || '',
          city: poi.city || '',
          latitude: poi.latitude || 0,
          longitude: poi.longitude || 0,
          holes: null,
          holesVerified: false,
          isCustom: false,
          source: 'amap-poi',
          sourceId: poi.sourceId,
          createdAt: new Date().toISOString()
        })
        addedCount += 1
      }
    })

    wx.setStorageSync('courses', merged)
    return { addedCount, updatedCount, total: merged.length }
  },

  syncOnlineCourses() {
    if (this.data.onlineSyncing) return
    const cityText = (this.data.userCity || '').trim()
    const cityForSearch = cityText.split(/\s+/)[0] || ''
    this.fetchOnlineCourses('高尔夫球场', cityForSearch)
  },

  searchOnlineByKeyword() {
    if (this.data.onlineSyncing) return
    const keyword = (this.data.searchKeyword || '').trim()
    if (!keyword) {
      wx.showToast({ title: '请先输入关键词', icon: 'none' })
      return
    }
    const cityText = (this.data.userCity || '').trim()
    const cityForSearch = cityText.split(/\s+/)[0] || ''
    this.fetchOnlineCourses(keyword, cityForSearch)
  },

  fetchOnlineCourses(keyword, city) {
    this.setData({ onlineSyncing: true })
    wx.showLoading({ title: '在线补全中...' })

    wx.cloud.callFunction({
      name: 'searchGolfCourses',
      data: {
        keyword: keyword,
        city: city,
        location: this.data.userLocation || null,
        pageSize: 25
      },
      success: (res) => {
        wx.hideLoading()
        const result = res && res.result ? res.result : {}
        if (!result.success) {
          wx.showToast({ title: result.error || '在线检索失败', icon: 'none' })
          this.setData({ onlineSyncing: false })
          return
        }

        const pois = Array.isArray(result.data) ? result.data : []
        if (pois.length === 0) {
          wx.showToast({ title: '未找到匹配球场', icon: 'none' })
          this.setData({ onlineSyncing: false })
          return
        }

        const stat = this.mergeOnlineCourses(pois)
        this.loadCoursesLocal()
        this.loadUserData()
        this.processAndDisplayCourses()
        this.setData({ onlineSyncing: false })
        wx.showToast({
          title: `新增${stat.addedCount} 更新${stat.updatedCount}`,
          icon: 'none',
          duration: 2500
        })
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('[syncOnlineCourses] failed:', err)
        this.setData({ onlineSyncing: false })
        wx.showToast({ title: '在线检索失败', icon: 'none' })
      }
    })
  },

  openAddCourseModal() {
    this.setData({
      showAddCourseModal: true,
      newCourseName: '',
      newCourseLocation: this.data.userCity || ''
    })
  },

  closeAddCourseModal() {
    this.setData({ showAddCourseModal: false })
  },

  onNewCourseNameInput(e) {
    this.setData({ newCourseName: e.detail.value })
  },

  useSampleCourseName(e) {
    const name = e.currentTarget.dataset.name || ''
    if (!name) return
    this.setData({ newCourseName: name })
    wx.showToast({ title: '已填入示例名称', icon: 'none' })
  },

  onNewCourseLocationInput(e) {
    this.setData({ newCourseLocation: e.detail.value })
  },

  fillCurrentCity() {
    this.setData({
      newCourseLocation: this.data.userCity || ''
    })
    wx.showToast({ title: '已填入当前城市', icon: 'none' })
  },

  confirmAddCourse() {
    const name = (this.data.newCourseName || '').trim()
    const location = (this.data.newCourseLocation || '').trim()
    if (!name) {
      wx.showToast({ title: '请输入球场名称', icon: 'none' })
      return
    }

    const holes = []
    for (let i = 1; i <= 18; i++) {
      holes.push({
        hole: i,
        par: 4,
        distance: 0,
        handicap: i
      })
    }

    const now = Date.now()
    const newCourse = {
      id: 'custom-' + now,
      name: name,
      location: location || (this.data.userCity || ''),
      province: this.data.userCity || '',
      city: this.data.userCity || '',
      latitude: this.data.userLocation ? this.data.userLocation.latitude : 0,
      longitude: this.data.userLocation ? this.data.userLocation.longitude : 0,
      holes: holes,
      totalPar: 72,
      holesVerified: true,
      isCustom: true,
      createdAt: new Date(now).toISOString(),
      playCount: 0
    }

    const allCourses = wx.getStorageSync('courses') || []
    allCourses.push(newCourse)
    wx.setStorageSync('courses', allCourses)

    this.setData({ showAddCourseModal: false })

    if (this.data.fromNewGame) {
      wx.setStorageSync('currentCourseId', newCourse.id)
      wx.setStorageSync('selectedCourseForNewGame', newCourse)
      wx.showToast({ title: '已添加并选中', icon: 'success' })
      setTimeout(() => {
        wx.navigateBack()
      }, 300)
      return
    }

    this.processAndDisplayCourses()
    wx.showToast({ title: '球场已添加', icon: 'success' })
  }
})
