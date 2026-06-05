const {
  buildCourseCatalog,
  dedupeCatalogCourses,
  normalizeCatalogNameKey
} = require("../../package-courses/utils/course-catalog")

describe("course catalog", function() {
  test("normalizeCatalogNameKey should remove routing suffixes", function() {
    expect(normalizeCatalogNameKey("上海太阳岛国际高尔夫俱乐部-A/B场")).toBe("上海太阳岛")
    expect(normalizeCatalogNameKey("太阳岛高尔夫俱乐部-上海/新场")).toBe("太阳岛")
  })

  test("dedupeCatalogCourses should merge same course routing variants", function() {
    const deduped = dedupeCatalogCourses([
      {
        id: "sun-a",
        name: "上海太阳岛国际高尔夫俱乐部-A场",
        province: "江苏",
        city: "昆山",
        catalogRank: 40,
        hasStandardPar: true,
        holesSource: "public-web",
        holes: Array(9).fill(0).map(function(_, index) {
          return { hole: index + 1, par: 4 }
        }),
        searchAliases: ["Shanghai Sun Island A"]
      },
      {
        id: "sun-ab",
        name: "上海太阳岛国际高尔夫俱乐部-A/B场",
        province: "江苏",
        city: "昆山",
        catalogRank: 40,
        hasStandardPar: true,
        holesSource: "public-web",
        totalPar: 72,
        holes: Array(18).fill(0).map(function(_, index) {
          return { hole: index + 1, par: 4 }
        }),
        searchAliases: ["Shanghai Sun Island A-B"]
      }
    ])

    expect(deduped).toHaveLength(1)
    expect(deduped[0].id).toBe("sun-ab")
    expect(deduped[0].duplicateCourseIds).toEqual(["sun-a"])
    expect(deduped[0].searchAliases).toContain("Shanghai Sun Island A")
  })

  test("dedupeCatalogCourses should keep same brand in different cities", function() {
    const deduped = dedupeCatalogCourses([
      {
        id: "nanjing-sun",
        name: "南京太阳岛高尔夫俱乐部",
        province: "江苏",
        city: "南京"
      },
      {
        id: "suzhou-sun",
        name: "苏州太阳岛高尔夫俱乐部",
        province: "江苏",
        city: "苏州"
      }
    ])

    expect(deduped).toHaveLength(2)
  })

  test("buildCourseCatalog should reduce Shanghai Sun Island public variants", function() {
    const catalog = buildCourseCatalog([])
    const shanghaiSunIsland = catalog.filter(function(course) {
      return String(course.name || "").indexOf("上海太阳岛国际高尔夫俱乐部") >= 0
    })

    expect(shanghaiSunIsland).toHaveLength(1)
    expect(shanghaiSunIsland[0].duplicateCourseIds.length).toBeGreaterThanOrEqual(5)
  })
})
