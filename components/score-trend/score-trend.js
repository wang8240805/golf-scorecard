/**
 * 成绩趋势图表组件
 * 使用 Canvas 绘制轻量级图表，无需外部库
 */
Component({
  properties: {
    // 成绩数据: [{hole: 1, score: 4, par: 4}, ...]
    scores: {
      type: Array,
      value: [],
      observer: 'drawChart'
    },
    // 图表高度
    height: {
      type: Number,
      value: 200
    },
    // 主题色
    themeColor: {
      type: String,
      value: '#2c8f4e'
    }
  },

  data: {
    canvasId: ''
  },

  lifetimes: {
    attached() {
      this.setData({
        canvasId: 'scoreTrend_' + Date.now()
      })
    },
    ready() {
      this.drawChart()
    }
  },

  methods: {
    drawChart() {
      const { scores, height, themeColor, canvasId } = this.data
      if (!scores || scores.length === 0 || !canvasId) return

      const ctx = wx.createCanvasContext(canvasId, this)
      const width = 350 // 标准宽度
      const padding = { top: 20, right: 30, bottom: 30, left: 30 }

      // 清空画布
      ctx.clearRect(0, 0, width, height)

      // 计算数据范围
      const chartWidth = width - padding.left - padding.right
      const chartHeight = height - padding.top - padding.bottom

      const scoresValues = scores.map(s => s.score)
      const parValues = scores.map(s => s.par)
      const maxScore = Math.max(...scoresValues, ...parValues, 8)
      const minScore = Math.min(...scoresValues, ...parValues, 3)

      // 绘制网格线
      ctx.strokeStyle = '#f0f0f0'
      ctx.lineWidth = 1
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + (chartHeight / 5) * i
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(width - padding.right, y)
        ctx.stroke()
      }

      // 绘制标准杆参考线
      const avgPar = parValues.reduce((a, b) => a + b, 0) / parValues.length
      const parY = padding.top + chartHeight - ((avgPar - minScore) / (maxScore - minScore)) * chartHeight

      ctx.strokeStyle = '#999'
      ctx.setLineDash([5, 5])
      ctx.beginPath()
      ctx.moveTo(padding.left, parY)
      ctx.lineTo(width - padding.right, parY)
      ctx.stroke()
      ctx.setLineDash([])

      // 绘制标准杆标签
      ctx.fillStyle = '#999'
      ctx.font = '10px sans-serif'
      ctx.fillText('标准杆', width - padding.right + 5, parY + 3)

      // 绘制成绩折线
      if (scores.length > 1) {
        ctx.strokeStyle = themeColor
        ctx.lineWidth = 2
        ctx.beginPath()

        scores.forEach((item, index) => {
          const x = padding.left + (chartWidth / (scores.length - 1)) * index
          const y = padding.top + chartHeight - ((item.score - minScore) / (maxScore - minScore)) * chartHeight

          if (index === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })
        ctx.stroke()

        // 绘制数据点
        scores.forEach((item, index) => {
          const x = padding.left + (chartWidth / (scores.length - 1)) * index
          const y = padding.top + chartHeight - ((item.score - minScore) / (maxScore - minScore)) * chartHeight

          // 根据成绩好坏设置颜色
          if (item.score < item.par) {
            ctx.fillStyle = '#4CAF50' // 低于标准杆-绿色
          } else if (item.score === item.par) {
            ctx.fillStyle = '#2196F3' // 平标准杆-蓝色
          } else {
            ctx.fillStyle = '#FF9800' // 高于标准杆-橙色
          }

          ctx.beginPath()
          ctx.arc(x, y, 4, 0, Math.PI * 2)
          ctx.fill()

          // 白色边框
          ctx.strokeStyle = '#fff'
          ctx.lineWidth = 2
          ctx.stroke()
        })
      }

      // 绘制X轴标签（洞号）
      ctx.fillStyle = '#666'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'center'

      const step = Math.ceil(scores.length / 9) // 最多显示9个标签
      scores.forEach((item, index) => {
        if (index % step === 0) {
          const x = padding.left + (chartWidth / (scores.length - 1)) * index
          ctx.fillText(item.hole + '洞', x, height - 10)
        }
      })

      ctx.draw()
    },

    // 点击图表查看详情
    onTapChart(e) {
      const { scores } = this.data
      const rect = e.detail

      // 计算点击位置对应的数据点
      const width = 350
      const padding = { left: 30, right: 30 }
      const chartWidth = width - padding.left - padding.right

      const clickX = rect.x - padding.left
      const index = Math.round((clickX / chartWidth) * (scores.length - 1))

      if (index >= 0 && index < scores.length) {
        const item = scores[index]
        this.triggerEvent('select', { hole: item.hole, score: item.score, par: item.par })
      }
    }
  }
})
