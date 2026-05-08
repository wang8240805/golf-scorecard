/**
 * 海报生成器 - 优化版
 * 使用 Canvas 2D API 生成精美分享海报
 * 采用现代卡片式设计、渐变背景、精致排版
 */

// 球星数据库
const GOLF_STARS = [
  { name: '老虎·伍兹', toPar: -10, style: '霸气进攻型', reason: '你的成绩已经是职业选手水准！' },
  { name: '罗里·麦克罗伊', toPar: -6, style: '力量爆发型', reason: '你的进攻能力出色，每一杆都充满力量！' },
  { name: '达斯汀·约翰逊', toPar: -5, style: '全面均衡型', reason: '你的技术全面，长短杆都有不错发挥！' },
  { name: '乔丹·斯皮思', toPar: -4, style: '智慧型', reason: '你的策略思维和短杆技术令人印象深刻！' },
  { name: '琼·拉姆', toPar: -2, style: '激情型', reason: '你的激情和爆发力让比赛充满看点！' },
  { name: '科林·森川', toPar: 0, style: '精准稳健型', reason: '你的基本功扎实，是球场上的稳定输出者！' },
  { name: '维克多·霍夫兰', toPar: 2, style: '稳定进取型', reason: '你的进步空间很大，保持这个势头！' },
  { name: '松山英树', toPar: 4, style: '沉稳专注型', reason: '你的专注和沉稳是高尔夫最好的品质！' },
  { name: '菲尔·米克森', toPar: 8, style: '创意冒险型', reason: '你的创造力和冒险精神让比赛更有趣！' },
  { name: '约翰·达利', toPar: 15, style: '快乐享受型', reason: '你懂得高尔夫的真谛——享受过程！' }
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
            loadAndDrawBackground(canvas, ctx, customBgUrl, width, height, () => {
              drawPosterContent(ctx, type, width, height, game, player)
              exportCanvas(canvas, width, height, resolve, reject)
            }, () => {
              drawBackground(ctx, bgType, width, height)
              drawPosterContent(ctx, type, width, height, game, player)
              exportCanvas(canvas, width, height, resolve, reject)
            })
          } else {
            drawBackground(ctx, bgType, width, height)
            drawPosterContent(ctx, type, width, height, game, player)
            exportCanvas(canvas, width, height, resolve, reject)
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
function drawPosterContent(ctx, type, w, h, game, player) {
  // 全局使用统一的卡片样式
  drawModernCardStyle(ctx, w, h, game, player)
}

/**
 * 现代卡片风格 - 统一的高端设计
 */
function drawModernCardStyle(ctx, w, h, game, player) {
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

  // 球员头像圆形
  const avatarY = topCardY + 200
  ctx.fillStyle = getColorByName(player.name || '球')
  ctx.beginPath()
  ctx.arc(w / 2, avatarY, 60, 0, Math.PI * 2)
  ctx.fill()

  // 球员名字首字
  ctx.fillStyle = 'white'
  ctx.font = 'bold 48px sans-serif'
  ctx.fillText((player.name || '球')[0], w / 2, avatarY + 16)

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
  const totalStrokes = calculateTotalStrokes(game, player.id)
  const toPar = calculateToParValue(game, player.id)
  const holesPlayed = calculateHolesPlayed(game, player.id)
  const birdies = countBirdies(game, player.id)

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
  const ratingInfo = calculateRatingInfo(toPar)
  ctx.fillStyle = '#F39C12'
  ctx.font = 'bold 140px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(String(ratingInfo.score), w / 2, ratingY + 180)

  // 分数标签
  ctx.fillStyle = '#27AE60'
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText(ratingInfo.label, w / 2, ratingY + 230)

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
  const starMatch = matchGolfStar(toPar, game, player.id)
  ctx.fillStyle = 'white'
  ctx.font = 'bold 48px sans-serif'
  ctx.fillText(`★ ${starMatch.name} ★`, w / 2, starY + 115)

  // 风格标签
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.font = '28px sans-serif'
  ctx.fillText(starMatch.style, w / 2, starY + 155)

  // 匹配原因
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = '24px sans-serif'
  const reason = starMatch.matchReason
  if (reason.length > 20) {
    ctx.fillText(reason.substring(0, 18) + '...', w / 2, starY + 190)
  } else {
    ctx.fillText(reason, w / 2, starY + 190)
  }

  // ========== 底部 ==========
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('⛳ WinPAR 高尔夫智能记分', w / 2, h - 60)
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
function calculateRatingInfo(toPar) {
  let score = 75
  let label = '表现稳健'

  if (toPar <= -10) { score = 98; label = '传奇水准' }
  else if (toPar <= -5) { score = 92; label = '卓越表现' }
  else if (toPar <= -2) { score = 88; label = '优秀战绩' }
  else if (toPar <= 2) { score = 82; label = '发挥出色' }
  else if (toPar <= 5) { score = 78; label = '表现稳健' }
  else if (toPar <= 10) { score = 72; label = '持续进步' }
  else { score = 68; label = '享受过程' }

  return { score, label, toPar }
}

// 球星匹配
function matchGolfStar(toPar, game, playerId) {
  const player = game?.players?.find(p => p.id === playerId)
  let closest = GOLF_STARS[GOLF_STARS.length - 1]
  let minDiff = Math.abs(toPar - closest.toPar)

  for (const star of GOLF_STARS) {
    const diff = Math.abs(toPar - star.toPar)
    if (diff < minDiff) {
      minDiff = diff
      closest = star
    }
  }

  let matchReason = closest.reason

  if (player && player.scores) {
    const validScores = player.scores.filter(s => s.strokes > 0)
    const birdies = validScores.filter(s => s.strokes < (s.par || 4)).length
    const pars = validScores.filter(s => s.strokes === (s.par || 4)).length
    const totalHoles = validScores.length

    if (birdies >= 3) {
      matchReason = '你的抓鸟能力突出，像' + closest.name + '一样敢于进攻！'
    } else if (pars >= totalHoles * 0.5) {
      matchReason = '你的保帕率很高，这正是' + closest.name + '的特点！'
    }
  }

  return { ...closest, matchReason }
}

// 辅助函数
function calculateToParValue(game, playerId) {
  const player = game?.players?.find(p => p.id === playerId)
  if (player && player.toPar !== undefined) return player.toPar

  if (player && player.scores && Array.isArray(player.scores)) {
    const validScores = player.scores.filter(s => s.strokes > 0)
    const totalPar = validScores.reduce((sum, s) => sum + (s.par || 4), 0)
    const totalStrokes = validScores.reduce((sum, s) => sum + s.strokes, 0)
    return totalStrokes - totalPar
  }

  const scores = game?.scores?.[playerId] || {}
  const holes = game?.holes || []
  let totalPar = 0, totalStrokes = 0

  Object.entries(scores).forEach(([k, v]) => {
    const holeNum = parseInt(k)
    if (!isNaN(holeNum) && v > 0) {
      const holeData = holes.find(h => h.hole === holeNum)
      if (holeData) {
        totalPar += holeData.par || 4
        totalStrokes += v
      }
    }
  })

  return totalStrokes - totalPar
}

function calculateTotalStrokes(game, playerId) {
  if (!game || !playerId) return 0

  const player = game.players?.find(p => p.id === playerId)
  if (player && player.totalScore !== undefined) return player.totalScore

  if (player && player.scores && Array.isArray(player.scores)) {
    return player.scores.filter(s => s.strokes > 0).reduce((sum, s) => sum + s.strokes, 0)
  }

  const scores = game.scores?.[playerId] || {}
  return Object.values(scores).reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0)
}

function calculateHolesPlayed(game, playerId) {
  if (!game || !playerId) return 0

  const player = game.players?.find(p => p.id === playerId)
  if (player && player.holesCompleted !== undefined) return player.holesCompleted

  if (player && player.scores && Array.isArray(player.scores)) {
    return player.scores.filter(s => s.strokes > 0).length
  }

  const scores = game.scores?.[playerId] || {}
  return Object.keys(scores).filter(k => !isNaN(k)).length
}

function countBirdies(game, playerId) {
  const player = game?.players?.find(p => p.id === playerId)

  if (player && player.scores && Array.isArray(player.scores)) {
    return player.scores.filter(s => {
      if (s.strokes <= 0) return false
      const par = s.par || 4
      return s.strokes < par
    }).length
  }

  const scores = game?.scores?.[playerId] || {}
  const holes = game?.holes || []
  let count = 0

  Object.entries(scores).forEach(([k, v]) => {
    const holeNum = parseInt(k)
    if (!isNaN(holeNum) && v > 0) {
      const holeData = holes.find(h => h.hole === holeNum)
      if (holeData && v < holeData.par) count++
    }
  })

  return count
}

module.exports = { generatePoster }
