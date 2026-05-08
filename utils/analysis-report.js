/**
 * 智能分析报告生成器
 */

const app = getApp()

/**
 * 检查比赛是否完整完成（打满18洞）
 * @param {Object} game - 比赛数据
 * @param {Object} targetPlayer - 目标球员
 */
function isGameCompleted(game, targetPlayer) {
  if (!game || !targetPlayer) return false
  if (!game.completed) return false

  // 新格式：player.scores数组
  if (targetPlayer.scores && Array.isArray(targetPlayer.scores)) {
    const validScores = targetPlayer.scores.filter(s => s.strokes > 0)
    return validScores.length >= 18
  }
  // 旧格式：game.scores对象
  else if (game.scores && game.scores[targetPlayer.id]) {
    const scores = game.scores[targetPlayer.id]
    const validCount = Object.values(scores).filter(v => v > 0).length
    return validCount >= 18
  }
  // 兼容有statistics字段的情况
  else if (game.statistics && game.statistics[targetPlayer.id]) {
    return game.statistics[targetPlayer.id].holesPlayed >= 18
  }

  return false
}

/**
 * 生成比赛分析报告
 * @param {Object} game - 比赛数据
 * @param {Array} historyGames - 历史比赛数据
 * @param {Object} targetPlayer - 目标球员（可选，默认为最佳球员）
 */
function generateGameReport(game, historyGames = [], targetPlayer = null) {
  if (!game || !game.players) return null

  const report = {
    summary: {},
    highlights: [],
    weaknesses: [],
    comparisons: {},
    suggestions: []
  }

  // 1. 基础统计
  const playerStats = []

  // 支持两种数据格式：旧格式 game.scores 和 新格式 player.scores 数组
  game.players.forEach(player => {
    let validScores = []

    if (player.scores && Array.isArray(player.scores)) {
      // 新格式：player.scores 是数组
      validScores = player.scores.filter(s => s.strokes > 0)
    } else if (game.scores && game.scores[player.id]) {
      // 旧格式：game.scores[playerId] 是对象
      const scores = game.scores[player.id]
      validScores = Object.entries(scores)
        .filter(([k, v]) => !isNaN(k) && v > 0)
        .map(([k, v]) => ({ hole: parseInt(k), strokes: v, par: 4 }))
    }

    if (validScores.length === 0) return report

    const total = validScores.reduce((sum, s) => sum + s.strokes, 0)
    const pars = game.holes || []
    const totalPar = pars.reduce((sum, h) => sum + (h.par || 4), 0)

    // 成绩分布
    const distribution = {
      eagle: 0,    // -2
      birdie: 0,   // -1
      par: 0,      // 0
      bogey: 0,    // +1
      doubleBogey: 0, // +2
      worse: 0     // >+2
    }

    validScores.forEach(score => {
      const holeData = pars.find(h => h.hole === score.hole)
      const par = holeData ? holeData.par : (score.par || 4)
      const diff = score.strokes - par

      if (diff <= -2) distribution.eagle++
      else if (diff === -1) distribution.birdie++
      else if (diff === 0) distribution.par++
      else if (diff === 1) distribution.bogey++
      else if (diff === 2) distribution.doubleBogey++
      else distribution.worse++
    })

    playerStats.push({
      player,
      total,
      totalPar,
      toPar: total - totalPar,
      holes: validScores.length,
      distribution,
      validScores,
      avgScore: (total / validScores.length).toFixed(1)
    })
  })

  if (playerStats.length === 0) {
    // 没有有效球员数据时返回默认报告
    report.summary = {
      bestPlayer: '球员',
      bestScore: 0,
      toPar: 0,
      completionRate: 0
    }
    return report
  }

  // 2. 生成亮点 (Highlights) - 如果是针对特定球员，只分析该球员数据
  let focusPlayerStats = playerStats
  if (targetPlayer) {
    const found = playerStats.find(ps => ps.player.id === targetPlayer.id)
    if (found) {
      focusPlayerStats = [found]
    }
  }
  // 根据是否指定目标球员来生成摘要
  const focusStats = focusPlayerStats[0] || playerStats.sort((a, b) => a.total - b.total)[0]
  report.summary = {
    bestPlayer: focusStats.player.name,
    bestScore: focusStats.total,
    toPar: focusStats.toPar,
    completionRate: (focusStats.holes / 18 * 100).toFixed(0)
  }

  // 找出最好的洞
  const bestHoles = []
  focusPlayerStats.forEach(ps => {
    const scores = ps.validScores || []

    scores.forEach(score => {
      const holeData = (game.holes || []).find(h => h.hole === score.hole)
      const par = holeData ? holeData.par : (score.par || 4)
      if (holeData || score.par) {
        const diff = score.strokes - par
        if (diff <= -1) {
          bestHoles.push({
            hole: score.hole,
            player: ps.player.name,
            strokes: score.strokes,
            par: par,
            diff,
            type: diff === -1 ? '小鸟' : diff === -2 ? '老鹰' : '信天翁'
          })
        }
      }
    })
  })

  if (bestHoles.length > 0) {
    const bestHole = bestHoles.sort((a, b) => a.diff - b.diff)[0]
    report.highlights.push({
      type: 'best_hole',
      title: `🎯 精彩瞬间`,
      content: `${bestHole.player} 在第${bestHole.hole}洞打出${bestHole.type}！仅用了${bestHole.strokes}杆`
    })
  }

  // 3. 弱点分析 - 只分析目标球员
  const weaknessThreshold = 2 // +2以上算作弱点
  const weakHoles = []

  focusPlayerStats.forEach(ps => {
    const scores = ps.validScores || []
    scores.forEach(score => {
      const holeData = (game.holes || []).find(h => h.hole === score.hole)
      const par = holeData ? holeData.par : (score.par || 4)
      if (holeData || score.par) {
        const diff = score.strokes - par
        if (diff >= weaknessThreshold) {
          weakHoles.push({
            hole: score.hole,
            player: ps.player.name,
            strokes: score.strokes,
            par: par,
            diff
          })
        }
      }
    })
  })

  if (weakHoles.length > 0) {
    const groupedByPlayer = {}
    weakHoles.forEach(wh => {
      if (!groupedByPlayer[wh.player]) groupedByPlayer[wh.player] = []
      groupedByPlayer[wh.player].push(wh)
    })

    Object.entries(groupedByPlayer).forEach(([player, holes]) => {
      if (holes.length >= 3) {
        report.weaknesses.push({
          type: 'bad_holes',
          title: `⚠️ ${player}的遗憾`,
          content: `有${holes.length}个洞打出+${weaknessThreshold}或更高，主要集中在第${holes.slice(0, 3).map(h => h.hole).join('、')}洞`
        })
      }
    })
  }

  // 4. 与历史对比 - 使用目标球员的数据
  if (historyGames.length > 0 && targetPlayer) {
    // 获取该球员的历史成绩 - 只统计完成18洞的比赛
    const avgScores = historyGames.map(g => {
      // 首先检查比赛是否完成且打满18洞
      if (!g.completed) return 0

      // 查找历史比赛中同一球员的成绩
      const player = g.players?.find(p => p.id === targetPlayer.id || p.name === targetPlayer.name)
      if (!player) return 0

      // 新格式：player.scores数组
      if (player.scores && Array.isArray(player.scores)) {
        const validScores = player.scores.filter(s => s.strokes > 0)
        if (validScores.length < 18) return 0
        if (player.total) return player.total
        return validScores.reduce((sum, s) => sum + s.strokes, 0)
      }
      // 旧格式：game.scores对象
      else if (g.scores && g.scores[player.id]) {
        const scores = g.scores[player.id]
        const validCount = Object.values(scores).filter(v => v > 0).length
        if (validCount < 18) return 0
        return Object.values(scores).reduce((a, b) => a + b, 0)
      }
      // 兼容有statistics字段的情况
      else if (g.statistics && g.statistics[player.id]) {
        if (g.statistics[player.id].holesPlayed < 18) return 0
        return g.statistics[player.id].totalScore
      }

      return 0
    }).filter(s => s > 0)

    if (avgScores.length > 0) {
      const historyAvg = avgScores.reduce((a, b) => a + b, 0) / avgScores.length
      const currentTotal = focusStats.total

      report.comparisons = {
        historyAvg: historyAvg.toFixed(0),
        currentAvg: currentTotal.toFixed(0),
        trend: currentTotal < historyAvg ? 'improved' : currentTotal > historyAvg ? 'declined' : 'stable',
        diff: Math.abs(currentTotal - historyAvg).toFixed(0)
      }

      if (report.comparisons.trend === 'improved') {
        report.highlights.push({
          type: 'improvement',
          title: '📈 进步明显',
          content: `本场成绩${currentTotal}杆，比历史平均${historyAvg.toFixed(0)}杆低${report.comparisons.diff}杆，状态不错！`
        })
      }
    }
  }

  // 5. 建议生成 - 基于目标球员数据
  const focusDist = focusStats.distribution

  if (focusDist.birdie + focusDist.eagle >= 2) {
    report.suggestions.push('🎯 进攻型打法：你的抓鸟能力很强，建议保持侵略性，但要注意风险管控')
  }

  if (focusDist.bogey + focusDist.doubleBogey + focusDist.worse >= 5) {
    report.suggestions.push('🛡️ 防守建议：爆洞较多，建议加强长杆稳定性，避免重大失误')
  }

  if (focusDist.par >= 10) {
    report.suggestions.push('✅ 稳健型球手：标准杆率很高，是可靠的比赛型选手')
  }

  // 推杆分析（如果有数据）
  const playerPutts = targetPlayer && targetPlayer.scores ?
    targetPlayer.scores.filter(s => s.putts).map(s => s.putts) : []
  if (playerPutts.length > 0) {
    const avgPutts = playerPutts.reduce((a, b) => a + b, 0) / playerPutts.length
    if (avgPutts > 2) {
      report.suggestions.push(`⛳ 推杆提升：平均${avgPutts.toFixed(1)}推，建议加强3-5英尺短推练习`)
    }
  }

  return report
}

/**
 * 生成球员能力雷达图数据
 */
function generateRadarData(game, playerId) {
  const scores = game.scores[playerId] || {}
  const putts = (game.putts && game.putts[playerId]) || {}

  // 各项能力评分 (0-100)
  const metrics = {
    driving: 70,      // 发球
    approach: 70,     // 攻果岭
    shortGame: 70,    // 短杆
    putting: 70,      // 推杆
    mental: 70,       // 心理素质
    consistency: 70   // 稳定性
  }

  // 基于实际数据计算
  const validScores = Object.entries(scores)
    .filter(([k, v]) => !isNaN(k) && v > 0)
    .map(([k, v]) => ({ hole: parseInt(k), strokes: v }))

  if (validScores.length === 0) return metrics

  // 计算标准差（稳定性）
  const avg = validScores.reduce((sum, s) => sum + s.strokes, 0) / validScores.length
  const variance = validScores.reduce((sum, s) => sum + Math.pow(s.strokes - avg, 2), 0) / validScores.length
  const stdDev = Math.sqrt(variance)
  metrics.consistency = Math.max(30, 100 - stdDev * 15)

  // 推杆评分
  const puttValues = Object.values(putts).filter(v => v > 0)
  if (puttValues.length > 0) {
    const avgPutts = puttValues.reduce((a, b) => a + b, 0) / puttValues.length
    metrics.putting = Math.max(30, 100 - (avgPutts - 1.5) * 30)
  }

  return metrics
}

/**
 * 生成一句话总结
 * @param {Object} game - 比赛数据
 * @param {Object} targetPlayer - 目标球员（可选）
 */
function generateOneLineSummary(game, targetPlayer) {
  const report = generateGameReport(game, [], targetPlayer)
  if (!report) return '暂无数据'

  const { summary } = report
  const toParText = summary.toPar > 0 ? `+${summary.toPar}` : summary.toPar

  if (summary.toPar <= -5) {
    return `🔥 太神了！${summary.bestPlayer} 打出了 ${summary.bestScore}杆 (${toParText}) 的惊人成绩！`
  } else if (summary.toPar <= 0) {
    return `👏 不错！${summary.bestPlayer} 以 ${summary.bestScore}杆 (${toParText}) 完成比赛`
  } else if (summary.toPar <= 10) {
    return `⛳ ${summary.bestPlayer} 完成比赛，成绩 ${summary.bestScore}杆 (${toParText})，还有提升空间`
  } else {
    return `💪 ${summary.bestPlayer} 完成比赛，成绩 ${summary.bestScore}杆，享受过程最重要！`
  }
}

module.exports = {
  generateGameReport,
  generateRadarData,
  generateOneLineSummary,
  isGameCompleted
}
