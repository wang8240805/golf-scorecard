const fs = require("fs")

function loadBacklog(backlogPath) {
  if (!fs.existsSync(backlogPath)) {
    return { updatedAt: "", items: [] }
  }
  return JSON.parse(fs.readFileSync(backlogPath, "utf8"))
}

function saveBacklog(backlogPath, backlog) {
  backlog.updatedAt = new Date().toISOString()
  fs.writeFileSync(backlogPath, JSON.stringify(backlog, null, 2) + "\n")
}

function upsertDefect(backlog, defect) {
  var existing = backlog.items.find(function(item) {
    return item.scenarioId === defect.scenarioId && item.fingerprint === defect.fingerprint && item.status !== "resolved"
  })

  if (existing) {
    existing.lastSeenAt = defect.lastSeenAt
    existing.seenCount = (existing.seenCount || 1) + 1
    existing.lastError = defect.lastError
    return existing
  }

  backlog.items.push(defect)
  return defect
}

module.exports = {
  loadBacklog,
  saveBacklog,
  upsertDefect
}
