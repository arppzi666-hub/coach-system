var fs = require("fs");
var _data = { students: [], courses: [], checkins: [], pauses: [] };

function loadData() {
  if (_data.students.length === 0) {
    try { var d = JSON.parse(fs.readFileSync("/tmp/data.json","utf-8")); if (d && d.students) _data = d; } catch(e) {}
  }
  return _data;
}
function saveDataSync(d) { _data = d; try { fs.writeFileSync("/tmp/data.json", JSON.stringify(d),"utf-8"); } catch(e) {} }
function parseBody(req) {
  return new Promise(function(r) { var b=""; req.on("data",function(c){b+=c}); req.on("end",function(){try{r(b?JSON.parse(b):{})}catch(e){r({})}}); });
}
var CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Methods":"GET,POST,PUT,DELETE,OPTIONS", "Access-Control-Allow-Headers":"Content-Type" };
function sendJSON(res, data, code) {
  res.writeHead(code||200, Object.assign({"Content-Type":"application/json; charset=utf-8"}, CORS));
  res.end(JSON.stringify(data));
}
function handleCol(req, res, colName) {
  var method = req.method.toUpperCase();
  if (method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }
  var url = new URL(req.url, "http://l");
  var id = url.searchParams.get("id") || null;
  var db = loadData(), coll = db[colName];
  
  if (method === "GET" && !id) {
    var f = coll, sp = url.searchParams;
    if (sp.has("phone") && colName==="students") { var p=sp.get("phone"); f=coll.filter(function(x){return x.phone===p}); }
    if (sp.has("studentId")) { var sid=sp.get("studentId"); f=coll.filter(function(x){return x.studentId===sid}); }
    if (sp.has("courseId")) { var cid=sp.get("courseId"); f=coll.filter(function(x){return x.courseId===cid||x.cid===cid}); }
    return sendJSON(res, f);
  }
  if (method === "GET" && id) { var item=coll.find(function(x){return x.id===id}); if(!item) return sendJSON(res,{error:"Not found"},404); return sendJSON(res,item); }
  
  if (method === "POST") {
    return parseBody(req).then(function(body) {
      var ni={id:"id_"+Date.now()+"_"+Math.random().toString(36).substr(2,6),...body,createTime:new Date().toISOString()};
      coll.push(ni); saveDataSync(db); return sendJSON(res,ni,201);
    });
  }
  if (method === "PUT" && id) {
    return parseBody(req).then(function(body) {
      var idx=coll.findIndex(function(x){return x.id===id}); if(idx===-1) return sendJSON(res,{error:"Not found"},404);
      coll[idx]={...coll[idx],...body,id:coll[idx].id,updateTime:new Date().toISOString()};
      saveDataSync(db); return sendJSON(res,coll[idx]);
    });
  }
  if (method === "DELETE" && id) {
    var idx=coll.findIndex(function(x){return x.id===id}); if(idx===-1) return sendJSON(res,{error:"Not found"},404);
    coll.splice(idx,1); saveDataSync(db); return sendJSON(res,{success:true});
  }
  return sendJSON(res,{error:"Unknown"},400);
}
module.exports = { handleCol: handleCol };