var SERVER_URL = "http://192.168.1.110:3000/api";

Page({
  data: { status: "", stats: "" },

  onShow: function() {
    this.refreshStatus();
  },

  refreshStatus: function() {
    var that = this;
    that.setData({ status: "妫€鏌ヤ腑..." });
    wx.showLoading({ title: "杩炴帴鏈嶅姟鍣?.." });
    Promise.all([
      new Promise(function(resolve) {
        wx.request({ url: SERVER_URL + "/students", method: "GET", success: function(r) { resolve(r.data || []); }, fail: function() { resolve(null); } });
      }),
      new Promise(function(resolve) {
        wx.request({ url: SERVER_URL + "/courses", method: "GET", success: function(r) { resolve(r.data || []); }, fail: function() { resolve(null); } });
      }),
      new Promise(function(resolve) {
        wx.request({ url: SERVER_URL + "/checkins", method: "GET", success: function(r) { resolve(r.data || []); }, fail: function() { resolve(null); } });
      }),
      new Promise(function(resolve) {
        wx.request({ url: SERVER_URL + "/pauses", method: "GET", success: function(r) { resolve(r.data || []); }, fail: function() { resolve(null); } });
      })
    ]).then(function(results) {
      wx.hideLoading();
      if (results[0] === null) {
        that.setData({ status: "鉂?鏃犳硶杩炴帴鏈嶅姟鍣?, stats: "" });
        wx.showToast({ title: "鏈嶅姟鍣ㄨ繛鎺ュけ璐?, icon: "none" });
        return;
      }
      var students = results[0], courses = results[1], checkins = results[2], pauses = results[3];
      that.setData({
        status: "鉁?鏈嶅姟鍣ㄨ繛鎺ユ甯?,
        stats: "瀛﹀憳: " + students.length + " | 璇剧▼: " + courses.length + " | 绛惧埌: " + checkins.length + " | 璇峰亣: " + pauses.length
      });
    });
  }
});
