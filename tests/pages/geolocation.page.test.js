const path = require("path")
const { loadPage } = require("../helpers/load-page")

const MOCK_LOCATION = {
  latitude: 39.9042,
  longitude: 116.4074
}

function mockLocationSuccess() {
  wx.authorize.mockImplementation(function(options) {
    options.success({ errMsg: "authorize:ok" })
  })
  wx.getFuzzyLocation.mockImplementation(function(options) {
    options.success(Object.assign({ errMsg: "getFuzzyLocation:ok" }, MOCK_LOCATION))
  })
}

describe("geolocation page calls", function() {
  test("index page should request fuzzy location and calculate nearby courses", function() {
    mockLocationSuccess()
    const page = loadPage(path.resolve(__dirname, "../../pages/index/index.js"))
    page.calculateNearbyCourses = jest.fn()

    page.getUserLocation()

    expect(wx.authorize).toHaveBeenCalledWith(expect.objectContaining({
      scope: "scope.userFuzzyLocation"
    }))
    expect(wx.getFuzzyLocation).toHaveBeenCalledWith(expect.objectContaining({
      type: "gcj02"
    }))
    expect(page.data.userLocation).toEqual(MOCK_LOCATION)
    expect(page.data.locationAuth).toBe(true)
    expect(page.calculateNearbyCourses).toHaveBeenCalledWith(MOCK_LOCATION)
  })

  test("courses page should request fuzzy location and derive city", function() {
    mockLocationSuccess()
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/courses/courses.js"))
    page.getCityFromLocation = jest.fn()

    page.getUserLocation()

    expect(wx.authorize).toHaveBeenCalledWith(expect.objectContaining({
      scope: "scope.userFuzzyLocation"
    }))
    expect(wx.getFuzzyLocation).toHaveBeenCalledWith(expect.objectContaining({
      type: "gcj02"
    }))
    expect(page.data.userLocation).toEqual(MOCK_LOCATION)
    expect(page.getCityFromLocation).toHaveBeenCalledWith(MOCK_LOCATION)
  })

  test("all courses page should request fuzzy location and derive city", function() {
    mockLocationSuccess()
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/all-courses/all-courses.js"))
    page.getCityFromLocation = jest.fn()

    page.getUserLocation()

    expect(wx.authorize).toHaveBeenCalledWith(expect.objectContaining({
      scope: "scope.userFuzzyLocation"
    }))
    expect(wx.getFuzzyLocation).toHaveBeenCalledWith(expect.objectContaining({
      type: "gcj02"
    }))
    expect(page.data.userLocation).toEqual(MOCK_LOCATION)
    expect(page.getCityFromLocation).toHaveBeenCalledWith(MOCK_LOCATION)
  })

  test("new game course page should request fuzzy location and calculate recommendations", function() {
    mockLocationSuccess()
    const page = loadPage(path.resolve(__dirname, "../../package-courses/pages/new-game/step1-course/step1-course.js"))
    page.calculateNearbyCourses = jest.fn()

    page.getUserLocation()

    expect(wx.authorize).toHaveBeenCalledWith(expect.objectContaining({
      scope: "scope.userFuzzyLocation"
    }))
    expect(wx.getFuzzyLocation).toHaveBeenCalledWith(expect.objectContaining({
      type: "gcj02"
    }))
    expect(page.data.userLocation).toEqual(MOCK_LOCATION)
    expect(page.calculateNearbyCourses).toHaveBeenCalledWith(MOCK_LOCATION)
  })
})
