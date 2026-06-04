const path = require("path")
const { loadPage } = require("../helpers/load-page")

function createHoles(count, par) {
  const holes = []
  for (let i = 1; i <= count; i++) {
    holes.push({ hole: i, par: par || 4 })
  }
  return holes
}

function createCourse() {
  return {
    id: "course-1",
    name: "Flow Test Course",
    holes: createHoles(18, 4),
    holesVerified: true
  }
}

function startLocalRound() {
  const step2 = loadPage(path.resolve(__dirname, "../../pages/new-game/step2-players/step2-players.js"))
  const course = createCourse()
  step2.data.currentCourse = course
  step2.data.gameId = "local_flow"
  step2.data.isCreator = true
  step2.data.holeCount = 18
  step2.data.players = [
    { id: "p1", name: "A", openid: "openid-a", isCreator: true },
    { id: "p2", name: "B", openid: "manual-b" }
  ]
  wx.setStorageSync("courses", [course])

  step2.startGame()

  return {
    step2,
    course
  }
}

function loadScorecard() {
  const scorecard = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
  scorecard.checkSystemInfo = jest.fn()
  scorecard.calculatePendingConfirmations = jest.fn()
  scorecard.updateCoursePlayCount = jest.fn()
  scorecard.onLoad({ gameId: "local_flow" })
  return scorecard
}

function enterScore(page, playerId, strokes, putts) {
  page.data.editingScore = {
    playerId: playerId,
    playerName: playerId,
    strokes: strokes,
    putts: putts || 2,
    fairway: "hit",
    penalty: 0
  }
  page.confirmScore()
}

describe("full product journey", function() {
  test("local round can start, record scores, continue from home, and save partial round back to home", function() {
    jest.useFakeTimers()

    const index = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    index.startNewGame()
    expect(wx.navigateTo).toHaveBeenLastCalledWith({
      url: "/package-courses/pages/new-game/step1-course/step1-course"
    })

    startLocalRound()
    expect(wx.redirectTo).toHaveBeenCalledWith(expect.objectContaining({
      url: "/pages/scorecard/scorecard?gameId=local_flow"
    }))
    expect(wx.getStorageSync("currentGame").id).toBe("local_flow")
    expect(wx.getStorageSync("games")).toHaveLength(1)

    const scorecard = loadScorecard()
    expect(scorecard.data.currentGame.id).toBe("local_flow")
    expect(scorecard.isCloudGame).toBe(false)
    expect(scorecard.isReadonlyMode).toBe(false)

    enterScore(scorecard, "p1", 4, 2)
    enterScore(scorecard, "p2", 5, 2)
    expect(wx.getStorageSync("currentGame").scores.p1[1]).toBe(4)
    expect(wx.getStorageSync("currentGame").scores.p2[1]).toBe(5)
    wx.setStorageSync("games", wx.getStorageSync("games").concat([{
      gameId: "local_flow",
      courseId: "course-1",
      courseName: "Flow Test Course",
      players: [
        { id: "p1", name: "A", openid: "openid-a", isCreator: true },
        { id: "p2", name: "B", openid: "manual-b" }
      ],
      scores: { p1: { 1: 4 }, p2: { 1: 5 } },
      completed: false,
      updateTime: Date.now() + 1
    }]))

    index.checkOngoingGame()
    expect(index.data.hasOngoingGame).toBe(true)
    index.goToScorecard()
    expect(wx.navigateTo).toHaveBeenLastCalledWith({
      url: "/pages/scorecard/scorecard?gameId=local_flow"
    })

    scorecard.finishGame()
    const modal = wx.showModal.mock.calls[0][0]
    expect(modal.title).toBe("保存部分成绩？")
    modal.success({ confirm: true })
    jest.runOnlyPendingTimers()

    const savedGames = wx.getStorageSync("games")
    expect(savedGames).toHaveLength(1)
    expect(savedGames[0].completed).toBe(true)
    expect(savedGames[0].status).toBe("completed")
    expect(savedGames[0].roundType).toBe("partial")
    expect(wx.getStorageSync("completedGameKeys")).toContain("local_flow")
    expect(wx.getStorageSync("currentGame")).toBeUndefined()
    expect(wx.switchTab).toHaveBeenCalledWith({
      url: "/pages/index/index"
    })

    index.checkOngoingGame()
    expect(index.data.hasOngoingGame).toBe(false)
    jest.useRealTimers()
  })

  test("complete 18-hole round finishes without readonly or ongoing-state leakage", function() {
    startLocalRound()
    const scorecard = loadScorecard()
    scorecard.generateAndShare = jest.fn()

    for (let hole = 1; hole <= 18; hole++) {
      scorecard.setCurrentHole(hole)
      enterScore(scorecard, "p1", 4, 2)
      enterScore(scorecard, "p2", 5, 2)
    }

    scorecard.finishGame()

    expect(wx.showModal).not.toHaveBeenCalled()
    expect(scorecard.generateAndShare).toHaveBeenCalledTimes(1)
    expect(scorecard.generateAndShare.mock.calls[0][0].roundType).toBe("complete")
    expect(wx.getStorageSync("currentGame")).toBeUndefined()
    expect(wx.getStorageSync("viewMode")).toBeUndefined()
  })

  test("stale readonly flag from history does not affect a new normal scorecard entry", function() {
    wx.setStorageSync("viewMode", "readonly")
    startLocalRound()
    const scorecard = loadScorecard()

    expect(scorecard.isReadonlyMode).toBe(false)
    expect(wx.getStorageSync("viewMode")).toBeUndefined()
  })
})
