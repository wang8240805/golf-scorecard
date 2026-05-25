// 云函数：保存用户贡献的公开球场PAR数据
// 服务端验证数据完整性，防止恶意数据污染公共数据库
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 频率限制配置
const MAX_DAILY_PER_USER = 20  // 单个用户每天最多贡献20条数据

// 验证输入数据的合法性
function validateData(courseId, holes) {
  // 验证courseId格式
  if (!courseId || typeof courseId !== 'string' || courseId.length > 100) {
    return { valid: false, reason: 'Invalid courseId' }
  }

  // 验证holes数组
  if (!Array.isArray(holes) || holes.length < 9 || holes.length > 18) {
    return { valid: false, reason: `Invalid hole count: ${holes.length}, must be 9-18` }
  }

  // 验证每个洞的PAR值必须是3、4、5
  for (let i = 0; i < holes.length; i++) {
    const h = holes[i]
    if (!h || typeof h !== 'object') {
      return { valid: false, reason: `Invalid hole at index ${i}` }
    }
    const par = typeof h.par === 'number' ? h.par : parseInt(h.par)
    if (![3, 4, 5].includes(par)) {
      return { valid: false, reason: `Invalid PAR value ${par} at hole ${i + 1}, must be 3/4/5` }
    }
  }

  // 验证总和范围
  const totalPar = holes.reduce((sum, h) => sum + (typeof h.par === 'number' ? h.par : parseInt(h.par)), 0)
  const expected = holes.length === 18 ? 72 : 36
  if (Math.abs(totalPar - expected) > 4) {
    return { valid: false, reason: `Total PAR ${totalPar} is out of allowed range (expected ~${expected})` }
  }

  return { valid: true }
}

exports.main = async (event, context) => {
  const { courseId, holes, totalPar, source, sourceMeta } = event
  const { OPENID } = cloud.getWXContext()

  console.log('[savePublicCourseData] 收到请求, courseId:', courseId, 'holes:', holes.length)

  // 频率限制检查：单个用户每天最多贡献N条数据
  const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD
  const countId = `${OPENID}-${today}`

  try {
    const countRes = await db.collection('contrib_counts').doc(countId).get()
    if (countRes.data) {
      const count = countRes.data.count || 0
      if (count >= MAX_DAILY_PER_USER) {
        console.log('[savePublicCourseData] 频率限制触发:', OPENID, '今日已贡献', count, '次')
        return {
          success: false,
          error: '今日贡献次数已达上限（20次），请明天再试'
        }
      }
      // 计数器加1
      await db.collection('contrib_counts').doc(countId).update({
        data: {
          count: count + 1,
          updatedAt: new Date().toISOString()
        }
      })
    } else {
      // 新建计数记录
      await db.collection('contrib_counts').add({
        _id: countId,
        openid: OPENID,
        date: today,
        count: 1,
        createdAt: new Date().toISOString()
      })
    }
  } catch (err) {
    // 如果计数记录不存在说明是第一次，创建
    if (err.errCode === -412) {  // 文档不存在错误码
      await db.collection('contrib_counts').add({
        _id: countId,
        openid: OPENID,
        date: today,
        count: 1,
        createdAt: new Date().toISOString()
      })
    } else {
      console.error('[savePublicCourseData] 频率检查失败:', err)
      // 频率检查失败不阻塞保存，只警告
    }
  }

  // 验证数据
  const validation = validateData(courseId, holes)
  if (!validation.valid) {
    console.error('[savePublicCourseData] 验证失败:', validation.reason)
    return {
      success: false,
      error: validation.reason
    }
  }

  try {
    // 先查询是否已有数据
    const result = await db.collection('public_course_data')
      .where({ courseId: courseId })
      .get()

    const previous = result.data && result.data.length > 0 ? result.data[0] : null
    const verifiedAt = new Date().toISOString()
    const sourceHistory = (previous && previous.sourceHistory ? previous.sourceHistory : []).concat([{
      source: source || 'user-contrib',
      verifiedAt: verifiedAt,
      sourceMeta: sourceMeta || {}
    }]).slice(-20)

    const data = {
      courseId: courseId,
      holes: holes,
      totalPar: totalPar,
      verifiedAt: verifiedAt,
      source: source || 'user-contrib',
      sourceMeta: sourceMeta || {},
      revision: previous && previous.revision ? previous.revision + 1 : 1,
      sourceHistory: sourceHistory,
      contributorOpenId: OPENID
    }

    if (result.data && result.data.length > 0) {
      // 更新已有记录
      const _id = result.data[0]._id
      await db.collection('public_course_data').doc(_id).update({ data })
      console.log('[savePublicCourseData] 更新成功:', courseId)
      return {
        success: true,
        updated: true,
        message: 'Data updated successfully'
      }
    } else {
      // 新增记录
      await db.collection('public_course_data').add({ data })
      console.log('[savePublicCourseData] 新增成功:', courseId)
      return {
        success: true,
        created: true,
        message: 'Data created successfully'
      }
    }

  } catch (err) {
    console.error('[savePublicCourseData] 保存失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
