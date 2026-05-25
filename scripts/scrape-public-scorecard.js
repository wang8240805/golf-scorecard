#!/usr/bin/env node

/**
 * Public scorecard importer proof of concept.
 *
 * This only reads scorecard data embedded in public HTML pages. It is not for
 * private mini-program packages, authenticated APIs, or competitor app traffic.
 */

const fs = require("fs")

const DEFAULT_URL = "https://www.golfify.io/courses/mission-hills-golf-club-shenzhen-els"
const DEFAULT_SITEMAP = "https://www.golfify.io/sitemap.xml"
const CHINA_SLUG_HINTS = [
  "beijing",
  "shanghai",
  "shenzhen",
  "guangzhou",
  "dongguan",
  "zhuhai",
  "foshan",
  "sanya",
  "hainan",
  "haikou",
  "kunming",
  "chengdu",
  "chongqing",
  "wuhan",
  "nanjing",
  "suzhou",
  "hangzhou",
  "tianjin",
  "qingdao",
  "xiamen",
  "dalian",
  "ningbo",
  "mission-hills",
  "agile",
  "lake-malaren",
  "spring-city",
  "sheshan",
  "tomson"
  ,"longxi"
  ,"cbd-international"
  ,"grand-canal"
  ,"yuyang"
  ,"honghua"
  ,"yanxi"
  ,"beyond-champion"
  ,"ibl-golf"
  ,"kangle"
  ,"begonia"
  ,"clearwater-bay"
  ,"the-dunes"
  ,"sheraton"
  ,"sun-valley"
  ,"nanshan"
  ,"foison"
  ,"agile"
  ,"orient"
  ,"silport"
  ,"golden-gulf"
]

function usage() {
  console.log("Usage:")
  console.log("  node scripts/scrape-public-scorecard.js [url] [teeName]")
  console.log("  node scripts/scrape-public-scorecard.js --discover --limit 50 --out reports/public-scorecards.json")
  console.log("  node scripts/scrape-public-scorecard.js --discover --filter \"beijing|shanghai\" --tee White")
}

function getArg(name, fallback) {
  const index = process.argv.indexOf(name)
  if (index < 0 || index + 1 >= process.argv.length) return fallback
  return process.argv[index + 1]
}

function hasArg(name) {
  return process.argv.indexOf(name) >= 0
}

function extractNextData(html) {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)
  if (!match) {
    throw new Error("No __NEXT_DATA__ payload found")
  }
  return JSON.parse(match[1])
}

function normalizeCourse(pageProps, teeName) {
  const course = pageProps.course || {}
  const tees = Array.isArray(pageProps.tees) ? pageProps.tees : []
  if (tees.length === 0) {
    throw new Error("No tee scorecard data found")
  }

  const preferredTee = teeName
    ? tees.find(function(tee) {
      return String(tee.teeName || "").toLowerCase() === String(teeName).toLowerCase()
    })
    : null
  const tee = preferredTee || tees.find(function(item) { return item.teeName === "White" }) || tees[0]
  const holes = Array.isArray(tee.holeInformation) ? tee.holeInformation : []

  if (holes.length < 9 || holes.length > 18) {
    throw new Error("Expected 9-18 holes, got " + holes.length)
  }

  return {
    id: "public-" + String(course.courseId || course.clubId || "unknown").toLowerCase(),
    name: [course.facilityName, course.courseName].filter(Boolean).join(" - "),
    location: [course.city, course.country].filter(Boolean).join(", "),
    source: "public-web",
    sourceUrl: pageProps.slug ? "https://www.golfify.io/courses/" + pageProps.slug : "",
    sourceProvider: "golfify.io",
    sourceMeta: {
      provider: "golfify.io",
      fetchedAt: new Date().toISOString(),
      teeId: tee.teeID || "",
      teeColor: tee.teeColor || "",
      rating: tee.rating || null,
      slope: tee.slope || null,
      totalDistance: tee.totalDistance || 0
    },
    holesVerified: false,
    teeName: tee.teeName || "",
    par: parseInt(tee.courseParForTee || course.par, 10) || holes.reduce(function(sum, hole) {
      return sum + (parseInt(hole.par, 10) || 0)
    }, 0),
    holes: holes.map(function(hole) {
      return {
        hole: parseInt(hole.number, 10),
        par: parseInt(hole.par, 10),
        distance: parseInt(hole.length, 10) || 0,
        handicap: parseInt(hole.si, 10) || 0
      }
    })
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "WinPAR public scorecard importer test/1.0"
    }
  })

  if (!response.ok) {
    throw new Error("Fetch failed: HTTP " + response.status)
  }

  return await response.text()
}

async function scrapeUrl(url, teeName) {
  const html = await fetchText(url)
  const nextData = extractNextData(html)
  const pageProps = nextData.props && nextData.props.pageProps
  if (!pageProps) {
    throw new Error("No pageProps found")
  }
  const normalized = normalizeCourse(pageProps, teeName)
  normalized.sourceUrl = url
  return normalized
}

function isCandidateUrl(url, filterRegex) {
  if (!url.includes("/courses/")) return false
  if (filterRegex) return filterRegex.test(url)
  return CHINA_SLUG_HINTS.some(function(hint) {
    return url.indexOf(hint) >= 0
  })
}

async function discoverUrls(options) {
  const sitemapXml = await fetchText(options.sitemap || DEFAULT_SITEMAP)
  const urls = Array.from(sitemapXml.matchAll(/<loc>(.*?)<\/loc>/g)).map(function(match) {
    return match[1]
  })
  const filterRegex = options.filter ? new RegExp(options.filter, "i") : null
  return urls.filter(function(url) {
    return isCandidateUrl(url, filterRegex)
  })
}

async function scrapeDiscovered(options) {
  const teeName = options.teeName || "White"
  const urls = await discoverUrls(options)
  const limit = Math.max(1, parseInt(options.limit, 10) || 50)
  const selected = urls.slice(0, limit)
  const courses = []
  const errors = []

  for (let i = 0; i < selected.length; i++) {
    const url = selected[i]
    try {
      const course = await scrapeUrl(url, teeName)
      if (course.location.toLowerCase().indexOf("china") >= 0) {
        courses.push(course)
      }
      console.error(`[${i + 1}/${selected.length}] ok ${url}`)
    } catch (err) {
      errors.push({ url: url, error: err.message })
      console.error(`[${i + 1}/${selected.length}] skip ${url}: ${err.message}`)
    }
  }

  const result = {
    generatedAt: new Date().toISOString(),
    source: "public-web",
    provider: "golfify.io",
    sitemap: options.sitemap || DEFAULT_SITEMAP,
    candidateCount: urls.length,
    fetchedCount: selected.length,
    importedCount: courses.length,
    courses: courses,
    errors: errors
  }

  if (options.out) {
    fs.writeFileSync(options.out, JSON.stringify(result, null, 2))
    console.error(`Wrote ${courses.length} courses to ${options.out}`)
  } else {
    console.log(JSON.stringify(result, null, 2))
  }
}

async function main() {
  const arg = process.argv[2]
  if (arg === "-h" || arg === "--help") {
    usage()
    return
  }

  if (hasArg("--discover")) {
    await scrapeDiscovered({
      sitemap: getArg("--sitemap", DEFAULT_SITEMAP),
      filter: getArg("--filter", ""),
      limit: getArg("--limit", "50"),
      out: getArg("--out", ""),
      teeName: getArg("--tee", "White")
    })
    return
  }

  const url = arg || DEFAULT_URL
  const teeName = process.argv[3] || "White"
  const normalized = await scrapeUrl(url, teeName)
  console.log(JSON.stringify(normalized, null, 2))
}

main().catch(function(err) {
  console.error("[scrape-public-scorecard] " + err.message)
  process.exit(1)
})
