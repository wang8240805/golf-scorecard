/**
 * 地理工具函数
 * 距离计算、格式化等通用功能
 */

/**
 * 计算两点间距离（Haversine公式）
 * @param {number} lat1 - 起点纬度
 * @param {number} lng1 - 起点经度
 * @param {number} lat2 - 终点纬度
 * @param {number} lng2 - 终点经度
 * @returns {number} 距离，单位：米
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000 // 地球平均半径，单位米
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * 格式化距离显示
 * @param {number} distance - 距离，单位米
 * @returns {string} 格式化后的字符串
 */
function formatDistance(distance) {
  if (distance < 1000) {
    return Math.round(distance) + 'm'
  }
  return (distance / 1000).toFixed(1) + 'km'
}

/**
 * 计算所有球场距离并排序
 * @param {Array} courses - 球场列表
 * @param {Object} userLoc - 用户位置 {latitude, longitude}
 * @returns {Array} 按距离排序后的球场列表，每个球场增加distance字段
 */
function calculateAndSortCourses(courses, userLoc) {
  const coursesWithDistance = courses.map(course => {
    const distance = calculateDistance(
      userLoc.latitude, userLoc.longitude,
      course.latitude, course.longitude
    )
    return {
      ...course,
      distance,
      distanceFormatted: formatDistance(distance)
    }
  })

  // 按距离升序排序
  return coursesWithDistance.sort((a, b) => a.distance - b.distance)
}

module.exports = {
  calculateDistance,
  formatDistance,
  calculateAndSortCourses
}
