const app = getApp()
const { calculateDistance } = require('../../utils/geo-utils.js')
const { formatDate } = require('../../utils/date-utils.js')
const gameCompleteness = require('../../utils/game-completeness.js')
const ALL_COURSES = require('../../data/courses-accurate.js')

Page({
  data: {
    currentCourse: null,
    courses: [],
    builtinCourses: [],
    filteredCourses: [],
    nearbyCourses: [],
    recentGames: [],
    hasOngoingGame: false,
    ongoingGame: null,
    ongoingDetail: null,
    showOngoingDetail: false,
    showStatsDetail: false,
    userStats: { totalGames: 0, bestScore: 0 },
    selectedProvince: '全部',
    provinces: ['全部', '北京', '上海', '广东', '江苏', '浙江', '山东', '四川', '海南', '福建', '云南', '辽宁', '湖北', '湖南', '河南', '河北', '天津', '重庆', '陕西', '安徽', '江西', '广西', '贵州', '山西', '吉林', '黑龙江', '甘肃', '内蒙古', '新疆', '西藏', '宁夏', '青海'],
    courseCount: 0,
    userLocation: null,
    locationAuth: false,
    pageLoading: true,  // 首屏加载状态
    isFirstVisit: true,
    welcomeStats: {
      totalRounds: 0,
      posters: 0,
      avgTimeSaved: 0
    },
    latestFinishedGame: null,
    quickStartSetup: null,
    homeReadyTitle: '开始第一场比赛',
    homeReadySubtitle: '球场数据加载完成后即可选择球场开局',
    homeShowNewUserTip: true,
    homeHasRecentGames: false
  },

  onLoad() {
    const hasVisited = wx.getStorageSync('indexVisited') === true
    this.setData({ isFirstVisit: !hasVisited })
    wx.setStorageSync('indexVisited', true)

    // 从本地加载全部球场数据，异步处理不卡界面
    var self = this
    setTimeout(function() {
      self.initCoursesLocal()
      self.loadData()
    }, 0)
    this.getUserLocation()

    // 监听全局游戏数据变化，云端更新自动刷新首页
    const app = getApp()
    this.gameDataChangeCallback = () => {
      this.loadData()
    }
    app.eventBus.on('gameDataChanged', this.gameDataChangeCallback)
  },

  onShow() {
    // 页面返回时不显示骨架屏，直接加载数据
    this.setData({ pageLoading: false })
    this.loadData()
    this.checkOngoingGame()
    // 设置TabBar选中状态 - 首页是第0个
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  // 获取用户位置
  getUserLocation() {
    const self = this
    function handleLocationFail() {
      self.setData({ locationAuth: false })
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
            this.setData({
              userLocation: location,
              locationAuth: true
            })
            this.calculateNearbyCourses(location)
          },
          fail: handleLocationFail
        })
      },
      fail: handleLocationFail
    })
  },

  // 计算并排序附近球场（带缓存优化）
  calculateNearbyCourses(userLoc) {
    // 缓存检查：如果位置变化小于 500m，使用缓存结果
    if (this._nearbyCache && this._nearbyCache.location) {
      const cachedLoc = this._nearbyCache.location
      const distance = calculateDistance(
        cachedLoc.latitude, cachedLoc.longitude,
        userLoc.latitude, userLoc.longitude
      )
      if (distance < 500 && this._nearbyCache.result) {
        this.setData({ nearbyCourses: this._nearbyCache.result })
        return
      }
    }

    const courses = wx.getStorageSync('courses') || []
    // 过滤掉模拟数据，显示所有真实球场
    const builtinCourses = courses.filter(c => !c.id.startsWith('mock-'))

    const coursesWithDistance = builtinCourses.map(course => {
      const distance = calculateDistance(
        userLoc.latitude, userLoc.longitude,
        course.latitude, course.longitude
      )
      return { ...course, distance }
    })

    // 按距离排序
    const sorted = coursesWithDistance.sort((a, b) => a.distance - b.distance)

    // 取最近的10个
    const nearbyCourses = sorted.slice(0, 10).map(course => ({
      ...course,
      distanceFormatted: this.formatDistance(course.distance)
    }))

    // 保存到缓存
    this._nearbyCache = {
      location: userLoc,
      result: nearbyCourses
    }

    this.setData({
      nearbyCourses
    })
  },

  // 格式化距离显示
  formatDistance(distance) {
    if (distance < 1000) {
      return Math.round(distance) + 'm'
    }
    return (distance / 1000).toFixed(1) + 'km'
  },

  // 从本地打包初始化全部球场数据（带缓存检查优化）
  initCoursesLocal: function() {
    // 检查是否已初始化，避免重复处理
    const isInitialized = wx.getStorageSync('coursesInitialized')
    const cachedCourses = wx.getStorageSync('courses')

    if (isInitialized && cachedCourses && cachedCourses.length > 0) {
      // 已初始化，直接使用缓存，快速显示
      this.setData({ courseCount: cachedCourses.length })
      return
    }

    // 首次加载：处理球场数据
    var courses = ALL_COURSES || []
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

    // 合并用户自定义球场
    var localCourses = wx.getStorageSync('courses') || []
    var customCourses = localCourses.filter(function(c) {
      return c.isCustom
    })
    customCourses.forEach(function(custom) {
      var exists = courses.find(function(c) { return c.id === custom.id })
      if (!exists) {
        courses.push(custom)
      }
    })

    // 保存到缓存
    wx.setStorageSync('courses', courses)
    wx.setStorageSync('coursesInitialized', true)
    wx.setStorageSync('coursesDataVersion', 'local-v1')

    this.setData({ courseCount: courses.length })
  },

  loadData() {
    // 加载球场数据
    var courses = wx.getStorageSync('courses') || []

    // 如果还没有初始化，显示空状态
    // 懒加载：用户点击开始新比赛后，在选择球场页面加载
    if (courses.length === 0) {
      // 加载最近比赛
      const games = wx.getStorageSync('games') || []
      const recentGames = (games || [])
        .slice()
        .sort(function(a, b) {
          const at = a.timestamp || a.endTime || a.createTime || 0
          const bt = b.timestamp || b.endTime || b.createTime || 0
          return bt - at
        })
        .slice(0, 2)
        .map(game => {
        const me = game.players?.find(p => p.isMe) || game.players?.[0]
        // 从 statistics 或直接计算获取成绩
        let myScore = 0
        if (game.statistics && me && game.statistics[me.id]) {
          myScore = game.statistics[me.id].totalScore || 0
        } else if (me && game.scores && game.scores[me.id]) {
          // 兼容旧数据：从 scores 直接计算
          const scores = game.scores[me.id]
          Object.values(scores).forEach(s => {
            const strokes = typeof s === 'object' ? s.strokes : s
            myScore += parseInt(strokes) || 0
          })
        }
        const gameHoles = Array.isArray(game.holes) ? game.holes : []
        const holeParMap = {}
        gameHoles.forEach(function(h) {
          if (h && h.hole) {
            holeParMap[Number(h.hole)] = Number(h.par) || 4
          }
        })
        let holesPlayed = 0
        let playedPar = 0
        if (me && game.scores && game.scores[me.id]) {
          const myHoleScores = game.scores[me.id]
          Object.keys(myHoleScores).forEach(function(holeKey) {
            const holeNum = Number(holeKey)
            const raw = myHoleScores[holeKey]
            const strokes = typeof raw === "object" ? raw.strokes : raw
            const parsed = parseInt(strokes) || 0
            if (parsed > 0) {
              holesPlayed++
              playedPar += holeParMap[holeNum] || 4
            }
          })
        }
        const toParValue = holesPlayed > 0 ? (myScore - playedPar) : 0
        const toParText = holesPlayed > 0 ? (toParValue === 0 ? "E" : ((toParValue > 0 ? "+" : "") + toParValue)) : "-"
        const toParClass = holesPlayed > 0
          ? (toParValue < 0 ? "under" : (toParValue > 0 ? "over" : "even"))
          : "empty"
        // 兼容老数据：使用 timestamp，如果没有则使用 endTime，如果都没有使用当前时间
        const timestamp = game.timestamp || game.endTime || Date.now()
        // 确保每个比赛都有id（兼容老数据）
        const gameId = game.id || game.gameId || 'local_' + timestamp
        return {
          ...game,
          id: gameId,
          courseName: game.courseName || '未知球场',
          date: formatDate(timestamp),
          myScore: myScore > 0 ? myScore : '-',
          holesPlayed: holesPlayed,
          holesTotal: gameHoles.length || 18,
          toParText: toParText,
          toParClass: toParClass,
          toParClassName: 'to-par-' + toParClass
        }
      }) // 保留所有比赛记录，分数缺失时在UI显示为“-”

      const latestFinishedGame = this.getLatestFinishedGame(games)
      const quickStartSetup = this.buildQuickStartSetup(games)
      const homeState = this.buildHomeState(recentGames, quickStartSetup, 0)

      this.setData({
        courses: [],
        builtinCourses: [],
        currentCourse: null,
        recentGames,
        latestFinishedGame,
        courseCount: 0,
        totalPar: 0,
        averageScore: '-',
        hasOngoingGame: false,
        ongoingGame: null,
        pageLoading: false,
        welcomeStats: this.buildWelcomeStats(games),
        quickStartSetup: quickStartSetup,
        homeReadyTitle: homeState.homeReadyTitle,
        homeReadySubtitle: homeState.homeReadySubtitle,
        homeShowNewUserTip: homeState.homeShowNewUserTip,
        homeHasRecentGames: homeState.homeHasRecentGames
      }, () => {
        // 数据设置完成后，检查是否有进行中的比赛
        this.checkOngoingGame()
      })
      return
    }

    var currentCourseId = wx.getStorageSync('currentCourseId')
    var currentCourse = courses.find(function(c) { return c.id === currentCourseId }) || courses[0]

    // 球场数据已缓存，直接使用缓存值

    // 区分预置球场和自定义球场
    var builtinCourses = courses.filter(function(c) { return !c.id.startsWith('mock-') && !c.id.startsWith('custom-') })
    var customCourses = courses.filter(function(c) { return c.id.startsWith('custom-') })

    // 按省份筛选
    var selectedProvince = this.data.selectedProvince
    if (selectedProvince !== '全部') {
      builtinCourses = builtinCourses.filter(function(c) { return c.province === selectedProvince })
    }

    // 加载最近比赛
    const games = wx.getStorageSync('games') || []
    // 去重：基于 id/timestamp 去重
    const seen = new Set()
    const uniqueGames = games.filter(game => {
      // 使用 id 或 timestamp + courseId 作为去重键
      const key = game.id || game.gameId ||
                 `${game.timestamp || game.endTime || 'none'}-${game.courseId}`
      if (seen.has(key)) {
        return false // 重复，过滤掉
      }
      seen.add(key)
      return true
    })
    const recentGames = uniqueGames
      .slice()
      .sort(function(a, b) {
        const at = a.timestamp || a.endTime || a.createTime || 0
        const bt = b.timestamp || b.endTime || b.createTime || 0
        return bt - at
      })
      .slice(0, 2)
      .map(game => {
      const me = game.players?.find(p => p.isMe) || game.players?.[0]
      // 从 statistics 或直接计算获取成绩
      let myScore = 0
      if (game.statistics && me && game.statistics[me.id]) {
        myScore = game.statistics[me.id].totalScore || 0
      } else if (me && game.scores && game.scores[me.id]) {
        // 兼容旧数据：从 scores 直接计算
        const scores = game.scores[me.id]
        Object.values(scores).forEach(s => {
          const strokes = typeof s === 'object' ? s.strokes : s
          myScore += parseInt(strokes) || 0
        })
      }
      const gameHoles = Array.isArray(game.holes) ? game.holes : []
      const holeParMap = {}
      gameHoles.forEach(function(h) {
        if (h && h.hole) {
          holeParMap[Number(h.hole)] = Number(h.par) || 4
        }
      })
      let holesPlayed = 0
      let playedPar = 0
      if (me && game.scores && game.scores[me.id]) {
        const myHoleScores = game.scores[me.id]
        Object.keys(myHoleScores).forEach(function(holeKey) {
          const holeNum = Number(holeKey)
          const raw = myHoleScores[holeKey]
          const strokes = typeof raw === "object" ? raw.strokes : raw
          const parsed = parseInt(strokes) || 0
          if (parsed > 0) {
            holesPlayed++
            playedPar += holeParMap[holeNum] || 4
          }
        })
      }
      const toParValue = holesPlayed > 0 ? (myScore - playedPar) : 0
      const toParText = holesPlayed > 0 ? (toParValue === 0 ? "E" : ((toParValue > 0 ? "+" : "") + toParValue)) : "-"
      const toParClass = holesPlayed > 0
        ? (toParValue < 0 ? "under" : (toParValue > 0 ? "over" : "even"))
        : "empty"
      // 兼容老数据：使用 timestamp，如果没有则使用 endTime，如果都没有使用当前时间
      const timestamp = game.timestamp || game.endTime || Date.now()
      // 确保每个比赛都有id（兼容老数据）
      const gameId = game.id || game.gameId || 'local_' + timestamp
      return {
        ...game,
        id: gameId,
        courseName: game.courseName || '未知球场',
        date: formatDate(timestamp),
        myScore: myScore > 0 ? myScore : '-',
        holesPlayed: holesPlayed,
        holesTotal: gameHoles.length || 18,
        toParText: toParText,
        toParClass: toParClass,
        toParClassName: 'to-par-' + toParClass
      }
    }) // 保留所有比赛记录，分数缺失时在UI显示为“-”

    // 计算当前球场的平均杆数
    const averageScore = this.calculateAverageScore(currentCourse?.id)

    const latestFinishedGame = this.getLatestFinishedGame(uniqueGames)
    const quickStartSetup = this.buildQuickStartSetup(uniqueGames)
    const homeState = this.buildHomeState(recentGames, quickStartSetup, builtinCourses.length)

    this.setData({
      courses: customCourses,
      builtinCourses,
      currentCourse,
      recentGames,
      latestFinishedGame,
      courseCount: builtinCourses.length,
      totalPar: currentCourse?.holes?.reduce((sum, h) => sum + h.par, 0) || 0,
      averageScore,
      hasOngoingGame: false,
      ongoingGame: null,
      pageLoading: false,
      welcomeStats: this.buildWelcomeStats(uniqueGames),
      quickStartSetup: quickStartSetup,
      homeReadyTitle: homeState.homeReadyTitle,
      homeReadySubtitle: homeState.homeReadySubtitle,
      homeShowNewUserTip: homeState.homeShowNewUserTip,
      homeHasRecentGames: homeState.homeHasRecentGames
    }, () => {
      // 数据设置完成后，检查是否有进行中的比赛
      this.checkOngoingGame()
    })
  },

  getLatestFinishedGame(games) {
    const latest = gameCompleteness.sortByLatest(
      this.filterUserAnalyzableGames(games || [])
    )[0]
    if (!latest) return null

    const timestamp = gameCompleteness.getGameTimestamp(latest) || Date.now()
    const gameId = latest.id || latest.gameId || 'local_' + timestamp
    return {
      ...latest,
      id: gameId,
      courseName: latest.courseName || '未知球场',
      date: formatDate(timestamp)
    }
  },

  filterUserAnalyzableGames(games) {
    if (!Array.isArray(games)) return []
    return games.filter(function(game) {
      const player = gameCompleteness.getPlayer(game)
      return player && gameCompleteness.isPlayerRoundComplete(game, player.id)
    })
  },

  buildWelcomeStats(games) {
    const analyzableGames = gameCompleteness.filterAnalyzableGames(games || [])
    const totalRounds = analyzableGames.length
    const posters = (games || []).filter(function(g) {
      return g && (g.posterGenerated || g.posterUrl)
    }).length
    const avgTimeSaved = totalRounds > 0 ? Math.min(12, 4 + Math.round(totalRounds * 0.6)) : 6
    return {
      totalRounds,
      posters,
      avgTimeSaved
    }
  },

  buildHomeState(recentGames, quickStartSetup, courseCount) {
    var hasRecentGames = Array.isArray(recentGames) && recentGames.length > 0
    return {
      homeReadyTitle: quickStartSetup || hasRecentGames ? '开始新比赛' : '开始第一场比赛',
      homeReadySubtitle: courseCount === 0 ? '球场数据加载完成后即可选择球场开局' : '先开局，球员和球场细节都可以边打边补',
      homeShowNewUserTip: this.data.isFirstVisit && !hasRecentGames && !quickStartSetup,
      homeHasRecentGames: hasRecentGames
    }
  },

  buildQuickStartSetup(games) {
    const saved = wx.getStorageSync('lastGameSetup')
    if (saved && saved.courseId && saved.courseName) {
      return {
        courseId: saved.courseId,
        courseName: saved.courseName,
        playerNames: saved.playerNames || [],
        playerText: (saved.playerNames || []).length > 0 ? saved.playerNames.join('、') : '沿用上次球友',
        source: '上次配置'
      }
    }

    return null
  },

  quickReuseLastSetup() {
    const setup = this.data.quickStartSetup
    if (!setup || !setup.courseId) {
      this.startNewGame()
      return
    }
    wx.setStorageSync('currentCourseId', setup.courseId)
    wx.setStorageSync('quickStartPlayers', setup.playerNames || [])
    wx.navigateTo({
      url: '/pages/new-game/step2-players/step2-players?quick=last'
    })
  },

  checkOngoingGame() {
    const currentGame = wx.getStorageSync('currentGame')
    if (currentGame && !currentGame.completed) {
      const scores = currentGame.scores || {}
      const players = currentGame.players || []

      // 如果 currentGame 没有 holes，从 courses 中加载
      let holes = currentGame.holes || []
      if (holes.length === 0 && currentGame.courseId) {
        const courses = wx.getStorageSync('courses') || []
        const course = courses.find(c => c.id === currentGame.courseId)
        if (course && course.holes) {
          holes = course.holes
        }
      }

      // 找到当前用户（isMe=true 或第一个球员）
      const me = players.find(p => p.isMe) || players[0]
      if (!me) {
        this.setData({ hasOngoingGame: false, ongoingGame: null })
        return
      }

      const myScores = scores[me.id] || {}

      // 从成绩数据中找出已打的洞
      const playedHoleNumbers = Object.keys(myScores)
        .map(Number)
        .filter(holeNum => gameCompleteness.getStrokesValue(myScores[holeNum]) > 0)
        .sort((a, b) => a - b)

      // 找到当前打到第几洞（用户有成绩的最后一洞的下一洞）
      const lastPlayedHole = playedHoleNumbers.length > 0 ? playedHoleNumbers[playedHoleNumbers.length - 1] : 0
      const totalHoles = holes.length || 18
      const currentHole = lastPlayedHole === 0 ? 1 : Math.min(lastPlayedHole + 1, totalHoles)

      // 计算已打洞的标准杆总数和总杆数
      let playedPar = 0
      let myStrokes = 0
      let myHolesPlayed = 0

      playedHoleNumbers.forEach(holeNum => {
        // 从 holes 数组中找对应洞的标准杆
        const holeData = holes.find(h => h.hole === holeNum)
        const par = holeData ? holeData.par : 4
        playedPar += par
        myStrokes += gameCompleteness.getStrokesValue(myScores[holeNum])
        myHolesPlayed++
      })

      // 只计算已打洞的差点
      const myToPar = myHolesPlayed > 0 ? myStrokes - playedPar : 0
      const myToParText = myHolesPlayed > 0
        ? (myToPar === 0 ? 'E' : (myToPar > 0 ? '+' : '') + myToPar)
        : 'E'
      const myToParClass = myToPar < 0 ? 'under' : (myToPar > 0 ? 'over' : '')

      // 计算预估成绩（按当前进度推算18洞）
      const totalPar = holes.reduce((sum, h) => sum + (h.par || 4), 0)
      const estimatedScore = myHolesPlayed > 0
        ? Math.round((myStrokes / myHolesPlayed) * totalHoles)
        : totalPar

      this.setData({
        hasOngoingGame: true,
        ongoingGame: {
          id: currentGame.id || currentGame.gameId || '',
          courseName: currentGame.courseName,
          currentHole,
          totalHoles,
          myScore: {
            name: me.name,
            totalScore: myStrokes,
            holesPlayed: myHolesPlayed,
            toPar: myToPar,
            toParText: myToParText,
            toParClass: myToParClass,
            estimatedScore
          }
        }
      })
    } else {
      this.setData({ hasOngoingGame: false, ongoingGame: null, ongoingDetail: null })
    }
    this.loadUserStats()
  },

  loadUserStats() {
    const games = wx.getStorageSync('games') || []

    if (games.length === 0) return

    const scores = []
    const validGames = games.filter(function(g) {
      const player = gameCompleteness.getPlayer(g)
      return player && gameCompleteness.isPlayerRoundComplete(g, player.id)
    })

    validGames.forEach(function(g) {
      const player = gameCompleteness.getPlayer(g)
      if (!player) return

      if (g.statistics && g.statistics[player.id] && g.statistics[player.id].totalScore > 0) {
        scores.push(g.statistics[player.id].totalScore)
        return
      }

      if (g.scores && g.scores[player.id]) {
        const total = Object.values(g.scores[player.id]).reduce(function(sum, score) {
          return sum + gameCompleteness.getStrokesValue(score)
        }, 0)
        if (total > 0) scores.push(total)
      }
    })

    this.setData({
      userStats: {
        totalGames: validGames.length,
        bestScore: scores.length ? Math.min.apply(null, scores) : 0
      }
    })
  },

  continueGame() {
    this.setData({ showOngoingDetail: true })
  },

  continueGameFromModal() {
    this.setData({ showOngoingDetail: false })
    this.goToScorecard()
  },

  hideOngoingDetail() {
    this.setData({ showOngoingDetail: false })
  },

  showStatsPopup() {
    this.setData({ showStatsDetail: true })
  },

  hideStatsDetail() {
    this.setData({ showStatsDetail: false })
  },

  preventHide(e) {
    // 阻止冒泡
  },

  // 计算球场的平均杆数
  calculateAverageScore(courseId) {
    if (!courseId) return '-'

    // 从 storage 获取所有比赛记录
    const games = wx.getStorageSync('games') || []

    // 筛选出在该球场完成的比赛
    const courseGames = gameCompleteness.filterAnalyzableGames(games).filter(game =>
      game.courseId === courseId
    )

    if (courseGames.length === 0) {
      return '-'
    }

    // 计算所有球员的总杆数
    let totalStrokes = 0
    let playerCount = 0

    courseGames.forEach(game => {
      if (game.scores) {
        const validIds = gameCompleteness.getValidScorePlayerIds(game)
        validIds.forEach(function(playerId) {
          const playerScores = game.scores[playerId]
          if (!playerScores) return
          // 计算该球员在这场比赛的总杆数
          const playerTotal = Object.values(playerScores).reduce(function(sum, score) {
            return sum + gameCompleteness.getStrokesValue(score)
          }, 0)
          if (playerTotal > 0) {
            totalStrokes += playerTotal
            playerCount++
          }
        })
      }
    })

    if (playerCount === 0) {
      return '-'
    }

    // 返回平均杆数，保留一位小数
    return (totalStrokes / playerCount).toFixed(1)
  },

  // 选择球场
  selectCourse(e) {
    const course = e.currentTarget.dataset.course
    wx.setStorageSync('currentCourseId', course.id)
    this.setData({
      currentCourse: course,
      totalPar: course.holes.reduce((sum, h) => sum + h.par, 0),
      averageScore: this.calculateAverageScore(course.id)
    })
  },

  // 选择最近的球场
  selectNearestCourse() {
    const { nearestCourse } = this.data
    if (nearestCourse) {
      wx.setStorageSync('currentCourseId', nearestCourse.id)
      this.setData({
        currentCourse: nearestCourse,
        totalPar: nearestCourse.totalPar || nearestCourse.holes.reduce((sum, h) => sum + h.par, 0),
        averageScore: this.calculateAverageScore(nearestCourse.id)
      })
      wx.showToast({ title: '已选择：' + nearestCourse.name, icon: 'none' })
    }
  },

  // 按省份筛选
  selectProvince(e) {
    const province = e.currentTarget.dataset.province
    this.setData({ selectedProvince: province })
    this.loadData()
  },

  // 开始新比赛 - 跳转到第一步：选择球场
  startNewGame() {
    // 清空临时球员数据，让用户重新设置
    wx.removeStorageSync('tempPlayers')
    wx.navigateTo({
      url: '/package-courses/pages/new-game/step1-course/step1-course'
    })
  },

  // 跳转历史记录
  goToHistory() {
    wx.navigateTo({
      url: '/package-game/pages/history/history'
    })
  },

  // 跳转到记分卡（进行中比赛）
  goToScorecard() {
    const currentGame = wx.getStorageSync('currentGame')
    if (!currentGame || currentGame.completed) {
      this.setData({
        hasOngoingGame: false,
        ongoingGame: null,
        ongoingDetail: null,
        showOngoingDetail: false
      })
      wx.showToast({ title: '未找到进行中的比赛', icon: 'none' })
      return
    }
    const gameId = currentGame.id || currentGame.gameId || ''
    wx.navigateTo({
      url: '/pages/scorecard/scorecard' + (gameId ? '?gameId=' + gameId : '')
    })
  },

  // 跳转到高级数据分析页面
  goToStatsAnalysis() {
    const games = wx.getStorageSync('games') || []
    if (this.filterUserAnalyzableGames(games).length === 0) {
      wx.showToast({ title: '完成18洞后可查看数据', icon: 'none' })
      return
    }

    wx.navigateTo({
      url: '/package-game/pages/stats-analysis/stats-analysis'
    })
  },

  // 跳转设置
  goToSettings() {
    wx.navigateTo({
      url: '/package-user/pages/settings/settings'
    })
  },

  // 查看历史比赛详情
  viewGame(e) {
    const gameId = e.currentTarget.dataset.gameid
    if (!gameId) {
      wx.showToast({ title: '无法获取比赛ID', icon: 'none' })
      return
    }

    // 获取完整比赛数据
    const games = wx.getStorageSync('games') || []
    // 兼容两种字段：id 或 gameId
    const game = games.find(g => g.id === gameId || g.gameId === gameId)

    if (!game) {
      wx.showToast({ title: '比赛数据不存在', icon: 'none' })
      return
    }

    // 如果是未完成的比赛，询问是否继续
    // 支持两种字段判断：completed 布尔值 或 status === 'completed'
    const isCompleted = game.completed === true || game.status === 'completed'
    if (!isCompleted) {
      wx.showModal({
        title: '比赛未结束',
        content: '这场比赛还未完成，是否继续？',
        confirmText: '继续比赛',
        cancelText: '查看记分卡',
        success: (res) => {
          if (res.confirm) {
            // 设置为当前比赛并跳转记分
            wx.setStorageSync('currentGame', game)
            wx.navigateTo({
              url: '/pages/scorecard/scorecard'
            })
          } else {
            // 未完成比赛不进入复盘，只查看当前记分卡
            this.viewScorecard(game)
          }
        }
      })
    } else {
      // 已完成，先查看记分卡（只读模式）
      this.viewScorecard(game)
    }
  },

  // 查看比赛记分卡（历史比赛只读模式）
  viewScorecard(game) {
    // 将比赛数据存入storage供记分卡页面读取
    wx.setStorageSync('currentGame', game)
    wx.setStorageSync('viewMode', 'readonly') // 标记为只读模式

    wx.navigateTo({
      url: '/pages/scorecard/scorecard?mode=readonly&gameId=' + (game?.id || '')
    })
  },

  // 查看比赛报告
  viewGameReport(game) {
    const historyGames = wx.getStorageSync('games') || []
    const player = gameCompleteness.getPlayer(game)
    if (!player || !gameCompleteness.isPlayerRoundComplete(game, player.id)) {
      wx.showToast({ title: '完成18洞后可复盘', icon: 'none' })
      return
    }

    // 确保有完整的比赛数据存入storage供详情页读取
    if (game && game.id) {
      wx.setStorageSync('game_' + game.id, game)
    }
    if (game) {
      wx.setStorageSync('currentGame', game)
    }

    wx.navigateTo({
      url: '/package-game/pages/game-report/game-report?gameId=' + (game?.id || ''),
      success: (res) => {
        // 同时通过eventChannel传递数据
        if (res.eventChannel) {
          res.eventChannel.emit('reportData', {
            game: game,
            report: null
          })
        }
      }
    })
  },

  // 搜索球场
  onSearchInput(e) {
    const keyword = e.detail.value.toLowerCase()
    const allCourses = wx.getStorageSync('courses') || []
    const builtinCourses = allCourses.filter(c =>
      !c.id.startsWith('mock-') &&
      !c.id.startsWith('custom-') &&
      (c.name.toLowerCase().includes(keyword) || c.location.toLowerCase().includes(keyword))
    )

    this.setData({ builtinCourses })
  },

  // 跳转到意见反馈页面
  goToFeedback() {
    wx.navigateTo({
      url: '/package-user/pages/feedback/feedback'
    })
  },

  quickContinueLatest() {
    // 1) 优先进入进行中的比赛
    const currentGame = wx.getStorageSync('currentGame')
    if (currentGame && !currentGame.completed) {
      wx.navigateTo({
        url: '/pages/scorecard/scorecard'
      })
      return
    }

    // 2) 否则进入最近一场有18洞有效成绩的复盘页
    const games = wx.getStorageSync('games') || []
    const completedGames = this.filterUserAnalyzableGames(games)

    if (completedGames.length === 0) {
      wx.showToast({ title: '暂无可复盘比赛', icon: 'none' })
      this.startNewGame()
      return
    }

    completedGames.sort(function(a, b) {
      const at = a.timestamp || a.endTime || a.createTime || 0
      const bt = b.timestamp || b.endTime || b.createTime || 0
      return bt - at
    })

    const latest = completedGames[0]
    const latestId = latest.id || latest.gameId || ('local_' + (latest.timestamp || latest.endTime || Date.now()))
    latest.id = latestId
    this.viewGameReport(latest)
  },

  onUnload() {
    // 移除事件监听
    if (this.gameDataChangeCallback) {
      const app = getApp()
      app.eventBus.off('gameDataChanged', this.gameDataChangeCallback)
    }
  }
})
