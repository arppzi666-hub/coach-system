var API = "https://coach-system-seven.vercel.app/api";

function today() { var d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

Page({
  data: { courses: [], selectedCourseId: "", selectedType: "", pauseDate: today(), reason: "", pauses: [] },
  onShow: function() {
    var s = wx.getStorageSync("currentStudent");
    if (!s) { wx.redirectTo({ url: "/pages/login/login" }); return; }
    var that = this;
    var p1 = new Promise(function(resolve, reject) {
      wx.request({ url: API + "/courses?studentId=" + s.id, method: "GET", success: function(r) { resolve(r.data || []); }, fail: reject });
    });
    var p2 = new Promise(function(resolve, reject) {
      wx.request({ url: API + "/pauses?studentId=" + s.id, method: "GET", success: function(r) { resolve(r.data || []); }, fail: reject });
    });
    Promise.all([p1, p2]).then(function(results) {
      var courses = results[0];
      var pauses = results[1];
      var mc = courses.map(function(c) {
        var isMonthly = c.type === "monthly";
        var pauseCount = pauses.filter(function(p) { return (p.courseId === c.id || p.cid === c.id) && p.status === "active"; }).length;
        return {
          id: c.id, isMonthly: isMonthly,
          label: isMonthly ? (isMonthly ? "月卡 · " + (c.totalDays || 30) + "天" : "次卡 · 剩余" + (c.rem !== undefined ? c.rem : c.total || 10) + "次"),
          limit: isMonthly ? (pauseCount + "/2次") : (pauseCount > 0 ? "已暂停" : "可暂停"),
          canPause: isMonthly ? (pauseCount < 2) : (pauseCount === 0),
          selected: false, selClass: ""
        };
      });
      var ps = pauses.map(function(p) {
        return { id: p.id, pauseDate: p.date || p.pauseDate, reason: p.reason || "", label: (p.type === "monthly" ? "月卡" : "次卡"), statusClass: p.status === "active" ? "paused" : "active", statusLabel: p.status === "active" ? "暂停中" : "已恢复" };
      });
      that.setData({ courses: mc, pauses: ps });
    }).catch(function() { wx.showToast({ title: "网络错误", icon: "none" }); });
  },
  selectCourse: function(e) {
    var id = e.currentTarget.dataset.id, type = e.currentTarget.dataset.type;
    var list = this.data.courses;
    list.forEach(function(c) { c.selected = c.id === id; c.selClass = c.id === id ? "checked" : ""; });
    this.setData({ courses: list, selectedCourseId: id, selectedType: type });
  },
  onDateChange: function(e) { this.setData({ pauseDate: e.detail.value }); },
  onReasonInput: function(e) { this.setData({ reason: e.detail.value }); },
  doPause: function() {
    var cid = this.data.selectedCourseId;
    if (!cid) { wx.showToast({ title: "请选择课程", icon: "none" }); return; }
    var s = wx.getStorageSync("currentStudent");
    var that = this;
    var ct = this.data.selectedType || "monthly";
    var td = today();
    
    // 1) 检查今天是否已签到
    wx.request({
      url: API + "/checkins?studentId=" + s.id + "&courseId=" + cid,
      method: "GET",
      success: function(checkRes) {
        var todayChecks = (checkRes.data || []).filter(function(c) { return (c.date || c.checkinDate) === td; });
        if (todayChecks.length > 0) {
          wx.showToast({ title: "今天已签到，不能请假", icon: "none" });
          return;
        }
        // 2) 检查请假次数限制
        wx.request({
          url: API + "/pauses?studentId=" + s.id,
          method: "GET",
          success: function(pauseRes) {
            var activePauses = (pauseRes.data || []).filter(function(p) { return (p.courseId === cid || p.cid === cid) && p.status === "active"; });
            var limit = ct === "monthly" ? 2 : 1;
            if (activePauses.length >= limit) {
              wx.showToast({ title: limit === 2 ? "本月请假已达上限(2次)" : "该课程已在暂停中", icon: "none" });
              return;
            }
            that.submitPause(cid, s.id, ct);
          },
          fail: function() { wx.showToast({ title: "网络错误", icon: "none" }); }
        });
      },
      fail: function() { wx.showToast({ title: "网络错误", icon: "none" }); }
    });
  },
  submitPause: function(cid, studentId, courseType) {
    var that = this;
    wx.request({
      url: API + "/pauses",
      method: "POST",
      data: { studentId: studentId, courseId: cid, cid: cid, courseType: courseType, type: courseType, date: this.data.pauseDate, pauseDate: this.data.pauseDate, reason: this.data.reason.trim(), status: "active", createTime: new Date().toISOString() },
      header: { "content-type": "application/json" },
      success: function() {
        wx.request({
          url: API + "/courses/" + cid,
          method: "PUT",
          data: { status: "paused" },
          header: { "content-type": "application/json" },
          complete: function() {
            wx.showToast({ title: "暂停成功", icon: "success" });
            setTimeout(function() { that.onShow(); }, 800);
          }
        });
      },
      fail: function() { wx.showToast({ title: "操作失败", icon: "none" }); }
    });
  }
});