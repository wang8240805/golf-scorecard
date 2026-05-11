// 统一存储访问服务

function getGames() {
  return wx.getStorageSync('games') || []
}

function setGames(games) {
  wx.setStorageSync('games', games)
}

function getCurrentGame() {
  return wx.getStorageSync('currentGame')
}

function setCurrentGame(game) {
  wx.setStorageSync('currentGame', game)
}

function getCourses() {
  return wx.getStorageSync('courses') || []
}

function setCourses(courses) {
  wx.setStorageSync('courses', courses)
}

function getCustomCourses() {
  return wx.getStorageSync('customCourses') || []
}

function setCustomCourses(courses) {
  wx.setStorageSync('customCourses', courses)
}

function getSavedPlayers() {
  return wx.getStorageSync('savedPlayers') || []
}

function setSavedPlayers(players) {
  wx.setStorageSync('savedPlayers', players)
}

function getUserInfo() {
  return wx.getStorageSync('userInfo') || {}
}

function setUserInfo(info) {
  wx.setStorageSync('userInfo', info)
}

function getAppSettings() {
  return wx.getStorageSync('appSettings') || {}
}

function setAppSettings(settings) {
  wx.setStorageSync('appSettings', settings)
}

function getFavoriteCourseIds() {
  return wx.getStorageSync('favoriteCourseIds') || []
}

function setFavoriteCourseIds(ids) {
  wx.setStorageSync('favoriteCourseIds', ids)
}

function getCoursePlayCounts() {
  return wx.getStorageSync('coursePlayCounts') || {}
}

function setCoursePlayCounts(counts) {
  wx.setStorageSync('coursePlayCounts', counts)
}

module.exports = {
  getGames,
  setGames,
  getCurrentGame,
  setCurrentGame,
  getCourses,
  setCourses,
  getCustomCourses,
  setCustomCourses,
  getSavedPlayers,
  setSavedPlayers,
  getUserInfo,
  setUserInfo,
  getAppSettings,
  setAppSettings,
  getFavoriteCourseIds,
  setFavoriteCourseIds,
  getCoursePlayCounts,
  setCoursePlayCounts
}
