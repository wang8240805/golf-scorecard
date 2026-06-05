const ALL_COURSES = require("../data/courses-accurate.js")
const PUBLIC_SCORECARDS = require("../data/public-scorecards.js")
const { mergePublicScorecards, isPlaceholderHoles } = require("./course-scorecard-matcher.js")
const {
  normalizeVisibleCourseName,
  translateCourseName,
  translateLocationText,
  translatePlaceName
} = require("./course-name-translator.js")

const COURSE_CATALOG_VERSION = "catalog-v2-public-scorecard-first"

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
  var baseCourses = (ALL_COURSES || []).map(normalizeBuiltinCourse)
  var mergedCourses = mergeLocalCourses(baseCourses, localCourses || [])
  mergedCourses = mergePublicScorecards(mergedCourses, PUBLIC_SCORECARDS)
  return sortCatalog(dedupeCatalogCourses(mergedCourses.map(enrichCourse)))
}

module.exports = {
  COURSE_CATALOG_VERSION,
  buildCourseCatalog,
  hasStandardPar,
  normalizeCatalogNameKey,
  dedupeCatalogCourses
}
