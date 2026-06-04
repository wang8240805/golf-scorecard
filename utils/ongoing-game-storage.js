const cloudSync = require("./ongoing-game-cloud-sync.js")
const COMPLETED_GAME_KEYS_STORAGE = "completedGameKeys"
const ONGOING_GAME_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000

/**
 * 进行中比赛存储保护。
 * currentGame 是快速入口，games 是兜底镜像，避免单个缓存键丢失后无法继续比赛。
 */

function isOngoingGame(game) {
  return !!(
    game &&
    game.deleted !== true &&
    game.completed !== true &&
    game.status !== "completed" &&
    game.status !== "finished" &&
    game.status !== "waiting"
  )
}

function isCompletedGame(game) {
  return !!(game && (game.completed === true || game.status === "completed"))
}

function getGameIds(game) {
  var ids = []
  if (!game) return ids
  if (game.id) ids.push(String(game.id))
  if (game.gameId) ids.push(String(game.gameId))
  if (game._id) ids.push(String(game._id))
  return ids.filter(function(id, index) {
    return id && ids.indexOf(id) === index
  })
}

function getCompletedGameKeys() {
  var keys = wx.getStorageSync(COMPLETED_GAME_KEYS_STORAGE) || []
  return Array.isArray(keys) ? keys : []
}

function hasCompletedMarker(game) {
  var ids = getGameIds(game)
  if (ids.length === 0) return false
  var completedKeys = getCompletedGameKeys()
  return ids.some(function(id) {
    return completedKeys.indexOf(id) >= 0
  })
}

function markGameCompleted(game) {
  var ids = getGameIds(game)
  if (ids.length === 0) return

  var completedKeys = getCompletedGameKeys()
  ids.forEach(function(id) {
    if (completedKeys.indexOf(id) === -1) {
      completedKeys.push(id)
    }
  })
  wx.setStorageSync(COMPLETED_GAME_KEYS_STORAGE, completedKeys)
}

function getGameKey(game) {
  if (!game) return ""
  if (game.id) return "id:" + game.id
  if (game.gameId) return "gameId:" + game.gameId
  if (game.timestamp && game.courseId) return "timestamp:" + game.timestamp + ":" + game.courseId
  return ""
}

function getGameTime(game) {
  if (!game) return 0
  return normalizeTime(game.updateTime || game.timestamp || game.createTime || game.endTime || 0)
}

function normalizeTime(value) {
  if (!value) return 0
  if (typeof value === "number") return value
  if (typeof value === "string") {
    var parsed = Date.parse(value)
    if (!isNaN(parsed)) return parsed
    var numeric = parseInt(value, 10)
    return isNaN(numeric) ? 0 : numeric
  }
  if (value && typeof value.getTime === "function") {
    return value.getTime()
  }
  return 0
}

function isStaleOngoingGame(game) {
  if (!isOngoingGame(game)) return false
  var gameTime = getGameTime(game)
  if (!gameTime) return false
  return Date.now() - gameTime > ONGOING_GAME_MAX_AGE_MS
}

function isRecoverableOngoingGame(game) {
  return isOngoingGame(game) && !hasCompletedMarker(game) && !isStaleOngoingGame(game)
}

function findGameIndex(games, game) {
  if (!Array.isArray(games) || !game) return -1

  for (var i = 0; i < games.length; i++) {
    var candidate = games[i]
    if (!candidate) continue
    if (isSameGame(candidate, game)) return i
  }

  return -1
}

function isSameGame(left, right) {
  if (!left || !right) return false

  var leftIds = []
  var rightIds = []
  if (left.id) leftIds.push(left.id)
  if (left.gameId) leftIds.push(left.gameId)
  if (left._id) leftIds.push(left._id)
  if (right.id) rightIds.push(right.id)
  if (right.gameId) rightIds.push(right.gameId)
  if (right._id) rightIds.push(right._id)

  for (var i = 0; i < leftIds.length; i++) {
    if (rightIds.indexOf(leftIds[i]) >= 0) {
      return true
    }
  }

  return !!(
    leftIds.length === 0 &&
    rightIds.length === 0 &&
    left.timestamp &&
    right.timestamp &&
    left.timestamp === right.timestamp &&
    left.courseId === right.courseId
  )
}

function mirrorGameToGames(game) {
  if (!game) return

  wx.setStorageSync("games", mergeGameIntoList(wx.getStorageSync("games") || [], game))
}

function mergeGameIntoList(games, game) {
  var list = Array.isArray(games) ? games.slice() : []
  if (!game) return list

  var index = findGameIndex(list, game)
  if (index >= 0) {
    list[index] = game
  } else {
    list.push(game)
  }

  return list
}

function saveCurrentGame(game) {
  if (!game) return
  if (isOngoingGame(game) && hasCompletedMarker(game)) return
  game.updateTime = Date.now()
  wx.setStorageSync("currentGame", game)
  mirrorGameToGames(game)
  cloudSync.queueSync(game)
}

function findLatestOngoingGame(games) {
  if (!Array.isArray(games)) return null

  var latest = null
  games.forEach(function(game) {
    if (!isRecoverableOngoingGame(game)) return
    var hasCompletedVersion = games.some(function(candidate) {
      return isCompletedGame(candidate) && isSameGame(candidate, game)
    })
    if (hasCompletedVersion) return
    if (!latest || getGameTime(game) > getGameTime(latest)) {
      latest = game
    }
  })

  return latest
}

function getRestoredOngoingGame() {
  var currentGame = wx.getStorageSync("currentGame")
  if (isOngoingGame(currentGame)) {
    if (!isRecoverableOngoingGame(currentGame)) {
      wx.removeStorageSync("currentGame")
    } else {
      mirrorGameToGames(currentGame)
      cloudSync.queueSync(currentGame)
      return currentGame
    }
  }

  var latest = findLatestOngoingGame(wx.getStorageSync("games") || [])
  if (latest) {
    wx.setStorageSync("currentGame", latest)
    cloudSync.queueSync(latest)
  }
  return latest
}

module.exports = {
  isOngoingGame: isOngoingGame,
  isCompletedGame: isCompletedGame,
  isStaleOngoingGame: isStaleOngoingGame,
  isRecoverableOngoingGame: isRecoverableOngoingGame,
  getGameIds: getGameIds,
  hasCompletedMarker: hasCompletedMarker,
  markGameCompleted: markGameCompleted,
  isSameGame: isSameGame,
  mergeGameIntoList: mergeGameIntoList,
  mirrorGameToGames: mirrorGameToGames,
  saveCurrentGame: saveCurrentGame,
  findLatestOngoingGame: findLatestOngoingGame,
  getRestoredOngoingGame: getRestoredOngoingGame
}
