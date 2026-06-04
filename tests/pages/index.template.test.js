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
})
