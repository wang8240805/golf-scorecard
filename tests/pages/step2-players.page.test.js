const path = require("path")
const fs = require("fs")
const { loadPage } = require("../helpers/load-page")

describe("step2 players page", function() {
  test("getLaunchGameId should accept direct share gameId", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.js"))

    expect(page.getLaunchGameId({ gameId: "game_123" })).toBe("game_123")
  })

  test("hasCompleteUserInfo should require openid, nickname, and avatar", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.js"))

    expect(page.hasCompleteUserInfo({ openid: "o1", nickName: "A", avatarUrl: "avatar" })).toBe(true)
    expect(page.hasCompleteUserInfo({ openid: "o1", nickName: "A" })).toBe(false)
    expect(page.hasCompleteUserInfo({ openid: "o1", avatarUrl: "avatar" })).toBe(false)
    expect(page.hasCompleteUserInfo({ nickName: "A", avatarUrl: "avatar" })).toBe(false)
  })

  test("getLaunchGameId should decode QR code scene gameId", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.js"))

    expect(page.getLaunchGameId({ scene: encodeURIComponent("game_456") })).toBe("game_456")
  })

  test("initGame should join QR scene game instead of creating a new game", async function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.js"))
    const userInfo = { openid: "openid_1", nickName: "A", avatarUrl: "" }
    page.getUserInfo = jest.fn(function() {
      return Promise.resolve(userInfo)
    })
    page.joinGame = jest.fn()
    page.createNewGame = jest.fn()

    await page.initGame({ scene: encodeURIComponent("game_789") })

    expect(page.joinGame).toHaveBeenCalledWith("game_789", userInfo)
    expect(page.createNewGame).not.toHaveBeenCalled()
  })

  test("getUserInfo should request profile when cached user is missing avatar", async function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.js"))
    wx.setStorageSync("userInfo", { openid: "openid_1", nickName: "Cached" })
    page.loadCloudUserInfo = jest.fn(function() {
      return Promise.resolve(null)
    })
    page.getOpenid = jest.fn()
    page.getUserProfile = jest.fn(function() {
      return Promise.resolve({ nickName: "Cached", avatarUrl: "avatar-url" })
    })

    const userInfo = await page.getUserInfo()

    expect(page.getOpenid).not.toHaveBeenCalled()
    expect(page.getUserProfile).toHaveBeenCalled()
    expect(userInfo).toEqual(expect.objectContaining({
      openid: "openid_1",
      nickName: "Cached",
      avatarUrl: "avatar-url"
    }))
    expect(wx.getStorageSync("userInfo").avatarUrl).toBe("avatar-url")
  })

  test("getUserInfo should only fetch openid when cached nickname and avatar already exist", async function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.js"))
    wx.setStorageSync("userInfo", { nickName: "Cached", avatarUrl: "avatar-url" })
    page.getOpenid = jest.fn(function() {
      return Promise.resolve("openid_2")
    })
    page.getUserProfile = jest.fn()

    const userInfo = await page.getUserInfo()

    expect(page.getOpenid).toHaveBeenCalled()
    expect(page.getUserProfile).not.toHaveBeenCalled()
    expect(userInfo).toEqual(expect.objectContaining({
      openid: "openid_2",
      nickName: "Cached",
      avatarUrl: "avatar-url"
    }))
  })

  test("confirmAuth should require avatar and nickname before resolving", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.js"))
    const resolve = jest.fn()
    page.authResolve = resolve
    page.setData({
      showAuth: true,
      tempNickName: "A",
      tempAvatar: ""
    })

    page.confirmAuth()

    expect(wx.showToast).toHaveBeenCalledWith({ title: "请选择微信头像", icon: "none" })
    expect(resolve).not.toHaveBeenCalled()
    expect(page.data.showAuth).toBe(true)
  })

  test("confirmAuth should resolve trimmed nickname with selected avatar", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.js"))
    const resolve = jest.fn()
    page.authResolve = resolve
    page.setData({
      showAuth: true,
      tempNickName: "  Alice  ",
      tempAvatar: "avatar-url",
      tempPhone: ""
    })

    page.confirmAuth()

    expect(resolve).toHaveBeenCalledWith({
      nickName: "Alice",
      avatarUrl: "avatar-url",
      phoneNumber: ""
    })
    expect(page.data.showAuth).toBe(false)
  })

  test("auth modal should not ask for account or phone sync during first-use flow", function() {
    const template = fs.readFileSync(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.wxml"), "utf8")

    expect(template).not.toMatch(/同步账号|账号同步|授权手机号|一键授权手机号|已授权手机号|手机号|getPhoneNumber/)
  })
})
