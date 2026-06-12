const storage = {}
const fileSystem = {}
const directories = {}

global.__wxStorage = storage
global.__wxFileSystem = fileSystem

global.wx = {
  env: {
    USER_DATA_PATH: "/tmp/wx-user-data"
  },
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
  getFileSystemManager: function() {
    return {
      accessSync: function(path) {
        if (!directories[path] && !Object.prototype.hasOwnProperty.call(fileSystem, path)) {
          throw new Error("no such file or directory")
        }
      },
      mkdirSync: function(path) {
        directories[path] = true
      },
      writeFileSync: function(path, data) {
        fileSystem[path] = data
      },
      readFileSync: function(path) {
        if (!Object.prototype.hasOwnProperty.call(fileSystem, path)) {
          throw new Error("no such file")
        }
        return fileSystem[path]
      },
      readdirSync: function(path) {
        const prefix = path + "/"
        return Object.keys(fileSystem)
          .filter(function(filePath) {
            return filePath.indexOf(prefix) === 0
          })
          .map(function(filePath) {
            return filePath.slice(prefix.length)
          })
      },
      unlinkSync: function(path) {
        delete fileSystem[path]
      }
    }
  },
  showToast: jest.fn(),
  showLoading: jest.fn(),
  hideLoading: jest.fn(),
  showModal: jest.fn(),
  navigateTo: jest.fn(),
  navigateBack: jest.fn(),
  redirectTo: jest.fn(),
  switchTab: jest.fn(),
  saveFile: jest.fn(function(options) {
    options.success({
      savedFilePath: "wxfile://usr/saved-avatar.jpg"
    })
  }),
  login: jest.fn(),
  authorize: jest.fn(),
  openSetting: jest.fn(),
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
  Object.keys(fileSystem).forEach(function(key) {
    delete fileSystem[key]
  })
  Object.keys(directories).forEach(function(key) {
    delete directories[key]
  })
  delete wx.cloud
  jest.clearAllMocks()
})
