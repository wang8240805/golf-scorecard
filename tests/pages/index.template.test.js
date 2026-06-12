const fs = require("fs")
const path = require("path")

describe("index page template", function() {
  test("ongoing card should render only when hasOngoingGame is true", function() {
    const wxml = fs.readFileSync(
      path.resolve(__dirname, "../../pages/index/index.wxml"),
      "utf8"
    )

    expect(wxml).toContain('home-status-active" wx:if="{{hasOngoingGame && ongoingGame}}"')
    expect(wxml).not.toContain('home-status-active" wx:if="{{ongoingGame}}"')
  })

  test("home page should expose lightweight feedback entry", function() {
    const wxml = fs.readFileSync(
      path.resolve(__dirname, "../../pages/index/index.wxml"),
      "utf8"
    )
    const js = fs.readFileSync(
      path.resolve(__dirname, "../../pages/index/index.js"),
      "utf8"
    )

    expect(wxml).toContain("遇到问题？反馈给我们")
    expect(wxml).toContain('bindtap="goToFeedback"')
    expect(js).toContain("utils/feedback.js")
  })
})
