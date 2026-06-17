const http = require("http");
const fs = require("fs");
const path = require("path");
// ============ Upstash persistent storage ============
var UPSTASH_URL = process.env.UPSTASH_REDIS_KV_REST_API_URL || "";
var UPSTASH_TOKEN = process.env.UPSTASH_REDIS_KV_REST_API_TOKEN || "";

function upstashGet(key) {
  return new Promise(function(resolve, reject) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return reject(new Error("no_upstash"));
    var u = new URL(UPSTASH_URL);
    var opts = {
      hostname: u.hostname, port: 443, path: "/get/" + key, method: "GET",
      headers: { "Authorization": "Bearer " + UPSTASH_TOKEN }
    };
    var req = require("https").request(opts, function(resp) {
      var d = ""; resp.on("data", function(c) { d += c; });
      resp.on("end", function() {
        try { var j = JSON.parse(d); resolve(j.result ? JSON.parse(j.result) : null); }
        catch(e) { resolve(null); }
      });
    });
    req.on("error", function(e) { reject(e); });
    req.setTimeout(5000, function() { req.destroy(); reject(new Error("timeout")); });
    req.end();
  });
}

function upstashSet(key, val) {
  return new Promise(function(resolve, reject) {
    if (!UPSTASH_URL || !UPSTASH_TOKEN) return reject(new Error("no_upstash"));
    var u = new URL(UPSTASH_URL);
    var body = JSON.stringify(val);
    var opts = {
      hostname: u.hostname, port: 443, path: "/set/" + key, method: "POST",
      headers: { "Authorization": "Bearer " + UPSTASH_TOKEN, "Content-Type": "application/json" }
    };
    var req = require("https").request(opts, function(resp) {
      var d = ""; resp.on("data", function(c) { d += c; });
      resp.on("end", function() { resolve(true); });
    });
    req.on("error", function(e) { reject(e); });
    req.setTimeout(5000, function() { req.destroy(); reject(new Error("timeout")); });
    req.write(body); req.end();
  });
}

const PORT = 3000;
const DATA_FILE = process.env.VERCEL ? "/tmp/data.json" : path.join(__dirname, "data.json");
const ADMIN_DIR = path.join(__dirname, "admin");

var _cache = null;
async function loadData() {
  if (_cache) return _cache;
  // 1) Try Upstash
  try {
    var d = await upstashGet("coach_data");
    if (d && d.students) { _cache = d; console.log("Loaded from Upstash:", d.students.length, "students"); return d; }
  } catch(e) { console.log("Upstash load failed:", e.message); }
  // 2) Try local file
  try {
    if (fs.existsSync(DATA_FILE)) {
      var d = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
      _cache = d; return d;
    }
  } catch (e) { console.error("File load error:", e.message); }
  // 3) Empty
  _cache = { students: [], courses: [], checkins: [], pauses: [] };
  return _cache;
}
function saveData(d) {
  _cache = d;
  var ok = true;
  // 1) Save to Upstash
  upstashSet("coach_data", d).then(function() { console.log("Saved to Upstash"); }).catch(function(e) { console.log("Upstash save failed:", e.message); });
  // 2) Save to local file
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), "utf-8"); }
  catch (e) { console.error("File save error:", e.message); ok = false; }
  return ok;
}
function parseBody(req) {
  return new Promise(function(resolve) {
    var body = "";
    req.on("data", function(c) { body += c; });
    req.on("end", function() { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { resolve({}); } });
  });
}
function sendJSON(res, data, code) {
  res.writeHead(code || 200, { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

var MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".json": "application/json" };
function serveFile(res, filePath) {
  var ext = path.extname(filePath);
  var ct = MIME[ext] || "text/plain";
  try {
    var data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": ct, "Access-Control-Allow-Origin": "*" });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
}

async function handleAPI(req, res, url, method) {
  var parts = url.pathname.split("/").filter(Boolean);
  var col = parts[1], id = parts[2];
  
  if (col === "batch") {
    var body = await parseBody(req), db = loadData(), tgt = db[body.collection];
    if (!tgt) return sendJSON(res, { error: "Invalid" }, 400);
    if (body.action === "add") {
      body.items.forEach(function(it) { tgt.push({ id: "id_" + Date.now() + "_" + Math.random().toString(36).substr(2,6), ...it, createTime: new Date().toISOString() }); });
      saveData(db); return sendJSON(res, { success: true, count: body.items.length });
    }
    return sendJSON(res, { error: "Unknown action" }, 400);
  }
  
  if (!["students", "courses", "checkins", "pauses"].includes(col)) return sendJSON(res, { error: "Invalid" }, 400);
  
  var db = loadData(), coll = db[col];
  
  if (method === "GET" && !id) {
    var f = coll;
    if (url.searchParams.has("phone") && col === "students") { var p = url.searchParams.get("phone"); f = coll.filter(function(x) { return x.phone === p; }); }
    if (url.searchParams.has("studentPhone") && col === "courses") { var sp = url.searchParams.get("studentPhone"); f = coll.filter(function(x) { return x.studentPhone === sp || x.studentId === sp; }); }
    if (url.searchParams.has("studentId")) { var sid = url.searchParams.get("studentId"); f = coll.filter(function(x) { return x.studentId === sid; }); }
    if (url.searchParams.has("courseId")) { var cid = url.searchParams.get("courseId"); f = coll.filter(function(x) { return x.courseId === cid || x.cid === cid; }); }
    return sendJSON(res, f);
  }
  if (method === "GET" && id) { var item = coll.find(function(x) { return x.id === id; }); if (!item) return sendJSON(res, { error: "Not found" }, 404); return sendJSON(res, item); }
  if (method === "POST" && !id) { var body = await parseBody(req), ni = { id: "id_" + Date.now() + "_" + Math.random().toString(36).substr(2,6), ...body, createTime: new Date().toISOString() }; coll.push(ni); if (saveData(db)) return sendJSON(res, ni, 201); return sendJSON(res, { error: "Save failed" }, 500); }
  if (method === "PUT" && id) { var idx = coll.findIndex(function(x) { return x.id === id; }); if (idx === -1) return sendJSON(res, { error: "Not found" }, 404); var body = await parseBody(req); coll[idx] = { ...coll[idx], ...body, id: coll[idx].id, updateTime: new Date().toISOString() }; if (saveData(db)) return sendJSON(res, coll[idx]); return sendJSON(res, { error: "Save failed" }, 500); }
  if (method === "DELETE" && id) { var idx = coll.findIndex(function(x) { return x.id === id; }); if (idx === -1) return sendJSON(res, { error: "Not found" }, 404); coll.splice(idx, 1); if (saveData(db)) return sendJSON(res, { success: true }); return sendJSON(res, { error: "Save failed" }, 500); }
  return sendJSON(res, { error: "Unknown" }, 400);
}

var server = http.createServer(async function(req, res) {
  var url = new URL(req.url, "http://localhost:" + PORT);
  var method = req.method.toUpperCase();
  
  if (method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" });
    return res.end();
  }
  
  if (url.pathname.startsWith("/api/")) return handleAPI(req, res, url, method);
  
  // Static files from admin/
  var filePath = url.pathname === "/" ? path.join(ADMIN_DIR, "index.html") : path.join(ADMIN_DIR, url.pathname);
  if (!filePath.startsWith(ADMIN_DIR)) { res.writeHead(403); res.end("Forbidden"); return; }
  serveFile(res, filePath);
});

server.listen(PORT, function() { console.log("Server: http://localhost:" + PORT); });
