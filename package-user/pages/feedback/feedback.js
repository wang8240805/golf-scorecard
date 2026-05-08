Page({
  data: {
    content: '',
    contact: '',
    showThanks: false
  },

  onShow() {
    // 设置TabBar选中状态 - 反馈页面属于"我的"模块
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
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

  // 获取手机号
  getPhoneNumber(e) {
    if (e.detail.errMsg === 'getPhoneNumber:ok') {
      // 使用云开发解密手机号
      if (wx.cloud) {
        wx.showLoading({ title: '获取中...' })
        wx.cloud.callFunction({
          name: 'getPhoneNumber',
          data: {
            cloudID: e.detail.cloudID
          },
          success: (res) => {
            wx.hideLoading()
            // 解密得到手机号明文
            if (res.result && res.result.phoneNumber) {
              this.setData({ contact: res.result.phoneNumber })
              wx.showToast({
                title: '获取成功',
                icon: 'success'
              })
            } else {
              wx.showToast({
                title: '解密失败，请手动输入',
                icon: 'none'
              })
            }
          },
          fail: (err) => {
            wx.hideLoading()
            console.error('解密手机号失败', err)
            wx.showToast({
              title: '解密失败，请手动输入',
              icon: 'none'
            })
          }
        })
      } else {
        // 未开云开发，只提示
        wx.showToast({
          title: '已获取授权，请手动输入手机号',
          icon: 'success'
        })
      }
    } else {
      wx.showToast({
        title: '获取失败',
        icon: 'none'
      })
    }
  },

  // 提交反馈
  submitFeedback() {
    const { content, contact } = this.data

    if (!content || content.length < 5) {
      wx.showToast({ title: '请输入至少5个字符', icon: 'none' })
      return
    }

    // 收集反馈数据
    const feedback = {
      content: content,
      contact: contact,
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
