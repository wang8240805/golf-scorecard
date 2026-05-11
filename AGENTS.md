# WinPAR 高尔夫记分卡 微信小程序

## 项目信息
- **类型**: 微信小程序
- **开发工具**: 微信开发者工具
- **项目结构**: 原生小程序开发（WXML + WXSS + JavaScript）
- **数据来源**: 静态JS文件保存球场数据，本地存储用户数据

## 关键目录
```
pages/
├── index/           # 首页
├── courses/         # 我的球场（TabBar页面）
├── all-courses/     # 全部球场（搜索筛选）
├── players/         # 球员管理
├── scorecard/       # 记分卡主页面
├── new-game/
│   └── step1-course/  # 新建比赛 - 选择球场
└── ...
data/
└── courses-accurate.js  # 全国400+球场完整数据（含北京32个球场）
utils/                # 工具函数
components/           # 公共组件
```

## 技术要点
1. **路由配置**: `app.json` 的 `pages` 数组配置页面路径
2. **TabBar**: 3个tab - 首页(`pages/index`)、球场(`pages/courses`)、我的(`pages/profile`)
3. **数据存储**: 使用 `wx.setStorageSync` / `wx.getStorageSync` 存储本地数据
4. **OCR功能**: 需要微信OCR插件 (`wx4418e3e031e551be`)，需要开通后启用
5. **样式**: WXSS原生样式，使用flex布局

## 已实现功能
- 选择球场页面直接显示每洞标准杆表格
- 拍照识别纸质计分卡校对数据功能
- 新增球场入口（OCR识别自动创建）
- 附近球场按距离排序，只显示最近10个 + 收藏
- 点击跳转到全部球场页面搜索筛选

## 代码规范
- 使用2空格缩进
- 双引号字符串
- 函数使用ES5 function语法
- WXML条件循环用 `wx:if` / `wx:for`

## 忽略文件（已配置.claudeignore）
node_modules/, miniprogram_npm/, unpackage/, .git/, .vscode/
