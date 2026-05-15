function fingerprintFromOutput(output) {
  var normalized = String(output || "")
    .split("\n")
    .slice(-30)
    .join("\n")
    .replace(/\d+/g, "#")
    .trim()

  var hash = 0
  for (var i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i)
    hash |= 0
  }
  return "fp_" + Math.abs(hash)
}

module.exports = {
  fingerprintFromOutput
}
