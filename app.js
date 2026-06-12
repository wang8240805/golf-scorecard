const PRIVACY_AGREED_KEY = "winparPrivacyAgreedAt"

// 初始化微信云开发
if (!wx.cloud) {
  console.error('请使用 2.2.3 或以上的基础库以使用云开发能力')
} else {
  wx.cloud.init({
    env: 'cloudbase-3g7ya74db1a5f864',
    traceUser: false
  })
}

const OCRService = require('./utils/ocr-service.js')
const ongoingGameCloudSync = require('./utils/ongoing-game-cloud-sync.js')
const ongoingGameStorage = require('./utils/ongoing-game-storage.js')
const devFirstUseReset = require('./utils/dev-first-use-reset.js')
const gameRecords = require('./utils/game-records.js')

App({
  privacyResolve: null,
  privacyCallbacks: [],
  postPrivacyTasksStarted: false,

  onLaunch() {
    devFirstUseReset.resetOnLaunchIfNeeded()
    gameRecords.cleanStoredGames()

    // 清理存储空间（删除旧的日志文件等）
    this.cleanStorage()
    this.registerPrivacyAuthorization()

    // 检查本地存储的数据
    const courses = wx.getStorageSync('courses') || []
    if (courses.length === 0) {
      // 初始化默认球场数据（将在首页被覆盖）
    }

    // 初始化全局数据
    this.globalData = {
      currentCourse: null,
      currentPlayers: [],
      currentScores: {},
      tabBarSelected: 0
    }

    // 暴露cloud引用供其他模块使用
    this.cloud = wx.cloud

    if (this.hasPrivacyAgreed()) {
      this.startPostPrivacyTasks()
    }
  },

  registerPrivacyAuthorization() {
    if (wx.onNeedPrivacyAuthorization) {
      wx.onNeedPrivacyAuthorization((resolve) => {
        this.privacyResolve = resolve
        this.notifyPrivacyCallbacks(true)
      })
    }
  },

  addPrivacyCallback(callback) {
    if (typeof callback !== "function") return
    this.privacyCallbacks = this.privacyCallbacks || []
    if (this.privacyCallbacks.indexOf(callback) === -1) {
      this.privacyCallbacks.push(callback)
    }
  },

  removePrivacyCallback(callback) {
    if (!this.privacyCallbacks || !callback) return
    this.privacyCallbacks = this.privacyCallbacks.filter(function(item) {
      return item !== callback
    })
  },

  notifyPrivacyCallbacks(show) {
    const callbacks = this.privacyCallbacks || []
    callbacks.forEach(function(callback) {
      callback(show)
    })
  },

  hasPrivacyAgreed() {
    return !!wx.getStorageSync(PRIVACY_AGREED_KEY)
  },

  runAfterPrivacyAuthorization(callback, rejectCallback) {
    if (this.hasPrivacyAgreed() || !wx.requirePrivacyAuthorize) {
      if (typeof callback === "function") {
        callback()
      }
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      wx.requirePrivacyAuthorize({
        success: () => {
          wx.setStorageSync(PRIVACY_AGREED_KEY, Date.now())
          this.startPostPrivacyTasks()
          if (typeof callback === "function") {
            callback()
          }
          resolve(true)
        },
        fail: (err) => {
          if (typeof rejectCallback === "function") {
            rejectCallback(err)
          }
          resolve(false)
        }
      })
    })
  },

  startPostPrivacyTasks() {
    if (this.postPrivacyTasksStarted) return
    this.postPrivacyTasksStarted = true
    this.syncPublicCourseData()
    this.syncUserIdentityAndGames()
  },

  syncPublicCourseData() {
    OCRService.syncPublicCourseData()
      .catch((err) => {
        console.warn('[App] 同步公开球场数据失败:', err)
      })
  },

  syncUserIdentityAndGames() {
    // 确保有 openid 后再同步云端数据；本地缓存被清空时也能拉回比赛记录
    this.ensureOpenId()
      .then(() => {
        ongoingGameCloudSync.syncPendingGames()
        return this.syncUserGameHistory()
      })
      .then((mergedCount) => {
        if (mergedCount > 0) {
          this.eventBus.emit('gameDataChanged', {
            timestamp: Date.now(),
            mergedCount: mergedCount
          })
        }
      })
      .catch((err) => {
        console.warn('[App] 同步历史比赛记录失败:', err)
      })
  },

  ensureOpenId() {
    return new Promise((resolve) => {
      const userInfo = wx.getStorageSync('userInfo') || {}
      if (userInfo.openid) {
        resolve(userInfo.openid)
        return
      }

      if (!wx.cloud || !wx.login) {
        resolve('')
        return
      }

      wx.login({
        success: (loginRes) => {
          if (!loginRes.code) {
            resolve('')
            return
          }

          wx.cloud.callFunction({
            name: 'code2session',
            data: { code: loginRes.code },
            success: (res) => {
              const data = res && res.result ? res.result : {}
              if (data.success && data.openid) {
                const nextUserInfo = {
                  ...userInfo,
                  openid: data.openid,
                  unionid: data.unionid || userInfo.unionid
                }
                wx.setStorageSync('userInfo', nextUserInfo)
                resolve(data.openid)
                return
              }
              resolve('')
            },
            fail: () => {
              resolve('')
            }
          })
        },
        fail: () => {
          resolve('')
        }
      })
    })
  },

  // 清理存储空间
  cleanStorage() {
    const fs = wx.getFileSystemManager()
    const USER_DATA_PATH = wx.env.USER_DATA_PATH

    try {
      // 获取用户数据目录下的所有文件
      const files = fs.readdirSync(USER_DATA_PATH)
      let deletedCount = 0

      files.forEach(file => {
        const filePath = `${USER_DATA_PATH}/${file}`

        try {
          const stat = fs.statSync(filePath)

          // 删除日志文件（保留logs目录）
          if (file.endsWith('.log') || file.startsWith('debug-') || file.startsWith('ocr-')) {
            if (!file.startsWith('miniprogram')) {
              fs.unlinkSync(filePath)
              deletedCount++
            }
          }
        } catch (e) {
          // 忽略错误
        }
      })

      // 清理 logs 目录，只保留最近3个日志
      const logsDir = `${USER_DATA_PATH}/logs`
      try {
        const logFiles = fs.readdirSync(logsDir)
        const logFileInfos = logFiles
          .filter(f => f.endsWith('.log'))
          .map(f => {
            const fp = `${logsDir}/${f}`
            try {
              const st = fs.statSync(fp)
              return { name: f, path: fp, time: st.lastModifiedTime || 0 }
            } catch (e) {
              return null
            }
          })
          .filter(f => f !== null)
          .sort((a, b) => b.time - a.time)

        // 只保留最近3个
        if (logFileInfos.length > 3) {
          logFileInfos.slice(3).forEach(f => {
            try {
              fs.unlinkSync(f.path)
              deletedCount++
            } catch (e) {}
          })
        }
      } catch (e) {
        // logs目录不存在
      }
    } catch (e) {
      // 清理失败不影响使用
    }
  },

  // 从云端同步用户历史比赛记录到本地
  syncUserGameHistory() {
    return new Promise((resolve, reject) => {
      if (!this.cloud) {
        resolve(0)
        return
      }

      const db = this.cloud.database()
      const _ = db.command
      const userInfo = wx.getStorageSync('userInfo') || {}
      const openid = userInfo.openid

      if (!openid) {
        resolve(0)
        return
      }

      db.collection('games')
        .where(_.or([
          { _openid: _.eq(openid) },
          { "players.openid": _.eq(openid) }
        ]))
        .orderBy('endTime', 'asc')
        .get()
        .then(res => {
          if (!res.data || res.data.length === 0) {
            resolve(0)
            return
          }

          // 读取本地现有数据
          const localGames = gameRecords.sanitizeGames(wx.getStorageSync('games') || [])
          let mergedCount = 0

          // cloud数据结构：每条有 _id, openId, ...gameFields
          // 提取game数据，忽略云数据库元数据
          const cloudGames = res.data.map(item => {
            const { _id, _openid, createTime, ...gameData } = item
            // 补上 _id 方便后续更新
            gameData._id = item._id
            return gameData
          })

          // 合并策略：基于ID查找，找到重复则保留最新版本（updateTime较大的）
          cloudGames.forEach(cloudGame => {
            if (gameRecords.isTestGameRecord(cloudGame)) {
              this.markCloudGameDeleted(cloudGame)
              return
            }

            if (
              ongoingGameStorage.isOngoingGame(cloudGame) &&
              ongoingGameStorage.hasCompletedMarker(cloudGame)
            ) {
              return
            }

            // 查找是否已存在
            const existingIdx = localGames.findIndex(local => {
              if (ongoingGameStorage.isSameGame(local, cloudGame)) {
                return true
              }
              // 通过 gameId 或 id 判断重复
              if (local.gameId && cloudGame.gameId) {
                return local.gameId === cloudGame.gameId
              }
              if (local.id && cloudGame.id) {
                return local.id === cloudGame.id
              }
              // 通过 timestamp + courseId 判断重复
              if (local.timestamp && cloudGame.timestamp) {
                return local.timestamp === cloudGame.timestamp &&
                     local.courseId === cloudGame.courseId
              }
              // 如果其中一个没有 timestamp，通过 endTime 比较
              const localTime = local.timestamp || local.endTime
              const cloudTime = cloudGame.timestamp || cloudGame.endTime
              if (localTime && cloudTime) {
                return localTime === cloudTime &&
                     local.courseId === cloudGame.courseId
              }
              // 时间都不存在，通过球员数量粗略判断
              if (local.players && cloudGame.players &&
                  local.players.length === cloudGame.players.length) {
                return local.courseId === cloudGame.courseId
              }
              // 无法确认是重复，不判定为重复
              return false
            })

            if (existingIdx === -1) {
              // 本地不存在，添加为新记录
              // 如果云端标记为删除，跳过
              if (!cloudGame.deleted) {
                localGames.push(cloudGame)
                mergedCount++
              }
            } else {
              // 已存在，比较更新时间，保留较新的
              const local = localGames[existingIdx]
              const localUpdateTime = local.updateTime || local.endTime || 0
              const cloudUpdateTime = cloudGame.updateTime || cloudGame.endTime || 0
              // 云端更新，覆盖本地
              if (cloudUpdateTime > localUpdateTime) {
                if (
                  ongoingGameStorage.isCompletedGame(local) &&
                  ongoingGameStorage.isOngoingGame(cloudGame)
                ) {
                  return
                }
                // 如果云端标记删除，从本地删除
                if (cloudGame.deleted) {
                  localGames.splice(existingIdx, 1)
                  mergedCount++
                } else {
                  localGames[existingIdx] = cloudGame
                  mergedCount++
                }
              }
            }
          })

          // 保存合并后的数据回本地存储
          if (mergedCount > 0 || localGames.length !== (wx.getStorageSync('games') || []).length) {
            wx.setStorageSync('games', localGames)
          }

          resolve(mergedCount)
        })
        .catch(err => {
          reject(err)
        })
    })
  },

  markCloudGameDeleted(game) {
    if (!this.cloud || !game || !game._id) return
    try {
      this.cloud.database().collection('games').doc(game._id).update({
        data: { deleted: true },
        fail: function(err) {
          console.warn('[App] 标记测试比赛删除失败:', err)
        }
      })
    } catch (e) {
      console.warn('[App] 标记测试比赛删除异常:', e)
    }
  },

  // 同意隐私协议
  agreePrivacy() {
    wx.setStorageSync(PRIVACY_AGREED_KEY, Date.now())
    if (this.privacyResolve) {
      this.privacyResolve({ event: 'agree', buttonId: 'agree-btn' })
      this.privacyResolve = null
    }
    this.startPostPrivacyTasks()
    this.notifyPrivacyCallbacks(false)
  },

  // 拒绝隐私协议
  disagreePrivacy() {
    wx.removeStorageSync(PRIVACY_AGREED_KEY)
    if (this.privacyResolve) {
      this.privacyResolve({ event: 'disagree' })
      this.privacyResolve = null
    }
    this.notifyPrivacyCallbacks(false)
  },

  // 设置TabBar选中状态
  setTabBarSelected(index) {
    this.globalData.tabBarSelected = index
    if (this.customTabBar) {
      this.customTabBar.setData({
        selected: index
      })
    }
  },

  // 启动全局游戏数据监听（实时同步）
  startGlobalGameWatch() {
    if (!wx.cloud || !this.cloud) return

    const userInfo = wx.getStorageSync('userInfo') || {}
    if (!userInfo.openid) {
      // 用户未登录，不监听
      return
    }

    // 如果已经有监听，先关闭
    if (this.globalGameWatcher) {
      this.globalGameWatcher.close()
      this.globalGameWatcher = null
    }

    // 监听当前用户的所有比赛
    const db = this.cloud.database()
    this.globalGameWatcher = db.collection('games')
      .where({
        _openid: userInfo.openid
      })
      .watch({
        onChange: (snapshot) => {
          // 文档变更了，触发重新同步合并
          if (snapshot.type === 'init') {
            // 初始化完成，不需要处理
            console.log('[全局监听] 初始化完成')
            return
          }

          console.log('[全局监听] 数据变更:', snapshot.docChanges.length, '条')

          // 重新从云端同步合并到本地
          this.syncUserGameHistory()
            .then(mergedCount => {
              if (mergedCount > 0) {
                // 有新数据，触发事件通知页面刷新
                this.eventBus.emit('gameDataChanged', {
                  timestamp: Date.now(),
                  mergedCount: mergedCount
                })
              }
            })
            .catch(err => {
              console.error('[全局监听] 同步失败:', err)
            })
        },
        onError: (err) => {
          console.error('[全局监听] 错误:', err)
          // 出错重试一次
          setTimeout(() => {
            this.startGlobalGameWatch()
          }, 3000)
        }
      })

    this.globalData.gameWatcherStarted = true
  },

  // 停止全局监听
  stopGlobalGameWatch() {
    if (this.globalGameWatcher) {
      this.globalGameWatcher.close()
      this.globalGameWatcher = null
    }
  },

  globalData: {
    currentCourse: null,
    currentPlayers: [],
    currentScores: {},
    tabBarSelected: 0,
    gameWatcherStarted: false
  },

  // 全局事件中心 - 跨页面通知
  eventBus: {
    listeners: {},

    on(eventName, callback) {
      if (!this.listeners[eventName]) {
        this.listeners[eventName] = []
      }
      this.listeners[eventName].push(callback)
    },

    off(eventName, callback) {
      if (!this.listeners[eventName]) return
      this.listeners[eventName] = this.listeners[eventName].filter(cb => cb !== callback)
    },

    emit(eventName, data) {
      if (!this.listeners[eventName]) return
      this.listeners[eventName].forEach(cb => cb(data))
    }
  }
})
