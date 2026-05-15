Page({
  data: {
    content: '',
    contact: '',
    showThanks: false,
    contactSource: ''
  },

  onLoad() {
    this.fillSavedContact()
  },

  onShow() {
    // 设置TabBar选中状态 - 反馈页面属于"我的"模块
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.fillSavedContact()
  },

  fillSavedContact() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    const savedPhone = userInfo.phoneNumber || ''
    const savedContact = savedPhone || userInfo.nickName || ''
    if (!this.data.contact && savedContact) {
      this.setData({
        contact: savedContact,
        contactSource: savedPhone ? '已使用账号手机号' : '已使用微信昵称'
      })
    }
  },

  // 输入反馈内容
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    })
  },

  // 输入联系方式
  onContactInput(e) {
    this.setData({
      contact: e.detail.value
    })
  },

  // 提交反馈
  submitFeedback() {
    const { content, contact, contactSource } = this.data

    if (!content || content.length < 5) {
      wx.showToast({ title: '请输入至少5个字符', icon: 'none' })
      return
    }

    // 收集反馈数据
    const feedback = {
      content: content,
      contact: contact,
      contactSource: contactSource,
      timestamp: new Date().getTime(),
      userInfo: wx.getStorageSync('userInfo') || null
    }

    // 保存到本地存储
    const feedbacks = wx.getStorageSync('feedbacks') || []
    feedbacks.push(feedback)
    wx.setStorageSync('feedbacks', feedbacks)

    console.log('用户反馈：', feedback)

    // ========== 上传到云端数据库，管理员后台可查看 ==========
    if (wx.cloud) {
      const db = wx.cloud.database()
      db.collection('feedback').add({
        data: {
          ...feedback,
          createTime: db.serverDate()
        },
        success: res => {
          console.log('【云端上传】反馈上传成功', res._id)
        },
        fail: err => {
          console.error('【云端上传】上传失败', err)
        }
      })
    }

    // 显示感谢提示
    this.setData({ showThanks: true })

    wx.showToast({
      title: '提交成功',
      icon: 'success',
      success: () => {
        setTimeout(() => {
          wx.navigateBack()
        }, 2000)
      }
    })
  }
})
