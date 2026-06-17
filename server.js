const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const PORT = 3000;
const DATA_FILE = process.env.VERCEL ? "/tmp/data.json" : path.join(__dirname, "data.json");

// === Upstash persistent storage ===
var _upstashUrl = process.env.UPSTASH_REDIS_KV_REST_API_URL || "";
var _upstashToken = process.env.UPSTASH_REDIS_KV_REST_API_TOKEN || "";

function _fetchUpstash() {
  return new Promise(function(resolve) {
    if (!_upstashUrl || !_upstashToken) return resolve(null);
    try {
      var u = new URL(_upstashUrl);
      var req = https.request({
        hostname: u.hostname,
        path: "/get/coach_data",
        method: "GET",
        headers: { "Authorization": "Bearer " + _upstashToken }
      }, function(res) {
        var d = "";
        res.on("data", function(c) { d += c; });
        res.on("end", function() {
          try {
            var j = JSON.parse(d);
            if (j.result) {
              var parsed = JSON.parse(j.result);
              if (parsed && parsed.students) resolve(parsed);
              else resolve(null);
            } else resolve(null);
          } catch(e) { resolve(null); }
        });
      });
      req.on("error", function() { resolve(null); });
      req.setTimeout(8000, function() { req.destroy(); resolve(null); });
      req.end();
    } catch(e) { resolve(null); }
  });
}

function _syncUpstash(d) {
  if (!_upstashUrl || !_upstashToken) return;
  try {
    var u = new URL(_upstashUrl);
    var body = JSON.stringify(d);
    var req = https.request({
      hostname: u.hostname,
      path: "/set/coach_data",
      method: "POST",
      headers: {
        "Authorization": "Bearer " + _upstashToken,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, function() {});
    req.on("error", function() {});
    req.setTimeout(5000, function() { req.destroy(); });
    req.write(body);
    req.end();
  } catch(e) {}
}

// CRITICAL: Wait for Upstash restore BEFORE accepting any request.
var _dataReady = Promise.resolve();
if (process.env.VERCEL && _upstashUrl && _upstashToken) {
  console.log("Loading data from Upstash...");
  _dataReady = Promise.race([
    _fetchUpstash().then(function(remote) {
      if (remote && remote.students) {
        try { fs.writeFileSync(DATA_FILE, JSON.stringify(remote), "utf-8"); }
        catch(e) { console.error("Write error:", e.message); }
        console.log("Upstash restored: " + remote.students.length + " students, " + (remote.courses||[]).length + " courses");
      }
    }),
    new Promise(function(resolve) { setTimeout(resolve, 10000); })
  ]);
}

// === Data layer ===
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch(e) { console.error("Load error:", e.message); }
  return { students: [], courses: [], checkins: [], pauses: [] };
}

function saveData(d) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(d, null, 2), "utf-8");
    _syncUpstash(d);
    return true;
  } catch(e) {
    console.error("Save error:", e.message);
    _syncUpstash(d);
    return false;
  }
}

// === HTTP helpers ===
const ADMIN_DIR = path.join(__dirname, "admin");

function parseBody(req) {
  return new Promise(function(resolve) {
    var body = "";
    req.on("data", function(c) { body += c; });
    req.on("end", function() {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch(e) { resolve({}); }
    });
  });
}

function sendJSON(res, data, code) {
  res.writeHead(code || 200, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(JSON.stringify(data));
}

var MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json"
};

function serveFile(res, filePath) {
  var ext = path.extname(filePath);
  var ct = MIME[ext] || "text/plain";
  try {
    var data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": ct, "Access-Control-Allow-Origin": "*" });
    res.end(data);
  } catch(e) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
}

// === API router ===
async function handleAPI(req, res, url, method) {
  var parts = url.pathname.split("/").filter(Boolean);
  var col = parts[1], id = parts[2];

  // Special: full data restore (one-time recovery from local backup)
  if (col === "admin" && id === "restore" && method === "POST") {
    var restoreData = await parseBody(req);
    if (!restoreData || !restoreData.students) {
      return sendJSON(res, { error: "Invalid data format" }, 400);
    }
    // Write all collections
    var db = {
      students: restoreData.students || [],
      courses: restoreData.courses || [],
      checkins: restoreData.checkins || [],
      pauses: restoreData.pauses || []
    };
    if (saveData(db)) {
      return sendJSON(res, {
        success: true,
        students: db.students.length,
        courses: db.courses.length
      });
    }
    return sendJSON(res, { error: "Save failed" }, 500);
  }

  if (!["students", "courses", "checkins", "pauses"].includes(col)) {
    return sendJSON(res, { error: "Invalid collection" }, 400);
  }

  var db = loadData(), coll = db[col];

  if (method === "GET" && !id) {
    var f = coll;
    if (url.searchParams.has("phone") && col === "students") {
      var p = url.searchParams.get("phone");
      f = coll.filter(function(x) { return x.phone === p; });
    }
    if (url.searchParams.has("studentPhone") && col === "courses") {
      var sp = url.searchParams.get("studentPhone");
      f = coll.filter(function(x) { return x.studentPhone === sp || x.studentId === sp; });
    }
    if (url.searchParams.has("studentId")) {
      var sid = url.searchParams.get("studentId");
      f = coll.filter(function(x) { return x.studentId === sid; });
    }
    if (url.searchParams.has("courseId")) {
      var cid = url.searchParams.get("courseId");
      f = coll.filter(function(x) { return x.courseId === cid || x.cid === cid; });
    }
    return sendJSON(res, f);
  }

  if (method === "GET" && id) {
    var item = coll.find(function(x) { return x.id === id; });
    if (!item) return sendJSON(res, { error: "Not found" }, 404);
    return sendJSON(res, item);
  }

  if (method === "POST" && !id) {
    var body = await parseBody(req);
    var ni = {
      id: "id_" + Date.now() + "_" + Math.random().toString(36).substr(2,6),
      ...body,
      createTime: new Date().toISOString()
    };
    coll.push(ni);
    if (saveData(db)) return sendJSON(res, ni, 201);
    return sendJSON(res, { error: "Save failed" }, 500);
  }

  if (method === "PUT" && id) {
    var idx = coll.findIndex(function(x) { return x.id === id; });
    if (idx === -1) return sendJSON(res, { error: "Not found" }, 404);
    var body2 = await parseBody(req);
    coll[idx] = { ...coll[idx], ...body2, id: coll[idx].id, updateTime: new Date().toISOString() };
    if (saveData(db)) return sendJSON(res, coll[idx]);
    return sendJSON(res, { error: "Save failed" }, 500);
  }

  if (method === "DELETE" && id) {
    var idx2 = coll.findIndex(function(x) { return x.id === id; });
    if (idx2 === -1) return sendJSON(res, { error: "Not found" }, 404);
    coll.splice(idx2, 1);
    if (saveData(db)) return sendJSON(res, { success: true });
    return sendJSON(res, { error: "Save failed" }, 500);
  }

  return sendJSON(res, { error: "Unknown method" }, 400);
}

// === Main handler ===
var server = http.createServer(async function(req, res) {
  // BLOCK until Upstash data is loaded (prevents cold-start data loss!)
  await _dataReady;

  var url = new URL(req.url, "http://localhost:" + PORT);
  var method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  if (url.pathname.startsWith("/api/")) {
    return handleAPI(req, res, url, method);
  }

  // Static files from admin/
  var filePath = url.pathname === "/" ? path.join(ADMIN_DIR, "index.html") : path.join(ADMIN_DIR, url.pathname);
  if (!filePath.startsWith(ADMIN_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  serveFile(res, filePath);
});

server.listen(PORT, function() {
  console.log("Server ready: http://localhost:" + PORT);
});
