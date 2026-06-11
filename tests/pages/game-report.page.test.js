const path = require("path")
const fs = require("fs")
const { loadPage } = require("../helpers/load-page")

describe("game report page", function() {
  test("loadFromStorage should find history game by gameId field", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-game/pages/game-report/game-report.js"))
    const game = {
      gameId: "report-gameid-only",
      courseName: "Report Course",
      players: [{ id: "p1", name: "A", isMe: true }],
      scores: { p1: { 1: 4 } },
      completed: true,
      status: "completed"
    }
    wx.setStorageSync("games", [game])
    page.gameId = "report-gameid-only"
    page.applyReportGame = jest.fn()
    page.loadReportFromCloud = jest.fn()

    page.loadFromStorage()

    expect(page.applyReportGame).toHaveBeenCalledWith(game)
    expect(page.loadReportFromCloud).not.toHaveBeenCalled()
  })

  test("wxml should render poster page instead of analysis report page", function() {
    const wxml = fs.readFileSync(path.resolve(__dirname, "../../package-game/pages/game-report/game-report.wxml"), "utf8")

    expect(wxml).toContain("比赛海报")
    expect(wxml).not.toContain("比赛分析报告")
    expect(wxml).not.toContain("AI 智能洞察")
    expect(wxml).not.toContain("亮点时刻")
    expect(wxml).not.toContain("改进空间")
    expect(wxml).not.toContain("AI 训练建议")
  })
})
