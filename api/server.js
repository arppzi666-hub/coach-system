// server.js - Vercel serverless API + static files
var fs = require("fs");
var path = require("path");

// =========== Store ============
// Strategy: Upstash REST API first, then /tmp file fallback
var storeReady = false;

async function loadData() {
  var url = process.env.UPSTASH_REDIS_URL;
  var token = process.env.UPSTASH_REDIS_TOKEN;
  
  // Try Upstash REST API
  if (url && token) {
    try {
      var resp = await fetch("https://" + url + "/get/coach_data?no_parse=true", {
        headers: { "Authorization": "Bearer " + token }
      });
      if (resp.ok) {
        var json = await resp.json();
        if (json.result) {
          var d = JSON.parse(json.result);
          console.log("[store] Upstash REST: loaded " + (d.students?d.students.length:0) + " students");
          return d;
        }
      }
    } catch(e) { console.log("[store] Upstash REST read failed:", e.message); }
  }
  
  // Fallback: /tmp file
  var tmpFile = "/tmp/data.json";
  try {
    if (fs.existsSync(tmpFile)) {
      return JSON.parse(fs.readFileSync(tmpFile, "utf-8"));
    }
  } catch(e) {}
  return { students: [], courses: [], checkins: [], pauses: [] };
}

async function saveData(d) {
  var url = process.env.UPSTASH_REDIS_URL;
  var token = process.env.UPSTASH_REDIS_TOKEN;
  var saved = false;
  
  if (url && token) {
    try {
      var resp = await fetch("https://" + url + "/set/coach_data", {
        method: "POST",
        headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify(JSON.stringify(d))
      });
      if (resp.ok) { saved = true; console.log("[store] Upstash REST: saved"); }
    } catch(e) { console.log("[store] Upstash REST write failed:", e.message); }
  }
  
  // Always save to /tmp as well
  try { fs.writeFileSync("/tmp/data.json", JSON.stringify(d), "utf-8"); saved = true; } catch(e) {}
  return saved;
}

// =========== Helpers ============
function parseBody(req) {
  return new Promise(function(r) {
    var b = "";
    req.on("data", function(c) { b += c; });
    req.on("end", function() { try { r(b ? JSON.parse(b) : {}); } catch(e) { r({}); } });
  });
}

function sendJSON(res, data, code) {
  var h = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  res.writeHead(code || 200, h);
  res.end(JSON.stringify(data));
}

// =========== Static ============
var MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".ico":"image/x-icon" };
var ADMIN_DIR = path.join(__dirname, "..", "admin");

function serveFile(res, fp) {
  var rp = path.resolve(fp), base = path.resolve(ADMIN_DIR);
  if (!rp.startsWith(base)) { res.writeHead(403); res.end("Forbidden"); return; }
  try {
    var data = fs.readFileSync(fp);
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "text/plain", "Cache-Control": "public, max-age=3600" });
    res.end(data);
  } catch(e) { res.writeHead(404); res.end("Not Found"); }
}

// =========== API ============
async function handleAPI(req, res, url, method) {
  var parts = url.pathname.split("/").filter(Boolean);
  var col = parts[1], id = parts[2];
  
  // Batch
  if (col === "batch") {
    var body = await parseBody(req);
    var db = await loadData();
    var tgt = db[body.collection];
    if (!tgt) return sendJSON(res, {error:"Invalid collection"}, 400);
    if (body.action === "add") {
      body.items.forEach(function(it) {
        tgt.push({ id: "id_"+Date.now()+"_"+Math.random().toString(36).substr(2,6), ...it, createTime: new Date().toISOString() });
      });
      await saveData(db);
      return sendJSON(res, {success:true, count:body.items.length});
    }
    return sendJSON(res, {error:"Unknown batch action"}, 400);
  }
  
  if (!["students","courses","checkins","pauses"].includes(col))
    return sendJSON(res, {error:"Invalid collection"}, 400);
  
  var db = await loadData();
  var coll = db[col];
  
  // GET all with filters
  if (method === "GET" && !id) {
    var f = coll;
    var sp = url.searchParams;
    if (sp.has("phone") && col==="students") { var p=sp.get("phone"); f=coll.filter(function(x){return x.phone===p}); }
    if (sp.has("studentPhone") && col==="courses") { var spp=sp.get("studentPhone"); f=coll.filter(function(x){return x.studentPhone===spp||x.studentId===spp}); }
    if (sp.has("studentId")) { var sid=sp.get("studentId"); f=coll.filter(function(x){return x.studentId===sid}); }
    if (sp.has("courseId")) { var cid=sp.get("courseId"); f=coll.filter(function(x){return x.courseId===cid||x.cid===cid}); }
    return sendJSON(res, f);
  }
  
  // GET by id
  if (method === "GET" && id) {
    var item = coll.find(function(x){return x.id===id});
    if (!item) return sendJSON(res, {error:"Not found"}, 404);
    return sendJSON(res, item);
  }
  
  // POST create
  if (method === "POST" && !id) {
    var body = await parseBody(req);
    var ni = { id:"id_"+Date.now()+"_"+Math.random().toString(36).substr(2,6), ...body, createTime: new Date().toISOString() };
    coll.push(ni);
    var ok = await saveData(db);
    if (ok) return sendJSON(res, ni, 201);
    return sendJSON(res, {error:"Save failed"}, 500);
  }
  
  // PUT update
  if (method === "PUT" && id) {
    var idx = coll.findIndex(function(x){return x.id===id});
    if (idx===-1) return sendJSON(res, {error:"Not found"}, 404);
    var body = await parseBody(req);
    coll[idx] = { ...coll[idx], ...body, id:coll[idx].id, updateTime: new Date().toISOString() };
    if (await saveData(db)) return sendJSON(res, coll[idx]);
    return sendJSON(res, {error:"Save failed"}, 500);
  }
  
  // DELETE
  if (method === "DELETE" && id) {
    var idx = coll.findIndex(function(x){return x.id===id});
    if (idx===-1) return sendJSON(res, {error:"Not found"}, 404);
    coll.splice(idx, 1);
    if (await saveData(db)) return sendJSON(res, {success:true});
    return sendJSON(res, {error:"Save failed"}, 500);
  }
  
  return sendJSON(res, {error:"Unknown"}, 400);
}

// =========== Handler ============
module.exports = async function handler(req, res) {
  try {
    var url = new URL(req.url, "http://localhost");
    var method = req.method.toUpperCase();
    
    if (method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers":"Content-Type" });
      res.end();
      return;
    }
    
    if (url.pathname.startsWith("/api/"))
      return handleAPI(req, res, url, method);
    
    var fp = (url.pathname === "/" || url.pathname === "")
      ? path.join(ADMIN_DIR, "index.html")
      : path.join(ADMIN_DIR, url.pathname);
    serveFile(res, fp);
  } catch(e) {
    console.error("Handler error:", e);
    sendJSON(res, {error:"Server error", message:e.message}, 500);
  }
};