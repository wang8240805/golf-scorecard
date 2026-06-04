const storage = {}

global.__wxStorage = storage

global.wx = {
  getStorageSync: function(key) {
    return storage[key]
  },
  setStorageSync: function(key, value) {
    storage[key] = value
  },
  removeStorageSync: function(key) {
    delete storage[key]
  },
  clearStorageSync: function() {
    Object.keys(storage).forEach(function(key) {
      delete storage[key]
    })
  },
  showToast: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  showModal: jest.fn(),
  navigateTo: jest.fn(),
  redirectTo: jest.fn(),
  switchTab: jest.fn(),
  login: jest.fn(),
  authorize: jest.fn(),
  getLocation: jest.fn(),
  getFuzzyLocation: jest.fn(),
  getSystemInfoSync: function() {
    return {
      SDKVersion: "3.4.5",
      platform: "devtools",
      version: "8.0.0"
    }
  }
}

global.getApp = function() {
  return {}
}

beforeEach(function() {
  wx.clearStorageSync()
  delete wx.cloud
  jest.clearAllMocks()
})
