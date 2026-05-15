/**
 * 海报生成器 - 优化版
 * 使用 Canvas 2D API 生成精美分享海报
 * 采用现代卡片式设计、渐变背景、精致排版
 */

// 球风模板库（基于指标匹配）
const GOLF_ARCHETYPES = [
  {
    name: '斯科蒂·舍夫勒',
    style: '全面压制型',
    tags: ['稳定铁杆', '关键推进', '失误控制'],
    reason: '整体数据最均衡，像舍夫勒那样用稳定性赢比赛。'
  },
  {
    name: '罗里·麦克罗伊',
    style: '火力进攻型',
    tags: ['高抓鸟率', '进攻果岭', '节奏强势'],
    reason: '抓鸟能力突出，比赛节奏偏进攻，具备麦克罗伊风格。'
  },
  {
    name: '科林·森川',
    style: '精准稳健型',
    tags: ['保帕效率', '线路清晰', '稳定输出'],
    reason: '保帕占比高、波动小，典型森川式精准稳健。'
  },
  {
    name: '布鲁克斯·科普卡',
    style: '大赛抗压型',
    tags: ['抗压能力', '中后程稳定', '关键洞处理'],
    reason: '关键洞失误少，后程发挥更稳，具备科普卡式抗压特征。'
  },
  {
    name: '乔丹·斯皮思',
    style: '短杆创造型',
    tags: ['短杆手感', '救帕能力', '策略执行'],
    reason: '短杆与救帕表现亮眼，球路选择很有斯皮思味道。'
  },
  {
    name: '琼·拉姆',
    style: '强势推进型',
    tags: ['推进能力', '进攻效率', '硬洞不怵'],
    reason: '硬洞表现不弱，整体推进力像拉姆。'
  }
]

// 精美背景图片配置 - 使用渐变模拟高质量背景
const BACKGROUNDS = {
  default: {
    type: 'gradient',
    colors: ['#134E5E', '#71B280']  // 深青到翠绿
  },
  course: {
    type: 'gradient',
    colors: ['#56CCF2', '#2F80ED']  // 天空蓝
  },
  sunset: {
    type: 'gradient',
    colors: ['#fa709a', '#fee140']  // 日落粉橙
  },
  green: {
    type: 'gradient',
    colors: ['#11998e', '#38ef7d']  // 果岭绿
  },
  night: {
    type: 'gradient',
    colors: ['#0f0c29', '#302b63', '#24243e']  // 夜幕紫
  }
}

/**
 * 主函数：生成比赛海报
 */
function generatePoster(options) {
  const { type = 'pro', game, player, bgType = 'default', customBgUrl, context = null } = options

  return new Promise((resolve, reject) => {
    // 重试机制，最多尝试3次获取canvas节点
    let retryCount = 0
    const maxRetries = 3

    function tryGetCanvas() {
      // 使用传入的页面上下文创建选择器，更可靠
      const query = context ? context.createSelectorQuery() : wx.createSelectorQuery()

      query.select('#posterCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            retryCount++
            if (retryCount < maxRetries) {
              // 延迟重试，确保DOM渲染完成
              setTimeout(tryGetCanvas, 100)
              return
            }
            reject(new Error('获取 canvas 节点失败'))
            return
          }

          const canvas = res[0].node
          const width = 750
          const height = 1334

          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          ctx.clearRect(0, 0, width, height)

          // 如果有自定义背景图片
          if (bgType === 'custom' && customBgUrl) {
            loadAndDrawBackground(canvas, ctx, customBgUrl, width, height, async () => {
              await drawPosterContent(ctx, type, width, height, game, player, canvas)
              exportCanvas(canvas, width, height, resolve, reject)
            }, () => {
              drawBackground(ctx, bgType, width, height)
              drawPosterContent(ctx, type, width, height, game, player, canvas).then(() => {
                exportCanvas(canvas, width, height, resolve, reject)
              }).catch(reject)
            })
          } else {
            drawBackground(ctx, bgType, width, height)
            drawPosterContent(ctx, type, width, height, game, player, canvas).then(() => {
              exportCanvas(canvas, width, height, resolve, reject)
            }).catch(reject)
          }
        })
    }

    // 确保在nextTick中执行，等待DOM完全渲染
    wx.nextTick(tryGetCanvas)
  })
}

// 加载并绘制背景图片
function loadAndDrawBackground(canvas, ctx, imageUrl, width, height, onSuccess, onFail) {
  const img = canvas.createImage()
  img.onload = () => {
    // 等比例缩放填充
    const scale = Math.max(width / img.width, height / img.height)
    const drawWidth = img.width * scale
    const drawHeight = img.height * scale
    const x = (width - drawWidth) / 2
    const y = (height - drawHeight) / 2

    ctx.drawImage(img, x, y, drawWidth, drawHeight)

    // 添加半透明遮罩让文字更清晰
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, 0, width, height)

    onSuccess()
  }
  img.onerror = () => {
    console.error('加载背景图片失败')
    onFail()
  }
  img.src = imageUrl
}

// 绘制背景
function drawBackground(ctx, bgType, w, h) {
  const bg = BACKGROUNDS[bgType] || BACKGROUNDS.default

  if (bg.type === 'gradient') {
    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    bg.colors.forEach((color, i) => {
      gradient.addColorStop(i / (bg.colors.length - 1), color)
    })
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)
  }

  // 添加装饰元素
  drawDecorations(ctx, w, h, bgType)
}

// 绘制装饰元素
function drawDecorations(ctx, w, h, bgType) {
  // 绘制半透明圆形装饰
  ctx.fillStyle = 'rgba(255,255,255,0.05)'
  ctx.beginPath()
  ctx.arc(w * 0.8, h * 0.2, 200, 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.arc(w * 0.1, h * 0.7, 150, 0, Math.PI * 2)
  ctx.fill()

  // 绘制线条装饰
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i < w; i += 100) {
    ctx.beginPath()
    ctx.moveTo(i, 0)
    ctx.lineTo(i + 50, h)
    ctx.stroke()
  }
}

// 导出画布
function exportCanvas(canvas, width, height, resolve, reject) {
  setTimeout(() => {
    wx.canvasToTempFilePath({
      canvas: canvas,
      width: width,
      height: height,
      destWidth: width * 2,  // 高清导出
      destHeight: height * 2,
      success: (res) => {
        resolve(res.tempFilePath)
      },
      fail: reject
    })
  }, 100)
}

// 绘制海报内容
async function drawPosterContent(ctx, type, w, h, game, player, canvas) {
  // 全局使用统一的卡片样式
  await drawModernCardStyle(ctx, w, h, game, player, canvas)
}

/**
 * 现代卡片风格 - 统一的高端设计
 */
async function drawModernCardStyle(ctx, w, h, game, player, canvas) {
  const padding = 50
  const cardRadius = 30

  // ========== 顶部大卡片 ==========
  const topCardY = 80
  const topCardH = 320

  // 卡片阴影
  ctx.shadowColor = 'rgba(0,0,0,0.2)'
  ctx.shadowBlur = 30
  ctx.shadowOffsetY = 15

  // 白色半透明卡片背景
  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  roundRect(ctx, padding, topCardY, w - padding * 2, topCardH, cardRadius)
  ctx.fill()

  // 重置阴影
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // 顶部装饰条
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7']
  const barWidth = (w - padding * 2) / colors.length
  colors.forEach((color, i) => {
    ctx.fillStyle = color
    ctx.fillRect(padding + i * barWidth, topCardY, barWidth, 6)
  })

  // 球场名称
  ctx.fillStyle = '#2C3E50'
  ctx.font = 'bold 44px sans-serif'
  ctx.textAlign = 'center'
  const courseName = game.courseName || '高尔夫战报'
  ctx.fillText(courseName, w / 2, topCardY + 70)

  // 日期
  const date = new Date(game.timestamp || Date.now())
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  ctx.fillStyle = '#7F8C8D'
  ctx.font = '28px sans-serif'
  ctx.fillText(dateStr, w / 2, topCardY + 110)

  const avatarY = topCardY + 200
  await drawPlayerAvatar(ctx, canvas, player, w / 2, avatarY, 60)

  // 球员名字
  ctx.fillStyle = '#2C3E50'
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText(player.name || '球员', w / 2, avatarY + 100)

  // ========== 成绩统计卡片 ==========
  const statsY = topCardY + topCardH + 30
  const statsH = 200

  // 阴影
  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 20
  ctx.shadowOffsetY = 10

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  roundRect(ctx, padding, statsY, w - padding * 2, statsH, cardRadius)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // 成绩数据
  const roundStats = calculateRoundStats(game, player.id)
  const totalStrokes = roundStats.totalStrokes
  const toPar = roundStats.toPar
  const birdies = roundStats.birdies

  const stats = [
    { label: '总杆数', value: totalStrokes, color: '#E74C3C' },
    { label: '杆差', value: toPar > 0 ? `+${toPar}` : toPar, color: '#3498DB' },
    { label: '抓鸟', value: birdies, color: '#27AE60' }
  ]

  const gap = (w - padding * 2) / 3
  stats.forEach((stat, i) => {
    const x = padding + gap * i + gap / 2
    const y = statsY + 100

    // 数值
    ctx.fillStyle = stat.color
    ctx.font = 'bold 64px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(String(stat.value), x, y)

    // 标签
    ctx.fillStyle = '#7F8C8D'
    ctx.font = '28px sans-serif'
    ctx.fillText(stat.label, x, y + 45)
  })

  // ========== 综合评分卡片 ==========
  const ratingY = statsY + statsH + 30
  const ratingH = 280

  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 20
  ctx.shadowOffsetY = 10

  ctx.fillStyle = 'rgba(255,255,255,0.95)'
  roundRect(ctx, padding, ratingY, w - padding * 2, ratingH, cardRadius)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // 评分标题
  ctx.fillStyle = '#2C3E50'
  ctx.font = '32px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('综合评分', w / 2, ratingY + 50)

  // 大分数
  const ratingInfo = calculateRatingInfo(roundStats)
  ctx.fillStyle = '#F39C12'
  ctx.font = 'bold 140px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(ratingInfo.score), w / 2, ratingY + 180)

  // 分数标签
  ctx.fillStyle = '#27AE60'
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText(ratingInfo.label, w / 2, ratingY + 230)

  // 评分依据
  ctx.fillStyle = '#7F8C8D'
  ctx.font = '22px sans-serif'
  ctx.fillText('依据: 杆差40% 稳定性30% 推杆15% 抓鸟15%', w / 2, ratingY + 260)

  // ========== 球风匹配卡片 ==========
  const starY = ratingY + ratingH + 30
  const starH = 220

  ctx.shadowColor = 'rgba(0,0,0,0.15)'
  ctx.shadowBlur = 20
  ctx.shadowOffsetY = 10

  // 渐变色背景卡片
  const starGradient = ctx.createLinearGradient(padding, starY, w - padding * 2, starY + starH)
  starGradient.addColorStop(0, '#667eea')
  starGradient.addColorStop(1, '#764ba2')
  ctx.fillStyle = starGradient
  roundRect(ctx, padding, starY, w - padding * 2, starH, cardRadius)
  ctx.fill()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetY = 0

  // 球风匹配标题
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  ctx.font = '28px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('你的球风像', w / 2, starY + 55)

  // 球星名字
  const starMatch = matchGolfStar(roundStats)
  ctx.fillStyle = 'white'
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText(`★ ${starMatch.name} ★`, w / 2, starY + 115)

  // 风格标签
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = '26px sans-serif'
  ctx.fillText(starMatch.style, w / 2, starY + 155)

  // 三个风格标签
  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.font = '22px sans-serif'
  ctx.fillText(starMatch.tags.join(' · '), w / 2, starY + 183)

  // 匹配原因
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '24px sans-serif'
  const reason = starMatch.matchReason
  if (reason.length > 24) {
    ctx.fillText(reason.substring(0, 22) + '...', w / 2, starY + 208)
  } else {
    ctx.fillText(reason, w / 2, starY + 208)
  }

  // ========== 底部 ==========
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('⛳ WinPAR 高尔夫智能记分', w / 2, h - 60)
}

function drawPlayerAvatar(ctx, canvas, player, x, y, radius) {
  return new Promise((resolve) => {
    const avatarUrl = player && (player.avatarUrl || player.avatar)
    if (!avatarUrl || !canvas || !canvas.createImage) {
      drawAvatarFallback(ctx, player, x, y, radius)
      resolve()
      return
    }

    const img = canvas.createImage()
    img.onload = () => {
      // 裁切为圆形头像
      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2)
      ctx.restore()

      // 外圈描边
      ctx.strokeStyle = 'rgba(255,255,255,0.9)'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.stroke()
      resolve()
    }
    img.onerror = () => {
      drawAvatarFallback(ctx, player, x, y, radius)
      resolve()
    }
    img.src = avatarUrl
  })
}

function drawAvatarFallback(ctx, player, x, y, radius) {
  ctx.fillStyle = getColorByName(player && player.name ? player.name : '球')
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'white'
  ctx.font = 'bold 48px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(((player && player.name) || '球')[0], x, y + 16)
}

// 绘制圆角矩形
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

// 根据名字获取颜色
function getColorByName(name) {
  const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E']
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

// 评分计算
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

// 评分计算（多指标加权）
function calculateRatingInfo(roundStats) {
  const toPar = roundStats.toPar
  const holesPlayed = roundStats.holesPlayed || 18
  const birdieRate = holesPlayed > 0 ? roundStats.birdies / holesPlayed : 0
  const avgPutts = roundStats.avgPutts || 2.0
  const volatility = roundStats.volatility || 2.0

  // 杆差得分（40）
  const toParScore = clamp(40 - Math.max(0, toPar) * 2 + Math.max(0, -toPar) * 1.2, 10, 40)
  // 稳定性得分（30），标准差越低越好
  const consistencyScore = clamp(30 - (volatility - 1.6) * 10, 8, 30)
  // 推杆得分（15），每洞推杆越低越好
  const puttingScore = clamp(15 - (avgPutts - 1.8) * 12, 4, 15)
  // 抓鸟得分（15）
  const birdieScore = clamp(15 * (birdieRate / 0.25), 0, 15)

  const score = Math.round(toParScore + consistencyScore + puttingScore + birdieScore)

  let label = '表现稳健'
  if (score >= 94) label = '大师级'
  else if (score >= 88) label = '卓越表现'
  else if (score >= 82) label = '高质量发挥'
  else if (score >= 74) label = '发挥稳定'
  else if (score >= 66) label = '持续进步'
  else label = '训练潜力大'

  return { score, label, toPar }
}

// 球风匹配（基于指标）
function matchGolfStar(roundStats) {
  const holesPlayed = roundStats.holesPlayed || 18
  const birdieRate = holesPlayed > 0 ? roundStats.birdies / holesPlayed : 0
  const parRate = holesPlayed > 0 ? roundStats.pars / holesPlayed : 0
  const bigMistakeRate = holesPlayed > 0 ? roundStats.doubleOrWorse / holesPlayed : 0
  const avgPutts = roundStats.avgPutts || 2.0
  const volatility = roundStats.volatility || 2.0

  let pick = GOLF_ARCHETYPES[0]
  if (birdieRate >= 0.2 && bigMistakeRate <= 0.2) pick = GOLF_ARCHETYPES[1]
  else if (parRate >= 0.5 && volatility <= 1.5) pick = GOLF_ARCHETYPES[2]
  else if (bigMistakeRate <= 0.1 && roundStats.toPar <= 3) pick = GOLF_ARCHETYPES[3]
  else if (avgPutts <= 1.9) pick = GOLF_ARCHETYPES[4]
  else if (roundStats.toPar <= 5 && birdieRate >= 0.12) pick = GOLF_ARCHETYPES[5]

  return {
    ...pick,
    matchReason: pick.reason
  }
}

function extractStrokes(scoreValue) {
  if (scoreValue === null || scoreValue === undefined) return 0
  if (typeof scoreValue === 'object') {
    return parseInt(scoreValue.strokes) || 0
  }
  return parseInt(scoreValue) || 0
}

function calculateRoundStats(game, playerId) {
  const holes = (game && (game.holes || game.course?.holes)) || []
  const holeParMap = {}
  holes.forEach(h => {
    if (h && h.hole !== undefined) {
      holeParMap[parseInt(h.hole)] = parseInt(h.par) || 4
    }
  })

  const scores = (game && game.scores && game.scores[playerId]) || {}
  const putts = (game && game.putts && game.putts[playerId]) || {}

  let totalStrokes = 0
  let totalPar = 0
  let holesPlayed = 0
  let birdies = 0
  let pars = 0
  let doubleOrWorse = 0
  let puttTotal = 0
  let puttCount = 0
  const diffs = []

  Object.entries(scores).forEach(([k, v]) => {
    const holeNum = parseInt(k)
    if (isNaN(holeNum)) return
    const strokes = extractStrokes(v)
    if (strokes <= 0) return

    const par = holeParMap[holeNum] || 4
    const diff = strokes - par
    totalStrokes += strokes
    totalPar += par
    holesPlayed++
    diffs.push(diff)

    if (diff <= -1) birdies++
    if (diff === 0) pars++
    if (diff >= 2) doubleOrWorse++

    const putt = parseInt(putts[holeNum])
    if (!isNaN(putt) && putt > 0) {
      puttTotal += putt
      puttCount++
    }
  })

  const avgPutts = puttCount > 0 ? puttTotal / puttCount : 2.0
  const toPar = totalStrokes - totalPar

  let volatility = 2.0
  if (diffs.length > 0) {
    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
    const variance = diffs.reduce((sum, d) => sum + Math.pow(d - avgDiff, 2), 0) / diffs.length
    volatility = Math.sqrt(variance)
  }

  return {
    totalStrokes,
    toPar,
    holesPlayed,
    birdies,
    pars,
    doubleOrWorse,
    avgPutts,
    volatility
  }
}

module.exports = { generatePoster }
