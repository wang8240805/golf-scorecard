// 云函数：确认或拒绝成绩修改
// 只有成绩归属者本人可以操作
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { gameId, playerId, hole, action } = event
  // action: 'confirm' | 'reject'
  const { OPENID } = cloud.getWXContext()

  // 校验参数
  if (!gameId || !playerId || hole === undefined || !action) {
    return {
      success: false,
      error: '参数不完整'
    }
  }

  if (action !== 'confirm' && action !== 'reject') {
    return {
      success: false,
      error: '无效的操作类型'
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

    // 2. 权限校验：只有成绩归属者本人可以确认/拒绝
    const player = game.players.find(p => p.id === playerId)
    if (!player) {
      return {
        success: false,
        error: '球员不存在于此比赛'
      }
    }

    if (!player.openid || player.openid !== OPENID) {
      return {
        success: false,
        error: '只有本人可以确认成绩'
      }
    }

    // 3. 检查成绩是否存在
    const scoreData = game.scores?.[playerId]?.[hole]
    if (!scoreData) {
      return {
        success: false,
        error: '成绩不存在'
      }
    }

    // 4. 执行确认或拒绝操作
    const updateData = {}
    updateData.updateTime = db.serverDate()

    if (action === 'confirm') {
      // 确认：将 confirmed 设为 true
      const confirmedScoreData = {
        ...scoreData,
        confirmed: true,
        confirmedAt: Date.now(),
        confirmedBy: OPENID
      }
      // 清理临时字段
      delete confirmedScoreData.newPutts

      updateData[`scores.${playerId}.${hole}`] = confirmedScoreData

      // 如果有待确认的新推杆数，更新到 putts 集合
      if (scoreData.newPutts !== undefined && scoreData.newPutts !== null) {
        updateData[`putts.${playerId}.${hole}`] = scoreData.newPutts
      }

      await db.collection('games').doc(game._id).update({
        data: updateData
      })

      console.log(`成绩已确认: gameId=${gameId}, playerId=${playerId}, hole=${hole}`)

      return {
        success: true,
        action: 'confirm',
        strokes: scoreData.strokes
      }

    } else {
      // 拒绝：恢复原始成绩
      const originalStrokes = scoreData.originalStrokes
      const originalPutts = scoreData.originalPutts

      if (originalStrokes !== null && originalStrokes !== undefined) {
        // 有原始成绩，恢复
        updateData[`scores.${playerId}.${hole}`] = {
          strokes: originalStrokes,
          confirmed: true,
          modifiedBy: OPENID,
          modifiedByName: '本人',
          modifiedAt: Date.now(),
          originalStrokes: null,
          originalPutts: null,
          rejectedAt: Date.now(),
          rejectedFrom: scoreData.strokes
        }

        // 恢复原始推杆数
        if (originalPutts !== null && originalPutts !== undefined) {
          updateData[`putts.${playerId}.${hole}`] = originalPutts
        }
      } else {
        // 没有原始成绩，清空
        updateData[`scores.${playerId}.${hole}`] = {
          strokes: null,
          confirmed: true,
          modifiedBy: OPENID,
          modifiedByName: '本人',
          modifiedAt: Date.now(),
          originalStrokes: null,
          originalPutts: null,
          rejectedAt: Date.now(),
          rejectedFrom: scoreData.strokes
        }
        updateData[`putts.${playerId}.${hole}`] = null
      }

      await db.collection('games').doc(game._id).update({
        data: updateData
      })

      console.log(`成绩已拒绝并恢复: gameId=${gameId}, playerId=${playerId}, hole=${hole}`)

      return {
        success: true,
        action: 'reject',
        restoredStrokes: originalStrokes,
        restoredPutts: originalPutts
      }
    }

  } catch (err) {
    console.error('确认成绩失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
