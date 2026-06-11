/**
 * 全局常量配置
 */

// 球员标识颜色
const PLAYER_COLORS = [
  '#2c8f4e', '#2196f3', '#ff9800', '#f44336',
  '#9c27b0', '#00bcd4', '#795548', '#607D8B'
]

// 用户等级配置
const USER_LEVELS = [
  { min: 0, name: '高尔夫新手', color: '#999' },
  { min: 5, name: '业余爱好者', color: '#2c8f4e' },
  { min: 20, name: '球场常客', color: '#1b5e20' },
  { min: 50, name: '高尔夫达人', color: '#ff9800' },
  { min: 100, name: '传奇球手', color: '#f44336' }
]

// 成绩评分阈值（用于分析报告）
const SCORE_RATINGS = [
  { maxToPar: -10, score: 95, label: '卓越' },
  { maxToPar: -5, score: 90, label: '优秀' },
  { maxToPar: 0, score: 80, label: '良好' },
  { maxToPar: 5, score: 70, label: '一般' },
  { maxToPar: 10, score: 60, label: '需改进' },
  { maxToPar: Infinity, score: 50, label: '加油' }
]

// PAR 验证规则
const PAR_VALIDATION = {
  minPar: 3,
  maxPar: 6,
  totalParMin: 66,  // 18洞最小标准杆
  totalParMax: 78   // 18洞最大标准杆
}

// 主题色
const THEME = {
  primary: '#2c8f4e',
  primaryDark: '#1b5e20',
  danger: '#f44336',
  warning: '#ff9800',
  info: '#2196f3',
  textPrimary: '#333333',
  textSecondary: '#666666',
  textMuted: '#999999',
  background: '#f5f5f5',
  cardBackground: '#ffffff',
  divider: '#eeeeee'
}

// 存储键名
const STORAGE_KEYS = {
  COURSES: 'courses',
  GAMES: 'games',
  CURRENT_GAME: 'currentGame',
  USER_INFO: 'userInfo',
  SAVED_PLAYERS: 'savedPlayers',
  FAVORITE_COURSE_IDS: 'favoriteCourseIds',
  APP_SETTINGS: 'appSettings',
  USER_COURSE_HOLES: 'userCourseHoles',
  CUSTOM_COURSES: 'customCourses',
  USER_PREFERENCES: 'user_preferences',
  COURSES_INITIALIZED: 'coursesInitialized',
  COURSES_DATA_VERSION: 'coursesDataVersion'
}

module.exports = {
  PLAYER_COLORS,
  USER_LEVELS,
  SCORE_RATINGS,
  PAR_VALIDATION,
  THEME,
  STORAGE_KEYS
}
