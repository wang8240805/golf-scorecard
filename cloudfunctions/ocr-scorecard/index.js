const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init()

const hunyuanApiKey = process.env.HUNYUAN_API_KEY || ''

function extractJsonObject(text) {
  if (!text) return null
  const firstBrace = text.indexOf('{')
  if (firstBrace < 0) return null

  let depth = 0
  let end = -1
  for (let i = firstBrace; i < text.length; i++) {
    if (text[i] === '{') depth++
    if (text[i] === '}') depth--
    if (depth === 0) {
      end = i + 1
      break
    }
  }
  if (end < 0) return null

  const raw = text.substring(firstBrace, end)
    .replace(/```json\s*/g, '')
    .replace(/```/g, '')

  try {
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

function callHunyuanAI(prompt, imageBase64, timeoutMs = 120000, maxRetries = 2) {
  const body = {
    model: 'hunyuan-vision',
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
      ]
    }]
  }

  const postData = JSON.stringify(body)

  function attempt(retryCount) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('AI识别超时')), timeoutMs)

      const req = https.request({
        hostname: 'api.hunyuan.cloud.tencent.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + hunyuanApiKey,
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = ''
        res.on('data', chunk => { data += chunk })
        res.on('end', () => {
          clearTimeout(timeout)

          if (res.statusCode >= 500 && retryCount < maxRetries) {
            const delay = Math.pow(2, retryCount) * 1000
            setTimeout(() => attempt(retryCount + 1).then(resolve).catch(reject), delay)
            return
          }

          try {
            const result = JSON.parse(data || '{}')
            if (result.error) {
              reject(new Error(result.error.message || 'AI调用失败'))
              return
            }
            const content = result.choices?.[0]?.message?.content || ''
            resolve({
              parsed: extractJsonObject(content),
              rawContent: content
            })
          } catch (e) {
            reject(e)
          }
        })
      })

      req.on('error', (e) => {
        clearTimeout(timeout)
        if (retryCount < maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000
          setTimeout(() => attempt(retryCount + 1).then(resolve).catch(reject), delay)
        } else {
          reject(e)
        }
      })

      req.write(postData)
      req.end()
    })
  }

  return attempt(0)
}

function normalizeParValue(value) {
  const n = parseInt(value)
  if (n <= 3) return 3
  if (n >= 5) return 5
  return 4
}

function normalizePars(rawPars) {
  const pars = Array.isArray(rawPars) ? rawPars.slice(0, 18).map(normalizeParValue) : []
  while (pars.length < 18) {
    pars.push(4)
  }
  return pars
}

function extractParsFromAny(aiPayload) {
  const parsed = aiPayload && aiPayload.parsed ? aiPayload.parsed : null
  const rawContent = aiPayload && aiPayload.rawContent ? String(aiPayload.rawContent) : ''

  function fromAnyValue(value) {
    if (!value) return []
    if (Array.isArray(value)) {
      return value.map(normalizeParValue)
    }
    if (typeof value === 'object') {
      if (Array.isArray(value.pars)) return value.pars.map(normalizeParValue)
      if (Array.isArray(value.par)) return value.par.map(normalizeParValue)
      if (Array.isArray(value.holes)) {
        return value.holes.map(function(h) {
          if (typeof h === 'object') return normalizeParValue(h.par)
          return normalizeParValue(h)
        })
      }
    }
    return []
  }

  let rawPars = fromAnyValue(parsed)
  let extractedFrom = 'parsed.pars'

  if (rawPars.length === 0 && parsed) {
    rawPars = fromAnyValue(parsed.par || parsed.holes || parsed.data)
    extractedFrom = 'parsed.alt'
  }

  // 最后兜底：从原文中提取 3/4/5（最多18个）
  if (rawPars.length === 0 && rawContent) {
    const matches = rawContent.match(/\b[345]\b/g) || []
    rawPars = matches.slice(0, 18).map(function(n) { return parseInt(n, 10) })
    extractedFrom = 'rawContent.regex'
  }

  return {
    rawPars,
    extractedFrom,
    rawContentPreview: rawContent ? rawContent.slice(0, 500) : ''
  }
}

// 动态规划：把9洞修复到sum=36，代价最小
function fixNineTo36(ninePars) {
  const candidates = [3, 4, 5]
  const target = 36
  const n = 9
  const INF = 1e9
  const dp = Array.from({ length: n + 1 }, () => Array(target + 1).fill(INF))
  const pick = Array.from({ length: n + 1 }, () => Array(target + 1).fill(-1))

  dp[0][0] = 0

  for (let i = 1; i <= n; i++) {
    const original = ninePars[i - 1]
    for (let s = 0; s <= target; s++) {
      for (const c of candidates) {
        if (s - c < 0) continue
        const cost = dp[i - 1][s - c] + Math.abs(c - original)
        if (cost < dp[i][s]) {
          dp[i][s] = cost
          pick[i][s] = c
        }
      }
    }
  }

  if (dp[n][target] >= INF) {
    return { pars: ninePars.slice(), changed: [] }
  }

  const fixed = Array(n).fill(4)
  const changed = []
  let s = target
  for (let i = n; i >= 1; i--) {
    const c = pick[i][s]
    fixed[i - 1] = c
    if (c !== ninePars[i - 1]) {
      changed.push(i - 1)
    }
    s -= c
  }

  return { pars: fixed, changed }
}

function buildHolesWithMeta(rawPars, fixedPars, changedHoleSet, defaultFilledSet) {
  return fixedPars.map((par, idx) => {
    const hole = idx + 1
    const changed = changedHoleSet.has(hole)
    const defaultFilled = defaultFilledSet.has(hole)

    let confidence = 0.9
    let source = 'ai'
    if (changed) {
      confidence = 0.65
      source = 'rule_infer'
    }
    if (defaultFilled) {
      confidence = 0.5
      source = 'default_fill'
    }

    return {
      hole,
      par,
      confidence,
      source,
      needs_review: changed || defaultFilled
    }
  })
}

function validateHoles(holes) {
  if (!Array.isArray(holes) || holes.length !== 18) {
    return { valid: false, severity: 'error', reason: '洞数不足18', changedHoles: [], reviewHoles: [] }
  }

  const frontNinePar = holes.slice(0, 9).reduce((s, h) => s + h.par, 0)
  const backNinePar = holes.slice(9, 18).reduce((s, h) => s + h.par, 0)
  const totalPar = frontNinePar + backNinePar

  const reviewHoles = holes.filter(h => h.needs_review).map(h => h.hole)
  const changedHoles = holes.filter(h => h.source === 'rule_infer').map(h => h.hole)

  let severity = 'ok'
  let valid = true
  let reason = ''

  if (frontNinePar !== 36 || backNinePar !== 36 || totalPar !== 72) {
    valid = false
    severity = 'error'
    reason = `校验失败: 前9=${frontNinePar}, 后9=${backNinePar}, 总计=${totalPar}`
  } else if (reviewHoles.length > 4) {
    severity = 'warning'
    reason = `可用但建议复核: ${reviewHoles.length}个洞位低置信度`
  }

  return { valid, severity, reason, changedHoles, reviewHoles, frontNinePar, backNinePar, totalPar }
}

function buildQuality(validation, holes) {
  const coverageScore = holes.length === 18 ? 1 : 0
  const consistencyScore = validation.valid ? 1 : 0
  const lowConfidenceCount = holes.filter(h => h.confidence < 0.75).length
  const imageQualityScore = Math.max(0.4, 1 - lowConfidenceCount / 18)
  return {
    imageQualityScore: Number(imageQualityScore.toFixed(2)),
    coverageScore,
    consistencyScore
  }
}

async function recognizeParByAI(imageBase64, mode) {
  const isBackNine = mode === 'back9'
  const prompt = isBackNine
    ? `你是高尔夫记分卡识别专家。请聚焦图片下半部分和后九洞区域，只输出后9洞PAR数组，JSON格式。\n\n要求：\n1) 输出 pars 必须为9个数字（10-18洞）。\n2) 每个数字只能是3/4/5。\n3) 严禁输出其它文字。\n4) 返回JSON: {"pars":[...],"reason":"..."}`
    : `你是高尔夫记分卡识别专家。请只输出18洞PAR数组，JSON格式。\n\n要求：\n1) 输出 pars 必须为18个数字。\n2) 每个数字只能是3/4/5。\n3) 按洞号1到18顺序。\n4) 返回JSON: {"pars":[...],"reason":"..."}`
  return callHunyuanAI(prompt, imageBase64, 120000)
}

exports.main = async (event) => {
  if (!hunyuanApiKey) {
    return {
      success: false,
      error: 'HUNYUAN_API_KEY not configured'
    }
  }

  const { fileID, imageBase64 } = event
  let base64Data = imageBase64

  if (!base64Data && fileID) {
    try {
      const downloadResult = await cloud.downloadFile({ fileID })
      base64Data = downloadResult.fileContent.toString('base64')
    } catch (err) {
      return { success: false, error: '下载图片失败: ' + err.message }
    }
  }

  if (!base64Data) {
    return { success: false, error: '缺少图片数据' }
  }

  try {
    const aiResult = await recognizeParByAI(base64Data)
    const parsedInfo = extractParsFromAny(aiResult)
    let rawPars = parsedInfo.rawPars || []

    // 后9洞二次识别：聚焦下半区语义，覆盖10-18洞识别结果
    let backNineInfo = null
    try {
      const backNineResult = await recognizeParByAI(base64Data, 'back9')
      backNineInfo = extractParsFromAny(backNineResult)
      const backNinePars = (backNineInfo.rawPars || []).slice(0, 9).map(normalizeParValue)
      if (backNinePars.length >= 6) {
        if (rawPars.length < 18) {
          while (rawPars.length < 18) rawPars.push(4)
        }
        for (let i = 0; i < Math.min(9, backNinePars.length); i++) {
          rawPars[9 + i] = backNinePars[i]
        }
      }
    } catch (e) {
      // 二次识别失败不阻断主流程
      backNineInfo = { error: e.message || 'back9 failed' }
    }

    if (rawPars.length === 0) {
      return {
        success: false,
        error: 'AI未返回有效PAR数据',
        debugInfo: {
          extractedFrom: parsedInfo.extractedFrom,
          rawContentPreview: parsedInfo.rawContentPreview
        }
      }
    }

    const normalized = normalizePars(rawPars)
    const defaultFilledSet = new Set()
    for (let i = rawPars.length + 1; i <= 18; i++) {
      defaultFilledSet.add(i)
    }

    const front = normalized.slice(0, 9)
    const back = normalized.slice(9, 18)

    const fixedFront = fixNineTo36(front)
    const fixedBack = fixNineTo36(back)

    const fixedPars = fixedFront.pars.concat(fixedBack.pars)
    const changedHoleSet = new Set()
    fixedFront.changed.forEach(idx => changedHoleSet.add(idx + 1))
    fixedBack.changed.forEach(idx => changedHoleSet.add(idx + 10))

    const holes = buildHolesWithMeta(normalized, fixedPars, changedHoleSet, defaultFilledSet)
    const validation = validateHoles(holes)
    const quality = buildQuality(validation, holes)

    const confidence = Number((holes.reduce((s, h) => s + h.confidence, 0) / holes.length).toFixed(2))

    return {
      success: true,
      data: {
        holes,
        frontNinePar: validation.frontNinePar,
        backNinePar: validation.backNinePar,
        totalPar: validation.totalPar,
        confidence,
        source: 'hunyuan+rule-engine',
        validation,
        quality,
        debugInfo: {
          rawPars,
          fixedPars,
          aiReason: aiResult && aiResult.parsed ? (aiResult.parsed.reason || '') : '',
          extractedFrom: parsedInfo.extractedFrom,
          rawContentPreview: parsedInfo.rawContentPreview,
          backNineExtractedFrom: backNineInfo && backNineInfo.extractedFrom ? backNineInfo.extractedFrom : '',
          backNineRawPreview: backNineInfo && backNineInfo.rawContentPreview ? backNineInfo.rawContentPreview : '',
          backNineError: backNineInfo && backNineInfo.error ? backNineInfo.error : ''
        }
      }
    }
  } catch (err) {
    console.error('[OCR] 异常:', err)
    return {
      success: false,
      error: err.message || '识别失败'
    }
  }
}
