function attachSetData(definition) {
  definition.setData = function(nextData, callback) {
    this.data = this.data || {}
    Object.keys(nextData || {}).forEach(key => {
      this.data[key] = nextData[key]
    })
    if (typeof callback === "function") {
      callback()
    }
  }
  return definition
}

function loadPage(modulePath) {
  let captured = null
  global.Page = function(definition) {
    captured = definition
    return definition
  }
  jest.isolateModules(function() {
    delete require.cache[require.resolve(modulePath)]
    require(modulePath)
  })

  if (!captured) {
    throw new Error("Page definition was not captured")
  }

  return attachSetData(captured)
}

module.exports = {
  loadPage
}
