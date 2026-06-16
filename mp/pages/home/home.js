var API = "https://coach-system-seven.vercel.app/api";

function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function diffDays(d1, d2) { return Math.floor((new Date(d2 || today()) - new Date(d1)) / 86400000); }

Page({
  data: { student: {}, courses: [] },
  onShow: function() {
    var s = wx.getStorageSync("currentStudent");
    if (!s) { wx.redirectTo({ url: "/pages/login/login" }); return; }
    this.setData({ student: s });
    var that = this;
    wx.request({
      url: API + "/courses?studentId=" + s.id,
      method: "GET",
      success: function(res) {
        var courses = res.data || [];
        var cs = [];
        courses.forEach(function(c) {
          var isMonthly = c.type === "monthly";
          var total = isMonthly ? (c.totalDays || 30) : (c.total || 10);
          var rem;
          if (isMonthly) {
            var ed = c.endDate || today();
            rem = Math.max(0, Math.floor((new Date(ed) - new Date(today())) / 86400000));
          } else {
            rem = c.rem !== undefined ? c.rem : c.total || 10;
          }
          var pct = Math.min(100, Math.round((total - Math.max(0, rem)) / total * 100));
          cs.push({
            id: c.id,
            isMonthly: isMonthly,
            tagClass: isMonthly ? "monthly" : "session",
            tagLabel: isMonthly ? "月卡" : "次卡",
            statusClass: c.status === "paused" ? "paused" : (rem <= 0 ? "expired" : "active"),
            statusLabel: c.status === "paused" ? "暂停中" : (rem <= 0 ? "已到期" : "进行中"),
            remaining: rem,
            progress: pct,
            dateRange: (c.startDate || "") + " ~ " + (c.endDate || "")
          });
        });
        that.setData({ courses: cs });
      },
      fail: function() { wx.showToast({ title: "网络错误", icon: "none" }); }
    });
  },
  goCheckin: function() { wx.navigateTo({ url: "/pages/checkin/checkin" }); },
  goPause: function() { wx.navigateTo({ url: "/pages/pause/pause" }); },
  goHistory: function() { wx.navigateTo({ url: "/pages/history/history" }); }
});
