Page({
  data: { checkins: [] },
  onShow: function() {
    var s = wx.getStorageSync("currentStudent");
    if (!s) { wx.redirectTo({ url: "/pages/login/login" }); return; }
    var that = this;
    var db = wx.cloud.database();
    
    db.collection("checkins").where({ studentId: s._id }).orderBy("createTime", "desc").limit(50).get().then(function(res) {
      var cs = res.data.map(function(c) {
        return { id: c._id, courseName: c.courseType === "monthly" ? "月卡" : "次卡", tagClass: c.courseType === "monthly" ? "monthly" : "session", tagText: c.courseType === "monthly" ? "月卡" : "次卡", checkinDate: c.checkinDate, checkinTime: c.checkinTime };
      });
      that.setData({ checkins: cs });
    }).catch(function(e) { console.error(e); });
  }
});
