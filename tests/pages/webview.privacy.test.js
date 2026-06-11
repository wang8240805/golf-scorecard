const { loadPage } = require("../helpers/load-page")

describe("local agreement and privacy pages", function() {
  test("privacy policy explains collected data and purpose", function() {
    const page = loadPage("../../package-user/pages/webview/webview.js")
    const content = page.getPrivacyPolicyContent()

    expect(content).toContain("微信身份标识")
    expect(content).toContain("大致位置信息")
    expect(content).toContain("手机号")
    expect(content).toContain("计分卡图片")
    expect(content).toContain("目的")
    expect(content.length).toBeGreaterThan(1000)
  })

  test("user agreement is not blank and links data handling to privacy policy", function() {
    const page = loadPage("../../package-user/pages/webview/webview.js")
    const content = page.getUserAgreementContent()

    expect(content).toContain("WinPAR高尔夫记分卡")
    expect(content).toContain("《隐私政策》")
    expect(content).toContain("数据安全")
    expect(content.length).toBeGreaterThan(800)
  })
})
