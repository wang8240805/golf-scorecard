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
    reason: '整体数据最均衡，像舍夫勒那样用稳定性赢比赛。',
    avatar: '/images/stars/scottie-scheffler.png'
  },
  {
    name: '罗里·麦克罗伊',
    style: '火力进攻型',
    tags: ['高抓鸟率', '进攻果岭', '节奏强势'],
    reason: '抓鸟能力突出，比赛节奏偏进攻，具备麦克罗伊风格。',
    avatar: '/images/stars/rory-mcilroy.png'
  },
  {
    name: '科林·森川',
    style: '精准稳健型',
    tags: ['保帕效率', '线路清晰', '稳定输出'],
    reason: '保帕占比高、波动小，典型森川式精准稳健。',
    avatar: '/images/stars/collin-morikawa.png'
  },
  {
    name: '布鲁克斯·科普卡',
    style: '大赛抗压型',
    tags: ['抗压能力', '中后程稳定', '关键洞处理'],
    reason: '关键洞失误少，后程发挥更稳，具备科普卡式抗压特征。',
    avatar: '/images/stars/brooks-koepka.png'
  },
  {
    name: '乔丹·斯皮思',
    style: '短杆创造型',
    tags: ['短杆手感', '救帕能力', '策略执行'],
    reason: '短杆与救帕表现亮眼，球路选择很有斯皮思味道。',
    avatar: '/images/stars/jordan-spieth.png'
  },
  {
    name: '琼·拉姆',
    style: '强势推进型',
    tags: ['推进能力', '进攻效率', '硬洞不怵'],
    reason: '硬洞表现不弱，整体推进力像拉姆。',
    avatar: '/images/stars/jon-rahm.png'
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
  const { type = 'pro', game, player, bgType = 'default', customBgUrl, qrcodeUrl = '', context = null } = options

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
              await drawPosterContent(ctx, type, width, height, game, player, canvas, qrcodeUrl)
              exportCanvas(canvas, width, height, resolve, reject)
            }, () => {
              drawBackground(ctx, bgType, width, height)
              drawPosterContent(ctx, type, width, height, game, player, canvas, qrcodeUrl).then(() => {
                exportCanvas(canvas, width, height, resolve, reject)
              }).catch(reject)
            })
          } else {
            drawBackground(ctx, bgType, width, height)
            drawPosterContent(ctx, type, width, height, game, player, canvas, qrcodeUrl).then(() => {
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
async function drawPosterContent(ctx, type, w, h, game, player, canvas, qrcodeUrl) {
  // 全局使用统一的卡片样式
  await drawModernCardStyle(ctx, w, h, game, player, canvas, qrcodeUrl)
}

async function drawModernCardStyle(ctx, w, h, game, player, canvas, qrcodeUrl) {
  const padding = 30
  const panelRadius = 22
  const panelW = w - padding * 2
  const roundStats = calculateRoundStats(game, player.id)
  const scoreRows = buildScorecardRows(game, player.id)
  const starMatch = matchGolfStar(roundStats)
  const highlight = buildPosterHighlight(roundStats, scoreRows)
  const date = new Date(game.endTime || game.timestamp || Date.now())
  const dateStr = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`

  drawPosterBase(ctx, w, h)

  ctx.fillStyle = '#EAF3EA'
  ctx.font = '26px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('WINPAR ROUND SUMMARY', padding, 66)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 42px sans-serif'
  drawTextFit(ctx, game.courseName || '高尔夫比赛总结', padding, 118, panelW - 150, 42)

  ctx.fillStyle = 'rgba(255,255,255,0.78)'
  ctx.font = '26px sans-serif'
  ctx.fillText(`${dateStr} / ${roundStats.holesPlayed || 0}洞`, padding, 154)

  await drawPlayerAvatar(ctx, canvas, player, w - padding - 52, 105, 52)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 26px sans-serif'
  ctx.textAlign = 'right'
  drawTextFit(ctx, player.name || '球员', w - padding - 112, 158, 140, 26, 'right')

  const heroY = 178
  drawPanel(ctx, padding, heroY, panelW, 236, panelRadius, '#F8F5EB')
  ctx.fillStyle = '#183B2A'
  ctx.font = 'bold 126px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(String(roundStats.totalStrokes || '-'), padding + 28, heroY + 128)

  ctx.fillStyle = '#6A725E'
  ctx.font = '28px sans-serif'
  ctx.fillText('总杆', padding + 34, heroY + 168)

  ctx.fillStyle = getDiffColor(roundStats.toPar)
  ctx.font = 'bold 58px sans-serif'
  ctx.fillText(formatToPar(roundStats.toPar), padding + 216, heroY + 112)

  ctx.fillStyle = '#6A725E'
  ctx.font = '26px sans-serif'
  ctx.fillText('距标准杆', padding + 220, heroY + 150)

  drawHighlightBlock(ctx, padding + 366, heroY + 42, panelW - 390, 156, highlight)

  const tableY = 438
  drawPanel(ctx, padding, tableY, panelW, 420, panelRadius, '#FFFFFF')
  ctx.fillStyle = '#183B2A'
  ctx.font = 'bold 32px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('18洞成绩', padding + 24, tableY + 50)

  ctx.fillStyle = '#5F6858'
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText(`前九 ${formatToPar(roundStats.frontToPar)} / 后九 ${formatToPar(roundStats.backToPar)}`, padding + panelW - 24, tableY + 50)

  drawScorecardGrid(ctx, scoreRows.slice(0, 9), padding + 20, tableY + 86, panelW - 40, 'OUT', 44)
  drawScorecardGrid(ctx, scoreRows.slice(9, 18), padding + 20, tableY + 246, panelW - 40, 'IN', 44)

  const styleY = 882
  drawPanel(ctx, padding, styleY, panelW, 184, panelRadius, '#153B2A')

  ctx.fillStyle = 'rgba(255,255,255,0.72)'
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('球风对标', padding + 24, styleY + 38)

  await drawStarAvatar(ctx, canvas, padding + panelW - 70, styleY + 72, 42, starMatch)

  ctx.fillStyle = 'white'
  ctx.font = 'bold 40px sans-serif'
  drawTextFit(ctx, starMatch.name, padding + 24, styleY + 88, panelW - 178, 40)

  ctx.fillStyle = '#CDE7B0'
  ctx.font = '26px sans-serif'
  ctx.fillText(starMatch.style, padding + 24, styleY + 126)

  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  ctx.font = '23px sans-serif'
  drawTextFit(ctx, starMatch.tags.join(' / '), padding + 24, styleY + 160, panelW - 180, 23)

  const footerY = 1092
  drawPanel(ctx, padding, footerY, panelW, 160, panelRadius, '#F8F5EB')
  ctx.fillStyle = '#183B2A'
  ctx.font = 'bold 30px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('扫码查看本场成绩', padding + 24, footerY + 54)

  ctx.fillStyle = '#667160'
  ctx.font = '24px sans-serif'
  drawMultilineText(ctx, '保存海报或分享给球友，打开 WinPAR 可回看完整战报。', padding + 24, footerY + 92, panelW - 190, 30, 2)

  await drawReportQrCode(ctx, canvas, qrcodeUrl, padding + panelW - 132, footerY + 20, 112)

  ctx.fillStyle = 'rgba(255,255,255,0.64)'
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('WinPAR 高尔夫智能记分', w / 2, h - 60)
}

function drawPosterBase(ctx, w, h) {
  ctx.fillStyle = '#0F2E22'
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = '#174533'
  ctx.fillRect(0, 0, w, 255)

  ctx.fillStyle = '#F1E7CC'
  ctx.fillRect(0, 255, w, 16)

  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  for (let y = 300; y < h; y += 46) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
  }
}

function drawPanel(ctx, x, y, width, height, radius, color) {
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.18)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 8
  ctx.fillStyle = color
  roundRect(ctx, x, y, width, height, radius)
  ctx.fill()
  ctx.restore()
}

function drawSummaryMetric(ctx, x, y, label, value, color) {
  ctx.fillStyle = '#6A725E'
  ctx.font = '25px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(label, x, y)

  ctx.fillStyle = color
  ctx.font = 'bold 52px sans-serif'
  ctx.fillText(value, x, y + 60)
}

function drawHighlightBlock(ctx, x, y, width, height, highlight) {
  ctx.save()
  ctx.fillStyle = '#153B2A'
  roundRect(ctx, x, y, width, height, 18)
  ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.70)'
  ctx.font = '23px sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('本场亮点', x + 18, y + 36)

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 34px sans-serif'
  drawTextFit(ctx, highlight.title, x + 18, y + 82, width - 36, 34)

  ctx.fillStyle = '#CDE7B0'
  ctx.font = '24px sans-serif'
  drawMultilineText(ctx, highlight.desc, x + 18, y + 120, width - 36, 30, 2)
  ctx.restore()
}

function drawReportQrCode(ctx, canvas, qrcodeUrl, x, y, size) {
  if (!qrcodeUrl) {
    drawQrFallback(ctx, x, y, size)
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    if (!canvas || !canvas.createImage) {
      drawQrFallback(ctx, x, y, size)
      resolve()
      return
    }

    const img = canvas.createImage()
    img.onload = () => {
      ctx.save()
      ctx.fillStyle = '#FFFFFF'
      roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 16)
      ctx.fill()
      ctx.drawImage(img, x, y, size, size)
      ctx.restore()
      resolve()
    }
    img.onerror = () => {
      drawQrFallback(ctx, x, y, size)
      resolve()
    }
    img.src = qrcodeUrl
  })
}

function drawQrFallback(ctx, x, y, size) {
  ctx.save()
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, x - 8, y - 8, size + 16, size + 16, 16)
  ctx.fill()
  ctx.strokeStyle = '#183B2A'
  ctx.lineWidth = 4
  roundRect(ctx, x + 10, y + 10, size - 20, size - 20, 10)
  ctx.stroke()
  ctx.fillStyle = '#183B2A'
  ctx.font = 'bold 24px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('WinPAR', x + size / 2, y + size / 2 - 4)
  ctx.font = '20px sans-serif'
  ctx.fillText('回看', x + size / 2, y + size / 2 + 28)
  ctx.restore()
}

function drawStarAvatar(ctx, canvas, x, y, radius, starMatch) {
  const avatar = starMatch && starMatch.avatar
  return drawLocalCircleImage(ctx, canvas, avatar, x, y, radius).catch(() => {
    drawStarAvatarBadge(ctx, x, y, radius, starMatch)
  })
}

function drawStarAvatarBadge(ctx, x, y, radius, starMatch) {
  const themes = {
    '斯科蒂·舍夫勒': { from: '#2E7D32', to: '#66BB6A', mark: '舍' },
    '罗里·麦克罗伊': { from: '#0D47A1', to: '#42A5F5', mark: '罗' },
    '科林·森川': { from: '#455A64', to: '#90A4AE', mark: '森' },
    '布鲁克斯·科普卡': { from: '#6A1B9A', to: '#AB47BC', mark: '科' },
    '乔丹·斯皮思': { from: '#E65100', to: '#FFB74D', mark: '斯' },
    '琼·拉姆': { from: '#1B5E20', to: '#81C784', mark: '拉' }
  }
  const theme = themes[(starMatch && starMatch.name) || ''] || { from: '#24543F', to: '#6DAE8A', mark: '星' }

  const gradient = ctx.createLinearGradient(x - radius, y - radius, x + radius, y + radius)
  gradient.addColorStop(0, theme.from)
  gradient.addColorStop(1, theme.to)
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,255,255,0.9)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 28px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(theme.mark, x, y + 9)
}

function drawLocalCircleImage(ctx, canvas, imagePath, x, y, radius) {
  return new Promise((resolve, reject) => {
    if (!imagePath || !canvas || !canvas.createImage) {
      reject(new Error('local star avatar unavailable'))
      return
    }

    const img = canvas.createImage()
    img.onload = () => {
      const sourceW = img.width || radius * 2
      const sourceH = img.height || radius * 2
      const side = Math.min(sourceW, sourceH)
      const sx = Math.max(0, (sourceW - side) / 2)
      const sy = Math.max(0, (sourceH - side) / 2)

      ctx.save()
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, sx, sy, side, side, x - radius, y - radius, radius * 2, radius * 2)
      ctx.restore()

      ctx.strokeStyle = 'rgba(255,255,255,0.92)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.stroke()
      resolve()
    }
    img.onerror = reject
    img.src = imagePath
  })
}

function drawScorecardGrid(ctx, rows, x, y, width, label, rowH = 58) {
  const labelW = 54
  const totalDiffColW = 78
  const cellW = (width - labelW - totalDiffColW) / 9
  const headerBg = '#EEF4EA'
  const lineColor = '#D8E0D3'
  const totalPar = rows.reduce((sum, row) => sum + (parseInt(row.par, 10) || 0), 0)
  const totalDiff = rows.reduce((sum, row) => {
    if (!row.strokes) return sum
    return sum + (parseInt(row.diff, 10) || 0)
  }, 0)

  ctx.fillStyle = '#183B2A'
  ctx.font = 'bold 26px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, x + labelW / 2, y + 35)

  const rowLabels = ['洞', 'Par', '+/-']
  rowLabels.forEach((rowLabel, rowIndex) => {
    const rowY = y + rowIndex * rowH
    ctx.fillStyle = rowIndex === 0 ? headerBg : '#FFFFFF'
    roundRect(ctx, x, rowY, width, rowH, rowIndex === 0 ? 10 : 0)
    ctx.fill()

    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, rowY + rowH)
    ctx.lineTo(x + width, rowY + rowH)
    ctx.stroke()

    ctx.fillStyle = rowIndex === 0 ? '#183B2A' : '#6A725E'
    ctx.font = rowIndex === 0 ? 'bold 24px sans-serif' : '23px sans-serif'
    ctx.fillText(rowLabel, x + labelW / 2, rowY + 36)

    rows.forEach((row, colIndex) => {
      const cellX = x + labelW + colIndex * cellW
      let text = ''
      let color = '#263A2E'
      if (rowIndex === 0) text = String(row.hole)
      if (rowIndex === 1) text = String(row.par)
      if (rowIndex === 2) {
        text = row.strokes ? formatToPar(row.diff) : '-'
        color = row.strokes ? getDiffColor(row.diff) : '#A0A899'
      }

      ctx.fillStyle = color
      ctx.font = rowIndex === 2 ? 'bold 27px sans-serif' : '24px sans-serif'
      ctx.fillText(text, cellX + cellW / 2, rowY + 36)
    })

    const summaryCellX = x + labelW + 9 * cellW
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(summaryCellX, rowY)
    ctx.lineTo(summaryCellX, rowY + rowH)
    ctx.stroke()

    let summaryText = ''
    let summaryColor = '#6A725E'
    if (rowIndex === 0) {
      summaryText = '总计'
      summaryColor = '#183B2A'
    } else if (rowIndex === 1) {
      summaryText = String(totalPar)
      summaryColor = '#6A725E'
    } else if (rowIndex === 2) {
      summaryText = formatToPar(totalDiff)
      summaryColor = getDiffColor(totalDiff)
    }
    ctx.fillStyle = summaryColor
    ctx.font = rowIndex === 2 ? 'bold 27px sans-serif' : '23px sans-serif'
    ctx.fillText(summaryText, summaryCellX + totalDiffColW / 2, rowY + 36)
  })
}

function drawTextFit(ctx, text, x, y, maxWidth, fontSize, align = 'left') {
  const value = String(text || '')
  if (!value) return
  ctx.textAlign = align
  if (ctx.measureText(value).width <= maxWidth) {
    ctx.fillText(value, x, y)
    return
  }
  let next = value
  while (next.length > 1 && ctx.measureText(next + '...').width > maxWidth) {
    next = next.slice(0, -1)
  }
  ctx.fillText(next + '...', x, y)
}

function drawMultilineText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  const chars = String(text || '').split('')
  const lines = []
  let line = ''
  chars.forEach((char) => {
    const next = line + char
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = char
    } else {
      line = next
    }
  })
  if (line) lines.push(line)
  lines.slice(0, maxLines).forEach((item, index) => {
    const output = index === maxLines - 1 && lines.length > maxLines ? item.slice(0, Math.max(1, item.length - 1)) + '...' : item
    ctx.fillText(output, x, y + index * lineHeight)
  })
}

function formatToPar(diff) {
  const value = parseInt(diff, 10) || 0
  if (value === 0) return 'E'
  return value > 0 ? `+${value}` : String(value)
}

function getDiffColor(diff) {
  const value = parseInt(diff, 10) || 0
  if (value < 0) return '#1F7A4A'
  if (value > 0) return '#B3472D'
  return '#6A725E'
}

function buildScorecardRows(game, playerId) {
  const holes = getPosterHoles(game)
  const scores = (game && game.scores && game.scores[playerId]) || {}
  return holes.map((hole) => {
    const raw = scores[hole.hole] !== undefined ? scores[hole.hole] : scores[String(hole.hole)]
    const strokes = extractStrokes(raw)
    return {
      hole: hole.hole,
      par: hole.par,
      strokes,
      diff: strokes > 0 ? strokes - hole.par : 0
    }
  })
}

function getPosterHoles(game) {
  const source = (game && (game.holes || game.course?.holes)) || []
  const holes = source.map((h, index) => ({
    hole: parseInt(h.hole || h.holeNumber || index + 1, 10),
    par: parseInt(h.par, 10) || 4
  })).filter((h) => h.hole > 0).slice(0, 18)

  while (holes.length < 18) {
    holes.push({ hole: holes.length + 1, par: 4 })
  }
  return holes
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
  const holes = getPosterHoles(game)
  const scores = (game && game.scores && game.scores[playerId]) || {}
  const putts = (game && game.putts && game.putts[playerId]) || {}

  let totalStrokes = 0
  let totalPar = 0
  let frontToPar = 0
  let backToPar = 0
  let holesPlayed = 0
  let birdies = 0
  let pars = 0
  let doubleOrWorse = 0
  let puttTotal = 0
  let puttCount = 0
  const diffs = []

  holes.forEach((hole, index) => {
    const raw = scores[hole.hole] !== undefined ? scores[hole.hole] : scores[String(hole.hole)]
    const strokes = extractStrokes(raw)
    if (strokes <= 0) return

    const par = hole.par || 4
    const diff = strokes - par
    totalStrokes += strokes
    totalPar += par
    if (index < 9) frontToPar += diff
    else backToPar += diff
    holesPlayed++
    diffs.push(diff)

    if (diff <= -1) birdies++
    if (diff === 0) pars++
    if (diff >= 2) doubleOrWorse++

    const putt = parseInt(putts[hole.hole] !== undefined ? putts[hole.hole] : putts[String(hole.hole)])
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
    frontToPar,
    backToPar,
    holesPlayed,
    birdies,
    pars,
    doubleOrWorse,
    avgPutts,
    volatility
  }
}

function buildPosterHighlight(roundStats, scoreRows) {
  const rows = Array.isArray(scoreRows) ? scoreRows.filter(row => row.strokes > 0) : []
  const bestHole = rows.reduce((best, row) => {
    if (!best || row.diff < best.diff) return row
    return best
  }, null)

  if (bestHole && bestHole.diff <= -1) {
    return {
      title: `${bestHole.hole}洞 ${formatToPar(bestHole.diff)}`,
      desc: `本轮最佳洞，${bestHole.strokes}杆完成 Par ${bestHole.par}`
    }
  }

  if ((roundStats.birdies || 0) > 0) {
    return {
      title: `小鸟+ ${roundStats.birdies}`,
      desc: '进攻端有亮点，抓分能力在线'
    }
  }

  if ((roundStats.backToPar || 0) < (roundStats.frontToPar || 0)) {
    const improve = (roundStats.frontToPar || 0) - (roundStats.backToPar || 0)
    return {
      title: `后九少 ${improve} 杆`,
      desc: '后半程节奏更稳，完成一次反攻'
    }
  }

  if ((roundStats.pars || 0) >= 6) {
    return {
      title: `保帕 ${roundStats.pars}`,
      desc: '稳定处理关键洞，失误控制不错'
    }
  }

  if ((roundStats.doubleOrWorse || 0) === 0 && (roundStats.holesPlayed || 0) >= 18) {
    return {
      title: '全场无大失误',
      desc: '没有双柏忌以上，节奏控制稳定'
    }
  }

  return {
    title: `${roundStats.holesPlayed || 0}洞完赛`,
    desc: `总杆${roundStats.totalStrokes || '-'}，杆差${formatToPar(roundStats.toPar)}`
  }
}

module.exports = { generatePoster }
