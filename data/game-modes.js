const GAME_MODES = [
  {
    id: 'stroke',
    name: '比杆赛',
    icon: '杆',
    shortDesc: '18洞总杆数最少者获胜',
    rules: '每位球员完成18洞，记录每洞杆数，累计总杆数最少者获胜。标准杆通常为72杆，职业球员成绩通常在-10到+5之间。这是最经典的高尔夫比赛形式，适合各种水平的球员参与。',
    hasHandicap: true,
    handicapType: 'strokes',
    handicapDesc: '让杆设置'
  },
  {
    id: 'match',
    name: '比洞赛',
    icon: '洞',
    shortDesc: '每洞单独PK，让洞设计更公平',
    rules: '每洞单独计算胜负，杆数少者赢得该洞。18洞比赛中，赢洞数多者最终获胜。支持让洞设计：高水平球员让低水平球员一定数量的洞，让比赛更公平。',
    hasHandicap: true,
    handicapType: 'holes',
    handicapDesc: '让洞设置'
  },
  {
    id: 'bestball',
    name: '最佳球',
    icon: '球',
    shortDesc: '两人组队取最优成绩',
    rules: '两人一队，每洞取两人中最好的成绩作为该队成绩。可与另一队PK，也可以多队一起比杆数。适合搭档配合，互相弥补失误。',
    hasHandicap: false,
    needsTeams: true,
    teamSize: 2,
    teamDesc: '组队设置'
  },
  {
    id: 'landlord',
    name: '斗地主',
    icon: '斗',
    shortDesc: '三人局争当地主赢分',
    rules: '三人局，每洞杆数最低者赢得该洞并成为"地主"，其他两人为"农民"。地主赢洞得2分，农民赢洞各得1分。18洞后总分高者获胜。紧张刺激的三角博弈！',
    hasHandicap: false,
    needsLandlord: true,
    landlordDesc: '初始地主设置'
  }
]

module.exports = {
  GAME_MODES
}
