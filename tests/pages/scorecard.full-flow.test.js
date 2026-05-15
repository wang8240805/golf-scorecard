const path = require("path")
const { loadPage } = require("../helpers/load-page")

function createHoles(count, par) {
  const holes = []
  for (let i = 1; i <= count; i++) {
    holes.push({ hole: i, par: par || 4 })
  }
  return holes
}

function readPatchedValue(data, dottedKey, fallbackGetter) {
  if (Object.prototype.hasOwnProperty.call(data, dottedKey)) {
    return data[dottedKey]
  }
  return fallbackGetter()
}

describe("scorecard full flow regression", function() {
  test("finishGame should allow saving partial rounds without report/stat eligibility", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.data = {
      pendingCount: 0,
      holes: createHoles(18, 4),
      courses: [],
      currentGame: {
        id: "g1",
        courseId: "c1",
        courseName: "Test Course",
        players: [
          { id: "p1", name: "A" },
          { id: "p2", name: "B" }
        ],
        scores: {
          p1: { 1: 4, 2: 5 },
          p2: { 1: 4 }
        }
      }
    }

    page.finishGame()

    expect(wx.showModal).toHaveBeenCalledTimes(1)
    const arg = wx.showModal.mock.calls[0][0]
    expect(arg.title).toBe("保存部分成绩？")
    expect(arg.confirmText).toBe("保存成绩")
    expect(arg.cancelText).toBe("继续补录")
    expect(arg.content).toContain("不会生成复盘海报")
    expect(arg.content).toContain("不会计入18洞技术统计")

    arg.success({ confirm: true })
    const confirmArg = wx.showModal.mock.calls[1][0]
    expect(confirmArg.title).toBe("比赛结束")
    confirmArg.success({ confirm: false })

    const savedGames = wx.getStorageSync("games")
    expect(savedGames).toHaveLength(1)
    expect(savedGames[0].roundType).toBe("partial")
    expect(savedGames[0].isCompleteRound).toBe(false)
  })

  test("single entry quick +/- should clamp by par-based diff range", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.data = {
      currentHoleData: { par: 3 },
      editingScore: { strokes: 3 },
      singleEntryDiffOptions: [-2, -1, 0, 1, 2, 3]
    }

    page.adjustSingleDiff({ currentTarget: { dataset: { delta: 1 } } })
    expect(readPatchedValue(page.data, "editingScore.strokes", function() {
      return page.data.editingScore.strokes
    })).toBe(4)

    page.data.editingScore.strokes = 1
    page.adjustSingleDiff({ currentTarget: { dataset: { delta: -1 } } })
    expect(readPatchedValue(page.data, "editingScore.strokes", function() {
      return page.data.editingScore.strokes
    })).toBe(1)
  })

  test("batch entry quick +/- should clamp in batch diff options", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.data = {
      batchDiffOptions: [-3, -2, -1, 0, 1, 2, 3, 4],
      batchEntries: {
        p1: { diff: 4, putts: 2 },
        p2: { diff: -3, putts: 2 }
      }
    }

    page.adjustBatchDiff({ currentTarget: { dataset: { playerid: "p1", delta: 1 } } })
    page.adjustBatchDiff({ currentTarget: { dataset: { playerid: "p2", delta: -1 } } })

    expect(readPatchedValue(page.data, "batchEntries.p1.diff", function() {
      return page.data.batchEntries.p1.diff
    })).toBe(4)
    expect(readPatchedValue(page.data, "batchEntries.p2.diff", function() {
      return page.data.batchEntries.p2.diff
    })).toBe(-3)
  })

  test("entry default mode switch should refresh unfilled single and batch entries", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.data = {
      currentHole: 1,
      currentHoleData: { par: 4 },
      scoreEntryDefaultMode: "par",
      editingScore: {
        playerId: "p2",
        playerName: "B",
        strokes: 4,
        putts: 2
      },
      showBatchEntryModal: true,
      batchEntries: {
        p1: { diff: 0, putts: 2 },
        p2: { diff: 0, putts: 2 }
      },
      currentGame: {
        players: [
          { id: "p1", name: "A" },
          { id: "p2", name: "B" }
        ],
        scores: {
          p1: { 1: 4 },
          p2: {}
        }
      }
    }

    page.setScoreEntryDefaultMode({ currentTarget: { dataset: { mode: "parPlusOne" } } })

    expect(page.data.scoreEntryDefaultMode).toBe("parPlusOne")
    expect(readPatchedValue(page.data, "editingScore.strokes", function() {
      return page.data.editingScore.strokes
    })).toBe(5)
    expect(page.data.batchEntries.p1.diff).toBe(0)
    expect(page.data.batchEntries.p2.diff).toBe(1)

    page.setScoreEntryDefaultMode({ currentTarget: { dataset: { mode: "par" } } })

    expect(page.data.batchEntries.p2.diff).toBe(0)
  })

  test("completeGameStay should persist valid players only and mark invalid stats", function() {
    const page = loadPage(path.resolve(__dirname, "../../pages/scorecard/scorecard.js"))
    page.updateCoursePlayCount = jest.fn()
    page.data = {
      courses: [
        { id: "c1", holes: createHoles(18, 4) }
      ],
      holes: createHoles(18, 4),
      currentGame: {
        id: "g2",
        courseId: "c1",
        players: [
          { id: "p1", name: "A" },
          { id: "p2", name: "B" }
        ],
        scores: {
          p1: Object.fromEntries(createHoles(18, 4).map(function(h) { return [h.hole, 4] })),
          p2: { 1: 5, 2: 6 }
        },
        putts: {}
      }
    }

    page.completeGameStay()

    const savedGames = wx.getStorageSync("games")
    expect(Array.isArray(savedGames)).toBe(true)
    expect(savedGames.length).toBe(1)
    const saved = savedGames[0]

    expect(saved.validScorePlayerIds).toEqual(["p1"])
    expect(saved.invalidScorePlayerIds).toEqual(["p2"])
    expect(saved.statistics.p1.validRound).toBe(true)
    expect(saved.statistics.p2.validRound).toBe(false)
  })
})
