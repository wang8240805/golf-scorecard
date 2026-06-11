const CHINA_COURSES_PARTS = [
  require('./courses-accurate-part1.js'),
  require('./courses-accurate-part2.js'),
  require('./courses-accurate-part3.js'),
  require('./courses-accurate-part4.js')
]

module.exports = [].concat.apply([], CHINA_COURSES_PARTS)
