const PRIVACY_AGREED_KEY = "winparPrivacyAgreedAt"
const AUTO_RESET_KEY = "devAlwaysFreshUser"
const DEVELOPER_MODE_KEY = "developerMode"
const COURSE_CACHE_KEYS = [
  "courses",
  "coursesDataVersion",
  "coursesInitialized"
]

function isDevtools() {
  try {
    const info = wx.getSystemInfoSync ? wx.getSystemInfoSync() : {}
    return info.platform === "devtools"
  } catch (e) {
    return false
  }
}

function resetFirstUseState() {
  const keepDeveloperMode = wx.getStorageSync(DEVELOPER_MODE_KEY) === true
  const keepAutoReset = wx.getStorageSync(AUTO_RESET_KEY) === true
  const courseCache = {}

  COURSE_CACHE_KEYS.forEach(function(key) {
    const value = wx.getStorageSync(key)
    if (typeof value !== "undefined") {
      courseCache[key] = value
    }
  })

  wx.clearStorageSync()

  if (keepDeveloperMode) {
    wx.setStorageSync(DEVELOPER_MODE_KEY, true)
  }
  if (keepAutoReset) {
    wx.setStorageSync(AUTO_RESET_KEY, true)
  }

  COURSE_CACHE_KEYS.forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(courseCache, key)) {
      wx.setStorageSync(key, courseCache[key])
    }
  })
}

function resetOnLaunchIfNeeded() {
  if (!isDevtools()) return false
  if (wx.getStorageSync(AUTO_RESET_KEY) !== true) return false

  resetFirstUseState()
  return true
}

module.exports = {
  AUTO_RESET_KEY,
  resetFirstUseState,
  resetOnLaunchIfNeeded,
  isDevtools
}
