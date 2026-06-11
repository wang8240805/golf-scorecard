// 云函数：比赛操作（创建/加入/获取/生成二维码）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { action } = event

  switch (action) {
    case 'create':
      return await createGame(event)
    case 'join':
      return await joinGame(event)
    case 'get':
      return await getGame(event)
    case 'start':
      return await startGame(event)
    case 'getQrCode':
      return await getQrCode(event)
    case 'getReportQrCode':
      return await getReportQrCode(event)
    case 'updatePlayers':
      return await updatePlayers(event)
    case 'syncLocalGame':
      return await syncLocalGame(event)
    default:
      return { success: false, error: '未知操作' }
  }
}

// 生成小程序码 - 通过微信官方HTTP接口
// 需要在云函数环境变量配置 APPID 和 APPSECRET
const axios = require('axios')

// 获取access_token
async function getAccessToken() {
  const APPID = process.env.APPID
  const APPSECRET = process.env.APPSECRET

  if (!APPID || !APPSECRET) {
    throw new Error('请在云函数环境变量配置 APPID 和 APPSECRET')
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
  const res = await axios.get(url)
  if (res.data && res.data.access_token) {
    return res.data.access_token
  }
  throw new Error('获取access_token失败: ' + JSON.stringify(res.data))
}

async function getQrCode(event) {
  const { gameId } = event

  if (!gameId) {
    return { success: false, error: '缺少gameId' }
  }

  try {
    console.log('开始生成小程序码, gameId:', gameId)

    // 1. 获取access_token
    const accessToken = await getAccessToken()

    // 2. 调用生成小程序码接口
    const generateUrl = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`

    const res = await axios.post(generateUrl, {
      scene: gameId,         // 参数：gameId
      page: 'pages/new-game/step2-players/step2-players',  // 跳转页面
      width: 430,           // 二维码宽度
      auto_color: false,
      line_color: { r: 0, g: 0, b: 0 },
      is_hyaline: false,
      check_path: false
    }, {
      responseType: 'arraybuffer'  // 接收二进制图片数据
    })

    // 3. 上传到云存储
    const cloudPath = `qrcodes/${gameId}_${Date.now()}.png`
    const uploadResult = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: res.data
    })

    console.log('二维码上传成功, fileID:', uploadResult.fileID)

    // 4. 获取临时访问URL
    const urlResult = await cloud.getTempFileURL({
      fileList: [uploadResult.fileID]
    })

    // 5. 更新游戏记录，保存fileID
    // 先查询gameId
    const gameRes = await db.collection('games').where({ gameId }).get()
    if (gameRes.data.length > 0) {
      const game = gameRes.data[0]
      await db.collection('games').doc(game._id).update({
        data: { qrcodeFileId: uploadResult.fileID }
      })
    }

    return {
      success: true,
      qrcodeUrl: urlResult.fileList[0].tempFileURL,
      qrcodeFileId: uploadResult.fileID
    }
  } catch (err) {
    console.error('生成小程序码异常:', err)
    return { success: false, error: err.message || JSON.stringify(err) }
  }
}

async function createWxaCode(options) {
  const accessToken = await getAccessToken()
  const generateUrl = `https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${accessToken}`

  const res = await axios.post(generateUrl, {
    scene: options.scene,
    page: options.page,
    width: options.width || 430,
    auto_color: false,
    line_color: options.lineColor || { r: 0, g: 0, b: 0 },
    is_hyaline: false,
    check_path: false
  }, {
    responseType: 'arraybuffer'
  })

  return res.data
}

async function getReportQrCode(event) {
  const { gameId } = event

  if (!gameId) {
    return { success: false, error: '缺少gameId' }
  }

  try {
    console.log('开始生成成绩回看小程序码, gameId:', gameId)

    const fileContent = await createWxaCode({
      // getwxacodeunlimit scene has a tight length limit, so report links use r=.
      scene: `r=${gameId}`,
      page: 'pages/index/index',
      width: 430,
      lineColor: { r: 24, g: 59, b: 42 }
    })

    const cloudPath = `report-qrcodes/${gameId}_${Date.now()}.png`
    const uploadResult = await cloud.uploadFile({
      cloudPath: cloudPath,
      fileContent: fileContent
    })

    const urlResult = await cloud.getTempFileURL({
      fileList: [uploadResult.fileID]
    })

    const gameRes = await db.collection('games').where(_.or([
      { gameId: _.eq(gameId) },
      { id: _.eq(gameId) },
      { _id: _.eq(gameId) }
    ])).limit(1).get()

    if (gameRes.data.length > 0) {
      const game = gameRes.data[0]
      await db.collection('games').doc(game._id).update({
        data: { reportQrcodeFileId: uploadResult.fileID }
      })
    }

    return {
      success: true,
      qrcodeUrl: urlResult.fileList[0].tempFileURL,
      qrcodeFileId: uploadResult.fileID
    }
  } catch (err) {
    console.error('生成成绩回看小程序码异常:', err)
    return { success: false, error: err.message || JSON.stringify(err) }
  }
}

function serializeReportGame(game) {
  if (!game) return null
  const {
    _openid,
    _updateTime,
    _createTime,
    ...safeGame
  } = game

  safeGame._id = game._id
  return safeGame
}

// 创建比赛
async function createGame(event) {
  const { courseId, courseName, player, holeCount } = event

  if (!player || !player.openid) {
    return { success: false, error: '缺少用户信息' }
  }

  try {
    const gameId = 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6)

    // 不提前生成二维码，二维码在用户点击显示时生成
    // 这样避免创建比赛时因为权限问题失败
    let qrcodeFileId = null

    const normalizedHoleCount = parseInt(holeCount, 10) === 9 ? 9 : 18
    const result = await db.collection('games').add({
      data: {
        gameId: gameId,
        courseId: courseId || '',
        courseName: courseName || '',
        holeCount: normalizedHoleCount,
        status: 'waiting',
        players: [{
          id: 'player_' + player.openid,
          name: player.name || '球友',
          avatar: player.avatar || '',
          openid: player.openid,
          isCreator: true,
          joinTime: db.serverDate()
        }],
        qrcodeFileId: qrcodeFileId,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    console.log('创建比赛成功:', gameId)
    return {
      success: true,
      gameId: gameId,
      _id: result._id,
      qrcodeFileId: qrcodeFileId
    }
  } catch (err) {
    console.error('创建比赛失败:', err)
    return { success: false, error: err.message }
  }
}

// 加入比赛
async function joinGame(event) {
  const { gameId, player } = event

  if (!gameId || !player || !player.openid) {
    return { success: false, error: '参数不完整' }
  }

  try {
    // 查询比赛
    const gameRes = await db.collection('games').where(_.or([
      { gameId: _.eq(gameId) },
      { id: _.eq(gameId) }
    ])).limit(1).get()

    if (gameRes.data.length === 0) {
      return { success: false, error: '比赛不存在' }
    }

    const game = gameRes.data[0]
    const existingPlayer = game.players.find(p => p.openid === player.openid)

    // 已经在比赛中
    if (existingPlayer) {
      return {
        success: true,
        gameId: gameId,
        alreadyJoined: true,
        full: false,
        players: game.players
      }
    }

    // 检查人数限制 - 最多4人（乐观检查）
    if (game.players.length >= 4) {
      return {
        success: false,
        error: '该球局已满4人，无法加入'
      }
    }

    // 检查比赛状态 - 已结束不允许加入
    if (game.status === 'finished') {
      return {
        success: false,
        error: '该比赛已结束'
      }
    }

    // 加入比赛 - 使用原子push操作
    const newPlayer = {
      id: 'player_' + player.openid,
      name: player.name || '球友',
      avatar: player.avatar || '',
      openid: player.openid,
      isCreator: false,
      joinTime: db.serverDate()
    }

    await db.collection('games').doc(game._id).update({
      data: {
        players: _.push(newPlayer),
        updateTime: db.serverDate()
      }
    })

    // 原子push后重新读取，检查是否超过4人（解决并发竞态）
    // 如果两个请求同时通过了乐观检查，push后一定会有一个请求发现超过4人并回滚
    const updatedGameRes = await db.collection('games').doc(game._id).get()
    const updatedGame = updatedGameRes.data
    if (updatedGame.players && updatedGame.players.length > 4) {
      // 回滚：移除刚才加入的玩家
      const players = updatedGame.players.filter(p => p.openid !== player.openid)
      await db.collection('games').doc(game._id).update({
        data: {
          players: players,
          updateTime: db.serverDate()
        }
      })
      return {
        success: false,
        error: '该球局已满4人，无法加入'
      }
    }

    console.log('加入比赛成功:', gameId, player.name)
    return {
      success: true,
      gameId: gameId,
      alreadyJoined: false,
      full: updatedGame.players.length >= 4,
      status: updatedGame.status,
      players: updatedGame.players
    }
  } catch (err) {
    console.error('加入比赛失败:', err)
    return { success: false, error: err.message }
  }
}

// 获取比赛信息
async function getGame(event) {
  const { gameId } = event

  if (!gameId) {
    return { success: false, error: '缺少gameId' }
  }

  try {
    const gameRes = await db.collection('games').where(_.or([
      { gameId: _.eq(gameId) },
      { id: _.eq(gameId) }
    ])).limit(1).get()

    if (gameRes.data.length === 0) {
      return { success: false, error: '比赛不存在' }
    }

    const game = gameRes.data[0]
    return {
      success: true,
      game: serializeReportGame(game)
    }
  } catch (err) {
    console.error('获取比赛失败:', err)
    return { success: false, error: err.message }
  }
}

// 开始比赛
async function startGame(event) {
  const { gameId, holeCount } = event
  const { OPENID } = cloud.getWXContext()

  if (!gameId) {
    return { success: false, error: '缺少gameId' }
  }

  try {
    const gameRes = await db.collection('games').where({ gameId }).get()

    if (gameRes.data.length === 0) {
      return { success: false, error: '比赛不存在' }
    }

    const game = gameRes.data[0]

    // 权限校验：只有创建者可以开始比赛
    const isCreator = game.players && game.players.some(p => p.openid === OPENID && p.isCreator)
    if (!isCreator) {
      return { success: false, error: '只有房主可以开始比赛' }
    }

    const normalizedHoleCount = parseInt(holeCount, 10) === 9 ? 9 : 18
    await db.collection('games').doc(game._id).update({
      data: {
        status: 'playing',
        holeCount: normalizedHoleCount,
        startTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    console.log('开始比赛:', gameId)
    return {
      success: true,
      gameId: gameId,
      players: game.players
    }
  } catch (err) {
    console.error('开始比赛失败:', err)
    return { success: false, error: err.message }
  }
}

// 更新球员列表（用于创建者手动添加）
async function updatePlayers(event) {
  const { gameId, players } = event
  const { OPENID } = cloud.getWXContext()

  if (!gameId || !players) {
    return { success: false, error: '参数不完整' }
  }

  try {
    // 查询比赛
    const gameRes = await db.collection('games').where({ gameId }).get()

    if (gameRes.data.length === 0) {
      return { success: false, error: '比赛不存在' }
    }

    const game = gameRes.data[0]

    // 权限校验：只有创建者可以修改球员列表
    const isCreator = game.players.some(p => p.openid === OPENID && p.isCreator)
    if (!isCreator) {
      return { success: false, error: '只有创建者可以修改球员列表' }
    }

    // 再次检查人数限制（双重保险）
    if (players.length > 4) {
      return { success: false, error: '最多支持4人' }
    }

    // 更新球员列表
    await db.collection('games').doc(game._id).update({
      data: {
        players: players,
        updateTime: db.serverDate()
      }
    })

    console.log('更新球员列表成功:', gameId, players.length, '人')
    return {
      success: true,
      players: players
    }
  } catch (err) {
    console.error('更新球员列表失败:', err)
    return { success: false, error: err.message }
  }
}

function sanitizeLocalGame(rawGame, openid) {
  const game = rawGame || {}
  const {
    _id,
    _openid,
    _updateTime,
    _createTime,
    createTime,
    updateTime,
    cloudSyncStatus,
    cloudSyncError,
    cloudSyncedAt,
    ...safeGame
  } = game

  const localId = safeGame.id || safeGame.gameId
  safeGame.id = localId
  safeGame.gameId = safeGame.gameId || localId
  safeGame.status = safeGame.completed === true ? 'completed' : 'playing'
  safeGame.source = 'localAutoSync'
  safeGame.autoSynced = true
  safeGame.clientUpdateTime = updateTime || Date.now()
  safeGame.syncedBy = openid

  return {
    _id,
    game: safeGame
  }
}

function hasPlayerOpenid(game, openid) {
  const players = game && Array.isArray(game.players) ? game.players : []
  return players.some(function(player) {
    return player && player.openid === openid
  })
}

async function findSyncedLocalGame(localGame, requestedId) {
  if (requestedId) {
    try {
      const doc = await db.collection('games').doc(requestedId).get()
      if (doc && doc.data) return doc.data
    } catch (e) {}
  }

  const gameId = localGame.gameId || localGame.id
  const id = localGame.id || localGame.gameId
  const gameRes = await db.collection('games')
    .where(_.or([
      { gameId: _.eq(gameId) },
      { id: _.eq(id) }
    ]))
    .limit(1)
    .get()

  return gameRes.data && gameRes.data.length > 0 ? gameRes.data[0] : null
}

// 自动同步本地进行中比赛
async function syncLocalGame(event) {
  const { OPENID } = cloud.getWXContext()
  const rawGame = event.game

  if (!rawGame || !rawGame.id) {
    return { success: false, error: '缺少比赛数据' }
  }

  try {
    const sanitized = sanitizeLocalGame(rawGame, OPENID)
    const localGame = sanitized.game

    if (!localGame.gameId || String(localGame.gameId).indexOf('local_') !== 0) {
      return { success: false, error: '只支持同步本地比赛' }
    }

    if (!hasPlayerOpenid(localGame, OPENID)) {
      return { success: false, error: '只有比赛参与者可以同步' }
    }

    const existing = await findSyncedLocalGame(localGame, sanitized._id)
    if (existing) {
      const isSameGame = existing.gameId === localGame.gameId || existing.id === localGame.id
      if (!isSameGame) {
        return { success: false, error: '云端比赛与本地比赛不匹配' }
      }

      if (!hasPlayerOpenid(existing, OPENID)) {
        return { success: false, error: '无权更新该比赛' }
      }

      const { _id, _openid, _updateTime, _createTime, ...updateData } = localGame
      await db.collection('games').doc(existing._id).update({
        data: {
          ...updateData,
          updateTime: db.serverDate()
        }
      })

      return {
        success: true,
        _id: existing._id,
        gameId: localGame.gameId,
        updated: true
      }
    }

    const addResult = await db.collection('games').add({
      data: {
        ...localGame,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      }
    })

    return {
      success: true,
      _id: addResult._id,
      gameId: localGame.gameId,
      created: true
    }
  } catch (err) {
    console.error('同步本地比赛失败:', err)
    return { success: false, error: err.message || JSON.stringify(err) }
  }
}
