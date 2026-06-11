const path = require("path")
const { loadPage } = require("../helpers/load-page")

function confirmNextModal() {
  wx.showModal.mockImplementation(function(options) {
    options.success({ confirm: true })
  })
}

describe("history delete game", function() {
  test("formatGames should create stable keys for records without id", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-game/pages/history/history.js"))

    const games = page.formatGames([
      { gameId: "game-a", courseName: "A", timestamp: 1 },
      { _id: "cloud-b", courseName: "B", timestamp: 2 }
    ])

    expect(games.map(function(game) { return game.historyKey })).toEqual([
      "gameId-game-a",
      "cloud-cloud-b"
    ])
  })

  test("loadMore should append beyond the first page", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-game/pages/history/history.js"))
    const games = Array.from({ length: 12 }).map(function(_, index) {
      return {
        id: "game-" + index,
        courseName: "Course " + index,
        timestamp: 1710000000000 + index,
        players: [{ id: "p1", name: "A", isMe: true }],
        scores: { p1: {} },
        completed: false,
        status: "playing"
      }
    })
    wx.setStorageSync("games", games)

    page.loadData()
    expect(page.data.games).toHaveLength(10)
    expect(page.data.totalGameCount).toBe(12)
    expect(page.data.hasMore).toBe(true)

    page.loadMore()
    expect(page.data.games).toHaveLength(12)
    expect(page.data.hasMore).toBe(false)
  })

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

  test("viewDetail should open completed game in readonly scorecard", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-game/pages/history/history.js"))

    page.viewDetail({
      currentTarget: {
        dataset: {
          game: {
            gameId: "completed-game",
            courseName: "Readonly Course",
            completed: true,
            status: "completed"
          }
        }
      }
    })

    expect(wx.getStorageSync("viewMode")).toBe("readonly")
    expect(wx.getStorageSync("currentGame").gameId).toBe("completed-game")
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/scorecard/scorecard?mode=readonly&gameId=completed-game"
    })
  })

  test("viewDetail should add a local id when opening legacy completed records", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-game/pages/history/history.js"))
    const timestamp = 1710000000000

    page.viewDetail({
      currentTarget: {
        dataset: {
          game: {
            timestamp: timestamp,
            courseId: "course-a",
            courseName: "Legacy Course",
            completed: true,
            status: "completed"
          }
        }
      }
    })

    expect(wx.getStorageSync("currentGame").id).toBe("local_" + timestamp)
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/scorecard/scorecard?mode=readonly&gameId=local_" + timestamp
    })
  })

  test("viewDetail should open unfinished game in editable scorecard", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-game/pages/history/history.js"))
    wx.setStorageSync("viewMode", "readonly")

    page.viewDetail({
      currentTarget: {
        dataset: {
          game: {
            id: "playing-game",
            courseName: "Playing Course",
            players: [{ id: "p1", name: "A" }],
            scores: { p1: { 1: 4 } },
            completed: false,
            status: "playing"
          }
        }
      }
    })

    expect(wx.getStorageSync("viewMode")).toBeUndefined()
    expect(wx.getStorageSync("currentGame").id).toBe("playing-game")
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/scorecard/scorecard?gameId=playing-game"
    })
  })

  test("deleteGame should delete legacy local records matched by timestamp and courseId", function() {
    confirmNextModal()
    const page = loadPage(path.resolve(__dirname, "../../package-game/pages/history/history.js"))
    page.loadData = jest.fn()
    wx.setStorageSync("currentGame", {
      timestamp: 1710000000000,
      courseId: "course-a",
      courseName: "A"
    })
    wx.setStorageSync("games", [
      {
        timestamp: 1710000000000,
        courseId: "course-a",
        courseName: "A"
      },
      {
        timestamp: 1710000000000,
        courseId: "course-b",
        courseName: "B"
      }
    ])

    page.deleteGame({
      currentTarget: {
        dataset: {
          game: {
            timestamp: 1710000000000,
            courseId: "course-a",
            courseName: "A"
          }
        }
      }
    })

    const games = wx.getStorageSync("games")
    expect(games).toHaveLength(1)
    expect(games[0].courseId).toBe("course-b")
    expect(wx.getStorageSync("currentGame")).toBeUndefined()
  })

  test("deleteGame should notify other pages after local deletion", function() {
    confirmNextModal()
    const originalGetApp = global.getApp
    const emit = jest.fn()
    try {
      global.getApp = function() {
        return {
          eventBus: { emit: emit }
        }
      }
      const page = loadPage(path.resolve(__dirname, "../../package-game/pages/history/history.js"))
      page.loadData = jest.fn()
      wx.setStorageSync("games", [{ gameId: "game-a", courseName: "A" }])

      page.deleteGame({
        currentTarget: {
          dataset: {
            game: {
              gameId: "game-a",
              courseName: "A"
            }
          }
        }
      })

      expect(emit).toHaveBeenCalledWith("gameDataChanged", {
        type: "delete",
        game: {
          gameId: "game-a",
          courseName: "A"
        }
      })
    } finally {
      global.getApp = originalGetApp
    }
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
