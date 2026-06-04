const { calculateDistance } = require("./geo-utils.js")

const MAX_MATCH_DISTANCE = 3000
const AMBIGUOUS_NINE_HOLE_DISTANCE = 600
const CHINESE_NAME_ALIASES = [
  ["北京", "beijing"],
  ["上海", "shanghai"],
  ["深圳", "shenzhen"],
  ["广州", "guangzhou"],
  ["珠海", "zhuhai"],
  ["天津", "tianjin"],
  ["重庆", "chongqing"],
  ["南京", "nanjing"],
  ["苏州", "suzhou"],
  ["杭州", "hangzhou"],
  ["厦门", "xiamen"],
  ["青岛", "qingdao"],
  ["大连", "dalian"],
  ["国际", "international"],
  ["乡村", "country"],
  ["东方", "orient"],
  ["双鹰", "double eagle"],
  ["天星", "tianxing"],
  ["红枫湖", "hongfenghu"],
  ["渔阳", "yuyang"],
  ["君山", "junshan"],
  ["龙熙", "longxi"],
  ["银泰", "yintai"],
  ["鸿华", "honghua"],
  ["华堂", "grandcanal"],
  ["观澜湖", "missionhills"],
  ["佘山", "sheshan"],
  ["汤臣", "tomson"],
  ["滨海", "binhai"],
  ["太阳岛", "sunisland"],
  ["美兰湖", "malaren"],
  ["金鸡湖", "jinjilake"],
  ["九龙山", "jiulong"],
  ["麓山", "grandhill"],
  ["春城", "springcity"],
  ["旭宝", "silport"],
  ["南山", "nanshan"]
]

function cloneCourse(course) {
  var out = {}
  for (var key in course) {
    out[key] = course[key]
  }
  if (Array.isArray(course.holes)) {
    out.holes = cloneHoles(course.holes)
  }
  return out
}

function cloneHoles(holes) {
  return holes.map(function(hole, index) {
    return {
      hole: parseInt(hole.hole || hole.number || index + 1, 10),
      par: parseInt(hole.par, 10) || 4,
      distance: parseInt(hole.distance || hole.length, 10) || 0,
      handicap: parseInt(hole.handicap || hole.si, 10) || index + 1
    }
  })
}

function hasCoordinate(item) {
  return !!item &&
    isFinite(parseFloat(item.latitude)) &&
    isFinite(parseFloat(item.longitude)) &&
    Math.abs(parseFloat(item.latitude)) > 0 &&
    Math.abs(parseFloat(item.longitude)) > 0
}

function validHoles(holes) {
  if (!Array.isArray(holes)) return []
  return holes.filter(function(hole) {
    var par = parseInt(hole && hole.par, 10)
    return par >= 3 && par <= 6
  })
}

function hasUsableHoles(course) {
  return validHoles(course && course.holes).length >= 9
}

function isPlaceholderHoles(course) {
  var holes = validHoles(course && course.holes)
  if (holes.length < 9) return false
  var allZeroDistance = holes.every(function(hole) {
    return !parseInt(hole.distance, 10)
  })
  var allParFour = holes.every(function(hole) {
    return parseInt(hole.par, 10) === 4
  })
  return allZeroDistance && allParFour
}

function shouldKeepCourseHoles(course) {
  if (!course) return false
  if (course.holesVerified === true && hasUsableHoles(course) && !isPlaceholderHoles(course)) {
    return true
  }
  if (course.holesSource === "ocr" || course.holesSource === "manual" || course.holesSource === "user-corrected") {
    return hasUsableHoles(course)
  }
  return false
}

function normalizeName(name) {
  return expandName(name)
    .toLowerCase()
    .replace(/高尔夫|俱乐部|球会|国际|乡村|golf|club|country|course|and|the|resort|international/g, "")
    .replace(/[\s\-·,，.。()（）&]+/g, "")
}

function expandName(name) {
  var expanded = String(name || "")
  CHINESE_NAME_ALIASES.forEach(function(pair) {
    expanded = expanded.replace(new RegExp(pair[0], "g"), " " + pair[1] + " ")
  })
  return expanded
}

function meaningfulNameTokens(name) {
  var stopWords = {
    golf: true,
    club: true,
    course: true,
    country: true,
    international: true,
    resort: true,
    and: true,
    the: true,
    beijing: true,
    shanghai: true,
    shenzhen: true,
    guangzhou: true,
    zhuhai: true,
    tianjin: true,
    chongqing: true,
    nanjing: true,
    suzhou: true,
    hangzhou: true,
    xiamen: true,
    qingdao: true,
    dalian: true
  }
  return expandName(name)
    .toLowerCase()
    .split(/[^a-z0-9\u4e00-\u9fa5]+/)
    .filter(function(token) {
      return token && token.length > 1 && !stopWords[token]
    })
}

function nameScore(courseName, scorecardName) {
  var a = normalizeName(courseName)
  var b = normalizeName(scorecardName)
  if (!a || !b) return 0
  if (a === b && a.length >= 8) return 35
  if (Math.min(a.length, b.length) >= 8 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0)) return 28

  var courseTokens = meaningfulNameTokens(courseName)
  var scorecardTokens = meaningfulNameTokens(scorecardName)
  if (courseTokens.length > 0 && scorecardTokens.length > 0) {
    var overlap = courseTokens.filter(function(token) {
      return scorecardTokens.indexOf(token) >= 0
    }).length
    if (overlap > 0) {
      return Math.round(Math.min(35, overlap / Math.min(courseTokens.length, scorecardTokens.length) * 35))
    }
    return 0
  }
  if (/[a-z]/i.test(expandName(courseName)) && /[a-z]/i.test(expandName(scorecardName))) {
    return 0
  }

  var shortName = a.length < b.length ? a : b
  var longName = a.length < b.length ? b : a
  var common = 0
  for (var i = 0; i < shortName.length; i++) {
    if (longName.indexOf(shortName.charAt(i)) >= 0) common += 1
  }
  return Math.round(Math.min(22, common / Math.max(shortName.length, 1) * 22))
}

function locationScore(course, scorecard) {
  var courseText = [
    course.province,
    course.city,
    course.district,
    course.location
  ].join(" ").toLowerCase()
  var scorecardText = [
    scorecard.city,
    scorecard.location,
    scorecard.country
  ].join(" ").toLowerCase()
  if (!courseText || !scorecardText) return 0
  if (scorecard.city && courseText.indexOf(String(scorecard.city).toLowerCase()) >= 0) return 8
  if (courseText.indexOf("北京") >= 0 && /beijing|shunyi|chaoyang|daxing|fangshan|tongzhou|changping/.test(scorecardText)) return 8
  if (courseText.indexOf("上海") >= 0 && /shanghai/.test(scorecardText)) return 8
  if (courseText.indexOf("深圳") >= 0 && /shenzhen/.test(scorecardText)) return 8
  if (courseText.indexOf("广州") >= 0 && /guangzhou/.test(scorecardText)) return 8
  return 0
}

function matchScore(course, scorecard, distance) {
  var score = 0
  if (distance <= 600) {
    score += 66
  } else if (distance <= 1500) {
    score += 58
  } else if (distance <= MAX_MATCH_DISTANCE) {
    score += 44
  } else {
    return 0
  }
  score += nameScore(course.name, scorecard.name)
  score += locationScore(course, scorecard)
  if (validHoles(scorecard.holes).length >= 18) score += 10
  return score
}

function isAmbiguousNineHole(scorecard, publicScorecards) {
  if (validHoles(scorecard.holes).length >= 18 || !hasCoordinate(scorecard)) return false
  var nearbyCount = publicScorecards.filter(function(other) {
    if (!other || other.id === scorecard.id || !hasCoordinate(other)) return false
    var distance = calculateDistance(
      parseFloat(scorecard.latitude),
      parseFloat(scorecard.longitude),
      parseFloat(other.latitude),
      parseFloat(other.longitude)
    )
    return distance <= AMBIGUOUS_NINE_HOLE_DISTANCE
  }).length
  return nearbyCount > 0
}

function nearbyPublicCount(scorecard, publicScorecards, maxDistance) {
  if (!hasCoordinate(scorecard)) return 0
  return publicScorecards.filter(function(other) {
    if (!other || other.id === scorecard.id || !hasCoordinate(other)) return false
    var distance = calculateDistance(
      parseFloat(scorecard.latitude),
      parseFloat(scorecard.longitude),
      parseFloat(other.latitude),
      parseFloat(other.longitude)
    )
    return distance <= maxDistance
  }).length
}

function findBestScorecard(course, publicScorecards, usedIds) {
  if (!hasCoordinate(course)) return null
  var best = null
  publicScorecards.forEach(function(scorecard) {
    if (!scorecard || usedIds[scorecard.id] || !hasUsableHoles(scorecard) || !hasCoordinate(scorecard)) return
    var distance = calculateDistance(
      parseFloat(course.latitude),
      parseFloat(course.longitude),
      parseFloat(scorecard.latitude),
      parseFloat(scorecard.longitude)
    )
    if (distance > MAX_MATCH_DISTANCE) return
    var scorecardNameScore = nameScore(course.name, scorecard.name)
    if (scorecardNameScore < 18) return
    if (scorecardNameScore < 18 && nearbyPublicCount(scorecard, publicScorecards, 1200) > 0) return
    if (isAmbiguousNineHole(scorecard, publicScorecards) && scorecardNameScore < 18) return

    var score = matchScore(course, scorecard, distance)
    if (!best || score > best.score || (score === best.score && distance < best.distance)) {
      best = {
        scorecard: scorecard,
        score: score,
        distance: distance
      }
    }
  })
  if (!best || best.score < 58) return null
  return best
}

function applyScorecard(course, match) {
  var scorecard = match.scorecard
  var patched = cloneCourse(course)
  patched.holes = cloneHoles(scorecard.holes)
  patched.par = parseInt(scorecard.par, 10) || patched.holes.reduce(function(sum, hole) {
    return sum + hole.par
  }, 0)
  patched.totalPar = patched.par
  patched.holesVerified = false
  patched.holesSource = "public-web"
  patched.holesSourceTrust = "candidate"
  patched.holesTeeName = scorecard.teeName || ""
  patched.matchedPublicScorecardId = scorecard.id
  patched.publicScorecardName = scorecard.name
  patched.publicScorecardUrl = scorecard.sourceUrl
  patched.publicMatchDistance = Math.round(match.distance)
  patched.publicMatchScore = match.score
  patched.holesSourceMeta = scorecard.sourceMeta || {}
  return patched
}

function makePublicCourse(scorecard) {
  var course = cloneCourse(scorecard)
  course.id = scorecard.id
  course.par = parseInt(scorecard.par, 10) || validHoles(scorecard.holes).reduce(function(sum, hole) {
    return sum + parseInt(hole.par, 10)
  }, 0)
  course.totalPar = course.par
  course.holes = cloneHoles(scorecard.holes)
  course.holesVerified = false
  course.holesSource = "public-web"
  course.holesSourceTrust = "candidate"
  course.holesTeeName = scorecard.teeName || ""
  course.isPublicScorecard = true
  course.publicScorecardName = scorecard.name
  course.publicScorecardUrl = scorecard.sourceUrl
  course.province = course.province || inferProvince(scorecard)
  course.city = course.city || scorecard.city || course.province || ""
  return course
}

function inferProvince(scorecard) {
  var id = String(scorecard.id || "")
  var idProvinceMap = {
    bj: "北京",
    sh: "上海",
    gd: "广东",
    hi: "海南",
    js: "江苏",
    zj: "浙江",
    sd: "山东",
    fj: "福建",
    tj: "天津",
    cq: "重庆",
    sc: "四川",
    yn: "云南",
    hb: "湖北",
    ln: "辽宁",
    he: "河北"
  }
  var idMatch = id.match(/^public-chn-([a-z]{2})-/)
  if (idMatch && idProvinceMap[idMatch[1]]) return idProvinceMap[idMatch[1]]

  var text = [
    scorecard.name,
    scorecard.location,
    scorecard.city,
    scorecard.sourceUrl
  ].join(" ").toLowerCase()
  if (/beijing|shunyi|chaoyang|daxing|fangshan|tongzhou|changping/.test(text)) return "北京"
  if (/shanghai/.test(text)) return "上海"
  if (/shenzhen|dongguan|guangzhou|zhuhai|foshan/.test(text)) return "广东"
  if (/sanya|haikou|hainan/.test(text)) return "海南"
  if (/nanjing|suzhou|yangzhou/.test(text)) return "江苏"
  if (/hangzhou|ningbo|wenzhou/.test(text)) return "浙江"
  if (/qingdao|nanshan/.test(text)) return "山东"
  if (/xiamen|fujian/.test(text)) return "福建"
  if (/tianjin/.test(text)) return "天津"
  if (/chongqing/.test(text)) return "重庆"
  if (/chengdu/.test(text)) return "四川"
  if (/kunming|yunnan/.test(text)) return "云南"
  if (/wuhan/.test(text)) return "湖北"
  if (/dalian/.test(text)) return "辽宁"
  return ""
}

function mergePublicScorecards(courses, publicScorecards) {
  var scorecards = Array.isArray(publicScorecards) ? publicScorecards : []
  var usedIds = {}
  var courseIds = {}
  var merged = (Array.isArray(courses) ? courses : []).map(function(course) {
    if (!course || !course.id) return course
    courseIds[course.id] = true
    if (course.isCustom || course.isPublicScorecard || shouldKeepCourseHoles(course)) {
      return course
    }
    var match = findBestScorecard(course, scorecards, usedIds)
    if (!match) return course
    usedIds[match.scorecard.id] = true
    return applyScorecard(course, match)
  })

  scorecards.forEach(function(scorecard) {
    if (!scorecard || !scorecard.id || usedIds[scorecard.id] || courseIds[scorecard.id]) return
    if (!hasUsableHoles(scorecard) || !hasCoordinate(scorecard)) return
    merged.push(makePublicCourse(scorecard))
    courseIds[scorecard.id] = true
  })

  return merged
}

module.exports = {
  mergePublicScorecards,
  findBestScorecard,
  isPlaceholderHoles
}
