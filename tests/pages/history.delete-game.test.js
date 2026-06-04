const path = require("path")
const { loadPage } = require("../helpers/load-page")

function confirmNextModal() {
  wx.showModal.mockImplementation(function(options) {
    options.success({ confirm: true })
  })
}

describe("history delete game", function() {
  test("deleteGame should delete only matching gameId when games have no id", function() {
    confirmNextModal()
    const page = loadPage(path.resolve(__dirname, "../../package-game/pages/history/history.js"))
    page.loadData = jest.fn()
    wx.setStorageSync("games", [
      {
        gameId: "game-a",
        _id: "cloud-a",
        courseName: "A"
      },
      {
        gameId: "game-b",
        _id: "cloud-b",
        courseName: "B"
      },
      {
        id: "local-c",
        courseName: "C"
      }
    ])

    page.deleteGame({
      currentTarget: {
        dataset: {
          game: {
            gameId: "game-a",
            _id: "cloud-a",
            courseName: "A"
          }
        }
      }
    })

    const games = wx.getStorageSync("games")
    expect(games).toHaveLength(2)
    expect(games.map(function(game) { return game.gameId || game.id })).toEqual(["game-b", "local-c"])
  })

  test("deleteGame should clear currentGame only when it is the deleted game", function() {
    confirmNextModal()
    const page = loadPage(path.resolve(__dirname, "../../package-game/pages/history/history.js"))
    page.loadData = jest.fn()
    wx.setStorageSync("currentGame", {
      gameId: "game-b",
      _id: "cloud-b"
    })
    wx.setStorageSync("games", [
      { gameId: "game-a", _id: "cloud-a" },
      { gameId: "game-b", _id: "cloud-b" }
    ])

    page.deleteGame({
      currentTarget: {
        dataset: {
          game: {
            gameId: "game-a",
            _id: "cloud-a"
          }
        }
      }
    })

    expect(wx.getStorageSync("currentGame").gameId).toBe("game-b")
  })

  test("deleteGame should refuse records without any stable identity", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-game/pages/history/history.js"))
    wx.setStorageSync("games", [{ courseName: "No Id" }])

    page.deleteGame({
      currentTarget: {
        dataset: {
          game: {
            courseName: "No Id"
          }
        }
      }
    })

    expect(wx.showModal).not.toHaveBeenCalled()
    expect(wx.showToast).toHaveBeenCalledWith({
      title: "无法识别比赛记录",
      icon: "none"
    })
    expect(wx.getStorageSync("games")).toHaveLength(1)
  })
})
