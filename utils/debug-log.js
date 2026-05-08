/**
 * 调试日志工具 - 使用StorageSync存储
 */

const LOG_KEY = '__debug_log__'
const MAX_LOG_SIZE = 150 // 最多保留150条日志，足够记录完整OCR信息

const DebugLog = {
  log(...args) {
    // 先输出到控制台
    console.log(...args)

    // 存储到StorageSync
    try {
      const message = args.map(a => {
        if (typeof a === 'object') {
          try { return JSON.stringify(a) } catch (e) { return String(a) }
        }
        return String(a)
      }).join(' ')

      const logs = wx.getStorageSync(LOG_KEY) || []
      const timestamp = new Date().toLocaleTimeString()
      logs.push(`[${timestamp}] ${message}`)

      // 只保留最近的日志
      if (logs.length > MAX_LOG_SIZE) {
        logs.splice(0, logs.length - MAX_LOG_SIZE)
      }

      wx.setStorageSync(LOG_KEY, logs)
    } catch (e) {
      // 忽略错误
    }
  },

  clear() {
    try { wx.removeStorageSync(LOG_KEY) } catch (e) {}
  },

  read() {
    try {
      const logs = wx.getStorageSync(LOG_KEY) || []
      return logs.join('\n')
    } catch (e) {
      return '(无日志)'
    }
  },

  getFilePath() { return 'StorageSync:' + LOG_KEY }
}

module.exports = DebugLog
