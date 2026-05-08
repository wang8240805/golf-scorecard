Page({
  data: {
    url: '',
    title: '',
    content: '',
    useLocal: false
  },

  onLoad(options) {
    // 支持 type 参数显示本地内容
    if (options.type) {
      this.loadLocalContent(options.type)
      return
    }

    // 支持 url 参数显示网页
    if (options.url) {
      const url = decodeURIComponent(options.url)
      this.setData({ url, useLocal: false })
    }
    if (options.title) {
      const title = decodeURIComponent(options.title)
      this.setData({ title })
      wx.setNavigationBarTitle({ title })
    }
  },

  // 加载本地内容（用户协议、隐私政策）
  loadLocalContent(type) {
    const contents = {
      userAgreement: {
        title: '用户协议',
        content: this.getUserAgreementContent()
      },
      privacyPolicy: {
        title: '隐私政策',
        content: this.getPrivacyPolicyContent()
      }
    }

    const item = contents[type]
    if (item) {
      this.setData({
        title: item.title,
        content: item.content,
        useLocal: true
      })
      wx.setNavigationBarTitle({ title: item.title })
    }
  },

  // 用户协议内容
  getUserAgreementContent() {
    return `
更新日期：2024年1月

一、服务说明

WinPAR是一款高尔夫记分工具，为用户提供比赛记录、成绩统计、AI分析报告等功能。使用本服务即表示您同意遵守本协议。

二、用户账号

1. 您可以通过微信授权登录使用本服务。
2. 您应妥善保管账号信息，因账号泄露造成的损失由您自行承担。
3. 您不得将账号转让、出借给他人使用。

三、用户行为规范

1. 您承诺在使用本服务时遵守相关法律法规。
2. 您不得利用本服务从事违法违规活动。
3. 您不得干扰或破坏本服务的正常运行。

四、数据安全

1. 我们重视您的数据安全，采用行业标准的安全措施保护您的信息。
2. 您的比赛数据仅用于为您提供更好的服务体验。
3. 未经您的同意，我们不会向第三方披露您的个人信息。

五、知识产权

1. 本服务的所有内容（包括但不限于软件、文字、图片、数据等）的知识产权归我们所有。
2. 未经许可，您不得复制、修改、传播本服务的任何内容。

六、免责声明

1. 本服务按"现状"提供，不提供任何明示或暗示的保证。
2. 我们不对因网络、设备等原因造成的服务中断承担责任。
3. 我们保留随时修改或终止服务的权利。

七、协议修改

我们有权随时修改本协议，修改后的协议将在应用内公布。继续使用本服务即表示您接受修改后的协议。

八、联系我们

如有任何问题，请通过应用内的"意见反馈"功能联系我们。
    `
  },

  // 隐私政策内容
  getPrivacyPolicyContent() {
    return `
更新日期：2024年1月

WinPAR重视用户隐私保护。本隐私政策说明我们如何收集、使用和保护您的信息。

一、我们收集的信息

1. 账号信息：微信昵称、头像（用于比赛中的球员展示）
2. 比赛数据：您录入的成绩、球场选择、球员信息等
3. 设备信息：设备型号、操作系统版本（用于优化服务）
4. 位置信息：用于推荐附近球场（需您授权）

二、信息的使用

我们使用收集的信息用于：
1. 提供比赛记录和成绩统计服务
2. 生成AI分析报告
3. 推荐附近球场
4. 改进产品功能和用户体验
5. 提供客户支持

三、信息的存储

1. 您的比赛数据存储在微信云开发服务器和您的设备本地。
2. 我们采用行业标准的安全措施保护您的数据。
3. 您可以随时备份或删除您的数据。

四、信息的共享

1. 我们不会向第三方出售您的个人信息。
2. 您的比赛成绩会在多人比赛中同步给同组球员。
3. 法律法规要求披露时，我们会依法配合。

五、您的权利

1. 您有权查看、修改、删除您的个人信息。
2. 您有权撤回授权同意。
3. 您有权注销账号。

六、未成年人保护

我们非常重视未成年人的隐私保护。如果您是未成年人，请在监护人陪同下阅读本政策。

七、政策更新

我们可能会更新本隐私政策。更新后，我们会在应用内通知您。

八、联系我们

如有任何隐私相关问题，请通过应用内的"意见反馈"功能联系我们。
    `
  }
})
