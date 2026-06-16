// Vercel serverless function - handles API + static files
var http = require("http");
var fs = require("fs");
var path = require("path");

// ============ Data store ============
var _store = null;
var _storeType = "pending";

async function getStore() {
  if (_store) return _store;
  try {
    var mod = await import("@upstash/redis");
    var Redis = mod.Redis;
    var redis = new Redis({
      url: process.env.UPSTASH_REDIS_URL || process.env.KV_URL || "",
      token: process.env.UPSTASH_REDIS_TOKEN || process.env.KV_REST_API_TOKEN || ""
    });
    await redis.ping();
    _store = {
      get: async function(key) { var d = await redis.get(key); return d || { students: [], courses: [], checkins: [], pauses: [] }; },
      set: async function(key, val) { await redis.set(key, JSON.parse(JSON.stringify(val))); return true; }
    };
    _storeType = "upstash";
    console.log("[store] Upstash Redis connected");
  } catch(e1) {
    console.log("[store] Upstash failed:", e1.message, "trying Vercel KV...");
    try {
      var kvMod = await import("@vercel/kv");
      var kv = kvMod.kv;
      await kv.get("__health__");
      _store = {
        get: async function(key) { var d = await kv.get(key); return d || { students: [], courses: [], checkins: [], pauses: [] }; },
        set: async function(key, val) { await kv.set(key, JSON.parse(JSON.stringify(val))); return true; }
      };
      _storeType = "vercel-kv";
      console.log("[store] Vercel KV connected");
    } catch(e2) {
      console.log("[store] All remote stores failed, using memory");
      var mem = { students: [], courses: [], checkins: [], pauses: [] };
      _store = {
        get: async function() { return mem; },
        set: async function(_, val) { mem = JSON.parse(JSON.stringify(val)); return true; }
      };
      _storeType = "memory";
    }
  }
  return _store;
}

async function loadData() { var s = await getStore(); return s.get("coach_data"); }
async function saveData(d) { var s = await getStore(); return s.set("coach_data", d); }

// ============ API helpers ============
function parseBody(req) {
  return new Promise(function(resolve) {
    var body = "";
    req.on("data", function(c) { body += c; });
    req.on("end", function() { try { resolve(body ? JSON.parse(body) : {}); } catch(e) { resolve({}); } });
  });
}

function sendJSON(res, data, code) {
  var headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
  res.writeHead(code || 200, headers);
  res.end(JSON.stringify(data));
}

// ============ Static file serving ============
var MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml"
};
var ADMIN_DIR = path.join(__dirname, "..", "admin");

function serveFile(res, filePath) {
  var resolved = path.resolve(filePath);
  var base = path.resolve(ADMIN_DIR);
  if (!resolved.startsWith(base)) { res.writeHead(403); res.end("Forbidden"); return; }
  var ext = path.extname(filePath).toLowerCase();
  try {
    var data = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain", "Cache-Control": "public, max-age=3600" });
    res.end(data);
  } catch(e) { res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not Found"); }
}

// ============ API router ============
async function handleAPI(req, res, url, method) {
  var parts = url.pathname.split("/").filter(Boolean);
  var col = parts[1], id = parts[2];
  if (col === "batch") {
    var body = await parseBody(req);
    var db = await loadData(), tgt = db[body.collection];
    if (!tgt) return sendJSON(res, { error: "Invalid" }, 400);
    if (body.action === "add") {
      body.items.forEach(function(it) { tgt.push({ id: "id_"+Date.now()+"_"+Math.random().toString(36).substr(2,6), ...it, createTime: new Date().toISOString() }); });
      await saveData(db); return sendJSON(res, { success: true, count: body.items.length });
    }
    return sendJSON(res, { error: "Unknown" }, 400);
  }
  if (!["students","courses","checkins","pauses"].includes(col)) return sendJSON(res, { error: "Invalid" }, 400);
  var db = await loadData(), coll = db[col];
  if (method === "GET" && !id) {
    var f = coll;
    if (url.searchParams.has("phone") && col==="students") { var p=url.searchParams.get("phone"); f=coll.filter(function(x){return x.phone===p}); }
    if (url.searchParams.has("studentPhone") && col==="courses") { var sp=url.searchParams.get("studentPhone"); f=coll.filter(function(x){return x.studentPhone===sp||x.studentId===sp}); }
    if (url.searchParams.has("studentId")) { var sid=url.searchParams.get("studentId"); f=coll.filter(function(x){return x.studentId===sid}); }
    if (url.searchParams.has("courseId")) { var cid=url.searchParams.get("courseId"); f=coll.filter(function(x){return x.courseId===cid||x.cid===cid}); }
    return sendJSON(res, f);
  }
  if (method === "GET" && id) { var item=coll.find(function(x){return x.id===id}); if(!item) return sendJSON(res,{error:"Not found"},404); return sendJSON(res,item); }
  if (method === "POST" && !id) {
    var body=await parseBody(req), ni={id:"id_"+Date.now()+"_"+Math.random().toString(36).substr(2,6),...body,createTime:new Date().toISOString()};
    coll.push(ni); if(await saveData(db)) return sendJSON(res,ni,201); return sendJSON(res,{error:"Save failed"},500);
  }
  if (method === "PUT" && id) {
    var idx=coll.findIndex(function(x){return x.id===id}); if(idx===-1) return sendJSON(res,{error:"Not found"},404);
    var body=await parseBody(req); coll[idx]={...coll[idx],...body,id:coll[idx].id,updateTime:new Date().toISOString()};
    if(await saveData(db)) return sendJSON(res,coll[idx]); return sendJSON(res,{error:"Save failed"},500);
  }
  if (method === "DELETE" && id) {
    var idx=coll.findIndex(function(x){return x.id===id}); if(idx===-1) return sendJSON(res,{error:"Not found"},404);
    coll.splice(idx,1); if(await saveData(db)) return sendJSON(res,{success:true}); return sendJSON(res,{error:"Save failed"},500);
  }
  return sendJSON(res,{error:"Unknown"},400);
}

// ============ Main handler ============
module.exports = async function handler(req, res) {
  try {
    var url = new URL(req.url, "http://localhost");
    var method = req.method.toUpperCase();
    if (method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type" });
      res.end(); return;
    }
    if (url.pathname.startsWith("/api/")) return handleAPI(req, res, url, method);
    var filePath = (url.pathname === "/" || url.pathname === "") ? path.join(ADMIN_DIR, "index.html") : path.join(ADMIN_DIR, url.pathname);
    serveFile(res, filePath);
  } catch(e) {
    console.error("Handler error:", e);
    sendJSON(res, { error: "Internal error", message: e.message }, 500);
  }
};