const path = require("path")
const fs = require("fs")
const { loadPage } = require("../helpers/load-page")

describe("courses navigation", function() {
  test("view all courses should open the same all-courses mode as new game", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/courses/courses.js"))

    page.goToAllCourses()

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: "/package-courses/pages/all-courses/all-courses?from=new-game"
    })
  })

  test("my courses page should not show photo recognition entry", function() {
    const wxml = fs.readFileSync(path.resolve(__dirname, "../../package-courses/pages/courses/courses.wxml"), "utf8")

    expect(wxml).not.toContain("拍照识别")
    expect(wxml).not.toContain('bindtap="openOcrScanner"')
  })
})
