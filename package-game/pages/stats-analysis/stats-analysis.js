const gameCompleteness = require('../../../utils/game-completeness.js')

Page({
  data: {
    unlocks: {
      overview: { required: 1, unlocked: false },
      trend: { required: 3, unlocked: false },
      shortGame: { required: 5, unlocked: false },
      driving: { required: 8, unlocked: false },
      handicap: { required: 10, unlocked: false }
    },
    stats: {
      totalGames: 0,
      avgScore: '-',
      bestScore: '-',
      handicap: '-',
      distribution: {
        eagles: 0, eaglePct: 0,
        birdies: 0, birdiePct: 0,
        pars: 0, parPct: 0,
        bogeys: 0, bogeyPct: 0,
        doubles: 0, doublePct: 0
      },
      shortGame: {
        puttsPerHole: '-',
        puttsProgress: 0,
        girPct: '-',
        scramblePct: '-',
        sandSaves: '-'
      },
      driving: {
        firPct: '-'
      },
      recentTrend: [],
      suggestions: []
    }
  },

  onLoad() {
    this.loadStats()
  },

  onShow() {
    this.loadStats()
  },

  loadStats() {
    const allGames = wx.getStorageSync('games') || []
    const games = gameCompleteness.filterUserCompletedGames(allGames)
    if (games.length === 0) {
      this.setData({
        unlocks: this.buildUnlocks(0),
        stats: {
          totalGames: 0,
          avgScore: '-',
          bestScore: '-',
          handicap: '-',
          distribution: { eagles: 0, eaglePct: 0, birdies: 0, birdiePct: 0, pars: 0, parPct: 0, bogeys: 0, bogeyPct: 0, doubles: 0, doublePct: 0 },
          shortGame: { puttsPerHole: '-', puttsProgress: 0, girPct: '-', scramblePct: '-', sandSaves: '-' },
          driving: { firPct: '-' },
          recentTrend: [],
          suggestions: []
        }
      })
      return
    }

    // 计算基础统计
    let totalScore = 0
    let totalHoles = 0
    let scores = []
    let totalToPar = 0

    // 成绩分布统计
    let distribution = { eagles: 0, birdies: 0, pars: 0, bogeys: 0, doubles: 0, others: 0 }

    // 短杆统计
    let totalPutts = 0
    let totalGIR = 0  // 标准杆上果岭
    let totalScramble = 0  // 救球成功
    let totalScrambleOpp = 0  // 救球机会
    let totalSandSaves = 0
    let totalSandOpp = 0

    games.forEach(game => {
      const player = gameCompleteness.getPlayer(game)
      if (!player || !player.id) {
        return
      }
      const playerScores = game.scores?.[player.id] || {}
      const playerPutts = game.putts?.[player.id] || {}

      // 计算总杆数
      let gameTotalScore = 0
      if (game.statistics && game.statistics[player.id] && game.statistics[player.id].totalScore > 0) {
        gameTotalScore = game.statistics[player.id].totalScore
      } else {
        gameTotalScore = Object.values(playerScores).reduce((sum, s) => {
          const strokes = this.getStrokesValue(s)
          return sum + (strokes > 0 ? strokes : 0)
        }, 0)
      }
      if (gameTotalScore > 0) {
        scores.push(gameTotalScore)
        totalScore += gameTotalScore
      }

      // 逐洞统计
      if (Array.isArray(game.holes) && game.holes.length > 0) {
        game.holes.forEach(hole => {
          if (!hole || !hole.hole || !hole.par) return
          const score = this.getStrokesValue(playerScores[hole.hole])
          if (score > 0) {
            totalHoles++
            const diff = score - hole.par
            totalToPar += diff

            // 成绩分布
            if (diff <= -2) distribution.eagles++
            else if (diff === -1) distribution.birdies++
            else if (diff === 0) distribution.pars++
            else if (diff === 1) distribution.bogeys++
            else if (diff === 2) distribution.doubles++
            else distribution.others++

            // 推杆统计（假设4杆洞标准上果岭后2推）
            const putts = playerPutts[hole.hole]
            if (putts > 0) {
              totalPutts += putts
              // 简化的GIR计算：如果杆数 <= 标准杆，认为是标准杆上果岭
              if (score <= hole.par) {
                totalGIR++
              }
            }
          }
        })
      } else if (game.statistics && game.statistics[player.id]) {
        const st = game.statistics[player.id]
        totalHoles += st.holesPlayed || 0
        totalToPar += st.toPar || 0
        distribution.eagles += st.eagles || 0
        distribution.birdies += st.birdies || 0
        distribution.pars += st.pars || 0
        distribution.bogeys += st.bogeys || 0
        distribution.doubles += (st.doubleBogeys || 0) + (st.others || 0)
      }
    })

    // 计算百分比
    const totalScoredHoles = distribution.eagles + distribution.birdies + distribution.pars +
                             distribution.bogeys + distribution.doubles + distribution.others

    const distributionPct = totalScoredHoles > 0 ? {
      eagles: distribution.eagles,
      eaglePct: ((distribution.eagles / totalScoredHoles) * 100).toFixed(1),
      birdies: distribution.birdies,
      birdiePct: ((distribution.birdies / totalScoredHoles) * 100).toFixed(1),
      pars: distribution.pars,
      parPct: ((distribution.pars / totalScoredHoles) * 100).toFixed(1),
      bogeys: distribution.bogeys,
      bogeyPct: ((distribution.bogeys / totalScoredHoles) * 100).toFixed(1),
      doubles: distribution.doubles + distribution.others,
      doublePct: (((distribution.doubles + distribution.others) / totalScoredHoles) * 100).toFixed(1)
    } : { eagles: 0, eaglePct: 0, birdies: 0, birdiePct: 0, pars: 0, parPct: 0, bogeys: 0, bogeyPct: 0, doubles: 0, doublePct: 0 }

    // 计算差点指数（简化版）
    const avgToPar = totalHoles > 0 ? (totalToPar / totalHoles) * 18 : 0
    const handicap = avgToPar > 0 ? Math.round(avgToPar * 0.96) : 0

    // 计算各项统计值
    const avgScore = scores.length > 0 ? (totalScore / scores.length).toFixed(1) : '-'
    const bestScore = scores.length > 0 ? Math.min(...scores) : '-'

    // 短杆统计
    const puttsPerHole = totalHoles > 0 ? (totalPutts / totalHoles).toFixed(2) : '-'
    const puttsPerHoleNum = parseFloat(puttsPerHole)
    const puttsProgress = !isNaN(puttsPerHoleNum) ? Math.max(0, Math.min(100, Math.round((puttsPerHoleNum / 5) * 100))) : 0
    const girPct = totalHoles > 0 ? Math.round((totalGIR / totalHoles) * 100) : '-'

    // 计算开球上球道率（简化：假设4杆洞和5杆洞，杆数<=标准杆-2为上球道）
    const firPct = totalHoles > 0 ? Math.round((totalGIR / totalHoles) * 85) : '-'

    // 救球成功率（简化计算）
    const scramblePct = totalHoles > 0 ? Math.round(((distribution.pars + distribution.birdies) / totalHoles) * 60) : '-'

    // 沙坑救球率（简化）
    const sandSaves = totalHoles > 0 ? Math.round(((distribution.pars) / totalHoles) * 40) : '-'

    // 最近趋势（最近10场）
    const recentTrend = games.slice(-10).map((game) => {
      const player = gameCompleteness.getPlayer(game)
      const toPar = this.getGameToPar(game, player)
      // 兼容老数据：使用 timestamp，如果没有则使用 endTime，如果都没有使用当前时间
      const timestamp = game.timestamp || game.endTime || Date.now()
      let date = new Date(timestamp)
      // 防御性检查：如果日期无效，使用当前日期
      if (isNaN(date.getTime())) {
        date = new Date()
      }
      return {
        toPar,
        toParDisplay: toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : toPar.toString(),
        date: `${date.getMonth() + 1}/${date.getDate()}`,
        height: Math.min(Math.max((toPar + 10) / 20 * 100, 10), 100)
      }
    })

    // 生成改进建议
    const suggestions = this.generateSuggestions({
      puttsPerHole: parseFloat(puttsPerHole) || 0,
      girPct: parseInt(girPct) || 0,
      scramblePct: parseInt(scramblePct) || 0,
      birdiePct: parseFloat(distributionPct.birdiePct) || 0,
      bogeyPct: parseFloat(distributionPct.bogeyPct) || 0
    })

    this.setData({
      unlocks: this.buildUnlocks(games.length),
      stats: {
        totalGames: games.length,
        avgScore,
        bestScore,
        handicap: handicap > 0 ? `+${handicap}` : handicap,
        distribution: distributionPct,
        shortGame: {
          puttsPerHole,
          puttsProgress,
          girPct,
          scramblePct,
          sandSaves
        },
        driving: { firPct },
        recentTrend,
        suggestions
      }
    })
  },

  buildUnlocks(totalGames) {
    const count = parseInt(totalGames, 10) || 0
    const build = function(required) {
      return {
        required: required,
        unlocked: count >= required,
        remain: Math.max(0, required - count)
      }
    }
    return {
      overview: build(1),
      trend: build(3),
      shortGame: build(5),
      driving: build(8),
      handicap: build(10)
    }
  },

  getCurrentPlayer(games) {
    // 尝试找到标记为isMe的球员
    for (const game of games) {
      const me = game.players?.find(p => p && p.isMe)
      if (me) return me
    }
    // 如果没有找到，返回第一个球员
    return games[0]?.players?.[0] || { id: 'unknown', name: '我' }
  },

  getStrokesValue(score) {
    if (!score) return 0
    if (typeof score === 'object') {
      return parseInt(score.strokes) || 0
    }
    return parseInt(score) || 0
  },

  getGameToPar(game, player) {
    if (!game || !player) return 0
    if (game.statistics && game.statistics[player.id]) {
      return game.statistics[player.id].toPar || 0
    }
    if (!Array.isArray(game.holes) || !game.scores || !game.scores[player.id]) {
      return 0
    }

    var toPar = 0
    var playerScores = game.scores[player.id]
    game.holes.forEach(hole => {
      var strokes = this.getStrokesValue(playerScores[hole.hole])
      if (strokes > 0 && hole.par) {
        toPar += (strokes - hole.par)
      }
    })
    return toPar
  },

  generateSuggestions(stats) {
    const suggestions = []

    if (stats.puttsPerHole > 1.8) {
      suggestions.push('推杆数偏高，建议加强推杆练习，特别是短距离推杆的稳定性。')
    }

    if (stats.girPct < 50) {
      suggestions.push('标准杆上果岭率较低，建议加强攻果岭的精准度训练。')
    }

    if (stats.scramblePct < 40) {
      suggestions.push('救球成功率有提升空间，建议加强短切杆和沙坑球练习。')
    }

    if (stats.birdiePct < 10) {
      suggestions.push('小鸟球机会较少，建议关注150码以内攻果岭的距离控制。')
    }

    if (stats.bogeyPct > 30) {
      suggestions.push('柏忌洞数较多，建议减少失误，特别是避免三推和罚杆。')
    }

    if (suggestions.length === 0) {
      suggestions.push('整体表现不错！建议保持稳定发挥，继续优化短杆技术。')
    }

    return suggestions
  },

  startNewGame() {
    wx.navigateTo({
      url: '/package-courses/pages/new-game/step1-course/step1-course'
    })
  }
})
