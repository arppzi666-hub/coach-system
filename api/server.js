// Vercel serverless function - handles API + static files
const http = require("http");
const fs = require("fs");
const path = require("path");

// ============ Data store (auto-detects Vercel KV / Upstash Redis / in-memory) ============
let _store = null;
let _storeType = "pending";

async function getStore() {
  if (_store) return _store;

  // 1) Try Vercel KV (auto-injected when KV is linked to project)
  try {
    const { kv } = await import("@vercel/kv");
    await kv.get("__health__");
    _store = {
      get: async function(key) { var d = await kv.get(key); return d || { students: [], courses: [], checkins: [], pauses: [] }; },
      set: async function(key, val) { await kv.set(key, JSON.parse(JSON.stringify(val))); return true; }
    };
    _storeType = "vercel-kv";
    console.log("[store] Vercel KV ready");
  } catch (e) {
    console.log("[store] Vercel KV not available:", e.message);
  }

  // 2) Try Upstash Redis (env vars)
  if (!_store && process.env.UPSTASH_REDIS_URL && process.env.UPSTASH_REDIS_TOKEN) {
    try {
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({ url: process.env.UPSTASH_REDIS_URL, token: process.env.UPSTASH_REDIS_TOKEN });
      await redis.ping();
      _store = {
        get: async function(key) { var d = await redis.get(key); return d || { students: [], courses: [], checkins: [], pauses: [] }; },
        set: async function(key, val) { await redis.set(key, JSON.parse(JSON.stringify(val))); return true; }
      };
      _storeType = "upstash-redis";
      console.log("[store] Upstash Redis ready");
    } catch (e) {
      console.log("[store] Upstash Redis not available:", e.message);
    }
  }

  // 3) Fallback: in-memory (persists across warm invocations only)
  if (!_store) {
    var mem = { students: [], courses: [], checkins: [], pauses: [] };
    _store = {
      get: async function() { return mem; },
      set: async function(_, val) { mem = JSON.parse(JSON.stringify(val)); return true; }
    };
    _storeType = "memory";
    console.log("[store] In-memory fallback (data resets on cold start)");
  }

  return _store;
}

async function loadData() {
  var s = await getStore();
  return s.get("coach_data");
}

async function saveData(d) {
  var s = await getStore();
  return s.set("coach_data", d);
}

// ============ API helpers ============
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
  res.writeHead(code || 200, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

// ============ Static file serving ============
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml"
};

var ADMIN_DIR = path.join(process.cwd(), "admin");

function serveFile(res, filePath) {
  // Security: ensure we stay inside admin/
  var resolved = path.resolve(filePath);
  var adminResolved = path.resolve(ADMIN_DIR);
  if (!resolved.startsWith(adminResolved)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  var ext = path.extname(filePath).toLowerCase();
  var ct = MIME[ext] || "text/plain";
  try {
    var data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": ct, "Cache-Control": "public, max-age=3600" });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  }
}

// ============ API router ============
async function handleAPI(req, res, url, method) {
  var parts = url.pathname.split("/").filter(Boolean);
  var col = parts[1];
  var id = parts[2];

  // Batch operations
  if (col === "batch") {
    var body = await parseBody(req);
    var db = await loadData();
    var tgt = db[body.collection];
    if (!tgt) return sendJSON(res, { error: "Invalid collection" }, 400);
    if (body.action === "add") {
      body.items.forEach(function(it) {
        tgt.push({
          id: "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
          ...it,
          createTime: new Date().toISOString()
        });
      });
      await saveData(db);
      return sendJSON(res, { success: true, count: body.items.length });
    }
    return sendJSON(res, { error: "Unknown batch action" }, 400);
  }

  // Validate collection
  if (!["students", "courses", "checkins", "pauses"].includes(col)) {
    return sendJSON(res, { error: "Invalid collection" }, 400);
  }

  var db = await loadData();
  var coll = db[col];

  // GET all with filters
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

  // GET by id
  if (method === "GET" && id) {
    var item = coll.find(function(x) { return x.id === id; });
    if (!item) return sendJSON(res, { error: "Not found" }, 404);
    return sendJSON(res, item);
  }

  // POST create
  if (method === "POST" && !id) {
    var body = await parseBody(req);
    var ni = {
      id: "id_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6),
      ...body,
      createTime: new Date().toISOString()
    };
    coll.push(ni);
    if (await saveData(db)) return sendJSON(res, ni, 201);
    return sendJSON(res, { error: "Save failed" }, 500);
  }

  // PUT update
  if (method === "PUT" && id) {
    var idx = coll.findIndex(function(x) { return x.id === id; });
    if (idx === -1) return sendJSON(res, { error: "Not found" }, 404);
    var body = await parseBody(req);
    coll[idx] = { ...coll[idx], ...body, id: coll[idx].id, updateTime: new Date().toISOString() };
    if (await saveData(db)) return sendJSON(res, coll[idx]);
    return sendJSON(res, { error: "Save failed" }, 500);
  }

  // DELETE
  if (method === "DELETE" && id) {
    var idx = coll.findIndex(function(x) { return x.id === id; });
    if (idx === -1) return sendJSON(res, { error: "Not found" }, 404);
    coll.splice(idx, 1);
    if (await saveData(db)) return sendJSON(res, { success: true });
    return sendJSON(res, { error: "Save failed" }, 500);
  }

  return sendJSON(res, { error: "Unknown method" }, 400);
}

// ============ Main handler ============
module.exports = async function handler(req, res) {
  var url = new URL(req.url, "http://localhost");
  var method = req.method.toUpperCase();

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    res.end();
    return;
  }

  // API routes
  if (url.pathname.startsWith("/api/")) {
    return handleAPI(req, res, url, method);
  }

  // Static files from admin/
  var filePath = url.pathname === "/" || url.pathname === ""
    ? path.join(ADMIN_DIR, "index.html")
    : path.join(ADMIN_DIR, url.pathname);
  serveFile(res, filePath);
};
