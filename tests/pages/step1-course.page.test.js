const path = require("path")
const { loadPage } = require("../helpers/load-page")

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

  test("setHoleCount should save selected hole count before player step", function() {
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"))

    page.setHoleCount({ currentTarget: { dataset: { value: "9" } } })
    expect(page.data.holeCount).toBe(9)
    expect(wx.getStorageSync("newGameHoleCount")).toBe(9)

    page.setHoleCount({ currentTarget: { dataset: { value: "18" } } })
    expect(page.data.holeCount).toBe(18)
    expect(wx.getStorageSync("newGameHoleCount")).toBe(18)
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
