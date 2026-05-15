#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

function main() {
  const backlogPath = path.resolve(process.cwd(), "reports/defect-backlog.json")
  if (!fs.existsSync(backlogPath)) {
    console.log("缺陷看板不存在: " + backlogPath)
    process.exit(0)
  }

  const backlog = JSON.parse(fs.readFileSync(backlogPath, "utf8"))
  const openItems = (backlog.items || []).filter(function(item) {
    return item.status === "open"
  })

  console.log("\n[Defect Backlog] 更新时间: " + (backlog.updatedAt || "-"))
  console.log("[Defect Backlog] 总数: " + (backlog.items || []).length + "，Open: " + openItems.length)

  openItems.forEach(function(item, idx) {
    console.log("\n" + (idx + 1) + ". " + item.id + " | " + item.scenarioId + " | seen=" + item.seenCount)
    console.log("   标题: " + item.title)
    console.log("   指纹: " + item.fingerprint)
    console.log("   最近: " + item.lastSeenAt)
  })
}

main()
