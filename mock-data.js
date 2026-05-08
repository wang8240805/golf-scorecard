// 生成3场模拟比赛数据
const mockGames = [
  // 第一场：成绩稍差
  {
    id: 'mock-game-1',
    courseId: 'china-1',
    courseName: '北京华彬高尔夫俱乐部',
    timestamp: Date.now() - 86400000 * 10, // 10天前
    completed: true,
    players: [{ id: 'player-1', name: '我', color: '#2c8f4e' }],
    scores: {
      'player-1': {
        1: 5, 2: 6, 3: 4, 4: 5, 5: 4, 6: 5, 7: 6, 8: 4, 9: 5,
        10: 5, 11: 6, 12: 4, 13: 5, 14: 4, 15: 6, 16: 5, 17: 4, 18: 5
      }
    },
    putts: {
      'player-1': {
        1: 2, 2: 3, 3: 2, 4: 2, 5: 1, 6: 2, 7: 3, 8: 2, 9: 2,
        10: 2, 11: 3, 12: 2, 13: 2, 14: 1, 15: 3, 16: 2, 17: 2, 18: 2
      }
    },
    fairways: {
      'player-1': { 1: true, 2: false, 3: true, 4: false, 5: true, 6: false, 7: false, 8: true, 9: true, 10: false, 11: false, 12: true, 13: false, 14: true, 15: false, 16: true, 17: false, 18: true }
    },
    statistics: {
      'player-1': {
        totalScore: 94,
        toPar: 22,
        eagles: 0,
        birdies: 1,
        pars: 5,
        bogeys: 8,
        doubleBogeys: 4,
        others: 0,
        holesPlayed: 18
      }
    }
  },
  // 第二场：中等成绩
  {
    id: 'mock-game-2',
    courseId: 'china-2',
    courseName: '上海佘山国际高尔夫俱乐部',
    timestamp: Date.now() - 86400000 * 5, // 5天前
    completed: true,
    players: [{ id: 'player-1', name: '我', color: '#2c8f4e' }],
    scores: {
      'player-1': {
        1: 4, 2: 5, 3: 4, 4: 4, 5: 3, 6: 5, 7: 5, 8: 4, 9: 5,
        10: 4, 11: 5, 12: 4, 13: 4, 14: 3, 15: 5, 16: 4, 17: 5, 18: 4
      }
    },
    putts: {
      'player-1': {
        1: 2, 2: 2, 3: 2, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 2,
        10: 2, 11: 2, 12: 2, 13: 1, 14: 1, 15: 2, 16: 2, 17: 2, 18: 2
      }
    },
    fairways: {
      'player-1': { 1: true, 2: true, 3: true, 4: false, 5: true, 6: false, 7: true, 8: true, 9: false, 10: true, 11: true, 12: false, 13: true, 14: true, 15: false, 16: true, 17: true, 18: false }
    },
    statistics: {
      'player-1': {
        totalScore: 82,
        toPar: 10,
        eagles: 0,
        birdies: 2,
        pars: 10,
        bogeys: 5,
        doubleBogeys: 1,
        others: 0,
        holesPlayed: 18
      }
    }
  },
  // 第三场：最好成绩
  {
    id: 'mock-game-3',
    courseId: 'china-3',
    courseName: '深圳观澜湖高尔夫球会',
    timestamp: Date.now() - 86400000 * 1, // 1天前
    completed: true,
    players: [{ id: 'player-1', name: '我', color: '#2c8f4e' }],
    scores: {
      'player-1': {
        1: 4, 2: 4, 3: 3, 4: 4, 5: 3, 6: 4, 7: 5, 8: 3, 9: 4,
        10: 4, 11: 4, 12: 3, 13: 4, 14: 4, 15: 3, 16: 5, 17: 4, 18: 3
      }
    },
    putts: {
      'player-1': {
        1: 2, 2: 1, 3: 1, 4: 2, 5: 1, 6: 2, 7: 2, 8: 1, 9: 2,
        10: 2, 11: 1, 12: 1, 13: 2, 14: 2, 15: 1, 16: 2, 17: 2, 18: 1
      }
    },
    fairways: {
      'player-1': { 1: true, 2: true, 3: true, 4: true, 5: true, 6: false, 7: true, 8: true, 9: true, 10: true, 11: true, 12: true, 13: false, 14: true, 15: true, 16: false, 17: true, 18: true }
    },
    statistics: {
      'player-1': {
        totalScore: 76,
        toPar: 4,
        eagles: 0,
        birdies: 6,
        pars: 10,
        bogeys: 2,
        doubleBogeys: 0,
        others: 0,
        holesPlayed: 18
      }
    }
  }
]

// 保存到本地存储
const existingGames = wx.getStorageSync('games') || []
wx.setStorageSync('games', [...existingGames, ...mockGames])
console.log('✅ 模拟数据添加成功，共3场比赛')
