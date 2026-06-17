module.exports = function(req, res) {
  res.writeHead(200, {"Content-Type":"application/json; charset=utf-8","Access-Control-Allow-Origin":"*"});
  res.end(JSON.stringify({version:"v3-NEW-CODE-2026",time:new Date().toISOString()}));
};
