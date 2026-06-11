#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

const root = path.resolve(__dirname, "..")
const mediaExtensions = {
  ".png": true,
  ".jpg": true,
  ".jpeg": true,
  ".gif": true,
  ".webp": true,
  ".svg": true,
  ".mp3": true,
  ".wav": true,
  ".aac": true,
  ".m4a": true,
  ".ogg": true
}
const maxMediaBytes = 200 * 1024
const ignoredDirs = {
  ".git": true,
  "coverage": true,
  "reports": true,
  "tests": true
}

const failures = []

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })

  entries.forEach(function(entry) {
    const fullPath = path.join(dir, entry.name)
    const relativePath = path.relative(root, fullPath)

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") {
        failures.push(`${relativePath} exists. Move or remove node_modules before uploading the mini program.`)
        return
      }
      if (ignoredDirs[entry.name]) return
      walk(fullPath)
      return
    }

    const ext = path.extname(entry.name).toLowerCase()
    if (!mediaExtensions[ext]) return

    const size = fs.statSync(fullPath).size
    if (size > maxMediaBytes) {
      failures.push(`${relativePath} is ${size} bytes, over 200K.`)
    }
  })
}

walk(root)

if (failures.length) {
  console.error("Upload readiness check failed:")
  failures.forEach(function(failure) {
    console.error(`- ${failure}`)
  })
  process.exit(1)
}

console.log("Upload readiness check passed: no node_modules and no media over 200K.")
