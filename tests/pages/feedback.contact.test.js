const path = require("path")
const fs = require("fs")
const { loadPage } = require("../helpers/load-page")

describe("feedback contact", function() {
  function loadFeedbackPage() {
    return loadPage(path.resolve(__dirname, "../../package-user/pages/feedback/feedback.js"))
  }

  test("template lets users authorize phone or manually enter contact", function() {
    const wxml = fs.readFileSync(path.resolve(__dirname, "../../package-user/pages/feedback/feedback.wxml"), "utf8")

    expect(wxml).toContain('open-type="getPhoneNumber"')
    expect(wxml).toContain('bindgetphonenumber="onGetPhoneNumber"')
    expect(wxml).toContain("contactOptions")
    expect(wxml).toContain("联系方式")
    expect(wxml).toContain("反馈内容")
  })

  test("fills saved phone number as feedback contact", function() {
    wx.setStorageSync("userInfo", {
      phoneNumber: "13812345678"
    })
    const page = loadFeedbackPage()

    page.fillSavedContact()

    expect(page.data.contact).toBe("13812345678")
    expect(page.data.contactType).toBe("phone")
    expect(page.data.contactSource).toBe("已使用账号手机号")
    expect(page.data.phoneMasked).toBe("138****5678")
  })

  test("does not use WeChat nickname as contact", function() {
    wx.setStorageSync("userInfo", {
      nickName: "小王"
    })
    const page = loadFeedbackPage()

    page.fillSavedContact()

    expect(page.data.contact).toBe("")
    expect(page.data.contactType).toBe("phone")
  })

  test("authorized phone updates contact and cached user info", function() {
    wx.setStorageSync("userInfo", {
      nickName: "小王",
      openid: "openid-1"
    })
    wx.cloud = {
      callFunction: jest.fn(function(options) {
        if (options.name === "getPhoneNumber") {
          options.success({
            result: {
              success: true,
              phoneNumber: "13912345678"
            }
          })
          options.complete()
        }
      })
    }
    const page = loadFeedbackPage()

    page.onGetPhoneNumber({
      detail: {
        errMsg: "getPhoneNumber:ok",
        code: "phone-code"
      }
    })

    expect(page.data.contact).toBe("13912345678")
    expect(page.data.contactType).toBe("phone")
    expect(page.data.contactSource).toBe("用户授权手机号")
    expect(wx.getStorageSync("userInfo").phoneNumber).toBe("13912345678")
    expect(wx.cloud.callFunction).toHaveBeenCalledTimes(1)
  })

  test("submit stores contact type for follow-up", function() {
    const page = loadFeedbackPage()
    wx.setStorageSync("userInfo", {
      nickName: "小王",
      avatarUrl: "avatar-url",
      openid: "openid-1"
    })
    page.setData({
      content: "希望增加成绩导出功能",
      contact: "player@example.com",
      contactType: "email",
      contactSource: "用户手动填写"
    })

    page.submitFeedback()

    const feedbacks = wx.getStorageSync("feedbacks")
    expect(feedbacks).toHaveLength(1)
    expect(feedbacks[0]).toEqual(expect.objectContaining({
      contact: "player@example.com",
      contactType: "email",
      contactSource: "用户手动填写"
    }))
    expect(feedbacks[0].userInfo).toEqual(expect.objectContaining({
      openid: "openid-1",
      email: "player@example.com"
    }))
    expect(feedbacks[0].userInfo.nickName).toBeUndefined()
    expect(feedbacks[0].userInfo.avatarUrl).toBeUndefined()
  })

  test("submit stores feedback context from page options", function() {
    const page = loadFeedbackPage()
    page.onLoad({
      type: "course_missing",
      sourcePage: "all-courses",
      keyword: encodeURIComponent("北京球场"),
      city: encodeURIComponent("北京")
    })
    page.setData({
      content: "没有找到我常去的球场",
      contact: "player@example.com",
      contactType: "email"
    })

    page.submitFeedback()

    const feedbacks = wx.getStorageSync("feedbacks")
    expect(page.data.feedbackContextText).toContain("找不到球场")
    expect(feedbacks[0].feedbackContext).toEqual(expect.objectContaining({
      type: "course_missing",
      sourcePage: "all-courses",
      keyword: "北京球场",
      city: "北京"
    }))
  })

  test("submit requires a real contact channel", function() {
    const page = loadFeedbackPage()
    page.setData({
      content: "希望增加成绩导出功能",
      contact: ""
    })

    page.submitFeedback()

    expect(wx.showToast).toHaveBeenCalledWith({ title: "请留下手机号、邮箱或微信号", icon: "none" })
    expect(wx.getStorageSync("feedbacks")).toBeUndefined()
  })
})
