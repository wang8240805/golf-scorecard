const path = require("path")
const { loadPage } = require("../helpers/load-page")
const ongoingGameStorage = require("../../utils/ongoing-game-storage")

function createHoles(count) {
  const holes = []
  for (let i = 1; i <= count; i++) {
    holes.push({ hole: i, par: 4 })
  }
  return holes
}

describe("scorecard page", function() {
  test("loadCourses should read cached courses without bundling packaged catalog data", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))

    page.loadCourses()

    expect(page.data.courses).toEqual([])
    expect(wx.getStorageSync("coursesInitialized")).toBeUndefined()
  })

  test("updateSyncStateText should show local state when not cloud game", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.data = { unsyncedCount: 3, syncStateText: "" }
    page.isCloudGame = false

    page.updateSyncStateText()

    expect(page.data.syncStateText).toBe("本地已保存")
  })

  test("updateSyncStateText should reflect pending count for cloud game", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.data = { unsyncedCount: 2, syncStateText: "" }
    page.isCloudGame = true

    page.updateSyncStateText()

    expect(page.data.syncStateText).toBe("待同步 2 条")
  })

  test("getReportGameId should prefer cloud gameId over missing local id", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))

    expect(page.getReportGameId({ gameId: "cloud-game-1" })).toBe("cloud-game-1")
    expect(page.getReportGameId({ id: "local-game-1" })).toBe("local-game-1")
    expect(page.getReportGameId({ _id: "doc-game-1" })).toBe("doc-game-1")
  })

  test("openGamePoster should generate poster for completed gameId-only scorecard", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    const scores = {}
    for (let i = 1; i <= 18; i++) {
      scores[i] = 4
    }
    page.data.currentGame = {
      gameId: "completed-cloud-game",
      courseName: "History Course",
      players: [{ id: "p1", name: "A", isMe: true }],
      scores: { p1: scores },
      completed: true,
      status: "completed"
    }
    page.generateAndShare = jest.fn()

    page.openGamePoster()

    expect(page.generateAndShare).toHaveBeenCalledWith(page.data.currentGame)
    expect(wx.navigateTo).not.toHaveBeenCalled()
  })

  test("sync-status summary should match snapshot", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.data = { unsyncedCount: 0, syncStateText: "" }
    page.isCloudGame = true

    page.updateSyncStateText()

    expect({
      isCloudGame: page.isCloudGame,
      unsyncedCount: page.data.unsyncedCount,
      syncStateText: page.data.syncStateText
    }).toMatchSnapshot()
  })

  test("loadGame should prefer requested unfinished game over stale currentGame", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    const holes = createHoles(18)
    page.gameId = "wanted"
    page.isCloudGame = false
    page.data.courses = [
      { id: "c1", name: "Old Course", holes: holes },
      { id: "c2", name: "Wanted Course", holes: holes }
    ]
    page.calculateLeader = jest.fn()

    wx.setStorageSync("currentGame", {
      id: "old",
      courseId: "c1",
      courseName: "Old Course",
      players: [{ id: "p1", name: "A" }],
      scores: { p1: {} },
      completed: false
    })
    wx.setStorageSync("games", [{
      id: "wanted",
      courseId: "c2",
      courseName: "Wanted Course",
      players: [{ id: "p1", name: "A" }],
      scores: { p1: {} },
      completed: false
    }])

    page.loadGame()

    expect(page.data.currentGame.id).toBe("wanted")
    expect(wx.getStorageSync("currentGame").id).toBe("wanted")
  })

  test("loadGame should keep requested readonly history game when another game is ongoing", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    const holes = createHoles(18)
    page.gameId = "history-1"
    page.isCloudGame = false
    page.isReadonlyMode = true
    page.data.courses = [
      { id: "c-history", name: "History Course", holes: holes },
      { id: "c-live", name: "Live Course", holes: holes }
    ]
    page.calculateLeader = jest.fn()

    wx.setStorageSync("currentGame", {
      id: "history-1",
      courseId: "c-history",
      courseName: "History Course",
      players: [{ id: "p1", name: "A" }],
      scores: { p1: { 1: 4 } },
      completed: true,
      status: "completed"
    })
    wx.setStorageSync("games", [{
      id: "live-1",
      courseId: "c-live",
      courseName: "Live Course",
      players: [{ id: "p1", name: "A" }],
      scores: { p1: { 1: 5 } },
      completed: false,
      updateTime: Date.now()
    }])

    page.loadGame()

    expect(page.data.currentGame.id).toBe("history-1")
    expect(page.calculateLeader.mock.calls[0][1].name).toBe("History Course")
  })

  test("loadGame should not restore ongoing game for readonly storage entry without gameId", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    const holes = createHoles(18)
    page.isCloudGame = false
    page.isReadonlyMode = true
    page.data.courses = [
      { id: "c-history", name: "History Course", holes: holes },
      { id: "c-live", name: "Live Course", holes: holes }
    ]
    page.calculateLeader = jest.fn()

    wx.setStorageSync("currentGame", {
      gameId: "history-gameid-only",
      courseId: "c-history",
      courseName: "History Course",
      players: [{ id: "p1", name: "A" }],
      scores: { p1: { 1: 4 } },
      completed: true,
      status: "completed"
    })
    wx.setStorageSync("games", [{
      id: "live-1",
      courseId: "c-live",
      courseName: "Live Course",
      players: [{ id: "p1", name: "A" }],
      scores: { p1: { 1: 5 } },
      completed: false,
      updateTime: Date.now()
    }])

    page.loadGame()

    expect(page.data.currentGame.gameId).toBe("history-gameid-only")
    expect(page.calculateLeader.mock.calls[0][1].name).toBe("History Course")
  })

  test("loadGame should initialize missing score maps for restored games", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    const holes = createHoles(18)
    page.isCloudGame = false
    page.data.courses = [
      { id: "c1", name: "Recover Course", holes: holes }
    ]

    wx.setStorageSync("currentGame", {
      id: "g-missing-scores",
      courseId: "c1",
      courseName: "Recover Course",
      players: [{ id: "p1", name: "A" }],
      completed: false
    })

    expect(function() {
      page.loadGame()
    }).not.toThrow()
    expect(page.data.currentGame.scores.p1).toEqual({})
    expect(page.data.currentGame.putts.p1).toEqual({})
    expect(page.data.currentGame.fairways.p1).toEqual({})
    expect(page.data.currentGame.penalties.p1).toEqual({})
  })

  test("confirmScore should persist cloud game locally before cloud update succeeds", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    const holes = createHoles(18)
    page.isCloudGame = true
    page.gameId = "cloud-game-1"
    page.hideScoreInput = jest.fn()
    page.calculateLeader = jest.fn()
    page.checkAndAutoAdvance = jest.fn()
    page.data = {
      currentHole: 1,
      currentHoleData: { hole: 1, par: 4 },
      holes: holes,
      courses: [{ id: "c1", name: "Cloud Course", holes: holes }],
      scoreGridData: [{
        hole: 1,
        scores: [{ playerId: "p1", display: "-", class: "" }]
      }],
      scoreActionStack: [],
      editingScore: {
        playerId: "p1",
        strokes: 5,
        putts: 2,
        fairway: "hit",
        penalty: 0
      },
      currentGame: {
        id: "cloud-game-1",
        gameId: "cloud-game-1",
        courseId: "c1",
        courseName: "Cloud Course",
        players: [{ id: "p1", name: "A" }],
        scores: { p1: {} },
        putts: { p1: {} },
        fairways: { p1: {} },
        penalties: { p1: {} },
        completed: false,
        status: "playing"
      }
    }
    wx.cloud = {
      callFunction: jest.fn(function(options) {
        options.fail({ errMsg: "network unavailable" })
      })
    }

    page.confirmScore()

    expect(wx.cloud.callFunction).toHaveBeenCalled()
    expect(wx.getStorageSync("currentGame").scores.p1[1]).toBe(5)
    expect(wx.getStorageSync("games")[0].scores.p1[1]).toBe(5)
    expect(ongoingGameStorage.findStoredGameById("cloud-game-1").scores.p1[1]).toBe(5)
    expect(wx.getStorageSync("currentGame").pendingScoreSyncQueue).toHaveLength(1)
    expect(wx.getStorageSync("currentGame").pendingScoreSyncQueue[0]).toEqual(expect.objectContaining({
      gameId: "cloud-game-1",
      playerId: "p1",
      hole: 1,
      strokes: 5,
      putts: 2
    }))
  })

  test("shouldLoadGameFromCloud should prefer file-backed ongoing cloud game", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    ongoingGameStorage.saveCurrentGame({
      id: "cloud-game-file",
      gameId: "cloud-game-file",
      courseId: "c1",
      courseName: "Cloud Course",
      players: [{ id: "p1", name: "A" }],
      scores: { p1: { 1: 5 } },
      completed: false,
      status: "playing",
      updateTime: Date.now()
    })
    wx.clearStorageSync()

    expect(page.shouldLoadGameFromCloud("cloud-game-file")).toBe(false)
    expect(wx.getStorageSync("currentGame").scores.p1[1]).toBe(5)
  })

  test("onLoad should restore file-backed cloud draft and flush pending score sync", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    const holes = createHoles(18)
    ongoingGameStorage.saveCurrentGame({
      id: "cloud-game-restore",
      gameId: "cloud-game-restore",
      courseId: "c1",
      courseName: "Cloud Course",
      players: [{ id: "p1", name: "A" }],
      scores: { p1: { 1: 5 } },
      putts: { p1: { 1: 2 } },
      holes: holes,
      pendingScoreSyncQueue: [{
        syncKey: "cloud-game-restore:p1:1",
        gameId: "cloud-game-restore",
        playerId: "p1",
        hole: 1,
        strokes: 5,
        putts: 2,
        modifierName: "球友"
      }],
      completed: false,
      status: "playing",
      updateTime: Date.now()
    })
    wx.clearStorageSync()
    wx.cloud = {
      callFunction: jest.fn(function(options) {
        options.success({ result: { success: true } })
      })
    }
    page.calculateLeader = jest.fn()

    page.onLoad({ gameId: "cloud-game-restore" })

    expect(page.isCloudGame).toBe(true)
    expect(page.preferLocalGame).toBe(true)
    expect(wx.cloud.callFunction).toHaveBeenCalledWith(expect.objectContaining({
      name: "updateScore",
      data: expect.objectContaining({
        gameId: "cloud-game-restore",
        playerId: "p1",
        hole: 1,
        strokes: 5,
        putts: 2
      })
    }))
    expect(wx.getStorageSync("currentGame").pendingScoreSyncQueue).toEqual([])
  })

  test("onLoad should keep local gameId in local mode", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.loadCloudGame = jest.fn()
    page.loadCourses = jest.fn()
    page.loadGame = jest.fn()
    page.checkSystemInfo = jest.fn()

    page.onLoad({ gameId: "local_1000" })

    expect(page.gameId).toBe("local_1000")
    expect(page.isCloudGame).toBe(false)
  })

  test("onLoad should keep matching stored unfinished game in local mode even when id is not local-prefixed", function() {
    wx.setStorageSync("currentGame", {
      id: "g-resume",
      courseId: "c1",
      courseName: "Recover Course",
      players: [{ id: "p1", name: "A" }],
      scores: { p1: {} },
      completed: false
    })
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.loadCloudGame = jest.fn()
    page.loadCourses = jest.fn()
    page.loadGame = jest.fn()
    page.checkSystemInfo = jest.fn()

    page.onLoad({ gameId: "g-resume" })

    expect(page.isCloudGame).toBe(false)
  })

  test("onLoad should load unmatched non-local gameId from cloud", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.loadCloudGame = jest.fn()
    page.loadCourses = jest.fn()
    page.loadGame = jest.fn()
    page.checkSystemInfo = jest.fn()

    page.onLoad({ gameId: "cloud-game-1" })

    expect(page.isCloudGame).toBe(true)
  })

  test("onLoad should clear stale readonly mode for normal scorecard entry", function() {
    wx.setStorageSync("viewMode", "readonly")
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.loadCourses = jest.fn()
    page.loadGame = jest.fn()
    page.checkSystemInfo = jest.fn()

    page.onLoad({})

    expect(page.isReadonlyMode).toBe(false)
    expect(wx.getStorageSync("viewMode")).toBeUndefined()
  })

  test("setCurrentHole should align the active hole below score grid totals", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.data = {
      holes: createHoles(18),
      currentHole: 1,
      currentHoleData: { hole: 1, par: 4 },
      scoreGridData: createHoles(18),
      scoreGridScrollTop: 0,
      scoreGridRowHeight: 0,
      scoreGridViewportHeight: 0
    }

    page.setCurrentHole(10)

    expect(page.data.currentHole).toBe(10)
    expect(page.data.currentHoleData).toEqual({ hole: 10, par: 4 })
    expect(page.data.scoreGridScrollTop).toBe(432)
    expect(wx.getStorageSync("currentHole")).toBe(10)
  })

  test("cloud watch login failure should stop realtime retries without console error", function() {
    jest.useFakeTimers()
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    const watchError = new Error("errCode: -402002 realtime listener init watch fail | errMsg: login fail Error: invalid state: ws connection not exists")
    const close = jest.fn()
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(function() {})
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation(function() {})
    page.isCloudGame = true
    page.data = {
      syncStateText: "云端同步中"
    }

    wx.cloud = {
      database: function() {
        return {
          collection: function() {
            return {
              doc: function() {
                return {
                  watch: function(options) {
                    options.onError(watchError)
                    return { close: close }
                  }
                }
              }
            }
          }
        }
      }
    }

    page.watchCloudGame("cloud-game-1")
    jest.runOnlyPendingTimers()

    expect(page._cloudWatchDisabled).toBe(true)
    expect(page._watchRetryCount).toBe(0)
    expect(page.data.syncStateText).toBe("云端已加载")
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    expect(consoleWarnSpy).toHaveBeenCalled()

    consoleErrorSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    jest.useRealTimers()
  })
})
