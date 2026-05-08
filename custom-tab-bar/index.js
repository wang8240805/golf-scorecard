Component({
  data: {
    selected: 0,
    color: '#999999',
    selectedColor: '#2c8f4e',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页',
        icon: 'home'
      },
      {
        pagePath: 'pages/profile/profile',
        text: '我的',
        icon: 'profile'
      }
    ]
  },

  methods: {
    // 中央按钮点击 - 阻止冒泡并调用startNewGame
    onCenterBtnTap(e) {
      console.log('[TabBar] onCenterBtnTap triggered')
      // 阻止事件冒泡
      if (e && e.stopPropagation) {
        e.stopPropagation()
      }
      this.startNewGame()
    },

    switchTab(e) {
      const data = e.currentTarget.dataset
      const path = this.data.list[data.index].pagePath
      const url = '/' + path

      // 获取当前页面栈
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const currentRoute = currentPage ? currentPage.route : ''

      // 执行跳转
      wx.switchTab({
        url: url,
        success: () => {
          this.setData({
            selected: data.index
          })
        },
        fail: (err) => {
          console.error('[CustomTabBar] switchTab failed:', err)
          wx.navigateTo({ url })
        }
      })
    },

    startNewGame() {
      // 获取当前页面栈
      const pages = getCurrentPages()
      const currentPage = pages[pages.length - 1]
      const currentRoute = currentPage ? currentPage.route : ''

      console.log('[TabBar] startNewGame clicked, currentRoute:', currentRoute)

      // 如果已经在step1-course页面，则不重复跳转
      if (currentRoute === 'package-courses/pages/new-game/step1-course/step1-course') {
        console.log('[TabBar] already on step1-course, skip')
        return
      }

      // 检查是否有进行中的比赛
      const currentGame = wx.getStorageSync('currentGame')
      const hasOngoingGame = currentGame && currentGame.id && !currentGame.completed
      console.log('[TabBar] hasOngoingGame:', hasOngoingGame)

      // 如果有进行中的比赛，跳转到记分页面
      if (hasOngoingGame) {
        wx.navigateTo({
          url: '/pages/scorecard/scorecard',
          fail: function(err) {
            console.error('[TabBar] navigateTo scorecard fail:', err)
            wx.showToast({ title: '跳转失败', icon: 'none' })
          }
        })
        return
      }

      // 直接跳转到分包页面，微信会自动加载分包
      const targetUrl = '/package-courses/pages/new-game/step1-course/step1-course'
      console.log('[TabBar] navigate to:', targetUrl)

      // 判断是否在新建比赛流程页面，如果是则用redirectTo
      if (currentRoute && currentRoute.includes('/new-game/')) {
        wx.redirectTo({
          url: targetUrl,
          fail: function(err) {
            console.error('[TabBar] redirectTo fail:', err)
            wx.showToast({ title: '跳转失败', icon: 'none' })
          }
        })
      } else {
        wx.navigateTo({
          url: targetUrl,
          fail: function(err) {
            console.error('[TabBar] navigateTo fail:', err)
            wx.showToast({ title: '页面加载失败', icon: 'none' })
          }
        })
      }
    }
  }
})
