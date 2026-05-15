const {
  calculateDistance,
  formatDistance,
  calculateAndSortCourses
} = require("../../utils/geo-utils")

describe("utils/geo-utils", function() {
  test("formatDistance should format meters and kilometers", function() {
    expect(formatDistance(120)).toBe("120m")
    expect(formatDistance(2345)).toBe("2.3km")
  })

  test("calculateDistance should be near zero for same point", function() {
    const d = calculateDistance(39.9, 116.4, 39.9, 116.4)
    expect(d).toBeLessThan(1)
  })

  test("calculateAndSortCourses should return by ascending distance", function() {
    const courses = [
      { id: "far", latitude: 40.2, longitude: 116.8 },
      { id: "near", latitude: 39.91, longitude: 116.41 }
    ]
    const sorted = calculateAndSortCourses(courses, {
      latitude: 39.9,
      longitude: 116.4
    })

    expect(sorted[0].id).toBe("near")
    expect(sorted[0].distanceFormatted).toBeDefined()
  })
})
