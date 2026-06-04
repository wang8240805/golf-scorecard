const fs = require("fs")
const path = require("path")
const { loadPage } = require("../helpers/load-page")

describe("profile navigation", function() {
  test("settings cells should listen to Vant click events", function() {
    const wxml = fs.readFileSync(path.resolve(__dirname, "../../pages/profile/profile.wxml"), "utf8")

    expect(wxml).toContain('bind:click="goToSettings"')
    expect(wxml).toContain('bind:click="goToFeedback"')
    expect(wxml).toContain('bind:click="goToAbout"')
    expect(wxml).toContain('bind:click="logout"')
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
})
