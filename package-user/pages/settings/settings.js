const { formatDate } = require('../../../utils/date-utils.js')
const devFirstUseReset = require('../../../utils/dev-first-use-reset.js')

Page({
  data: {
    gameCount: 0,
    courseCount: 0,
    // 导入状态
    isImportingCourses: false,
    isDeveloperMode: false,
    isDevtools: false,
    devAlwaysFreshUser: false
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    this.loadData()
    // 设置页面不在TabBar中，无需设置选中状态
  },

  loadData() {
    const games = wx.getStorageSync('games') || []
    const courses = wx.getStorageSync('courses') || []
    const isDeveloperMode = wx.getStorageSync('developerMode') === true
    const devAlwaysFreshUser = wx.getStorageSync(devFirstUseReset.AUTO_RESET_KEY) === true
    this.setData({
      gameCount: games.length,
      courseCount: courses.length,
      isDeveloperMode,
      isDevtools: devFirstUseReset.isDevtools(),
      devAlwaysFreshUser
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

  toggleDevAlwaysFreshUser(e) {
    const enabled = e.detail.value === true
    wx.setStorageSync(devFirstUseReset.AUTO_RESET_KEY, enabled)
    this.setData({ devAlwaysFreshUser: enabled })
    wx.showToast({
      title: enabled ? '启动时将模拟新用户' : '已关闭自动重置',
      icon: 'none'
    })
  },

  resetFirstUseExperience() {
    if (!this.data.isDevtools) {
      wx.showToast({ title: '仅微信开发者工具可用', icon: 'none' })
      return
    }

    wx.showModal({
      title: '重置新用户体验',
      content: '将清除本地缓存、登录信息、隐私同意状态和当前比赛，并保留开发者模式。重启或返回首页后，可重新体验首次创建比赛流程。',
      confirmColor: '#f44336',
      success: (res) => {
        if (!res.confirm) return

        devFirstUseReset.resetFirstUseState()
        this.loadData()

        wx.showToast({
          title: '已重置',
          icon: 'success',
          duration: 1200
        })

        setTimeout(() => {
          wx.switchTab({ url: '/pages/index/index' })
        }, 1200)
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
