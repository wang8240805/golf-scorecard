const path = require("path")
const { loadPage } = require("../helpers/load-page")

describe("scorecard page", function() {
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
})
