const {
  findMePlayer,
  getPlayerScore,
  getPlayerHoleScore,
  calculateLeader
} = require("../../utils/game-utils")

describe("utils/game-utils", function() {
  test("findMePlayer should return the player marked as me", function() {
    const game = {
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B", isMe: true }
      ]
    }
    expect(findMePlayer(game).id).toBe("p2")
  })

  test("getPlayerScore should read statistics first", function() {
    const game = {
      statistics: {
        p1: { totalScore: 87 }
      }
    }
    expect(getPlayerScore(game, "p1")).toBe(87)
  })

  test("getPlayerScore should fallback to scores map", function() {
    const game = {
      scores: {
        p1: {
          1: 4,
          2: { strokes: 5 }
        }
      }
    }
    expect(getPlayerScore(game, "p1")).toBe(9)
  })

  test("getPlayerHoleScore should return null for missing hole", function() {
    const game = { scores: { p1: {} } }
    expect(getPlayerHoleScore(game, "p1", 9)).toBeNull()
  })

  test("calculateLeader should return lowest non-zero score player", function() {
    const game = {
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" }
      ],
      statistics: {
        p1: { totalScore: 0 },
        p2: { totalScore: 76 }
      }
    }

    const leader = calculateLeader(game)
    expect(leader.player.id).toBe("p2")
    expect(leader.score).toBe(76)
  })
})
