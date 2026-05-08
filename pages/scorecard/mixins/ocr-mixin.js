/**
 * OCR功能Mixin
 * 包含拍照识别计分卡功能
 * 使用腾讯云表格识别V3
 */

const OCRService = require('../../../utils/ocr-service.js')

module.exports = {
  data: {
    showOcrVerifyModal: false,
    originalHoles: [],
    originalTotalPar: 0,
    ocrHoles: [],
    ocrTotalPar: 0,
    hasDiff: false,
    hasScoreDiff: false
  },

  // 开始OCR校对 - 拍照选择图片
  startOcrVerify: function() {
    var currentGame = this.data.currentGame
    if (!currentGame || !currentGame.courseId) {
      wx.showToast({ title: '比赛数据异常', icon: 'none' })
      return
    }

    // 只取前18洞，过滤掉小计等额外数据
    var allHoles = this.data.holes || []
    var originalHoles = allHoles.slice(0, 18).filter(function(h) { return h.hole >= 1 && h.hole <= 18 })
    var originalTotalPar = originalHoles.reduce(function(sum, h) { return sum + h.par }, 0)

    // 彻底清空上次识别结果，确保每次都是全新开始
    // 使用setData回调保证清空完成再打开相机
    this.setData({
      originalHoles: originalHoles,
      originalTotalPar: originalTotalPar,
      ocrHoles: [],
      ocrTotalPar: 0,
      hasDiff: false,
      hasScoreDiff: false,
      showOcrVerifyModal: false
    }, function() {
      wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['camera', 'album'],
        camera: 'back',
        success: function(res) {
          var tempFilePath = res.tempFiles[0].tempFilePath
          this.recognizeScorecard(tempFilePath)
        }.bind(this),
        fail: function() { wx.showToast({ title: '取消选择', icon: 'none' }) }
      })
    }.bind(this))
  },

  // 识别计分卡图片 - 使用腾讯云表格识别V3
  recognizeScorecard: function(imagePath) {
    var self = this
    OCRService.recognize(imagePath)
      .then(function(result) {
        if (result.success && result.holes && result.holes.length > 0) {
          self.compareData(result.holes)
        } else {
          wx.showModal({
            title: '识别失败',
            content: result.error || '未能识别出有效的计分卡数据，请确保图片清晰并包含完整的18洞标准杆信息',
            showCancel: false
          })
        }
      })
      .catch(function(err) {
        console.error('OCR识别失败:', err)
        wx.showToast({ title: '识别失败', icon: 'none' })
      })
  },

  // 对比数据差异
  compareData: function(ocrHoles) {
    var originalHoles = this.data.originalHoles
    var hasDiff = false

    var fullOcrHoles = []
    for (var i = 1; i <= 18; i++) {
      var match = ocrHoles.find(function(h) { return h.hole === i })
      if (match) {
        fullOcrHoles.push({ hole: i, par: match.par })
        var original = originalHoles[i - 1]
        if (original && original.par !== match.par) hasDiff = true
      } else if (originalHoles[i - 1]) {
        fullOcrHoles.push({ hole: i, par: originalHoles[i - 1].par })
      } else {
        fullOcrHoles.push({ hole: i, par: 4 })
      }
    }

    var ocrTotalPar = fullOcrHoles.reduce(function(sum, h) { return sum + h.par }, 0)

    var hasScoreDiff = false
    var currentGame = this.data.currentGame
    if (currentGame && currentGame.scores) {
      var hasAnyScores = Object.keys(currentGame.scores).some(function(playerId) {
        return Object.keys(currentGame.scores[playerId] || {}).length > 0
      })
      if (hasAnyScores && hasDiff) hasScoreDiff = true
    }

    this.setData({
      ocrHoles: fullOcrHoles,
      ocrTotalPar: ocrTotalPar,
      hasDiff: hasDiff,
      hasScoreDiff: hasScoreDiff,
      showOcrVerifyModal: true
    })
  },

  // 关闭OCR弹窗
  hideOcrVerifyModal: function() {
    // 关闭弹窗时清空所有识别数据，确保下次打开是干净的
    this.setData({
      showOcrVerifyModal: false,
      ocrHoles: [],
      ocrTotalPar: 0,
      hasDiff: false,
      hasScoreDiff: false
    })
  },

  // 确认替换数据
  confirmReplaceData: function() {
    var currentGame = this.data.currentGame
    var ocrHoles = this.data.ocrHoles

    var updatedGame = Object.assign({}, currentGame, {
      holes: ocrHoles,
      totalPar: ocrHoles.reduce(function(sum, h) { return sum + h.par }, 0)
    })

    // 保存到球场数据
    if (currentGame.courseId) {
      OCRService.saveCourseHoles(currentGame.courseId, ocrHoles, 'ocr')
    }

    this.setData({
      currentGame: updatedGame,
      holes: ocrHoles,
      totalPar: updatedGame.totalPar
    })

    if (this.updateScoreGrid) {
      this.updateScoreGrid()
    }
    this.saveGame()

    wx.showToast({ title: '数据已更新', icon: 'success' })
    this.hideOcrVerifyModal()
  }
}
