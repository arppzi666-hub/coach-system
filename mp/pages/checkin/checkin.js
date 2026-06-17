var API = "https://coach-system-seven.vercel.app/api";

function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

Page({
  data: { activeCourses: [], selectedCourseId: "", recentCheckins: [] },
  onShow: function() {
    var s = wx.getStorageSync("currentStudent");
    if (!s) { wx.redirectTo({ url: "/pages/login/login" }); return; }
    var td = today();
    var that = this;
    var p1 = new Promise(function(resolve, reject) {
      wx.request({ url: API + "/courses?studentId=" + s.id, method: "GET", success: function(r) { resolve(r.data || []); }, fail: reject });
    });
    var p2 = new Promise(function(resolve, reject) {
      wx.request({ url: API + "/checkins?studentId=" + s.id, method: "GET", success: function(r) { resolve(r.data || []); }, fail: reject });
    });
    Promise.all([p1, p2]).then(function(results) {
      var courses = results[0].filter(function(c) { return c.status === "active"; });
      var checkins = results[1];
      var todayChecks = checkins.filter(function(c) { return (c.date || c.checkinDate) === td; });
      var todayIds = todayChecks.map(function(c) { return c.courseId || c.cid; });
      var ac = [];
      courses.forEach(function(c) {
        var isMonthly = c.type === "monthly";
        var rem;
        if (isMonthly) {
          rem = Math.max(0, Math.floor((new Date(c.endDate || td) - new Date(td)) / 86400000));
        } else {
          rem = c.rem !== undefined ? c.rem : c.total || 10;
        }
        if (rem <= 0 || todayIds.indexOf(c.id) !== -1) return;
        ac.push({ id: c.id, label: isMonthly ? "月卡" : "次卡", remaining: rem, unit: isMonthly ? "天" : "次", isMonthly: isMonthly, selected: false, selClass: "" });
      });
      var recent = checkins.slice(0, 10).map(function(c) {
        return { id: c.id, checkinDate: c.date || c.checkinDate, checkinTime: c.time || c.checkinTime, courseLabel: (c.type === "session" || c.courseType === "session") ? "次卡" : "月卡" };
      });
      that.setData({ activeCourses: ac, recentCheckins: recent });
    }).catch(function() { wx.showToast({ title: "网络错误", icon: "none" }); });
  },
  selectCourse: function(e) {
    var id = e.currentTarget.dataset.id;
    var list = this.data.activeCourses;
    list.forEach(function(c) { c.selected = c.id === id; c.selClass = c.id === id ? "checked" : ""; });
    this.setData({ activeCourses: list, selectedCourseId: id });
  },
  doCheckin: function() {
    var cid = this.data.selectedCourseId;
    if (!cid) { wx.showToast({ title: "请选择课程", icon: "none" }); return; }
    var s = wx.getStorageSync("currentStudent");
    var that = this;
    var course = this.data.activeCourses.find(function(c) { return c.id === cid; });
    if (!course) return;
    var ct = course.isMonthly ? "monthly" : "session";
    wx.request({
      url: API + "/checkins",
      method: "POST",
      data: { studentId: s.id, courseId: cid, type: ct, courseType: ct, date: today(), checkinDate: today(), time: new Date().toLocaleTimeString(), checkinTime: new Date().toLocaleTimeString(), createTime: new Date().toISOString() },
      header: { "content-type": "application/json" },
      success: function() {
        // 月卡和次卡都减rem
        var newRem = course.remaining - 1;
        wx.request({ url: API + "/courses/" + cid, method: "PUT", data: { rem: newRem, totalDays: course.isMonthly ? newRem : undefined }, header: { "content-type": "application/json" } });
        wx.showToast({ title: "签到成功", icon: "success" });
        setTimeout(function() { that.onShow(); }, 800);
      },
      fail: function() { wx.showToast({ title: "签到失败", icon: "none" }); }
    });
  }
});
