const { spawn } = require("child_process")

function runCommand(command, cwd) {
  return new Promise(function(resolve) {
    const child = spawn(command, {
      cwd: cwd,
      stdio: ["ignore", "pipe", "pipe"],
      shell: true
    })

    let stdout = ""
    let stderr = ""

    child.stdout.on("data", function(chunk) {
      const text = chunk.toString()
      stdout += text
      process.stdout.write(text)
    })

    child.stderr.on("data", function(chunk) {
      const text = chunk.toString()
      stderr += text
      process.stderr.write(text)
    })

    child.on("close", function(code) {
      resolve({
        code: code,
        stdout: stdout,
        stderr: stderr
      })
    })
  })
}

module.exports = { runCommand }
