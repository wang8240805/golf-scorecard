const fs = require("fs")
const path = require("path")
const { loadPage } = require("../helpers/load-page")

function createPage() {
  return loadPage(path.resolve(__dirname, "../../package-courses/pages/all-courses/all-courses.js"))
}

describe("all courses province filters", function() {
  test("buildProvinceQuickFilters should show nearby, top provinces by count, and other", function() {
    const page = createPage()
    page.data.fromNewGame = true

    const filters = page.buildProvinceQuickFilters([
      ...Array(9).fill(0).map(function(_, index) { return { id: "js-" + index, province: "江苏" } }),
      ...Array(8).fill(0).map(function(_, index) { return { id: "sh-" + index, province: "上海" } }),
      ...Array(7).fill(0).map(function(_, index) { return { id: "zj-" + index, province: "浙江" } }),
      ...Array(6).fill(0).map(function(_, index) { return { id: "ah-" + index, province: "安徽" } }),
      ...Array(5).fill(0).map(function(_, index) { return { id: "bj-" + index, province: "北京" } }),
      ...Array(4).fill(0).map(function(_, index) { return { id: "gd-" + index, province: "广东" } }),
      ...Array(3).fill(0).map(function(_, index) { return { id: "sd-" + index, province: "山东" } }),
      ...Array(2).fill(0).map(function(_, index) { return { id: "sc-" + index, province: "四川" } }),
      { id: "ha-1", province: "河南" }
    ])

    expect(filters.map(function(item) { return item.label })).toEqual([
      "附近", "江苏", "上海", "浙江", "安徽", "北京", "广东", "山东", "四川", "其他"
    ])
  })

  test("applyFilters should filter selected province", function() {
    const page = createPage()
    page.data.fromNewGame = true
    page.setData({
      courses: [
        { id: "zj-1", name: "ZJ", province: "浙江", geoDistance: 1000 },
        { id: "sh-1", name: "SH", province: "上海", geoDistance: 2000 }
      ],
      selectedProvinceFilter: "浙江",
      searchKeyword: "",
      showFavoritesOnly: false,
      sortBy: "distance"
    })

    page.applyFilters()

    expect(page.data.filteredCourses.map(function(course) { return course.id })).toEqual(["zj-1"])
  })

  test("province filters should merge municipality suffix variants", function() {
    const page = createPage()
    page.data.fromNewGame = true

    const filters = page.buildProvinceQuickFilters([
      { province: "北京市", geoDistance: 1000 },
      { province: "北京", geoDistance: 1200 },
      { province: "上海市", geoDistance: 2000 }
    ])

    expect(filters.map(function(item) { return item.label })).toEqual(["附近", "北京", "上海", "其他"])
  })

  test("province filters should not use ordinary city names as province tags", function() {
    const page = createPage()
    page.data.fromNewGame = true

    const filters = page.buildProvinceQuickFilters([
      { city: "杭州市", geoDistance: 1000 },
      { province: "浙江省杭州市", city: "杭州", geoDistance: 1200 },
      { city: "北京市", geoDistance: 2000 }
    ])
    const allOptions = page.buildAllProvinceOptions([
      { city: "杭州市", geoDistance: 1000 },
      { province: "浙江省杭州市", city: "杭州", geoDistance: 1200 },
      { city: "北京市", geoDistance: 2000 }
    ])

    expect(filters.map(function(item) { return item.label })).toEqual(["附近", "北京", "浙江", "其他"])
    expect(allOptions.map(function(item) { return item.label })).toEqual(["北京", "浙江"])
  })

  test("applyFilters should match normalized province names", function() {
    const page = createPage()
    page.data.fromNewGame = true
    page.setData({
      courses: [
        { id: "bj-1", name: "BJ1", province: "北京市", geoDistance: 1000 },
        { id: "bj-2", name: "BJ2", province: "北京", geoDistance: 1200 },
        { id: "sh-1", name: "SH", province: "上海市", geoDistance: 2000 }
      ],
      selectedProvinceFilter: "北京",
      searchKeyword: "",
      showFavoritesOnly: false,
      sortBy: "distance"
    })

    page.applyFilters()

    expect(page.data.filteredCourses.map(function(course) { return course.id })).toEqual(["bj-1", "bj-2"])
  })

  test("applyFilters should sort nearby by distance without province filtering", function() {
    const page = createPage()
    page.data.fromNewGame = true
    page.setData({
      courses: [
        { id: "far", name: "Far", province: "北京", geoDistance: 5000 },
        { id: "near", name: "Near", province: "上海", geoDistance: 1000 },
        { id: "mid", name: "Mid", province: "浙江", geoDistance: 3000 }
      ],
      selectedProvinceFilter: "__nearby__",
      searchKeyword: "",
      showFavoritesOnly: false,
      sortBy: "distance"
    })

    page.applyFilters()

    expect(page.data.filteredCourses.map(function(course) { return course.id })).toEqual(["near", "mid", "far"])
  })

  test("selectProvinceFilter should open province picker for other", function() {
    const page = createPage()

    page.selectProvinceFilter({
      currentTarget: {
        dataset: {
          value: "__more__"
        }
      }
    })

    expect(page.data.showProvincePicker).toBe(true)
  })

  test("selectProvinceFromPicker should filter chosen province and close picker", function() {
    const page = createPage()
    page.data.fromNewGame = true
    page.setData({
      showProvincePicker: true,
      courses: [
        { id: "gd-1", name: "GD", province: "广东", geoDistance: 2000 },
        { id: "bj-1", name: "BJ", province: "北京", geoDistance: 1000 }
      ],
      searchKeyword: "",
      showFavoritesOnly: false,
      sortBy: "distance"
    })

    page.selectProvinceFromPicker({
      currentTarget: {
        dataset: {
          value: "广东"
        }
      }
    })

    expect(page.data.showProvincePicker).toBe(false)
    expect(page.data.selectedProvinceFilter).toBe("广东")
    expect(page.data.filteredCourses.map(function(course) { return course.id })).toEqual(["gd-1"])
  })

  test("template should use province chips in new game mode", function() {
    const wxml = fs.readFileSync(
      path.resolve(__dirname, "../../package-courses/pages/all-courses/all-courses.wxml"),
      "utf8"
    )

    expect(wxml).toContain('province-filter-row" wx:if="{{fromNewGame && provinceQuickFilters.length > 0}}"')
    expect(wxml).toContain('class="toolbar-actions" wx:if="{{!fromNewGame}}"')
    expect(wxml).toContain("选择省份")
    expect(wxml).toContain('class="province-filter-chip {{selectedProvinceFilter === item.value ? \'active\' : \'\'}}"')
    expect(wxml).toContain('bindtap="selectProvinceFromPicker"')
    expect(wxml).not.toContain("province-filter-scroll")
  })
})
