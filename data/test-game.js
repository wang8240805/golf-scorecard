/**
 * 测试用完整比赛记录
 * 用于测试 AI 分析报告、海报生成等功能
 */

const testGame = {
  id: 'game_20260302_001',
  courseId: 'beijing_national_golf',
  courseName: '北京国际高尔夫俱乐部',
  location: '北京市昌平区',
  date: '2026-03-02',
  startTime: '09:30',
  endTime: '14:15',
  duration: 285, // 分钟
  gameMode: 'stroke',
  gameModeName: '比杆赛',
  status: 'completed',
  weather: '晴朗，微风',
  temperature: '18°C',

  // 球场信息
  course: {
    name: '北京国际高尔夫俱乐部',
    par: 72,
    totalHoles: 18,
    length: 7204, // 码
    holes: [
      { hole: 1, par: 4, length: 385, index: 7 },
      { hole: 2, par: 3, length: 165, index: 15 },
      { hole: 3, par: 5, length: 520, index: 3 },
      { hole: 4, par: 4, length: 402, index: 9 },
      { hole: 5, par: 4, length: 368, index: 13 },
      { hole: 6, par: 3, length: 148, index: 17 },
      { hole: 7, par: 4, length: 412, index: 5 },
      { hole: 8, par: 5, length: 528, index: 1 },
      { hole: 9, par: 4, length: 395, index: 11 },
      { hole: 10, par: 4, length: 378, index: 12 },
      { hole: 11, par: 3, length: 175, index: 16 },
      { hole: 12, par: 5, length: 542, index: 2 },
      { hole: 13, par: 4, length: 408, index: 8 },
      { hole: 14, par: 4, length: 352, index: 18 },
      { hole: 15, par: 3, length: 158, index: 14 },
      { hole: 16, par: 5, length: 498, index: 4 },
      { hole: 17, par: 4, length: 422, index: 6 },
      { hole: 18, par: 4, length: 408, index: 10 }
    ]
  },

  // 球员列表
  players: [
    {
      id: 'player_001',
      name: '王建国',
      avatar: '',
      handicap: 8,
      color: '#2c8f4e',
      isMe: true,
      scores: [
        { hole: 1, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 2, strokes: 3, putts: 2, par: 3, fairway: null, green: true },
        { hole: 3, strokes: 5, putts: 2, par: 5, fairway: true, green: true },
        { hole: 4, strokes: 5, putts: 3, par: 4, fairway: false, green: false },
        { hole: 5, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 6, strokes: 3, putts: 2, par: 3, fairway: null, green: true },
        { hole: 7, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 8, strokes: 6, putts: 3, par: 5, fairway: false, green: false },
        { hole: 9, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 10, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 11, strokes: 3, putts: 2, par: 3, fairway: null, green: true },
        { hole: 12, strokes: 5, putts: 2, par: 5, fairway: true, green: true },
        { hole: 13, strokes: 5, putts: 3, par: 4, fairway: false, green: false },
        { hole: 14, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 15, strokes: 3, putts: 2, par: 3, fairway: null, green: false },
        { hole: 16, strokes: 5, putts: 2, par: 5, fairway: true, green: true },
        { hole: 17, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 18, strokes: 4, putts: 2, par: 4, fairway: true, green: true }
      ],
      total: 76,
      toPar: 4,
      birdies: 2,
      pars: 10,
      bogeys: 4,
      doubles: 2,
      penalties: 1
    },
    {
      id: 'player_002',
      name: '李明',
      avatar: '',
      handicap: 15,
      color: '#e74c3c',
      isMe: false,
      scores: [
        { hole: 1, strokes: 5, putts: 2, par: 4, fairway: false, green: false },
        { hole: 2, strokes: 4, putts: 3, par: 3, fairway: null, green: false },
        { hole: 3, strokes: 6, putts: 3, par: 5, fairway: false, green: false },
        { hole: 4, strokes: 5, putts: 2, par: 4, fairway: true, green: false },
        { hole: 5, strokes: 5, putts: 3, par: 4, fairway: false, green: false },
        { hole: 6, strokes: 4, putts: 3, par: 3, fairway: null, green: false },
        { hole: 7, strokes: 5, putts: 2, par: 4, fairway: true, green: false },
        { hole: 8, strokes: 6, putts: 2, par: 5, fairway: true, green: true },
        { hole: 9, strokes: 5, putts: 2, par: 4, fairway: false, green: false },
        { hole: 10, strokes: 5, putts: 3, par: 4, fairway: false, green: false },
        { hole: 11, strokes: 3, putts: 2, par: 3, fairway: null, green: true },
        { hole: 12, strokes: 6, putts: 3, par: 5, fairway: false, green: false },
        { hole: 13, strokes: 5, putts: 2, par: 4, fairway: true, green: false },
        { hole: 14, strokes: 5, putts: 3, par: 4, fairway: false, green: false },
        { hole: 15, strokes: 4, putts: 3, par: 3, fairway: null, green: false },
        { hole: 16, strokes: 6, putts: 2, par: 5, fairway: true, green: false },
        { hole: 17, strokes: 5, putts: 2, par: 4, fairway: false, green: false },
        { hole: 18, strokes: 5, putts: 2, par: 4, fairway: true, green: false }
      ],
      total: 89,
      toPar: 17,
      birdies: 0,
      pars: 3,
      bogeys: 10,
      doubles: 5,
      penalties: 3
    },
    {
      id: 'player_003',
      name: '张伟',
      avatar: '',
      handicap: 6,
      color: '#3498db',
      isMe: false,
      scores: [
        { hole: 1, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 2, strokes: 3, putts: 2, par: 3, fairway: null, green: true },
        { hole: 3, strokes: 5, putts: 2, par: 5, fairway: true, green: true },
        { hole: 4, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 5, strokes: 4, putts: 2, par: 4, fairway: false, green: true },
        { hole: 6, strokes: 2, putts: 1, par: 3, fairway: null, green: true },
        { hole: 7, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 8, strokes: 5, putts: 2, par: 5, fairway: true, green: true },
        { hole: 9, strokes: 4, putts: 2, par: 4, fairway: false, green: true },
        { hole: 10, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 11, strokes: 3, putts: 2, par: 3, fairway: null, green: true },
        { hole: 12, strokes: 5, putts: 2, par: 5, fairway: true, green: true },
        { hole: 13, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 14, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 15, strokes: 3, putts: 2, par: 3, fairway: null, green: true },
        { hole: 16, strokes: 5, putts: 2, par: 5, fairway: true, green: true },
        { hole: 17, strokes: 4, putts: 2, par: 4, fairway: true, green: true },
        { hole: 18, strokes: 4, putts: 2, par: 4, fairway: true, green: true }
      ],
      total: 72,
      toPar: 0,
      birdies: 3,
      pars: 13,
      bogeys: 2,
      doubles: 0,
      penalties: 0
    },
    {
      id: 'player_004',
      name: '刘洋',
      avatar: '',
      handicap: 22,
      color: '#f39c12',
      isMe: false,
      scores: [
        { hole: 1, strokes: 6, putts: 3, par: 4, fairway: false, green: false },
        { hole: 2, strokes: 4, putts: 2, par: 3, fairway: null, green: false },
        { hole: 3, strokes: 7, putts: 3, par: 5, fairway: false, green: false },
        { hole: 4, strokes: 6, putts: 3, par: 4, fairway: false, green: false },
        { hole: 5, strokes: 6, putts: 3, par: 4, fairway: false, green: false },
        { hole: 6, strokes: 4, putts: 2, par: 3, fairway: null, green: false },
        { hole: 7, strokes: 6, putts: 2, par: 4, fairway: false, green: false },
        { hole: 8, strokes: 7, putts: 2, par: 5, fairway: false, green: false },
        { hole: 9, strokes: 6, putts: 3, par: 4, fairway: false, green: false },
        { hole: 10, strokes: 6, putts: 3, par: 4, fairway: false, green: false },
        { hole: 11, strokes: 4, putts: 2, par: 3, fairway: null, green: false },
        { hole: 12, strokes: 7, putts: 3, par: 5, fairway: false, green: false },
        { hole: 13, strokes: 6, putts: 2, par: 4, fairway: false, green: false },
        { hole: 14, strokes: 5, putts: 2, par: 4, fairway: false, green: true },
        { hole: 15, strokes: 4, putts: 2, par: 3, fairway: null, green: false },
        { hole: 16, strokes: 7, putts: 3, par: 5, fairway: false, green: false },
        { hole: 17, strokes: 6, putts: 2, par: 4, fairway: false, green: false },
        { hole: 18, strokes: 5, putts: 2, par: 4, fairway: true, green: false }
      ],
      total: 98,
      toPar: 26,
      birdies: 0,
      pars: 1,
      bogeys: 6,
      doubles: 11,
      penalties: 5
    }
  ],

  // 比赛统计
  stats: {
    bestScore: 72,
    bestPlayer: '张伟',
    averageScore: 83.75,
    totalBirdies: 5,
    totalPars: 27,
    fairwayHitRate: 45,
    greenHitRate: 38,
    averagePutts: 2.3
  },

  // 让杆设置
  handicapSettings: {
    type: 'strokes',
    strokes: {
      player_001: 0,
      player_002: 7,
      player_003: 0,
      player_004: 14
    }
  }
}

// 历史比赛记录（用于对比分析）
const historyGames = [
  {
    id: 'game_20260215_001',
    date: '2026-02-15',
    courseName: '华彬庄园',
    total: 78,
    toPar: 6,
    playerId: 'player_001'
  },
  {
    id: 'game_20260128_001',
    date: '2026-01-28',
    courseName: ' wildcard 山地球场',
    total: 82,
    toPar: 10,
    playerId: 'player_001'
  },
  {
    id: 'game_20260110_001',
    date: '2026-01-10',
    courseName: '北京国际高尔夫俱乐部',
    total: 80,
    toPar: 8,
    playerId: 'player_001'
  },
  {
    id: 'game_20251220_001',
    date: '2025-12-20',
    courseName: '华彬庄园',
    total: 85,
    toPar: 13,
    playerId: 'player_001'
  },
  {
    id: 'game_20251115_001',
    date: '2025-11-15',
    courseName: '雁栖湖高尔夫',
    total: 79,
    toPar: 7,
    playerId: 'player_001'
  }
]

module.exports = {
  testGame,
  historyGames
}
