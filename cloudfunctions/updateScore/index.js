// 云函数：更新单洞成绩（带权限校验）
// 权限校验：只有球员本人（openid匹配）才能直接确认自己的成绩
// 他人修改需要本人确认后才能生效
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { gameId, playerId, hole, strokes, putts, modifierName } = event
  const { OPENID } = cloud.getWXContext()

  // 校验参数
  if (!gameId || !playerId || hole === undefined || strokes === undefined) {
    return {
      success: false,
      error: '参数不完整'
    }
  }

  try {
    // 1. 获取游戏信息
    const gameRes = await db.collection('games').where({ gameId: gameId }).get()
    if (gameRes.data.length === 0) {
      return {
        success: false,
        error: '比赛不存在'
      }
    }

    const game = gameRes.data[0]

    // 2. 权限校验：查找该球员在比赛中的openid
    const player = game.players.find(p => p.id === playerId)
    if (!player) {
      return {
        success: false,
        error: '球员不存在于此比赛'
      }
    }

    // 判断是否需要确认
    // 如果球员openid存在 && 请求者openid不匹配 -> 需要确认
    const needsConfirmation = player.openid && player.openid !== OPENID
    const isConfirmed = !needsConfirmation

    // 3. 获取原始成绩（用于拒绝恢复）
    const existingScore = game.scores?.[playerId]?.[hole]
    const originalStrokes = existingScore?.strokes !== undefined ? existingScore.strokes : null
    const originalPutts = game.putts?.[playerId]?.[hole] !== undefined ? game.putts[playerId][hole] : null

    // 4. 更新成绩到数据库
    // 存储格式：{ strokes: number, confirmed: boolean, modifiedBy: openid, ... }
    const updateData = {}
    const now = Date.now()

    if (isConfirmed) {
      // 本人修改：直接确认
      updateData[`scores.${playerId}.${hole}`] = {
        strokes: strokes,
        confirmed: true,
        modifiedBy: OPENID,
        modifiedByName: modifierName || '本人',
        modifiedAt: now,
        originalStrokes: originalStrokes,
        originalPutts: originalPutts
      }
      // 本人修改：直接更新 putts
      if (putts !== undefined) {
        updateData[`putts.${playerId}.${hole}`] = putts
      }
    } else {
      // 他人修改：需要确认，保存原始成绩和新推杆数
      updateData[`scores.${playerId}.${hole}`] = {
        strokes: strokes,
        confirmed: false,
        modifiedBy: OPENID,
        modifiedByName: modifierName || '球友',
        modifiedAt: now,
        originalStrokes: originalStrokes,
        originalPutts: originalPutts,
        newPutts: putts !== undefined ? putts : originalPutts  // 新推杆数，确认后更新
      }
      // 注意：他人修改时不直接更新 putts，等确认后再更新
    }
    updateData.updateTime = db.serverDate()

    await db.collection('games').doc(game._id).update({
      data: updateData
    })

    console.log(`成绩更新成功: gameId=${gameId}, playerId=${playerId}, hole=${hole}, strokes=${strokes}, confirmed=${isConfirmed}`)

    return {
      success: true,
      confirmed: isConfirmed,
      needsConfirmation: needsConfirmation
    }

  } catch (err) {
    console.error('更新成绩失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
