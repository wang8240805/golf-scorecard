const fs = require("fs")
const path = require("path")
const { loadPage } = require("../helpers/load-page")

describe("profile navigation", function() {
  test("settings cells should listen to Vant click events", function() {
    const wxml = fs.readFileSync(path.resolve(__dirname, "../../pages/profile/profile.wxml"), "utf8")

    expect(wxml).toContain("服务与支持")
    expect(wxml).toContain('bind:click="goToSettings"')
    expect(wxml).toContain('bind:click="goToFeedback"')
    expect(wxml).toContain('bind:click="goToAgreements"')
    expect(wxml).toContain('bind:click="goToAbout"')
    expect(wxml).toContain('bind:click="logout"')
    expect(wxml).toContain('wx:if="{{hasLoginInfo}}"')
    expect(wxml).toContain('title-class="logout-cell-title"')
    expect(wxml).toContain("用户协议与隐私")
    expect(wxml).toContain("关于 WinPAR")
    expect(wxml).not.toContain('title="用户服务协议"')
    expect(wxml).not.toContain('title="隐私政策"')
    expect(wxml).not.toContain('<van-cell title="设置" is-link bindtap=')
  })

  test("profile shortcut methods navigate to registered pages", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/profile/profile.js"))

    page.goToHistory()
    page.goToStatistics()
    page.goToCourses()
    page.goToPlayers()
    page.goToSettings()
    page.goToFeedback()

    expect(wx.navigateTo).toHaveBeenNthCalledWith(1, {
      url: "/package-game/pages/history/history"
    })
    expect(wx.navigateTo).toHaveBeenNthCalledWith(2, {
      url: "/package-game/pages/statistics/statistics"
    })
    expect(wx.navigateTo).toHaveBeenNthCalledWith(3, {
      url: "/package-courses/pages/courses/courses"
    })
    expect(wx.navigateTo).toHaveBeenNthCalledWith(4, {
      url: "/package-game/pages/players/players"
    })
    expect(wx.navigateTo).toHaveBeenNthCalledWith(5, {
      url: "/package-user/pages/settings/settings"
    })
    expect(wx.navigateTo).toHaveBeenNthCalledWith(6, {
      url: "/package-user/pages/feedback/feedback"
    })
  })

  test("goToAgreements should let users choose agreement or privacy policy", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/profile/profile.js"))
    wx.showActionSheet = jest.fn(function(options) {
      options.success({ tapIndex: 1 })
    })

    page.goToAgreements()

    expect(wx.showActionSheet).toHaveBeenCalledWith(expect.objectContaining({
      itemList: ["用户服务协议", "隐私政策"]
    }))
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: "/package-user/pages/webview/webview?type=privacyPolicy"
    })
  })

  test("logout entry should only show for users with nickname", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/profile/profile.js"))

    wx.setStorageSync("userInfo", { avatarUrl: "avatar-only" })
    page.loadUserInfo()
    expect(page.data.hasLoginInfo).toBe(false)

    wx.setStorageSync("userInfo", { nickName: "小王", avatarUrl: "avatar", openid: "openid-1" })
    page.loadUserInfo()
    expect(page.data.hasLoginInfo).toBe(true)
  })

  test("loadUserInfo should discard expired temporary avatar urls", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/profile/profile.js"))
    wx.setStorageSync("userInfo", {
      nickName: "小王",
      openid: "openid-1",
      avatarUrl: "http://127.0.0.1:32138/__tmp__/avatar.jpeg"
    })

    page.loadUserInfo()

    expect(page.data.avatarUrl).toContain("mmbiz.qpic.cn")
    expect(wx.getStorageSync("userInfo").avatarUrl).toBeUndefined()
  })

  test("saveAvatar should persist temporary avatar before storing it", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/profile/profile.js"))
    wx.setStorageSync("userInfo", {
      nickName: "小王"
    })

    page.saveAvatar("http://127.0.0.1:32138/__tmp__/avatar.jpeg")

    expect(wx.saveFile).toHaveBeenCalledWith(expect.objectContaining({
      tempFilePath: "http://127.0.0.1:32138/__tmp__/avatar.jpeg"
    }))
    expect(wx.getStorageSync("userInfo").avatarUrl).toBe("wxfile://usr/saved-avatar.jpg")
    expect(page.data.avatarUrl).toBe("wxfile://usr/saved-avatar.jpg")
  })
})
