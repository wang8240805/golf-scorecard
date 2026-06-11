const ALL_COURSES = require("../data/courses-accurate.js")
const PUBLIC_SCORECARDS = require("../data/public-scorecards.js")
const { mergePublicScorecards, isPlaceholderHoles } = require("./course-scorecard-matcher.js")
const {
  normalizeVisibleCourseName,
  translateCourseName,
  translateLocationText,
  translatePlaceName
} = require("./course-name-translator.js")

const COURSE_CATALOG_VERSION = "catalog-v4-course-audit-dedupe"
const EXCLUDED_AMAP_COURSE_IDS = {
  "amap-B0JRCZ5VU9": true,
  "amap-B0KRT5T3OB": true,
  "amap-B0LBT539LA": true,
  "amap-B0FFJQPOWG": true,
  "amap-B0KKOC2DYI": true,
  "amap-B0IRODXBJE": true,
  "amap-B0K03AY86Q": true,
  "amap-B0K2LM3LYV": true,
  "amap-B0IKUC9QOE": true,
  "amap-B013C0HX2E": true,
  "amap-B0KDXBYXUC": true,
  "amap-B0LROCWTOM": true,
  "amap-B0LGFCLYPT": true,
  "amap-B0LGTCYH1T": true,
  "amap-B0LKX7P2X6": true,
  "amap-B0K1ZC30W4": true,
  "amap-B0LD9UY12K": true,
  "amap-B0IUPR8GKY": true,
  "amap-B0JKTRAZK9": true,
  "amap-B0HD0DYYEC": true,
  "amap-B0KRO7TNYL": true,
  "amap-B00160DTJ0": true,
  "amap-B0H2OSCOD7": true,
  "amap-B0LAXH3NZG": true,
  "amap-B0LDLMH6V6": true,
  "amap-B03670YL97": true,
  "amap-B0KBLZ15NZ": true
}
const GENERIC_DEDUP_NAMES = {
  "北京": true,
  "上海": true,
  "天津": true,
  "重庆": true,
  "广州": true,
  "深圳": true,
  "南山": true,
  "阳光": true,
  "东方": true,
  "西郊": true,
  "新东阳": true
}
const LOCATION_PREFIX_NAMES = [
  "北京", "上海", "天津", "重庆",
  "河北", "山西", "辽宁", "吉林", "黑龙江",
  "江苏", "浙江", "安徽", "福建", "江西", "山东",
  "河南", "湖北", "湖南", "广东", "海南",
  "四川", "贵州", "云南", "陕西", "甘肃", "青海",
  "台湾", "内蒙古", "广西", "宁夏", "新疆", "西藏",
  "香港", "澳门",
  "广州", "深圳", "东莞", "珠海", "杭州", "南京",
  "苏州", "厦门", "青岛", "大连", "昆明", "武汉",
  "成都", "通州", "昌平", "顺义", "朝阳", "房山"
]
const MANUAL_DEDUP_GROUPS = [
  [
    "public-chn-js-0003-02",
    "public-chn-sh-0017-02"
  ]
]
const NEARBY_DEDUP_DISTANCE_METERS = 1500

function cloneCourse(course) {
  var out = {}
  for (var key in course) {
    out[key] = course[key]
  }
  if (Array.isArray(course.holes)) {
    out.holes = course.holes.map(function(hole) {
      var nextHole = {}
      for (var holeKey in hole) {
        nextHole[holeKey] = hole[holeKey]
      }
      return nextHole
    })
  }
  return out
}

function normalizeBuiltinCourse(course) {
  var newCourse = cloneCourse(course)
  if (!newCourse.holesVerified) {
    if (isPlaceholderHoles(newCourse)) {
      newCourse.holes = null
    } else if (Array.isArray(newCourse.holes) && newCourse.holes.length >= 9) {
      newCourse.holesSource = newCourse.holesSource || "builtin-candidate"
    }
    newCourse.holesVerified = false
  }
  return newCourse
}

function validHoles(course) {
  if (!course || !Array.isArray(course.holes)) return []
  return course.holes.filter(function(hole) {
    var par = parseInt(hole && hole.par, 10)
    return par >= 3 && par <= 6
  })
}

function hasStandardPar(course) {
  return validHoles(course).length >= 9 && !isPlaceholderHoles(course)
}

function hasUserVerifiedCourseData(course) {
  return !!course && (
    course.isCustom ||
    course.holesVerified === true ||
    course.holesSource === "manual" ||
    course.holesSource === "ocr" ||
    course.holesSource === "user-corrected"
  )
}

function hasCoordinate(course) {
  return !!course &&
    isFinite(parseFloat(course.latitude)) &&
    isFinite(parseFloat(course.longitude))
}

function getDistanceMeters(a, b) {
  if (!hasCoordinate(a) || !hasCoordinate(b)) return Infinity
  var lat1 = parseFloat(a.latitude) * Math.PI / 180
  var lat2 = parseFloat(b.latitude) * Math.PI / 180
  var dLat = lat2 - lat1
  var dLng = (parseFloat(b.longitude) - parseFloat(a.longitude)) * Math.PI / 180
  var sinLat = Math.sin(dLat / 2)
  var sinLng = Math.sin(dLng / 2)
  var h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

function normalizeLocationName(value) {
  var name = String(value || "").trim().replace(/\s+/g, "")
  if (!name) return ""
  return name
    .replace(/特别行政区$/, "")
    .replace(/壮族自治区$/, "")
    .replace(/回族自治区$/, "")
    .replace(/维吾尔自治区$/, "")
    .replace(/自治区$/, "")
    .replace(/[省市区县]$/, "")
}

function collectLocationPrefixNames(course) {
  var names = []
  function add(value) {
    var name = normalizeLocationName(value)
    if (name && names.indexOf(name) < 0) names.push(name)
  }
  add(course && course.province)
  add(course && course.city)
  add(course && course.district)
  LOCATION_PREFIX_NAMES.forEach(add)
  return names.sort(function(a, b) {
    return b.length - a.length
  })
}

function isGenericDedupName(name) {
  if (!name || name.length < 2) return true
  return GENERIC_DEDUP_NAMES[name] === true
}

function getNormalizedDedupName(course) {
  var nameKey = normalizeCatalogNameKey(course && course.name)
  if (!nameKey) return ""
  var prefixes = collectLocationPrefixNames(course)
  for (var i = 0; i < prefixes.length; i += 1) {
    var prefix = prefixes[i]
    if (nameKey.indexOf(prefix) !== 0) continue
    var stripped = nameKey.slice(prefix.length)
    if (stripped.length >= 2) {
      return stripped
    }
  }
  return nameKey
}

function isWeakAmapRecord(course) {
  return !!course &&
    course.source === "amap-poi" &&
    !hasUserVerifiedCourseData(course) &&
    !hasStandardPar(course)
}

function getCourseExclusionReason(course) {
  if (!course || course.source !== "amap-poi") return ""
  if (hasUserVerifiedCourseData(course) || hasStandardPar(course)) return ""
  if (EXCLUDED_AMAP_COURSE_IDS[course.id] === true) return "confirmed-non-course-poi"

  var name = String(course.name || "")
  var location = String(course.location || course.address || "")
  var text = [name, location].join(" ")
  var score = 0
  var reason = ""

  if (/练习场|训练|教学|培训|青少年|学院/.test(text)) {
    score += 3
    reason = "suspected-practice-range"
  }
  if (/室内|模拟|包房|负一|B1|b1|KTV|ktv/.test(text)) {
    score += 3
    reason = "suspected-indoor-simulator"
  }
  if (/商务楼|商厦|商业区|商场|购物中心|产业园|体育馆|运动中心/.test(location)) {
    score += 2
    if (!reason) reason = "suspected-indoor-simulator"
  }
  if (/后勤基地|营销中心|接待中心|码头/.test(text)) {
    score += 2
    if (!reason) reason = "suspected-non-course-poi"
  }
  if (/(AI|ai|智能)/.test(name) && /高尔夫/.test(name)) {
    score += 2
    if (!reason) reason = "suspected-indoor-simulator"
  }

  return score >= 3 ? reason : ""
}

function isExcludedBuiltinCourse(course) {
  return getCourseExclusionReason(course) !== ""
}

function shouldPreserveLocalOnly(course) {
  return !!course && !!course.id && (
    course.isCustom ||
    course.isPublicScorecard ||
    course.holesVerified === true ||
    course.holesSource === "manual" ||
    course.holesSource === "ocr" ||
    course.holesSource === "user-corrected"
  )
}

function mergeLocalCourses(baseCourses, localCourses) {
  var localMap = {}
  ;(localCourses || []).forEach(function(course) {
    if (course && course.id) {
      localMap[course.id] = course
    }
  })

  var merged = baseCourses.map(function(course) {
    var localCourse = localMap[course.id]
    if (!localCourse) return course
    return {
      ...course,
      ...localCourse
    }
  })

  ;(localCourses || []).forEach(function(course) {
    if (!shouldPreserveLocalOnly(course)) return
    var exists = merged.find(function(item) { return item.id === course.id })
    if (!exists) {
      merged.push(course)
    }
  })

  return merged
}

function buildSearchAliases(course) {
  var aliases = []
  function add(value) {
    if (!value) return
    var text = String(value)
    if (aliases.indexOf(text) < 0) aliases.push(text)
  }
  add(course.name)
  add(course.location)
  add(course.city)
  add(course.province)
  add(course.publicScorecardName)
  add(course.sourceUrl)
  add(course.publicScorecardUrl)
  add(course.englishName)
  if (Array.isArray(course.aliases)) {
    course.aliases.forEach(add)
  }
  return aliases
}

function getCourseDataQuality(course) {
  if (course.holesVerified === true && hasStandardPar(course)) return "verified"
  if (course.holesSource === "manual" && hasStandardPar(course)) return "manual"
  if (course.holesSource === "ocr" && hasStandardPar(course)) return "ocr"
  if (course.holesSource === "public-web" && hasStandardPar(course)) return "public_candidate"
  if (hasStandardPar(course)) return "builtin_candidate"
  return "missing"
}

function getCatalogRank(course) {
  var quality = getCourseDataQuality(course)
  if (course.isFavorite) return 10
  if (quality === "verified" || quality === "manual" || quality === "ocr") return 20
  if (course.holesSource === "public-web" && !course.isPublicScorecard) return 30
  if (course.isPublicScorecard) return 40
  if (quality === "builtin_candidate") return 50
  if (course.isCustom) return 60
  return 90
}

function normalizeCatalogNameKey(name) {
  return normalizeVisibleCourseName(name)
    .replace(/[-－—–].*$/, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/(高尔夫|俱乐部|球会|国际|乡村|golf|club|country|course|international)/ig, "")
    .replace(/[\s·,，.。()（）&/]+/g, "")
    .toLowerCase()
}

function getDedupLocationKey(course) {
  return [
    course.province || "",
    course.city || "",
    course.district || ""
  ].join("|").toLowerCase()
}

function getCourseDedupKey(course) {
  var nameKey = normalizeCatalogNameKey(course && course.name)
  if (!nameKey) return ""
  return nameKey + "|" + getDedupLocationKey(course)
}

function shouldMergeNearbySameName(existing, candidate) {
  return shouldMergeCourseRecords(existing, candidate)
}

function hasCompatibleAdministrativeArea(existing, candidate) {
  var existingCity = normalizeLocationName(existing && existing.city)
  var candidateCity = normalizeLocationName(candidate && candidate.city)
  if (!existingCity || !candidateCity || existingCity === candidateCity) return true
  return isWeakAmapRecord(existing) || isWeakAmapRecord(candidate)
}

function shouldMergeCourseRecords(existing, candidate) {
  var existingNameKey = getNormalizedDedupName(existing)
  var candidateNameKey = getNormalizedDedupName(candidate)
  if (isGenericDedupName(existingNameKey) || isGenericDedupName(candidateNameKey)) return false

  var shorter = existingNameKey.length < candidateNameKey.length ? existingNameKey : candidateNameKey
  var longer = existingNameKey.length < candidateNameKey.length ? candidateNameKey : existingNameKey
  var nameMatched = existingNameKey === candidateNameKey || (
    shorter.length >= 3 && longer.indexOf(shorter) >= 0
  )
  if (!nameMatched) return false
  if (getDistanceMeters(existing, candidate) > NEARBY_DEDUP_DISTANCE_METERS) return false
  if (!hasCompatibleAdministrativeArea(existing, candidate)) return false
  return true
}

function dedupeNearbySameNameCourses(courses) {
  var result = []

  ;(courses || []).forEach(function(course) {
    var index = result.findIndex(function(existing) {
      return shouldMergeNearbySameName(existing, course)
    })
    if (index < 0) {
      result.push(course)
      return
    }
    result[index] = mergeDuplicateCourse(result[index], course)
  })

  return result
}

function getManualDedupGroupId(course) {
  if (!course || !course.id) return ""
  for (var i = 0; i < MANUAL_DEDUP_GROUPS.length; i += 1) {
    if (MANUAL_DEDUP_GROUPS[i].indexOf(course.id) >= 0) {
      return "manual-" + i
    }
  }
  return ""
}

function dedupeManualGroups(courses) {
  var byGroup = {}
  var result = []

  ;(courses || []).forEach(function(course) {
    var groupId = getManualDedupGroupId(course)
    if (!groupId) {
      result.push(course)
      return
    }
    if (!byGroup[groupId]) {
      byGroup[groupId] = course
      result.push(course)
      return
    }

    var merged = mergeDuplicateCourse(byGroup[groupId], course)
    byGroup[groupId] = merged
    var index = result.findIndex(function(item) {
      return getManualDedupGroupId(item) === groupId
    })
    if (index >= 0) {
      result[index] = merged
    }
  })

  return result
}

function getDedupScore(course) {
  var score = 0
  score += (100 - (course.catalogRank || 90)) * 100
  if (course.holesVerified === true) score += 800
  if (course.hasStandardPar) score += 400
  if (course.holesSource === "public-web") score += 200
  if (Array.isArray(course.holes)) score += Math.min(course.holes.length, 18) * 10
  if (course.totalPar >= 68 && course.totalPar <= 74) score += 50
  if (course.isPublicScorecard) score += 20
  return score
}

function mergeAliases(target, duplicate) {
  var aliases = []
  function add(value) {
    if (!value) return
    var text = String(value)
    if (aliases.indexOf(text) < 0) aliases.push(text)
  }
  ;(target.searchAliases || []).forEach(add)
  ;(duplicate.searchAliases || []).forEach(add)
  add(duplicate.name)
  add(duplicate.englishName)
  add(duplicate.publicScorecardName)
  add(duplicate.publicScorecardChineseName)
  target.searchAliases = aliases
}

function mergeDuplicateCourse(existing, candidate) {
  var winner = getDedupScore(candidate) > getDedupScore(existing) ? candidate : existing
  var duplicate = winner === candidate ? existing : candidate
  var merged = cloneCourse(winner)
  mergeAliases(merged, duplicate)
  merged.duplicateCourseIds = []
  ;(winner.duplicateCourseIds || []).forEach(function(id) {
    if (id && merged.duplicateCourseIds.indexOf(id) < 0) merged.duplicateCourseIds.push(id)
  })
  ;(duplicate.duplicateCourseIds || []).forEach(function(id) {
    if (id && merged.duplicateCourseIds.indexOf(id) < 0) merged.duplicateCourseIds.push(id)
  })
  if (duplicate.id && merged.duplicateCourseIds.indexOf(duplicate.id) < 0) {
    merged.duplicateCourseIds.push(duplicate.id)
  }
  return merged
}

function dedupeCatalogCourses(courses) {
  var byKey = {}
  var result = []

  ;(courses || []).forEach(function(course) {
    var key = getCourseDedupKey(course)
    if (!key) {
      result.push(course)
      return
    }

    if (!byKey[key]) {
      byKey[key] = course
      result.push(course)
      return
    }

    var merged = mergeDuplicateCourse(byKey[key], course)
    byKey[key] = merged
    var index = result.findIndex(function(item) {
      return getCourseDedupKey(item) === key
    })
    if (index >= 0) {
      result[index] = merged
    }
  })

  return result
}

function enrichCourse(course) {
  var enriched = cloneCourse(course)
  if ((enriched.isPublicScorecard || enriched.holesSource === "public-web") && /[A-Za-z]/.test(String(enriched.name || ""))) {
    enriched.englishName = enriched.englishName || enriched.name
    enriched.name = translateCourseName(enriched.name)
  }
  enriched.name = normalizeVisibleCourseName(enriched.name)
  if ((enriched.isPublicScorecard || enriched.holesSource === "public-web") && /[A-Za-z]/.test(String(enriched.location || ""))) {
    enriched.englishLocation = enriched.englishLocation || enriched.location
    enriched.location = translateLocationText(enriched.location)
  }
  if ((enriched.isPublicScorecard || enriched.holesSource === "public-web") && /[A-Za-z]/.test(String(enriched.city || ""))) {
    enriched.englishCity = enriched.englishCity || enriched.city
    enriched.city = translatePlaceName(enriched.city)
  }
  if (enriched.publicScorecardName && /[A-Za-z]/.test(String(enriched.publicScorecardName))) {
    enriched.publicScorecardChineseName = translateCourseName(enriched.publicScorecardName)
  }
  var holes = validHoles(enriched)
  enriched.hasStandardPar = holes.length >= 9
  enriched.courseDataQuality = getCourseDataQuality(enriched)
  enriched.catalogRank = getCatalogRank(enriched)
  enriched.searchAliases = buildSearchAliases(enriched)
  if (!enriched.totalPar && holes.length > 0) {
    enriched.totalPar = holes.reduce(function(sum, hole) {
      return sum + (parseInt(hole.par, 10) || 0)
    }, 0)
  }
  return enriched
}

function sortCatalog(courses) {
  return courses.slice().sort(function(a, b) {
    if ((a.catalogRank || 90) !== (b.catalogRank || 90)) {
      return (a.catalogRank || 90) - (b.catalogRank || 90)
    }
    if ((b.playCount || 0) !== (a.playCount || 0)) {
      return (b.playCount || 0) - (a.playCount || 0)
    }
    return String(a.name || "").localeCompare(String(b.name || ""), "zh-CN")
  })
}

function buildCourseCatalog(localCourses) {
  var baseCourses = (ALL_COURSES || []).filter(function(course) {
    return !isExcludedBuiltinCourse(course)
  }).map(normalizeBuiltinCourse)
  var mergedCourses = mergeLocalCourses(baseCourses, localCourses || [])
  mergedCourses = mergePublicScorecards(mergedCourses, PUBLIC_SCORECARDS)
  var catalog = dedupeCatalogCourses(mergedCourses.map(enrichCourse))
  catalog = dedupeNearbySameNameCourses(catalog)
  catalog = dedupeManualGroups(catalog)
  return sortCatalog(catalog)
}

module.exports = {
  COURSE_CATALOG_VERSION,
  buildCourseCatalog,
  getCourseExclusionReason,
  getNormalizedDedupName,
  hasStandardPar,
  isExcludedBuiltinCourse,
  normalizeCatalogNameKey,
  shouldMergeCourseRecords,
  dedupeCatalogCourses
}
