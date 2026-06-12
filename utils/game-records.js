const gameCompleteness = require("./game-completeness.js")

const TEST_GAME_IDS = {
  "mock-game-1": true,
  "mock-game-2": true,
  "mock-game-3": true,
  "game_20260302_001": true,
  "game_20260215_001": true,
  "game_20260128_001": true,
  "game_20260110_001": true,
  "game_20251220_001": true,
  "game_20251115_001": true
}

function getGameTimestamp(game) {
  if (!game) return 0
  return game.timestamp || game.endTime || game.updateTime || game.createTime || 0
}

function getDisplayGameId(game) {
  if (!game) return ""
  const timestamp = game.timestamp || game.endTime || game.createTime || 0
  return game.id || game.gameId || game._id || (timestamp ? "local_" + timestamp : "")
}

function getGameKey(game) {
  if (!game) return ""
  if (game.id) return "id:" + game.id
  if (game.gameId) return "gameId:" + game.gameId
  if (game._id) return "cloud:" + game._id
  const timestamp = game.timestamp || game.endTime || game.createTime || 0
  if (timestamp && game.courseId) return "time:" + timestamp + ":" + game.courseId
  return ""
}

function isTestGameRecord(game) {
  if (!game) return false
  const ids = [game.id, game.gameId, game._id].filter(Boolean).map(String)
  if (ids.some(function(id) { return TEST_GAME_IDS[id] || id.indexOf("mock-game-") === 0 })) {
    return true
  }
  if (game.isMock === true || game.mock === true || game.isTest === true || game.test === true) {
    return true
  }
  if (String(game.source || "").toLowerCase() === "mock") {
    return true
  }
  return false
}

function sanitizeGames(games) {
  if (!Array.isArray(games)) return []
  const seen = {}
  const result = []
  games.forEach(function(game) {
    if (!game || game.deleted === true || isTestGameRecord(game)) return
    const key = getGameKey(game)
    if (key && seen[key]) return
    if (key) seen[key] = true
    result.push(game)
  })
  return result
}

function cleanStoredGames() {
  const games = wx.getStorageSync("games") || []
  const cleanGames = sanitizeGames(games)
  if (cleanGames.length !== games.length) {
    wx.setStorageSync("games", cleanGames)
  }

  const currentGame = wx.getStorageSync("currentGame")
  if (currentGame && (currentGame.deleted === true || isTestGameRecord(currentGame))) {
    wx.removeStorageSync("currentGame")
  }

  return cleanGames
}

function getStoredGames() {
  return cleanStoredGames()
}

function getUserCompletedGames(games, playerId) {
  return gameCompleteness.filterUserCompletedGames(sanitizeGames(games || []), playerId)
}

function getRecentCompletedGames(games, limit, playerId) {
  const recent = getUserCompletedGames(games, playerId)
    .slice()
    .sort(function(a, b) {
      return getGameTimestamp(b) - getGameTimestamp(a)
    })
  return limit ? recent.slice(0, limit) : recent
}

module.exports = {
  isTestGameRecord: isTestGameRecord,
  sanitizeGames: sanitizeGames,
  cleanStoredGames: cleanStoredGames,
  getStoredGames: getStoredGames,
  getUserCompletedGames: getUserCompletedGames,
  getRecentCompletedGames: getRecentCompletedGames,
  getGameTimestamp: getGameTimestamp,
  getDisplayGameId: getDisplayGameId,
  getGameKey: getGameKey
}
