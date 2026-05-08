const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    // 从云数据库读取球场数据
    const result = await db.collection('courses').limit(1000).get()
    
    return {
      success: true,
      data: result.data,
      count: result.data.length
    }
  } catch (err) {
    console.error('获取球场数据失败:', err)
    return {
      success: false,
      error: err.message,
      data: []
    }
  }
}
