App({
  onLaunch: function() {
    try {
      wx.cloud.init({ env: "cloud1-d0g1y2kcw2a5475ac", traceUser: true });
      this.db = wx.cloud.database();
      console.log('云开发初始化成功');
    } catch(e) {
      console.error('云开发初始化失败:', e);
      this.db = null;
    }
  },
  getDb: function() {
    return this.db || wx.cloud.database();
  }
});
