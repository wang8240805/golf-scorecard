const gameCompleteness = require("../../utils/game-completeness.js")

function buildGame(options) {
  const player = {
    id: options.playerId || "me",
    name: options.name || "我",
    isMe: options.isMe !== false
  }
  const scores = {}
  scores[player.id] = {}
  for (let i = 1; i <= (options.holesPlayed || 18); i++) {
    scores[player.id][i] = 4
  }
  return {
    id: options.id,
    completed: options.completed,
    status: options.status,
    players: [player],
    scores: scores
  }
}

describe("game completeness user completed game count", function() {
  test("countUserCompletedGames should only count current user's complete 18-hole rounds", function() {
    const games = [
      buildGame({ id: "complete", completed: true, holesPlayed: 18 }),
      buildGame({ id: "partial", completed: true, holesPlayed: 17 }),
      buildGame({ id: "ongoing", completed: false, holesPlayed: 18 }),
      {
        id: "other-player-only",
        completed: true,
        players: [
          { id: "me-empty", name: "我", isMe: true },
          { id: "other", name: "球友" }
        ],
        scores: {
          other: Array.from({ length: 18 }).reduce(function(acc, _, index) {
            acc[index + 1] = 4
            return acc
          }, {})
        }
      }
    ]

    expect(gameCompleteness.countUserCompletedGames(games)).toBe(1)
    expect(gameCompleteness.filterUserCompletedGames(games).map(function(game) {
      return game.id
    })).toEqual(["complete"])
  })

  test("filterUserCompletedGames should support an explicit player id", function() {
    const game = {
      id: "multi-player",
      completed: true,
      players: [
        { id: "me", name: "我", isMe: true },
        { id: "friend", name: "球友" }
      ],
      scores: {
        me: { 1: 4 },
        friend: Array.from({ length: 18 }).reduce(function(acc, _, index) {
          acc[index + 1] = 4
          return acc
        }, {})
      }
    }

    expect(gameCompleteness.countUserCompletedGames([game])).toBe(0)
    expect(gameCompleteness.countUserCompletedGames([game], "friend")).toBe(1)
  })
})
