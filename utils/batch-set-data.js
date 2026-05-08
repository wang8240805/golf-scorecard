/**
 * setData 优化工具
 * 用于批量合并 setData 调用，减少触发次数
 */

class BatchSetData {
  constructor(page, delay = 50) {
    this.page = page
    this.delay = delay
    this.pendingData = {}
    this.timer = null
  }

  /**
   * 添加数据到待更新队列
   * @param {Object} data - 要更新的数据
   */
  add(data) {
    Object.assign(this.pendingData, data)

    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.flush()
      }, this.delay)
    }
  }

  /**
   * 立即执行所有待更新的数据
   */
  flush() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }

    if (Object.keys(this.pendingData).length > 0) {
      this.page.setData(this.pendingData)
      this.pendingData = {}
    }
  }

  /**
   * 取消待更新的数据
   */
  cancel() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.pendingData = {}
  }
}

/**
 * 创建批量 setData 实例
 * @param {Object} page - Page 实例 (this)
 * @param {number} delay - 延迟时间（毫秒），默认 50ms
 * @returns {BatchSetData}
 */
function createBatchSetData(page, delay = 50) {
  return new BatchSetData(page, delay)
}

/**
 * 路径更新工具 - 只更新对象的某个字段
 * @param {Object} page - Page 实例
 * @param {string} path - 路径，如 'currentGame.scores.player1.hole1'
 * @param {*} value - 要设置的值
 */
function setPathData(page, path, value) {
  const data = {}
  data[path] = value
  page.setData(data)
}

module.exports = {
  BatchSetData,
  createBatchSetData,
  setPathData
}
