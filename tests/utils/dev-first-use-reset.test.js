const devFirstUseReset = require("../../utils/dev-first-use-reset")

describe("utils/dev-first-use-reset", function() {
  test("resetFirstUseState should clear first-use blockers but keep dev flags", function() {
    wx.setStorageSync("developerMode", true)
    wx.setStorageSync("devAlwaysFreshUser", true)
    wx.setStorageSync("userInfo", { openid: "openid_1", nickName: "A", avatarUrl: "avatar" })
    wx.setStorageSync("winparPrivacyAgreedAt", Date.now())
    wx.setStorageSync("currentGame", { id: "game_1" })
    wx.setStorageSync("currentHole", 3)

    devFirstUseReset.resetFirstUseState()

    expect(wx.getStorageSync("developerMode")).toBe(true)
    expect(wx.getStorageSync("devAlwaysFreshUser")).toBe(true)
    expect(wx.getStorageSync("userInfo")).toBeUndefined()
    expect(wx.getStorageSync("winparPrivacyAgreedAt")).toBeUndefined()
    expect(wx.getStorageSync("currentGame")).toBeUndefined()
    expect(wx.getStorageSync("currentHole")).toBeUndefined()
  })

  test("resetOnLaunchIfNeeded should only run in devtools with auto reset enabled", function() {
    wx.setStorageSync("developerMode", true)
    wx.setStorageSync("devAlwaysFreshUser", true)
    wx.setStorageSync("userInfo", { openid: "openid_1" })

    expect(devFirstUseReset.resetOnLaunchIfNeeded()).toBe(true)
    expect(wx.getStorageSync("developerMode")).toBe(true)
    expect(wx.getStorageSync("devAlwaysFreshUser")).toBe(true)
    expect(wx.getStorageSync("userInfo")).toBeUndefined()
  })

  test("resetOnLaunchIfNeeded should skip when auto reset is off", function() {
    wx.setStorageSync("userInfo", { openid: "openid_1" })

    expect(devFirstUseReset.resetOnLaunchIfNeeded()).toBe(false)
    expect(wx.getStorageSync("userInfo")).toEqual({ openid: "openid_1" })
  })
})
