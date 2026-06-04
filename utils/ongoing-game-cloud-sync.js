/**
 * 将本地进行中比赛自动备份到云端。
 * 同步失败不阻塞本地记分，下一次保存或启动时继续重试。
 */

const timers = {}

function isLocalGame(game) {
  return !!(game && game.id && String(game.id).indexOf("local_") === 0)
}

function canSyncGame(game) {
  return !!(
    game &&
    isLocalGame(game) &&
    game.deleted !== true &&
    game.completed !== true &&
    wx.cloud &&
    typeof wx.cloud.callFunction === "function"
  )
}

function getGameKey(game) {
  if (!game) return ""
  if (game.id) return "id:" + game.id
  if (game.gameId) return "gameId:" + game.gameId
  return ""
}

function findGameIndex(games, game) {
  var key = getGameKey(game)
  if (!Array.isArray(games) || !game) return -1

  for (var i = 0; i < games.length; i++) {
    var candidate = games[i]
    if (!candidate) continue
    if (key && getGameKey(candidate) === key) return i
    if (game.id && candidate.id === game.id) return i
    if (game.gameId && candidate.gameId === game.gameId) return i
  }

  return -1
}

function applySyncPatch(game, patch) {
  var currentGame = wx.getStorageSync("currentGame")
  var target = game

  if (currentGame && findGameIndex([currentGame], game) >= 0) {
    target = currentGame
  }

  var updated = Object.assign({}, target, patch)

  if (currentGame && findGameIndex([currentGame], game) >= 0) {
    wx.setStorageSync("currentGame", updated)
  }

  var games = wx.getStorageSync("games") || []
  if (Array.isArray(games)) {
    var index = findGameIndex(games, game)
    if (index >= 0) {
      games[index] = Object.assign({}, games[index], patch)
      wx.setStorageSync("games", games)
    }
  }

  return updated
}

function syncNow(game) {
  if (!canSyncGame(game)) {
    return Promise.resolve({ success: false, skipped: true, reason: "not-syncable" })
  }

  var userInfo = wx.getStorageSync("userInfo") || {}
  if (!userInfo.openid) {
    return Promise.resolve({ success: false, skipped: true, reason: "missing-openid" })
  }

  applySyncPatch(game, {
    cloudSyncStatus: "pending",
    cloudSyncError: ""
  })

  return new Promise(function(resolve) {
    wx.cloud.callFunction({
      name: "gameAction",
      data: {
        action: "syncLocalGame",
        game: game
      },
      success: function(res) {
        var result = res && res.result ? res.result : {}
        if (result.success) {
          var updated = applySyncPatch(game, {
            _id: result._id || game._id,
            gameId: result.gameId || game.gameId || game.id,
            cloudSyncStatus: "synced",
            cloudSyncError: "",
            cloudSyncedAt: Date.now()
          })
          resolve(Object.assign({}, result, { game: updated }))
          return
        }

        applySyncPatch(game, {
          cloudSyncStatus: "failed",
          cloudSyncError: result.error || "同步失败"
        })
        resolve({ success: false, error: result.error || "同步失败" })
      },
      fail: function(err) {
        var message = err && err.errMsg ? err.errMsg : "同步失败"
        applySyncPatch(game, {
          cloudSyncStatus: "failed",
          cloudSyncError: message
        })
        resolve({ success: false, error: message })
      }
    })
  })
}

function queueSync(game, delay) {
  if (!canSyncGame(game)) return false

  var key = getGameKey(game)
  if (!key) return false

  if (timers[key]) {
    clearTimeout(timers[key])
  }

  timers[key] = setTimeout(function() {
    delete timers[key]
    syncNow(game)
  }, typeof delay === "number" ? delay : 1500)

  return true
}

function syncPendingGames() {
  var games = wx.getStorageSync("games") || []
  if (!Array.isArray(games)) return 0

  var count = 0
  games.forEach(function(game) {
    if (canSyncGame(game)) {
      if (queueSync(game, 0)) count++
    }
  })
  return count
}

module.exports = {
  canSyncGame: canSyncGame,
  queueSync: queueSync,
  syncNow: syncNow,
  syncPendingGames: syncPendingGames
}
