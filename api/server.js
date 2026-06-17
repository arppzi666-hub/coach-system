// server.js - Minimal Vercel API + static
var fs = require("fs");
var path = require("path");

// === In-memory store (persists between requests on same instance) ===
var _data = { students: [], courses: [], checkins: [], pauses: [] };

function loadData() {
  // Try /tmp first for cold start recovery
  if (!_data.students || _data.students.length === 0) {
    try {
      if (fs.existsSync("/tmp/data.json")) {
        var loaded = JSON.parse(fs.readFileSync("/tmp/data.json", "utf-8"));
        if (loaded && loaded.students) _data = loaded;
      }
    } catch(e) {}
  }
  return _data;
}

function saveDataSync(d) {
  _data = d;
  try { fs.writeFileSync("/tmp/data.json", JSON.stringify(d), "utf-8"); } catch(e) {}
}

// === Helpers ===
function parseBody(req) {
  return new Promise(function(resolve) {
    var b = "";
    req.on("data", function(c) { b += c; });
    req.on("end", function() { try { resolve(b ? JSON.parse(b) : {}); } catch(e) { resolve({}); } });
  });
}

var CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function sendJSON(res, data, code) {
  res.writeHead(code || 200, Object.assign({"Content-Type": "application/json; charset=utf-8"}, CORS));
  res.end(JSON.stringify(data));
}

// === Static ===
var MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".ico":"image/x-icon" };
var ADMIN_DIR = path.join(__dirname, "..", "admin");

function serveFile(res, fp) {
  var rp = path.resolve(fp);
  if (!rp.startsWith(path.resolve(ADMIN_DIR))) { res.writeHead(403); res.end("Forbidden"); return; }
  try {
    var data = fs.readFileSync(fp);
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "text/plain", "Cache-Control": "public, max-age=3600" });
    res.end(data);
  } catch(e) { res.writeHead(404); res.end("Not Found"); }
}

// === API ===
async function handleAPI(req, res, url, method) {
  var parts = url.pathname.split("/").filter(Boolean);
  var col = parts[1], id = parts[2];
  
  if (col === "batch") {
    var body = await parseBody(req), db = loadData(), tgt = db[body.collection];
    if (!tgt) return sendJSON(res, {error:"Invalid"}, 400);
    if (body.action === "add") {
      body.items.forEach(function(it) { tgt.push({ id:"id_"+Date.now()+"_"+Math.random().toString(36).substr(2,6), ...it, createTime: new Date().toISOString() }); });
      saveDataSync(db); return sendJSON(res, {success:true, count:body.items.length});
    }
    return sendJSON(res, {error:"Unknown"}, 400);
  }
  
  if (!["students","courses","checkins","pauses"].includes(col))
    return sendJSON(res, {error:"Invalid collection"}, 400);
  
  var db = loadData(), coll = db[col];
  
  if (method === "GET" && !id) {
    var f = coll, sp = url.searchParams;
    if (sp.has("phone") && col==="students") { var p=sp.get("phone"); f=coll.filter(function(x){return x.phone===p}); }
    if (sp.has("studentPhone") && col==="courses") { var spp=sp.get("studentPhone"); f=coll.filter(function(x){return x.studentPhone===spp||x.studentId===spp}); }
    if (sp.has("studentId")) { var sid=sp.get("studentId"); f=coll.filter(function(x){return x.studentId===sid}); }
    if (sp.has("courseId")) { var cid=sp.get("courseId"); f=coll.filter(function(x){return x.courseId===cid||x.cid===cid}); }
    return sendJSON(res, f);
  }
  
  if (method === "GET" && id) { var item=coll.find(function(x){return x.id===id}); if(!item) return sendJSON(res,{error:"Not found"},404); return sendJSON(res,item); }
  
  if (method === "POST" && !id) {
    var body=await parseBody(req), ni={id:"id_"+Date.now()+"_"+Math.random().toString(36).substr(2,6),...body,createTime:new Date().toISOString()};
    coll.push(ni); saveDataSync(db); return sendJSON(res,ni,201);
  }
  
  if (method === "PUT" && id) {
    var idx=coll.findIndex(function(x){return x.id===id}); if(idx===-1) return sendJSON(res,{error:"Not found"},404);
    var body=await parseBody(req); coll[idx]={...coll[idx],...body,id:coll[idx].id,updateTime:new Date().toISOString()};
    saveDataSync(db); return sendJSON(res,coll[idx]);
  }
  
  if (method === "DELETE" && id) {
    var idx=coll.findIndex(function(x){return x.id===id}); if(idx===-1) return sendJSON(res,{error:"Not found"},404);
    coll.splice(idx,1); saveDataSync(db); return sendJSON(res,{success:true});
  }
  
  return sendJSON(res,{error:"Unknown"},400);
}

module.exports = async function handler(req, res) {
  try {
    var url = new URL(req.url, "http://localhost");
    var method = req.method.toUpperCase();
    
    if (method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end(); return;
    }
    
    if (url.pathname.startsWith("/api/"))
      return handleAPI(req, res, url, method);
    
    var fp = (url.pathname === "/" || url.pathname === "") ? path.join(ADMIN_DIR,"index.html") : path.join(ADMIN_DIR, url.pathname);
    serveFile(res, fp);
  } catch(e) {
    console.error(e);
    sendJSON(res, {error: e.message}, 500);
  }
};