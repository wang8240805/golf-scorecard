const path = require("path")
const { loadPage } = require("../helpers/load-page")

describe("step2 players page", function() {
  test("getLaunchGameId should accept direct share gameId", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.js"))

    expect(page.getLaunchGameId({ gameId: "game_123" })).toBe("game_123")
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
})
