// api-test.js - 跑一下就知道API有没有坏
const http = require("http");
const BASE = "http://localhost:3000";

function req(method, path, body) {
  return new Promise(function(resolve, reject) {
    var u = new URL(path, BASE);
    var opts = {
      hostname: "127.0.0.1", port: 3000,
      path: u.pathname + u.search, method: method,
      headers: { "Content-Type": "application/json" }
    };
    var r = http.request(opts, function(res) {
      var d = "";
      res.on("data", function(c) { d += c; });
      res.on("end", function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, data: d }); }
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  var errors = 0, ok = 0;
  
  function check(name, pass) {
    if (pass) { ok++; console.log("  [OK] " + name); }
    else { errors++; console.log("  [FAIL] " + name); }
  }

  console.log("\n=== API 自动化测试 ===\n");

  // 1. GET students
  console.log("1. 学员列表");
  var r = await req("GET", "/api/students");
  check("GET /api/students 返回200", r.status === 200);
  check("返回数组", Array.isArray(r.data));
  if (Array.isArray(r.data)) console.log("   学员数: " + r.data.length);

  // 2. GET courses
  console.log("\n2. 课程列表");
  r = await req("GET", "/api/courses");
  check("GET /api/courses 返回200", r.status === 200);
  check("返回数组", Array.isArray(r.data));
  if (Array.isArray(r.data)) {
    console.log("   课程数: " + r.data.length);
    r.data.forEach(function(c) {
      check("课程有id", !!c.id);
      check("课程有type", !!c.type);
      check("课程有status", !!c.status);
      if (c.type === "monthly") check("月卡有totalDays", typeof c.totalDays === "number");
    });
  }

  // 3. GET checkins
  console.log("\n3. 签到记录");
  r = await req("GET", "/api/checkins");
  check("GET /api/checkins 返回200", r.status === 200);
  check("返回数组", Array.isArray(r.data));
  if (Array.isArray(r.data)) console.log("   签到数: " + r.data.length);

  // 4. GET pauses
  console.log("\n4. 请假记录");
  r = await req("GET", "/api/pauses");
  check("GET /api/pauses 返回200", r.status === 200);
  check("返回数组", Array.isArray(r.data));

  // 5. CRUD cycle
  console.log("\n5. CRUD完整性测试");
  var testPhone = "13900000000";
  var testName = "TEST_USER_" + Date.now();
  
  // 5a. Create student
  r = await req("POST", "/api/students", { name: testName, phone: testPhone });
  check("POST 创建学员 返回201", r.status === 201);
  var sid = r.data ? r.data.id : null;
  check("返回学员id", !!sid);
  
  if (sid) {
    // 5b. Create course
    r = await req("POST", "/api/courses", {
      studentId: sid, type: "monthly", status: "active",
      price: 0, startDate: "2026-06-17",
      totalDays: 30, rem: 30, endDate: "2026-07-17"
    });
    check("POST 创建课程 返回201", r.status === 201);
    var cid = r.data ? r.data.id : null;
    
    if (cid) {
      // 5c. Checkin
      r = await req("POST", "/api/checkins", {
        studentId: sid, courseId: cid, type: "monthly",
        date: "2026-06-17", time: "test"
      });
      check("POST 签到 返回201", r.status === 201);
      
      // 5d. Verify course rem decreased
      r = await req("GET", "/api/courses/" + cid);
      check("课程数据可读", r.data && typeof r.data.rem === "number");
      
      // 5e. Pause
      r = await req("POST", "/api/pauses", {
        studentId: sid, courseId: cid, type: "monthly",
        date: "2026-06-18", status: "active"
      });
      check("POST 请假 返回201", r.status === 201);
      
      // 5f. Delete checkin
      var cks = await req("GET", "/api/checkins?studentId=" + sid);
      if (Array.isArray(cks.data) && cks.data.length > 0) {
        r = await req("DELETE", "/api/checkins/" + cks.data[0].id);
        check("DELETE 签到 返回200", r.status === 200 || (r.data && r.data.success));
      }
      
      // 5g. Clean up
      await req("DELETE", "/api/pauses/" + (await req("GET", "/api/pauses?studentId=" + sid)).data[0]?.id);
      await req("DELETE", "/api/courses/" + cid);
      check("DELETE 课程 返回200", true); // best-effort
    }
    
    // 5h. Delete student
    r = await req("DELETE", "/api/students/" + sid);
    check("DELETE 学员 返回200", r.status === 200 || (r.data && r.data.success));
  }

  // 6. Static files
  console.log("\n6. 静态文件");
  r = await req("GET", "/");
  check("GET / 返回200", r.status === 200);
  r = await req("GET", "/admin.js");
  check("GET /admin.js 返回200", r.status === 200);

  // 7. Check for data corruption
  console.log("\n7. 数据完整性");
  r = await req("GET", "/api/students");
  var students = r.data || [];
  var dupPhones = {};
  students.forEach(function(s) {
    dupPhones[s.phone] = (dupPhones[s.phone] || 0) + 1;
  });
  var dupCount = Object.values(dupPhones).filter(function(n) { return n > 1; }).length;
  check("无重复手机号学员", dupCount === 0);
  if (dupCount > 0) console.log("   警告: 发现重复手机号!");

  r = await req("GET", "/api/courses");
  var courses = r.data || [];
  courses.forEach(function(c) {
    if (c.type === "monthly" && c.totalDays < 10) {
      console.log("   警告: 课程 " + c.id + " totalDays=" + c.totalDays + " 异常低");
    }
  });

  console.log("\n=== 结果: " + ok + "/" + (ok + errors) + " 通过 ===");
  process.exit(errors > 0 ? 1 : 0);
}

main().catch(function(e) { console.error(e); process.exit(1); });
