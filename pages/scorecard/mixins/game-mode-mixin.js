/**
 * 游戏模式Mixin
 * 比杆赛模式
 */

module.exports = {
  data: {
    showModeSelector: false
  },

  // 显示玩法选择器
  showModeSelector() {
    this.setData({ showModeSelector: true })
  },

  hideModeSelector() {
    this.setData({ showModeSelector: false })
  },

  selectMode(e) {
    const game = this.data.currentGame
    game.gameMode = "stroke"

    this.setData({
      currentGame: game,
      showModeSelector: false
    })

    if (!this.isCloudGame) {
      const storageDebounced = require("../../../utils/storage-debounce.js")
      storageDebounced.setStorageDebounced("currentGame", game, 500)
    } else {
      this.updateCloudGame(game)
    }

    const course = this.data.courses.find(function(c) {
      return c.id === game.courseId
    })
    this.calculateLeader(game, course)

    wx.showToast({ title: "已切换至比杆赛", icon: "none" })
  }
}
