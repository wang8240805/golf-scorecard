const feedback = require("../../utils/feedback")

describe("feedback utils", function() {
  test("buildFeedbackUrl should encode whitelisted context", function() {
    const url = feedback.buildFeedbackUrl({
      type: "course_missing",
      sourcePage: "all-courses",
      keyword: "北京 球场",
      city: "北京",
      ignored: "x"
    })

    expect(url).toBe("/package-user/pages/feedback/feedback?type=course_missing&sourcePage=all-courses&keyword=%E5%8C%97%E4%BA%AC%20%E7%90%83%E5%9C%BA&city=%E5%8C%97%E4%BA%AC")
  })

  test("goToFeedback should navigate to feedback page with context", function() {
    feedback.goToFeedback({
      type: "report_error",
      gameId: "game-1"
    })

    expect(wx.navigateTo).toHaveBeenCalledWith({
      url: "/package-user/pages/feedback/feedback?type=report_error&gameId=game-1"
    })
  })
})
