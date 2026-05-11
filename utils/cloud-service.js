// 云函数调用封装

/**
 * 调用 userAction 云函数
 * @param {string} action - 操作类型
 * @param {Object} data - 数据
 * @returns {Promise} Promise 对象
 */
function callUserAction(action, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'userAction',
      data: { action, ...data },
      success: res => resolve(res),
      fail: err => reject(err)
    })
  })
}

/**
 * 新增或更新用户信息
 * @param {Object} userInfo - 用户信息
 * @returns {Promise} Promise 对象
 */
function upsertUser(userInfo) {
  return callUserAction('upsert', {
    nickName: userInfo.nickName,
    avatarUrl: userInfo.avatarUrl,
    unionid: userInfo.unionid || null
  })
}

/**
 * 获取用户信息
 * @param {string} openid - 用户 openid
 * @returns {Promise} Promise 对象
 */
function getUser(openid) {
  return callUserAction('get', { openid })
}

/**
 * 调用 gameAction 云函数
 * @param {string} action - 操作类型
 * @param {Object} data - 数据
 * @returns {Promise} Promise 对象
 */
function callGameAction(action, data = {}) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'gameAction',
      data: { action, ...data },
      success: res => resolve(res),
      fail: err => reject(err)
    })
  })
}

/**
 * 获取手机号
 * @param {string} code - 手机号授权码
 * @returns {Promise} Promise 对象
 */
function getPhoneNumber(code) {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'getPhoneNumber',
      data: { code },
      success: res => resolve(res),
      fail: err => reject(err)
    })
  })
}

/**
 * 导入球场数据
 * @returns {Promise} Promise 对象
 */
function importCourses() {
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'importCourses',
      success: res => resolve(res),
      fail: err => reject(err)
    })
  })
}

module.exports = {
  callUserAction,
  upsertUser,
  getUser,
  callGameAction,
  getPhoneNumber,
  importCourses
}
