/**
 * 用户偏好管理器
 * 用于记住用户的各种选择，下次默认使用
 */

const PREFERENCE_KEY = 'user_preferences'

// 默认偏好设置
const DEFAULT_PREFERENCES = {
  // 海报风格偏好
  posterStyle: 'pro', // 'pro' | 'minimal' | 'fun'

  // 其他可扩展的偏好
  // theme: 'light',
  // fontSize: 'medium',
}

/**
 * 获取所有偏好设置
 */
function getAllPreferences() {
  try {
    const prefs = wx.getStorageSync(PREFERENCE_KEY)
    return { ...DEFAULT_PREFERENCES, ...(prefs || {}) }
  } catch (e) {
    return DEFAULT_PREFERENCES
  }
}

/**
 * 获取特定偏好
 * @param {string} key - 偏好键名
 * @param {*} defaultValue - 默认值
 */
function getPreference(key, defaultValue = null) {
  const prefs = getAllPreferences()
  return prefs[key] !== undefined ? prefs[key] : defaultValue
}

/**
 * 设置偏好
 * @param {string} key - 偏好键名
 * @param {*} value - 值
 */
function setPreference(key, value) {
  const prefs = getAllPreferences()
  prefs[key] = value
  wx.setStorageSync(PREFERENCE_KEY, prefs)
}

/**
 * 批量设置偏好
 * @param {Object} updates - 更新的偏好对象
 */
function setPreferences(updates) {
  const prefs = getAllPreferences()
  Object.assign(prefs, updates)
  wx.setStorageSync(PREFERENCE_KEY, prefs)
}

/**
 * 重置偏好为默认值
 */
function resetPreferences() {
  wx.setStorageSync(PREFERENCE_KEY, DEFAULT_PREFERENCES)
}

module.exports = {
  getAllPreferences,
  getPreference,
  setPreference,
  setPreferences,
  resetPreferences
}
