var API='http://localhost:3000/api',T=0,D={s:[],c:[],k:[],p:[]};
function E(s){if(!s)return'';s=''+s;return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function fd(d){if(!d)return'-';var t=new Date(d);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');}
function gs(id){return D.s.find(function(s){return s.id===id||s.phone===id})||{name:'?',phone:'?'};}
function tx(m){var t=document.getElementById('tx');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2000);}
async function ld(){
try{var s=await(await fetch(API+'/students')).json();if(Array.isArray(s))D.s=s;}catch(e){}
try{var c=await(await fetch(API+'/courses')).json();if(Array.isArray(c))D.c=c;}catch(e){}
try{var k=await(await fetch(API+'/checkins')).json();if(Array.isArray(k))D.k=k;}catch(e){}
try{var p=await(await fetch(API+'/pauses')).json();if(Array.isArray(p))D.p=p;}catch(e){}
}
async function rf(){await ld();rr();tx('Refreshed');}
function cm(){document.getElementById('mm').style.display='none';}
function om(t,b,cb){
document.getElementById('mm').style.display='flex';
document.getElementById('mc').innerHTML='<h3>'+t+'</h3>'+b+'<div style=margin-top:20px;display:flex;gap:10px;justify-content:flex-end><button class=btn bo onclick=cm()>Cancel</button><button class=btn bp id=mok>OK</button></div>';
if(cb)document.getElementById('mok').onclick=function(){cb();cm();};
}
function go(n){T=n;var ts=document.querySelectorAll('.tab');for(var i=0;i<ts.length;i++)ts[i].classList.toggle('active',i===n);rr();}
function rr(){if(T===0)r0();else if(T===1)r1();else if(T===2)r2();else if(T===3)r3();else r4();}
function r0(){
var m=document.getElementById('m');
var ac=D.c.filter(function(c){return c.status==='active'});
var mc=ac.filter(function(c){return c.type==='monthly'}).length;
var sc=ac.filter(function(c){return c.type==='session'}).length;
var rev=D.c.reduce(function(t,c){return t+(c.price||0)},0);
var td=new Date().toISOString().slice(0,10);
var tc=D.k.filter(function(k){return (k.date||k.checkinDate)===td}).length;
var ps=D.p.filter(function(p){return p.status==='active'}).length;
var h='<div class=stats>';
h+='<div class=stat><div class=n>'+D.s.length+'</div><div class=l>Students</div></div>';
h+='<div class=stat><div class=n>$'+rev+'</div><div class=l>Revenue</div></div>';
h+='<div class=stat><div class=n>'+mc+'/'+sc+'</div><div class=l>Monthly/Session</div></div>';
h+='<div class=stat><div class=n>'+tc+'</div><div class=l>Today</div></div>';
h+='<div class=stat><div class=n>'+ps+'</div><div class=l>Paused</div></div>';
h+='</div><div class=card><h3>Students</h3>';
if(D.s.length===0)h+='<div class=empty>No students</div>';
else{h+='<table><tr><th>Name</th><th>Phone</th><th>Courses</th></tr>';
D.s.forEach(function(s){var n=D.c.filter(function(c){return c.studentId===s.id}).length;
h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+E(s.phone)+'</td><td>'+n+'</td></tr>';});
h+='</table>';}
h+='</div>';
var rc=D.k.slice().sort(function(a,b){return (b.createTime||b.date||'').localeCompare(a.createTime||a.date||'')}).slice(0,10);
h+='<div class=card><h3>Recent</h3>';
if(rc.length===0)h+='<div class=empty>None</div>';
else{h+='<table><tr><th>Student</th><th>Date</th><th>Type</th></tr>';
rc.forEach(function(k){var s=gs(k.studentId);
h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+fd(k.date||k.checkinDate)+'</td><td><span class=tag '+(k.type==='session'||k.courseType==='session'?'ts':'tm')+'>'+(k.type==='session'||k.courseType==='session'?'Session':'Monthly')+'</span></td></tr>';});
h+='</table>';}
h+='</div>';m.innerHTML=h;}
function r1(){
var m=document.getElementById('m');
var h='<div class=card><h3>Students <button class=btn bp onclick=as()>+ Add</button></h3>';
if(D.s.length===0)h+='<div class=empty>None</div>';
else{h+='<table><tr><th>Name</th><th>Phone</th><th>Note</th><th>Courses</th><th></th></tr>';
D.s.forEach(function(s){var n=D.c.filter(function(c){return c.studentId===s.id}).length;
h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+E(s.phone)+'</td><td>'+E(s.note||'-')+'</td><td>'+n+'</td>';
h+='<td><button class=btn bo bs onclick="es(\''+s.id+'\')">Edit</button> <button class=btn bd bs onclick="ds(\''+s.id+'\')">Del</button></td></tr>';});
h+='</table>';}
h+='</div>';m.innerHTML=h;}
async function as(){
om('Add Student','<div class=fg><label>Name *</label><input id=sn></div><div class=fg><label>Phone *</label><input id=sp></div><div class=fg><label>Note</label><input id=st></div>',async function(){
var n=document.getElementById('sn').value.trim(),p=document.getElementById('sp').value.trim();
if(!n||!p){tx('Name and phone required');return;}
var r=await fetch(API+'/students',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,phone:p,note:document.getElementById('st').value.trim()})});
if(r.ok){await ld();rr();tx('Added');}else{tx('Failed');}
});}
function es(id){var s=D.s.find(function(x){return x.id===id});if(!s)return;
om('Edit Student','<div class=fg><label>Name</label><input id=sn value="'+E(s.name)+'"></div><div class=fg><label>Phone</label><input id=sp value="'+E(s.phone)+'"></div><div class=fg><label>Note</label><input id=st value="'+E(s.note||'')+'"></div>',async function(){
var n=document.getElementById('sn').value.trim(),p=document.getElementById('sp').value.trim();
if(!n||!p){tx('Required');return;}
var r=await fetch(API+'/students/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,phone:p,note:document.getElementById('st').value.trim()})});
if(r.ok){await ld();rr();tx('Updated');}else{tx('Failed');}
});}
async function ds(id){if(!confirm('Delete?'))return;
var r=await fetch(API+'/students/'+id,{method:'DELETE'});
if(r.ok){
D.c.filter(function(c){return c.studentId===id}).forEach(function(c){fetch(API+'/courses/'+c.id,{method:'DELETE'})});
D.k.filter(function(k){return k.studentId===id}).forEach(function(k){fetch(API+'/checkins/'+k.id,{method:'DELETE'})});
D.p.filter(function(p){return p.studentId===id}).forEach(function(p){fetch(API+'/pauses/'+p.id,{method:'DELETE'})});
await ld();rr();tx('Deleted');}else{tx('Failed');}}
function r2(){
var m=document.getElementById('m');
var h='<div class=card><h3>Courses <button class=btn bp onclick=ac()>+ New Card</button></h3>';
if(D.c.length===0)h+='<div class=empty>None</div>';
else{h+='<table><tr><th>Student</th><th>Type</th><th>Status</th><th>Info</th><th>Start</th><th>Price</th><th></th></tr>';
D.c.forEach(function(c){var s=gs(c.studentId);
var st=c.status==='active'?'ta':c.status==='paused'?'tp':'te';
var sl=c.status==='active'?'Active':c.status==='paused'?'Paused':'Expired';
var info=c.type==='monthly'?(c.totalDays||30)+'d':(c.rem!==undefined?c.rem:c.total||10)+'/'+(c.total||10);
h+='<tr><td><b>'+E(s.name)+'</b></td><td><span class=tag '+(c.type==='monthly'?'tm':'ts')+'>'+(c.type==='monthly'?'Monthly':'Session')+'</span></td>';
h+='<td><span class=tag '+st+'>'+sl+'</span></td><td>'+info+'</td><td>'+fd(c.startDate||c.start)+'</td><td>$'+(c.price||0)+'</td>';
h+='<td><button class=btn bo bs onclick="ec(\''+c.id+'\')">Edit</button> <button class=btn bd bs onclick="dc(\''+c.id+'\')">Del</button></td></tr>';});
h+='</table>';}
h+='</div>';m.innerHTML=h;}
async function ac(){
var opts=D.s.map(function(s){return '<option value="'+s.id+'">'+E(s.name)+' ('+E(s.phone)+')</option>'}).join('');
om('New Card','<div class=fg><label>Student</label><select id=cs>'+opts+'</select></div><div class=fg><label>Type</label><select id=ct onchange=tc()><option value=monthly>Monthly</option><option value=session>Session</option></select></div><div class=fg><label>Start</label><input id=cdr type=date value="'+new Date().toISOString().slice(0,10)+'"></div><div id=cgm class=fg><label>Days</label><input id=cdy type=number value=30></div><div id=cgs class=fg style=display:none><label>Sessions</label><input id=csn type=number value=10></div><div class=fg><label>Price</label><input id=cp type=number value=0></div>',async function(){
var sid=document.getElementById('cs').value,type=document.getElementById('ct').value;
if(!sid){tx('Select student');return;}
var d={studentId:sid,type:type,status:'active',price:Number(document.getElementById('cp').value)||0,startDate:document.getElementById('cdr').value};
if(type==='monthly'){var days=Number(document.getElementById('cdy').value)||30;d.totalDays=days;var end=new Date(d.startDate);end.setDate(end.getDate()+days);d.endDate=end.toISOString().slice(0,10);}
else{var total=Number(document.getElementById('csn').value)||10;d.total=total;d.rem=total;}
var r=await fetch(API+'/courses',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)});
if(r.ok){await ld();rr();tx('Created');}else{tx('Failed');}
});}
function tc(){var t=document.getElementById('ct');if(!t)return;document.getElementById('cgm').style.display=t.value==='monthly'?'':'none';document.getElementById('cgs').style.display=t.value==='monthly'?'none':'';}
function ec(id){var c=D.c.find(function(x){return x.id===id});if(!c)return;
var opts=D.s.map(function(s){return '<option value="'+s.id+'"'+(s.id===c.studentId?' selected':'')+'>'+E(s.name)+' ('+E(s.phone)+')</option>'}).join('');
om('Edit Course','<div class=fg><label>Student</label><select id=cs>'+opts+'</select></div><div class=fg><label>Status</label><select id=cst><option value=active'+(c.status==='active'?' selected':'')+'>Active</option><option value=paused'+(c.status==='paused'?' selected':'')+'>Paused</option><option value=expired'+(c.status==='expired'?' selected':'')+'>Expired</option></select></div><div class=fg><label>Price</label><input id=cp type=number value="'+(c.price||0)+'"></div>',async function(){
var r=await fetch(API+'/courses/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:document.getElementById('cs').value,status:document.getElementById('cst').value,price:Number(document.getElementById('cp').value)||0})});
if(r.ok){await ld();rr();tx('Updated');}else{tx('Failed');}
});}
async function dc(id){if(!confirm('Delete?'))return;var r=await fetch(API+'/courses/'+id,{method:'DELETE'});if(r.ok){await ld();rr();tx('Deleted');}else{tx('Failed');}}
function r3(){
var m=document.getElementById('m'),h='<div class=card><h3>Check-ins</h3>';
if(D.k.length===0)h+='<div class=empty>None</div>';
else{var sorted=D.k.slice().sort(function(a,b){return (b.createTime||b.date||'').localeCompare(a.createTime||a.date||'')});
h+='<table><tr><th>Student</th><th>Date</th><th>Time</th><th>Type</th><th></th></tr>';
sorted.forEach(function(k){var s=gs(k.studentId);
h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+fd(k.date||k.checkinDate)+'</td><td>'+(k.time||k.checkinTime||'-')+'</td>';
h+='<td><span class=tag '+(k.type==='session'||k.courseType==='session'?'ts':'tm')+'>'+(k.type==='session'||k.courseType==='session'?'Session':'Monthly')+'</span></td>';
h+='<td><button class=btn bd bs onclick="dk(\''+k.id+'\')">Undo</button></td></tr>';});
h+='</table>';}
h+='</div>';m.innerHTML=h;}
async function dk(id){if(!confirm('Undo?'))return;var k=D.k.find(function(x){return x.id===id});
var r=await fetch(API+'/checkins/'+id,{method:'DELETE'});
if(r.ok){if(k&&(k.type==='session'||k.courseType==='session')&&k.courseId){var c=D.c.find(function(x){return x.id===k.courseId});if(c)fetch(API+'/courses/'+c.id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({rem:(c.rem||0)+1})});}
await ld();rr();tx('Undone');}else{tx('Failed');}}
function r4(){
var m=document.getElementById('m');
var act=D.p.filter(function(p){return p.status==='active'});
var hist=D.p.filter(function(p){return p.status!=='active'});
var h='<div class=card><h3>Active Pauses ('+act.length+')</h3>';
if(act.length===0)h+='<div class=empty>None</div>';
else{h+='<table><tr><th>Student</th><th>Date</th><th>Type</th><th>Reason</th><th></th></tr>';
act.forEach(function(p){var s=gs(p.studentId);
h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+fd(p.date||p.pauseDate)+'</td><td>'+(p.type==='monthly'?'Monthly':'Session')+'</td><td>'+E(p.reason||'-')+'</td>';
h+='<td><button class=btn bo bs onclick="rp(\''+p.id+'\')">Resume</button></td></tr>';});
h+='</table>';}h+='</div>';
if(hist.length>0){h+='<div class=card><h3>History</h3><table><tr><th>Student</th><th>Date</th><th>Reason</th></tr>';
hist.slice(0,20).forEach(function(p){var s=gs(p.studentId);
h+='<tr><td><b>'+E(s.name)+'</b></td><td>'+fd(p.date||p.pauseDate)+'</td><td>'+E(p.reason||'-')+'</td></tr>';});
h+='</table></div>';}
if(D.p.length===0)h+='<div class=empty>None</div>';
m.innerHTML=h;}
async function rp(id){if(!confirm('Resume?'))return;var p=D.p.find(function(x){return x.id===id});if(!p)return;
var r=await fetch(API+'/pauses/'+id,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'done'})});
if(r.ok){if(p.courseId||p.cid){var cid=p.courseId||p.cid;fetch(API+'/courses/'+cid,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'active'})});}
await ld();rr();tx('Resumed');}else{tx('Failed');}}
(async function(){await ld();rr();})();
