const app = getApp()
const analysisReport = require('../../../utils/analysis-report.js')
const posterGenerator = require('../../../utils/poster-generator.js')
const gameCompleteness = require('../../../utils/game-completeness.js')
const DEFAULT_POSTER_STYLE = 'pro'
const DEFAULT_POSTER_BG = 'night'

Page({
  data: {
    game: null,
    currentPlayer: null, // 当前选中的球员（默认是当前用户）
    report: {
      summary: {},
      highlights: [],
      weaknesses: [],
      comparisons: {},
      suggestions: []
    },
    oneLineSummary: '',
    ratingScore: 0,
    ratingLabel: '',
    showPosterPreview: false,
    posterImageUrl: '',
    showPlayerSelector: false, // 球员选择弹窗
    currentPlayerSummary: null,
    reportPlayerOptions: [],
    reportQrcodeUrl: '',
    shareText: '',
    hasAdvancedStats: false, // 是否有高级数据
    advancedStats: null // 高级统计数据
  },

  onLoad(options) {
    console.log('【report】onLoad, options:', options)
    this.pageOptions = options || {}

    this.enableTimelineShare()

    // 保存gameId到data供后续使用
    this.gameId = options?.gameId
    console.log('【report】保存的gameId:', this.gameId)

    // 先尝试直接加载
    this.loadFromStorage()

    // 同时也监听事件频道
    const eventChannel = this.getOpenerEventChannel()
    if (eventChannel && eventChannel.on) {
      eventChannel.on('reportData', (data) => {
        console.log('【report】eventChannel收到数据:', data)
        if (data && data.game) {
          this.applyReportGame(data.game, data.report, data.posterUrl || '', data.reportQrcodeUrl || '')

          if (data.autoShowPoster && data.posterUrl) {
            this.setData({ showPosterPreview: true })
          }
        }
      })
    }
  },

  enableTimelineShare() {
    if (!wx.showShareMenu) return
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  onShow() {
    console.log('【report】onShow, 当前game:', this.data.game)

    // 如果页面显示时还没有数据，再次尝试加载
    if (!this.data.game) {
      console.log('【report】onShow时无数据，重新加载')
      this.loadFromStorage()
    }

    // 设置TabBar选中状态 - 保持首页选中
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
  },

  loadFromStorage() {
    const gameId = this.gameId
    console.log('【report】loadFromStorage, gameId:', gameId)

    let game = null
    const historyGames = wx.getStorageSync('games') || []
    console.log('【report】historyGames数量:', historyGames.length)

    if (gameId) {
      // 优先从 storage 获取指定ID的完整比赛数据
      game = wx.getStorageSync('game_' + gameId)
      console.log('【report】从game_获取:', game ? '成功' : '失败')
      if (!game) {
        // 如果没有完整数据，从历史列表获取
        game = historyGames.find(g => g.id === gameId)
        console.log('【report】从games列表获取:', game ? '成功' : '失败')
      }
    }

    // 如果没有指定ID或没找到，使用当前比赛
    if (!game) {
      game = wx.getStorageSync('currentGame')
      console.log('【report】使用currentGame:', game ? '成功' : '失败')
    }

    if (game) {
      this.applyReportGame(game)
    } else {
      console.log('【report】警告：未找到任何比赛数据')
      this.loadReportFromCloud(gameId)
    }
  },

  loadReportFromCloud(gameId) {
    if (!gameId || !wx.cloud) return

    wx.cloud.callFunction({
      name: 'gameAction',
      data: {
        action: 'get',
        gameId: gameId
      },
      success: (res) => {
        const result = res && res.result ? res.result : {}
        if (!result.success || !result.game) {
          wx.showToast({ title: result.error || '未找到比赛数据', icon: 'none' })
          return
        }
        wx.setStorageSync('game_' + gameId, result.game)
        this.applyReportGame(result.game)
      },
      fail: (err) => {
        console.error('加载云端报告失败:', err)
        wx.showToast({ title: '加载报告失败', icon: 'none' })
      }
    })
  },

  applyReportGame(game, prebuiltReport, posterUrl, reportQrcodeUrl) {
    if (!game) return

    console.log('【report】加载到game数据，players:', game.players?.length)
    const targetPlayerId = this.pageOptions && this.pageOptions.playerId
    const currentPlayer = (targetPlayerId && game.players?.find(p => p.id === targetPlayerId)) ||
      game.players?.find(p => p.isMe) ||
      game.players?.[0] ||
      null
    console.log('【report】当前球员:', currentPlayer?.name)

    if (!currentPlayer || !gameCompleteness.isPlayerRoundComplete(game, currentPlayer.id)) {
      this.handleIncompleteReport()
      return
    }

    const analyzableHistory = gameCompleteness.filterAnalyzableGames(wx.getStorageSync('games') || [])
    const report = prebuiltReport || analysisReport.generateGameReport(game, analyzableHistory, currentPlayer)
    const oneLineSummary = analysisReport.generateOneLineSummary(game, currentPlayer)
    const currentPlayerSummary = this.buildPlayerSummary(game, currentPlayer)

    this.setData({
      game: game,
      currentPlayer: currentPlayer,
      currentPlayerSummary: currentPlayerSummary,
      reportPlayerOptions: this.buildReportPlayerOptions(game),
      report: report,
      oneLineSummary: oneLineSummary,
      posterImageUrl: posterUrl || this.data.posterImageUrl || '',
      reportQrcodeUrl: reportQrcodeUrl || this.data.reportQrcodeUrl || '',
      shareText: this.buildShareText(game, currentPlayer, currentPlayerSummary)
    }, () => {
      console.log('【report】数据设置完成:', this.data.game ? '有game' : '无game', 'report:', this.data.report ? '有' : '无')
    })
    this.calculateRating()
  },

  handleIncompleteReport() {
    wx.showModal({
      title: '暂不能复盘',
      content: '复盘和数据分析只统计18洞完整成绩。请先补齐本场18洞记录，未打满的球员不会计入有效成绩。',
      showCancel: false,
      confirmText: '知道了',
      success: () => {
        wx.navigateBack({
          fail: () => {
            wx.switchTab({ url: '/pages/index/index' })
          }
        })
      }
    })
  },

  // 显示球员选择器
  showPlayerSelector() {
    this.setData({ showPlayerSelector: true })
  },

  // 隐藏球员选择器
  hidePlayerSelector() {
    this.setData({ showPlayerSelector: false })
  },

  // 选择球员
  selectPlayer(e) {
    const playerId = e.currentTarget.dataset.playerId
    const { game } = this.data
    if (!game) return

    const player = game.players.find(p => p.id === playerId)
    if (!player) return
    if (!gameCompleteness.isPlayerRoundComplete(game, player.id)) {
      wx.showToast({ title: '该球员未完成18洞', icon: 'none' })
      return
    }

    const historyGames = gameCompleteness.filterAnalyzableGames(wx.getStorageSync('games') || [])
    const report = analysisReport.generateGameReport(game, historyGames, player)

    this.setData({
      currentPlayer: player,
      currentPlayerSummary: this.buildPlayerSummary(game, player),
      report: report,
      oneLineSummary: analysisReport.generateOneLineSummary(game, player),
      shareText: this.buildShareText(game, player, this.buildPlayerSummary(game, player)),
      showPlayerSelector: false
    })
    this.calculateRating()
  },

  buildPlayerSummary(game, player) {
    if (!game || !player) {
      return { total: '-', toPar: '-', toParClass: '', toParText: '-' }
    }
    const stats = game.statistics && game.statistics[player.id]
    const total = stats && stats.totalScore > 0 ? stats.totalScore : this.calculatePlayerTotal(game, player.id)
    const toPar = stats && stats.toPar !== undefined ? stats.toPar : this.calculatePlayerToPar(game, player.id)
    return {
      total: total > 0 ? total : '-',
      toPar: toPar,
      toParClass: toPar < 0 ? 'under' : toPar > 0 ? 'over' : '',
      toParText: total > 0 ? (toPar === 0 ? 'E' : (toPar > 0 ? '+' : '') + toPar) : '-'
    }
  },

  buildReportPlayerOptions(game) {
    if (!game || !Array.isArray(game.players)) return []
    return game.players.map(player => {
      const summary = this.buildPlayerSummary(game, player)
      return {
        ...player,
        totalDisplay: summary.total,
        toParText: summary.toParText,
        toParClass: summary.toParClass,
        validRound: gameCompleteness.isPlayerRoundComplete(game, player.id)
      }
    })
  },

  calculatePlayerTotal(game, playerId) {
    const scores = game && game.scores && game.scores[playerId]
    if (!scores) return 0
    return Object.values(scores).reduce((sum, score) => {
      return sum + gameCompleteness.getStrokesValue(score)
    }, 0)
  },

  calculatePlayerToPar(game, playerId) {
    const scores = game && game.scores && game.scores[playerId]
    const holes = game && Array.isArray(game.holes) ? game.holes : []
    if (!scores || holes.length === 0) return 0
    return holes.reduce((sum, hole) => {
      const strokes = gameCompleteness.getStrokesValue(scores[hole.hole])
      if (strokes <= 0) return sum
      return sum + strokes - (hole.par || 4)
    }, 0)
  },

  calculateRating() {
    const { game, report, currentPlayer } = this.data
    if (!game || !report || !report.summary) return

    // 获取当前球员的杆差
    let toPar = 0
    if (currentPlayer && currentPlayer.toPar !== undefined) {
      toPar = currentPlayer.toPar
    } else if (report.summary.toPar !== undefined) {
      toPar = report.summary.toPar
    }

    let score = 70
    let label = '良好'

    if (toPar <= -10) {
      score = 95
      label = '传奇'
    } else if (toPar <= -5) {
      score = 90
      label = '卓越'
    } else if (toPar <= -2) {
      score = 85
      label = '优秀'
    } else if (toPar <= 2) {
      score = 80
      label = '良好'
    } else if (toPar <= 5) {
      score = 70
      label = '一般'
    } else if (toPar <= 10) {
      score = 60
      label = '待提升'
    } else {
      score = 50
      label = '需努力'
    }

    this.setData({
      ratingScore: score,
      ratingLabel: label
    })

    // 计算高级数据统计
    this.calculateAdvancedStats()
  },

  // 计算高级数据统计
  calculateAdvancedStats() {
    const { game, currentPlayer } = this.data
    if (!game || !currentPlayer) return

    const playerId = currentPlayer.id
    const putts = game.putts?.[playerId] || {}
    const fairways = game.fairways?.[playerId] || {}
    const penalties = game.penalties?.[playerId] || {}
    const scores = game.scores?.[playerId] || {}
    const holes = game.course?.holes || []

    const totalHoles = Object.keys(scores).length
    if (totalHoles === 0) {
      this.setData({ hasAdvancedStats: false })
      return
    }

    // 计算平均推杆
    let totalPutts = 0
    let puttCount = 0
    Object.values(putts).forEach(p => {
      if (p) {
        totalPutts += parseInt(p) || 0
        puttCount++
      }
    })
    const avgPutts = puttCount > 0 ? (totalPutts / puttCount).toFixed(1) : 0

    // 计算上球道率（只对Par4和Par5洞）
    let fairwayAttempts = 0
    let fairwayHits = 0
    Object.entries(fairways).forEach(([hole, hit]) => {
      const holeData = holes.find(h => h.hole === parseInt(hole))
      if (holeData && holeData.par > 3) {
        fairwayAttempts++
        if (hit) fairwayHits++
      }
    })
    const fairwayRate = fairwayAttempts > 0 ? Math.round((fairwayHits / fairwayAttempts) * 100) : -1

    // 计算总罚杆
    let totalPenalties = 0
    Object.values(penalties).forEach(p => {
      if (p) {
        totalPenalties += (p.ob || 0) + (p.water || 0) + (p.other || 0)
      }
    })

    // 计算小鸟球率
    let birdies = 0
    let validHoles = 0
    Object.entries(scores).forEach(([hole, score]) => {
      const holeData = holes.find(h => h.hole === parseInt(hole))
      if (holeData && score) {
        validHoles++
        if (score < holeData.par) birdies++
      }
    })
    const birdieRate = validHoles > 0 ? Math.round((birdies / validHoles) * 100) : -1

    // 生成评论
    const puttsComment = avgPutts <= 1.8 ? '推杆出色！' : avgPutts <= 2.2 ? '推杆稳定' : '需要加强推杆练习'
    const fairwayComment = fairwayRate >= 60 ? '开球精准！' : fairwayRate >= 40 ? '开球尚可' : '需要改进开球方向'
    const penaltyComment = totalPenalties === 0 ? '没有罚杆，表现出色！' : totalPenalties <= 3 ? '罚杆控制不错' : '注意避免罚杆'
    const birdieComment = birdieRate >= 20 ? '抓鸟能力出色！' : birdieRate >= 10 ? '有一定得分能力' : '多练习进攻果岭'

    const hasAdvancedStats = puttCount > 0 || fairwayAttempts > 0 || totalPenalties > 0 || birdies > 0

    this.setData({
      hasAdvancedStats,
      advancedStats: {
        avgPutts,
        fairwayRate,
        totalPenalties,
        birdieRate,
        puttsComment,
        fairwayComment,
        penaltyComment,
        birdieComment
      }
    })
  },

  // 显示海报样式选择
  showPosterOptions() {
    this.generatePoster()
  },

  // 生成海报
  async generatePoster() {
    const { game, currentPlayer } = this.data
    if (!game) {
      wx.showToast({ title: '暂无比赛数据', icon: 'none' })
      return
    }

    // 确保有选中的球员
    const player = currentPlayer || game.players?.find(p => p.isMe) || game.players?.[0]
    if (!player) {
      wx.showToast({ title: '请选择球员', icon: 'none' })
      return
    }
    if (!gameCompleteness.isPlayerRoundComplete(game, player.id)) {
      wx.showToast({ title: '完成18洞后可生成海报', icon: 'none' })
      return
    }

    wx.showLoading({ title: '生成中...' })

    try {
      const qrcodeUrl = await this.ensureReportQrCode(game)
      const posterUrl = await posterGenerator.generatePoster({
        type: DEFAULT_POSTER_STYLE,
        game,
        player,
        bgType: DEFAULT_POSTER_BG,
        qrcodeUrl: qrcodeUrl,
        context: this
      })

      this.setData({
        posterImageUrl: posterUrl,
        showPosterPreview: true,
        reportQrcodeUrl: qrcodeUrl,
        shareText: this.buildShareText(game, player, this.buildPlayerSummary(game, player))
      })

      wx.hideLoading()
    } catch (err) {
      console.error('生成海报失败:', err)
      wx.hideLoading()
      wx.showToast({ title: '生成失败', icon: 'none' })
    }
  },

  ensureReportQrCode(game) {
    const gameId = this.getShareGameId(game)
    if (!gameId || !wx.cloud) return Promise.resolve('')
    if (this.data.reportQrcodeUrl) return Promise.resolve(this.data.reportQrcodeUrl)

    return new Promise((resolve) => {
      wx.cloud.callFunction({
        name: 'gameAction',
        data: {
          action: 'getReportQrCode',
          gameId: gameId
        },
        success: (res) => {
          const result = res && res.result ? res.result : {}
          if (result.success && result.qrcodeUrl) {
            resolve(result.qrcodeUrl)
            return
          }
          console.warn('生成成绩回看码失败:', result.error)
          resolve('')
        },
        fail: (err) => {
          console.warn('生成成绩回看码异常:', err)
          resolve('')
        }
      })
    })
  },

  getShareGameId(game) {
    return (game && (game.gameId || game.id || game._id)) || this.gameId || ''
  },

  hidePosterPreview() {
    this.setData({ showPosterPreview: false })
  },

  // 返回主页
  goBackHome() {
    this.setData({ showPosterPreview: false })
    wx.switchTab({
      url: '/pages/index/index'
    })
  },

  // 重新生成海报（回到选择界面）
  regeneratePoster() {
    this.setData({
      showPosterPreview: false,
      posterImageUrl: ''
    })
    this.generatePoster()
  },

  // 显示海报预览
  showPosterPreview() {
    if (this.data.posterImageUrl) {
      this.setData({ showPosterPreview: true })
    } else {
      this.generatePoster()
    }
  },

  // 预览海报大图
  previewPosterImage() {
    const { posterImageUrl } = this.data
    if (posterImageUrl) {
      wx.previewImage({
        urls: [posterImageUrl],
        current: posterImageUrl
      })
    }
  },

  // 保存海报到相册
  savePoster() {
    const { posterImageUrl } = this.data
    if (!posterImageUrl) return

    wx.saveImageToPhotosAlbum({
      filePath: posterImageUrl,
      success: () => {
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      },
      fail: (err) => {
        if (err.errMsg.includes('auth') || err.errMsg.includes('deny')) {
          wx.showModal({
            title: '需要授权',
            content: '请授权保存图片到相册',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting()
              }
            }
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    })
  },

  copyShareText() {
    const text = this.data.shareText || this.buildShareText(this.data.game, this.data.currentPlayer, this.data.currentPlayerSummary)
    if (!text) return
    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '战报已复制', icon: 'success' })
      }
    })
  },

  buildShareText(game, player, summary) {
    if (!game || !player) return ''
    const total = summary && summary.total ? summary.total : this.buildPlayerSummary(game, player).total
    const toParText = summary && summary.toParText ? summary.toParText : this.buildPlayerSummary(game, player).toParText
    const courseName = game.courseName || '高尔夫球场'
    return `${player.name || '我'}在${courseName}完成18洞，成绩${total}杆 ${toParText}。用 WinPAR 记录本场战报。`
  },

  buildShareTitle() {
    return this.data.shareText || this.buildShareText(this.data.game, this.data.currentPlayer, this.data.currentPlayerSummary) || 'WinPAR 高尔夫成绩战报'
  },

  onShareAppMessage() {
    const gameId = this.getShareGameId(this.data.game)
    const playerId = this.data.currentPlayer ? this.data.currentPlayer.id : ''
    return {
      title: this.buildShareTitle(),
      path: `/package-game/pages/game-report/game-report?gameId=${encodeURIComponent(gameId)}&playerId=${encodeURIComponent(playerId)}&readonly=1`,
      imageUrl: this.data.posterImageUrl || ''
    }
  },

  onShareTimeline() {
    const gameId = this.getShareGameId(this.data.game)
    const playerId = this.data.currentPlayer ? this.data.currentPlayer.id : ''
    return {
      title: this.buildShareTitle(),
      query: `gameId=${encodeURIComponent(gameId)}&playerId=${encodeURIComponent(playerId)}&readonly=1`,
      imageUrl: this.data.posterImageUrl || ''
    }
  },

  preventHide() {
    // 阻止冒泡
  },

  // 拦截左上角返回按钮，直接返回首页
  onBackPress() {
    this.goBack()
    // 返回 true 拦截默认返回行为
    return true
  },

  // 返回上一页
  goBack() {
    // 直接返回首页
    wx.switchTab({ url: '/pages/index/index' })
  }
})
