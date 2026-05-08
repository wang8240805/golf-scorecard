/**
 * 通用模态框组件
 * 使用方法：
 * <modal show="{{showModal}}" title="标题" bind:close="hideModal">
 *   <!-- 内容插槽 -->
 * </modal>
 */

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    title: {
      type: String,
      value: ''
    },
    showClose: {
      type: Boolean,
      value: true
    },
    // 点击遮罩是否关闭
    closeOnClickOverlay: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    onOverlayTap() {
      if (this.properties.closeOnClickOverlay) {
        this.triggerEvent('close')
      }
    },

    onCloseTap() {
      this.triggerEvent('close')
    },

    preventHide() {
      // 阻止事件冒泡，防止点击内容区关闭
    }
  }
})
