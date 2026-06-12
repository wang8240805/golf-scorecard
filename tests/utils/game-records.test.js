const gameRecords = require("../../utils/game-records")

function completeGame(id, timestamp) {
  const scores = Array.from({ length: 18 }).reduce(function(acc, _, index) {
    acc[index + 1] = 4
    return acc
  }, {})
  return {
    id: id,
    timestamp: timestamp,
    courseId: "course-" + id,
    courseName: "Course " + id,
    players: [{ id: "p1", name: "A", isMe: true }],
    scores: { p1: scores },
    completed: true,
    status: "completed"
  }
}

describe("game records cleanup", function() {
  test("sanitizeGames should remove known mock and deleted records only", function() {
    const real = completeGame("real-game", 3000)
    const clean = gameRecords.sanitizeGames([
      completeGame("mock-game-1", 5000),
      completeGame("game_20260302_001", 4000),
      Object.assign(completeGame("deleted-game", 2000), { deleted: true }),
      real
    ])

    expect(clean).toEqual([real])
  })

  test("cleanStoredGames should persist cleanup and clear mock currentGame", function() {
    wx.setStorageSync("games", [
      completeGame("mock-game-2", 2000),
      completeGame("real-game", 1000)
    ])
    wx.setStorageSync("currentGame", completeGame("mock-game-3", 3000))

    const clean = gameRecords.cleanStoredGames()

    expect(clean.map(function(game) { return game.id })).toEqual(["real-game"])
    expect(wx.getStorageSync("games").map(function(game) { return game.id })).toEqual(["real-game"])
    expect(wx.getStorageSync("currentGame")).toBeUndefined()
  })

  test("getRecentCompletedGames should sort clean completed games by latest time", function() {
    const recent = gameRecords.getRecentCompletedGames([
      completeGame("older", 1000),
      completeGame("mock-game-1", 5000),
      completeGame("newer", 3000),
      Object.assign(completeGame("unfinished", 4000), {
        completed: false,
        status: "playing",
        scores: { p1: { 1: 4 } }
      })
    ])

    expect(recent.map(function(game) { return game.id })).toEqual(["newer", "older"])
  })
})
