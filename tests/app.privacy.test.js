const { loadApp } = require("./helpers/load-app")
const path = require("path")

describe("app privacy authorization", function() {
  test("runAfterPrivacyAuthorization waits for privacy authorization before callback", async function() {
    const app = loadApp(path.resolve(__dirname, "../app.js"))
    let called = false

    wx.requirePrivacyAuthorize = jest.fn(function(options) {
      expect(called).toBe(false)
      options.success()
    })
    app.startPostPrivacyTasks = jest.fn()

    await app.runAfterPrivacyAuthorization(function() {
      called = true
    })

    expect(wx.requirePrivacyAuthorize).toHaveBeenCalled()
    expect(called).toBe(true)
    expect(wx.getStorageSync("winparPrivacyAgreedAt")).toBeTruthy()
    expect(app.startPostPrivacyTasks).toHaveBeenCalled()
  })

  test("runAfterPrivacyAuthorization does not run callback after rejection", async function() {
    const app = loadApp(path.resolve(__dirname, "../app.js"))
    const callback = jest.fn()
    const rejectCallback = jest.fn()

    wx.requirePrivacyAuthorize = jest.fn(function(options) {
      options.fail({ errMsg: "requirePrivacyAuthorize:fail" })
    })

    const result = await app.runAfterPrivacyAuthorization(callback, rejectCallback)

    expect(result).toBe(false)
    expect(callback).not.toHaveBeenCalled()
    expect(rejectCallback).toHaveBeenCalled()
  })

  test("agreePrivacy stores consent and resolves pending privacy authorization", function() {
    const app = loadApp(path.resolve(__dirname, "../app.js"))
    const resolve = jest.fn()
    app.privacyResolve = resolve
    app.startPostPrivacyTasks = jest.fn()
    app.notifyPrivacyCallbacks = jest.fn()

    app.agreePrivacy()

    expect(wx.getStorageSync("winparPrivacyAgreedAt")).toBeTruthy()
    expect(resolve).toHaveBeenCalledWith({ event: "agree", buttonId: "agree-btn" })
    expect(app.startPostPrivacyTasks).toHaveBeenCalled()
    expect(app.notifyPrivacyCallbacks).toHaveBeenCalledWith(false)
  })
})
