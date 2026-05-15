const gameCompleteness = require('../../../utils/game-completeness.js')

Page({
  data: {
    games: [],
    courses: [],
    totalPlayers: 0,
    avgScore: null,
    bestScore: null,
    hasMore: false,
    pageSize: 10,
    currentPage: 1
  },

  onLoad() {
    this.loadData()

    // 监听全局游戏数据变化，云端更新自动刷新
    const app = getApp()
    this.gameDataChangeCallback = () => {
      this.loadData()
    }
    app.eventBus.on('gameDataChanged', this.gameDataChangeCallback)
  },

  onShow() {
    this.loadData()
    // 历史页面不在TabBar中，无需设置选中状态
  },

  onUnload() {
    // 移除事件监听
    if (this.gameDataChangeCallback) {
      const app = getApp()
      app.eventBus.off('gameDataChanged', this.gameDataChangeCallback)
    }
  },

  startNewGame() {
    wx.navigateTo({
      url: '/package-courses/pages/new-game/step1-course/step1-course'
    })
  },

  loadData() {
    const courses = wx.getStorageSync('courses') || []
    const currentGame = wx.getStorageSync('currentGame')
    let games = wx.getStorageSync('games') || []

    // 合并进行中的比赛
    if (currentGame) {
      games = [...games, currentGame]
    }

    // 反转顺序，最新的在前
    games = games.reverse()

    // 格式化数据
    const formattedGames = this.formatGames(games)

    this.setData({
      courses,
      games: formattedGames,
      hasMore: games.length > this.data.pageSize
    })

    this.calculateOverview(gameCompleteness.filterAnalyzableGames(games))
  },

  formatGames(games) {
    return games.slice(0, this.data.pageSize).map(game => {
      // 兼容老数据：使用 timestamp，如果没有则使用 endTime，如果都没有使用当前时间
      const timestamp = game.timestamp || game.endTime || Date.now()
      let date = new Date(timestamp)
      // 防御性检查：如果日期无效，使用当前日期
      if (isNaN(date.getTime())) {
        date = new Date()
      }
      const playerResults = this.calculatePlayerResults(game)
      const stats = this.aggregateStats(game)
      const summary = this.buildGameSummary(game)

      return {
        ...game,
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        playerResults,
        stats,
        myScore: summary.myScore,
        holesPlayed: summary.holesPlayed,
        holesTotal: summary.holesTotal,
        toParText: summary.toParText,
        toParClass: summary.toParClass,
        isCompleted: summary.isCompleted,
        statusText: summary.statusText,
        statusClass: summary.statusClass,
        incompleteTip: summary.incompleteTip,
        expanded: false
      }
    })
  },

  buildGameSummary(game) {
    const player = gameCompleteness.getPlayer(game)
    const holes = Array.isArray(game.holes) && game.holes.length > 0 ? game.holes : []
    const holeParMap = {}
    holes.forEach(function(hole) {
      if (hole && hole.hole) {
        holeParMap[Number(hole.hole)] = Number(hole.par) || 4
      }
    })

    let totalScore = 0
    let holesPlayed = 0
    let playedPar = 0

    if (player && game.statistics && game.statistics[player.id] && game.statistics[player.id].totalScore > 0) {
      const stat = game.statistics[player.id]
      totalScore = stat.totalScore || 0
      holesPlayed = stat.holesPlayed || 0
      playedPar = stat.totalPar || 0
    } else if (player && game.scores && game.scores[player.id]) {
      const scores = game.scores[player.id]
      Object.keys(scores).forEach(function(holeKey) {
        const strokes = gameCompleteness.getStrokesValue(scores[holeKey])
        if (strokes <= 0) return
        const holeNum = Number(holeKey)
        totalScore += strokes
        holesPlayed++
        playedPar += holeParMap[holeNum] || 4
      })
    }

    const isCompleted = gameCompleteness.isCompletedGame(game)
    const holesTotal = holes.length || 18
    const toParValue = holesPlayed > 0 ? totalScore - playedPar : 0
    const toParText = holesPlayed > 0
      ? (toParValue === 0 ? 'E' : (toParValue > 0 ? '+' : '') + toParValue)
      : '-'

    return {
      myScore: totalScore > 0 ? totalScore : '-',
      holesPlayed: holesPlayed,
      holesTotal: holesTotal,
      toParText: toParText,
      toParClass: holesPlayed > 0
        ? (toParValue < 0 ? 'under' : (toParValue > 0 ? 'over' : 'even'))
        : 'empty',
      isCompleted: isCompleted,
      statusText: isCompleted ? '已完成' : '未完成',
      statusClass: isCompleted ? 'completed' : 'incomplete',
      incompleteTip: isCompleted ? '' : '比赛未完成，可继续录入'
    }
  },

  calculatePlayerResults(game) {
    if (!game.statistics) return []

    return game.players.map(player => {
      if (!gameCompleteness.isPlayerRoundComplete(game, player.id)) {
        return null
      }
      const stats = game.statistics[player.id]
      const total = stats?.totalScore || 0
      const toPar = stats?.toPar || 0

      return {
        playerId: player.id,
        name: player.name,
        color: player.color,
        total,
        toPar,
        toParDisplay: toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : toPar.toString(),
        toParClass: toPar < 0 ? 'under' : toPar > 0 ? 'over' : ''
      }
    }).filter(Boolean).sort((a, b) => a.total - b.total)
  },

  aggregateStats(game) {
    const stats = { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0 }

    if (!game.statistics) return stats

    const validIds = gameCompleteness.getValidScorePlayerIds(game)
    Object.keys(game.statistics).forEach(playerId => {
      if (validIds.indexOf(playerId) < 0) return
      const playerStats = game.statistics[playerId]
      stats.eagles += playerStats.eagles || 0
      stats.birdies += playerStats.birdies || 0
      stats.pars += playerStats.pars || 0
      stats.bogeys += playerStats.bogeys || 0
      stats.doubles += (playerStats.doubleBogeys || 0) + (playerStats.others || 0)
    })

    return stats
  },

  calculateOverview(completedGames) {
    if (completedGames.length === 0) return

    // 统计球员数
    const allPlayers = new Set()
    let totalScores = 0
    let scoreCount = 0
    let bestScore = Infinity

    completedGames.forEach(game => {
      game.players.forEach(p => allPlayers.add(p.id))

      if (game.statistics) {
        const validIds = gameCompleteness.getValidScorePlayerIds(game)
        validIds.forEach(function(playerId) {
          const stats = game.statistics[playerId]
          if (stats.totalScore) {
            totalScores += stats.totalScore
            scoreCount++
            bestScore = Math.min(bestScore, stats.totalScore)
          }
        })
      }
    })

    this.setData({
      totalPlayers: allPlayers.size,
      avgScore: scoreCount > 0 ? Math.round(totalScores / scoreCount) : null,
      bestScore: bestScore === Infinity ? null : bestScore
    })
  },

  toggleExpand(e) {
    const index = e.currentTarget.dataset.index
    const games = this.data.games
    games[index].expanded = !games[index].expanded
    this.setData({ games })
  },

  continueGame(e) {
    const game = e.currentTarget.dataset.game
    wx.setStorageSync('currentGame', game)
    wx.switchTab({
      url: '/pages/scorecard/scorecard'
    })
  },

  viewDetail(e) {
    const game = e.currentTarget.dataset.game
    // 可以导航到详情页面
    wx.showModal({
      title: game.courseName,
      content: `比赛时间：${game.date}\n\n球员成绩：\n${game.playerResults.map(p =>
        `${p.name}: ${p.total}杆 (${p.toParDisplay})`
      ).join('\n')}`,
      showCancel: false
    })
  },

  deleteGame(e) {
    const game = e.currentTarget.dataset.game

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这场比赛记录吗？此操作不可恢复。',
      confirmColor: '#f44336',
      success: (res) => {
        if (res.confirm) {
          // 删历史记录
          let games = wx.getStorageSync('games') || []
          games = games.filter(g => g.id !== game.id)
          wx.setStorageSync('games', games)

          // 如果删除的是当前进行中的比赛，也清除
          const currentGame = wx.getStorageSync('currentGame')
          if (currentGame && currentGame.id === game.id) {
            wx.removeStorageSync('currentGame')
          }

          // 同步删除到云端：标记 deleted = true
          if (wx.cloud && game._id) {
            const db = wx.cloud.database()
            // 只更新 deleted 标记
            db.collection('games').doc(game._id).update({
              data: { deleted: true },
              success: () => {
                console.log('【云端删除】标记成功:', game._id)
              },
              fail: err => {
                console.error('【云端删除】标记失败:', err)
              }
            })
          }

          wx.showToast({ title: '已删除', icon: 'success' })
          this.loadData()
        }
      }
    })
  },

  loadMore() {
    const currentPage = this.data.currentPage + 1
    const allGames = wx.getStorageSync('games') || []
    const currentGame = wx.getStorageSync('currentGame')

    let games = [...allGames]
    if (currentGame) {
      games.push(currentGame)
    }
    games = games.reverse()

    const start = this.data.pageSize * (currentPage - 1)
    const end = start + this.data.pageSize
    const moreGames = games.slice(start, end)

    if (moreGames.length === 0) {
      this.setData({ hasMore: false })
      return
    }

    const formattedGames = this.formatGames(games.slice(0, end))

    this.setData({
      games: formattedGames,
      currentPage,
      hasMore: games.length > end
    })
  }
})
