// server.js - Vercel serverless API + static files
var fs = require("fs");
var path = require("path");

// =========== HTTP helper ============
function httpReq(opts, postBody) {
  return new Promise(function(resolve, reject) {
    var mod = opts.protocol === "https:" ? require("https") : require("http");
    var req = mod.request(opts, function(res) {
      var data = "";
      res.on("data", function(c) { data += c; });
      res.on("end", function() { resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, body: data }); });
    });
    req.on("error", function(e) { reject(e); });
    req.setTimeout(5000, function() { req.destroy(); reject(new Error("timeout")); });
    if (postBody) req.write(postBody);
    req.end();
  });
}

// =========== Store ============
var UPSTASH_URL = process.env.UPSTASH_REDIS_URL || "";
var UPSTASH_TOKEN = process.env.UPSTASH_REDIS_TOKEN || "";
// Clean URL - remove https:// prefix if present
var UPSTASH_HOST = UPSTASH_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");

async function loadData() {
  // Try Upstash REST API
  if (UPSTASH_HOST && UPSTASH_TOKEN) {
    try {
      var r = await httpReq({
        protocol: "https:",
        hostname: UPSTASH_HOST,
        path: "/get/coach_data?no_parse=true",
        method: "GET",
        headers: { "Authorization": "Bearer " + UPSTASH_TOKEN }
      });
      if (r.ok) {
        var j = JSON.parse(r.body);
        if (j.result) {
          var d = JSON.parse(j.result);
          console.log("[store] Upstash loaded, students:", d.students ? d.students.length : 0);
          return d;
        }
      }
    } catch(e) { console.log("[store] Upstash load error:", e.message); }
  }
  
  // Fallback: /tmp file
  try {
    if (fs.existsSync("/tmp/data.json"))
      return JSON.parse(fs.readFileSync("/tmp/data.json", "utf-8"));
  } catch(e) {}
  
  return { students: [], courses: [], checkins: [], pauses: [] };
}

async function saveData(d) {
  var saved = false;
  
  if (UPSTASH_HOST && UPSTASH_TOKEN) {
    try {
      var r = await httpReq({
        protocol: "https:",
        hostname: UPSTASH_HOST,
        path: "/set/coach_data",
        method: "POST",
        headers: { "Authorization": "Bearer " + UPSTASH_TOKEN, "Content-Type": "application/json" }
      }, JSON.stringify(d));
      if (r.ok) { saved = true; console.log("[store] Upstash saved"); }
      else console.log("[store] Upstash save failed:", r.status);
    } catch(e) { console.log("[store] Upstash save error:", e.message); }
  }
  
  // Always save to /tmp
  try { fs.writeFileSync("/tmp/data.json", JSON.stringify(d), "utf-8"); saved = true; console.log("[store] /tmp saved"); } catch(e) { console.log("[store] /tmp error:", e.message); }
  return saved;
}

// =========== Helpers ============
function parseBody(req) {
  return new Promise(function(resolve) {
    var body = "";
    req.on("data", function(c) { body += c; });
    req.on("end", function() { try { resolve(body ? JSON.parse(body) : {}); } catch(e) { resolve({}); } });
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

// =========== Static files ============
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

// =========== API router ============
async function handleAPI(req, res, url, method) {
  var parts = url.pathname.split("/").filter(Boolean);
  var col = parts[1], id = parts[2];
  
  // Batch operations
  if (col === "batch") {
    var body = await parseBody(req);
    var db = await loadData();
    var tgt = db[body.collection];
    if (!tgt) return sendJSON(res, {error:"Invalid collection"}, 400);
    if (body.action === "add") {
      body.items.forEach(function(it) { tgt.push({ id: "id_"+Date.now()+"_"+Math.random().toString(36).substr(2,6), ...it, createTime: new Date().toISOString() }); });
      await saveData(db); return sendJSON(res, {success:true, count:body.items.length});
    }
    return sendJSON(res, {error:"Unknown"}, 400);
  }
  
  // Validate collection
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
    var item=coll.find(function(x){return x.id===id});
    if(!item) return sendJSON(res,{error:"Not found"},404);
    return sendJSON(res,item);
  }
  
  // POST create
  if (method === "POST" && !id) {
    var body=await parseBody(req);
    var ni={id:"id_"+Date.now()+"_"+Math.random().toString(36).substr(2,6),...body,createTime:new Date().toISOString()};
    coll.push(ni);
    var ok = await saveData(db);
    if(ok) return sendJSON(res,ni,201);
    return sendJSON(res,{error:"Save failed"},500);
  }
  
  // PUT update
  if (method === "PUT" && id) {
    var idx=coll.findIndex(function(x){return x.id===id});
    if(idx===-1) return sendJSON(res,{error:"Not found"},404);
    var body=await parseBody(req);
    coll[idx]={...coll[idx],...body,id:coll[idx].id,updateTime:new Date().toISOString()};
    if(await saveData(db)) return sendJSON(res,coll[idx]);
    return sendJSON(res,{error:"Save failed"},500);
  }
  
  // DELETE
  if (method === "DELETE" && id) {
    var idx=coll.findIndex(function(x){return x.id===id});
    if(idx===-1) return sendJSON(res,{error:"Not found"},404);
    coll.splice(idx,1);
    if(await saveData(db)) return sendJSON(res,{success:true});
    return sendJSON(res,{error:"Save failed"},500);
  }
  
  return sendJSON(res,{error:"Unknown"},400);
}

// =========== Main handler ============
module.exports = async function handler(req, res) {
  try {
    var url = new URL(req.url, "http://localhost");
    var method = req.method.toUpperCase();
    
    if (method === "OPTIONS") {
      res.writeHead(204, { "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS","Access-Control-Allow-Headers":"Content-Type" });
      res.end(); return;
    }
    
    if (url.pathname.startsWith("/api/"))
      return handleAPI(req, res, url, method);
    
    var fp = (url.pathname === "/" || url.pathname === "") ? path.join(ADMIN_DIR,"index.html") : path.join(ADMIN_DIR, url.pathname);
    serveFile(res, fp);
  } catch(e) {
    console.error("Handler error:", e);
    res.writeHead(500, {"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*"});
    res.end(JSON.stringify({error:"Server error",message:e.message,stack:e.stack}));
  }
};