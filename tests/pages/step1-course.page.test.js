const path = require("path")
const { loadPage } = require("../helpers/load-page")
const { COURSE_CATALOG_VERSION } = require("../../package-courses/utils/course-catalog-version")

describe("step1-course page", function() {
  test("getMatchConfidence should classify by thresholds", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"))

    expect(page.getMatchConfidence(5000).level).toBe("high")
    expect(page.getMatchConfidence(30000).level).toBe("medium")
    expect(page.getMatchConfidence(80000).level).toBe("low")
  })

  test("calculateNearbyCourses should select nearest recommended course", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"))
    page.data = { userLocation: { latitude: 39.9, longitude: 116.4 } }

    wx.setStorageSync("courses", [
      { id: "c1", name: "near", latitude: 39.901, longitude: 116.401, totalDistance: 7000 },
      { id: "c2", name: "far", latitude: 40.2, longitude: 117.1, totalDistance: 7300 }
    ])

    page.calculateNearbyCourses({ latitude: 39.9, longitude: 116.4 })

    expect(page.data.recommendedCourse.id).toBe("c1")
    expect(page.data.selectedCourseId).toBe("c1")
    expect(wx.getStorageSync("currentCourseId")).toBe("c1")
  })

  test("loadCoursesLocal should use initialized cache without rebuilding catalog", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"))
    page.data = {
      userLocation: { latitude: 39.9, longitude: 116.4 },
      coursesLoaded: false
    }
    page.calculateNearbyCourses = jest.fn()
    wx.setStorageSync("coursesInitialized", true)
    wx.setStorageSync("coursesDataVersion", COURSE_CATALOG_VERSION)
    wx.setStorageSync("courses", [{ id: "cached", name: "Cached Course" }])

    page.loadCoursesLocal()

    expect(page.data.coursesLoaded).toBe(true)
    expect(page.calculateNearbyCourses).toHaveBeenCalledWith({ latitude: 39.9, longitude: 116.4 })
  })

  test("loadCoursesLocal should show stale cached courses before refreshing catalog", function() {
    jest.useFakeTimers()
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"))
    page.data = {
      userLocation: { latitude: 39.9, longitude: 116.4 },
      coursesLoaded: false
    }
    page.calculateNearbyCourses = jest.fn()
    wx.setStorageSync("coursesDataVersion", "old-catalog")
    wx.setStorageSync("courses", [{ id: "cached", name: "Cached Course" }])

    page.loadCoursesLocal()

    expect(page.data.coursesLoaded).toBe(true)
    expect(page.calculateNearbyCourses).toHaveBeenCalledWith({ latitude: 39.9, longitude: 116.4 })

    jest.clearAllTimers()
    jest.useRealTimers()
  })

  test("calculateNearbyCourses should not overwrite manually selected course", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"))
    page.data = {
      userLocation: { latitude: 39.9, longitude: 116.4 },
      manualCourseSelected: true,
      selectedCourseId: "manual",
      recommendedCourse: { id: "manual", name: "Manual Course" }
    }
    wx.setStorageSync("currentCourseId", "manual")
    wx.setStorageSync("courses", [
      { id: "near", name: "Near", latitude: 39.901, longitude: 116.401, totalDistance: 7000 }
    ])

    page.calculateNearbyCourses({ latitude: 39.9, longitude: 116.4 })

    expect(page.data.recommendedCourse.id).toBe("manual")
    expect(page.data.selectedCourseId).toBe("manual")
    expect(wx.getStorageSync("currentCourseId")).toBe("manual")
  })

  test("setHoleCount should save selected hole count before player step", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"))

    page.setHoleCount({ currentTarget: { dataset: { value: "9" } } })
    expect(page.data.holeCount).toBe(9)
    expect(wx.getStorageSync("newGameHoleCount")).toBe(9)

    page.setHoleCount({ currentTarget: { dataset: { value: "18" } } })
    expect(page.data.holeCount).toBe(18)
    expect(wx.getStorageSync("newGameHoleCount")).toBe(18)
  })

  test("openLocationSetting should retry location after permission is enabled", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"))
    page.requestUserLocation = jest.fn()
    wx.openSetting.mockImplementation(function(options) {
      options.success({
        authSetting: {
          "scope.userFuzzyLocation": true
        }
      })
    })

    page.openLocationSetting()

    expect(wx.openSetting).toHaveBeenCalled()
    expect(page.requestUserLocation).toHaveBeenCalled()
  })

  test("nearby-course data should match snapshot", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"))
    page.data = { userLocation: { latitude: 39.9, longitude: 116.4 } }

    wx.setStorageSync("courses", [
      { id: "c1", name: "Alpha", latitude: 39.901, longitude: 116.401, totalDistance: 7000 }
    ])

    page.calculateNearbyCourses({ latitude: 39.9, longitude: 116.4 })

    expect({
      selectedCourseId: page.data.selectedCourseId,
      recommendedCourse: {
        id: page.data.recommendedCourse.id,
        distanceFormatted: page.data.recommendedCourse.distanceFormatted,
        matchConfidence: page.data.recommendedCourse.matchConfidence,
        totalDistanceFormatted: page.data.recommendedCourse.totalDistanceFormatted
      }
    }).toMatchSnapshot()
  })
})
