const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const DATA_FILE = path.join(__dirname, "data.json");

// Load/save data
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch (e) { console.error("Load error:", e.message); }
  return { students: [], courses: [], checkins: [], pauses: [] };
}

function saveData(data) {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8"); return true; }
  catch (e) { console.error("Save error:", e.message); return false; }
}

function parseBody(req) {
  return new Promise(function(resolve) {
    var body = "";
    req.on("data", function(c) { body += c; });
    req.on("end", function() {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch (e) { resolve({}); }
    });
  });
}

function sendJSON(res, data, code) {
  code = code || 200;
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(data));
}

// API routing
async function handleAPI(req, res, url, method) {
  var parts = url.pathname.split("/").filter(Boolean);
  var collection = parts[1];
  var id = parts[2];

  if (collection === "batch") {
    var body = await parseBody(req);
    var db = loadData();
    var target = db[body.collection];
    if (!target) return sendJSON(res, { error: "Invalid collection" }, 400);
    if (body.action === "add") {
      body.items.forEach(function(item) {
        target.push({ id: "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6), ...item, createTime: new Date().toISOString() });
      });
      saveData(db);
      return sendJSON(res, { success: true, count: body.items.length });
    }
    return sendJSON(res, { error: "Unknown action" }, 400);
  }

  if (!["students", "courses", "checkins", "pauses"].includes(collection)) {
    return sendJSON(res, { error: "Invalid collection" }, 400);
  }

  var db = loadData();
  var coll = db[collection];

  // GET /api/{collection} - with optional query filtering
  if (method === "GET" && !id) {
    // Support query filters: ?phone=xxx, ?studentPhone=xxx, ?studentId=xxx
    var filtered = coll;
    if (url.searchParams.has("phone") && collection === "students") {
      var phone = url.searchParams.get("phone");
      filtered = coll.filter(function(x) { return x.phone === phone; });
    }
    if (url.searchParams.has("studentPhone") && collection === "courses") {
      var studentPhone = url.searchParams.get("studentPhone");
      filtered = coll.filter(function(x) { return x.studentPhone === studentPhone || x.studentId === studentPhone; });
    }
    if (url.searchParams.has("studentId")) {
      var studentId = url.searchParams.get("studentId");
      filtered = coll.filter(function(x) { return x.studentId === studentId; });
    }
    if (url.searchParams.has("courseId")) {
      var courseId = url.searchParams.get("courseId");
      filtered = coll.filter(function(x) { return x.courseId === courseId || x.cid === courseId; });
    }
    return sendJSON(res, filtered);
  }

  // GET /api/{collection}/{id}
  if (method === "GET" && id) {
    var item = coll.find(function(x) { return x.id === id; });
    if (!item) return sendJSON(res, { error: "Not found" }, 404);
    return sendJSON(res, item);
  }

  // POST /api/{collection}
  if (method === "POST" && !id) {
    var body = await parseBody(req);
    var newItem = { id: "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6), ...body, createTime: new Date().toISOString() };
    coll.push(newItem);
    if (saveData(db)) return sendJSON(res, newItem, 201);
    return sendJSON(res, { error: "Save failed" }, 500);
  }

  // PUT /api/{collection}/{id}
  if (method === "PUT" && id) {
    var idx = coll.findIndex(function(x) { return x.id === id; });
    if (idx === -1) return sendJSON(res, { error: "Not found" }, 404);
    var body = await parseBody(req);
    coll[idx] = { ...coll[idx], ...body, id: coll[idx].id, updateTime: new Date().toISOString() };
    if (saveData(db)) return sendJSON(res, coll[idx]);
    return sendJSON(res, { error: "Save failed" }, 500);
  }

  // DELETE /api/{collection}/{id}
  if (method === "DELETE" && id) {
    var idx = coll.findIndex(function(x) { return x.id === id; });
    if (idx === -1) return sendJSON(res, { error: "Not found" }, 404);
    coll.splice(idx, 1);
    if (saveData(db)) return sendJSON(res, { success: true });
    return sendJSON(res, { error: "Save failed" }, 500);
  }

  return sendJSON(res, { error: "Unknown" }, 400);
}

// Admin page HTML (built at server start)
var ADMIN_HTML = "<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Coach Admin</title>\n<style>\n*{margin:0;padding:0;box-sizing:border-box}\nbody{font-family:Arial,sans-serif;background:#f0f2f5;font-size:14px;color:#333}\n.top{background:#FF6B35;color:#fff;padding:12px 20px;display:flex;justify-content:space-between;align-items:center}\n.top h1{font-size:18px}\n.top button{background:rgba(255,255,255,.2);color:#fff;border:none;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px}\n.tabs{display:flex;background:#fff;border-bottom:2px solid #eee}\n.tab{flex:1;padding:14px 8px;cursor:pointer;font-size:14px;color:#888;text-align:center;border-bottom:2px solid transparent;user-select:none}\n.tab.active{color:#FF6B35;border-bottom-color:#FF6B35;font-weight:bold}\n.tab:hover{background:#fff8f5}\n.main{padding:16px;max-width:960px;margin:0 auto}\n.card{background:#fff;border-radius:12px;padding:20px;margin-bottom:16px;box-shadow:0 1px 3px rgba(0,0,0,.06)}\n.card h3{font-size:16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}\n.stats{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}\n.stat{background:#fff;border-radius:10px;padding:16px;text-align:center;flex:1;min-width:120px;box-shadow:0 1px 2px rgba(0,0,0,.04)}\n.stat .n{font-size:28px;font-weight:bold;color:#FF6B35}\n.stat .l{font-size:12px;color:#999;margin-top:4px}\ntable{width:100%;border-collapse:collapse}\nth,td{padding:10px 12px;border-bottom:1px solid #f0f0f0;font-size:13px;text-align:left}\nth{color:#888;font-size:12px;background:#fafafa}\n.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}\n.tm{background:#fff0e8;color:#FF6B35}\n.ts{background:#e8f4ff;color:#3b82f6}\n.ta{background:#e8ffe8;color:#07c160}\n.tp{background:#fff8e8;color:#e6a817}\n.te{background:#ffe8e8;color:#fa5151}\n.empty{text-align:center;color:#bbb;padding:40px 0}\n.modal-mask{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.45);display:none;justify-content:center;align-items:center;z-index:999}\n.modal{background:#fff;border-radius:16px;padding:24px;width:92%;max-width:460px;max-height:80vh;overflow:auto}\n.toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 24px;border-radius:20px;font-size:13px;z-index:9999;opacity:0;transition:opacity .3s;pointer-events:none}\n.toast.show{opacity:1}\n.fg{margin-bottom:12px}\n.fg label{display:block;font-size:13px;font-weight:600;margin-bottom:4px;color:#555}\n.fg input,.fg select{width:100%;padding:9px 12px;border:1px solid #d9d9d9;border-radius:8px;font-size:14px}\n.fg input:focus,.fg select:focus{outline:none;border-color:#FF6B35}\n.btn{padding:9px 18px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}\n.btn:hover{opacity:.85}\n.bp{background:#FF6B35;color:#fff}\n.bo{background:#fff;color:#FF6B35;border:1px solid #FF6B35}\n.bd{background:#ff4d4f;color:#fff}\n.bs{padding:4px 10px;font-size:12px;border-radius:6px}\n</style>\n</head>\n<body>\n<div class=\"top\"><h1>Coach Admin</h1><button id=\"btnRefresh\">Refresh</button></div>\n<div class=\"tabs\">\n  <div class=\"tab active\" data-tab=\"0\">Dashboard</div>\n  <div class=\"tab\" data-tab=\"1\">Students</div>\n  <div class=\"tab\" data-tab=\"2\">Courses</div>\n  <div class=\"tab\" data-tab=\"3\">Check-ins</div>\n  <div class=\"tab\" data-tab=\"4\">Pauses</div>\n</div>\n<div class=\"main\" id=\"m\">Loading...</div>\n<div class=\"modal-mask\" id=\"mm\"><div class=\"modal\" id=\"mc\"></div></div>\n<div class=\"toast\" id=\"tx\"></div>\n<script>\n(function(){\n  var API = 'http://localhost:3000/api';\n  var T = 0;\n  var D = {s:[], c:[], k:[], p:[]};\n  var _okCallback = null;\n\n  function esc(s) { if (!s) return ''; s = String(s); return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }\n  function fmtDate(d) { if (!d) return '-'; var t = new Date(d); return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0'); }\n  function getStudent(id) { return D.s.find(function(s){ return s.id===id||s.phone===id; })||{name:'?',phone:'?'}; }\n  function toast(msg) { var e=document.getElementById('tx'); e.textContent=msg; e.classList.add('show'); setTimeout(function(){ e.classList.remove('show'); },2000); }\n\n  async function loadData() {\n    try { var r=await fetch(API+'/students'); var s=await r.json(); if(Array.isArray(s)) D.s=s; } catch(e) {}\n    try { var r=await fetch(API+'/courses'); var c=await r.json(); if(Array.isArray(c)) D.c=c; } catch(e) {}\n    try { var r=await fetch(API+'/checkins'); var k=await r.json(); if(Array.isArray(k)) D.k=k; } catch(e) {}\n    try { var r=await fetch(API+'/pauses'); var p=await r.json(); if(Array.isArray(p)) D.p=p; } catch(e) {}\n  }\n\n  function closeModal() { document.getElementById('mm').style.display='none'; _okCallback=null; }\n  function openModal(title, body, onOk) {\n    document.getElementById('mm').style.display='flex';\n    document.getElementById('mc').innerHTML='<h3>'+title+'</h3>'+body+'<div style=\"margin-top:20px;display:flex;gap:10px;justify-content:flex-end\"><button class=\"btn bo\" id=\"btnModalCancel\">Cancel</button><button class=\"btn bp\" id=\"btnModalOk\">OK</button></div>';\n    _okCallback = onOk || null;\n  }\n\n  function switchTab(n) {\n    T = n;\n    var tabs = document.querySelectorAll('.tab');\n    for (var i=0; i<tabs.length; i++) tabs[i].classList.toggle('active', Number(tabs[i].dataset.tab)===n);\n    render();\n  }\n\n  function render() {\n    if (T===0) renderDashboard();\n    else if (T===1) renderStudents();\n    else if (T===2) renderCourses();\n    else if (T===3) renderCheckins();\n    else renderPauses();\n  }\n\n  function renderDashboard() {\n    var m=document.getElementById('m');\n    var ac=D.c.filter(function(c){ return c.status==='active'; });\n    var mc=ac.filter(function(c){ return c.type==='monthly'; }).length;\n    var sc=ac.filter(function(c){ return c.type==='session'; }).length;\n    var rev=D.c.reduce(function(t,c){ return t+(c.price||0); },0);\n    var today=new Date().toISOString().slice(0,10);\n    var tdy=D.k.filter(function(k){ return (k.date||k.checkinDate)===today; }).length;\n    var ps=D.p.filter(function(p){ return p.status==='active'; }).length;\n    var h='<div class=\"stats\">';\n    h+='<div class=\"stat\"><div class=\"n\">'+D.s.length+'</div><div class=\"l\">Students</div></div>';\n    h+='<div class=\"stat\"><div class=\"n\">$'+rev+'</div><div class=\"l\">Revenue</div></div>';\n    h+='<div class=\"stat\"><div class=\"n\">'+mc+'/'+sc+'</div><div class=\"l\">Monthly/Session</div></div>';\n    h+='<div class=\"stat\"><div class=\"n\">'+tdy+'</div><div class=\"l\">Today</div></div>';\n    h+='<div class=\"stat\"><div class=\"n\">'+ps+'</div><div class=\"l\">Paused</div></div>';\n    h+='</div><div class=\"card\"><h3>Students ('+D.s.length+')</h3>';\n    if (D.s.length===0) { h+='<div class=\"empty\">No students yet</div>'; }\n    else { h+='<table><tr><th>Name</th><th>Phone</th><th>Courses</th></tr>';\n      D.s.forEach(function(s){ var n=D.c.filter(function(c){ return c.studentId===s.id; }).length;\n        h+='<tr><td><b>'+esc(s.name)+'</b></td><td>'+esc(s.phone)+'</td><td>'+n+'</td></tr>'; });\n      h+='</table>'; }\n    h+='</div>';\n    var recent=D.k.slice().sort(function(a,b){ return (b.createTime||b.date||'').localeCompare(a.createTime||a.date||''); }).slice(0,10);\n    h+='<div class=\"card\"><h3>Recent Check-ins</h3>';\n    if (recent.length===0) { h+='<div class=\"empty\">None</div>'; }\n    else { h+='<table><tr><th>Student</th><th>Date</th><th>Type</th></tr>';\n      recent.forEach(function(k){ var s=getStudent(k.studentId); var isS=k.type==='session'||k.courseType==='session';\n        h+='<tr><td><b>'+esc(s.name)+'</b></td><td>'+fmtDate(k.date||k.checkinDate)+'</td><td><span class=\"tag '+(isS?'ts':'tm')+'\">'+(isS?'Session':'Monthly')+'</span></td></tr>'; });\n      h+='</table>'; }\n    h+='</div>';\n    m.innerHTML=h;\n  }\n\n  function renderStudents() {\n    var m=document.getElementById('m');\n    var h='<div class=\"card\"><h3>Students <button class=\"btn bp\" id=\"btnAddStudent\">+ Add</button></h3>';\n    if (D.s.length===0) { h+='<div class=\"empty\">No students</div>'; }\n    else { h+='<table><tr><th>Name</th><th>Phone</th><th>Note</th><th>Courses</th><th></th></tr>';\n      D.s.forEach(function(s){ var n=D.c.filter(function(c){ return c.studentId===s.id; }).length;\n        h+='<tr><td><b>'+esc(s.name)+'</b></td><td>'+esc(s.phone)+'</td><td>'+esc(s.note||'-')+'</td><td>'+n+'</td>';\n        h+='<td><button class=\"btn bo bs\" data-student-edit=\"'+s.id+'\">Edit</button> <button class=\"btn bd bs\" data-student-del=\"'+s.id+'\">Del</button></td></tr>'; });\n      h+='</table>'; }\n    h+='</div>';\n    m.innerHTML=h;\n  }\n\n  async function addStudent() {\n    openModal('Add Student',\n      '<div class=\"fg\"><label>Name *</label><input id=\"sn\"></div><div class=\"fg\"><label>Phone *</label><input id=\"sp\"></div><div class=\"fg\"><label>Note</label><input id=\"st\"></div>',\n      async function(){\n        var n=document.getElementById('sn').value.trim(), p=document.getElementById('sp').value.trim();\n        if (!n||!p) { toast('Name and phone required'); return; }\n        var r=await fetch(API+'/students',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,phone:p,note:document.getElementById('st').value.trim()})});\n        if (r.ok) { await loadData(); render(); toast('Added'); } else { toast('Failed'); }\n      });\n  }\n\n  async function editStudent(id) {\n    var s=D.s.find(function(x){ return x.id===id; }); if (!s) return;\n    var nn=prompt('Name:',s.name); if (nn===null) return;\n    var np=prompt('Phone:',s.phone); if (np===null) return;\n    var nt=prompt('Note:',s.note||''); if (nt===null) return;\n    if (!nn||!np) return;\n    var r=await fetch(API+'/students/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:nn,phone:np,note:nt})});\n    if (r.ok) { await loadData(); render(); toast('Updated'); } else { toast('Failed'); }\n  }\n\n  async function deleteStudent(id) {\n    if (!confirm('Delete this student?')) return;\n    var r=await fetch(API+'/students/'+id,{method:'DELETE'});\n    if (r.ok) { await loadData(); render(); toast('Deleted'); } else { toast('Failed'); }\n  }\n\n  function renderCourses() {\n    var m=document.getElementById('m');\n    var h='<div class=\"card\"><h3>Courses <button class=\"btn bp\" id=\"btnAddCourse\">+ Add</button></h3>';\n    if (D.c.length===0) { h+='<div class=\"empty\">No courses</div>'; }\n    else { h+='<table><tr><th>Student</th><th>Type</th><th>Status</th><th>Price</th><th>Remain</th><th></th></tr>';\n      D.c.forEach(function(c){ var s=getStudent(c.studentId);\n        h+='<tr><td><b>'+esc(s.name)+'</b></td><td><span class=\"tag '+(c.type==='monthly'?'tm':'ts')+'\">'+(c.type==='monthly'?'Monthly':'Session')+'</span></td>';\n        h+='<td><span class=\"tag '+(c.status==='active'?'ta':c.status==='paused'?'tp':'te')+'\">'+(c.status||'?')+'</span></td>';\n        h+='<td>$'+(c.price||0)+'</td><td>'+(c.type==='monthly'?(c.totalDays||30)+'d':(c.rem!==undefined?c.rem:c.total||10)+'/'+(c.total||10)+'x')+'</td>';\n        h+='<td><button class=\"btn bo bs\" data-course-edit=\"'+c.id+'\">Edit</button> <button class=\"btn bd bs\" data-course-del=\"'+c.id+'\">Del</button></td></tr>'; });\n      h+='</table>'; }\n    h+='</div>';\n    m.innerHTML=h;\n  }\n\n  function addCourse() {\n    var opts=D.s.map(function(s){ return '<option value=\"'+s.id+'\">'+esc(s.name)+' ('+esc(s.phone)+')</option>'; }).join('');\n    openModal('Add Course',\n      '<div class=\"fg\"><label>Student</label><select id=\"cs\">'+opts+'</select></div>'+\n      '<div class=\"fg\"><label>Type</label><select id=\"ct\"><option value=\"monthly\">Monthly</option><option value=\"session\">Session</option></select></div>'+\n      '<div id=\"cgm\"><div class=\"fg\"><label>Days</label><input id=\"cdy\" type=\"number\" value=\"30\"></div><div class=\"fg\"><label>Start Date</label><input id=\"cdr\" type=\"date\" value=\"'+new Date().toISOString().slice(0,10)+'\"></div></div>'+\n      '<div id=\"cgs\" style=\"display:none\"><div class=\"fg\"><label>Sessions</label><input id=\"csn\" type=\"number\" value=\"10\"></div></div>'+\n      '<div class=\"fg\"><label>Price</label><input id=\"cp\" type=\"number\" value=\"0\"></div>',\n      async function(){\n        var type=document.getElementById('ct').value;\n        var d={studentId:document.getElementById('cs').value,type:type,status:'active',price:Number(document.getElementById('cp').value)||0,startDate:document.getElementById('cdr').value};\n        if (type==='monthly') { var days=Number(document.getElementById('cdy').value)||30; d.totalDays=days; var end=new Date(d.startDate); end.setDate(end.getDate()+days); d.endDate=end.toISOString().slice(0,10); }\n        else { var total=Number(document.getElementById('csn').value)||10; d.total=total; d.rem=total; }\n        var r=await fetch(API+'/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});\n        if (r.ok) { await loadData(); render(); toast('Created'); } else { toast('Failed'); }\n      });\n    // Type toggle handler - add after modal is rendered\n    setTimeout(function(){\n      var ctEl=document.getElementById('ct');\n      if (ctEl) ctEl.addEventListener('change',function(){\n        document.getElementById('cgm').style.display=ctEl.value==='monthly'?'':'none';\n        document.getElementById('cgs').style.display=ctEl.value==='monthly'?'none':'';\n      });\n    },50);\n  }\n\n  function editCourse(id) {\n    var c=D.c.find(function(x){ return x.id===id; }); if (!c) return;\n    var opts=D.s.map(function(s){ return '<option value=\"'+s.id+'\"'+(s.id===c.studentId?' selected':'')+'>'+esc(s.name)+' ('+esc(s.phone)+')</option>'; }).join('');\n    openModal('Edit Course',\n      '<div class=\"fg\"><label>Student</label><select id=\"cs\">'+opts+'</select></div>'+\n      '<div class=\"fg\"><label>Status</label><select id=\"cst\"><option value=\"active\"'+(c.status==='active'?' selected':'')+'>Active</option><option value=\"paused\"'+(c.status==='paused'?' selected':'')+'>Paused</option><option value=\"expired\"'+(c.status==='expired'?' selected':'')+'>Expired</option></select></div>'+\n      '<div class=\"fg\"><label>Price</label><input id=\"cp\" type=\"number\" value=\"'+(c.price||0)+'\"></div>',\n      async function(){\n        var r=await fetch(API+'/courses/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:document.getElementById('cs').value,status:document.getElementById('cst').value,price:Number(document.getElementById('cp').value)||0})});\n        if (r.ok) { await loadData(); render(); toast('Updated'); } else { toast('Failed'); }\n      });\n  }\n\n  async function deleteCourse(id) {\n    if (!confirm('Delete this course?')) return;\n    var r=await fetch(API+'/courses/'+id,{method:'DELETE'});\n    if (r.ok) { await loadData(); render(); toast('Deleted'); } else { toast('Failed'); }\n  }\n\n  function renderCheckins() {\n    var m=document.getElementById('m');\n    var h='<div class=\"card\"><h3>Check-ins ('+D.k.length+')</h3>';\n    if (D.k.length===0) { h+='<div class=\"empty\">None yet | Students check in from mini-program</div>'; }\n    else { var sorted=D.k.slice().sort(function(a,b){ return (b.createTime||b.date||'').localeCompare(a.createTime||a.date||''); });\n      h+='<table><tr><th>Student</th><th>Date</th><th>Time</th><th>Type</th><th></th></tr>';\n      sorted.forEach(function(k){ var s=getStudent(k.studentId); var isS=k.type==='session'||k.courseType==='session';\n        h+='<tr><td><b>'+esc(s.name)+'</b></td><td>'+fmtDate(k.date||k.checkinDate)+'</td><td>'+(k.time||k.checkinTime||'-')+'</td>';\n        h+='<td><span class=\"tag '+(isS?'ts':'tm')+'\">'+(isS?'Session':'Monthly')+'</span></td>';\n        h+='<td><button class=\"btn bd bs\" data-checkin-undo=\"'+k.id+'\">Undo</button></td></tr>'; });\n      h+='</table>'; }\n    h+='</div>';\n    m.innerHTML=h;\n  }\n\n  async function undoCheckin(id) {\n    if (!confirm('Undo this check-in?')) return;\n    var k=D.k.find(function(x){ return x.id===id; });\n    var r=await fetch(API+'/checkins/'+id,{method:'DELETE'});\n    if (r.ok) {\n      if (k&&(k.type==='session'||k.courseType==='session')&&(k.courseId||k.cid)) {\n        var cid=k.courseId||k.cid; var c=D.c.find(function(x){ return x.id===cid; });\n        if (c) await fetch(API+'/courses/'+c.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rem:(c.rem||0)+1})});\n      }\n      await loadData(); render(); toast('Undone');\n    } else { toast('Failed'); }\n  }\n\n  function renderPauses() {\n    var m=document.getElementById('m');\n    var act=D.p.filter(function(p){ return p.status==='active'; });\n    var hist=D.p.filter(function(p){ return p.status!=='active'; });\n    var h='<div class=\"card\"><h3>Active Pauses ('+act.length+')</h3>';\n    if (act.length===0) h+='<div class=\"empty\">None</div>';\n    else { h+='<table><tr><th>Student</th><th>Date</th><th>Type</th><th>Reason</th><th></th></tr>';\n      act.forEach(function(p){ var s=getStudent(p.studentId);\n        h+='<tr><td><b>'+esc(s.name)+'</b></td><td>'+fmtDate(p.date||p.pauseDate)+'</td><td>'+(p.type==='monthly'?'Monthly':'Session')+'</td><td>'+esc(p.reason||'-')+'</td>';\n        h+='<td><button class=\"btn bo bs\" data-pause-resume=\"'+p.id+'\">Resume</button></td></tr>'; });\n      h+='</table>'; }\n    h+='</div>';\n    if (hist.length>0) { h+='<div class=\"card\"><h3>History</h3><table><tr><th>Student</th><th>Date</th><th>Reason</th></tr>';\n      hist.slice(0,20).forEach(function(p){ var s=getStudent(p.studentId);\n        h+='<tr><td><b>'+esc(s.name)+'</b></td><td>'+fmtDate(p.date||p.pauseDate)+'</td><td>'+esc(p.reason||'-')+'</td></tr>'; });\n      h+='</table></div>'; }\n    if (D.p.length===0) h+='<div class=\"empty\">No pause records</div>';\n    m.innerHTML=h;\n  }\n\n  async function resumePause(id) {\n    if (!confirm('Resume?')) return;\n    var p=D.p.find(function(x){ return x.id===id; }); if (!p) return;\n    var r=await fetch(API+'/pauses/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'done'})});\n    if (r.ok) {\n      if (p.courseId||p.cid) { var cid=p.courseId||p.cid; await fetch(API+'/courses/'+cid,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'active'})}); }\n      await loadData(); render(); toast('Resumed');\n    } else { toast('Failed'); }\n  }\n\n  // Global event delegation\n  document.addEventListener('click', function(e) {\n    var el = e.target;\n\n    // Modal cancel\n    if (el.id === 'btnModalCancel') { closeModal(); return; }\n    // Modal OK\n    if (el.id === 'btnModalOk') { if (_okCallback) { _okCallback(); closeModal(); } return; }\n    // Close modal by clicking mask\n    if (el.id === 'mm') { closeModal(); return; }\n\n    // Refresh\n    if (el.id === 'btnRefresh' || el.closest('#btnRefresh')) { loadData().then(render).then(function(){ toast('Refreshed'); }); return; }\n\n    // Tabs\n    var tabEl = el.closest('.tab');\n    if (tabEl) { switchTab(Number(tabEl.dataset.tab)); return; }\n\n    // Add student\n    if (el.id === 'btnAddStudent' || el.closest('#btnAddStudent')) { addStudent(); return; }\n\n    // Edit student\n    var sid = (el.dataset.studentEdit || (el.closest('[data-student-edit]')||{}).dataset?.studentEdit);\n    if (sid) { editStudent(sid); return; }\n\n    // Delete student\n    var sd = (el.dataset.studentDel || (el.closest('[data-student-del]')||{}).dataset?.studentDel);\n    if (sd) { deleteStudent(sd); return; }\n\n    // Add course\n    if (el.id === 'btnAddCourse' || el.closest('#btnAddCourse')) { addCourse(); return; }\n\n    // Edit course\n    var cid = (el.dataset.courseEdit || (el.closest('[data-course-edit]')||{}).dataset?.courseEdit);\n    if (cid) { editCourse(cid); return; }\n\n    // Delete course\n    var cd = (el.dataset.courseDel || (el.closest('[data-course-del]')||{}).dataset?.courseDel);\n    if (cd) { deleteCourse(cd); return; }\n\n    // Undo checkin\n    var uid = (el.dataset.checkinUndo || (el.closest('[data-checkin-undo]')||{}).dataset?.checkinUndo);\n    if (uid) { undoCheckin(uid); return; }\n\n    // Resume pause\n    var pid = (el.dataset.pauseResume || (el.closest('[data-pause-resume]')||{}).dataset?.pauseResume);\n    if (pid) { resumePause(pid); return; }\n  });\n\n  // Init\n  loadData().then(function(){ render(); });\n})();\n</script>\n</body>\n</html>";

var server = http.createServer(async function(req, res) {
  var url = new URL(req.url, "http://localhost:" + PORT);
  var method = req.method.toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  // API
  if (url.pathname.startsWith("/api/")) {
    return handleAPI(req, res, url, method);
  }

  // Root - serve admin page
  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" });
    return res.end(ADMIN_HTML);
  }

  // Data view
  if (url.pathname === "/view" || url.pathname === "/data") {
    var db = loadData();
    var phoneMap = {};
    db.students.forEach(function(s) { if (s.id && s.phone) phoneMap[s.id] = s.phone; });
    var h = "<!DOCTYPE html><html lang=\"zh-CN\"><head><meta charset=\"UTF-8\"><title>Data View</title><style>body{font-family:Arial;padding:20px;background:#f5f5f5;max-width:1000px;margin:0 auto}h1{color:#FF6B35}h2{color:#333}table{width:100%;border-collapse:collapse;background:#fff;margin:10px 0}th,td{padding:10px 12px;border-bottom:1px solid #eee;text-align:left;font-size:13px}th{background:#fafafa;font-size:12px;color:#888}.card{background:#fff;border-radius:12px;padding:20px;margin:16px 0;box-shadow:0 1px 3px rgba(0,0,0,.05)}.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600}.tag-m{background:#fff0e8;color:#FF6B35}.tag-s{background:#e8f4ff;color:#3b82f6}.tag-a{background:#e8ffe8;color:#07c160}.tag-p{background:#fff8e8;color:#e6a817}.empty{color:#bbb;text-align:center;padding:30px}</style></head><body><h1>Data View</h1>";
    h += "<div class=\"card\"><h2>Students (" + db.students.length + ")</h2>";
    if (db.students.length) h += "<table><tr><th>Name</th><th>Phone</th></tr>" + db.students.map(function(s) { return "<tr><td><b>" + s.name + "</b></td><td>" + s.phone + "</td></tr>"; }).join("") + "</table>";
    else h += "<div class=\"empty\">None</div>";
    h += "</div>";
    h += "<div class=\"card\"><h2>Courses (" + db.courses.length + ")</h2>";
    if (db.courses.length) h += "<table><tr><th>Student</th><th>Type</th><th>Status</th><th>Price</th><th>Remain</th></tr>" + db.courses.map(function(c) { var s = db.students.find(function(x) { return x.id === c.studentId; }); return "<tr><td>" + (s ? s.name : "?") + "</td><td><span class=\"tag " + (c.type === "monthly" ? "tag-m" : "tag-s") + "\">" + (c.type === "monthly" ? "Monthly" : "Session") + "</span></td><td><span class=\"tag " + (c.status === "active" ? "tag-a" : c.status === "paused" ? "tag-p" : "") + "\">" + (c.status || "?") + "</span></td><td>$" + (c.price || 0) + "</td><td>" + (c.type === "monthly" ? (c.totalDays || 30) + "d" : (c.rem !== undefined ? c.rem : c.total || 10) + "/" + (c.total || 10) + "x") + "</td></tr>"; }).join("") + "</table>";
    else h += "<div class=\"empty\">None</div>";
    h += "</div>";
    h += "<div class=\"card\"><h2>Check-ins (" + db.checkins.length + ")</h2>";
    if (db.checkins.length) h += "<table><tr><th>Student</th><th>Date</th><th>Time</th><th>Type</th></tr>" + db.checkins.slice().sort(function(a, b) { return (b.createTime || "").localeCompare(a.createTime || ""); }).map(function(ci) { var s = db.students.find(function(x) { return x.id === ci.studentId || x.phone === ci.studentId; }); return "<tr><td>" + (s ? s.name : ci.studentId) + "</td><td>" + (ci.date || ci.checkinDate || "") + "</td><td>" + (ci.time || ci.checkinTime || "") + "</td><td><span class=\"tag " + (ci.type === "session" || ci.courseType === "session" ? "tag-s" : "tag-m") + "\">" + (ci.type === "session" || ci.courseType === "session" ? "Session" : "Monthly") + "</span></td></tr>"; }).join("") + "</table>";
    else h += "<div class=\"empty\">None</div>";
    h += "</div>";
    h += "<div class=\"card\"><h2>Pauses (" + db.pauses.length + ")</h2>";
    if (db.pauses.length) h += "<table><tr><th>Student</th><th>Date</th><th>Status</th><th>Reason</th></tr>" + db.pauses.map(function(p) { var s = db.students.find(function(x) { return x.id === p.studentId || x.phone === p.studentId; }); return "<tr><td>" + (s ? s.name : p.studentId) + "</td><td>" + (p.date || p.pauseDate || "") + "</td><td>" + (p.status === "active" ? "Active" : "Done") + "</td><td>" + (p.reason || "-") + "</td></tr>"; }).join("") + "</table>";
    else h += "<div class=\"empty\">None</div>";
    h += "</div><p style=\"color:#999;font-size:12px;text-align:center;margin:30px 0\"><a href=\"/\">Back to Admin</a></p></body></html>";
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Access-Control-Allow-Origin": "*" });
    return res.end(h);
  }

  // 404
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, function() {
  console.log("Coach Admin server: http://localhost:" + PORT);
  console.log("Data file:", DATA_FILE);
});