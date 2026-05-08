// 云函数：换取openid
// 前端调用 wx.login() 获取code，然后调用这个云函数换取openid

const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 从环境变量读取小程序配置
const appid = process.env.APPID
const secret = process.env.SECRET

exports.main = async (event, context) => {
  const { code } = event

  if (!code) {
    return {
      success: false,
      error: '缺少code参数'
    }
  }

  if (!appid || !secret) {
    return {
      success: false,
      error: '请在云函数环境变量中配置 APPID 和 SECRET'
    }
  }

  try {
    // 请求微信接口换取openid
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`

    const response = await fetch(url)
    const data = await response.json()

    console.log('code2session response:', data)

    if (data.errcode) {
      return {
        success: false,
        error: data.errmsg,
        errcode: data.errcode
      }
    }

    // 只返回openid和unionid，session_key不返回给客户端（安全最佳实践）
    // session_key 应该保存在服务端用于解密敏感数据（如手机号）
    return {
      success: true,
      openid: data.openid,
      unionid: data.unionid || null
    }

  } catch (err) {
    console.error('code2session error:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
