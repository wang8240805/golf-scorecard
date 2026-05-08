Page({
  data: {
    hasData: false,
    totalStats: {},
    scoreDistribution: {}
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '技术统计' })
    this.calculateStatistics()
  },

  onShow() {
    this.calculateStatistics()
  },

  calculateStatistics() {
    const games = wx.getStorageSync('games') || []
    // 只统计已完成且打满18洞的比赛
    const completedGames = games.filter(g => {
      if (!g.completed) return false

      // 检查当前用户是否完成全部18洞
      const player = g.players?.find(p => p.isMe) || g.players?.[0]
      if (!player) return false

      // 新格式：player.scores数组
      if (player.scores && Array.isArray(player.scores)) {
        const validScores = player.scores.filter(s => s.strokes > 0)
        return validScores.length >= 18
      }
      // 旧格式：game.scores对象
      else if (g.scores && g.scores[player.id]) {
        const scores = g.scores[player.id]
        const validCount = Object.values(scores).filter(v => v > 0).length
        return validCount >= 18
      }
      // 兼容有statistics字段的情况
      else if (g.statistics && g.statistics[player.id]) {
        return g.statistics[player.id].holesPlayed >= 18
      }

      return false
    })

    if (completedGames.length < 1) {
      this.setData({ hasData: false })
      return
    }

    // 1. 计算总体统计
    const totalStats = this.calculateTotalStats(completedGames)

    // 2. 计算成绩分布
    const scoreDistribution = this.calculateScoreDistribution(completedGames)

    this.setData({
      hasData: true,
      totalStats,
      scoreDistribution
    })
  },

  // 计算总体统计
  calculateTotalStats(games) {
    let totalHoles = 0
    let totalScore = 0
    let totalToPar = 0
    let bestScore = Infinity
    let bestScoreToPar = 0

    games.forEach(game => {
      const playerId = this.getCurrentPlayerId(game)
      if (!playerId) return

      const stats = game.statistics?.[playerId]
      if (!stats) return

      totalHoles += stats.holesPlayed || 18
      totalScore += stats.totalScore
      totalToPar += stats.toPar
      if (stats.totalScore < bestScore) {
        bestScore = stats.totalScore
        bestScoreToPar = stats.toPar
      }
    })

    const rounds = games.length
    const avgScore = rounds > 0 ? (totalScore / rounds).toFixed(1) : '-'
    const avgToPar = rounds > 0 ? (totalToPar / rounds).toFixed(1) : '-'

    // 平均分颜色
    let avgScoreClass = 'over'
    if (parseFloat(avgScore) <= 72) avgScoreClass = 'under'
    else if (parseFloat(avgScore) <= 80) avgScoreClass = 'par'

    let avgToParClass = 'over'
    if (parseFloat(avgToPar) <= 0) avgToParClass = 'under'
    else if (parseFloat(avgToPar) <= 8) avgToParClass = 'par'

    return {
      games: games.length,
      rounds: rounds,
      holes: totalHoles,
      avgScore,
      avgScoreClass,
      avgToPar: parseFloat(avgToPar) > 0 ? `+${avgToPar}` : avgToPar,
      avgToParClass,
      bestScore: bestScore === Infinity ? '-' : bestScore,
      bestScoreToPar
    }
  },

  // 计算成绩分布
  calculateScoreDistribution(games) {
    let eagles = 0
    let birdies = 0
    let pars = 0
    let bogeys = 0
    let doubleBogeys = 0
    let others = 0
    let totalHoles = 0

    games.forEach(game => {
      const playerId = this.getCurrentPlayerId(game)
      if (!playerId || !game.scores || !game.scores[playerId]) return

      const scores = game.scores[playerId]
      // 简化逻辑：默认par为4，不依赖球场数据
      Object.values(scores).forEach(score => {
        if (!score) return

        totalHoles++
        const diff = score - 4 // 默认标准杆为4

        if (diff <= -2) eagles++
        else if (diff === -1) birdies++
        else if (diff === 0) pars++
        else if (diff === 1) bogeys++
        else if (diff === 2) doubleBogeys++
        else others++
      })
    })

    const total = totalHoles || 1
    // 精确计算百分比，确保总和为100%
    const eaglePct = (eagles / total) * 100
    const birdiePct = (birdies / total) * 100
    const parPct = (pars / total) * 100
    const bogeyPct = (bogeys / total) * 100
    const doublePct = ((doubleBogeys + others) / total) * 100

    // 修正四舍五入误差，调整最大项
    const pcts = [eaglePct, birdiePct, parPct, bogeyPct, doublePct]
    const sum = pcts.reduce((a, b) => a + b, 0)
    const diff = 100 - sum
    const maxIndex = pcts.indexOf(Math.max(...pcts))
    pcts[maxIndex] += diff

    return {
      eagles,
      birdies,
      pars,
      bogeys,
      doubleBogeys,
      others,
      eaglePct: parseFloat(pcts[0].toFixed(1)),
      birdiePct: parseFloat(pcts[1].toFixed(1)),
      parPct: parseFloat(pcts[2].toFixed(1)),
      bogeyPct: parseFloat(pcts[3].toFixed(1)),
      doublePct: parseFloat(pcts[4].toFixed(1))
    }
  },

  // 获取当前玩家ID（取第一个玩家作为"我"）
  getCurrentPlayerId(game) {
    if (!game.players || game.players.length === 0) return null
    // 默认取第一个玩家作为当前用户，后续可以优化为用户选择
    return game.players[0].id
  }
})
