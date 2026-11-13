const $=s=>document.querySelector(s),ls=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},sv=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=s=>String(s).replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab,nav button').forEach(e=>e.classList.remove('on'));$('#'+b.dataset.t).classList.add('on');b.classList.add('on')});
$('#gear').onclick=()=>{$('#key').value=ls('key','');$('#modal').hidden=false};$('#keyClose').onclick=()=>$('#modal').hidden=true;
$('#keySave').onclick=()=>{sv('key',$('#key').value.trim());$('#modal').hidden=true};
// ---- Summary (Claude if key, else extractive)
async function summarize(text,hint='المحاضرة'){
 const key=ls('key','');
 if(key){try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},
  body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1000,messages:[{role:'user',content:`لخّص ${hint} التالية بالعربية في نقاط واضحة مرتبة، مع أهم المصطلحات:\n\n${text.slice(0,60000)}`}]})});
  const d=await r.json();if(d.content)return d.content.map(i=>i.text||'').join('')}catch(e){}}
 const ss=text.split(/(?<=[.!؟?\n])\s+/).filter(s=>s.length>20);if(ss.length<=5)return text;
 const f={};text.split(/\s+/).forEach(w=>{if(w.length>3)f[w]=(f[w]||0)+1});
 const sc=ss.map((s,i)=>[i,s.split(/\s+/).reduce((a,w)=>a+(f[w]||0),0)/Math.sqrt(s.length)]).sort((a,b)=>b[1]-a[1]).slice(0,6).map(x=>x[0]).sort((a,b)=>a-b);
 return '• '+sc.map(i=>ss[i]).join('\n• ')}
// ---- Recording
const SR=()=>window.Capacitor&&Capacitor.Plugins.SpeechRecognition;
let title='',rec=false,paused=false,done='',cur='',secs=0,tick;
const fmt=s=>String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
const show=()=>$('#live').textContent=(done+' '+cur).trim()||'…جاري الاستماع';
const commit=()=>{if(cur){done+=(done?' ':'')+cur;cur=''}};
const begin=()=>SR().start({language:'ar-EG',partialResults:true,popup:false});
const ui=()=>{$('#bStart').disabled=rec;$('#bPause').disabled=!rec;$('#bStop').disabled=!rec;$('#bPause').textContent=paused?'▶️ استئناف':'⏸️ إيقاف مؤقت'};
$('#bStart').onclick=async()=>{const p=SR();if(!p)return alert('التسجيل يعمل داخل تطبيق الأندرويد فقط');
 const a=await p.requestPermissions();if(a.speechRecognition==='denied')return alert('اسمح للتطبيق باستخدام الميكروفون');
 await p.removeAllListeners();
 p.addListener('partialResults',e=>{cur=e.matches[0]||'';show()});
 p.addListener('listeningState',e=>{if(e.status==='stopped'&&rec&&!paused){commit();begin()}});
 title=$('#lTitle').value.trim();$('#lTitle').disabled=true;done='';cur='';secs=0;rec=true;paused=false;begin();tick=setInterval(()=>{if(!paused)$('#timer').textContent=fmt(++secs)},1000);ui();show()};
$('#bPause').onclick=async()=>{if(!paused){paused=true;await SR().stop();commit()}else{paused=false;begin()}ui();show()};
$('#bStop').onclick=async()=>{rec=false;paused=false;clearInterval(tick);try{await SR().stop()}catch{}commit();ui();
 const text=done.trim();if(!text)return;$('#live').textContent='…جاري التلخيص';
 const summary=await summarize(text);const L=ls('lec',[]);L.unshift({id:Date.now(),title:title||'محاضرة بدون اسم',date:new Date().toLocaleString('ar-EG'),dur:fmt(secs),text,summary});sv('lec',L);$('#live').textContent=text;$('#lTitle').value='';$('#lTitle').disabled=false;renderLec()};
function renderLec(){$('#lectures').innerHTML=ls('lec',[]).map(l=>`<div class="card"><b>${esc(l.title||'محاضرة')}</b> <small>${l.date}</small> <small>(${l.dur})</small>
 <div class="sum reading"><b>الملخص</b>\n${esc(l.summary)}</div><details><summary>النص الكامل</summary><div class="reading">${esc(l.text)}</div></details>
 <button class="del" onclick="delLec(${l.id})">🗑️ حذف</button></div>`).join('')||'<p>لا توجد محاضرات بعد.</p>'}
window.delLec=id=>{sv('lec',ls('lec',[]).filter(l=>l.id!==id));renderLec()};renderLec();
// ---- PDF
let pdf=null;
$('#pdfIn').onchange=async e=>{const f=e.target.files[0];if(!f)return;pdfjsLib.GlobalWorkerOptions.workerSrc='lib/pdf.worker.min.js';
 pdf=await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise;$('#pFrom').value=1;$('#pTo').value=pdf.numPages;
 const box=$('#pages');box.innerHTML='';for(let i=1;i<=pdf.numPages;i++){const pg=await pdf.getPage(i),vp=pg.getViewport({scale:1.4}),c=document.createElement('canvas');c.width=vp.width;c.height=vp.height;box.appendChild(c);await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise}};
$('#pSum').onclick=async()=>{if(!pdf)return alert('اختر ملف PDF أولًا');const a=Math.max(1,+$('#pFrom').value||1),b=Math.min(pdf.numPages,+$('#pTo').value||pdf.numPages);let t='';
 for(let i=a;i<=b;i++){const c=await(await pdf.getPage(i)).getTextContent();t+=c.items.map(x=>x.str).join(' ')+'\n'}
 const o=$('#pSummary');o.hidden=false;o.textContent='…جاري التلخيص';o.textContent=t.trim()?await summarize(t,'الدرس'):'لا يوجد نص قابل للقراءة (ربما الملف صور ممسوحة).'};
// ---- Schedule
const days=['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
function renderS(){const S=ls('sch',[]);$('#sched').innerHTML=days.map(d=>{const x=S.filter(s=>s.day===d).sort((a,b)=>a.from.localeCompare(b.from));
 return x.length?`<div class="day">${d}</div>`+x.map(s=>`<div class="card">🕒 ${s.from} - ${s.to}<br><b>${esc(s.name)}</b> ${s.room?'📍'+esc(s.room):''} <button class="del" onclick="delS(${s.id})">🗑️</button></div>`).join(''):''}).join('')||'<p>الجدول فاضي.</p>'}
$('#sAdd').onclick=()=>{const n=$('#sName').value.trim();if(!n)return;const S=ls('sch',[]);S.push({id:Date.now(),day:$('#sDay').value,from:$('#sTime').value||'00:00',to:$('#sTimeEnd').value||'00:00',name:n,room:$('#sRoom').value});sv('sch',S);$('#sName').value='';$('#sRoom').value='';renderS()};
window.delS=id=>{sv('sch',ls('sch',[]).filter(s=>s.id!==id));renderS()};renderS();
