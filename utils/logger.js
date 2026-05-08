/**
 * 日志工具类
 * 生产环境自动禁用调试日志
 */

const isDev = __wxConfig?.envVersion === 'develop' || typeof __wxConfig === 'undefined'

const logger = {
  log: function(...args) {
    if (isDev) {
      console.log('[LOG]', ...args)
    }
  },

  warn: function(...args) {
    console.warn('[WARN]', ...args)
  },

  error: function(...args) {
    console.error('[ERROR]', ...args)
  },

  debug: function(...args) {
    if (isDev) {
      console.log('[DEBUG]', ...args)
    }
  },

  info: function(...args) {
    if (isDev) {
      console.log('[INFO]', ...args)
    }
  },

  // 用于关键操作的日志，生产环境也保留
  track: function(event, data) {
    console.log('[TRACK]', event, data || '')
  }
}

module.exports = logger
