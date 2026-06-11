/**
 * 比赛完整性判断工具
 * 统一约束：复盘、统计、数据分析只使用18洞完整有效成绩。
 */

var REQUIRED_HOLES = 18

function isCompletedGame(game) {
  return !!(game && (game.completed === true || game.status === "completed"))
}

function getStrokesValue(score) {
  if (score === null || score === undefined || score === "") return 0
  if (typeof score === "object") {
    return parseInt(score.strokes || score.score || score.value, 10) || 0
  }
  return parseInt(score, 10) || 0
}

function getPlayer(game, playerId) {
  if (!game || !Array.isArray(game.players) || game.players.length === 0) return null
  if (playerId) {
    var target = game.players.find(function(p) {
      return p && p.id === playerId
    })
    if (target) return target
  }
  return game.players.find(function(p) { return p && p.isMe }) || game.players[0]
}

function getPlayerId(game, playerId) {
  var player = getPlayer(game, playerId)
  return player && player.id ? player.id : null
}

function countObjectScores(scores) {
  if (!scores || typeof scores !== "object") return 0
  var holeMap = {}
  Object.keys(scores).forEach(function(key) {
    var hole = parseInt(key, 10)
    if (isNaN(hole)) return
    if (getStrokesValue(scores[key]) > 0) {
      holeMap[hole] = true
    }
  })
  return Object.keys(holeMap).length
}

function countArrayScores(scores) {
  if (!Array.isArray(scores)) return 0
  var holeMap = {}
  var anonymousCount = 0
  scores.forEach(function(item, index) {
    var strokes = getStrokesValue(item)
    if (strokes <= 0) return

    var hole = item && typeof item === "object"
      ? parseInt(item.hole || item.holeNum || item.index, 10)
      : index + 1

    if (isNaN(hole)) {
      anonymousCount++
      return
    }
    holeMap[hole] = true
  })
  return Object.keys(holeMap).length + anonymousCount
}

function getPlayerScoreCount(game, playerId) {
  var player = getPlayer(game, playerId)
  if (!game || !player || !player.id) return 0

  if (game.scores && game.scores[player.id]) {
    return countObjectScores(game.scores[player.id])
  }

  if (Array.isArray(player.scores)) {
    return countArrayScores(player.scores)
  }

  if (game.statistics && game.statistics[player.id]) {
    return parseInt(game.statistics[player.id].holesPlayed, 10) || 0
  }

  return 0
}

function isPlayerRoundComplete(game, playerId) {
  if (!isCompletedGame(game)) return false

  var resolvedPlayerId = getPlayerId(game, playerId)
  if (!resolvedPlayerId) return false

  if (Array.isArray(game.validScorePlayerIds)) {
    return game.validScorePlayerIds.indexOf(resolvedPlayerId) >= 0 &&
      getPlayerScoreCount(game, resolvedPlayerId) >= REQUIRED_HOLES
  }

  if (
    game.statistics &&
    game.statistics[resolvedPlayerId] &&
    game.statistics[resolvedPlayerId].validRound === false
  ) {
    return false
  }

  return getPlayerScoreCount(game, resolvedPlayerId) >= REQUIRED_HOLES
}

function getValidScorePlayerIds(game) {
  if (!game || !Array.isArray(game.players)) return []
  return game.players
    .filter(function(player) {
      return player && player.id && isPlayerRoundComplete(game, player.id)
    })
    .map(function(player) {
      return player.id
    })
}

function isGameAnalyzable(game, playerId) {
  if (!isCompletedGame(game)) return false
  if (playerId) return isPlayerRoundComplete(game, playerId)
  return getValidScorePlayerIds(game).length > 0
}

function filterAnalyzableGames(games, playerId) {
  if (!Array.isArray(games)) return []
  return games.filter(function(game) {
    return isGameAnalyzable(game, playerId)
  })
}

function filterUserCompletedGames(games, playerId) {
  if (!Array.isArray(games)) return []
  return games.filter(function(game) {
    var player = getPlayer(game, playerId)
    return player && isPlayerRoundComplete(game, player.id)
  })
}

function countUserCompletedGames(games, playerId) {
  return filterUserCompletedGames(games, playerId).length
}

function getGameTimestamp(game) {
  if (!game) return 0
  return game.timestamp || game.endTime || game.updateTime || game.createTime || 0
}

function sortByLatest(games) {
  return (games || []).slice().sort(function(a, b) {
    return getGameTimestamp(b) - getGameTimestamp(a)
  })
}

module.exports = {
  REQUIRED_HOLES: REQUIRED_HOLES,
  isCompletedGame: isCompletedGame,
  getStrokesValue: getStrokesValue,
  getPlayer: getPlayer,
  getPlayerId: getPlayerId,
  getPlayerScoreCount: getPlayerScoreCount,
  isPlayerRoundComplete: isPlayerRoundComplete,
  getValidScorePlayerIds: getValidScorePlayerIds,
  isGameAnalyzable: isGameAnalyzable,
  filterAnalyzableGames: filterAnalyzableGames,
  filterUserCompletedGames: filterUserCompletedGames,
  countUserCompletedGames: countUserCompletedGames,
  getGameTimestamp: getGameTimestamp,
  sortByLatest: sortByLatest
}
