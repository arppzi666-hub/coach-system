var fs = require("fs");
var path = require("path");
var MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".ico":"image/x-icon" };
var ADMIN_DIR = path.join(__dirname, "..", "admin");
module.exports = function(req, res) {
  var url = new URL(req.url, "http://l");
  var fp = (url.pathname === "/" || url.pathname === "") ? path.join(ADMIN_DIR, "index.html") : path.join(ADMIN_DIR, url.pathname);
  var rp = path.resolve(fp);
  if (!rp.startsWith(path.resolve(ADMIN_DIR))) { res.writeHead(403); res.end("Forbidden"); return; }
  try {
    var data = fs.readFileSync(fp);
    res.writeHead(200, { "Content-Type": MIME[path.extname(fp).toLowerCase()] || "text/plain", "Cache-Control": "public, max-age=3600" });
    res.end(data);
  } catch(e) { res.writeHead(404); res.end("Not Found"); }
};