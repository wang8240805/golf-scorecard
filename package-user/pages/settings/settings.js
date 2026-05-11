const { formatDate } = require('../../../utils/date-utils.js')

Page({
  data: {
    gameCount: 0,
    courseCount: 0,
    // 通用设置
    defaultTee: '蓝Tee',
    autoLock: false,
    defaultPlayer: '我',
    // 记分设置
    voiceBroadcast: true,
    vibration: true,
    autoCompleteConfirm: true,
    defaultMatchPlay: false,
    // 导入状态
    isImportingCourses: false
  },

  onLoad() {
    this.loadData()
    this.loadSettings()
  },

  onShow() {
    this.loadData()
    // 设置页面不在TabBar中，无需设置选中状态
  },

  loadData() {
    const games = wx.getStorageSync('games') || []
    const courses = wx.getStorageSync('courses') || []
    this.setData({
      gameCount: games.length,
      courseCount: courses.length
    })
  },

  // 导入官方球场数据
  importOfficialCourses() {
    wx.showModal({
      title: '导入球场数据',
      content: `将导入全国400+官方球场数据到云端数据库。\n\n当前本地已有 ${this.data.courseCount} 个球场。\n\n导入后，所有用户都可以搜索和使用这些球场。`,
      success: (res) => {
        if (res.confirm) {
          this.doImportCourses()
        }
      }
    })
  },

  doImportCourses() {
    this.setData({ isImportingCourses: true })
    wx.showLoading({ title: '导入中...' })

    wx.cloud.callFunction({
      name: 'importCourses',
      success: (res) => {
        wx.hideLoading()
        this.setData({ isImportingCourses: false })
        if (res.result && res.result.success) {
          wx.showToast({
            title: `成功导入 ${res.result.imported} 个球场`,
            icon: 'success',
            duration: 2000
          })
        } else {
          wx.showToast({
            title: res.result?.error || '导入失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        this.setData({ isImportingCourses: false })
        wx.showToast({
          title: '调用失败: ' + err.message,
          icon: 'none'
        })
      }
    })
  },

  // 加载用户设置
  loadSettings() {
    const settings = wx.getStorageSync('appSettings') || {}
    this.setData({
      defaultTee: settings.defaultTee || '蓝Tee',
      autoLock: settings.autoLock || false,
      defaultPlayer: settings.defaultPlayer || '我',
      voiceBroadcast: settings.voiceBroadcast !== false,
      vibration: settings.vibration !== false,
      autoCompleteConfirm: settings.autoCompleteConfirm !== false,
      defaultMatchPlay: settings.defaultMatchPlay || false
    })
  },

  // 保存设置
  saveSettings() {
    const settings = {
      defaultTee: this.data.defaultTee,
      autoLock: this.data.autoLock,
      defaultPlayer: this.data.defaultPlayer,
      voiceBroadcast: this.data.voiceBroadcast,
      vibration: this.data.vibration,
      autoCompleteConfirm: this.data.autoCompleteConfirm,
      defaultMatchPlay: this.data.defaultMatchPlay
    }
    wx.setStorageSync('appSettings', settings)
  },

  // 选择默认发球台
  selectDefaultTee() {
    const tees = ['蓝Tee', '白Tee', '红Tee', '金Tee', '黑Tee']
    wx.showActionSheet({
      itemList: tees,
      success: (res) => {
        this.setData({ defaultTee: tees[res.tapIndex] })
        this.saveSettings()
      }
    })
  },

  // 切换自动锁屏
  toggleAutoLock(e) {
    this.setData({ autoLock: e.detail.value })
    this.saveSettings()
    wx.showToast({
      title: e.detail.value ? '自动锁屏已开启' : '自动锁屏已关闭',
      icon: 'none'
    })
  },

  // 选择默认球员
  selectDefaultPlayer() {
    const players = wx.getStorageSync('savedPlayers') || []
    const playerNames = players.map(p => p.name).concat(['我'])

    wx.showActionSheet({
      itemList: playerNames,
      success: (res) => {
        this.setData({ defaultPlayer: playerNames[res.tapIndex] })
        this.saveSettings()
      }
    })
  },

  // 切换语音播报
  toggleVoiceBroadcast(e) {
    this.setData({ voiceBroadcast: e.detail.value })
    this.saveSettings()
    wx.showToast({
      title: e.detail.value ? '语音播报已开启' : '语音播报已关闭',
      icon: 'none'
    })
  },

  // 切换震动反馈
  toggleVibration(e) {
    this.setData({ vibration: e.detail.value })
    this.saveSettings()
    wx.showToast({
      title: e.detail.value ? '震动反馈已开启' : '震动反馈已关闭',
      icon: 'none'
    })
  },

  // 切换自动完成确认
  toggleAutoCompleteConfirm(e) {
    this.setData({ autoCompleteConfirm: e.detail.value })
    this.saveSettings()
    wx.showToast({
      title: e.detail.value ? '自动确认已开启' : '自动确认已关闭',
      icon: 'none'
    })
  },

  // 切换默认显示比洞赛
  toggleDefaultMatchPlay(e) {
    this.setData({ defaultMatchPlay: e.detail.value })
    this.saveSettings()
    wx.showToast({
      title: e.detail.value ? '默认比洞赛已开启' : '默认比杆赛已开启',
      icon: 'none'
    })
  },

  // 导出/备份数据
  exportData() {
    const backupData = this.createBackup()
    const dataStr = JSON.stringify(backupData, null, 2)
    const fileName = `winpar_backup_${formatDate(new Date(), 'compact')}.json`

    // 使用微信文件系统保存
    const fs = wx.getFileSystemManager()
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`

    try {
      fs.writeFileSync(filePath, dataStr, 'utf8')

      wx.shareFileMessage({
        filePath: filePath,
        fileName: fileName,
        success: () => {
          wx.showToast({ title: '备份文件已生成', icon: 'success' })
        },
        fail: (err) => {
          console.error('分享失败:', err)
          // 如果分享失败，尝试用其他方式
          this.copyToClipboard(dataStr)
        }
      })
    } catch (e) {
      console.error('备份失败:', e)
      // 降级方案：复制到剪贴板
      this.copyToClipboard(dataStr)
    }
  },

  // 创建完整备份
  createBackup() {
    const backup = {
      version: '1.0',
      backupTime: Date.now(),
      backupDate: new Date().toISOString(),
      data: {
        games: wx.getStorageSync('games') || [],
        courses: wx.getStorageSync('courses') || [],
        customCourses: wx.getStorageSync('customCourses') || [],
        players: wx.getStorageSync('savedPlayers') || [],
        settings: wx.getStorageSync('appSettings') || {},
        userInfo: wx.getStorageSync('userInfo') || {},
        favoriteCourseIds: wx.getStorageSync('favoriteCourseIds') || [],
        coursePlayCounts: wx.getStorageSync('coursePlayCounts') || {}
      }
    }
    return backup
  },

  // 复制到剪贴板
  copyToClipboard(dataStr) {
    wx.setClipboardData({
      data: dataStr,
      success: () => {
        wx.showModal({
          title: '备份数据已复制',
          content: '数据已复制到剪贴板，请粘贴到备忘录或文件保存。建议定期备份以防数据丢失。',
          showCancel: false
        })
      },
      fail: () => {
        wx.showToast({ title: '备份失败，请重试', icon: 'none' })
      }
    })
  },

  // 导入/恢复数据
  importData() {
    wx.showActionSheet({
      itemList: ['从剪贴板导入', '选择备份文件'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.importFromClipboard()
        } else {
          this.importFromFile()
        }
      }
    })
  },

  // 从剪贴板导入
  importFromClipboard() {
    wx.getClipboardData({
      success: (res) => {
        try {
          const backup = JSON.parse(res.data)
          this.restoreBackup(backup)
        } catch (e) {
          wx.showToast({ title: '剪贴板数据格式错误', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '读取剪贴板失败', icon: 'none' })
      }
    })
  },

  // 从文件导入
  importFromFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const filePath = res.tempFiles[0].path
        const fs = wx.getFileSystemManager()

        try {
          const data = fs.readFileSync(filePath, 'utf8')
          const backup = JSON.parse(data)
          this.restoreBackup(backup)
        } catch (e) {
          wx.showToast({ title: '文件读取失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '取消选择', icon: 'none' })
      }
    })
  },

  // 恢复备份
  restoreBackup(backup) {
    if (!backup || !backup.data) {
      wx.showToast({ title: '无效的备份文件', icon: 'none' })
      return
    }

    // 显示确认弹窗
    const gameCount = backup.data.games?.length || 0
    const courseCount = backup.data.courses?.length || 0

    wx.showModal({
      title: '确认恢复数据',
      content: `备份信息：\n比赛记录: ${gameCount}场\n球场数据: ${courseCount}个\n备份时间: ${formatDate(new Date(backup.backupTime), 'full')}\n\n恢复将覆盖当前数据，是否继续？`,
      confirmColor: '#f44336',
      success: (res) => {
        if (res.confirm) {
          // 恢复数据
          const data = backup.data
          if (data.games) wx.setStorageSync('games', data.games)
          if (data.courses) wx.setStorageSync('courses', data.courses)
          if (data.customCourses) wx.setStorageSync('customCourses', data.customCourses)
          if (data.players) wx.setStorageSync('savedPlayers', data.players)
          if (data.settings) wx.setStorageSync('appSettings', data.settings)
          if (data.userInfo) wx.setStorageSync('userInfo', data.userInfo)
          if (data.favoriteCourseIds) wx.setStorageSync('favoriteCourseIds', data.favoriteCourseIds)
          if (data.coursePlayCounts) wx.setStorageSync('coursePlayCounts', data.coursePlayCounts)

          wx.showToast({
            title: '数据恢复成功',
            icon: 'success',
            duration: 2000
          })

          // 刷新页面数据
          this.loadData()
          this.loadSettings()
        }
      }
    })
  },

  // 清除历史记录
  clearHistory() {
    if (this.data.gameCount === 0) {
      wx.showToast({ title: '暂无历史记录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认清除',
      content: `确定要清除 ${this.data.gameCount} 场比赛记录吗？此操作不可恢复。`,
      confirmColor: '#f44336',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('games')
          this.setData({ gameCount: 0 })
          wx.showToast({ title: '已清除', icon: 'success' })
        }
      }
    })
  },

  // 清除所有数据
  clearAllData() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有数据吗？包括比赛记录、设置和球员信息。此操作不可恢复！',
      confirmColor: '#f44336',
      success: (res) => {
        if (res.confirm) {
          wx.clearStorageSync()
          this.setData({
            gameCount: 0
          })

          // 重新初始化默认设置
          this.loadSettings()

          wx.showToast({
            title: '已重置',
            icon: 'success',
            duration: 2000
          })

          setTimeout(() => {
            wx.switchTab({ url: '/pages/index/index' })
          }, 1500)
        }
      }
    })
  },

  // 跳转用户协议
  goToUserAgreement() {
    wx.navigateTo({
      url: '/package-user/pages/webview/webview?type=userAgreement'
    })
  },

  // 跳转隐私政策
  goToPrivacyPolicy() {
    wx.navigateTo({
      url: '/package-user/pages/webview/webview?type=privacyPolicy'
    })
  },

  // 跳转意见反馈
  goToFeedback() {
    wx.navigateTo({
      url: '/package-user/pages/feedback/feedback'
    })
  }
})