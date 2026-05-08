/**
 * 统计计算Mixin
 * 包含成绩计算、领先者计算、统计分析
 */

module.exports = {
  // 获取球员统计数据
  getPlayerStats(scores, course) {
    let totalScore = 0, holesPlayed = 0, points = 0

    Object.entries(scores).forEach(([holeNum, score]) => {
      if (score && course) {
        const holeData = course.holes.find(h => h.hole === parseInt(holeNum))
        if (holeData) {
          totalScore += parseInt(score)
          holesPlayed++
          const diff = score - holeData.par
          if (diff <= -2) points += 8
          else if (diff === -1) points += 3
          else if (diff === 0) points += 2
          else if (diff === 1) points += 1
        }
      }
    })

    return { totalScore, holesPlayed, points }
  },

  // 计算领先者
  calculateLeader(game, course) {
    if (!game?.players?.length) return

    const mode = game.gameMode || 'stroke'
    const playerScores = game.players.map(player => {
      const scores = game.scores[player.id] || {}
      const stats = this.getPlayerStats(scores, course)
      return { ...player, ...stats }
    })

    let leader = null

    switch (mode) {
      case 'stroke':
        playerScores.sort((a, b) => a.totalScore - b.totalScore)
        leader = playerScores[0]
        leader.displayScore = leader.totalScore > 0 ? `${leader.totalScore}杆` : '-'
        break
      case 'match':
        const matchResults = this.calculateMatchHoles(game, course)
        playerScores.forEach(p => { p.holesWon = matchResults[p.id] || 0 })
        playerScores.sort((a, b) => b.holesWon - a.holesWon)
        leader = playerScores[0]
        leader.displayScore = leader.holesWon > 0 ? `赢${leader.holesWon}洞` : '-'
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

  // 计算比洞赛每洞胜负
  calculateMatchHoles(game, course) {
    if (!game?.players?.length || game.players.length < 2) return {}

    const handicaps = game.handicaps || {}
    const results = {}
    game.players.forEach(p => results[p.id] = 0)

    course.holes.forEach(hole => {
      const holeScores = game.players.map(player => {
        const score = game.scores[player.id]?.[hole.hole]
        const handicap = handicaps[player.id] || 0
        const handicapStrokes = handicap >= hole.hole ? 1 : 0
        return {
          playerId: player.id,
          rawScore: score,
          netScore: score ? score - handicapStrokes : null
        }
      }).filter(s => s.netScore !== null)

      if (holeScores.length >= 2) {
        const bestScore = Math.min(...holeScores.map(s => s.netScore))
        const winners = holeScores.filter(s => s.netScore === bestScore)
        if (winners.length === 1) results[winners[0].playerId]++
      }
    })

    return results
  },

  // 计算记分卡网格数据
  calcScoreGridData(game, holes) {
    if (!game?.players?.length || !game.scores || !holes) return []

    return holes.map(hole => ({
      hole: hole.hole,
      par: hole.par,
      scores: game.players.map(player => {
        const playerScores = game.scores[player.id]
        const score = playerScores?.[hole.hole] || playerScores?.[String(hole.hole)]

        if (!score) return { playerId: player.id, display: '-', class: '' }

        const diff = parseInt(score) - hole.par
        return {
          playerId: player.id,
          display: diff === 0 ? 'Par' : (diff > 0 ? `+${diff}` : `${diff}`),
          class: diff < 0 ? 'to-par-under' : (diff > 0 ? 'to-par-over' : 'to-par-even')
        }
      })
    }))
  },

  // 计算所有球员的总杆显示列表
  calcPlayerTotalList(game, holes) {
    if (!game?.players?.length || !game.scores) return []

    return game.players.map(player => {
      const playerScores = game.scores[player.id]
      if (!playerScores) return { id: player.id, display: '-', class: '' }

      let total = 0, parTotal = 0, hasScore = false

      for (const [holeNum, score] of Object.entries(playerScores)) {
        if (score && parseInt(score) > 0) {
          total += parseInt(score)
          hasScore = true
          const hole = holes.find(h => h.hole == holeNum || h.holeNumber == holeNum)
          if (hole) parTotal += hole.par
        }
      }

      if (!hasScore) return { id: player.id, display: '-', class: '' }

      const toPar = total - parTotal
      return {
        id: player.id,
        total,
        diff: toPar === 0 ? 'E' : (toPar > 0 ? `+${toPar}` : toPar),
        class: toPar < 0 ? 'under' : (toPar > 0 ? 'over' : 'even')
      }
    })
  },

  // 更新记分卡网格数据
  updateScoreGrid() {
    const game = this.data.currentGame
    const playerTotalList = this.calcPlayerTotalList(game, this.data.holes)
    const scoreGridData = this.calcScoreGridData(game, this.data.holes)
    this.setData({ playerTotalList, scoreGridData })
  },

  // 计算比赛获胜者
  calculateWinnerForGame() {
    const game = this.data.currentGame
    const players = game.players || []
    const mode = game.gameMode || 'stroke'
    const holes = this.data.holes || []

    if (!players.length) return null

    const playersWithTotals = players.map(player => {
      const scores = game.scores?.[player.id] || {}
      let total = 0, parTotal = 0, hasScore = false

      Object.entries(scores).forEach(([holeNum, score]) => {
        if (score && parseInt(score) > 0) {
          total += parseInt(score)
          hasScore = true
          const hole = holes.find(h => h.hole == holeNum || h.holeNumber == holeNum)
          if (hole) parTotal += hole.par
        }
      })

      return { ...player, total, toPar: total - parTotal, hasScore }
    })

    switch (mode) {
      case 'stroke':
      case 'match':
        const sortedByScore = [...playersWithTotals].sort((a, b) => (a.total || 0) - (b.total || 0))
        const bestScore = sortedByScore[0]?.total || 0
        const winners = sortedByScore.filter(p => (p.total || 0) === bestScore)
        return {
          title: winners.length > 1 ? '并列冠军' : '冠军',
          players: winners.map(p => ({
            name: p.name,
            color: p.color,
            score: `${p.total}杆 ${p.toPar > 0 ? '+' : ''}${p.toPar}`
          })),
          desc: winners.length > 1 ? `${winners.length}位球员并列第一` : '总杆数最少'
        }
      default:
        const defaultSorted = [...playersWithTotals].sort((a, b) => (a.total || 0) - (b.total || 0))
        return {
          title: '最佳成绩',
          players: [defaultSorted[0]].map(p => ({
            name: p.name,
            color: p.color,
            score: `${p.total}杆 ${p.toPar > 0 ? '+' : ''}${p.toPar}`
          })),
          desc: '总杆数'
        }
    }
  },

  // 计算最终统计
  calculateStatistics(game) {
    const stats = {}
    if (!game?.players) return stats

    const courses = this.data.courses || []
    const course = courses.find(c => c.id === game.courseId)

    game.players.forEach(player => {
      const scores = game.scores?.[player.id] || {}
      const playerStats = {
        totalScore: 0, totalPar: 0, holesPlayed: 0,
        pars: 0, birdies: 0, eagles: 0, bogeys: 0, doubleBogeys: 0, others: 0
      }

      Object.entries(scores).forEach(([holeNum, score]) => {
        if (score) {
          const holeData = course?.holes?.find(h => h.hole === parseInt(holeNum))
          const par = holeData?.par || 4

          playerStats.totalScore += parseInt(score) || 0
          playerStats.totalPar += par
          playerStats.holesPlayed++

          const diff = parseInt(score) - par
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
  }
}
