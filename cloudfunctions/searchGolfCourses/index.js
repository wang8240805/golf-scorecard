const cloud = require('wx-server-sdk')
const https = require('https')
const { URL } = require('url')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

function requestJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      let raw = ''
      res.on('data', (chunk) => { raw += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(raw || '{}')
          resolve(json)
        } catch (err) {
          reject(new Error('解析地图服务响应失败'))
        }
      })
    })
    req.on('error', (err) => reject(err))
    req.setTimeout(8000, () => {
      req.destroy(new Error('地图服务请求超时'))
    })
  })
}

function buildAmapUrl(path, params) {
  const url = new URL(`https://restapi.amap.com${path}`)
  Object.keys(params).forEach((k) => {
    if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
      url.searchParams.set(k, params[k])
    }
  })
  return url.toString()
}

function parsePoi(poi) {
  if (!poi || !poi.id || !poi.name || !poi.location) return null
  const loc = String(poi.location).split(',')
  if (loc.length !== 2) return null
  const lng = parseFloat(loc[0])
  const lat = parseFloat(loc[1])
  if (!isFinite(lng) || !isFinite(lat)) return null

  return {
    source: 'amap',
    sourceId: poi.id,
    name: poi.name,
    location: poi.address || `${poi.pname || ''}${poi.cityname || ''}${poi.adname || ''}`,
    province: poi.pname || '',
    city: poi.cityname || '',
    district: poi.adname || '',
    address: poi.address || '',
    latitude: lat,
    longitude: lng,
    tel: poi.tel || '',
    type: poi.type || ''
  }
}

function dedupePois(items) {
  const map = new Map()
  items.forEach((item) => {
    if (!item || !item.sourceId) return
    map.set(item.sourceId, item)
  })
  return Array.from(map.values())
}

exports.main = async (event) => {
  const amapKey = process.env.AMAP_WEB_KEY || 'dbed49028a00db65170a3aaba16364fa'
  if (!amapKey) {
    return {
      success: false,
      error: 'AMAP_WEB_KEY 未配置'
    }
  }

  const keyword = (event.keyword || '高尔夫球场').trim()
  const city = (event.city || '').trim()
  const location = event.location || null
  const pageSize = Math.max(10, Math.min(parseInt(event.pageSize, 10) || 20, 25))

  try {
    const tasks = []

    if (location && isFinite(location.latitude) && isFinite(location.longitude)) {
      const aroundUrl = buildAmapUrl('/v3/place/around', {
        key: amapKey,
        location: `${location.longitude},${location.latitude}`,
        keywords: keyword,
        radius: 50000,
        sortrule: 'distance',
        offset: pageSize,
        page: 1,
        extensions: 'base'
      })
      tasks.push(requestJson(aroundUrl))
    }

    const textUrl = buildAmapUrl('/v3/place/text', {
      key: amapKey,
      keywords: keyword,
      city: city,
      citylimit: city ? 'true' : undefined,
      offset: pageSize,
      page: 1,
      extensions: 'base'
    })
    tasks.push(requestJson(textUrl))

    const responses = await Promise.all(tasks)
    const allPois = []
    responses.forEach((res) => {
      if (String(res.status) !== '1') return
      const pois = Array.isArray(res.pois) ? res.pois : []
      pois.forEach((p) => {
        const parsed = parsePoi(p)
        if (parsed) allPois.push(parsed)
      })
    })

    const unique = dedupePois(allPois)

    return {
      success: true,
      keyword,
      city,
      count: unique.length,
      data: unique
    }
  } catch (err) {
    console.error('[searchGolfCourses] error:', err)
    return {
      success: false,
      error: err.message || '在线检索失败'
    }
  }
}
