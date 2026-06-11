const path = require("path")
const fs = require("fs")
const { loadPage } = require("../helpers/load-page")

describe("settings dev first-use reset", function() {
  test("loadData should expose devtools first-use reset controls in developer mode", function() {
    wx.setStorageSync("developerMode", true)
    wx.setStorageSync("devAlwaysFreshUser", true)
    wx.setStorageSync("games", [{ id: "game_1" }])
    wx.setStorageSync("courses", [{ id: "course_1" }])

    const page = loadPage(path.resolve(__dirname, "../../package-user/pages/settings/settings.js"))

    page.loadData()

    expect(page.data.isDeveloperMode).toBe(true)
    expect(page.data.isDevtools).toBe(true)
    expect(page.data.devAlwaysFreshUser).toBe(true)
    expect(page.data.gameCount).toBe(1)
    expect(page.data.courseCount).toBe(1)
  })

  test("toggleDevAlwaysFreshUser should persist setting", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-user/pages/settings/settings.js"))

    page.toggleDevAlwaysFreshUser({ detail: { value: true } })

    expect(wx.getStorageSync("devAlwaysFreshUser")).toBe(true)
    expect(page.data.devAlwaysFreshUser).toBe(true)
    expect(wx.showToast).toHaveBeenCalledWith({
      title: "启动时将模拟新用户",
      icon: "none"
    })
  })

  test("template should expose first-use reset in devtools without developer mode", function() {
    const template = fs.readFileSync(path.resolve(__dirname, "../../package-user/pages/settings/settings.wxml"), "utf8")

    expect(template).toContain('wx:if="{{isDevtools || isDeveloperMode}}"')
    expect(template).toContain("重置新用户体验")
    expect(template).toContain('wx:if="{{isDeveloperMode}}"')
  })

  test("settings page should only expose closed-loop settings", function() {
    const template = fs.readFileSync(path.resolve(__dirname, "../../package-user/pages/settings/settings.wxml"), "utf8")
    const source = fs.readFileSync(path.resolve(__dirname, "../../package-user/pages/settings/settings.js"), "utf8")

    expect(template).toContain("数据管理")
    expect(template).toContain("备份数据")
    expect(template).toContain("恢复数据")
    expect(template).toContain("关于")
    expect(template).not.toContain("通用设置")
    expect(template).not.toContain("记分设置")
    expect(template).not.toContain("默认发球台")
    expect(template).not.toContain("自动锁屏")
    expect(template).not.toContain("默认记分员")
    expect(template).not.toContain("语音播报")
    expect(template).not.toContain("震动反馈")
    expect(template).not.toContain("自动完成确认")
    expect(template).not.toContain("默认显示比洞赛")
    expect(source).not.toContain("loadSettings")
    expect(source).not.toContain("saveSettings")
    expect(source).not.toContain("toggleVoiceBroadcast")
  })
})
