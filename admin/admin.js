(function(){
var API="/api",T=0,D={s:[],c:[],k:[],p:[]},CB=null;

window.addEventListener("error",function(e){TX("Error: "+(e.message||"?"))});

function E(s){if(!s)return"";return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function F(d){if(!d)return"-";var t=new Date(d);return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")}
function G(id){return D.s.find(function(s){return s.id===id||s.phone===id})||{name:"?",phone:"?"}}
function TX(m){var e=document.getElementById("tx");e.textContent=m;e.classList.add("show");setTimeout(function(){e.classList.remove("show")},2200)}

async function LD(){
  try{var r=await fetch(API+"/students");var d=await r.json();if(Array.isArray(d))D.s=d;}catch(e){}
  try{var r=await fetch(API+"/courses");var d=await r.json();if(Array.isArray(d))D.c=d;}catch(e){}
  try{var r=await fetch(API+"/checkins");var d=await r.json();if(Array.isArray(d))D.k=d;}catch(e){}
  try{var r=await fetch(API+"/pauses");var d=await r.json();if(Array.isArray(d))D.p=d;}catch(e){}
}

function CM(){document.getElementById("mm").style.display="none";CB=null}
function OM(t,b,ok){document.getElementById("mm").style.display="flex";document.getElementById("md").innerHTML="<h3>"+t+"</h3>"+b+'<div class="modal-actions"><button class="btn btn-o" id="btnCancel">取消</button><button class="btn btn-p" id="btnOk">确认</button></div>';if(ok)CB=ok}

function SW(n){
  T=n;
  var ns=document.querySelectorAll(".nav-item");
  for(var i=0;i<ns.length;i++)ns[i].classList.toggle("active",i===n);
  document.getElementById("pt").textContent=["📊 仪表�?,"👥 学员管理","📋 课程管理","�?签到记录","⏸️ 请假管理"][n];
  if(T===0)R0();else if(T===1)R1();else if(T===2)R2();else if(T===3)R3();else R4();
}

// === RENDER ===
function R0(){
  var m=document.getElementById("mc");
  var ac=D.c.filter(function(c){return c.status==="active"});
  var mc=ac.filter(function(c){return c.type==="monthly"}).length;
  var sc=ac.filter(function(c){return c.type==="session"}).length;
  var rev=D.c.reduce(function(t,c){return t+(c.price||0)},0);
  var td=(new Date()).toISOString().slice(0,10);
  var tdy=D.k.filter(function(k){return(k.date||k.checkinDate)===td}).length;
  var ps=D.p.filter(function(p){return p.status==="active"}).length;
  var h='<div class="stats-row">';
  h+='<div class="stat-card"><div class="stat-icon s1">👥</div><div><div class="stat-val">'+D.s.length+'</div><div class="stat-lbl">学员总数</div></div></div>';
  h+='<div class="stat-card"><div class="stat-icon s2">💰</div><div><div class="stat-val">¥'+rev+'</div><div class="stat-lbl">总营�?/div></div></div>';
  h+='<div class="stat-card"><div class="stat-icon s3">📋</div><div><div class="stat-val">'+mc+'/'+sc+'</div><div class="stat-lbl">月卡/次卡</div></div></div>';
  h+='<div class="stat-card"><div class="stat-icon s4">�?/div><div><div class="stat-val">'+tdy+'</div><div class="stat-lbl">今日签到</div></div></div>';
  h+='<div class="stat-card"><div class="stat-icon s5">⏸️</div><div><div class="stat-val">'+ps+'</div><div class="stat-lbl">暂停�?/div></div></div></div>';
  h+='<div class="card"><div class="card-header"><h2>👥 学员概览</h2><div class="sub">'+D.s.length+' �?/div></div>';
  if(D.s.length===0)h+='<div class="empty"><div class="icon">👤</div><p>暂无学员</p></div>';
  else{h+='<table><tr><th>姓名</th><th>手机�?/th><th>课程�?/th></tr>';D.s.forEach(function(s){var n=D.c.filter(function(c){return c.studentId===s.id}).length;h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+E(s.phone)+'</td><td>'+n+'</td></tr>'});h+='</table>'}h+='</div>';
  var rc=D.k.slice().sort(function(a,b){return(b.createTime||b.date||"").localeCompare(a.createTime||a.date||"")}).slice(0,8);
  h+='<div class="card"><div class="card-header"><h2>🕐 最近签�?/h2></div>';
  if(rc.length===0)h+='<div class="empty"><p>暂无签到</p></div>';
  else{h+='<table><tr><th>学员</th><th>日期</th><th>类型</th></tr>';rc.forEach(function(k){var s=G(k.studentId);var isS=k.type==="session"||k.courseType==="session";h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+F(k.date||k.checkinDate)+'</td><td><span class="tag '+(isS?"tag-s":"tag-m")+'">'+(isS?"次卡":"月卡")+'</span></td></tr>'});h+='</table>'}h+='</div>';
  m.innerHTML=h;
}

function R1(){
  var m=document.getElementById("mc");
  var h='<div class="card"><div class="card-header"><h2>👥 学员列表</h2><div class="search-box"><input placeholder="🔍 搜索..." id="ss"><button class="btn btn-p btn-sm" id="ba">+ 添加学员</button></div></div>';
  if(D.s.length===0)h+='<div class="empty"><div class="icon">👤</div><p>暂无学员</p></div>';
  else{h+='<table><tr><th>姓名</th><th>手机�?/th><th>备注</th><th>课程</th><th>操作</th></tr>';D.s.forEach(function(s){var n=D.c.filter(function(c){return c.studentId===s.id}).length;h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+E(s.phone)+'</td><td>'+E(s.note||"-")+'</td><td>'+n+'</td><td><button class="btn btn-o btn-sm" data-es="'+s.id+'">编辑</button> <button class="btn btn-d btn-sm" data-ds="'+s.id+'">删除</button></td></tr>'});h+='</table>'}h+='</div>';
  m.innerHTML=h;
}

function R2(){
  var m=document.getElementById("mc");
  var h='<div class="card"><div class="card-header"><h2>📋 课程列表</h2><button class="btn btn-p btn-sm" id="bc">+ 添加课程</button></div>';
  if(D.c.length===0)h+='<div class="empty"><div class="icon">📋</div><p>暂无课程</p></div>';
  else{h+='<table><tr><th>学员</th><th>类型</th><th>状�?/th><th>价格</th><th>剩余</th><th>操作</th></tr>';D.c.forEach(function(c){var s=G(c.studentId);var isM=c.type==="monthly";var stT=c.status==="active"?"tag-a":c.status==="paused"?"tag-p":"tag-e";var stL=c.status==="active"?"进行�?:c.status==="paused"?"暂停�?:"已到�?;h+='<tr><td><b>'+E(s.name)+'</b></td><td><span class="tag '+(isM?"tag-m":"tag-s")+'">'+(isM?"月卡":"次卡")+'</span></td><td><span class="tag '+stT+'">'+stL+'</span></td><td>¥'+(c.price||0)+'</td><td>'+(isM?(c.totalDays||30)+"�?:(c.rem!==undefined?c.rem:c.total||10)+"/"+(c.total||10)+"�?)+'</td><td><button class="btn btn-o btn-sm" data-ec="'+c.id+'">编辑</button> <button class="btn btn-d btn-sm" data-dc="'+c.id+'">删除</button></td></tr>'});h+='</table>'}h+='</div>';
  m.innerHTML=h;
}

function R3(){
  var m=document.getElementById("mc");
  var h='<div class="card"><div class="card-header"><h2>�?签到记录</h2><div class="sub">�?'+D.k.length+' �?/div></div>';
  if(D.k.length===0)h+='<div class="empty"><div class="icon">�?/div><p>暂无签到<br><small>学员通过小程序签到后显示</small></p></div>';
  else{var sorted=D.k.slice().sort(function(a,b){return(b.createTime||b.date||"").localeCompare(a.createTime||a.date||"")});h+='<table><tr><th>学员</th><th>日期</th><th>时间</th><th>类型</th><th>操作</th></tr>';sorted.forEach(function(k){var s=G(k.studentId);var isS=k.type==="session"||k.courseType==="session";h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+F(k.date||k.checkinDate)+'</td><td>'+(k.time||k.checkinTime||"-")+'</td><td><span class="tag '+(isS?"tag-s":"tag-m")+'">'+(isS?"次卡":"月卡")+'</span></td><td><button class="btn btn-d btn-sm" data-uc="'+k.id+'">撤销</button></td></tr>'});h+='</table>'}h+='</div>';
  m.innerHTML=h;
}

function R4(){
  var m=document.getElementById("mc");
  var act=D.p.filter(function(p){return p.status==="active"});
  var hist=D.p.filter(function(p){return p.status!=="active"});
  var h='<div class="card"><div class="card-header"><h2>⏸️ 进行中的请假</h2><div class="sub">'+act.length+' �?/div></div>';
  if(act.length===0)h+='<div class="empty"><p>暂无进行中的请假</p></div>';
  else{h+='<table><tr><th>学员</th><th>日期</th><th>类型</th><th>原因</th><th>操作</th></tr>';act.forEach(function(p){var s=G(p.studentId);h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+F(p.date||p.pauseDate)+'</td><td>'+(p.type==="monthly"?"月卡":"次卡")+'</td><td>'+E(p.reason||"-")+'</td><td><button class="btn btn-o btn-sm" data-rp="'+p.id+'">恢复</button></td></tr>'});h+='</table>'}h+='</div>';
  if(hist.length>0){h+='<div class="card"><div class="card-header"><h2>📜 历史记录</h2></div><table><tr><th>学员</th><th>日期</th><th>原因</th></tr>';hist.slice(0,20).forEach(function(p){var s=G(p.studentId);h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+F(p.date||p.pauseDate)+'</td><td>'+E(p.reason||"-")+'</td></tr>'});h+='</table></div>'}m.innerHTML=h;
}

// === CRUD ===
async function addStudent(){
  if(D.s.length===0){var n=prompt("姓名:"),p=prompt("手机�?");if(!n||!p)return;var r=await fetch(API+"/students",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n,phone:p,note:""})});if(r.ok){await LD();SW(T);TX("添加成功")}else{TX("添加失败")}return}
  OM("添加学员",'<div class="fg"><label>姓名 *</label><input id="sn"></div><div class="fr"><div class="fg"><label>手机�?*</label><input id="sp"></div><div class="fg"><label>备注</label><input id="st"></div></div>',async function(){var n=document.getElementById("sn").value.trim(),p=document.getElementById("sp").value.trim();if(!n||!p){TX("姓名和手机号必填");return}var r=await fetch(API+"/students",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n,phone:p,note:document.getElementById("st").value.trim()})});if(r.ok){await LD();SW(T);TX("添加成功")}else{TX("添加失败")}});
}
async function editStudent(id){
  var s=D.s.find(function(x){return x.id===id});if(!s)return;
  OM("编辑学员",'<div class="fg"><label>姓名</label><input id="sn" value="'+E(s.name)+'"></div><div class="fg"><label>手机�?/label><input id="sp" value="'+E(s.phone)+'"></div><div class="fg"><label>备注</label><input id="st" value="'+E(s.note||"")+'"></div>',async function(){var n=document.getElementById("sn").value.trim(),p=document.getElementById("sp").value.trim();if(!n||!p)return;var r=await fetch(API+"/students/"+id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:n,phone:p,note:document.getElementById("st").value.trim()})});if(r.ok){await LD();SW(T);TX("更新成功")}else{TX("更新失败")}});
}
async function delStudent(id){if(!confirm("确定删除�?))return;var r=await fetch(API+"/students/"+id,{method:"DELETE"});if(r.ok){await LD();SW(T);TX("已删�?)}else{TX("删除失败")}}

function addCourse(){
  if(D.s.length===0){TX("请先添加学员");return}
  var opts=D.s.map(function(s){return '<option value="'+s.id+'">'+E(s.name)+' ('+E(s.phone)+')</option>'}).join("");
  var td=new Date().toISOString().slice(0,10);
  OM("添加课程",'<div class="fg"><label>学员</label><select id="cs">'+opts+'</select></div><div class="fr"><div class="fg"><label>类型</label><select id="ct"><option value="monthly">月卡</option><option value="session">次卡</option></select></div><div class="fg"><label>价格 ¥</label><input id="cp" type="number" value="0"></div></div><div class="fr"><div class="fg"><label>开始日�?/label><input id="cdr" type="date" value="'+td+'"></div><div id="cgm" class="fg"><label>天数</label><input id="cdy" type="number" value="30"></div><div id="cgs" class="fg" style="display:none"><label>次数</label><input id="csn" type="number" value="10"></div></div>',async function(){var type=document.getElementById("ct").value;var d={studentId:document.getElementById("cs").value,type:type,status:"active",price:Number(document.getElementById("cp").value)||0,startDate:document.getElementById("cdr").value};if(type==="monthly"){var days=Number(document.getElementById("cdy").value)||30;d.totalDays=days;var end=new Date(d.startDate);end.setDate(end.getDate()+days);d.endDate=end.toISOString().slice(0,10)}else{var total=Number(document.getElementById("csn").value)||10;d.total=total;d.rem=total}var r=await fetch(API+"/courses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)});if(r.ok){await LD();SW(T);TX("添加成功")}else{TX("添加失败")}});
  setTimeout(function(){var ctEl=document.getElementById("ct");if(ctEl){ctEl.onchange=function(){document.getElementById("cgm").style.display=ctEl.value==="monthly"?"":"none";document.getElementById("cgs").style.display=ctEl.value==="monthly"?"none":""}}},50);
}
function editCourse(id){
  var c=D.c.find(function(x){return x.id===id});if(!c)return;
  var opts=D.s.map(function(s){return '<option value="'+s.id+'"'+(s.id===c.studentId?" selected":"")+'>'+E(s.name)+' ('+E(s.phone)+')</option>'}).join("");
  OM("编辑课程",'<div class="fg"><label>学员</label><select id="cs">'+opts+'</select></div><div class="fr"><div class="fg"><label>状�?/label><select id="cst"><option value="active"'+(c.status==="active"?" selected":"")+'>进行�?/option><option value="paused"'+(c.status==="paused"?" selected":"")+'>暂停�?/option><option value="expired"'+(c.status==="expired"?" selected":"")+'>已到�?/option></select></div><div class="fg"><label>价格 ¥</label><input id="cp" type="number" value="'+(c.price||0)+'"></div></div>',async function(){var r=await fetch(API+"/courses/"+id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({studentId:document.getElementById("cs").value,status:document.getElementById("cst").value,price:Number(document.getElementById("cp").value)||0})});if(r.ok){await LD();SW(T);TX("更新成功")}else{TX("更新失败")}});
}
async function delCourse(id){if(!confirm("确定删除�?))return;var r=await fetch(API+"/courses/"+id,{method:"DELETE"});if(r.ok){await LD();SW(T);TX("已删�?)}else{TX("删除失败")}}
async function undoCheckin(id){
  if(!confirm("确定撤销�?))return;var k=D.k.find(function(x){return x.id===id});var r=await fetch(API+"/checkins/"+id,{method:"DELETE"});
  if(r.ok){if(k&&(k.type==="session"||k.courseType==="session")&&(k.courseId||k.cid)){var cid=k.courseId||k.cid;var c=D.c.find(function(x){return x.id===cid});if(c)await fetch(API+"/courses/"+c.id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({rem:(c.rem||0)+1})})}await LD();SW(T);TX("已撤销")}else{TX("撤销失败")}
}
async function resumePause(id){
  if(!confirm("确定恢复�?))return;var p=D.p.find(function(x){return x.id===id});if(!p)return;
  var r=await fetch(API+"/pauses/"+id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"done"})});
  if(r.ok){if(p.courseId||p.cid){var cid=p.courseId||p.cid;await fetch(API+"/courses/"+cid,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"active"})})}await LD();SW(T);TX("已恢�?)}else{TX("恢复失败")}
}

// === EVENT DELEGATION ===
document.addEventListener("click",function(ev){
  var el=ev.target;
  if(el.id==="btnCancel"){CM();return}
  if(el.id==="btnOk"){if(CB)try{CB()}catch(e){TX("Err:"+e.message)}CM();return}
  if(el.id==="mm"&&ev.target===el){CM();return}
  if(el.id==="br"||el.closest("#br")){LD().then(function(){SW(T);TX("已刷�?)});return}
  var nav=el.closest(".nav-item");if(nav){SW(Number(nav.dataset.tab));return}
  if(el.id==="ba"||el.closest("#ba")){addStudent();return}
  if(el.id==="bc"||el.closest("#bc")){addCourse();return}
  // data-* traversal
  var p=el;
  while(p&&p!==document.body){
    if(p.dataset.es){editStudent(p.dataset.es);return}
    if(p.dataset.ds){delStudent(p.dataset.ds);return}
    if(p.dataset.ec){editCourse(p.dataset.ec);return}
    if(p.dataset.dc){delCourse(p.dataset.dc);return}
    if(p.dataset.uc){undoCheckin(p.dataset.uc);return}
    if(p.dataset.rp){resumePause(p.dataset.rp);return}
    p=p.parentElement;
  }
});

document.addEventListener("input",function(ev){
  if(ev.target.id==="ss"){var q=ev.target.value.toLowerCase();document.querySelectorAll("table tr").forEach(function(r){if(r.querySelector("th"))return;r.style.display=r.textContent.toLowerCase().includes(q)?"":"none"})}
});

LD().then(function(){SW(0)});

})();