const path = require("path")
const fs = require("fs")
const { loadPage } = require("../helpers/load-page")

describe("courses navigation", function() {
  test("view all courses should expand courses in current page", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/courses/courses.js"))
    page.loadCourses = jest.fn()

    page.goToAllCourses()

    expect(wx.navigateTo).not.toHaveBeenCalled()
    expect(page.data.showAllCourses).toBe(true)
    expect(page.loadCourses).toHaveBeenCalled()
  })

  test("my courses page should not navigate to all-courses package", function() {
    const source = fs.readFileSync(path.resolve(__dirname, "../../package-courses/pages/courses/courses.js"), "utf8")

    expect(source).not.toContain("all-courses/all-courses")
    expect(source).toContain("showAllCourses")
  })

  test("my courses page should not show photo recognition entry", function() {
    const wxml = fs.readFileSync(path.resolve(__dirname, "../../package-courses/pages/courses/courses.wxml"), "utf8")

    expect(wxml).not.toContain("拍照识别")
    expect(wxml).not.toContain('bindtap="openOcrScanner"')
  })

  test("course empty states should expose feedback entry", function() {
    const myCoursesWxml = fs.readFileSync(path.resolve(__dirname, "../../package-courses/pages/courses/courses.wxml"), "utf8")
    const allCoursesWxml = fs.readFileSync(path.resolve(__dirname, "../../package-courses/pages/all-courses/all-courses.wxml"), "utf8")
    const step1Wxml = fs.readFileSync(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.wxml"), "utf8")

    expect(myCoursesWxml).toContain("没找到球场？反馈给我们")
    expect(allCoursesWxml).toContain("没找到球场？反馈给我们")
    expect(step1Wxml).toContain("找不到球场？反馈给我们")
  })

  test("course pages should use feedback helper for missing course and OCR failures", function() {
    const myCoursesJs = fs.readFileSync(path.resolve(__dirname, "../../package-courses/pages/courses/courses.js"), "utf8")
    const allCoursesJs = fs.readFileSync(path.resolve(__dirname, "../../package-courses/pages/all-courses/all-courses.js"), "utf8")
    const step1Js = fs.readFileSync(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"), "utf8")

    expect(myCoursesJs).toContain("utils/feedback.js")
    expect(myCoursesJs).toContain("type: 'ocr_error'")
    expect(allCoursesJs).toContain("type: 'course_missing'")
    expect(step1Js).toContain("type: 'ocr_error'")
    expect(step1Js).toContain("type: 'course_missing'")
  })
})
