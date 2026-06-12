const {
  buildCourseCatalog,
  dedupeCatalogCourses,
  getCourseExclusionReason,
  getNormalizedDedupName,
  isExcludedBuiltinCourse,
  normalizeCatalogNameKey,
  shouldMergeCourseRecords
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

  test("buildCourseCatalog should remove suspected practice and indoor simulator POIs", function() {
    const catalog = buildCourseCatalog([])
    const excludedIds = [
      "amap-B0KRT5T3OB",
      "amap-B0LBT539LA",
      "amap-B0LROCWTOM",
      "amap-B0KBLZ15NZ",
      "amap-B0J32HAMJI",
      "amap-B0L2PLQQKW",
      "amap-B0JDOUI1JG"
    ]

    excludedIds.forEach(function(id) {
      expect(catalog.find(function(course) { return course.id === id })).toBeUndefined()
    })
    expect(isExcludedBuiltinCourse({ id: "amap-B0KBLZ15NZ", source: "amap-poi" })).toBe(true)
    expect(isExcludedBuiltinCourse({ id: "amap-B0KBLZ15NZ", source: "public-web" })).toBe(false)
    expect(getCourseExclusionReason({
      id: "amap-B0KBLZ15NZ",
      source: "amap-poi",
      name: "Tango高尔夫俱乐部",
      location: "世包国际中心西塔楼负一楼(曼哈顿KTV电梯下B1)",
      holes: null
    })).toBe("confirmed-non-course-poi")
    expect(getCourseExclusionReason({
      id: "amap-B0KRT5T3OB",
      source: "amap-poi",
      name: "重庆伯尔棣高尔夫俱乐部",
      location: "龙怀街1号保利高尔夫练习场二楼2001号-2002号包房",
      holes: null
    })).toBe("confirmed-non-course-poi")
    expect(getCourseExclusionReason({
      id: "amap-new-indoor",
      source: "amap-poi",
      name: "城市室内高尔夫俱乐部",
      location: "中心商场B1模拟包房",
      holes: null
    })).toBe("suspected-indoor-simulator")
    expect(getCourseExclusionReason({
      id: "amap-new-practice",
      source: "amap-poi",
      name: "城市高尔夫俱乐部",
      location: "高尔夫练习场二楼",
      holes: null
    })).toBe("suspected-practice-range")
    expect(getCourseExclusionReason({
      id: "amap-B0J32HAMJI",
      source: "amap-poi",
      name: "朗迪斯特高尔夫俱乐部",
      location: "五常街道大华西溪风情新天地1-28号",
      holes: null
    })).toBe("suspected-urban-commercial-poi")
    expect(getCourseExclusionReason({
      id: "amap-new-office",
      source: "amap-poi",
      name: "城市高尔夫俱乐部",
      location: "万众国际B座1403",
      holes: null
    })).toBe("suspected-urban-commercial-poi")
    expect(getCourseExclusionReason({
      id: "amap-industrial-park-only",
      source: "amap-poi",
      name: "城市高尔夫俱乐部",
      location: "城阳街道兴阳产业园",
      holes: null
    })).toBe("")
    expect(getCourseExclusionReason({
      id: "amap-B0L2PLQQKW",
      source: "amap-poi",
      name: "依文高尔夫俱乐部",
      location: "澳门路口纵横体育公园内103",
      holes: null
    })).toBe("suspected-urban-facility-poi")
    expect(getCourseExclusionReason({
      id: "amap-B0JDOUI1JG",
      source: "amap-poi",
      name: "斯外戈高尔夫俱乐部",
      location: "轨道交通2号线王家墩东站(王家墩东地铁站D1口旁)",
      holes: null
    })).toBe("suspected-urban-facility-poi")
    expect(getCourseExclusionReason({
      id: "amap-sports-park-only",
      source: "amap-poi",
      name: "城市高尔夫俱乐部",
      location: "山亭镇妈祖体育公园内",
      holes: null
    })).toBe("")
  })

  test("getCourseExclusionReason should only hide unverified amap POI records", function() {
    const simulatorLikeCourse = {
      id: "public-sim-name",
      source: "public-web",
      holesSource: "public-web",
      name: "Indoor Simulator Golf Club",
      location: "B1",
      holes: Array(18).fill(0).map(function(_, index) {
        return { hole: index + 1, par: 4, distance: 360 }
      })
    }
    const manuallyVerifiedAmapCourse = {
      id: "amap-user-verified",
      source: "amap-poi",
      holesVerified: true,
      name: "室内高尔夫俱乐部",
      location: "商场B1",
      holes: Array(18).fill(0).map(function(_, index) {
        return { hole: index + 1, par: 4, distance: 360 }
      })
    }

    expect(getCourseExclusionReason(simulatorLikeCourse)).toBe("")
    expect(getCourseExclusionReason(manuallyVerifiedAmapCourse)).toBe("")
  })

  test("buildCourseCatalog should merge confirmed duplicate course records", function() {
    const catalog = buildCourseCatalog([])
    const jiubridge = catalog.filter(function(course) {
      return String(course.name || "").indexOf("杭州九桥") >= 0
    })
    const silport = catalog.filter(function(course) {
      return String(course.name || "").indexOf("上海旭宝高尔夫俱乐部-中场") >= 0
    })

    expect(jiubridge).toHaveLength(1)
    expect(jiubridge[0].duplicateCourseIds).toEqual(expect.arrayContaining([
      "amap-B023D0PPL6",
      "amap-B0M6LH67SF"
    ]))
    expect(silport).toHaveLength(1)
    expect(silport[0].duplicateCourseIds).toContain("public-chn-sh-0017-02")
  })

  test("buildCourseCatalog should merge Beijing Grand Canal duplicate records", function() {
    const catalog = buildCourseCatalog([])
    const grandCanal = catalog.filter(function(course) {
      return String(course.name || "").indexOf("大运河高尔夫俱乐部") >= 0
    })

    expect(getNormalizedDedupName({ name: "北京大运河高尔夫俱乐部", province: "北京", city: "通州" })).toBe("大运河")
    expect(getNormalizedDedupName({ name: "大运河高尔夫俱乐部", province: "北京", city: "通州" })).toBe("大运河")
    expect(grandCanal).toHaveLength(1)
    expect(grandCanal[0].duplicateCourseIds).toEqual(expect.arrayContaining([
      "public-chn-bj-0062-01"
    ]))
  })

  test("shouldMergeCourseRecords should protect nearby courses in different cities", function() {
    const shenzhenMissionHills = {
      id: "public-chn-gd-0045-06",
      name: "观澜湖高尔夫球会-深圳/埃尔斯场",
      province: "广东",
      city: "深圳",
      latitude: 22.782753,
      longitude: 114.009519,
      holesSource: "public-web",
      holes: Array(18).fill(0).map(function(_, index) {
        return { hole: index + 1, par: 4, distance: 360 }
      })
    }
    const dongguanMissionHills = {
      id: "public-chn-gd-0012-01",
      name: "观澜湖高尔夫球会-东莞/安妮卡场",
      province: "广东",
      city: "东莞",
      latitude: 22.784624,
      longitude: 114.004215,
      holesSource: "public-web",
      holes: Array(18).fill(0).map(function(_, index) {
        return { hole: index + 1, par: 4, distance: 360 }
      })
    }

    expect(shouldMergeCourseRecords(shenzhenMissionHills, dongguanMissionHills)).toBe(false)
    expect(buildCourseCatalog([]).filter(function(course) {
      return String(course.name || "").indexOf("观澜湖高尔夫球会") >= 0
    })).toHaveLength(3)
  })

  test("shouldMergeCourseRecords should keep generic names separate", function() {
    expect(getNormalizedDedupName({ name: "北京高尔夫俱乐部", province: "北京", city: "北京" })).toBe("北京")
    expect(shouldMergeCourseRecords(
      {
        id: "beijing-golf",
        name: "北京高尔夫俱乐部",
        province: "北京",
        city: "北京",
        latitude: 40.150841,
        longitude: 116.684516
      },
      {
        id: "beijing-international",
        name: "北京国际高尔夫俱乐部",
        province: "北京",
        city: "北京",
        latitude: 40.159541,
        longitude: 116.675895
      }
    )).toBe(false)
  })
})
