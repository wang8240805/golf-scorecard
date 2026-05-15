const fs = require("fs")
const path = require("path")

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return
  }
  const content = fs.readFileSync(filePath, "utf8")
  content.split("\n").forEach(function(line) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.indexOf("#") === 0) {
      return
    }
    const index = trimmed.indexOf("=")
    if (index === -1) {
      return
    }
    const key = trimmed.slice(0, index).trim()
    const value = trimmed.slice(index + 1).trim()
    if (key && !process.env[key]) {
      process.env[key] = value
    }
  })
}

loadEnvFile(path.resolve(process.cwd(), ".env.devtools"))
