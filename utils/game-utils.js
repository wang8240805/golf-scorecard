// 游戏工具函数

/**
 * 查找当前玩家（我）
 * @param {Object} game - 游戏对象
 * @returns {Object|null} 玩家对象
 */
function findMePlayer(game) {
  if (!game || !game.players || !Array.isArray(game.players)) {
    return null
  }
  return game.players.find(p => p.isMe) || game.players[0] || null
}

/**
 * 获取玩家的分数
 * @param {Object} game - 游戏对象
 * @param {string} playerId - 玩家ID
 * @returns {number} 总杆数
 */
function getPlayerScore(game, playerId) {
  if (!game) return 0

  // 优先从统计数据获取
  if (game.statistics && game.statistics[playerId]) {
    return game.statistics[playerId].totalScore || 0
  }

  // 兼容旧数据：从 scores 直接计算
  if (game.scores && game.scores[playerId]) {
    const scores = game.scores[playerId]
    let total = 0
    Object.values(scores).forEach(s => {
      const strokes = typeof s === 'object' ? s.strokes : s
      total += parseInt(strokes) || 0
    })
    return total
  }

  return 0
}

/**
 * 获取玩家在某一洞的杆数
 * @param {Object} game - 游戏对象
 * @param {string} playerId - 玩家ID
 * @param {number} hole - 洞号
 * @returns {number|null} 杆数，未填写返回 null
 */
function getPlayerHoleScore(game, playerId, hole) {
  if (!game || !game.scores || !game.scores[playerId]) return null
  const holeData = game.scores[playerId][hole]
  if (!holeData) return null

  return typeof holeData === 'object' ? holeData.strokes : holeData
}

/**
 * 计算比赛的领先玩家
 * @param {Object} game - 游戏对象
 * @returns {Object|null} 领先玩家对象和分数
 */
function calculateLeader(game) {
  if (!game || !game.players || game.players.length === 0) {
    return null
  }

  let bestScore = Infinity
  let leader = null

  game.players.forEach(player => {
    const score = getPlayerScore(game, player.id)
    if (score > 0 && score < bestScore) {
      bestScore = score
      leader = player
    }
  })

  return leader ? { player: leader, score: bestScore } : null
}

module.exports = {
  findMePlayer,
  getPlayerScore,
  getPlayerHoleScore,
  calculateLeader
}
