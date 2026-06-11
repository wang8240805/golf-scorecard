Component({
  data: {
    showPrivacy: false
  },

  lifetimes: {
    attached: function() {
      var app = getApp()
      this.privacyCallback = function(show) {
        this.setData({ showPrivacy: show })
      }.bind(this)
      if (app && app.addPrivacyCallback) {
        app.addPrivacyCallback(this.privacyCallback)
      }
    },

    detached: function() {
      var app = getApp()
      if (app && app.removePrivacyCallback && this.privacyCallback) {
        app.removePrivacyCallback(this.privacyCallback)
      }
    }
  },

  methods: {
    openUserAgreement: function() {
      wx.navigateTo({
        url: "/package-user/pages/webview/webview?type=userAgreement"
      })
    },

    openPrivacyPolicy: function() {
      wx.navigateTo({
        url: "/package-user/pages/webview/webview?type=privacyPolicy"
      })
    },

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
