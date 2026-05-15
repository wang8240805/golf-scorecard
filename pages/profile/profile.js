const app = getApp()
const { USER_LEVELS } = require('../../utils/constants.js')
const gameCompleteness = require('../../utils/game-completeness.js')

// 默认头像 - 按照官方文档示例
const defaultAvatarUrl = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'

Page({
  data: {
    version: '1.0.0',
    userInfo: null,
    avatarUrl: defaultAvatarUrl,
    nicknameFocus: false,
    stats: {
      games: 0,
      holes: 0,
      avgScore: '-',
      bestScore: '-'
    },
    level: null
  },

  onLoad() {
    this.loadStats()
    this.loadVersion()
    this.loadUserInfo()
  },

  onShow() {
    this.loadStats()
    this.loadUserInfo()
    // 设置TabBar选中状态 - 我的页面是第2个（首页0，我的1）
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
    // 清除TabBar上的通知badge
    this.clearTabBarBadge()
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo,
        avatarUrl: userInfo.avatarUrl || defaultAvatarUrl
      })
      // 如果有用户信息但是还没有openid，尝试获取
      if (userInfo.nickName && !userInfo.openid) {
        setTimeout(() => {
          this.getWxOpenid()
        }, 1000)
      }
    } else {
      this.setData({
        userInfo: null,
        avatarUrl: defaultAvatarUrl
      })
    }
  },

  // 选择头像（官方最新API - 完全遵循官方示例）
  onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    let userInfo = wx.getStorageSync('userInfo') || {}
    userInfo.avatarUrl = avatarUrl
    wx.setStorageSync('userInfo', userInfo)
    this.setData({
      avatarUrl,
      userInfo
    })
    wx.showToast({ title: '头像已更新', icon: 'success' })

    // 同步到云端 users 集合
    this.syncUserInfoToCloud(userInfo)

    // 如果已经有昵称了，尝试获取openid（如果还没有）
    if (userInfo.nickName && !userInfo.openid) {
      this.getWxOpenid()
    }

    // 如果还没有昵称，自动聚焦拉起微信昵称选择器
    if (!userInfo.nickName) {
      setTimeout(() => {
        // 通过设置focus属性触发聚焦，微信官方type="nickname"输入框聚焦时会自动弹出昵称选择选项
        this.setData({ nicknameFocus: true })
      }, 500)
    }
  },

  // 输入昵称（官方最新API，自动提供微信昵称选项）
  onNickNameInput(e) {
    const nickName = e.detail.value
    if (!nickName || nickName.trim().length === 0) return

    let userInfo = wx.getStorageSync('userInfo') || {}
    userInfo.nickName = nickName
    wx.setStorageSync('userInfo', userInfo)
    this.setData({ userInfo })
    wx.showToast({ title: '昵称已保存', icon: 'success' })

    // 同步到云端 users 集合
    this.syncUserInfoToCloud(userInfo)

    // 获取微信openid（如果还没有的话）
    if (!userInfo.openid) {
      this.getWxOpenid()
    }
  },

  // 获取微信openid
  getWxOpenid() {
    wx.login({
      success: (res) => {
        if (res.code) {
          // 调用云函数换取openid
          wx.cloud.callFunction({
            name: 'code2session',
            data: { code: res.code },
            success: (result) => {
              const data = result.result
              if (data.success && data.openid) {
                // 保存openid到userInfo
                let userInfo = wx.getStorageSync('userInfo') || {}
                userInfo.openid = data.openid
                if (data.unionid) {
                  userInfo.unionid = data.unionid
                }

                // 如果本地已经有昵称和头像，直接保存
                if (userInfo.nickName && userInfo.avatarUrl) {
                  wx.setStorageSync('userInfo', userInfo)
                  this.setData({ userInfo, avatarUrl: userInfo.avatarUrl })
                  this.syncUserInfoToCloud(userInfo)
                  // 登录成功，启动全局游戏数据监听
                  getApp().startGlobalGameWatch()
                } else {
                  // 本地缺少昵称头像，尝试从云端拉取
                  const db = wx.cloud.database()
                  db.collection('users').where({ openid: data.openid }).get().then(res => {
                    if (res.data.length > 0) {
                      // 云端找到，加载到本地
                      const cloudUser = res.data[0]
                      userInfo.nickName = cloudUser.nickName
                      userInfo.avatarUrl = cloudUser.avatarUrl
                      userInfo.unionid = cloudUser.unionid || userInfo.unionid
                      wx.setStorageSync('userInfo', userInfo)
                      this.setData({ userInfo, avatarUrl: cloudUser.avatarUrl })
                    } else {
                      // 云端没有，保存现有信息等待用户输入
                      wx.setStorageSync('userInfo', userInfo)
                      this.setData({ userInfo })
                    }
                  }).catch(err => {
                    console.error('[微信登录] 从云端加载用户信息失败:', err)
                    wx.setStorageSync('userInfo', userInfo)
                    this.setData({ userInfo })
                  })
                }
              } else {
                console.error('[微信登录] 获取openid失败:', data.error)
              }
            },
            fail: (err) => {
              console.error('[微信登录] 云函数调用失败:', err)
            }
          })
        }
      },
      fail: (err) => {
        console.error('[微信登录] wx.login 失败:', err)
      }
    })
  },

  // 清除TabBar通知badge
  clearTabBarBadge() {
    // 尝试清除tabBar上的badge（删除球场tab后，我的页面是索引1）
    wx.removeTabBarBadge({
      index: 1
    })
    // 同时尝试清除storage中的通知计数
    wx.removeStorageSync('unreadCount')
    wx.removeStorageSync('noticeCount')
    wx.removeStorageSync('messageCount')
  },

  // 加载统计数据
  loadStats() {
    const games = wx.getStorageSync('games') || []
    const currentGame = wx.getStorageSync('currentGame')

    // 过滤出用户本人18洞完整有效成绩（和首页/复盘口径一致）
    const completedGames = games.filter(game => {
      const player = gameCompleteness.getPlayer(game)
      return player && gameCompleteness.isPlayerRoundComplete(game, player.id)
    })

    // 总场次（和首页统计口径一致，统计所有已完成比赛）
    const totalGames = completedGames.length

    // 总洞数
    let totalHoles = 0
    let allScores = []
    completedGames.forEach(game => {
      const player = gameCompleteness.getPlayer(game)
      if (!player) return

      // 从 statistics 获取总杆数
      if (game.statistics && game.statistics[player.id]) {
        const stats = game.statistics[player.id]
        totalHoles += stats.holesPlayed || 0
        if (stats.totalScore > 0) {
          allScores.push(stats.totalScore)
        }
      }
      // 新格式：player.scores数组
      else if (player.scores && Array.isArray(player.scores)) {
        const validScores = player.scores.filter(s => gameCompleteness.getStrokesValue(s) > 0)
        totalHoles += validScores.length
        const total = validScores.reduce((sum, s) => sum + gameCompleteness.getStrokesValue(s), 0)
        if (total > 0) {
          allScores.push(total)
        }
      }
      // 旧格式：game.scores对象
      else if (game.scores && game.scores[player.id]) {
        const scores = game.scores[player.id]
        const validScores = Object.values(scores).filter(v => gameCompleteness.getStrokesValue(v) > 0)
        totalHoles += validScores.length
        const total = validScores.reduce((sum, s) => {
          const strokes = typeof s === 'object' ? s.strokes : s
          return sum + (parseInt(strokes) || 0)
        }, 0)
        if (total > 0) {
          allScores.push(total)
        }
      }
    })

    // 计算平均杆和最佳成绩
    const avgScore = allScores.length > 0
      ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
      : '-'

    const bestScore = allScores.length > 0
      ? Math.min(...allScores)
      : '-'

    // 计算等级
    const level = this.calculateLevel(totalGames)

    this.setData({
      stats: {
        games: totalGames,
        holes: Math.floor(totalHoles / (totalGames || 1)) || 0,
        avgScore,
        bestScore
      },
      level
    })
  },

  // 计算用户等级
  calculateLevel(gameCount) {
    for (let i = USER_LEVELS.length - 1; i >= 0; i--) {
      if (gameCount >= USER_LEVELS[i].min) {
        return USER_LEVELS[i]
      }
    }
    return USER_LEVELS[0]
  },

  // 加载版本号
  loadVersion() {
    const accountInfo = wx.getAccountInfoSync()
    this.setData({
      version: accountInfo.miniProgram.version || '1.0.0'
    })
  },

  // 跳转比赛记录
  goToHistory() {
    wx.navigateTo({
      url: '/package-game/pages/history/history'
    })
  },

  // 跳转数据统计
  goToStatistics() {
    wx.navigateTo({
      url: '/package-game/pages/statistics/statistics'
    })
  },

  // 跳转我的球场
  goToCourses() {
    wx.navigateTo({
      url: '/package-courses/pages/courses/courses'
    })
  },

  // 跳转常用球员
  goToPlayers() {
    wx.navigateTo({
      url: '/package-game/pages/players/players'
    })
  },

  // 跳转设置
  goToSettings() {
    wx.navigateTo({
      url: '/package-user/pages/settings/settings'
    })
  },

  // 跳转意见反馈
  goToFeedback() {
    wx.navigateTo({
      url: '/package-user/pages/feedback/feedback'
    })
  },

  // 跳转关于页面
  goToAbout() {
    wx.showModal({
      title: '关于 WinPAR',
      content: '专业高尔夫智能记分工具，支持多人比赛、AI智能分析报告和完整技术统计，助力球技提升。',
      showCancel: false
    })
  },

  // 分享给朋友
  onShareAppMessage() {
    return {
      title: '推荐你一个好用的高尔夫记分工具',
      path: '/pages/index/index',
      imageUrl: '/assets/share-cover.png' // 如果有分享封面图的话
    }
  },

  // 同步用户信息到云端
  syncUserInfoToCloud: function(userInfo) {
    if (!userInfo.openid) {
      return
    }
    wx.cloud.callFunction({
      name: 'userAction',
      data: {
        action: 'upsert',
        nickName: userInfo.nickName,
        avatarUrl: userInfo.avatarUrl,
        unionid: userInfo.unionid || null
      },
      success: function(res) {
        if (!res.result || !res.result.success) {
          console.error('[同步] 用户信息同步云端失败:', res.result ? res.result.error : '未知错误')
        }
      },
      fail: function(err) {
        console.error('[同步] 调用userAction失败:', err)
      }
    })
  },

  // 登出 - 清除本地缓存
  logout: function() {
    wx.showModal({
      title: '确认登出',
      content: '清除本地登录信息，重新登录需要再次输入昵称头像',
      success: function(res) {
        if (res.confirm) {
          wx.removeStorageSync('userInfo')
          this.setData({
            userInfo: null,
            avatarUrl: defaultAvatarUrl
          })
          wx.showToast({ title: '已登出', icon: 'success' })
        }
      }.bind(this)
    })
  }
})
