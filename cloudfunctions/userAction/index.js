// 云函数：用户操作（创建/更新用户信息）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { action } = event
  const { OPENID } = cloud.getWXContext()

  switch (action) {
    case 'upsert':
      return await upsertUser(event, OPENID)
    default:
      return { success: false, error: '未知操作' }
  }
}

// 创建或更新用户信息
async function upsertUser(event, openid) {
  const { nickName, avatarUrl, unionid } = event

  try {
    // 查询是否已存在
    const userRes = await db.collection('users').where({ openid: openid }).get()

    if (userRes.data.length > 0) {
      // 已存在，更新
      const user = userRes.data[0]
      await db.collection('users').doc(user._id).update({
        data: {
          nickName: nickName,
          avatarUrl: avatarUrl,
          updateTime: db.serverDate()
        }
      })
      console.log('用户信息已更新:', openid)
      return { success: true, exists: true }
    } else {
      // 不存在，创建
      await db.collection('users').add({
        data: {
          openid: openid,
          unionid: unionid || null,
          nickName: nickName,
          avatarUrl: avatarUrl,
          createTime: db.serverDate(),
          updateTime: db.serverDate()
        }
      })
      console.log('新用户创建成功:', openid)
      return { success: true, exists: false, created: true }
    }
  } catch (err) {
    console.error('upsertUser失败:', err)
    return { success: false, error: err.message }
  }
}
