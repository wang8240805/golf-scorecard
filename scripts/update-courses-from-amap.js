const fs = require('fs')
const path = require('path')
const https = require('https')
const { execSync } = require('child_process')

const DATA_FILE = path.join(__dirname, '..', 'data', 'courses-accurate.js')
const AMAP_KEY = process.env.AMAP_WEB_KEY || 'dbed49028a00db65170a3aaba16364fa'

const REGIONS = [
  '北京', '上海', '天津', '重庆', '河北', '山西', '辽宁', '吉林', '黑龙江',
  '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南', '湖北', '湖南',
  '广东', '海南', '四川', '贵州', '云南', '陕西', '甘肃', '青海', '内蒙古',
  '广西', '西藏', '宁夏', '新疆', '香港', '澳门', '台湾'
]
const KEYWORDS = ['高尔夫俱乐部', '高尔夫球场', '高尔夫']
const PAGE_SIZE = 25
const MAX_PAGE = 6
const REQUEST_GAP_MS = 140

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(raw || '{}')) } catch (e) { reject(e) }
      })
    })
    req.on('error', reject)
    req.setTimeout(12000, () => req.destroy(new Error('Request timeout')))
  })
}

function buildUrl(params) {
  const u = new URL('https://restapi.amap.com/v3/place/text')
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v))
  })
  return u.toString()
}

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）·•]/g, '')
    .replace(/高尔夫(球场|俱乐部|练习场)?/g, '高尔夫')
    .replace(/国际/g, '')
    .replace(/乡村/g, '')
    .trim()
}

function parsePoi(poi) {
  if (!poi || !poi.id || !poi.name || !poi.location) return null
  const loc = String(poi.location).split(',')
  if (loc.length !== 2) return null
  const lng = parseFloat(loc[0])
  const lat = parseFloat(loc[1])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return {
    sourceId: poi.id,
    name: poi.name,
    location: poi.address || `${poi.pname || ''}${poi.cityname || ''}${poi.adname || ''}`,
    province: poi.pname || '',
    city: poi.cityname || '',
    district: poi.adname || '',
    latitude: lat,
    longitude: lng,
    tel: poi.tel || ''
  }
}

function isLikelyGolfCourse(name) {
  const n = String(name || '')
  if (!/高尔夫|golf/i.test(n)) return false
  const strong = /(高尔夫球场|高尔夫球会|高尔夫俱乐部|高尔夫乡村俱乐部|乡村俱乐部)/i.test(n)
  const bad = /(学院|练习场|练习馆|室内|培训|教学|工作室|体验馆|模拟器|golfzon|golf\\s*park|店|超市|便利店|酒店|公寓|大厦|写字楼|公司|会所|宴会厅|科技|中心|办公|售楼|学校|幼儿园|台球|健身|咖啡|庄园|花园|别墅|组团|号楼|单元|物业|工程部)/i.test(n)
  if (bad) return false
  return strong
}

function defaultHoles() {
  const holes = []
  for (let i = 1; i <= 18; i++) holes.push({ hole: i, par: 4, distance: 0, handicap: i })
  return holes
}

function loadBaselineCourses() {
  try {
    const raw = execSync('git show HEAD:data/courses-accurate.js', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    const tmp = path.join(__dirname, '.tmp-courses-baseline.js')
    fs.writeFileSync(tmp, raw, 'utf8')
    delete require.cache[require.resolve(tmp)]
    const list = require(tmp)
    fs.unlinkSync(tmp)
    if (Array.isArray(list) && list.length > 0) return list
  } catch (e) {}

  delete require.cache[require.resolve(DATA_FILE)]
  const local = require(DATA_FILE)
  return Array.isArray(local) ? local : []
}

async function fetchWithRetry(url, retries) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await requestJson(url)
      if (String(res.status) === '1') return res
      const info = String(res.info || '')
      if (info.indexOf('CUQPS_HAS_EXCEEDED_THE_LIMIT') >= 0 && i < retries) {
        await sleep(500 + i * 500)
        continue
      }
      return res
    } catch (err) {
      if (i < retries) {
        await sleep(500 + i * 500)
        continue
      }
      return { status: '0', info: err.message || 'request failed', pois: [] }
    }
  }
  return { status: '0', info: 'retry failed', pois: [] }
}

async function fetchAllPois() {
  const pois = []
  let reqCount = 0
  const totalReq = REGIONS.length * KEYWORDS.length * MAX_PAGE

  for (const region of REGIONS) {
    for (const keyword of KEYWORDS) {
      for (let page = 1; page <= MAX_PAGE; page++) {
        const url = buildUrl({
          key: AMAP_KEY,
          keywords: keyword,
          city: region,
          citylimit: 'false',
          offset: PAGE_SIZE,
          page,
          extensions: 'base'
        })
        const res = await fetchWithRetry(url, 3)
        reqCount++
        if (reqCount % 50 === 0) console.log(`Progress requests: ${reqCount}/${totalReq}`)

        if (String(res.status) !== '1') continue
        const list = Array.isArray(res.pois) ? res.pois : []
        if (list.length === 0) break

        list.forEach((p) => {
          const parsed = parsePoi(p)
          if (parsed && isLikelyGolfCourse(parsed.name)) pois.push(parsed)
        })

        await sleep(REQUEST_GAP_MS)
      }
    }
  }

  return pois
}

function mergeCourses(base, fetched) {
  function normalizeName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[()（）·•]/g, '')
      .replace(/国际/g, '')
      .replace(/高尔夫球场/g, '高尔夫')
      .replace(/高尔夫球会/g, '高尔夫')
      .replace(/高尔夫俱乐部/g, '高尔夫')
      .replace(/高尔夫乡村俱乐部/g, '高尔夫')
      .replace(/乡村俱乐部/g, '高尔夫')
  }
  const bySourceId = new Map()
  const byNormName = new Map()
  base.forEach((c) => {
    if (c && c.sourceId) bySourceId.set(c.sourceId, c)
    const n = normalizeName(c && c.name)
    if (n && !byNormName.has(n)) byNormName.set(n, c)
  })

  const fetchedMap = new Map()
  fetched.forEach((p) => { if (p && p.sourceId) fetchedMap.set(p.sourceId, p) })

  const merged = []
  const idSet = new Set()

  // 基线全保留
  base.forEach((c) => {
    if (!c || !c.id || idSet.has(c.id)) return
    merged.push(c)
    idSet.add(c.id)
  })

  let updated = 0
  let added = 0

  fetchedMap.forEach((poi) => {
    const match = bySourceId.get(poi.sourceId) || byNormName.get(normalizeName(poi.name)) || null
    if (match) {
      const idx = merged.findIndex((x) => x.id === match.id)
      if (idx >= 0) {
        const baseItem = merged[idx]
        merged[idx] = {
          ...baseItem,
          location: baseItem.location || poi.location,
          province: poi.province || baseItem.province || '',
          city: poi.city || baseItem.city || '',
          district: poi.district || baseItem.district || '',
          latitude: poi.latitude || baseItem.latitude || 0,
          longitude: poi.longitude || baseItem.longitude || 0,
          source: baseItem.source || 'amap-poi',
          sourceId: baseItem.sourceId || poi.sourceId,
          tel: baseItem.tel || poi.tel || ''
        }
        updated++
      }
      return
    }

    const id = `amap-${poi.sourceId}`
    if (idSet.has(id)) return
    const holes = defaultHoles()
    merged.push({
      id,
      name: poi.name,
      location: poi.location || `${poi.province}${poi.city}`,
      province: poi.province || '',
      city: poi.city || '',
      district: poi.district || '',
      latitude: poi.latitude,
      longitude: poi.longitude,
      par: 72,
      totalPar: 72,
      holes,
      holesVerified: false,
      source: 'amap-poi',
      sourceId: poi.sourceId,
      tel: poi.tel || ''
    })
    idSet.add(id)
    added++
  })

  const dedupMap = new Map()
  merged.forEach((c) => {
    const key = `${c.province || ''}|${c.city || ''}|${normalizeName(c.name)}`
    const prev = dedupMap.get(key)
    if (!prev) {
      dedupMap.set(key, c)
      return
    }
    const score = (x) => (x.holesVerified ? 100 : 0) + (x.sourceId ? 10 : 0) + String(x.name || '').length
    if (score(c) > score(prev)) dedupMap.set(key, c)
  })
  const deduped = Array.from(dedupMap.values())

  deduped.sort((a, b) => {
    const an = `${a.province || ''}-${a.city || ''}-${a.name || ''}`
    const bn = `${b.province || ''}-${b.city || ''}-${b.name || ''}`
    return an.localeCompare(bn, 'zh-CN')
  })

  return { merged: deduped, updated, added, fetchedUniqueCount: fetchedMap.size }
}

function writeCoursesFile(courses) {
  const content = 'const CHINA_COURSES = ' + JSON.stringify(courses) + ';\nmodule.exports = CHINA_COURSES;\n'
  fs.writeFileSync(DATA_FILE, content, 'utf8')
}

async function main() {
  const base = loadBaselineCourses()
  console.log(`Baseline courses: ${base.length}`)

  const fetched = await fetchAllPois()
  console.log(`Fetched filtered POIs: ${fetched.length}`)

  const { merged, updated, added, fetchedUniqueCount } = mergeCourses(base, fetched)
  writeCoursesFile(merged)

  const provinceSet = new Set(merged.map((c) => c.province).filter(Boolean))
  console.log('Done!')
  console.log(`Fetched unique POIs: ${fetchedUniqueCount}`)
  console.log(`Updated existing: ${updated}`)
  console.log(`Added new: ${added}`)
  console.log(`Total courses: ${merged.length}`)
  console.log(`Province coverage: ${provinceSet.size}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
