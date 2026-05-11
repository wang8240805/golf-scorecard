const { formatDate } = require('../../../utils/date-utils.js')

Page({
  data: {
    players: [],
    totalGames: 0,
    showModal: false,
    showStatsModal: false,
    editingPlayer: null,
    statsPlayer: { recentGames: [] },
    formData: {
      name: '',
      color: '#2c8f4e',
      isMe: false
    },
    colors: ['#2c8f4e', '#3498db', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22']
  },

  onLoad() {
    this.loadPlayers()
  },

  onShow() {
    this.loadPlayers()
  },

  // 加载球员数据
  loadPlayers() {
    const games = wx.getStorageSync('games') || []
    const currentGame = wx.getStorageSync('currentGame')

    // 从所有比赛中收集球员信息
    const playerMap = new Map()
    const allGames = [...games]
    if (currentGame && !currentGame.completed) {
      allGames.push(currentGame)
    }

    allGames.forEach(game => {
      if (game.players) {
        game.players.forEach(player => {
          // 特殊处理："我"的球员无论id是什么都合并为同一个
          const isMePlayer = player.isMe || player.name === '我'
          let mapKey = player.id

          if (isMePlayer) {
            mapKey = 'me-player-unique-id' // 固定key保证唯一
          }

          if (!playerMap.has(mapKey)) {
            playerMap.set(mapKey, {
              id: isMePlayer ? 'me-player-unique-id' : player.id,
              name: isMePlayer ? '我' : player.name,
              color: player.color || this.data.colors[Math.floor(Math.random() * this.data.colors.length)],
              isMe: true, // 确保isMe标记为true
              scores: [],
              playCount: 0,
              winCount: 0
            })
          }

          const p = playerMap.get(mapKey)
          p.playCount++

          if (player.totalScore) {
            p.scores.push(player.totalScore)
          }

          // 判断是否是这场比赛的赢家
          if (game.players && player.totalScore) {
            const minScore = Math.min(...game.players.map(pl => pl.totalScore || 999))
            if (player.totalScore === minScore) {
              p.winCount++
            }
          }
        })
      }
    })

    // 计算统计数据
    const players = Array.from(playerMap.values()).map(p => ({
      ...p,
      avgScore: p.scores.length > 0
        ? (p.scores.reduce((a, b) => a + b, 0) / p.scores.length).toFixed(1)
        : '-',
      bestScore: p.scores.length > 0 ? Math.min(...p.scores) : '-'
    }))

    // 排序：自己排在最前，然后按打球次数排序
    players.sort((a, b) => {
      if (a.isMe && !b.isMe) return -1
      if (!a.isMe && b.isMe) return 1
      return b.playCount - a.playCount
    })

    this.setData({
      players,
      totalGames: allGames.length
    })
  },

  // 添加球员
  addPlayer() {
    this.setData({
      showModal: true,
      editingPlayer: null,
      formData: {
        name: '',
        color: this.data.colors[0],
        isMe: false
      }
    })
  },

  // 编辑球员
  editPlayer(e) {
    const player = e.currentTarget.dataset.player
    this.setData({
      showModal: true,
      editingPlayer: player,
      formData: {
        name: player.name,
        color: player.color,
        isMe: player.isMe
      }
    })
  },

  // 查看球员统计
  viewPlayerStats(e) {
    const player = e.currentTarget.dataset.player
    const games = wx.getStorageSync('games') || []

    // 获取该球员的最近比赛
    const recentGames = games
      .filter(g => g.players?.some(p => p.id === player.id && p.totalScore))
      .slice(-5)
      .reverse()
      .map(g => {
        const p = g.players.find(pl => pl.id === player.id)
        const avgScore = g.players.reduce((sum, pl) => sum + (pl.totalScore || 0), 0) / g.players.length
        return {
          id: g.id,
          courseName: g.courseName,
          date: formatDate(g.timestamp),
          score: p.totalScore,
          scoreClass: p.totalScore < avgScore ? 'good' : 'normal'
        }
      })

    this.setData({
      showStatsModal: true,
      statsPlayer: {
        ...player,
        recentGames
      }
    })
  },

  // 关闭弹窗
  closeModal() {
    this.setData({ showModal: false })
  },

  closeStatsModal() {
    this.setData({ showStatsModal: false })
  },

  preventHide() {
    // 阻止冒泡
  },

  // 输入处理
  onNameInput(e) {
    this.setData({ 'formData.name': e.detail.value })
  },

  selectColor(e) {
    this.setData({ 'formData.color': e.currentTarget.dataset.color })
  },

  toggleIsMe() {
    this.setData({ 'formData.isMe': !this.data.formData.isMe })
  },

  // 保存球员
  savePlayer() {
    const { formData, editingPlayer } = this.data

    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入球员姓名', icon: 'none' })
      return
    }

    // 球员数据存储在当前比赛的storage或全局players中
    // 由于球员数据分散在各场比赛中，这里使用专门的players存储
    let players = wx.getStorageSync('savedPlayers') || []

    if (editingPlayer) {
      // 编辑模式
      const index = players.findIndex(p => p.id === editingPlayer.id)
      if (index !== -1) {
        players[index] = {
          ...players[index],
          name: formData.name.trim(),
          color: formData.color,
          isMe: formData.isMe
        }
      } else {
        // 如果是从比赛中加载的球员但未保存，添加为新的
        players.push({
          id: editingPlayer.id,
          name: formData.name.trim(),
          color: formData.color,
          isMe: formData.isMe,
          createdAt: Date.now()
        })
      }

      // 更新所有比赛中该球员的信息
      this.updatePlayerInAllGames(editingPlayer.id, {
        name: formData.name.trim(),
        color: formData.color,
        isMe: formData.isMe
      })
    } else {
      // 新增模式
      // 检查是否已存在同名球员
      const exists = players.some(p =>
        p.name.toLowerCase() === formData.name.trim().toLowerCase()
      )
      if (exists) {
        wx.showToast({ title: '该球员已存在', icon: 'none' })
        return
      }

      // 如果标记为自己，取消其他球员的isMe标记
      if (formData.isMe) {
        players.forEach(p => p.isMe = false)
      }

      players.push({
        id: 'player_' + Date.now(),
        name: formData.name.trim(),
        color: formData.color,
        isMe: formData.isMe,
        createdAt: Date.now()
      })
    }

    wx.setStorageSync('savedPlayers', players)

    this.setData({ showModal: false })
    this.loadPlayers()

    wx.showToast({
      title: editingPlayer ? '修改成功' : '添加成功',
      icon: 'success'
    })
  },

  // 更新所有比赛中的球员信息
  updatePlayerInAllGames(playerId, updates) {
    // 更新历史比赛
    let games = wx.getStorageSync('games') || []
    games = games.map(game => {
      if (game.players) {
        game.players = game.players.map(p => {
          if (p.id === playerId) {
            return { ...p, ...updates }
          }
          return p
        })
      }
      return game
    })
    wx.setStorageSync('games', games)

    // 更新当前比赛
    const currentGame = wx.getStorageSync('currentGame')
    if (currentGame && currentGame.players) {
      currentGame.players = currentGame.players.map(p => {
        if (p.id === playerId) {
          return { ...p, ...updates }
        }
        return p
      })
      wx.setStorageSync('currentGame', currentGame)
    }
  },

  // 删除球员
  deletePlayer(e) {
    const player = e.currentTarget.dataset.player

    if (player.isMe) {
      wx.showToast({ title: '不能删除自己', icon: 'none' })
      return
    }

    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${player.name}"吗？`,
      confirmColor: '#e53935',
      success: (res) => {
        if (res.confirm) {
          let players = wx.getStorageSync('savedPlayers') || []
          players = players.filter(p => p.id !== player.id)
          wx.setStorageSync('savedPlayers', players)

          this.loadPlayers()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

})
