const PUBLIC_SCORECARDS_PARTS = [
  require('./public-scorecards-part1.js'),
  require('./public-scorecards-part2.js')
]

module.exports = [].concat.apply([], PUBLIC_SCORECARDS_PARTS)
