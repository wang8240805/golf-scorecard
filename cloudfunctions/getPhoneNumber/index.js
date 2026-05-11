// 引入微信云开发 SDK
const cloud = require('wx-server-sdk')

// 初始化云开发
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  const { code } = event

  if (!code) {
    return {
      success: false,
      error: '缺少 code 参数'
    }
  }

  try {
    const result = await cloud.getPhoneNumber({ code })
    return {
      success: true,
      phoneNumber: result.data.phoneNumber
    }
  } catch (err) {
    console.error('[getPhoneNumber] 错误:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
