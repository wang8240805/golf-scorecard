// 球员选择页面 - 游戏大厅模式
const DEV_MODE = false

Page({
  data: {
    currentCourse: null,
    gameId: null,
    players: [], // 所有参赛球员（统一展示）
    isCreator: false, // 是否是创建者
    myOpenid: '', // 我的openid
    myPlayerId: '', // 我的球员ID
    isLoading: true,
    showAuth: false,
    tempAvatar: '',
    tempNickName: '',
    colors: ['#2c8f4e', '#2196f3', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#795548'],
    // 手动添加
    manualPlayerName: '',
    // 二维码
    qrcodeUrl: null,
    maxPlayers: 4
  },

  // 用于等待授权完成的 Promise resolve
  authResolve: null,

  onLoad: function(options) {
    this.loadCourse()
    this.initGame(options)
  },

  onUnload: function() {
    if (this.watcher) {
      this.watcher.close()
    }
  },

  // 加载球场信息
  loadCourse: function() {
    var currentCourseId = wx.getStorageSync('currentCourseId')
    var courses = wx.getStorageSync('courses') || []
    var currentCourse = courses.find(function(c) { return c.id === currentCourseId })
    this.setData({ currentCourse: currentCourse })
  },

  // 初始化比赛
  initGame: function(options) {
    var self = this

    this.getUserInfo().then(function(userInfo) {
      if (options.gameId) {
        self.joinGame(options.gameId, userInfo)
      } else {
        self.createNewGame(userInfo)
      }
    }).catch(function(err) {
      console.error('初始化比赛失败:', err)
      wx.showToast({ title: '初始化失败', icon: 'none' })
    })
  },

  // 获取用户信息
  getUserInfo: function() {
    var self = this

    var cachedInfo = wx.getStorageSync('userInfo')
    if (cachedInfo && cachedInfo.openid && cachedInfo.nickName) {
      // 本地已有完整信息，直接返回
      return Promise.resolve(cachedInfo)
    }

    // 已有openid但缺少昵称头像，尝试从云端拉取
    if (cachedInfo && cachedInfo.openid && !cachedInfo.nickName) {
      var db = wx.cloud.database()
      return new Promise(function(resolve, reject) {
        db.collection('users').where({ openid: cachedInfo.openid }).get().then(function(res) {
          if (res.data.length > 0) {
            // 从云端加载
            var cloudUser = res.data[0]
            var userInfo = {
              openid: cachedInfo.openid,
              nickName: cloudUser.nickName,
              avatarUrl: cloudUser.avatarUrl,
              unionid: cloudUser.unionid || cachedInfo.unionid
            }
            wx.setStorageSync('userInfo', userInfo)
            console.log('从云端加载用户信息成功')
            // 还是调用upsert更新时间戳
            wx.cloud.callFunction({
              name: 'userAction',
              data: {
                action: 'upsert',
                nickName: userInfo.nickName,
                avatarUrl: userInfo.avatarUrl,
                unionid: userInfo.unionid || null
              }
            })
            resolve(userInfo)
          } else {
            // 云端没找到，需要用户输入
            var openidPromise = Promise.resolve(cachedInfo.openid)
            var profilePromise = self.getUserProfile()
            Promise.all([openidPromise, profilePromise]).then(function(results) {
              var openid = results[0]
              var profile = results[1]

              var userInfo = {
                openid: openid,
                nickName: profile.nickName,
                avatarUrl: profile.avatarUrl
              }

              wx.setStorageSync('userInfo', userInfo)

              // 保存/更新用户信息到云端 users 集合
              wx.cloud.callFunction({
                name: 'userAction',
                data: {
                  action: 'upsert',
                  nickName: profile.nickName,
                  avatarUrl: profile.avatarUrl,
                  unionid: null
                },
                success: function(res) {
                  if (res.result && res.result.success) {
                    console.log('用户信息同步云端成功')
                  } else {
                    console.error('用户信息同步云端失败:', res.result ? res.result.error : '未知错误')
                  }
                },
                fail: function(err) {
                  console.error('调用userAction失败:', err)
                }
              })
              resolve(userInfo)
            }).catch(reject)
          }
        }).catch(reject)
      })
    }

    // 没有任何缓存，从头开始
    var openidPromise = this.getOpenid()
    var profilePromise = this.getUserProfile()

    return Promise.all([openidPromise, profilePromise]).then(function(results) {
      var openid = results[0]
      var profile = results[1]

      var userInfo = {
        openid: openid,
        nickName: profile.nickName,
        avatarUrl: profile.avatarUrl
      }

      wx.setStorageSync('userInfo', userInfo)

      // 保存/更新用户信息到云端 users 集合
      wx.cloud.callFunction({
        name: 'userAction',
        data: {
          action: 'upsert',
          nickName: profile.nickName,
          avatarUrl: profile.avatarUrl,
          unionid: null
        },
        success: function(res) {
          if (res.result && res.result.success) {
            console.log('用户信息同步云端成功')
          } else {
            console.error('用户信息同步云端失败:', res.result ? res.result.error : '未知错误')
          }
        },
        fail: function(err) {
          console.error('调用userAction失败:', err)
        }
      })

      return userInfo
    })
  },

  // 获取 openid
  getOpenid: function() {
    return new Promise(function(resolve, reject) {
      wx.login({
        success: function(loginRes) {
          if (!loginRes.code) {
            reject(new Error('wx.login失败'))
            return
          }

          wx.cloud.callFunction({
            name: 'code2session',
            data: { code: loginRes.code },
            success: function(res) {
              if (res.result && res.result.success && res.result.openid) {
                resolve(res.result.openid)
              } else {
                reject(new Error(res.result ? res.result.error : '获取openid失败'))
              }
            },
            fail: function(err) {
              reject(err)
            }
          })
        },
        fail: function(err) {
          reject(err)
        }
      })
    })
  },

  // 获取用户头像昵称（弹窗授权）
  getUserProfile: function() {
    var self = this

    return new Promise(function(resolve, reject) {
      self.authResolve = resolve
      self.setData({
        showAuth: true,
        tempAvatar: '',
        tempNickName: ''
      })
    })
  },

  // 选择头像
  onChooseAvatar: function(e) {
    if (e.detail && e.detail.avatarUrl) {
      this.setData({ tempAvatar: e.detail.avatarUrl })
    }
  },

  // 输入昵称
  onNickNameInput: function(e) {
    this.setData({ tempNickName: e.detail.value })
  },

  // 确认授权
  confirmAuth: function() {
    var tempNickName = this.data.tempNickName
    var tempAvatar = this.data.tempAvatar

    if (!tempNickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ showAuth: false })

    if (this.authResolve) {
      this.authResolve({
        nickName: tempNickName,
        avatarUrl: tempAvatar || ''
      })
      this.authResolve = null
    }
  },

  // 手动输入姓名
  onManualNameInput: function(e) {
    this.setData({ manualPlayerName: e.detail.value })
  },

  // 手动添加球员
  addManualPlayer: function() {
    var name = this.data.manualPlayerName.trim()
    if (!name) {
      wx.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }

    var players = this.data.players
    var colors = this.data.colors

    // 检查人数
    if (players.length >= this.data.maxPlayers) {
      wx.showToast({ title: '最多支持4人', icon: 'none' })
      return
    }

    // 检查是否已存在
    if (players.some(function(p) { return p.name === name })) {
      wx.showToast({ title: '该球员已存在', icon: 'none' })
      return
    }

    var newPlayer = {
      id: 'player_' + Date.now(),
      name: name,
      avatar: '',
      openid: 'manual_' + Date.now(),
      isCreator: false
    }

    players.push(newPlayer)

    this.setData({
      players: players,
      showInvite: false,
      manualPlayerName: ''
    })

    // 如果是云端比赛，同步更新到云端
    var self = this
    var gameId = this.data.gameId
    if (gameId && !gameId.startsWith('local_')) {
      wx.cloud.callFunction({
        name: 'gameAction',
        data: {
          action: 'updatePlayers',
          gameId: gameId,
          players: players
        },
        success: function(res) {
          console.log('手动添加球员同步云端成功')
        },
        fail: function(err) {
          console.error('手动添加球员同步云端失败:', err)
          wx.showToast({ title: '同步失败', icon: 'none' })
        }
      })
    }

    wx.showToast({ title: '添加成功', icon: 'success' })
  },

  // 获取二维码临时访问URL
  getQrcodeUrl: function(fileID) {
    var self = this
    wx.cloud.getTempFileURL({
      fileList: [fileID],
      success: function(res) {
        if (res.fileList && res.fileList[0]) {
          self.setData({
            qrcodeUrl: res.fileList[0].tempFileURL
          })
        }
      },
      fail: function(err) {
        console.error('获取二维码URL失败:', err)
      }
    })
  },

  // 显示二维码弹窗
  showQrcodeModal: function() {
    var self = this
    var gameId = this.data.gameId
    var qrcodeUrl = this.data.qrcodeUrl

    // 如果还没有二维码，先调用云函数生成
    if (!qrcodeUrl && gameId) {
      wx.showLoading({ title: '生成二维码...' })
      wx.cloud.callFunction({
        name: 'gameAction',
        data: {
          action: 'getQrCode',
          gameId: gameId
        },
        success: function(res) {
          wx.hideLoading()
          if (res.result && res.result.success && res.result.qrcodeUrl) {
            self.setData({
              qrcodeUrl: res.result.qrcodeUrl
            })
          } else {
            wx.showToast({
              title: res.result && res.result.error ? res.result.error : '生成二维码失败',
              icon: 'none'
            })
          }
        },
        fail: function(err) {
          wx.hideLoading()
          console.error('生成二维码失败:', err)
          wx.showToast({ title: '生成二维码失败', icon: 'none' })
        }
      })
    }

    this.setData({ showQrcodeModal: true })
  },

  // 隐藏二维码弹窗
  hideQrcodeModal: function() {
    this.setData({ showQrcodeModal: false })
  },

  // 创建新比赛（通过云函数）
  createNewGame: function(userInfo) {
    var self = this
    this.setData({ isCreator: true, isLoading: true })

    wx.cloud.callFunction({
      name: 'gameAction',
      data: {
        action: 'create',
        courseId: this.data.currentCourse ? this.data.currentCourse.id : '',
        courseName: this.data.currentCourse ? this.data.currentCourse.name : '',
        player: {
          openid: userInfo.openid,
          name: userInfo.nickName,
          avatar: userInfo.avatarUrl
        }
      },
      success: function(res) {
        if (res.result && res.result.success) {
          console.log('创建比赛成功:', res.result.gameId)
          self.setData({
            gameId: res.result.gameId,
            myOpenid: userInfo.openid,
            myPlayerId: 'player_' + userInfo.openid,
            isLoading: false,
            players: [{
              id: 'player_' + userInfo.openid,
              name: userInfo.nickName,
              avatar: userInfo.avatarUrl,
              openid: userInfo.openid,
              isCreator: true
            }]
          })
          // 如果有二维码fileID，获取临时URL
          if (res.result.qrcodeFileId) {
            self.getQrcodeUrl(res.result.qrcodeFileId)
          } else if (res.result.gameId) {
            // 二维码还没生成，自动生成（我们现在创建的时候不生成，打开页面时才生成）
            var gameId = res.result.gameId
            wx.cloud.callFunction({
              name: 'gameAction',
              data: {
                action: 'getQrCode',
                gameId: gameId
              },
              success: function(res) {
                if (res.result && res.result.success && res.result.qrcodeUrl) {
                  self.setData({
                    qrcodeUrl: res.result.qrcodeUrl
                  })
                }
              }
            })
          }
          self.watchGame(res.result.gameId)
        } else {
          console.error('创建比赛失败:', res.result ? res.result.error : '未知错误')
          self.fallbackToLocal(userInfo)
        }
      },
      fail: function(err) {
        console.error('云函数调用失败:', err)
        self.fallbackToLocal(userInfo)
      }
    })
  },

  // 加入已有比赛（通过云函数）
  joinGame: function(gameId, userInfo) {
    var self = this
    this.setData({ isLoading: true })

    wx.cloud.callFunction({
      name: 'gameAction',
      data: {
        action: 'join',
        gameId: gameId,
        player: {
          openid: userInfo.openid,
          name: userInfo.nickName,
          avatar: userInfo.avatarUrl
        }
      },
      success: function(res) {
        if (res.result && res.result.success) {
          console.log('加入比赛成功')
          self.setData({
            gameId: gameId,
            myOpenid: userInfo.openid,
            myPlayerId: 'player_' + userInfo.openid,
            players: res.result.players,
            isLoading: false
          })
          self.watchGame(gameId)

          // 如果比赛已经开始，直接跳转到记分卡
          if (res.result.status === 'playing') {
            wx.setStorageSync('currentGameId', gameId)
            wx.setStorageSync('currentPlayers', res.result.players)
            wx.redirectTo({
              url: '/pages/scorecard/scorecard?gameId=' + gameId
            })
          }
        } else {
          wx.showToast({ title: res.result && res.result.error ? res.result.error : '加入失败', icon: 'none' })
          setTimeout(function() { wx.navigateBack() }, 1500)
        }
      },
      fail: function(err) {
        console.error('云函数调用失败:', err)
        self.fallbackToLocal(userInfo)
      }
    })
  },

  // 监听比赛变化（实时同步）
  watchGame: function(gameId) {
    var self = this
    var db = wx.cloud.database()

    this.watcher = db.collection('games').where({ gameId: gameId }).watch({
      onChange: function(snapshot) {
        if (snapshot.docChanges && snapshot.docChanges.length > 0) {
          var game = snapshot.docChanges[0].doc
          if (game) {
            self.setData({ players: game.players })
          }
        }
      },
      onError: function(err) {
        console.error('监听失败:', err)
      }
    })
  },

  // 降级到本地模式
  fallbackToLocal: function(userInfo) {
    var gameId = 'local_' + Date.now()
    this.setData({
      gameId: gameId,
      myOpenid: userInfo.openid || 'local_user',
      myPlayerId: 'player_local',
      isLoading: false,
      players: [{
        id: 'player_local',
        name: userInfo.nickName,
        avatar: userInfo.avatarUrl,
        openid: userInfo.openid || 'local_user',
        isCreator: true
      }]
    })
  },

  // 分享给好友
  onShareAppMessage: function() {
    var currentCourse = this.data.currentCourse
    var gameId = this.data.gameId
    var players = this.data.players
    var myOpenid = this.data.myOpenid

    var myInfo = players.find(function(p) { return p.openid === myOpenid })
    return {
      title: myInfo ? (myInfo.name + '邀请你加入' + (currentCourse ? currentCourse.name : '') + '的比赛') : '邀请你加入高尔夫比赛',
      path: '/pages/new-game/step2-players/step2-players?gameId=' + gameId,
      imageUrl: '/images/share-game.png'
    }
  },

  // 开始比赛（通过云函数）
  startGame: function() {
    var self = this
    var gameId = this.data.gameId
    var players = this.data.players
    var currentCourse = this.data.currentCourse

    if (players.length === 0) {
      wx.showToast({ title: '至少需要1名球员', icon: 'none' })
      return
    }

    if (!currentCourse) {
      wx.showToast({ title: '球场数据错误', icon: 'none' })
      return
    }

    wx.showLoading({ title: '准备开始...' })

    wx.cloud.callFunction({
      name: 'gameAction',
      data: {
        action: 'start',
        gameId: gameId
      },
      success: function(res) {
        wx.hideLoading()
        if (res.result && res.result.success) {
          wx.setStorageSync('currentGameId', gameId)
          wx.setStorageSync('currentPlayers', players)

          wx.redirectTo({
            url: '/pages/scorecard/scorecard?gameId=' + gameId
          })
        } else {
          self.startLocalGame()
        }
      },
      fail: function(err) {
        wx.hideLoading()
        self.startLocalGame()
      }
    })
  },

  // 本地模式开始比赛
  startLocalGame: function() {
    var gameId = this.data.gameId
    var players = this.data.players
    var currentCourse = this.data.currentCourse

    var game = {
      id: gameId,
      courseId: currentCourse.id,
      courseName: currentCourse.name,
      players: players,
      scores: {},
      putts: {},
      timestamp: Date.now(),
      updateTime: Date.now(),
      completed: false
    }

    players.forEach(function(player) {
      game.scores[player.id] = {}
      game.putts[player.id] = {}
    })

    wx.setStorageSync('currentGame', game)
    wx.setStorageSync('currentGameId', gameId)

    wx.redirectTo({
      url: '/pages/scorecard/scorecard?gameId=' + gameId
    })
  },

  // 阻止冒泡
  preventHide: function() {},

  // 返回上一步
  goBack: function() {
    wx.navigateBack()
  }
})
