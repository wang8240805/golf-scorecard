#!/usr/bin/env node

const path = require("path")
const { spawnSync } = require("child_process")
const automator = require("miniprogram-automator")
require("./load-devtools-env")

function getEnv(name) {
  return process.env[name] && String(process.env[name]).trim()
}

function sleep(ms) {
  return new Promise(function(resolve) {
    setTimeout(resolve, ms)
  })
}

async function assertRoute(miniprogram, expectedRoute, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const page = await miniprogram.currentPage()
    if (page && page.path === expectedRoute) {
      return page
    }
    await sleep(300)
  }
  throw new Error("页面未在超时内加载: " + expectedRoute)
}

async function runScenario(miniprogram) {
  console.log("[DevTools Smoke] 场景1：首页加载")
  await miniprogram.reLaunch("/pages/index/index")
  const indexPage = await assertRoute(miniprogram, "pages/index/index", 10000)
  const indexData = await indexPage.data()
  if (!indexData) {
    throw new Error("首页 data 为空")
  }

  console.log("[DevTools Smoke] 场景2：选球场页加载")
  await miniprogram.reLaunch("/package-courses/pages/new-game/step1-course/step1-course")
  const step1Page = await assertRoute(miniprogram, "package-courses/pages/new-game/step1-course/step1-course", 10000)
  const step1Data = await step1Page.data()
  if (!Object.prototype.hasOwnProperty.call(step1Data, "recommendedCourse")) {
    throw new Error("step1-course 缺少 recommendedCourse 数据字段")
  }

  console.log("[DevTools Smoke] 场景3：记分卡页加载")
  await miniprogram.reLaunch("/pages/scorecard/scorecard")
  const scorecardPage = await assertRoute(miniprogram, "pages/scorecard/scorecard", 10000)
  const scorecardData = await scorecardPage.data()
  if (!Object.prototype.hasOwnProperty.call(scorecardData, "syncStateText")) {
    throw new Error("scorecard 缺少 syncStateText 数据字段")
  }

  console.log("[DevTools Smoke] 场景执行通过")
}

async function main() {
  const projectPath = getEnv("MINIPROGRAM_PROJECT_PATH") || process.cwd()
  const cliPath = getEnv("WECHAT_DEVTOOLS_CLI")
  const toolPath = getEnv("WECHAT_DEVTOOLS_TOOL_PATH")
  const port = Number(getEnv("WECHAT_DEVTOOLS_PORT") || "9421")
  const httpPort = Number(getEnv("WECHAT_DEVTOOLS_HTTP_PORT") || "9420")
  const headless = getEnv("MINIPROGRAM_HEADLESS") !== "false"

  if (!cliPath && !toolPath) {
    console.error("[DevTools Smoke] 缺少环境变量: WECHAT_DEVTOOLS_CLI 或 WECHAT_DEVTOOLS_TOOL_PATH")
    console.error("[DevTools Smoke] 示例:")
    console.error("  export WECHAT_DEVTOOLS_CLI=\"/Applications/wechatwebdevtools.app/Contents/MacOS/cli\"")
    process.exit(2)
  }

  const wsEndpoint = "ws://127.0.0.1:" + String(port)

  let miniProgram
  try {
    if (cliPath) {
      const autoResult = spawnSync(cliPath, ["auto", "--project", path.resolve(projectPath), "--auto-port", String(port)], {
        stdio: "inherit"
      })
      if (autoResult.status !== 0) {
        throw new Error("无法启动开发者工具自动化服务端口")
      }
      const pinPortResult = spawnSync(cliPath, ["open", "--project", path.resolve(projectPath), "--port", String(httpPort)], {
        stdio: "inherit"
      })
      if (pinPortResult.status !== 0) {
        throw new Error("无法固定开发者工具服务端口")
      }
    }
    console.log("[DevTools Smoke] 启动微信开发者工具自动化...")
    miniProgram = await automator.connect({ wsEndpoint: wsEndpoint })
    await runScenario(miniProgram)
  } catch (err) {
    console.error("[DevTools Smoke] 失败:", err && err.message ? err.message : err)
    process.exitCode = 1
  } finally {
    if (miniProgram) {
      await miniProgram.close()
    }
  }

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode)
  }
}

main()
