const app = getApp()
const { calculateDistance } = require('../../../utils/geo-utils.js')
const { COURSE_CATALOG_VERSION, buildCourseCatalog } = require('../../utils/course-catalog.js')

// 开发模式开关
const DEV_MODE = false
const PROVINCE_NAMES = [
  '北京', '上海', '天津', '重庆',
  '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东',
  '河南', '湖北', '湖南', '广东', '海南',
  '四川', '贵州', '云南', '陕西', '甘肃', '青海',
  '台湾', '内蒙古', '广西', '宁夏', '新疆', '西藏',
  '香港', '澳门'
]
const MUNICIPALITY_NAMES = ['北京', '上海', '天津', '重庆', '香港', '澳门']

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
    localResultCount: 0,
    searchHintText: '',
    selectedProvinceFilter: '',
    provinceQuickFilters: [],
    allProvinceOptions: [],
    showProvincePicker: false,
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
      selectedProvinceFilter: fromNewGame ? '__nearby__' : '',
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
    var localAllCourses = wx.getStorageSync('courses') || []
    var mergedCourses = buildCourseCatalog(localAllCourses)

    // 保存到缓存
    wx.setStorageSync('courses', mergedCourses)
    wx.setStorageSync('coursesDataVersion', COURSE_CATALOG_VERSION)
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

  getCourseProvince: function(course) {
    if (!course) return ''
    var province = this.normalizeProvinceName(course.province || '')
    if (province) return province

    var cityAsProvince = this.normalizeProvinceName(course.city || '')
    return MUNICIPALITY_NAMES.indexOf(cityAsProvince) >= 0 ? cityAsProvince : ''
  },

  normalizeProvinceName: function(value) {
    var name = String(value || '').trim().replace(/\s+/g, '')
    if (!name) return ''
    var aliases = {
      '北京市': '北京',
      '上海市': '上海',
      '天津市': '天津',
      '重庆市': '重庆',
      '香港特别行政区': '香港',
      '澳门特别行政区': '澳门',
      '内蒙古自治区': '内蒙古',
      '广西壮族自治区': '广西',
      '宁夏回族自治区': '宁夏',
      '新疆维吾尔自治区': '新疆',
      '西藏自治区': '西藏'
    }
    if (aliases[name]) return aliases[name]
    if (PROVINCE_NAMES.indexOf(name) >= 0) return name

    for (var i = 0; i < PROVINCE_NAMES.length; i++) {
      var province = PROVINCE_NAMES[i]
      if (
        name.indexOf(province + '省') === 0 ||
        name.indexOf(province + '市') === 0 ||
        name.indexOf(province + '自治区') === 0 ||
        name.indexOf(province + '特别行政区') === 0 ||
        name.indexOf(province) === 0 && province.length >= 3
      ) {
        return province
      }
    }

    return ''
  },

  buildProvinceQuickFilters: function(courses) {
    if (!this.data.fromNewGame || !Array.isArray(courses) || courses.length === 0) {
      return []
    }

    var provinceCountMap = {}
    courses.forEach((course) => {
      var province = this.getCourseProvince(course)
      if (!province) return
      provinceCountMap[province] = (provinceCountMap[province] || 0) + 1
    })

    var filters = [{
      label: '附近',
      value: '__nearby__',
      type: 'nearby'
    }]

    Object.keys(provinceCountMap)
      .sort(function(a, b) {
        if (provinceCountMap[b] !== provinceCountMap[a]) return provinceCountMap[b] - provinceCountMap[a]
        return a.localeCompare(b, 'zh-CN')
      })
      .slice(0, 8)
      .forEach(function(province) {
        filters.push({
          label: province,
          value: province,
          type: 'province'
        })
      })

    filters.push({
      label: '其他',
      value: '__more__',
      type: 'more'
    })

    return filters
  },

  buildAllProvinceOptions: function(courses) {
    if (!Array.isArray(courses) || courses.length === 0) {
      return []
    }

    var provinceCountMap = {}
    courses.forEach((course) => {
      var province = this.getCourseProvince(course)
      if (!province) return
      provinceCountMap[province] = (provinceCountMap[province] || 0) + 1
    })

    return Object.keys(provinceCountMap)
      .sort(function(a, b) {
        if (provinceCountMap[b] !== provinceCountMap[a]) return provinceCountMap[b] - provinceCountMap[a]
        return a.localeCompare(b, 'zh-CN')
      })
      .map(function(province) {
        return {
          label: province,
          value: province,
          count: provinceCountMap[province]
        }
      })
  },

  selectProvinceFilter: function(e) {
    var value = e.currentTarget.dataset.value || ''
    if (value === '__more__') {
      this.setData({ showProvincePicker: true })
      return
    }
    var nextValue = this.data.selectedProvinceFilter === value ? '' : value
    this.setData({ selectedProvinceFilter: nextValue }, () => {
      this.applyFilters()
    })
  },

  selectProvinceFromPicker: function(e) {
    var value = e.currentTarget.dataset.value || ''
    if (!value) return
    this.setData({
      selectedProvinceFilter: value,
      showProvincePicker: false
    }, () => {
      this.applyFilters()
    })
  },

  closeProvincePicker: function() {
    this.setData({ showProvincePicker: false })
  },

  // 应用筛选和排序
  applyFilters() {
    const { courses, searchKeyword, showFavoritesOnly, sortBy, selectedProvinceFilter } = this.data

    // 确保 courses 是数组
    if (!Array.isArray(courses)) {
      this.setData({ filteredCourses: [] })
      return
    }

    let result = [...courses]
    const provinceQuickFilters = this.buildProvinceQuickFilters(courses)
    const allProvinceOptions = this.buildAllProvinceOptions(courses)

    // 1. 按收藏筛选
    if (showFavoritesOnly) {
      result = result.filter(c => c.isFavorite)
    }

    if (selectedProvinceFilter && selectedProvinceFilter !== '__nearby__') {
      if (selectedProvinceFilter !== '__more__') {
        result = result.filter(c => this.getCourseProvince(c) === selectedProvinceFilter)
      }
    }

    // 2. 按搜索关键词筛选。创建球局时优先解决“快速找到本地库里的球场”，所以搜索态按相关度排序。
    const keyword = searchKeyword.trim()
    if (keyword) {
      result = result
        .map(c => {
          return {
            ...c,
            _searchScore: this.getCourseSearchScore(c, keyword)
          }
        })
        .filter(c => c._searchScore > 0)
        .sort((a, b) => {
          if (b._searchScore !== a._searchScore) return b._searchScore - a._searchScore
          if (!!b.holesVerified !== !!a.holesVerified) return b.holesVerified ? 1 : -1
          return (a.geoDistance || Infinity) - (b.geoDistance || Infinity)
        })
    } else {
      // 3. 非搜索态排序
      const activeSortBy = this.data.fromNewGame ? 'distance' : sortBy
      switch (activeSortBy) {
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
    }

    this.setData({
      filteredCourses: result,
      provinceQuickFilters: provinceQuickFilters,
      allProvinceOptions: allProvinceOptions,
      localResultCount: result.length,
      searchHintText: keyword
        ? (result.length > 0 ? '已在本地球场库中匹配，可直接选用' : '本地库未找到，可手动新增或用地图补全名称地址')
        : ''
    })
  },

  getCourseSearchScore(course, keyword) {
    const rawKeyword = String(keyword || '').trim()
    const normalizedKeyword = this.normalizeCourseName(rawKeyword)
    if (!normalizedKeyword) return 0

    const name = String(course.name || '')
    const location = String(course.location || '')
    const city = String(course.city || '')
    const province = String(course.province || '')
    const aliases = Array.isArray(course.searchAliases) ? course.searchAliases.join(' ') : ''
    const normalizedName = this.normalizeCourseName(name)
    const normalizedText = this.normalizeCourseName([name, location, city, province, aliases].join(' '))
    const rawText = [name, location, city, province, aliases].join(' ').toLowerCase()
    const keywordLower = rawKeyword.toLowerCase()

    let score = 0
    if (normalizedName === normalizedKeyword) score += 1000
    if (normalizedName.indexOf(normalizedKeyword) === 0) score += 700
    if (normalizedName.indexOf(normalizedKeyword) >= 0) score += 500
    if (normalizedText.indexOf(normalizedKeyword) >= 0) score += 260
    if (rawText.indexOf(keywordLower) >= 0) score += 160

    const terms = keywordLower.split(/\s+/).filter(Boolean)
    if (terms.length > 1 && terms.every(term => rawText.indexOf(term) >= 0)) {
      score += 220
    }

    if (course.courseDataQuality === 'verified' || course.courseDataQuality === 'manual' || course.courseDataQuality === 'ocr') score += 80
    if (course.holesSource === 'public-web' || course.isPublicScorecard) score += 65
    if (course.holesVerified || (Array.isArray(course.holes) && course.holes.length >= 9)) score += 40
    if (course.playCount > 0) score += Math.min(course.playCount * 8, 40)
    if (course.isFavorite) score += 20
    if (isFinite(course.geoDistance)) score += Math.max(0, 30 - Math.floor(course.geoDistance / 5000))

    return score
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
      .replace(/[（）()\-·,，.。]/g, '')
      .replace(/golfclub/g, 'golf')
      .replace(/countryclub/g, 'club')
      .replace(/高尔夫(球场|俱乐部|球会)?/g, '高尔夫')
      .replace(/国际|俱乐部|球会|球场|乡村|公园|度假村/g, '')
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
    wx.showModal({
      title: '地图补全',
      content: '地图补全只能补充球场名称、地址和定位，通常没有每洞标准杆。找到后仍可选用，开赛时再拍卡或手动校准。',
      confirmText: '继续查找',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.fetchOnlineCourses(keyword, cityForSearch)
        }
      }
    })
  },

  fetchOnlineCourses(keyword, city) {
    this.setData({ onlineSyncing: true })
    wx.showLoading({ title: '地图补全中...' })

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
          wx.showToast({ title: '地图未找到', icon: 'none' })
          this.setData({ onlineSyncing: false })
          return
        }

        const stat = this.mergeOnlineCourses(pois)
        this.loadCoursesLocal()
        this.loadUserData()
        this.processAndDisplayCourses()
        this.setData({ onlineSyncing: false })
        wx.showToast({
          title: `地图新增${stat.addedCount} 更新${stat.updatedCount}`,
          icon: 'none',
          duration: 2500
        })
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('[syncOnlineCourses] failed:', err)
        this.setData({ onlineSyncing: false })
        wx.showToast({ title: '地图补全失败', icon: 'none' })
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
      par: 72,
      holesVerified: true,
      holesSource: 'manual-create',
      isCustom: true,
      source: 'manual-create',
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
