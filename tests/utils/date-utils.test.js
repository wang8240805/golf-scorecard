const { formatDate } = require("../../utils/date-utils")

describe("utils/date-utils", function() {
  test("formatDate should render full format", function() {
    expect(formatDate("2026-05-14T00:00:00Z", "full")).toContain("年")
  })

  test("formatDate should render compact format", function() {
    expect(formatDate("2026-05-14T00:00:00Z", "compact")).toMatch(/^\d{8}$/)
  })

  test("formatDate should fallback safely for invalid date", function() {
    expect(typeof formatDate("invalid-date", "short")).toBe("string")
  })
})
