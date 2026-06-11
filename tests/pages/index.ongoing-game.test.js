const path = require("path")
const { loadPage } = require("../helpers/load-page")

function createOngoingGame() {
  return {
    id: "g-resume",
    courseId: "c1",
    courseName: "Recover Course",
    players: [{ id: "p1", name: "A", isMe: true }],
    scores: { p1: { 1: 4, 2: 5 } },
    holes: [
      { hole: 1, par: 4 },
      { hole: 2, par: 4 },
      { hole: 3, par: 3 }
    ],
    completed: false,
    updateTime: Date.now()
  }
}

describe("index ongoing game recovery", function() {
  afterEach(function() {
    jest.restoreAllMocks()
  })

  test("checkOngoingGame should restore the latest unfinished game from games", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    wx.setStorageSync("games", [createOngoingGame()])

    page.checkOngoingGame()

    expect(page.data.hasOngoingGame).toBe(true)
    expect(page.data.ongoingGame.id).toBe("g-resume")
    expect(page.data.ongoingGame.courseName).toBe("Recover Course")
    expect(page.data.ongoingGame.currentHole).toBe(3)
    expect(wx.getStorageSync("currentGame").id).toBe("g-resume")
  })

  test("goToScorecard should navigate after restoring currentGame from games", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    wx.setStorageSync("games", [createOngoingGame()])

    page.goToScorecard()

    expect(wx.showToast).not.toHaveBeenCalledWith(expect.objectContaining({
      title: "未找到进行中的比赛"
    }))
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/scorecard/scorecard?gameId=g-resume"
    })
  })

  test("viewScorecard should pass gameId-only history game to readonly scorecard", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    const game = {
      gameId: "history-gameid-only",
      courseName: "History Course",
      players: [{ id: "p1", name: "A", isMe: true }],
      scores: { p1: { 1: 4 } },
      completed: true,
      status: "completed"
    }

    page.viewScorecard(game)

    expect(wx.getStorageSync("currentGame").gameId).toBe("history-gameid-only")
    expect(wx.getStorageSync("viewMode")).toBe("readonly")
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/scorecard/scorecard?mode=readonly&gameId=history-gameid-only"
    })
  })

  test("viewGame should open legacy recent game without stored id", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    const legacyTimestamp = 1770000000000
    wx.setStorageSync("games", [{
      courseName: "Legacy Course",
      timestamp: legacyTimestamp,
      players: [{ id: "p1", name: "A", isMe: true }],
      scores: { p1: Object.fromEntries(Array.from({ length: 18 }, function(_, index) {
        return [index + 1, 4]
      })) },
      completed: true,
      status: "completed"
    }])

    page.viewGame({
      currentTarget: {
        dataset: {
          gameid: "local_" + legacyTimestamp
        }
      }
    })

    expect(wx.showToast).not.toHaveBeenCalledWith(expect.objectContaining({
      title: "比赛数据不存在"
    }))
    expect(wx.getStorageSync("currentGame").courseName).toBe("Legacy Course")
    expect(wx.getStorageSync("currentGame").id).toBe("local_" + legacyTimestamp)
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/scorecard/scorecard?mode=readonly&gameId=local_" + legacyTimestamp
    })
  })

  test("loadData should exclude ongoing games from recent games", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    const completedScores = Object.fromEntries(Array.from({ length: 18 }, function(_, index) {
      return [index + 1, 4]
    }))
    wx.setStorageSync("games", [
      Object.assign(createOngoingGame(), {
        id: "ongoing-newer",
        timestamp: 2000
      }),
      {
        id: "completed-older",
        courseName: "Completed Course",
        timestamp: 1000,
        players: [{ id: "p1", name: "A", isMe: true }],
        scores: { p1: completedScores },
        completed: true,
        status: "completed"
      }
    ])

    page.loadData()

    expect(page.data.recentGames).toHaveLength(1)
    expect(page.data.recentGames[0].id).toBe("completed-older")
    expect(page.data.recentGames[0].courseName).toBe("Completed Course")
  })

  test("viewGameReport should pass gameId-only history game to report page", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    const game = {
      gameId: "report-gameid-only",
      courseName: "Report Course",
      players: [{ id: "p1", name: "A", isMe: true }],
      scores: { p1: Object.fromEntries(Array.from({ length: 18 }, function(_, index) {
        return [index + 1, 4]
      })) },
      completed: true,
      status: "completed"
    }

    page.viewGameReport(game)

    expect(wx.getStorageSync("game_report-gameid-only").gameId).toBe("report-gameid-only")
    expect(wx.navigateTo).toHaveBeenCalledWith(expect.objectContaining({
      url: "/package-game/pages/game-report/game-report?gameId=report-gameid-only&poster=1"
    }))
  })

  test("quickContinueLatest should restore ongoing game before replay history", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    wx.setStorageSync("games", [
      {
        id: "completed-18",
        courseName: "Old Complete Course",
        completed: true,
        isCompleteRound: true,
        validScorePlayerIds: ["p1"],
        scores: { p1: { 1: 4 } },
        timestamp: 5000
      },
      createOngoingGame()
    ])

    page.quickContinueLatest()

    expect(wx.getStorageSync("currentGame").id).toBe("g-resume")
    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: "/pages/scorecard/scorecard"
    })
  })

  test("checkOngoingGame should not show stale unfinished copy after the same game is completed", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    wx.setStorageSync("games", [
      {
        _id: "cloud-doc-1",
        gameId: "cloud-game-1",
        courseName: "Still Playing Copy",
        players: [{ id: "p1", name: "A", isMe: true }],
        scores: { p1: { 1: 4 } },
        completed: false,
        status: "playing",
        updateTime: 9000
      },
      {
        _id: "cloud-doc-1",
        gameId: "cloud-game-1",
        courseName: "Completed Copy",
        players: [{ id: "p1", name: "A", isMe: true }],
        scores: { p1: { 1: 4 } },
        completed: true,
        status: "completed",
        updateTime: 8000
      }
    ])

    page.checkOngoingGame()

    expect(page.data.hasOngoingGame).toBe(false)
    expect(page.data.ongoingGame).toBeNull()
    expect(wx.getStorageSync("currentGame")).toBeUndefined()
  })

  test("checkOngoingGame should clear stale visible ongoing state when no ongoing game exists", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    page.data.hasOngoingGame = true
    page.data.ongoingGame = {
      id: "stale",
      courseName: "Stale Course"
    }
    page.data.ongoingDetail = {
      id: "stale"
    }
    page.data.showOngoingDetail = true

    page.checkOngoingGame()

    expect(page.data.hasOngoingGame).toBe(false)
    expect(page.data.ongoingGame).toBeNull()
    expect(page.data.ongoingDetail).toBeNull()
    expect(page.data.showOngoingDetail).toBe(false)
  })

  test("checkOngoingGame should not show old cloud playing rooms as ongoing", function() {
    jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-05-26T00:00:00Z"))
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    wx.setStorageSync("currentGame", {
      gameId: "game_1774257938038_1p1vpn",
      _id: "6a0a1fb669c107120141d5b31ca6e44f",
      courseName: "浙江银海高尔夫俱乐部",
      players: [{ id: "p1", name: "ws", isMe: true }],
      scores: { p1: {} },
      completed: false,
      status: "playing",
      updateTime: "2026-03-23T09:25:39.460Z"
    })
    wx.setStorageSync("games", [{
      gameId: "game_1774257938038_1p1vpn",
      _id: "6a0a1fb669c107120141d5b31ca6e44f",
      courseName: "浙江银海高尔夫俱乐部",
      players: [{ id: "p1", name: "ws", isMe: true }],
      scores: { p1: {} },
      completed: false,
      status: "playing",
      updateTime: "2026-03-23T09:25:39.460Z"
    }])

    page.checkOngoingGame()

    expect(page.data.hasOngoingGame).toBe(false)
    expect(page.data.ongoingGame).toBeNull()
    expect(wx.getStorageSync("currentGame")).toBeUndefined()
  })
})
