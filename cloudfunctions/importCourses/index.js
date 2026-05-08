const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 球场数据（只包含基本信息，不含 holes）
const COURSES_BASIC = require('./courses-data.json')

exports.main = async (event, context) => {
  try {
    const courses = COURSES_BASIC
    const batchSize = 100
    let imported = 0
    
    for (let i = 0; i < courses.length; i += batchSize) {
      const batch = courses.slice(i, i + batchSize)
      const promises = batch.map(course => 
        db.collection('courses').add({ data: course })
      )
      await Promise.all(promises)
      imported += batch.length
    }
    
    return {
      success: true,
      imported: imported,
      message: `成功导入 ${imported} 个球场`
    }
  } catch (err) {
    console.error('导入失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
