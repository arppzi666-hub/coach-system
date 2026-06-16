var API = "https://coach-system-seven.vercel.app/api";

Page({
  data: { checkins: [] },
  onShow: function() {
    var s = wx.getStorageSync("currentStudent");
    if (!s) { wx.redirectTo({ url: "/pages/login/login" }); return; }
    var that = this;
    wx.request({
      url: API + "/checkins?studentId=" + s.id,
      method: "GET",
      success: function(res) {
        var cs = ((res.data || []).slice(0, 50)).map(function(c) {
          var ct = c.courseType || c.type || "monthly";
          return {
            id: c.id,
            courseName: ct === "monthly" ? "鏈堝崱" : "娆″崱",
            tagClass: ct === "monthly" ? "monthly" : "session",
            tagText: ct === "monthly" ? "鏈堝崱" : "娆″崱",
            checkinDate: c.checkinDate || c.date,
            checkinTime: c.checkinTime || c.time
          };
        });
        that.setData({ checkins: cs });
      },
      fail: function() { wx.showToast({ title: "缃戠粶閿欒", icon: "none" }); }
    });
  }
});
