const fs = require("fs")
const path = require("path")

describe("feedback entries", function() {
  test("scorecard error paths should use feedback helper", function() {
    const source = fs.readFileSync(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"), "utf8")

    expect(source).toContain("utils/feedback.js")
    expect(source).toContain("getScorecardFeedbackContext")
    expect(source).toContain("type: 'scorecard_error'")
    expect(source).toContain("type: 'ocr_error'")
    expect(source).toContain("生成二维码失败")
    expect(source).toContain("同步失败")
    expect(source).toContain("确认失败")
  })

  test("game report error paths should use feedback helper", function() {
    const source = fs.readFileSync(path.resolve(__dirname, "../../package-game/pages/game-report/game-report.js"), "utf8")

    expect(source).toContain("utils/feedback.js")
    expect(source).toContain("getReportFeedbackContext")
    expect(source).toContain("type: 'report_error'")
    expect(source).toContain("加载报告失败")
    expect(source).toContain("生成海报失败")
    expect(source).toContain("保存失败")
  })
})
