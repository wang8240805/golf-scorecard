const FEEDBACK_URL = "/package-user/pages/feedback/feedback"
const CONTEXT_KEYS = ["type", "sourcePage", "message", "courseName", "gameId", "keyword", "city"]

function normalizeContext(context) {
  var normalized = {}
  context = context || {}
  CONTEXT_KEYS.forEach(function(key) {
    var value = context[key]
    if (value === undefined || value === null) return
    value = String(value).trim()
    if (!value) return
    normalized[key] = value
  })
  return normalized
}

function buildFeedbackUrl(context) {
  var normalized = normalizeContext(context)
  var query = Object.keys(normalized).map(function(key) {
    return encodeURIComponent(key) + "=" + encodeURIComponent(normalized[key])
  }).join("&")

  return query ? FEEDBACK_URL + "?" + query : FEEDBACK_URL
}

function goToFeedback(context) {
  wx.navigateTo({
    url: buildFeedbackUrl(context)
  })
}

function showFeedbackModal(context) {
  context = context || {}
  wx.showModal({
    title: context.title || "需要帮助？",
    content: context.content || "如果这个问题反复出现，可以把问题反馈给我们。",
    cancelText: "取消",
    confirmText: "反馈问题",
    success: function(res) {
      if (res.confirm) {
        goToFeedback(context)
      }
    }
  })
}

module.exports = {
  buildFeedbackUrl: buildFeedbackUrl,
  goToFeedback: goToFeedback,
  showFeedbackModal: showFeedbackModal,
  normalizeContext: normalizeContext
}
