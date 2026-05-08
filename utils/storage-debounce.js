/**
 * 防抖存储工具
 * 避免频繁调用 wx.setStorageSync 导致的性能问题
 */

// 防抖计时器
const timers = {}
// 待写入的数据缓存
const pendingData = {}

/**
 * 防抖设置本地存储
 * @param {string} key - 存储键名
 * @param {*} data - 存储数据
 * @param {number} delay - 延迟时间(ms)，默认500ms
 */
function setStorageDebounced(key, data, delay = 500) {
  // 缓存数据
  pendingData[key] = data

  // 清除之前的计时器
  if (timers[key]) {
    clearTimeout(timers[key])
  }

  // 设置新的计时器
  timers[key] = setTimeout(() => {
    try {
      wx.setStorageSync(key, pendingData[key])
      delete pendingData[key]
      delete timers[key]
    } catch (e) {
      console.error(`[StorageDebounced] 写入失败: ${key}`, e)
    }
  }, delay)
}

/**
 * 立即写入所有待存储的数据
 * 在页面卸载或应用退出时调用
 */
function flushAllStorage() {
  Object.keys(timers).forEach(key => {
    clearTimeout(timers[key])
    if (pendingData[key] !== undefined) {
      try {
        wx.setStorageSync(key, pendingData[key])
      } catch (e) {
        console.error(`[StorageDebounced] 刷新失败: ${key}`, e)
      }
    }
  })

  // 清空缓存
  Object.keys(timers).forEach(key => delete timers[key])
  Object.keys(pendingData).forEach(key => delete pendingData[key])
}

/**
 * 立即写入指定key的数据
 * @param {string} key - 存储键名
 */
function flushStorage(key) {
  if (timers[key]) {
    clearTimeout(timers[key])
    delete timers[key]
  }
  if (pendingData[key] !== undefined) {
    try {
      wx.setStorageSync(key, pendingData[key])
      delete pendingData[key]
    } catch (e) {
      console.error(`[StorageDebounced] 刷新失败: ${key}`, e)
    }
  }
}

module.exports = {
  setStorageDebounced,
  flushAllStorage,
  flushStorage
}
