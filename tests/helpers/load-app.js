function loadApp(modulePath) {
  let captured = null
  global.App = function(definition) {
    captured = definition
    return definition
  }
  jest.isolateModules(function() {
    delete require.cache[require.resolve(modulePath)]
    require(modulePath)
  })

  if (!captured) {
    throw new Error("App definition was not captured")
  }

  return captured
}

module.exports = {
  loadApp
}
