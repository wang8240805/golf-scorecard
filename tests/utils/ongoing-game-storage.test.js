const ongoingGameStorage = require("../../utils/ongoing-game-storage")

describe("utils/ongoing-game-storage", function() {
  afterEach(function() {
    jest.restoreAllMocks()
  })

  test("saveCurrentGame should mirror an unfinished game into games", function() {
    const game = {
      id: "g-ongoing",
      courseId: "c1",
      courseName: "Test Course",
      players: [{ id: "p1", name: "A" }],
      scores: { p1: { 1: 4 } },
      completed: false,
      timestamp: 1000
    }

    ongoingGameStorage.saveCurrentGame(game)

    expect(wx.getStorageSync("currentGame").id).toBe("g-ongoing")
    expect(wx.getStorageSync("games")).toHaveLength(1)
    expect(wx.getStorageSync("games")[0].id).toBe("g-ongoing")
  })

  test("getRestoredOngoingGame should restore from games when currentGame is missing", function() {
    jest.spyOn(Date, "now").mockReturnValue(5000)
    wx.setStorageSync("games", [
      { id: "old", completed: false, updateTime: 1000 },
      { id: "done", completed: true, updateTime: 3000 },
      { id: "latest", completed: false, updateTime: 2000 }
    ])

    const restored = ongoingGameStorage.getRestoredOngoingGame()

    expect(restored.id).toBe("latest")
    expect(wx.getStorageSync("currentGame").id).toBe("latest")
  })

  test("getRestoredOngoingGame should ignore completed games", function() {
    wx.setStorageSync("games", [
      { id: "done", completed: true, updateTime: 3000 },
      { id: "status-done", status: "completed", updateTime: 4000 }
    ])

    expect(ongoingGameStorage.getRestoredOngoingGame()).toBeNull()
  })

  test("getRestoredOngoingGame should ignore waiting games", function() {
    wx.setStorageSync("games", [
      { id: "waiting", status: "waiting", completed: false, updateTime: Date.now() }
    ])

    expect(ongoingGameStorage.getRestoredOngoingGame()).toBeNull()
  })

  test("getRestoredOngoingGame should ignore stale cloud playing games", function() {
    jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-05-26T00:00:00Z"))
    wx.setStorageSync("currentGame", {
      _id: "old-cloud-doc",
      gameId: "old-cloud-game",
      status: "playing",
      completed: false,
      updateTime: "2026-03-23T09:25:39.460Z"
    })
    wx.setStorageSync("games", [{
      _id: "old-cloud-doc",
      gameId: "old-cloud-game",
      status: "playing",
      completed: false,
      updateTime: "2026-03-23T09:25:39.460Z"
    }])

    expect(ongoingGameStorage.getRestoredOngoingGame()).toBeNull()
    expect(wx.getStorageSync("currentGame")).toBeUndefined()
  })

  test("getRestoredOngoingGame should keep recent playing games", function() {
    jest.spyOn(Date, "now").mockReturnValue(Date.parse("2026-05-26T00:00:00Z"))
    wx.setStorageSync("games", [{
      id: "recent-playing",
      status: "playing",
      completed: false,
      updateTime: "2026-05-25T00:00:00Z"
    }])

    const restored = ongoingGameStorage.getRestoredOngoingGame()

    expect(restored.id).toBe("recent-playing")
    expect(wx.getStorageSync("currentGame").id).toBe("recent-playing")
  })

  test("mergeGameIntoList should replace the same game instead of duplicating it", function() {
    const merged = ongoingGameStorage.mergeGameIntoList([
      { id: "same", courseName: "Old" }
    ], {
      id: "same",
      courseName: "Updated"
    })

    expect(merged).toHaveLength(1)
    expect(merged[0].courseName).toBe("Updated")
  })

  test("mergeGameIntoList should treat id and gameId as the same identity", function() {
    const merged = ongoingGameStorage.mergeGameIntoList([
      { id: "local_same", courseName: "Old" }
    ], {
      gameId: "local_same",
      courseName: "Updated"
    })

    expect(merged).toHaveLength(1)
    expect(merged[0].courseName).toBe("Updated")
  })

  test("getRestoredOngoingGame should ignore stale unfinished duplicate after completion", function() {
    wx.setStorageSync("games", [
      {
        _id: "cloud-doc-1",
        gameId: "cloud-game-1",
        courseName: "Old Playing Copy",
        completed: false,
        status: "playing",
        updateTime: 5000
      },
      {
        _id: "cloud-doc-1",
        gameId: "cloud-game-1",
        courseName: "Completed Copy",
        completed: true,
        status: "completed",
        updateTime: 4000
      }
    ])

    expect(ongoingGameStorage.getRestoredOngoingGame()).toBeNull()
    expect(wx.getStorageSync("currentGame")).toBeUndefined()
  })

  test("getRestoredOngoingGame should ignore currentGame with completed marker", function() {
    ongoingGameStorage.markGameCompleted({
      _id: "cloud-doc-2",
      gameId: "cloud-game-2"
    })
    wx.setStorageSync("currentGame", {
      _id: "cloud-doc-2",
      gameId: "cloud-game-2",
      completed: false,
      status: "playing"
    })
    wx.setStorageSync("games", [{
      _id: "cloud-doc-2",
      gameId: "cloud-game-2",
      completed: false,
      status: "playing",
      updateTime: 9000
    }])

    expect(ongoingGameStorage.getRestoredOngoingGame()).toBeNull()
    expect(wx.getStorageSync("currentGame")).toBeUndefined()
  })
})
