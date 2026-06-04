const path = require("path")
const { loadApp } = require("./helpers/load-app")

function createDbWithCloudGames(cloudGames) {
  return {
    command: {
      eq: function(value) { return value },
      or: function(conditions) { return conditions }
    },
    collection: function() {
      return {
        where: function() { return this },
        orderBy: function() { return this },
        get: function() {
          return Promise.resolve({ data: cloudGames })
        }
      }
    }
  }
}

describe("app cloud game history sync", function() {
  test("syncUserGameHistory should not overwrite completed local game with stale cloud ongoing game", async function() {
    wx.setStorageSync("userInfo", { openid: "openid-1" })
    wx.setStorageSync("games", [{
      _id: "cloud-doc-1",
      gameId: "cloud-game-1",
      courseId: "course-1",
      courseName: "Completed Local",
      players: [{ id: "p1", openid: "openid-1" }],
      completed: true,
      status: "completed",
      endTime: 1000,
      updateTime: 1000
    }])
    wx.cloud = {
      init: jest.fn(),
      database: function() {
        return createDbWithCloudGames([{
          _id: "cloud-doc-1",
          _openid: "openid-1",
          gameId: "cloud-game-1",
          courseId: "course-1",
          courseName: "Stale Cloud Playing",
          players: [{ id: "p1", openid: "openid-1" }],
          completed: false,
          status: "playing",
          updateTime: 999999
        }])
      }
    }

    const app = loadApp(path.resolve(__dirname, "../app.js"))
    app.cloud = wx.cloud

    const mergedCount = await app.syncUserGameHistory()
    const games = wx.getStorageSync("games")

    expect(mergedCount).toBe(0)
    expect(games).toHaveLength(1)
    expect(games[0].courseName).toBe("Completed Local")
    expect(games[0].completed).toBe(true)
    expect(games[0].status).toBe("completed")
  })

  test("syncUserGameHistory should not add cloud ongoing game when completed marker exists", async function() {
    wx.setStorageSync("userInfo", { openid: "openid-1" })
    wx.setStorageSync("completedGameKeys", ["cloud-doc-2", "cloud-game-2"])
    wx.setStorageSync("games", [])
    wx.cloud = {
      init: jest.fn(),
      database: function() {
        return createDbWithCloudGames([{
          _id: "cloud-doc-2",
          _openid: "openid-1",
          gameId: "cloud-game-2",
          courseId: "course-1",
          courseName: "Stale Cloud Playing",
          players: [{ id: "p1", openid: "openid-1" }],
          completed: false,
          status: "playing",
          updateTime: 999999
        }])
      }
    }

    const app = loadApp(path.resolve(__dirname, "../app.js"))
    app.cloud = wx.cloud

    const mergedCount = await app.syncUserGameHistory()

    expect(mergedCount).toBe(0)
    expect(wx.getStorageSync("games")).toEqual([])
  })
})
