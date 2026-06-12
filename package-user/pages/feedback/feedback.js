Page({
  data: {
    content: '',
    contact: '',
    contactType: 'phone',
    contactOptions: [
      { type: 'phone', label: '手机号' },
      { type: 'email', label: '邮箱' },
      { type: 'wechat', label: '微信号' }
    ],
    contactPlaceholder: '输入手机号，或点击上方授权',
    contactInputType: 'number',
    contentPlaceholder: '请描述遇到的问题、出现在哪个页面、希望我们如何改进...',
    feedbackContext: null,
    feedbackContextText: '',
    showThanks: false,
    contactSource: '',
    phoneMasked: ''
  },

  onLoad(options) {
    this.applyFeedbackContext(options || {})
    this.fillSavedContact()
  },

  onShow() {
    // 设置TabBar选中状态 - 反馈页面属于"我的"模块
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.fillSavedContact()
  },

  applyFeedbackContext(options) {
    var context = this.normalizeFeedbackContext(options)
    if (!context) return

    this.setData({
      feedbackContext: context,
      feedbackContextText: this.getFeedbackContextText(context),
      contentPlaceholder: this.getContextPlaceholder(context)
    })
  },

  normalizeFeedbackContext(options) {
    var keys = ['type', 'sourcePage', 'message', 'courseName', 'gameId', 'keyword', 'city']
    var context = {}
    var self = this
    keys.forEach(function(key) {
      var value = options[key]
      if (value === undefined || value === null) return
      value = self.safeDecode(String(value)).trim()
      if (value) {
        context[key] = value
      }
    })
    return Object.keys(context).length > 0 ? context : null
  },

  safeDecode(value) {
    try {
      return decodeURIComponent(value)
    } catch (e) {
      return value
    }
  },

  getFeedbackContextText(context) {
    if (context.type === 'course_missing') {
      return '来源：找不到球场' + (context.keyword ? ' - ' + context.keyword : '')
    }
    if (context.type === 'ocr_error') return '来源：计分卡识别失败'
    if (context.type === 'scorecard_error') return '来源：记分卡异常'
    if (context.type === 'report_error') return '来源：战报或海报异常'
    return context.sourcePage ? '来源：' + context.sourcePage : ''
  },

  getContextPlaceholder(context) {
    if (context.type === 'course_missing') {
      return '请补充球场名称、所在城市，或描述你没找到的球场...'
    }
    if (context.type === 'ocr_error') {
      return '请说明识别失败的计分卡类型、球场名称，或图片大致情况...'
    }
    if (context.type === 'scorecard_error') {
      return '请描述记分卡在哪一步失败，是否影响保存或同步...'
    }
    if (context.type === 'report_error') {
      return '请描述战报或海报生成/保存时遇到的问题...'
    }
    return '请描述遇到的问题、出现在哪个页面、希望我们如何改进...'
  },

  fillSavedContact() {
    var userInfo = wx.getStorageSync('userInfo') || {}
    var savedPhone = userInfo.phoneNumber || ''
    var savedEmail = userInfo.email || ''
    var savedWechat = userInfo.wechatId || ''
    var savedContact = savedPhone || savedEmail || savedWechat
    var savedType = savedPhone ? 'phone' : (savedEmail ? 'email' : (savedWechat ? 'wechat' : ''))
    if (!this.data.contact && savedContact) {
      this.setData({
        contact: savedContact,
        contactType: savedType,
        contactPlaceholder: this.getContactPlaceholder(savedType),
        contactInputType: savedType === 'phone' ? 'number' : 'text',
        contactSource: savedPhone ? '已使用账号手机号' : '已使用账号联系方式',
        phoneMasked: savedPhone ? this.maskPhone(savedPhone) : ''
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
    var contact = e.detail.value
    this.setData({
      contact: contact,
      contactSource: contact ? '用户手动填写' : '',
      phoneMasked: ''
    })
  },

  onContactTypeTap(e) {
    var type = e.currentTarget.dataset.type
    this.setData({
      contactType: type,
      contact: '',
      contactSource: '',
      phoneMasked: '',
      contactPlaceholder: this.getContactPlaceholder(type),
      contactInputType: type === 'phone' ? 'number' : 'text'
    })
  },

  // 授权手机号，便于后续主动联系用户
  onGetPhoneNumber(e) {
    var self = this
    if (!e.detail || e.detail.errMsg !== 'getPhoneNumber:ok' || !e.detail.code) {
      wx.showToast({ title: '未授权手机号', icon: 'none' })
      return
    }

    if (!wx.cloud || !wx.cloud.callFunction) {
      wx.showToast({ title: '手机号授权暂不可用', icon: 'none' })
      return
    }

    wx.showLoading({ title: '获取中...' })
    wx.cloud.callFunction({
      name: 'getPhoneNumber',
      data: { code: e.detail.code },
      success: function(res) {
        var result = res.result || {}
        if (result.success && result.phoneNumber) {
          self.saveAuthorizedPhone(result.phoneNumber)
          wx.showToast({ title: '手机号已授权', icon: 'success' })
        } else {
          wx.showToast({ title: '获取手机号失败', icon: 'none' })
        }
      },
      fail: function() {
        wx.showToast({ title: '获取手机号失败', icon: 'none' })
      },
      complete: function() {
        wx.hideLoading()
      }
    })
  },

  saveAuthorizedPhone(phoneNumber) {
    var userInfo = wx.getStorageSync('userInfo') || {}
    userInfo.phoneNumber = phoneNumber
    wx.setStorageSync('userInfo', userInfo)

    this.setData({
      contact: phoneNumber,
      contactType: 'phone',
      contactSource: '用户授权手机号',
      phoneMasked: this.maskPhone(phoneNumber)
    })
  },

  detectContactType(contact) {
    var value = String(contact || '').trim()
    if (!value) return ''
    if (/^1\d{10}$/.test(value)) return 'phone'
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'
    return 'wechat'
  },

  maskPhone(phoneNumber) {
    return String(phoneNumber || '').replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
  },

  getContactPlaceholder(type) {
    if (type === 'email') return '输入邮箱，例如 name@example.com'
    if (type === 'wechat') return '输入微信号，方便我们添加联系'
    return '输入手机号，或点击上方授权'
  },

  validateContact(contact, type) {
    var value = String(contact || '').trim()
    if (!value) {
      return '请留下手机号、邮箱或微信号'
    }
    if (type === 'phone' && !/^1\d{10}$/.test(value)) {
      return '请输入正确的手机号'
    }
    if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return '请输入正确的邮箱'
    }
    if (type === 'wechat' && value.length < 3) {
      return '请输入正确的微信号'
    }
    return ''
  },

  saveManualContact(contact, type) {
    var userInfo = wx.getStorageSync('userInfo') || {}
    if (type === 'email') {
      userInfo.email = contact
    } else if (type === 'wechat') {
      userInfo.wechatId = contact
    } else if (type === 'phone') {
      userInfo.phoneNumber = contact
    }
    wx.setStorageSync('userInfo', userInfo)
  },

  getFeedbackUserInfo() {
    var userInfo = wx.getStorageSync('userInfo') || {}
    return {
      openid: userInfo.openid || '',
      unionid: userInfo.unionid || '',
      phoneNumber: userInfo.phoneNumber || '',
      email: userInfo.email || '',
      wechatId: userInfo.wechatId || ''
    }
  },

  // 提交反馈
  submitFeedback() {
    var content = this.data.content
    var contact = String(this.data.contact || '').trim()
    var contactType = this.data.contactType || this.detectContactType(contact)
    var contactSource = this.data.contactSource

    if (!content || content.length < 5) {
      wx.showToast({ title: '请输入至少5个字符', icon: 'none' })
      return
    }

    var contactError = this.validateContact(contact, contactType)
    if (contactError) {
      wx.showToast({ title: contactError, icon: 'none' })
      return
    }

    this.saveManualContact(contact, contactType)

    // 收集反馈数据
    const feedback = {
      content: content,
      contact: contact,
      contactType: contactType,
      contactSource: contactSource || '用户手动填写',
      feedbackContext: this.data.feedbackContext,
      timestamp: new Date().getTime(),
      userInfo: this.getFeedbackUserInfo()
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
