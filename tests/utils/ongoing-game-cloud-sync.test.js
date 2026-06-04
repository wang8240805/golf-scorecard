const cloudSync = require("../../utils/ongoing-game-cloud-sync")

function createLocalGame() {
  return {
    id: "local_1000",
    courseId: "c1",
    courseName: "Test Course",
    players: [{ id: "p1", name: "A", openid: "openid-1" }],
    scores: { p1: { 1: 4 } },
    completed: false,
    updateTime: 1000
  }
}

describe("utils/ongoing-game-cloud-sync", function() {
  test("syncNow should upload local unfinished game and persist returned cloud id", async function() {
    wx.setStorageSync("userInfo", { openid: "openid-1" })
    wx.setStorageSync("currentGame", createLocalGame())
    wx.setStorageSync("games", [createLocalGame()])
    wx.cloud = {
      callFunction: jest.fn(function(options) {
        options.success({
          result: {
            success: true,
            _id: "cloud-doc-1",
            gameId: "local_1000"
          }
        })
      })
    }

    const result = await cloudSync.syncNow(createLocalGame())

    expect(result.success).toBe(true)
    expect(wx.cloud.callFunction).toHaveBeenCalledWith(expect.objectContaining({
      name: "gameAction",
      data: expect.objectContaining({
        action: "syncLocalGame",
        game: expect.objectContaining({ id: "local_1000" })
      })
    }))
    expect(wx.getStorageSync("currentGame")._id).toBe("cloud-doc-1")
    expect(wx.getStorageSync("currentGame").cloudSyncStatus).toBe("synced")
    expect(wx.getStorageSync("games")[0]._id).toBe("cloud-doc-1")
  })

  test("syncNow should skip when user openid is missing", async function() {
    wx.cloud = {
      callFunction: jest.fn()
    }

    const result = await cloudSync.syncNow(createLocalGame())

    expect(result.skipped).toBe(true)
    expect(wx.cloud.callFunction).not.toHaveBeenCalled()
  })

  test("syncNow should keep local game and mark failed when cloud upload fails", async function() {
    wx.setStorageSync("userInfo", { openid: "openid-1" })
    wx.setStorageSync("currentGame", createLocalGame())
    wx.setStorageSync("games", [createLocalGame()])
    wx.cloud = {
      callFunction: jest.fn(function(options) {
        options.fail({ errMsg: "network unavailable" })
      })
    }

    const result = await cloudSync.syncNow(createLocalGame())

    expect(result.success).toBe(false)
    expect(wx.getStorageSync("currentGame").id).toBe("local_1000")
    expect(wx.getStorageSync("currentGame").completed).toBe(false)
    expect(wx.getStorageSync("currentGame").cloudSyncStatus).toBe("failed")
    expect(wx.getStorageSync("currentGame").cloudSyncError).toBe("network unavailable")
    expect(wx.getStorageSync("games")[0].id).toBe("local_1000")
    expect(wx.getStorageSync("games")[0].cloudSyncStatus).toBe("failed")
  })
})
