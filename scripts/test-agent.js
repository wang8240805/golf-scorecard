#!/usr/bin/env node

const { spawnSync } = require("child_process")

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit" })
  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

function main() {
  const updateSnapshots = process.argv.includes("--update-snapshots")
  const jestArgs = ["jest", "--runInBand", "--coverage"]

  if (updateSnapshots) {
    jestArgs.push("-u")
  }

  console.log("\n[WinPAR Test Agent] 开始执行自动回归...\n")
  run("npx", jestArgs)
  console.log("\n[WinPAR Test Agent] 回归通过，可在微信开发者工具做最终人工验收。\n")
}

main()
