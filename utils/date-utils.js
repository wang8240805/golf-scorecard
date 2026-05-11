/**
 * 格式化日期
 * @param {number|string|Date} timestamp - 时间戳或日期对象
 * @param {string} format - 'short' (月日), 'full' (年月日), 'compact' (YYYYMMDD)
 * @returns {string} 格式化后的日期字符串
 */
function formatDate(timestamp, format = 'short') {
  let date
  if (typeof timestamp === 'number' || typeof timestamp === 'string') {
    date = new Date(timestamp)
  } else {
    date = new Date()
  }

  if (isNaN(date.getTime())) {
    date = new Date()
  }

  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()

  if (format === 'full') {
    return `${year}年${month}月${day}日`
  }
  if (format === 'compact') {
    const m = String(month).padStart(2, '0')
    const d = String(day).padStart(2, '0')
    return `${year}${m}${d}`
  }
  return `${month}月${day}日`
}

module.exports = { formatDate }
