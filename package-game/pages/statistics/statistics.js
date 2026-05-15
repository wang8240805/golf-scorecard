const gameCompleteness = require('../../../utils/game-completeness.js')

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

  startNewGame() {
    wx.navigateTo({
      url: '/package-courses/pages/new-game/step1-course/step1-course'
    })
  },

  calculateStatistics() {
    const games = wx.getStorageSync('games') || []
    // 只统计当前用户18洞完整有效成绩
    const completedGames = games.filter(g => {
      const player = gameCompleteness.getPlayer(g)
      return player && gameCompleteness.isPlayerRoundComplete(g, player.id)
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

      const summary = this.getGamePlayerSummary(game, playerId)
      if (!summary || summary.holesPlayed <= 0) return

      totalHoles += summary.holesPlayed
      totalScore += summary.totalScore
      totalToPar += summary.toPar
      if (summary.totalScore < bestScore) {
        bestScore = summary.totalScore
        bestScoreToPar = summary.toPar
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
      if (!playerId || !game.scores || !game.scores[playerId] || !Array.isArray(game.holes)) return

      const scores = game.scores[playerId]
      game.holes.forEach(hole => {
        if (!hole || !hole.hole || !hole.par) return
        const strokes = this.getStrokesValue(scores[hole.hole])
        if (strokes <= 0) return

        totalHoles++
        const diff = strokes - hole.par

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
    const player = gameCompleteness.getPlayer(game)
    return player ? player.id : null
  },

  getStrokesValue(score) {
    return gameCompleteness.getStrokesValue(score)
  },

  getGamePlayerSummary(game, playerId) {
    if (!game || !playerId) return null

    if (game.statistics && game.statistics[playerId]) {
      const stats = game.statistics[playerId]
      return {
        holesPlayed: stats.holesPlayed || 0,
        totalScore: stats.totalScore || 0,
        toPar: stats.toPar || 0
      }
    }

    if (!Array.isArray(game.holes) || !game.scores || !game.scores[playerId]) {
      return null
    }

    let holesPlayed = 0
    let totalScore = 0
    let toPar = 0
    const scores = game.scores[playerId]
    game.holes.forEach(hole => {
      if (!hole || !hole.hole || !hole.par) return
      const strokes = this.getStrokesValue(scores[hole.hole])
      if (strokes > 0) {
        holesPlayed++
        totalScore += strokes
        toPar += (strokes - hole.par)
      }
    })

    return {
      holesPlayed,
      totalScore,
      toPar
    }
  }
})
