#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const { runCommand } = require("./closed-loop/run-command")
const { loadBacklog, saveBacklog, upsertDefect } = require("./closed-loop/defect-store")
const { fingerprintFromOutput } = require("./closed-loop/utils")

function nowIso() {
  return new Date().toISOString()
}

function parseArgs(argv) {
  return {
    scenarioFile: argv.find(function(arg) { return arg.indexOf("--scenarios=") === 0 }) || "--scenarios=scenarios/real-world-scenarios.json",
    failFast: argv.includes("--fail-fast")
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const scenarioPath = path.resolve(process.cwd(), args.scenarioFile.replace("--scenarios=", ""))
  const backlogPath = path.resolve(process.cwd(), "reports/defect-backlog.json")
  const runReportPath = path.resolve(process.cwd(), "reports/last-closed-loop-report.json")

  const scenarios = JSON.parse(fs.readFileSync(scenarioPath, "utf8"))
  const backlog = loadBacklog(backlogPath)

  const report = {
    startedAt: nowIso(),
    finishedAt: "",
    summary: { total: scenarios.length, passed: 0, failed: 0 },
    results: []
  }

  console.log("[Closed Loop] 开始执行真实场景回归，共 " + scenarios.length + " 个场景")

  for (const scenario of scenarios) {
    console.log("\n[Closed Loop] 执行场景 " + scenario.id + " - " + scenario.title)
    const startedAt = nowIso()
    const res = await runCommand(scenario.command, process.cwd())
    const finishedAt = nowIso()

    const passed = res.code === 0
    const output = (res.stdout || "") + "\n" + (res.stderr || "")
    const result = {
      scenarioId: scenario.id,
      title: scenario.title,
      command: scenario.command,
      startedAt: startedAt,
      finishedAt: finishedAt,
      passed: passed,
      exitCode: res.code
    }

    if (passed) {
      report.summary.passed += 1
    } else {
      report.summary.failed += 1
      const fingerprint = fingerprintFromOutput(output)
      const defect = {
        id: "DEF-" + Date.now() + "-" + scenario.id,
        scenarioId: scenario.id,
        title: scenario.title,
        status: "open",
        fingerprint: fingerprint,
        createdAt: nowIso(),
        lastSeenAt: nowIso(),
        seenCount: 1,
        lastError: output.split("\n").slice(-20).join("\n")
      }
      const stored = upsertDefect(backlog, defect)
      result.defectId = stored.id
      result.fingerprint = stored.fingerprint
      console.log("[Closed Loop] 场景失败，已登记缺陷: " + stored.id)

      if (args.failFast) {
        report.results.push(result)
        break
      }
    }

    report.results.push(result)
  }

  report.finishedAt = nowIso()
  fs.writeFileSync(runReportPath, JSON.stringify(report, null, 2) + "\n")
  saveBacklog(backlogPath, backlog)

  console.log("\n[Closed Loop] 执行完成")
  console.log("[Closed Loop] 通过: " + report.summary.passed + "，失败: " + report.summary.failed)
  console.log("[Closed Loop] 报告: " + runReportPath)
  console.log("[Closed Loop] 缺陷看板: " + backlogPath)

  if (report.summary.failed > 0) {
    process.exit(1)
  }
}

main().catch(function(err) {
  console.error("[Closed Loop] 执行异常:", err && err.message ? err.message : err)
  process.exit(1)
})
