var API = "http://localhost:3000/api";

Page({
  data: { phone: "" },
  onShow: function() {},
  onPhoneInput: function(e) { this.setData({ phone: e.detail.value }); },
  
  doAdmin: function() {
    wx.showModal({
      title: "教练验证",
      content: "请输入教练密码",
      editable: true,
      placeholderText: "输入密码",
      success: function(res) {
        if (res.confirm && res.content === "coach2024") {
          wx.navigateTo({ url: "/pages/sync/sync" });
        } else if (res.confirm) {
          wx.showToast({ title: "密码错误", icon: "none" });
        }
      }
    });
  },
  
  doLogin: function() {
    var p = this.data.phone.trim();
    if (!p || p.length !== 11 || !/^\d+$/.test(p)) {
      wx.showToast({ title: "请输入11位手机号", icon: "none" });
      return;
    }
    wx.showLoading({ title: "登录中" });
    var that = this;
    wx.request({
      url: API + "/students?phone=" + p,
      method: "GET",
      success: function(res) {
        var ss = res.data || [];
        if (ss.length > 0) {
          var s = ss[0];
          wx.setStorageSync("currentStudent", { id: s.id, name: s.name, phone: s.phone });
          wx.hideLoading();
          wx.redirectTo({ url: "/pages/home/home" });
        } else {
          wx.request({
            url: API + "/students",
            method: "POST",
            data: { name: "学员" + p.slice(-4), phone: p, note: "" },
            header: { "content-type": "application/json" },
            success: function(r2) {
              var ns = r2.data;
              wx.setStorageSync("currentStudent", { id: ns.id, name: ns.name, phone: ns.phone });
              wx.hideLoading();
              wx.redirectTo({ url: "/pages/home/home" });
            },
            fail: function() { wx.hideLoading(); wx.showToast({ title: "网络错误", icon: "none" }); }
          });
        }
      },
      fail: function() { wx.hideLoading(); wx.showToast({ title: "无法连接服务器", icon: "none" }); }
    });
  }
});
