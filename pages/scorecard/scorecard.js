const app = getApp()
const { GAME_MODES } = require('../../data/game-modes.js')
const storageDebounced = require('../../utils/storage-debounce.js')
const OCRService = require('../../utils/ocr-service.js')
const analysisReport = require('../../utils/analysis-report.js')
const preferenceManager = require('../../utils/preference-manager.js')
const { PLAYER_COLORS } = require('../../utils/constants.js')
const { formatDate } = require('../../utils/date-utils.js')
const posterGenerator = require('../../utils/poster-generator.js')

Page({
  data: {
    currentGame: null,
    currentHole: 1,
    holes: [],
    totalHoles: 18,
    totalPar: 72,
    currentHoleData: {},
    currentDate: '',
    courses: [],
    gameModes: GAME_MODES,
    currentMode: null,
    showAddPlayer: false,
    colors: PLAYER_COLORS,
    // 当前编辑的成绩
    editingScore: {
      playerId: null,
      playerName: '',
      strokes: null,
      putts: 2,
      showCustomInput: false
    },
    // 球员总杆显示列表（与players数组顺序一致）
    playerTotalList: [],
    // 记分卡网格数据（预计算每个洞每个球员的成绩）
    scoreGridData: [],
    // OCR校对
    showOcrVerifyModal: false,
    originalHoles: [],
    originalTotalPar: 0,
    ocrHoles: [],
    ocrTotalPar: 0,
    hasDiff: false,
    hasScoreDiff: false,
    // 邀请弹窗
    showQrCode: false,
    manualPlayerName: '',
    qrcodeUrl: null,
    // Par数据输入相关
    showParInputGuide: false,      // 是否显示Par输入引导
    showParInputModal: false,      // 是否显示Par输入弹窗
    parInputHole: 1,               // 当前输入的洞号
    parInputValue: 4,              // 当前输入的Par值
    parInputProgress: 0,           // 输入进度
    tempHoles: [],                 // 临时存储用户输入的洞数据
    ocrLoading: false,             // OCR加载状态
    // 待确认成绩相关
    pendingConfirmations: [],      // 待本人确认的成绩列表
    pendingCount: 0,               // 待确认数量
    showPendingModal: false,       // 是否显示待确认弹窗
    myOpenid: null                 // 当前用户的openid
  },

  onLoad(options) {
    // 获取gameId参数（多人同步比赛）
    if (options && options.gameId) {
      this.gameId = options.gameId
      this.isCloudGame = true
    }

    // 检查系统信息
    this.checkSystemInfo()

    this.loadCourses()
    this.loadGame()
  },

  // 检查系统信息
  checkSystemInfo() {
    const systemInfo = wx.getSystemInfoSync()
    console.log('[系统信息] 基础库版本:', systemInfo.SDKVersion)
    console.log('[系统信息] 平台:', systemInfo.platform)
    console.log('[系统信息] 微信版本:', systemInfo.version)
  },

  onShow() {
    this.loadGame()

    // 设置TabBar选中状态 - 记分卡页面属于功能页，不高亮任何tab
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: null })
    }
  },

  // 分享给微信好友，邀请加入比赛
  onShareAppMessage() {
    const game = this.data.currentGame
    const gameId = this.gameId || (game ? game.id : '')

    return {
      title: '来一起打高尔夫吧！',
      path: '/pages/new-game/step2-players/step2-players?gameId=' + gameId,
      imageUrl: '/images/share-game.png'
    }
  },

  // 显示邀请弹窗
  showQrCodeModal() {
    var self = this
    var currentGame = this.data.currentGame
    var qrcodeUrl = this.data.qrcodeUrl

    // 如果还没有二维码，且是云端比赛，调用云函数生成
    if (!qrcodeUrl && this.isCloudGame && currentGame && currentGame.gameId) {
      wx.showLoading({ title: '生成二维码...' })
      wx.cloud.callFunction({
        name: 'gameAction',
        data: {
          action: 'getQrCode',
          gameId: currentGame.gameId
        },
        success: function(res) {
          wx.hideLoading()
          if (res.result && res.result.success && res.result.qrcodeUrl) {
            self.setData({
              qrcodeUrl: res.result.qrcodeUrl
            })
          } else {
            wx.showToast({
              title: res.result && res.result.error ? res.result.error : '生成二维码失败',
              icon: 'none'
            })
          }
        },
        fail: function(err) {
          wx.hideLoading()
          console.error('生成二维码失败:', err)
          wx.showToast({ title: '生成二维码失败', icon: 'none' })
        }
      })
    }

    this.setData({ showQrCode: true, manualPlayerName: '' })
  },

  // 隐藏邀请弹窗
  hideQrCodeModal() {
    this.setData({ showQrCode: false, manualPlayerName: '' })
  },

  // 手动输入姓名
  onManualNameInput(e) {
    this.setData({ manualPlayerName: e.detail.value })
  },

  // 手动添加球员
  addManualPlayer() {
    const name = this.data.manualPlayerName.trim()
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }

    const game = this.data.currentGame
    if (!game) return

    // 检查人数限制 - 最多4人
    if (game.players.length >= 4) {
      wx.showToast({ title: '最多支持4人', icon: 'none' })
      return
    }

    // 检查是否已存在
    if (game.players.some(p => p.name === name)) {
      wx.showToast({ title: '该球员已存在', icon: 'none' })
      return
    }

    const newPlayer = {
      id: 'player_' + Date.now(),
      name: name,
      color: PLAYER_COLORS[game.players.length % PLAYER_COLORS.length],
      isCustom: true
    }

    game.players.push(newPlayer)
    game.scores[newPlayer.id] = {}

    this.setData({
      currentGame: game,
      showQrCode: false,
      manualPlayerName: ''
    })

    // 保存到本地
    wx.setStorageSync('currentGame', game)

    // 更新记分卡数据
    if (this.updateScoreGrid) {
      this.updateScoreGrid()
    }

    wx.showToast({ title: '添加成功', icon: 'success' })
  },

  onUnload() {
    // 停止云端数据监听
    if (this.watcher) {
      try {
        this.watcher.close()
      } catch (e) {}
      this.watcher = null
    }

    // 清理重连定时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }

    // 重置重连计数
    this._watchRetryCount = 0

    // 确保所有防抖存储的数据立即写入
    storageDebounced.flushStorage('currentGame')
  },

  loadCourses() {
    const courses = wx.getStorageSync('courses') || []
    this.setData({ courses })
  },

  loadGame() {
    // 如果是云端多人比赛，从云数据库加载
    if (this.isCloudGame && this.gameId) {
      this.loadCloudGame(this.gameId)
      return
    }

    // 本地比赛从storage加载
    const currentGame = wx.getStorageSync('currentGame')
    if (!currentGame) {
      this.setData({ currentGame: null })
      return
    }

    // 从storage重新读取courses，避免真机加载延迟导致找不到球场
    let courses = this.data.courses
    if (!courses || courses.length === 0) {
      courses = wx.getStorageSync('courses') || []
    }

    const course = courses.find(c => c.id === currentGame.courseId)
    if (!course) {
      this.setData({ currentGame: null })
      return
    }

    // 检查球场是否有完整的Par数据
    const parCheck = this.checkCourseParData(course)

    if (!parCheck.hasData) {
      // Par数据缺失，显示引导界面
      this.setData({
        currentGame,
        courses,
        currentDate: formatDate(new Date(), 'full')
      })
      this.showParDataGuide()
      return
    }

    // 如果有用户贡献的数据，使用它
    let holes = course.holes
    if (parCheck.fromUser) {
      const userCourseHoles = wx.getStorageSync('userCourseHoles') || {}
      holes = userCourseHoles[course.id].holes
    }

    // 创建一个副本，使用正确的holes数据
    const courseWithCorrectHoles = {
      ...course,
      holes: holes
    }

    const now = new Date()
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`

    // 获取当前玩法
    const currentMode = GAME_MODES.find(m => m.id === currentGame.gameMode) || GAME_MODES[0]

    // 预计算每个球员的总杆显示（转换为数组，保持与players数组顺序一致）
    const playerTotalList = this.calcPlayerTotalList(currentGame, holes)
    // 预计算记分卡网格数据
    const scoreGridData = this.calcScoreGridData(currentGame, holes)

    this.setData({
      currentGame,
      holes: holes,
      totalHoles: holes.length,
      totalPar: holes.reduce((sum, h) => sum + h.par, 0),
      currentHoleData: holes[0],
      currentDate: dateStr,
      currentMode,
      playerTotalList,
      scoreGridData
    })

    // 计算领先者 - 使用带有正确holes的course对象
    this.calculateLeader(currentGame, courseWithCorrectHoles)

    // 恢复上次记录的洞
    const savedHole = wx.getStorageSync('currentHole')
    if (savedHole && savedHole <= holes.length) {
      this.setCurrentHole(savedHole)
    }
  },

  // 检查球场是否有完整的Par数据
  checkCourseParData(course) {
    if (!course) return { hasData: false, holesCount: 0 }

    const holes = course.holes

    // 检查holes数组是否存在且完整
    if (holes && Array.isArray(holes) && holes.length >= 18) {
      const validHoles = holes.filter(h => h && h.par >= 2 && h.par <= 6)
      if (validHoles.length >= 18) {
        return { hasData: true, holesCount: validHoles.length, verified: course.holesVerified }
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
        this.useDefaultParData()
        break
    }
  },

  // 使用默认Par数据
  useDefaultParData() {
    const defaultHoles = []
    for (let i = 1; i <= 18; i++) {
      defaultHoles.push({ hole: i, par: 4 })
    }
    this.applyHolesData(defaultHoles, 'default')
    wx.showToast({ title: '使用默认Par值', icon: 'none' })
  },

  // 开始OCR识别Par数据
  startParOCR() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      success: async (res) => {
        const imagePath = res.tempFiles[0].tempFilePath
        this.setData({ ocrLoading: true })

        try {
          const result = await OCRService.recognize(imagePath)
          this.setData({ ocrLoading: false })

          if (result.success && result.holes && result.holes.length > 0) {
            const confirmed = await OCRService.showResultConfirm(result)
            if (confirmed) {
              this.applyHolesData(result.holes, 'ocr')
              wx.showToast({ title: '识别成功', icon: 'success' })
            } else {
              this.showManualInputChoice()
            }
          } else {
            wx.showModal({
              title: '识别失败',
              content: result.error || '未能识别出Par数据',
              confirmText: '手动输入',
              cancelText: '使用默认值',
              success: (r) => {
                if (r.confirm) this.startManualParInput()
                else this.useDefaultParData()
              }
            })
          }
        } catch (err) {
          this.setData({ ocrLoading: false })
          console.error('OCR error:', err)
          this.showManualInputChoice()
        }
      },
      fail: () => {
        wx.showToast({ title: '取消选择', icon: 'none' })
      }
    })
  },

  // 显示手动输入选择
  showManualInputChoice() {
    wx.showModal({
      title: '手动输入',
      content: '是否手动输入每洞Par值？',
      confirmText: '开始输入',
      cancelText: '使用默认值',
      success: (res) => {
        if (res.confirm) this.startManualParInput()
        else this.useDefaultParData()
      }
    })
  },

  // 开始手动输入Par数据
  startManualParInput() {
    const tempHoles = []
    for (let i = 1; i <= 18; i++) {
      tempHoles.push({ hole: i, par: 4 })
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

  // 选择Par值
  selectParValue(e) {
    const par = parseInt(e.currentTarget.dataset.par)
    this.setData({ parInputValue: par })
    this.confirmParInput()
  },

  // 确认当前洞的Par输入
  confirmParInput() {
    const { parInputHole, parInputValue, tempHoles, currentGame, holes } = this.data
    const originalHole = holes[parInputHole - 1]

    // 如果是单个洞修改（从表格点击进来修改），直接保存到customPar
    if (!tempHoles || tempHoles.length === 0) {
      // 单个洞修改 - 保存到customPar
      let customPar = currentGame.customPar || {}
      customPar = { ...customPar }
      customPar[parInputHole] = parInputValue

      const updatedGame = {
        ...currentGame,
        customPar: customPar
      }

      this.setData({
        currentGame: updatedGame,
        showParInputModal: false
      })

      // 更新记分卡网格
      if (this.updateScoreGrid) {
        this.updateScoreGrid()
      }

      // 保存到云端（云端是唯一权威）
      this.updateCloudGame(updatedGame)
      return
    }

    // 批量输入模式（原来的从头输入）
    tempHoles[parInputHole - 1].par = parInputValue
    const progress = tempHoles.filter(h => h.par > 0).length

    this.setData({ tempHoles, parInputProgress: progress })

    if (parInputHole < 18) {
      this.setData({
        parInputHole: parInputHole + 1,
        parInputValue: 4
      })
    } else {
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
    const validCount = tempHoles.filter(h => h.par >= 2 && h.par <= 6).length

    if (validCount < 18) {
      wx.showModal({
        title: '数据不完整',
        content: `已输入${validCount}/18洞，是否继续？`,
        confirmText: '继续输入',
        cancelText: '保存数据',
        success: (res) => {
          if (!res.confirm) this.applyHolesData(tempHoles, 'manual')
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

    currentGame.holes = holes
    currentGame.totalPar = holes.reduce((sum, h) => sum + h.par, 0)

    const courseId = currentGame.courseId
    if (courseId) {
      OCRService.saveCourseHoles(courseId, holes, source)
    }

    this.setData({
      currentGame,
      holes: holes,
      totalHoles: holes.length,
      totalPar: currentGame.totalPar,
      currentHoleData: holes[0],
      showParInputModal: false,
      showParInputGuide: false
    })

    if (this.updateScoreGrid) {
      this.updateScoreGrid()
    }
    this.saveGame()
  },

  // 从云端加载多人比赛
  loadCloudGame(gameId) {
    wx.showLoading({ title: '加载比赛...' })

    const db = wx.cloud.database()
    const self = this

    // 先通过 gameId 字段查询
    db.collection('games').where({
      gameId: gameId
    }).get().then(res => {
      if (res.data && res.data.length > 0) {
        self.processCloudGame(res.data[0])
        return null  // 返回 null 表示已处理
      } else {
        // 如果通过 gameId 找不到，尝试通过 _id 查询
        return db.collection('games').doc(gameId).get()
      }
    }).then(res => {
      // 只有当 res 存在且是查询结果时才处理
      if (res && res.data) {
        self.processCloudGame(res.data)
      }
    }).catch(err => {
      wx.hideLoading()
      console.error('加载云端比赛失败:', err)
      wx.showToast({ title: '加载比赛失败', icon: 'none' })
    })
  },

  // 处理云端比赛数据
  processCloudGame(cloudGame) {
    wx.hideLoading()

    if (!cloudGame) {
      wx.showToast({ title: '比赛不存在', icon: 'none' })
      setTimeout(function() {
        wx.navigateBack()
      }, 1500)
      return
    }

    console.log('云端比赛加载成功:', cloudGame)

    // 加载球场数据
    let courses = this.data.courses
    if (!courses || courses.length === 0) {
      courses = wx.getStorageSync('courses') || []
    }

    // 查找球场
    var course = courses.find(function(c) { return c.id === cloudGame.courseId })
    if (!course && courses.length === 0) {
      // 本地缓存还没加载完成，提示用户等待
      wx.showToast({ title: '球场数据加载中', icon: 'none' })
      return
    }
    if (!course) {
      wx.showToast({ title: '找不到球场数据', icon: 'none' })
      return
    }

    const now = new Date()
    const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日'
    // 获取当前玩法（默认比杆赛）
    const currentMode = { id: 'stroke', name: '比杆赛' }

    // 如果本地没有球洞数据（holes = null），需要从云端拉取
    if (!course.holes || !Array.isArray(course.holes) || course.holes.length === 0) {
      var self = this
      wx.showLoading({ title: '加载球洞数据...' })
      // 从云端获取球场holes数据
      wx.cloud.callFunction({
        name: 'getCourses',
        data: { action: 'getCourseHoles', courseId: cloudGame.courseId },
        success: function(res) {
          wx.hideLoading()
          if (res.result && res.result.success && res.result.holes) {
            var cloudHoles = res.result.holes
            // 更新本地course缓存
            course.holes = cloudHoles
            course.holesVerified = true
            var allCourses = wx.getStorageSync('courses') || []
            var courseIndex = allCourses.findIndex(function(c) { return c.id === course.id })
            if (courseIndex >= 0) {
              allCourses[courseIndex] = course
              wx.setStorageSync('courses', allCourses)
            }
            // 继续处理比赛
            self.continueProcessCloudGame(cloudGame, course, dateStr, currentMode)
          } else {
            // 云端没有数据，使用默认Par（每个洞Par=4）
            wx.hideLoading()
            wx.showModal({
              title: '缺少球洞数据',
              content: '该球场暂无标准杆数据，是否使用默认值（18洞 × Par=4 = 72）继续？',
              success: function(resModal) {
                if (resModal.confirm) {
                  // 生成默认18洞每个洞Par=4
                  var defaultHoles = []
                  for (var i = 1; i <= 18; i++) {
                    defaultHoles.push({ hole: i, par: 4, distance: 0 })
                  }
                  course.holes = defaultHoles
                  course.holesVerified = false
                  // 更新本地缓存
                  var allCourses = wx.getStorageSync('courses') || []
                  var courseIndex = allCourses.findIndex(function(c) { return c.id === course.id })
                  if (courseIndex >= 0) {
                    allCourses[courseIndex] = course
                    wx.setStorageSync('courses', allCourses)
                  }
                  self.continueProcessCloudGame(cloudGame, course, dateStr, currentMode)
                }
              }
            })
          }
        },
        fail: function(err) {
          wx.hideLoading()
          console.error('获取球洞数据失败:', err)
          wx.showToast({ title: '加载球洞数据失败', icon: 'none' })
        }
      })
      return
    }

    // 补全totalPar
    if (!course.totalPar) {
      course.totalPar = course.holes.reduce(function(sum, h) { return sum + h.par }, 0)
    }

    this.continueProcessCloudGame(cloudGame, course, dateStr, currentMode)
  },

  // 继续处理云端比赛（拉取完球洞数据后调用）
  continueProcessCloudGame: function(cloudGame, course, dateStr, currentMode) {
    // 合并step2本地存储的球员列表 - 保证手动添加的球员不会丢失
    // 因为step2添加后可能云端更新还没完成就跳转了
    let mergedPlayers = cloudGame.players || []
    const step2Players = wx.getStorageSync('currentPlayers')
    if (step2Players && Array.isArray(step2Players) && step2Players.length > 0) {
      // 基于id合并去重：step2优先（包含最新手动添加）
      const playerMap = {}
      step2Players.forEach(function(p) {
        playerMap[p.id] = p
      })
      // 加入云端球员，如果id不在step2中
      cloudGame.players.forEach(function(p) {
        if (!playerMap[p.id]) {
          playerMap[p.id] = p
        }
      })
      // 如果超过4人，截断到4人（双重保险）
      mergedPlayers = Object.values(playerMap).slice(0, 4)
    }

    // 转换云端数据格式为本地格式
    const currentGame = {
      ...cloudGame,
      courseId: cloudGame.courseId,
      courseName: cloudGame.courseName || '',
      gameMode: cloudGame.gameMode || 'stroke',
      players: mergedPlayers,
      scores: cloudGame.scores || {},
      putts: cloudGame.putts || {},
      customPar: cloudGame.customPar || {},
      advancedStats: cloudGame.advancedStats || {},
      fairways: cloudGame.fairways || {},
      qrcodeUrl: cloudGame.qrcodeUrl || null,
      qrcodeFileId: cloudGame.qrcodeFileId || null
    }

    // 计算实际totalPar，考虑自定义par修改
    const actualTotalPar = course.holes.reduce((sum, hole) => {
      const par = currentGame.customPar && currentGame.customPar[hole.hole]
        ? currentGame.customPar[hole.hole]
        : hole.par
      return sum + par
    }, 0)

    // 预计算每个球员的总杆显示
    const playerTotalList = this.calcPlayerTotalList(currentGame, course.holes)
    const scoreGridData = this.calcScoreGridData(currentGame, course.holes)

    this.setData({
      currentGame: currentGame,
      holes: course.holes,
      totalHoles: course.holes.length,
      totalPar: actualTotalPar,
      currentHoleData: course.holes[0],
      currentDate: dateStr,
      currentMode: currentMode,
      playerTotalList: playerTotalList,
      scoreGridData: scoreGridData
    })

    // 如果有二维码fileID，获取临时URL
    if (currentGame.qrcodeFileId) {
      const self = this
      wx.cloud.getTempFileURL({
        fileList: [currentGame.qrcodeFileId],
        success: function(res) {
          if (res.fileList && res.fileList[0]) {
            self.setData({
              qrcodeUrl: res.fileList[0].tempFileURL
            })
          }
        },
        fail: function(err) {
          console.error('获取二维码URL失败:', err)
        }
      })
    }

    // 设置第一个洞
    this.setCurrentHole(1)

    // 设置云端数据监听，实时同步
    const gameId = cloudGame.gameId || cloudGame._id
    this.watchCloudGame(gameId)

    // 自动添加当前用户到球员列表，如果不在列表中
    this.addCurrentUserToCloudGameIfNeeded(currentGame)
  },

  // 监听云端比赛数据变化，实时同步
  watchCloudGame(gameId) {
    if (!wx.cloud) {
      console.warn('云开发未初始化，跳过云端监听')
      return
    }

    const db = wx.cloud.database()
    const self = this

    // 监听比赛文档变化
    try {
      this.watcher = db.collection('games').doc(gameId).watch({
        onChange: snapshot => {
          if (!snapshot.docs || snapshot.docs.length === 0) return

          const updatedGame = snapshot.docs[0]
          this.onCloudGameUpdate(updatedGame)
        },
        onError: err => {
          console.error('云端监听错误:', err)
          // 自动重连机制
          self.handleWatchError(gameId, err)
        }
      })
    } catch (e) {
      console.error('创建云端监听失败:', e)
      // 尝试重连
      this.handleWatchError(gameId, e)
    }
  },

  // 处理监听错误，自动重连
  handleWatchError(gameId, err) {
    // 清理旧监听
    if (this.watcher) {
      try {
        this.watcher.close()
      } catch (e) {}
      this.watcher = null
    }

    // 初始化重连计数
    this._watchRetryCount = (this._watchRetryCount || 0) + 1

    // 限制重连次数（最多5次）
    if (this._watchRetryCount > 5) {
      console.warn('云端监听重连次数超限，暂停重连')
      return
    }

    // 延迟重连（指数退避：1s, 2s, 4s, 8s, 16s）
    const delay = Math.min(1000 * Math.pow(2, this._watchRetryCount - 1), 16000)
    console.log(`云端监听将在 ${delay/1000}s 后重试 (${this._watchRetryCount}/5)`)

    this.reconnectTimer = setTimeout(() => {
      this.watchCloudGame(gameId)
    }, delay)
  },

  // 云端数据更新，同步到本地
  onCloudGameUpdate(updatedGame) {
    const currentGame = this.data.currentGame
    if (!currentGame) return

    // 更新比赛数据 - 合并策略：
    // 1. players：合并云端和本地，云端优先，保留本地未同步的添加
    // 2. scores/putts 合并：云端变更覆盖本地，保留本地新增的未同步内容
    // 这样避免多人同时编辑时互相覆盖，也避免本地添加丢失

    // 合并players：以id为键，云端覆盖本地，保留本地有而云端没有的
    let mergedPlayers
    if (updatedGame.players) {
      // 创建id映射
      const playerMap = {}
      // 先加云端players - 云端优先
      updatedGame.players.forEach(p => {
        playerMap[p.id] = p
      })
      // 再加本地players中云端没有的 - 保留本地未同步的添加
      currentGame.players.forEach(p => {
        if (!playerMap[p.id]) {
          playerMap[p.id] = p
        }
      })
      // 转换回数组
      mergedPlayers = Object.values(playerMap)
    } else {
      mergedPlayers = currentGame.players
    }

    const newGame = {
      ...currentGame,
      ...updatedGame,
      players: mergedPlayers,
      // 合并scores：保留本地但合并云端更新
      scores: {
        ...currentGame.scores,
        ...(updatedGame.scores || {})
      },
      // 合并putts
      putts: {
        ...currentGame.putts,
        ...(updatedGame.putts || {})
      },
      penalties: {
        ...currentGame.penalties,
        ...(updatedGame.penalties || {})
      },
      advancedStats: updatedGame.advancedStats || currentGame.advancedStats,
      fairways: {
        ...currentGame.fairways,
        ...(updatedGame.fairways || {})
      }
    }

    // 为新球员初始化scores/putts等空间（比赛开始后加入的球员）
    newGame.players.forEach(function(player) {
      if (!newGame.scores) {
        newGame.scores = {}
      }
      if (!newGame.putts) {
        newGame.putts = {}
      }
      if (!newGame.penalties) {
        newGame.penalties = {}
      }
      if (!newGame.fairways) {
        newGame.fairways = {}
      }
      // 如果该球员还没有scores条目，初始化空对象
      if (!newGame.scores[player.id]) {
        newGame.scores[player.id] = {}
      }
      if (!newGame.putts[player.id]) {
        newGame.putts[player.id] = {}
      }
      if (!newGame.penalties[player.id]) {
        newGame.penalties[player.id] = {}
      }
      if (!newGame.fairways[player.id]) {
        newGame.fairways[player.id] = {}
      }
    })

    // 重新计算网格数据
    const playerTotalList = this.calcPlayerTotalList(newGame, this.data.holes)
    const scoreGridData = this.calcScoreGridData(newGame, this.data.holes)

    this.setData({
      currentGame: newGame,
      playerTotalList,
      scoreGridData
    })

    // 重新计算领先者
    const course = this.data.courses.find(c => c.id === newGame.courseId)
    if (course) {
      this.calculateLeader(newGame, course)
    }

    // 计算待确认成绩
    this.calculatePendingConfirmations(newGame)

    console.log('已同步云端更新')
  },

  // 如果当前用户不在球员列表中，自动添加
  addCurrentUserToCloudGameIfNeeded(game) {
    const cachedUserInfo = wx.getStorageSync('userInfo')
    if (!cachedUserInfo || !cachedUserInfo.nickName) return

    const hasMe = game.players.some(p => p.openid === cachedUserInfo.openid || p.isMe)
    if (!hasMe) {
      // 检查人数限制 - 最多4人
      if (game.players.length >= 4) {
        wx.showToast({ title: '该球局已满4人', icon: 'none' })
        return
      }
      // 添加当前用户到球员列表
      const colorIndex = game.players.length % PLAYER_COLORS.length

      const newPlayer = {
        id: 'current-user-cloud',
        name: cachedUserInfo.nickName,
        color: PLAYER_COLORS[colorIndex],
        avatar: cachedUserInfo.avatarUrl || '',
        openid: cachedUserInfo.openid || '',
        isMe: true
      }

      game.players.push(newPlayer)

      // 更新到云端
      this.updateCloudGame(game)

      // 更新本地
      const playerTotalList = this.calcPlayerTotalList(game, this.data.holes)
      const scoreGridData = this.calcScoreGridData(game, this.data.holes)

      this.setData({
        currentGame: game,
        playerTotalList,
        scoreGridData
      })

      wx.showToast({ title: '已加入比赛', icon: 'success' })
    }
  },

  // 更新比赛数据到云端
  updateCloudGame(game) {
    if (!this.isCloudGame || !this.gameId || !wx.cloud) return

    // 更新本地时间戳
    game.updateTime = Date.now()

    const db = wx.cloud.database()

    // 只更新需要同步的数据
    const updateData = {
      players: game.players,
      scores: game.scores,
      putts: game.putts,
      penalties: game.penalties,
      advancedStats: game.advancedStats,
      fairways: game.fairways,
      updateTime: db.serverDate()
    }

    db.collection('games').doc(this.gameId).update({
      data: updateData,
      success: () => {
        console.log('云端更新成功')
        // 清除重试计数
        this.cloudUpdateRetryCount = 0
      },
      fail: err => {
        console.error('云端更新失败:', err)
        // 重试逻辑
        this.cloudUpdateRetryCount = (this.cloudUpdateRetryCount || 0) + 1
        if (this.cloudUpdateRetryCount <= 3) {
          console.log(`云端更新重试 ${this.cloudUpdateRetryCount}/3`)
          setTimeout(() => {
            this.updateCloudGame(game)
          }, 2000)
        } else {
          // 重试失败，提示用户
          wx.showToast({
            title: '同步失败，请检查网络',
            icon: 'none',
            duration: 3000
          })
        }
      }
    })
  },

  // 计算领先者
  calculateLeader(game, course) {
    if (!game || !game.players || game.players.length === 0) return

    const mode = game.gameMode || 'stroke'
    const playerScores = game.players.map(player => {
      const scores = game.scores[player.id] || {}
      const stats = this.getPlayerStats(scores, course)
      return {
        ...player,
        ...stats
      }
    })

    let leader = null

    switch (mode) {
      case 'stroke':
        // 比杆赛：总杆数最少 wins
        playerScores.sort((a, b) => a.totalScore - b.totalScore)
        leader = playerScores[0]
        leader.displayScore = leader.totalScore > 0 ? `${leader.totalScore}杆` : '-'
        break

      case 'match':
        // 比洞赛：计算每洞胜负（考虑让洞）
        const matchResults = this.calculateMatchHoles(game, course)
        playerScores.forEach(p => {
          p.holesWon = matchResults[p.id] || 0
        })
        playerScores.sort((a, b) => b.holesWon - a.holesWon)
        leader = playerScores[0]
        leader.displayScore = leader.holesWon > 0 ? `赢${leader.holesWon}洞` : '-'
        break

      case 'bestball':
        // 最佳球：显示每队最佳成绩
        leader = playerScores[0]
        leader.displayScore = leader.totalScore > 0 ? `${leader.totalScore}杆` : '-'
        break

      case 'landlord':
        // 斗地主：显示当前地主和得分
        leader = playerScores[0]
        leader.displayScore = leader.totalScore > 0 ? `${leader.totalScore}杆` : '-'
        break

      default:
        playerScores.sort((a, b) => a.totalScore - b.totalScore)
        leader = playerScores[0]
        leader.displayScore = leader.totalScore > 0 ? `${leader.totalScore}杆` : '-'
    }

    this.setData({
      leaderInfo: {
        name: leader.name,
        score: leader.displayScore,
        color: leader.color,
        modeName: this.data.currentMode?.name || '比杆赛'
      }
    })
  },

  // 获取球员统计数据
  getPlayerStats(scores, course) {
    let totalScore = 0
    let holesPlayed = 0
    let points = 0
    let holesWon = 0
    let skinsWon = 0

    Object.entries(scores).forEach(([holeNum, scoreData]) => {
      // 兼容新旧格式
      const strokes = this.extractScoreValue(scoreData)
      if (strokes && course && course.holes) {
        const holeData = course.holes.find(h => h.hole === parseInt(holeNum))
        if (holeData) {
          totalScore += parseInt(strokes)
          holesPlayed++

          // 计算积分（史特伯福特）
          const diff = strokes - holeData.par
          if (diff <= -2) points += 8 // 双鹰
          else if (diff === -1) points += 3 // 小鸟
          else if (diff === 0) points += 2 // par
          else if (diff === 1) points += 1 // 柏忌
          // 双柏忌及以上 0 分
        }
      }
    })

    return {
      totalScore,
      holesPlayed,
      points,
      holesWon,
      skinsWon
    }
  },

  // 计算比洞赛每洞胜负（考虑让洞）
  calculateMatchHoles(game, course) {
    if (!game || !game.players || game.players.length < 2) return {}

    const handicaps = game.handicaps || {}
    const results = {}

    // 初始化每位球员的赢洞数
    game.players.forEach(p => results[p.id] = 0)

    // 遍历每一洞
    course.holes.forEach(hole => {
      const holeScores = game.players.map(player => {
        const scoreData = game.scores[player.id]?.[hole.hole]
        // 兼容新旧格式
        const score = this.extractScoreValue(scoreData)
        const handicap = handicaps[player.id] || 0
        // 计算该洞是否获得让杆：让洞数 >= 洞号时获得让1杆
        const handicapStrokes = handicap >= hole.hole ? 1 : 0
        return {
          playerId: player.id,
          rawScore: score,
          netScore: score ? score - handicapStrokes : null
        }
      }).filter(s => s.netScore !== null)

      if (holeScores.length >= 2) {
        // 找出该洞最低成绩
        const bestScore = Math.min(...holeScores.map(s => s.netScore))
        const winners = holeScores.filter(s => s.netScore === bestScore)

        // 如果有唯一胜者，该球员赢1洞
        if (winners.length === 1) {
          results[winners[0].playerId]++
        }
      }
    })

    return results
  },

  setCurrentHole(hole, callback) {
    const holeData = this.data.holes[hole - 1]
    this.setData({
      currentHole: hole,
      currentHoleData: holeData
    }, () => {
      // setData完成后执行回调
      if (typeof callback === 'function') {
        callback()
      }
    })
    wx.setStorageSync('currentHole', hole)
  },

  // 获取用户在某洞的历史统计数据
  getHoleUserStats(holeNumber) {
    const currentGame = this.data.currentGame
    if (!currentGame || !currentGame.scores) {
      return { played: 0, totalStrokes: 0, fairwayHits: 0, fairwayAttempts: 0 }
    }

    const stats = {
      played: 0,
      totalStrokes: 0,
      fairwayHits: 0,
      fairwayAttempts: 0
    }

    // 统计所有球员在该洞的数据（作为示例，实际可以只统计当前用户）
    Object.values(currentGame.scores).forEach(playerScores => {
      if (playerScores[holeNumber]) {
        const score = playerScores[holeNumber]
        stats.played++
        stats.totalStrokes += score.strokes || 0
        if (score.fairway !== undefined) {
          stats.fairwayAttempts++
          if (score.fairway === true) {
            stats.fairwayHits++
          }
        }
      }
    })

    return stats
  },

  // 上一洞
  prevHole() {
    if (this.data.currentHole > 1) {
      this.setCurrentHole(this.data.currentHole - 1)
    }
  },

  // 下一洞
  nextHole() {
    if (this.data.currentHole < this.data.totalHoles) {
      this.setCurrentHole(this.data.currentHole + 1)
    }
  },

  // 跳转到指定洞，点击洞号打开par修改弹窗
  jumpToHole(e) {
    const hole = e.currentTarget.dataset.hole
    this.setCurrentHole(hole)

    // 获取当前洞的par值（customPar优先）
    const currentGame = this.data.currentGame
    const holes = this.data.holes
    let currentPar = holes[hole - 1].par
    if (currentGame.customPar && currentGame.customPar[hole]) {
      currentPar = currentGame.customPar[hole]
    }

    // 打开par修改弹窗
    this.setData({
      showParInputModal: true,
      parInputHole: hole,
      parInputValue: currentPar
    })
  },

  // 显示玩法选择器
  showModeSelector() {
    this.setData({ showModeSelector: true })
  },

  // 隐藏玩法选择器
  hideModeSelector() {
    this.setData({ showModeSelector: false })
  },

  // 阻止冒泡
  preventHide() {
    // 什么都不做，只是阻止事件冒泡
  },

  // 选择玩法
  selectMode(e) {
    const modeId = e.currentTarget.dataset.mode
    const mode = GAME_MODES.find(m => m.id === modeId)

    // 更新游戏玩法
    const game = this.data.currentGame
    game.gameMode = modeId

    this.setData({
      currentGame: game,
      currentMode: mode,
      showModeSelector: false
    })

    if (!this.isCloudGame) {
      wx.setStorageSync('currentGame', game)
    } else {
      this.updateCloudGame(game)
    }

    // 重新计算领先者
    const course = this.data.courses.find(c => c.id === game.courseId)
    this.calculateLeader(game, course)

    wx.showToast({
      title: `已切换至${mode.name}`,
      icon: 'none'
    })

    // 如果切换到需要设置的玩法，自动打开设置（比洞赛的让洞设置已在弹窗内显示）
    setTimeout(() => {
      if (modeId === 'stroke') {
        this.showHandicapSetup()
      } else if (modeId === 'bestball') {
        this.showTeamSetup()
      } else if (modeId === 'landlord') {
        this.showLandlordSetup()
      }
      // 比洞赛的让洞设置已经在玩法选择弹窗内，不需要再弹出单独弹窗
    }, 500)
  },

  // 显示让洞设置弹窗
  showHandicapSetup() {
    this.setData({
      showHandicapModal: true,
      editingHandicap: {
        playerId: null,
        handicapStrokes: 0
      }
    })
  },

  // 隐藏让洞设置弹窗
  hideHandicapModal() {
    this.setData({ showHandicapModal: false })
  },

  // 设置球员的让洞数
  setPlayerHandicap(e) {
    const playerId = e.currentTarget.dataset.player
    const game = this.data.currentGame

    if (!game.handicaps) game.handicaps = {}

    this.setData({
      editingHandicap: {
        playerId: playerId,
        handicapStrokes: game.handicaps[playerId] || 0
      }
    })
  },

  // 调整让洞数
  adjustHandicap(e) {
    const delta = parseInt(e.currentTarget.dataset.delta)
    const current = this.data.editingHandicap.handicapStrokes || 0
    const newValue = Math.max(0, current + delta)

    this.setData({
      'editingHandicap.handicapStrokes': newValue
    })
  },

  // 调整球员让洞数（弹窗中直接操作）
  adjustPlayerHandicap(e) {
    console.log('adjustPlayerHandicap called', e.currentTarget.dataset)
    const playerId = e.currentTarget.dataset.player
    const delta = parseInt(e.currentTarget.dataset.delta)

    if (!playerId) {
      console.error('playerId is empty')
      return
    }

    const game = this.data.currentGame
    const currentHandicaps = game.handicaps || {}
    const current = currentHandicaps[playerId] || 0
    const newValue = Math.max(0, Math.min(current + delta, 18))

    console.log('Setting handicap:', playerId, 'from', current, 'to', newValue)

    // 创建新的 handicaps 对象以确保响应性
    game.handicaps = {
      ...currentHandicaps,
      [playerId]: newValue
    }

    this.setData({ currentGame: { ...game } })
  },

  // 保存让洞设置
  saveHandicap() {
    const game = this.data.currentGame

    if (!this.isCloudGame) {
      wx.setStorageSync('currentGame', game)
    } else {
      this.updateCloudGame(game)
    }

    wx.showToast({
      title: '让洞设置已保存',
      icon: 'none'
    })

    this.hideHandicapModal()

    // 重新计算领先者
    const course = this.data.courses.find(c => c.id === game.courseId)
    this.calculateLeader(game, course)
  },

  // 获取球员的让洞数/让杆数
  getPlayerHandicap(playerId) {
    return this.data.currentGame?.handicaps?.[playerId] || 0
  },

  // ========== 组队设置（最佳球） ==========
  showTeamSetup() {
    const game = this.data.currentGame
    // 如果没有设置过，默认每人一队
    if (!game.teams) {
      game.teams = {}
      game.players.forEach((p, index) => {
        game.teams[p.id] = Math.floor(index / 2) + 1
      })
      this.setData({ currentGame: game })
      wx.setStorageSync('currentGame', game)
    }
    this.setData({ showTeamModal: true })
  },

  hideTeamModal() {
    this.setData({ showTeamModal: false })
  },

  adjustPlayerTeam(e) {
    const playerId = e.currentTarget.dataset.player
    const delta = parseInt(e.currentTarget.dataset.delta)
    const game = this.data.currentGame
    const currentTeam = game.teams[playerId] || 1
    const newTeam = Math.max(1, currentTeam + delta)

    game.teams[playerId] = newTeam
    this.setData({ currentGame: { ...game } })
    if (!this.isCloudGame) {
      wx.setStorageSync('currentGame', game)
    } else {
      this.updateCloudGame(game)
    }
  },

  saveTeamSetup() {
    const game = this.data.currentGame
    if (this.isCloudGame) {
      this.updateCloudGame(game)
    }
    this.hideTeamModal()
    wx.showToast({ title: '组队设置已保存', icon: 'none' })
  },

  // ========== 地主设置（斗地主） ==========
  showLandlordSetup() {
    const game = this.data.currentGame
    // 如果没有设置过，默认第一个球员
    if (!game.landlordId && game.players.length > 0) {
      game.landlordId = game.players[0].id
      game.currentLandlordId = game.players[0].id
      this.setData({ currentGame: game })
      if (!this.isCloudGame) {
        wx.setStorageSync('currentGame', game)
      } else {
        this.updateCloudGame(game)
      }
    }
    this.setData({ showLandlordModal: true })
  },

  hideLandlordModal() {
    this.setData({ showLandlordModal: false })
  },

  selectLandlordPlayer(e) {
    const playerId = e.currentTarget.dataset.player
    const game = this.data.currentGame
    game.landlordId = playerId
    game.currentLandlordId = playerId
    this.setData({ currentGame: { ...game } })
  },

  saveLandlordSetup() {
    const game = this.data.currentGame
    if (!this.isCloudGame) {
      wx.setStorageSync('currentGame', game)
    } else {
      this.updateCloudGame(game)
    }
    this.hideLandlordModal()
    wx.showToast({ title: '地主设置已保存', icon: 'none' })
  },

  // 辅助函数：提取成绩值（兼容新旧格式）
  extractScoreValue(scoreData) {
    if (!scoreData) return null
    // 新格式：{ strokes, confirmed, ... }
    if (typeof scoreData === 'object' && scoreData.strokes !== undefined) {
      return scoreData.strokes
    }
    // 旧格式：直接是数字
    return scoreData
  },

  // 辅助函数：提取成绩对象（用于获取确认状态等）
  extractScoreObject(scoreData) {
    if (!scoreData) return null
    if (typeof scoreData === 'object') {
      return scoreData
    }
    // 旧格式转新格式
    return { strokes: scoreData, confirmed: true }
  },

  // 获取球员分数
  getScore(playerId) {
    const scoreData = this.data.currentGame?.scores[playerId]?.[this.data.currentHole]
    return this.extractScoreValue(scoreData)
  },

  // 获取球员推杆数
  getPutts(playerId) {
    return this.data.currentGame?.putts?.[playerId]?.[this.data.currentHole]
  },

  // 显示成绩录入弹窗
  showScoreInput(e) {
    const playerId = e.currentTarget.dataset.player
    // 支持从记分卡点击特定洞
    const holeNum = e.currentTarget.dataset.hole
    if (holeNum && holeNum !== this.data.currentHole) {
      this.setCurrentHole(parseInt(holeNum))
    }

    const player = this.data.currentGame.players.find(p => p.id === playerId)
    const currentScore = this.getScore(playerId)
    const currentPutts = this.getPutts(playerId) || 2

    // 如果没有成绩，默认设为当前洞的标准杆
    const defaultStrokes = currentScore || this.data.currentHoleData.par

    this.setData({
      editingScore: {
        playerId: playerId,
        playerName: player ? player.name : '',
        strokes: defaultStrokes,
        putts: currentPutts,
        showCustomInput: false
      }
    })
  },

  // 快速设置杆数（含智能推杆建议）
  setStrokesQuick(e) {
    const value = e.currentTarget.dataset.value
    // 如果是 "custom"，显示自定义输入
    if (value === 'custom') {
      this.setData({
        'editingScore.showCustomInput': true
      })
      return
    }
    const strokes = parseInt(value)
    // 智能推测推杆数
    let suggestedPutts = 2
    if (strokes <= 2) suggestedPutts = 1
    else if (strokes >= this.data.currentHoleData.par + 2) suggestedPutts = 3

    this.setData({
      'editingScore.strokes': strokes,
      'editingScore.putts': suggestedPutts,
      'editingScore.showCustomInput': false
    })
  },

  // 手动输入杆数
  onCustomStrokesInput(e) {
    const value = parseInt(e.detail.value) || this.data.currentHoleData.par
    this.setData({
      'editingScore.strokes': value
    })
  },

  // 关闭成绩录入弹窗
  hideScoreInput() {
    this.setData({
      editingScore: {
        playerId: null,
        playerName: '',
        strokes: null,
        putts: 2,
        showCustomInput: false
      }
    })
  },

  // 设置杆数
  setStrokes(e) {
    const strokes = parseInt(e.currentTarget.dataset.value)
    this.setData({
      'editingScore.strokes': strokes,
      // 智能设置推杆数：如果没有设置过，根据成绩智能建议
      'editingScore.putts': this.data.editingScore.putts || (strokes <= 2 ? 1 : 2)
    })
  },

  // +/- 调节杆数
  adjustStrokes(e) {
    const delta = parseInt(e.currentTarget.dataset.delta)
    const current = this.data.editingScore.strokes || this.data.currentHoleData.par
    const newValue = Math.max(1, current + delta)
    this.setData({
      'editingScore.strokes': newValue
    })
  },

  // +/- 调节推杆数
  adjustPutts(e) {
    const delta = parseInt(e.currentTarget.dataset.delta)
    const current = this.data.editingScore.putts || 0
    const newValue = Math.max(0, Math.min(current + delta, 10))
    this.setData({
      'editingScore.putts': newValue
    })
  },

  // 快速设置成绩（预设按钮）
  quickSetScore(e) {
    const strokes = parseInt(e.currentTarget.dataset.strokes)
    const putts = parseInt(e.currentTarget.dataset.putts)
    this.setData({
      'editingScore.strokes': strokes,
      'editingScore.putts': putts
    })
    // 自动确认
    setTimeout(() => this.confirmScore(), 200)
  },

  // 设置推杆数
  setPutts(e) {
    const putts = parseInt(e.currentTarget.dataset.value)
    this.setData({
      'editingScore.putts': putts
    })
  },

  // 确认成绩录入
  confirmScore() {
    const { playerId, strokes, putts } = this.data.editingScore
    if (!playerId || !strokes) return

    // 获取最新的游戏数据（避免并发修改）
    let game = this.isCloudGame ? this.data.currentGame : (wx.getStorageSync('currentGame') || this.data.currentGame)
    const currentHole = this.data.currentHole

    // 确保 scores 结构存在
    if (!game.scores) game.scores = {}
    if (!game.scores[playerId]) game.scores[playerId] = {}

    // 更新杆数
    game.scores[playerId][currentHole] = strokes

    // 更新推杆数
    if (!game.putts) game.putts = {}
    if (!game.putts[playerId]) game.putts[playerId] = {}
    game.putts[playerId][currentHole] = putts

    // 如果是本地比赛，使用防抖保存到 storage（500ms延迟批量写入）
    if (!this.isCloudGame) {
      storageDebounced.setStorageDebounced('currentGame', game, 500)
    }

    // 优化：只更新当前球员的数据，而不是重新计算所有
    const currentHoleData = this.data.currentHoleData

    // 增量更新单个球员成绩显示
    const scoreDiff = strokes - currentHoleData.par

    // 优化：直接构造当前洞的更新数据，使用路径更新
    const currentHoleIndex = currentHole - 1
    const currentHoleGridData = this.data.scoreGridData[currentHoleIndex]
    const updatedScores = currentHoleGridData.scores.map(s => {
      if (s.playerId === playerId) {
        return {
          playerId,
          display: scoreDiff === 0 ? 'Par' : (scoreDiff > 0 ? `+${scoreDiff}` : `${scoreDiff}`),
          class: scoreDiff < 0 ? 'to-par-under' : (scoreDiff > 0 ? 'to-par-over' : 'to-par-even')
        }
      }
      return s
    })

    // 增量更新球员总杆数
    const playerTotalList = this.calcPlayerTotalList(game, this.data.holes)

    // 优化：使用路径更新，只传输变更的数据
    this.setData({
      currentGame: game,
      playerTotalList: playerTotalList,
      [`scoreGridData[${currentHoleIndex}].scores`]: updatedScores
    })

    // 更新领先者
    const course = this.data.courses.find(c => c.id === game.courseId)
    this.calculateLeader(game, course)

    this.hideScoreInput()

    // 如果是云端比赛，同步更新到云端（通过云函数带权限校验）
    if (this.isCloudGame) {
      // 获取当前用户信息（修改者）
      const userInfo = wx.getStorageSync('userInfo') || {}
      const modifierName = userInfo.nickName || '球友'

      wx.cloud.callFunction({
        name: 'updateScore',
        data: {
          gameId: game.gameId || game.id,
          playerId: playerId,
          hole: currentHole,
          strokes: strokes,
          putts: putts,
          modifierName: modifierName
        },
        success: (res) => {
          console.log('[权限校验] 成绩确认更新成功', res.result)
          // 如果需要确认，提示用户
          if (res.result && res.result.needsConfirmation) {
            wx.showToast({
              title: '已提交，待确认',
              icon: 'none',
              duration: 2000
            })
          }
        },
        fail: (err) => {
          console.error('[权限校验] 成绩确认更新失败:', err)
          wx.showToast({
            title: err.result && err.result.error ? err.result.error : '更新失败',
            icon: 'none'
          })
        }
      })
    }

    // 检查是否所有球员都已完成当前洞，如果是则自动跳到下一洞
    this.checkAndAutoAdvance()
  },

  // 检查是否所有球员都已完成当前洞，如果是则自动跳到下一洞或完成比赛
  checkAndAutoAdvance() {
    const game = this.data.currentGame
    const currentHole = this.data.currentHole
    const players = game.players || []
    const scores = game.scores || {}
    const holes = this.data.holes || []

    // 检查所有球员是否都有当前洞的成绩
    const allPlayersScored = players.every(player => {
      const playerScores = scores[player.id]
      const scoreData = playerScores?.[currentHole]
      // 兼容新旧格式：检查是否有有效的成绩值
      return this.extractScoreValue(scoreData) !== null
    })

    if (!allPlayersScored) return

    // 检查是否所有洞所有球员都已完成
    const allHolesCompleted = holes.every(hole => {
      return players.every(player => {
        const playerScores = scores[player.id]
        const scoreData = playerScores?.[hole.hole]
        return this.extractScoreValue(scoreData) !== null
      })
    })

    // 如果全部洞都完成，弹出确认框询问是否完成比赛
    if (allHolesCompleted) {
      setTimeout(() => {
        wx.showModal({
          title: '比赛完成',
          content: '所有洞成绩已录入完毕，是否完成比赛并查看报告？',
          confirmText: '查看报告',
          cancelText: '继续编辑',
          success: (res) => {
            if (res.confirm) {
              this.finishGame()
            }
          }
        })
      }, 500)
      return
    }

    // 不是最后一洞，自动跳到下一洞
    if (currentHole < this.data.totalHoles) {
      setTimeout(() => {
        this.setCurrentHole(currentHole + 1)
      }, 300)
    }
  },

  // 获取总推杆数
  getPlayerTotalPutts(playerId) {
    const putts = this.data.currentGame.putts?.[playerId]
    if (!putts) return 0

    let total = 0
    Object.values(putts).forEach(p => {
      if (p) total += parseInt(p)
    })
    return total
  },

  // 获取分数显示
  getScoreDisplay(playerId) {
    const score = this.getScore(playerId)
    const par = this.data.currentHoleData.par
    if (!score) return ''

    const diff = score - par
    if (diff === -2) return '老鹰'
    if (diff === -1) return '小鸟'
    if (diff === 0) return '平标准'
    if (diff === 1) return '+1'
    if (diff === 2) return '+2'
    return diff > 0 ? `+${diff}` : diff.toString()
  },

  // 获取分数样式类
  getScoreClass(playerId) {
    const score = this.getScore(playerId)
    const par = this.data.currentHoleData.par
    if (!score) return ''

    const diff = score - par
    if (diff <= -2) return 'badge-eagle'
    if (diff === -1) return 'badge-birdie'
    if (diff === 0) return 'badge-par'
    if (diff === 1) return 'badge-bogey'
    return 'badge-double'
  },

  // 获取单元格分数样式
  getCellScoreClass(playerId, hole) {
    const scoreData = this.data.currentGame.scores[playerId]?.[hole]
    if (!scoreData) return ''

    // 兼容新旧格式
    const strokes = this.extractScoreValue(scoreData)
    if (!strokes) return ''

    const holeData = this.data.holes.find(h => h.hole === hole)
    if (!holeData) return ''

    const diff = strokes - holeData.par
    if (diff <= -2) return 'eagle'
    if (diff === -1) return 'birdie'
    if (diff === 0) return 'par'
    if (diff === 1) return 'bogey'
    if (diff >= 2) return 'double-bogey'
    return ''
  },

  // 获取单个洞的差点显示（E, +1, -1等）
  getScoreToParDisplay(playerId, hole) {
    const game = this.data.currentGame
    if (!game || !game.scores) return '-'

    const playerScores = game.scores[playerId]
    if (!playerScores) return '-'

    // 使用宽松匹配查找成绩（数字/字符串类型无关）
    const scoreData = playerScores[hole] || playerScores[String(hole)]
    if (!scoreData) return '-'

    // 兼容新旧格式
    const strokes = this.extractScoreValue(scoreData)
    if (!strokes) return '-'

    const holes = this.data.holes || []
    const holeData = holes.find(h => h.hole == hole || h.holeNumber == hole)
    if (!holeData) return strokes.toString()

    const diff = strokes - holeData.par
    if (diff === 0) return 'E'
    if (diff > 0) return `+${diff}`
    return `${diff}`
  },

  // 获取单个洞差点的颜色类名
  getScoreToParClass(playerId, hole) {
    const game = this.data.currentGame
    if (!game || !game.scores) return ''

    const playerScores = game.scores[playerId]
    if (!playerScores) return ''

    const scoreData = playerScores[hole] || playerScores[String(hole)]
    if (!scoreData) return ''

    // 兼容新旧格式
    const strokes = this.extractScoreValue(scoreData)
    if (!strokes) return ''

    const holes = this.data.holes || []
    const holeData = holes.find(h => h.hole == hole || h.holeNumber == hole)
    if (!holeData) return ''

    const diff = strokes - holeData.par
    if (diff < 0) return 'to-par-under'
    if (diff > 0) return 'to-par-over'
    return 'to-par-even'
  },

  // 计算记分卡网格数据
  calcScoreGridData(game, holes) {
    if (!game || !game.players || !game.scores || !holes) return []

    return holes.map(hole => {
      // 使用自定义par，如果有的话（云端优先）
      const effectivePar = game.customPar && game.customPar[hole.hole]
        ? game.customPar[hole.hole]
        : hole.par

      const holeScores = game.players.map(player => {
        const playerScores = game.scores[player.id]
        const scoreData = playerScores?.[hole.hole] || playerScores?.[String(hole.hole)]

        if (!scoreData) {
          return {
            playerId: player.id,
            display: '-',
            class: '',
            confirmed: true
          }
        }

        // 提取成绩值（兼容新旧格式）
        const strokes = this.extractScoreValue(scoreData)
        const scoreObj = this.extractScoreObject(scoreData)
        const confirmed = scoreObj ? scoreObj.confirmed !== false : true

        if (!strokes) {
          return {
            playerId: player.id,
            display: '-',
            class: '',
            confirmed: true
          }
        }

        const diff = parseInt(strokes) - effectivePar
        let display = ''
        let className = ''

        if (diff === 0) {
          display = 'Par'
          className = 'to-par-even'
        } else if (diff > 0) {
          display = `+${diff}`
          className = 'to-par-over'
        } else {
          display = `${diff}`
          className = 'to-par-under'
        }

        // 待确认状态添加标记
        if (!confirmed) {
          className += ' pending-confirm'
        }

        return {
          playerId: player.id,
          display,
          class: className,
          confirmed: confirmed,
          modifiedByName: scoreObj?.modifiedByName || ''
        }
      })

      return {
        hole: hole.hole,
        par: hole.par,
        scores: holeScores
      }
    })
  },

  // 获取球员总分
  getPlayerTotal(playerId) {
    const scores = this.data.currentGame.scores[playerId]
    if (!scores) return '-'

    let total = 0
    let hasScore = false
    Object.values(scores).forEach(score => {
      if (score) {
        total += parseInt(score)
        hasScore = true
      }
    })

    return hasScore ? total : '-'
  },

  // 计算所有球员的总杆显示列表（与players数组顺序一致）
  calcPlayerTotalList(game, holes) {
    if (!game || !game.players || !game.scores) return []

    return game.players.map(player => {
      const playerScores = game.scores[player.id]
      if (!playerScores) {
        return { id: player.id, display: '-', class: '' }
      }

      let total = 0
      let parTotal = 0
      let hasScore = false

      for (const [holeNum, scoreData] of Object.entries(playerScores)) {
        // 兼容新旧格式
        const strokes = this.extractScoreValue(scoreData)
        if (strokes && parseInt(strokes) > 0) {
          total += parseInt(strokes)
          hasScore = true
          const hole = holes.find(h => (h.hole == holeNum || h.holeNumber == holeNum))
          if (hole) parTotal += hole.par
        }
      }

      if (!hasScore) {
        return { id: player.id, display: '-', class: '' }
      }

      const toPar = total - parTotal
      const toParStr = toPar === 0 ? 'E' : (toPar > 0 ? `+${toPar}` : toPar)
      let className = ''
      if (toPar < 0) className = 'under'
      else if (toPar > 0) className = 'over'
      else className = 'even'

      return { id: player.id, total: total, diff: toParStr, class: className }
    })
  },

  // 获取总杆数及与标准杆的差值（格式：80(+8) 或 72(E) 或 68(-4)）
  getPlayerTotalWithToPar(playerId) {
    const game = this.data.currentGame
    const holes = this.data.holes

    // 防御性检查
    if (!game) return 'NG'
    if (!game.scores) return 'NS'

    const playerScores = game.scores[playerId]
    if (!playerScores) return 'NP'

    let total = 0
    let parTotal = 0
    let hasScore = false

    for (const [holeNum, scoreData] of Object.entries(playerScores)) {
      // 兼容新旧格式
      const strokes = this.extractScoreValue(scoreData)
      if (strokes && parseInt(strokes) > 0) {
        total += parseInt(strokes)
        hasScore = true
        const hole = holes.find(h => (h.hole == holeNum || h.holeNumber == holeNum))
        if (hole) parTotal += hole.par
      }
    }

    if (!hasScore) return '0(E)'

    const toPar = total - parTotal
    const symbol = toPar === 0 ? 'E' : (toPar > 0 ? `+${toPar}` : toPar)
    return `${total}(${symbol})`
  },

  // 获取总分样式
  getTotalClass(playerId) {
    const scores = this.data.currentGame.scores[playerId]
    if (!scores) return ''

    let total = 0
    let holesCompleted = 0
    let parsPlayed = 0

    Object.entries(scores).forEach(([hole, scoreData]) => {
      // 兼容新旧格式
      const strokes = this.extractScoreValue(scoreData)
      if (strokes) {
        total += parseInt(strokes)
        holesCompleted++
        const holeData = this.data.holes.find(h => h.hole === parseInt(hole))
        if (holeData) parsPlayed += holeData.par
      }
    })

    if (holesCompleted === 0) return ''

    const diff = total - parsPlayed
    if (diff < 0) return 'under'
    if (diff > 0) return 'over'
    return 'even'
  },

  // 输入分数
  onScoreInput(e) {
    const playerId = e.currentTarget.dataset.player
    const value = parseInt(e.detail.value) || null

    this.updateScore(playerId, value)
  },

  // 调整分数
  adjustScore(e) {
    const playerId = e.currentTarget.dataset.player
    const delta = parseInt(e.currentTarget.dataset.delta)

    const currentScore = this.data.currentGame.scores[playerId][this.data.currentHole] || 0
    const newScore = Math.max(1, currentScore + delta)

    this.updateScore(playerId, newScore)
  },

  // 更新分数
  updateScore(playerId, score) {
    const game = this.data.currentGame
    const currentPutts = this.data.editingScore ? this.data.editingScore.putts : (game.putts && game.putts[playerId] && game.putts[playerId][this.data.currentHole]) || 0

    // 创建新的scores对象，确保setData能检测到变化
    const newScores = JSON.parse(JSON.stringify(game.scores))
    if (!newScores[playerId]) {
      newScores[playerId] = {}
    }
    newScores[playerId][this.data.currentHole] = score

    // 创建新的putts对象
    const newPutts = JSON.parse(JSON.stringify(game.putts || {}))
    if (!newPutts[playerId]) {
      newPutts[playerId] = {}
    }
    newPutts[playerId][this.data.currentHole] = currentPutts

    // 创建新的game对象
    const newGame = { ...game, scores: newScores, putts: newPutts }

    this.setData({ currentGame: newGame })

    if (!this.isCloudGame) {
      storageDebounced.setStorageDebounced('currentGame', newGame, 500)
    } else {
      // 云端游戏：单个成绩修改通过云函数更新，带服务端权限校验
      // 只有球员本人（openid匹配）能修改自己的成绩
      wx.cloud.callFunction({
        name: 'updateScore',
        data: {
          gameId: this.data.currentGame.gameId || this.data.currentGame.id,
          playerId: playerId,
          hole: this.data.currentHole,
          strokes: score,
          putts: currentPutts
        },
        success: () => {
          console.log('[权限校验] 成绩更新成功')
        },
        fail: (err) => {
          console.error('[权限校验] 成绩更新失败:', err)
          wx.showToast({
            title: err.result && err.result.error ? err.result.error : '更新失败',
            icon: 'none'
          })
        }
      })
    }

    // 更新领先者（延迟执行，避免频繁计算）
    if (this.leaderDebounceTimer) clearTimeout(this.leaderDebounceTimer)
    this.leaderDebounceTimer = setTimeout(() => {
      const course = this.data.courses.find(c => c.id === newGame.courseId)
      this.calculateLeader(newGame, course)
    }, 300)
  },

  // 显示添加选手弹窗
  showAddPlayerModal() {
    this.setData({ showAddPlayer: true })
  },

  // 隐藏添加选手弹窗
  hideAddPlayerModal() {
    this.setData({ showAddPlayer: false })
  },

  // 添加新选手
  addPlayer(e) {
    const name = e.detail.value.name?.trim()
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }

    const game = this.data.currentGame
    const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#795548', '#607D8B']

    const newPlayer = {
      id: 'player_' + Date.now(),
      name: name,
      color: colors[game.players.length % colors.length],
      isCustom: true
    }

    game.players.push(newPlayer)
    game.scores[newPlayer.id] = {}

    this.setData({
      currentGame: game,
      showAddPlayer: false
    })

    if (!this.isCloudGame) {
      wx.setStorageSync('currentGame', game)
    } else {
      this.updateCloudGame(game)
    }

    wx.showToast({
      title: '已添加 ' + name,
      icon: 'success'
    })
  },

  // 从微信通讯录选择好友
  // 从微信通讯录选择联系人添加球员
  chooseWxContact() {
    wx.chooseContact({
      success: (res) => {
        const nickName = res.nickName || res.displayName || res.firstName || res.lastName
        const avatarUrl = res.avatarUrl || ''

        if (!nickName) {
          wx.showToast({ title: '未获取到联系人信息', icon: 'none' })
          return
        }

        const game = this.data.currentGame
        if (!game) return

        // 检查是否已存在
        if (game.players.some(p => p.name === nickName)) {
          wx.showToast({ title: '该球员已在比赛中', icon: 'none' })
          return
        }

        // 生成颜色
        const colors = ['#2c8f4e', '#2196f3', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#795548', '#607d8b']
        const colorIndex = game.players.length % colors.length

        const newPlayer = {
          id: Date.now().toString(),
          name: nickName,
          color: colors[colorIndex],
          fromContact: true,
          avatar: avatarUrl,
          avatarUrl: avatarUrl,
          isContact: true
        }

        game.players.push(newPlayer)
        game.scores[newPlayer.id] = {}

        this.setData({
          currentGame: game,
          showAddPlayer: false
        })

        if (!this.isCloudGame) {
          wx.setStorageSync('currentGame', game)
        }

        wx.showToast({ title: '添加成功', icon: 'success' })
      },
      fail: (err) => {
        console.log('选择联系人失败:', err)
        wx.showToast({ title: '取消添加', icon: 'none' })
      }
    })
  },

  // 完成比赛
  finishGame() {
    console.log('【finishGame】开始完成比赛')

    // 检查当前游戏数据
    const game = this.data.currentGame
    if (!game) {
      console.error('【finishGame】错误: currentGame 为空')
      wx.showToast({ title: '比赛数据错误', icon: 'none' })
      return
    }
    console.log('【finishGame】当前游戏:', game.id, '球员数:', game.players?.length)

    // 先计算获胜者信息
    let winnerInfo = null
    try {
      winnerInfo = this.calculateWinnerForGame()
      console.log('【finishGame】获胜者信息:', winnerInfo)
    } catch (err) {
      console.error('【finishGame】计算获胜者失败:', err)
      console.error('【finishGame】错误堆栈:', err.stack)
    }

    // 构建获胜者显示文本
    let winnerText = ''
    if (winnerInfo && winnerInfo.players && winnerInfo.players.length > 0) {
      const playerNames = winnerInfo.players.map(p => p.name).join('、')
      winnerText = `\n\n🏆 ${winnerInfo.title}\n${playerNames}\n${winnerInfo.players[0]?.score || ''}`
    }

    console.log('【finishGame】准备显示确认弹窗')

    wx.showModal({
      title: '比赛结束',
      content: `本场比赛已结束！${winnerText}\n\n是否查看详细报告？`,
      confirmText: '查看报告',
      cancelText: '留在本页',
      success: (res) => {
        console.log('【finishGame】用户选择:', res.confirm ? '查看报告' : '留在记分卡')
        // 保存获胜者信息到游戏数据
        game.winnerInfo = winnerInfo
        wx.setStorageSync('currentGame', game)

        // 无论选择哪个选项，都完成比赛
        if (res.confirm) {
          // 查看报告 - 完成比赛并跳转
          this.completeGame()
        } else {
          // 留在记分卡 - 完成比赛但留在当前页面
          this.completeGameStay()
        }
      },
      fail: (err) => {
        console.error('【finishGame】showModal 失败:', err)
      }
    })
  },

  // 计算比赛获胜者（用于完成比赛时显示）
  calculateWinnerForGame() {
    const game = this.data.currentGame
    const players = game.players || []
    const mode = game.gameMode || game.mode || 'stroke'
    const holes = this.data.holes || []

    console.log('【calculateWinnerForGame】模式:', mode, '球员数:', players.length)

    if (players.length === 0) return null

    // 计算每个球员的总成绩
    const playersWithTotals = players.map(player => {
      const scores = game.scores?.[player.id] || {}
      let total = 0
      let parTotal = 0
      let hasScore = false

      Object.entries(scores).forEach(([holeNum, scoreData]) => {
        // 兼容新旧格式
        const strokes = this.extractScoreValue(scoreData)
        if (strokes && parseInt(strokes) > 0) {
          total += parseInt(strokes)
          hasScore = true
          const hole = holes.find(h => (h.hole == holeNum || h.holeNumber == holeNum))
          if (hole) parTotal += hole.par
        }
      })

      return {
        ...player,
        total: total,
        toPar: total - parTotal,
        hasScore: hasScore
      }
    })

    switch (mode) {
      case 'stroke':
      case 'match':
        // 比杆赛/比洞赛：杆数最少者获胜
        const sortedByScore = [...playersWithTotals].sort((a, b) => (a.total || 0) - (b.total || 0))
        if (sortedByScore.length === 0 || !sortedByScore[0]) return null
        const bestScore = sortedByScore[0].total || 0
        const winners = sortedByScore.filter(p => (p.total || 0) === bestScore)
        const toPar = winners[0]?.toPar || 0
        return {
          title: winners.length > 1 ? '并列冠军' : '冠军',
          players: winners.map(p => ({
            name: p.name,
            color: p.color,
            score: `${p.total}杆 ${toPar > 0 ? '+' : ''}${toPar}`
          })),
          desc: winners.length > 1 ? `${winners.length}位球员并列第一` : '总杆数最少'
        }

      case 'stableford':
        // 史特伯福特：积分最高者获胜
        const sortedByPoints = [...playersWithTotals].sort((a, b) => (b.points || 0) - (a.points || 0))
        if (sortedByPoints.length === 0 || !sortedByPoints[0]) return null
        const bestPoints = sortedByPoints[0].points || 0
        const pointWinners = sortedByPoints.filter(p => (p.points || 0) === bestPoints)
        return {
          title: pointWinners.length > 1 ? '并列冠军' : '冠军',
          players: pointWinners.map(p => ({
            name: p.name,
            color: p.color,
            score: `${p.points || 0}分`
          })),
          desc: '史特伯福特积分制'
        }

      case 'skins':
        const sortedBySkins = [...playersWithTotals].sort((a, b) => (b.skinsWon || 0) - (a.skinsWon || 0))
        if (sortedBySkins.length === 0 || !sortedBySkins[0]) return null
        const bestSkins = sortedBySkins[0].skinsWon || 0
        if (bestSkins > 0) {
          const skinWinners = sortedBySkins.filter(p => (p.skinsWon || 0) === bestSkins)
          return {
            title: skinWinners.length > 1 ? '并列冠军' : '冠军',
            players: skinWinners.map(p => ({
              name: p.name,
              color: p.color,
              score: `赢得${p.skinsWon}洞`
            })),
            desc: 'Skins赛制'
          }
        }
        return null

      default:
        const defaultSorted = [...playersWithTotals].sort((a, b) => (a.total || 0) - (b.total || 0))
        if (defaultSorted.length === 0 || !defaultSorted[0]) return null
        const defaultToPar = defaultSorted[0].toPar || 0
        return {
          title: '最佳成绩',
          players: [defaultSorted[0]].map(p => ({
            name: p.name,
            color: p.color,
            score: `${p.total}杆 ${defaultToPar > 0 ? '+' : ''}${defaultToPar}`
          })),
          desc: '总杆数'
        }
    }
  },

  // 完成比赛核心逻辑（公共部分）
  _finalizeGameCore(game, keepCurrent = false) {
    game.completed = true
    game.endTime = Date.now()
    game.updateTime = Date.now()
    game.statistics = this.calculateStatistics(game)

    // 保存到历史记录
    const games = wx.getStorageSync('games') || []
    // 查找是否已存在这条记录（编辑已完成比赛的情况）
    const existingIndex = games.findIndex(g => g.id === game.id || g.gameId === game.gameId)
    if (existingIndex >= 0) {
      // 已存在，替换旧数据
      games[existingIndex] = game
    } else {
      // 不存在，新增
      games.push(game)
    }
    wx.setStorageSync('games', games)

    // 是否保留当前比赛
    if (keepCurrent) {
      wx.setStorageSync('currentGame', game)
    } else {
      wx.removeStorageSync('currentGame')
      wx.removeStorageSync('currentHole')
    }

    // 上传到云端
    if (wx.cloud) {
      const db = wx.cloud.database()
      if (game._id) {
        // 比赛已存在云端，执行更新
        // 排除云数据库保留字段
        const { _id, _openid, _updateTime, _createTime, ...updateGameData } = game
        console.log('【云端更新】排除保留字段后的数据:', Object.keys(updateGameData))
        db.collection('games').doc(_id).update({
          data: { ...updateGameData, updateTime: db.serverDate() },
          success: res => console.log('【云端更新】成功', _id),
          fail: err => console.error('【云端更新】失败', err)
        })
      } else {
        // 新比赛，插入
        db.collection('games').add({
          data: { ...game, createTime: db.serverDate() },
          success: res => {
            console.log('【云端上传】成功', res._id)
            game._id = res._id
          },
          fail: err => console.error('【云端上传】失败', err)
        })
      }
    }

    // 更新球场打球次数
    this.updateCoursePlayCount(game.courseId)

    return game
  },

  // 完成比赛并跳转到报告
  completeGame() {
    console.log('【completeGame】开始完成比赛并跳转')
    try {
      const game = this.data.currentGame
      if (!game) {
        wx.showToast({ title: '比赛数据错误', icon: 'none' })
        return
      }

      this._finalizeGameCore(game, false)

      wx.showToast({ title: '比赛完成！', icon: 'success', duration: 1500 })
      setTimeout(() => this.generateAndShare(game), 1500)
    } catch (err) {
      console.error('【completeGame】错误:', err)
      wx.showToast({ title: '完成比赛失败', icon: 'none' })
    }
  },

  // 完成比赛但留在当前页面
  completeGameStay() {
    console.log('【completeGameStay】开始完成比赛并停留')
    try {
      const game = this.data.currentGame
      if (!game) {
        wx.showToast({ title: '比赛数据错误', icon: 'none' })
        return
      }

      const updatedGame = this._finalizeGameCore(game, true)
      this.setData({ currentGame: updatedGame })

      wx.showToast({ title: '比赛已完成', icon: 'success', duration: 1500 })
    } catch (err) {
      console.error('【completeGameStay】错误:', err)
      wx.showToast({ title: '完成比赛失败', icon: 'none' })
    }
  },

  // 更新球场打球次数
  updateCoursePlayCount(courseId) {
    if (!courseId) return

    const coursePlayCounts = wx.getStorageSync('coursePlayCounts') || {}
    coursePlayCounts[courseId] = (coursePlayCounts[courseId] || 0) + 1
    wx.setStorageSync('coursePlayCounts', coursePlayCounts)

    console.log(`【球场统计】${courseId} 打球次数 +1，当前: ${coursePlayCounts[courseId]}`)
  },

  // 生成海报并分享
  async generateAndShare(game) {
    wx.showLoading({ title: '生成海报...' })

    try {
      // 获取用户偏好的海报风格
      const preferredStyle = preferenceManager.getPreference('posterStyle', 'pro')
      const player = game.players[0] || { name: '球员', color: '#2c8f4e' }

      // 生成海报
      const posterUrl = await posterGenerator.generatePoster({
        type: preferredStyle,
        game,
        player,
        context: this
      })

      wx.hideLoading()

      // 跳转到报告页面，并带上海报地址（使用分包路径）
      wx.navigateTo({
        url: `/package-game/pages/game-report/game-report?gameId=${game.id}`,
        success: (res) => {
          res.eventChannel.emit('reportData', {
            game: game,
            report: analysisReport.generateGameReport(game),
            posterUrl: posterUrl,
            autoShowPoster: true
          })
        }
      })
    } catch (err) {
      console.error('生成海报失败:', err)
      wx.hideLoading()

      // 生成失败也跳转到报告页面（使用分包路径）
      wx.navigateTo({
        url: `/package-game/pages/game-report/game-report?gameId=${game.id}`,
        success: (res) => {
          res.eventChannel.emit('reportData', {
            game: game,
            report: analysisReport.generateGameReport(game)
          })
        }
      })
    }
  },

  calculateStatistics(game) {
    const stats = {}

    // 防御性检查
    if (!game || !game.players) {
      console.log('【calculateStatistics】游戏数据不完整')
      return stats
    }

    // 安全获取球场数据
    const courses = this.data.courses || []
    const course = courses.find(c => c.id === game.courseId)
    if (!course) {
      console.log('【calculateStatistics】未找到球场数据:', game.courseId)
    }

    game.players.forEach(player => {
      const scores = game.scores?.[player.id] || {}
      const playerStats = {
        totalScore: 0,
        totalPar: 0,
        holesPlayed: 0,
        pars: 0,
        birdies: 0,
        eagles: 0,
        bogeys: 0,
        doubleBogeys: 0,
        others: 0
      }

      Object.entries(scores).forEach(([holeNum, scoreData]) => {
        // 兼容新旧格式
        const strokes = this.extractScoreValue(scoreData)
        if (strokes) {
          const holeData = course?.holes?.find(h => h.hole === parseInt(holeNum))
          const par = holeData?.par || 4 // 默认par 4

          playerStats.totalScore += parseInt(strokes) || 0
          playerStats.totalPar += par
          playerStats.holesPlayed++

          const diff = parseInt(strokes) - par
          if (diff <= -2) playerStats.eagles++
          else if (diff === -1) playerStats.birdies++
          else if (diff === 0) playerStats.pars++
          else if (diff === 1) playerStats.bogeys++
          else if (diff === 2) playerStats.doubleBogeys++
          else playerStats.others++
        }
      })

      playerStats.toPar = playerStats.totalScore - playerStats.totalPar
      stats[player.id] = playerStats
    })

    return stats
  },

  // ========== 智能分析报告 ==========
  generateAnalysisReport() {
    const historyGames = wx.getStorageSync('games') || []
    const report = analysisReport.generateGameReport(this.data.currentGame, historyGames)

    wx.navigateTo({
      url: '/package-game/pages/game-report/game-report',
      success: (res) => {
        res.eventChannel.emit('reportData', { report, game: this.data.currentGame })
      }
    })
  },

  // ========== OCR拍计分卡 ==========

  // 开始OCR校对 - 拍照选择图片
  async startOcrVerify() {
    const currentGame = this.data.currentGame
    if (!currentGame || !currentGame.courseId) {
      wx.showToast({ title: '比赛数据异常', icon: 'none' })
      return
    }

    // 保存原始洞数据
    const originalHoles = this.data.holes || []
    const originalTotalPar = originalHoles.reduce((sum, h) => sum + h.par, 0)

    this.setData({
      originalHoles,
      originalTotalPar
    })

    try {
      const chooseResult = await new Promise((resolve, reject) => {
        wx.chooseMedia({
          count: 1,
          mediaType: ['image'],
          sourceType: ['camera', 'album'],
          camera: 'back',
          success: resolve,
          fail: reject
        })
      })

      const imagePath = chooseResult.tempFiles[0].tempFilePath

      // 使用新的OCR服务
      const result = await OCRService.recognize(imagePath)

      if (result.success && result.holes && result.holes.length > 0) {
        // 转换为compareData需要的格式
        const ocrHoles = result.holes.map((h, idx) => ({ id: h.hole || idx + 1, par: h.par }))
        this.compareData(ocrHoles)
      } else {
        wx.showModal({
          title: '识别失败',
          content: result.error || '未能识别出有效的计分卡数据，请确保图片清晰并包含完整的18洞标准杆信息',
          showCancel: false
        })
      }
    } catch (err) {
      console.error('OCR识别失败:', err)
      wx.showToast({ title: '识别失败', icon: 'none' })
    }
  },

  // 识别计分卡图片（保留兼容）
  recognizeScorecard(imagePath) {
    // 使用新的OCR服务
    OCRService.recognize(imagePath).then(result => {
      if (result.success && result.holes && result.holes.length > 0) {
        const ocrHoles = result.holes.map((h, idx) => ({ id: h.hole || idx + 1, par: h.par }))
        this.compareData(ocrHoles)
      } else {
        wx.showModal({
          title: '识别失败',
          content: result.error || '未能识别出有效的计分卡数据',
          showCancel: false
        })
      }
    }).catch(err => {
      console.error('OCR识别失败:', err)
      wx.showToast({ title: '识别失败', icon: 'none' })
    })
  },

  // 对比数据差异
  compareData(ocrHoles) {
    const originalHoles = this.data.originalHoles
    let hasDiff = false

    // 补齐到18洞
    const fullOcrHoles = []
    for (let i = 1; i <= 18; i++) {
      const match = ocrHoles.find(h => h.id === i)
      if (match) {
        fullOcrHoles.push({ hole: i, par: match.par })
        const original = originalHoles[i - 1]
        if (original && original.par !== match.par) {
          hasDiff = true
        }
      } else if (originalHoles[i - 1]) {
        fullOcrHoles.push({ hole: i, par: originalHoles[i - 1].par })
      } else {
        fullOcrHoles.push({ hole: i, par: 4 }) // 默认值
      }
    }

    const ocrTotalPar = fullOcrHoles.reduce((sum, h) => sum + h.par, 0)

    // 检查是否有已记录成绩会被覆盖
    let hasScoreDiff = false
    const currentGame = this.data.currentGame
    if (currentGame && currentGame.scores) {
      const hasAnyScores = Object.keys(currentGame.scores).some(playerId =>
        Object.keys(currentGame.scores[playerId] || {}).length > 0
      )
      if (hasAnyScores && hasDiff) {
        hasScoreDiff = true
      }
    }

    this.setData({
      ocrHoles: fullOcrHoles,
      ocrTotalPar,
      hasDiff,
      hasScoreDiff,
      showOcrVerifyModal: true
    })
  },

  // 关闭弹窗
  hideOcrVerifyModal() {
    this.setData({ showOcrVerifyModal: false })
  },

  // 阻止冒泡
  preventHide() {
    // 空方法，阻止弹窗内容区点击关闭弹窗
  },

  // 确认替换数据
  confirmReplaceData() {
    const currentGame = this.data.currentGame
    const ocrHoles = this.data.ocrHoles

    // 更新球场洞数据
    const updatedGame = {
      ...currentGame,
      holes: ocrHoles
    }

    // 重新计算总分
    updatedGame.totalPar = ocrHoles.reduce((sum, h) => sum + h.par, 0)

    // 保存到球场数据
    if (currentGame.courseId) {
      OCRService.saveCourseHoles(currentGame.courseId, ocrHoles, 'ocr')
    }

    // 保存更新
    this.setData({
      currentGame: updatedGame,
      holes: ocrHoles,
      totalPar: updatedGame.totalPar,
      currentHoleData: ocrHoles[this.data.currentHole - 1] || ocrHoles[0]
    })

    // 重新计算网格数据并保存到存储
    this.updateScoreGrid()
    this.saveGame()

    wx.showToast({
      title: '数据已更新',
      icon: 'success'
    })

    this.hideOcrVerifyModal()
  },

  // 更新记分卡网格数据
  updateScoreGrid() {
    const game = this.data.currentGame
    const playerTotalList = this.calcPlayerTotalList(game, this.data.holes)
    const scoreGridData = this.calcScoreGridData(game, this.data.holes)
    this.setData({
      playerTotalList,
      scoreGridData
    })
  },

  // 保存游戏数据
  saveGame() {
    const game = this.data.currentGame
    if (!this.isCloudGame) {
      wx.setStorageSync('currentGame', game)
    } else {
      this.updateCloudGame(game)
    }
  },

  // ========== 待确认成绩相关 ==========

  // 计算待确认成绩
  calculatePendingConfirmations(game) {
    const userInfo = wx.getStorageSync('userInfo') || {}
    const myOpenid = userInfo.openid

    if (!myOpenid || !game || !game.players || !game.scores) {
      this.setData({ pendingConfirmations: [], pendingCount: 0 })
      return
    }

    // 找到当前用户的 playerId
    const myPlayer = game.players.find(p => p.openid === myOpenid)
    if (!myPlayer) {
      this.setData({ pendingConfirmations: [], pendingCount: 0 })
      return
    }

    const pendingList = []
    const myScores = game.scores[myPlayer.id] || {}

    // 遍历所有成绩，找出待确认的
    for (const [holeNum, scoreData] of Object.entries(myScores)) {
      const scoreObj = this.extractScoreObject(scoreData)
      if (scoreObj && scoreObj.confirmed === false) {
        pendingList.push({
          hole: parseInt(holeNum),
          strokes: scoreObj.strokes,
          modifiedByName: scoreObj.modifiedByName || '球友',
          modifiedAt: scoreObj.modifiedAt || 0
        })
      }
    }

    // 按洞号排序
    pendingList.sort((a, b) => a.hole - b.hole)

    this.setData({
      pendingConfirmations: pendingList,
      pendingCount: pendingList.length,
      myOpenid: myOpenid
    })
  },

  // 显示待确认成绩弹窗
  showPendingConfirmations() {
    if (this.data.pendingCount === 0) return
    this.setData({ showPendingModal: true })
  },

  // 隐藏待确认成绩弹窗
  hidePendingModal() {
    this.setData({ showPendingModal: false })
  },

  // 确认成绩
  confirmPendingScore(e) {
    const hole = e.currentTarget.dataset.hole
    const game = this.data.currentGame
    const userInfo = wx.getStorageSync('userInfo') || {}
    const myPlayer = game.players.find(p => p.openid === userInfo.openid)

    if (!myPlayer) return

    wx.showLoading({ title: '确认中...' })

    wx.cloud.callFunction({
      name: 'confirmScore',
      data: {
        gameId: game.gameId || game.id,
        playerId: myPlayer.id,
        hole: hole,
        action: 'confirm'
      },
      success: (res) => {
        wx.hideLoading()
        if (res.result && res.result.success) {
          wx.showToast({ title: '已确认', icon: 'success' })
          // 从待确认列表移除
          const pendingConfirmations = this.data.pendingConfirmations.filter(p => p.hole !== hole)
          this.setData({
            pendingConfirmations,
            pendingCount: pendingConfirmations.length,
            showPendingModal: pendingConfirmations.length > 0
          })
        } else {
          wx.showToast({ title: res.result?.error || '确认失败', icon: 'none' })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('确认成绩失败:', err)
        wx.showToast({ title: '确认失败', icon: 'none' })
      }
    })
  },

  // 拒绝成绩
  rejectPendingScore(e) {
    const hole = e.currentTarget.dataset.hole
    const game = this.data.currentGame
    const userInfo = wx.getStorageSync('userInfo') || {}
    const myPlayer = game.players.find(p => p.openid === userInfo.openid)

    if (!myPlayer) return

    wx.showModal({
      title: '拒绝成绩修改',
      content: `确定拒绝第${hole}洞的成绩修改吗？将恢复原成绩。`,
      confirmText: '拒绝',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...' })

          wx.cloud.callFunction({
            name: 'confirmScore',
            data: {
              gameId: game.gameId || game.id,
              playerId: myPlayer.id,
              hole: hole,
              action: 'reject'
            },
            success: (res) => {
              wx.hideLoading()
              if (res.result && res.result.success) {
                wx.showToast({ title: '已拒绝', icon: 'success' })
                // 从待确认列表移除
                const pendingConfirmations = this.data.pendingConfirmations.filter(p => p.hole !== hole)
                this.setData({
                  pendingConfirmations,
                  pendingCount: pendingConfirmations.length,
                  showPendingModal: pendingConfirmations.length > 0
                })
              } else {
                wx.showToast({ title: res.result?.error || '拒绝失败', icon: 'none' })
              }
            },
            fail: (err) => {
              wx.hideLoading()
              console.error('拒绝成绩失败:', err)
              wx.showToast({ title: '拒绝失败', icon: 'none' })
            }
          })
        }
      }
    })
  },

  // 拦截左上角返回按钮，直接返回首页
  onBackPress() {
    wx.switchTab({ url: '/pages/index/index' })
    return true
  }
})
