Component({
  data: {
    showPrivacy: false
  },

  lifetimes: {
    attached: function() {
      var app = getApp()
      // 注册回调
      app.privacyCallback = function(show) {
        this.setData({ showPrivacy: show })
      }.bind(this)
    }
  },

  methods: {
    // 用户同意
    handleAgree: function() {
      this.setData({ showPrivacy: false })
      getApp().agreePrivacy()
    },

    // 用户拒绝
    handleDisagree: function() {
      this.setData({ showPrivacy: false })
      getApp().disagreePrivacy()
      wx.showToast({ title: '您拒绝了授权', icon: 'none' })
    }
  }
})
