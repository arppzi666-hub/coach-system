var SERVER_URL = "http://localhost:3000/api";

Page({
  data: { text: "", msg: "", status: "就绪", log: "" },

  onLoad: function() {
    try {
      wx.cloud.init({ env: "cloud1-d0g1y2kcw2a5475ac" });
      this.addLog("云初始化成功");
      this.setData({ status: "✅ 云数据库就绪" });
    } catch(e) {
      this.addLog("云初始化失败: " + e.message);
      this.setData({ status: "❌ 云初始化失败" });
    }
  },

  addLog: function(msg) {
    var now = new Date().toLocaleTimeString();
    var log = this.data.log + "\n" + now + " " + msg;
    this.setData({ log: log });
  },

  // 一键同步入口
  doSync: function() {
    var that = this;
    this.addLog("开始一键同步...");
    wx.showModal({
      title: "确认同步",
      content: "将清除云数据库旧数据后重新同步，确定？",
      success: function(res) {
        if (!res.confirm) { that.addLog("用户取消"); return; }
        that.addLog("用户确认");
        that.realSync();
      }
    });
  },

  // 真正同步逻辑
  realSync: function() {
    var that = this;
    wx.showLoading({ title: "清除旧数据..." });
    var db = wx.cloud.database();

    // 顺序清除4个集合
    var clearAll = function(colls, idx) {
      if (idx >= colls.length) {
        that.addLog("旧数据已清除");
        that.fetchAndWrite();
        return;
      }
      var coll = colls[idx];
      db.collection(coll).get().then(function(res) {
        if (res.data.length === 0) { clearAll(colls, idx + 1); return; }
        var dels = res.data.map(function(item) {
          return db.collection(coll).doc(item._id).remove();
        });
        Promise.all(dels).then(function() {
          clearAll(colls, idx + 1);
        });
      }).catch(function(e) {
        clearAll(colls, idx + 1);
      });
    };
    clearAll(["students", "courses", "checkins", "pauses"], 0);
  },

  // 拉取服务器数据并写入
  fetchAndWrite: function() {
    var that = this;
    wx.showLoading({ title: "拉取服务器数据..." });

    Promise.all([
      this.req("/students"),
      this.req("/courses"),
      this.req("/checkins"),
      this.req("/pauses")
    ]).then(function(results) {
      var students = results[0] || [];
      var courses = results[1] || [];
      that.addLog("拉取: 学员" + students.length + " 课程" + courses.length);

      if (students.length === 0) {
        wx.hideLoading();
        wx.showToast({ title: "服务器暂无数据", icon: "none" });
        return;
      }

      wx.showLoading({ title: "写入云数据库..." });
      that.writeData(students, courses);
    }).catch(function(e) {
      wx.hideLoading();
      that.addLog("拉取失败: " + (e.errMsg || e.message));
      wx.showToast({ title: "无法连接服务器", icon: "none" });
    });
  },

  // 写入数据
  writeData: function(students, courses) {
    var that = this;
    var db = wx.cloud.database();
    var phoneToId = {};

    // 顺序写入学员
    var writeStu = function(i) {
      if (i >= students.length) {
        that.addLog("学员写完, 开始写课程...");
        writeCourse(0);
        return;
      }
      var s = students[i];
      db.collection("students").where({ phone: s.phone }).get().then(function(res) {
        if (res.data.length > 0) {
          phoneToId[s.phone] = res.data[0]._id;
          writeStu(i + 1);
        } else {
          db.collection("students").add({
            data: { name: s.name, phone: s.phone, createTime: new Date() }
          }).then(function(r) {
            phoneToId[s.phone] = r._id;
            writeStu(i + 1);
          });
        }
      }).catch(function() { writeStu(i + 1); });
    };

    var writeCourse = function(i) {
      if (i >= courses.length) {
        wx.hideLoading();
        that.addLog("全部完成!");
        that.setData({ msg: "✅ 同步成功！学员:" + students.length + " 课程:" + courses.length, status: "同步完成" });
        wx.showToast({ title: "同步成功", icon: "success" });
        // 反向推送：把CloudBase签到/请假同步到服务器
        that.pushToServer(db);
        return;
      }
      var c = courses[i];
      var sid = phoneToId[c.studentPhone] || c.studentId;
      db.collection("courses").add({ data: {
        studentId: sid, type: c.type,
        totalDays: c.totalDays || c.days || 30,
        totalSessions: c.totalSessions || c.sessions || 10,
        remainingSessions: c.remainingSessions || 10,
        startDate: c.startDate || "", endDate: c.endDate || "",
        status: c.status || "active", price: c.price || 0,
        createTime: new Date()
      }}).then(function() { writeCourse(i + 1); })
        .catch(function() { writeCourse(i + 1); });
    };

    writeStu(0);
  },

  req: function(path) {
    return new Promise(function(resolve, reject) {
      wx.request({
        url: SERVER_URL + path,
        success: function(r) { resolve(r.data); },
        fail: function(e) { reject(e); }
      });
    });
  },

  onInput: function(e) { this.setData({ text: e.detail.value }); },

  

  // 反向推送CloudBase数据到服务器
  pushToServer: function(db) {
    var that = this;
    this.addLog("反向推送签到数据到服务器...");
    Promise.all([
      db.collection("checkins").limit(200).get(),
      db.collection("pauses").limit(200).get()
    ]).then(function(results) {
      var checkins = results[0].data || [];
      var pauses = results[1].data || [];
      that.addLog("云端签到:" + checkins.length + " 请假:" + pauses.length);
      
      // Push each checkin
      var ciPromise = Promise.resolve();
      checkins.forEach(function(ci) {
        ciPromise = ciPromise.then(function() {
          return new Promise(function(resolve) {
            wx.request({
              url: "http://localhost:3000/api/checkins",
              method: "POST",
              data: { studentId: ci.studentId, courseId: ci.courseId, courseType: ci.courseType, checkinDate: ci.checkinDate, checkinTime: ci.checkinTime, createTime: ci.createTime },
              header: { "content-type": "application/json" },
              complete: resolve
            });
          });
        });
      });
      
      // Push each pause
      return ciPromise.then(function() {
        var pPromise = Promise.resolve();
        pauses.forEach(function(p) {
          pPromise = pPromise.then(function() {
            return new Promise(function(resolve) {
              wx.request({
                url: "http://localhost:3000/api/pauses",
                method: "POST",
                data: { studentId: p.studentId, courseId: p.courseId, courseType: p.courseType, pauseDate: p.pauseDate, reason: p.reason||"", status: p.status, type: p.type, createTime: p.createTime },
                header: { "content-type": "application/json" },
                complete: resolve
              });
            });
          });
        });
        return pPromise;
      });
    }).then(function() {
      that.addLog("数据已推送到服务器");
    }).catch(function(e) {
      that.addLog("推送失败: " + (e.message||""));
    });
  },
  importLocal: function() {
    var t = this.data.text.trim();
    if (!t) { wx.showToast({ title: "请粘贴数据", icon: "none" }); return; }
    try { var d = JSON.parse(t); } catch(e) { wx.showToast({ title: "JSON格式错误", icon: "none" }); return; }
    if (!d.students) { wx.showToast({ title: "数据格式不正确", icon: "none" }); return; }
    wx.setStorageSync("coach_students", d.students);
    if (d.courses) wx.setStorageSync("coach_courses", d.courses);
    this.setData({ msg: "✅ 已存本地" });
    wx.showToast({ title: "已存本地", icon: "success" });
  }
});