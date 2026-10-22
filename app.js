
const app=document.querySelector('#app');
const KEY='erl-v2';
const oldState=JSON.parse(localStorage.getItem('erl-v1')||'{}');
const state=JSON.parse(localStorage.getItem(KEY)||'null')||{
  saved:oldState.saved||{}, completed:oldState.completed||{}, streak:{last:'',count:0},
  settings:{voiceAURI:oldState.settings?.voiceAURI||oldState.settings?.voiceURI||'',voiceBURI:oldState.settings?.voiceBURI||'',rateNormal:0.90,rateSlow:0.68},
  recent:[], mode:'day'
};
const intervals=[1,3,7,14,30];
let voices=[], dialogueRun=0, practiceRun=0, speakTimer=null, speakDeadline=0;
const nfc=s=>typeof s==='string'?s.normalize('NFC'):s;
Object.values(state.saved||{}).forEach(v=>{v.text=nfc(v.text);v.meaning=nfc(v.meaning)});
const save=()=>localStorage.setItem(KEY,JSON.stringify(state));
save();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const todayKey=()=>new Date().toISOString().slice(0,10);
function touchStreak(){
  const t=todayKey(); if(state.streak.last===t)return;
  const y=new Date();y.setDate(y.getDate()-1);const yk=y.toISOString().slice(0,10);
  state.streak.count=state.streak.last===yk?(state.streak.count||0)+1:1;state.streak.last=t;save();
}
function loadVoices(){voices=speechSynthesis.getVoices().filter(v=>/^en(-|_)/i.test(v.lang));return voices}
loadVoices(); if('speechSynthesis'in window)speechSynthesis.onvoiceschanged=loadVoices;
function voiceByURI(uri){loadVoices();return voices.find(x=>x.voiceURI===uri)||null}
function preferredVoice(speaker='A'){
  loadVoices(); let uri=speaker==='B'?state.settings.voiceBURI:state.settings.voiceAURI, v=voiceByURI(uri);if(v)return v;
  if(speaker==='A') return voices.find(x=>/Clara Online \(Natural\)/i.test(x.name))||voices.find(x=>/^en-CA/i.test(x.lang)&&/clara|female/i.test(x.name))||voices.find(x=>/^en-US/i.test(x.lang)&&/zira|female/i.test(x.name))||voices[0]||null;
  return voices.find(x=>/Liam Online \(Natural\)/i.test(x.name))||voices.find(x=>/^en-CA/i.test(x.lang)&&/liam|male/i.test(x.name))||voices.find(x=>/^en-US/i.test(x.lang)&&/mark|david|male/i.test(x.name))||voices[0]||null;
}
function utter(text,mode='normal',speaker='A',onend=null){
  const u=new SpeechSynthesisUtterance(text),v=preferredVoice(speaker);if(v){u.voice=v;u.lang=v.lang}else u.lang='en-US';
  u.rate=mode==='slow'?state.settings.rateSlow:state.settings.rateNormal;u.pitch=speaker==='A'?1.02:.98;if(onend)u.onend=onend;return u;
}
function speak(text,mode='normal',speaker='A'){if(!('speechSynthesis'in window))return;speechSynthesis.cancel();speechSynthesis.speak(utter(text,mode,speaker))}
function stopAll(){dialogueRun++;practiceRun++;if(speakTimer){clearTimeout(speakTimer);speakTimer=null}speechSynthesis.cancel();document.querySelectorAll('.playing,.your-turn').forEach(x=>x.classList.remove('playing','your-turn'))}
function topicCodes(){return [...new Set(LESSONS.map(x=>x.topic))]}
function topicLabel(t){const m={Travel:'Travel Planning',Airport:'Airport & Flying',Hotel:'Hotels',Food:'Food & Restaurants',Transport:'Getting Around',Shopping:'Shopping & Services',Sightseeing:'Sightseeing',Problems:'Travel Problems',Meeting:'Meeting People',Social:'Social Life',Daily:'Daily Life',Opinion:'Opinions',Culture:'Culture',Books:'Books & Reading',Work:'Work & Presentations',Natural:'Natural Conversation',Help:'Asking for Help',Health:'Health & Pharmacy',Cafe:'Café English',Tech:'Technology'};return m[t]||t}
function dueCount(){return Object.values(state.saved).filter(v=>(v.due||0)<=Date.now()).length}
function settingsButton(){return `<button class="settings-btn" onclick="voiceSettings()">⚙ Voice</button>`}
function navTitle(title,sub=''){return `<div><div class="eyebrow">${esc(sub)}</div><h1>${esc(title)}</h1></div>`}
function continueLesson(){const undone=LESSONS.find(x=>!state.completed[x.id]);return undone||LESSONS[0]}
function home(){
  stopAll();touchStreak();const done=Object.keys(state.completed).length,saved=Object.keys(state.saved).length,due=dueCount(),next=continueLesson();
  app.innerHTML=`<main class="wrap"><section class="hero"><div class="toprow"><div class="eyebrow">English for Real Life · V2.0</div>${settingsButton()}</div><h1>Learn what you’ll actually say.</h1><p>Daytime reading. Evening listening, shadowing and speaking.</p></section>
  <section class="stats four"><div class="stat"><b>${done}/${LESSONS.length}</b><span>lessons</span></div><div class="stat"><b>${saved}</b><span>phrases</span></div><div class="stat"><b>${due}</b><span>due today</span></div><div class="stat"><b>${state.streak.count||0}</b><span>day streak</span></div></section>
  <section class="today card"><div class="section-title"><h2>Today</h2><span class="due">≈ 20–25 min</span></div>
  <div class="today-grid"><button onclick="lesson('${next.id}')"><b>📖 New lesson</b><small>${next.id} · ${esc(next.title)}</small></button><button onclick="review()"><b>🔁 Vocabulary</b><small>${due} phrase${due===1?'':'s'} due</small></button><button onclick="lesson('${state.recent[0]||next.id}','listen')"><b>🎧 Listening</b><small>Replay a recent lesson</small></button><button onclick="lesson('${state.recent[0]||next.id}','shadow')"><b>🗣 Shadow</b><small>Listen → pause → repeat</small></button></div></section>
  <div class="section-title"><h2>Topics</h2><button class="textbtn" onclick="browse()">Browse all</button></div>
  <section class="topic-grid">${topicCodes().map(t=>`<div class="card topic" onclick="topic('${t}')"><div class="eyebrow">${t}</div><b>${topicLabel(t)}</b><small>${LESSONS.filter(x=>x.topic===t).length} lessons</small></div>`).join('')}</section></main>`}
function browse(){
  stopAll();app.innerHTML=`<main class="wrap"><div class="toprow">${navTitle('Browse lessons','180 practical conversations')}${settingsButton()}</div><div class="searchbar"><input id="q" placeholder="Search topic, lesson or situation…" oninput="filterBrowse()"><select id="tf" onchange="filterBrowse()"><option value="">All topics</option>${topicCodes().map(t=>`<option>${t}</option>`).join('')}</select></div><div id="results"></div></main>`;filterBrowse();
}
function filterBrowse(){
  const q=(document.querySelector('#q')?.value||'').toLowerCase(),tf=document.querySelector('#tf')?.value||'';
  const arr=LESSONS.filter(l=>(!tf||l.topic===tf)&&(!q||`${l.id} ${l.topic} ${l.title} ${l.desc}`.toLowerCase().includes(q)));
  document.querySelector('#results').innerHTML=`<p class="muted">${arr.length} lessons</p>`+arr.map(l=>lessonCard(l)).join('');
}
function lessonCard(l){return `<div class="lesson-card" onclick="lesson('${l.id}')"><div class="eyebrow">${l.id} · ${l.topic}</div><h2>${esc(l.title)}</h2><p class="muted">${esc(l.desc)}</p>${state.completed[l.id]?'<span class="due">✓ completed</span>':''}</div>`}
function topic(t){stopAll();let ls=LESSONS.filter(x=>x.topic===t);app.innerHTML=`<main class="wrap"><div class="toprow"><button class="back" onclick="home()">← Home</button>${settingsButton()}</div><div class="eyebrow">${t}</div><h1>${topicLabel(t)}</h1><p class="muted">${ls.length} practical conversations. Choose what you need; you do not have to study in order.</p>${ls.map(lessonCard).join('')}</main>`}
function addRecent(id){state.recent=[id,...state.recent.filter(x=>x!==id)].slice(0,8);save()}
function lesson(id,startMode='read'){
  stopAll();let l=LESSONS.find(x=>x.id===id);if(!l)return;addRecent(id);
  app.innerHTML=`<main class="wrap"><div class="toprow"><button class="back" onclick="topic('${l.topic}')">← ${l.topic}</button>${settingsButton()}</div>
  <section class="lesson-head"><div class="eyebrow">${l.id}</div><h1>${esc(l.title)}</h1><p class="muted">${esc(l.desc)}</p>
  <div class="mode-tabs"><button data-mode="read" onclick="setLessonMode('read','${id}')">📖 Read</button><button data-mode="listen" onclick="setLessonMode('listen','${id}')">🎧 Listen</button><button data-mode="shadow" onclick="setLessonMode('shadow','${id}')">🗣 Shadow</button><button data-mode="speak" onclick="setLessonMode('speak','${id}')">💬 Speak</button></div>
  <div id="modePanel"></div></section>
  <section class="dialogue">${l.turns.map((x,i)=>`<article class="turn" data-turn="${i}"><div class="speaker">${esc(x[0])}</div><div class="transcript"><div class="english">${esc(x[1])}</div><div class="ipa">${esc(x[2])}</div><div class="vi">${esc(x[3])}</div></div><div class="actions"><button class="iconbtn" onclick='speak(${JSON.stringify(x[1])},"normal","${speakerFor(x[0],i)}")'>🔊 Normal</button><button class="iconbtn slow" onclick='speak(${JSON.stringify(x[1])},"slow","${speakerFor(x[0],i)}")'>🐢 Slow</button></div></article>`).join('')}</section>
  <div class="section-title"><h2>Useful expressions</h2><span class="muted">Save phrases, not isolated words</span></div>
  <section class="card">${l.phrases.map((p,i)=>{let k=id+'-'+i,s=state.saved[k];return `<div class="phrase"><div class="grow"><b>${esc(p[0])}</b><small>${esc(p[1])}</small></div><button class="iconbtn" onclick="togglePhrase('${id}',${i})">${s?'★':'☆'}</button></div>`}).join('')}</section>
  <p class="complete-row"><button class="btn" onclick="complete('${id}')">${state.completed[id]?'✓ Completed':'Mark lesson complete'}</button></p></main>`;
  setLessonMode(startMode,id);
}
function speakerFor(label,i){return /(^B$|other|server|staff|officer|reception|pharmacist|doctor|barista|local|listener)/i.test(label)?'B':(i%2?'B':'A')}
function setLessonMode(mode,id){
  stopAll();const l=LESSONS.find(x=>x.id===id),area=document.querySelector('.dialogue'),panel=document.querySelector('#modePanel');if(!l||!area)return;
  document.querySelectorAll('.mode-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));area.classList.remove('listening-mode','speak-mode');
  if(mode==='read'){panel.innerHTML=`<p class="muted mode-help">Read for meaning first. Use IPA only when a sound is unclear.</p>`}
  if(mode==='listen'){area.classList.add('listening-mode');panel.innerHTML=`<div class="practicebar"><button class="btn" onclick="playFullDialogue('${id}')">▶ Play full dialogue</button><button class="btn secondary" onclick="stopAll()">■ Stop</button><button class="btn secondary" onclick="toggleTranscript()">👁 Show transcript</button></div><p class="muted mode-help">Listen once without reading. Then reveal the transcript and listen again.</p>`}
  if(mode==='shadow'){panel.innerHTML=`<div class="practicebar"><button class="btn" onclick="startShadow('${id}')">▶ Start shadowing</button><button class="btn secondary" onclick="stopAll()">■ Stop</button></div><p class="muted mode-help">The app reads one sentence, pauses for you to repeat it, then continues automatically.</p>`}
  if(mode==='speak'){area.classList.add('speak-mode');panel.innerHTML=`<div class="practicebar"><button class="btn" onclick="startSpeakPractice('${id}')">▶ Start role-play</button><button class="btn secondary" onclick="stopAll()">■ Stop</button></div><div id="speakPrompt" class="speak-prompt muted">You will answer every second turn. Try first, then reveal the model answer.</div>`}
}
function toggleTranscript(){document.querySelector('.dialogue')?.classList.toggle('listening-mode')}
function playFullDialogue(id){
  const l=LESSONS.find(x=>x.id===id);if(!l)return;stopAll();const run=dialogueRun;let i=0;
  const next=()=>{if(run!==dialogueRun||i>=l.turns.length)return;const el=document.querySelector(`[data-turn="${i}"]`);el?.classList.add('playing');const x=l.turns[i],u=utter(x[1],'normal',speakerFor(x[0],i),()=>{el?.classList.remove('playing');i++;setTimeout(next,420)});speechSynthesis.speak(u)};next();
}
function startShadow(id){
  const l=LESSONS.find(x=>x.id===id);if(!l)return;stopAll();const run=practiceRun;let i=0;
  const next=()=>{if(run!==practiceRun||i>=l.turns.length)return;const x=l.turns[i],el=document.querySelector(`[data-turn="${i}"]`);el?.scrollIntoView({behavior:'smooth',block:'center'});el?.classList.add('playing');
    const u=utter(x[1],'normal',speakerFor(x[0],i),()=>{el?.classList.remove('playing');const pause=Math.max(2800,Math.min(6500,x[1].split(/\s+/).length*420));i++;setTimeout(next,pause)});speechSynthesis.speak(u)};next();
}
function speakWaitMs(text){return Math.max(4500,Math.min(11000,1800+String(text).trim().split(/\s+/).length*520))}
function startSpeakPractice(id){
  const l=LESSONS.find(x=>x.id===id);if(!l)return;stopAll();const run=practiceRun;let i=0;const prompt=document.querySelector('#speakPrompt');
  const step=()=>{
    if(run!==practiceRun)return;
    if(i>=l.turns.length){if(prompt)prompt.innerHTML='<b>✓ Role-play finished.</b> Try it again without looking at the transcript.';return}
    document.querySelectorAll('.playing,.your-turn').forEach(x=>x.classList.remove('playing','your-turn'));
    const x=l.turns[i],el=document.querySelector(`[data-turn="${i}"]`);el?.scrollIntoView({behavior:'smooth',block:'center'});
    if(i%2===0){
      el?.classList.add('playing');prompt.innerHTML='<b>🎧 Listen to A.</b> Your turn comes next.';
      speechSynthesis.speak(utter(x[1],'normal',speakerFor(x[0],i),()=>{el?.classList.remove('playing');i++;setTimeout(step,350)}));
    }else{
      el?.classList.add('your-turn');const wait=speakWaitMs(x[1]);speakDeadline=Date.now()+wait;
      prompt.innerHTML=`<b>🎤 Your turn – Speak B</b><span class="speak-note">The next A line will play automatically.</span><div class="speak-actions"><button class="textbtn" onclick="moreSpeakTime()">+ More time</button><button class="textbtn" onclick="advanceSpeak()">Next →</button><button class="textbtn" onclick="hearModel('${id}',${i})">Hear model</button></div>`;
      window._speak={id,run,getIndex:()=>i,advance:()=>{if(run!==practiceRun)return;if(speakTimer){clearTimeout(speakTimer);speakTimer=null}el?.classList.remove('your-turn');i++;step();}};
      speakTimer=setTimeout(()=>window._speak?.advance(),wait);
    }
  };step();
}
function moreSpeakTime(){if(!window._speak||window._speak.run!==practiceRun)return;if(speakTimer)clearTimeout(speakTimer);speakDeadline=Date.now()+4000;speakTimer=setTimeout(()=>window._speak?.advance(),4000);const p=document.querySelector('#speakPrompt .speak-note');if(p)p.textContent='Added 4 seconds.'}
function advanceSpeak(){window._speak?.advance?.()}
function hearModel(id,i){const l=LESSONS.find(x=>x.id===id),x=l?.turns[i];if(!x)return;if(speakTimer)clearTimeout(speakTimer);speechSynthesis.cancel();speechSynthesis.speak(utter(x[1],'normal',speakerFor(x[0],i),()=>{speakTimer=setTimeout(()=>window._speak?.advance(),1800)}))}
function togglePhrase(id,i){
  const l=LESSONS.find(x=>x.id===id),k=id+'-'+i;if(state.saved[k])delete state.saved[k];else state.saved[k]={id,i,text:l.phrases[i][0],meaning:l.phrases[i][1],stage:0,due:Date.now(),topic:l.topic};save();lesson(id)
}
function complete(id){state.completed[id]=Date.now();touchStreak();save();lesson(id)}
function vocab(){
  stopAll();const a=Object.entries(state.saved);app.innerHTML=`<main class="wrap"><div class="toprow">${navTitle('My Vocabulary',`${a.length} saved expressions`)}${settingsButton()}</div><div class="searchbar"><input id="vq" placeholder="Search saved phrases…" oninput="filterVocab()"><select id="vf" onchange="filterVocab()"><option value="">All topics</option>${topicCodes().map(t=>`<option>${t}</option>`).join('')}</select></div><div id="vresults"></div></main>`;filterVocab();
}
function filterVocab(){
  const q=(document.querySelector('#vq')?.value||'').toLowerCase(),tf=document.querySelector('#vf')?.value||'';
  const a=Object.entries(state.saved).filter(([k,v])=>(!tf||v.topic===tf)&&(!q||`${v.text} ${v.meaning}`.toLowerCase().includes(q)));
  document.querySelector('#vresults').innerHTML=a.length?a.map(([k,v])=>`<div class="card phrase"><div class="grow"><b>${esc(v.text)}</b><small>${esc(v.meaning)}</small><div><span class="due">${(v.due||0)<=Date.now()?'Due now':'Review '+new Date(v.due).toLocaleDateString()}</span></div></div><button class="iconbtn" onclick='speak(${JSON.stringify(v.text)},"normal","A")'>🔊</button><button class="iconbtn" onclick="removePhrase('${k}')">×</button></div>`).join(''):`<div class="card empty"><h2>No phrases here yet</h2><p class="muted">Save useful expressions from a lesson with ☆.</p></div>`;
}
function removePhrase(k){delete state.saved[k];save();filterVocab()}
function review(){
  stopAll();let due=Object.entries(state.saved).filter(([k,v])=>(v.due||0)<=Date.now());if(!due.length){app.innerHTML=`<main class="wrap"><div class="toprow">${navTitle('Nothing due right now','Review')}${settingsButton()}</div><div class="card empty"><p class="muted">Keep saving useful expressions. Reviews follow a 1–3–7–14–30 day rhythm.</p></div></main>`;return}
  let [k,v]=due[0];app.innerHTML=`<main class="wrap"><div class="eyebrow">Review · ${due.length} due</div><h1>Can you say this in English?</h1><div class="card reviewcard"><p class="muted">Vietnamese</p><h2>${esc(v.meaning)}</h2><button class="btn secondary" onclick="reveal('${k}')">Show answer</button><div id="answer"></div></div></main>`;
}
function reveal(k){let v=state.saved[k];document.querySelector('#answer').innerHTML=`<hr><div class="english">${esc(v.text)}</div><div class="actions"><button class="iconbtn" onclick='speak(${JSON.stringify(v.text)},"normal","A")'>🔊 Normal</button><button class="iconbtn slow" onclick='speak(${JSON.stringify(v.text)},"slow","A")'>🐢 Slow</button></div><div class="rating"><button onclick="rate('${k}','again')">Again</button><button onclick="rate('${k}','hard')">Hard</button><button onclick="rate('${k}','good')">Good</button><button onclick="rate('${k}','easy')">Easy</button></div>`}
function rate(k,r){
  let v=state.saved[k],s=v.stage||0;if(r==='again')s=0;if(r==='hard')s=Math.max(0,s);if(r==='good')s=Math.min(s+1,4);if(r==='easy')s=Math.min(s+2,4);v.stage=s;
  const mult=r==='hard'?.6:1;v.due=Date.now()+intervals[s]*mult*86400000;touchStreak();save();review();
}
function voiceSettings(){
  stopAll();loadVoices();const va=preferredVoice('A'),vb=preferredVoice('B'),opts=sel=>voices.length?voices.map(v=>`<option value="${esc(v.voiceURI)}" ${sel&&v.voiceURI===sel.voiceURI?'selected':''}>${esc(v.name)} — ${esc(v.lang)}${v.default?' · default':''}</option>`).join(''):'<option>No English voices found</option>';
  app.innerHTML=`<main class="wrap"><button class="back" onclick="home()">← Back</button><div class="eyebrow">Audio</div><h1>Voice Settings</h1><p class="muted">Recommended on your computer: Clara for A and Liam for B.</p><section class="card settings-card"><label><b>Speaker A</b></label><select id="voiceASelect">${opts(va)}</select><div class="voice-test"><button class="btn secondary" onclick="previewSpeaker('A')">🔊 Test A</button></div><label class="second-label"><b>Speaker B</b></label><select id="voiceBSelect">${opts(vb)}</select><div class="voice-test"><button class="btn secondary" onclick="previewSpeaker('B')">🔊 Test B</button></div><button class="btn" onclick="saveVoices()">Save voices</button></section></main>`;
}
function previewSpeaker(s){const el=document.querySelector(s==='A'?'#voiceASelect':'#voiceBSelect');if(el){if(s==='A')state.settings.voiceAURI=el.value;else state.settings.voiceBURI=el.value}speak(s==='A'?'Have you decided where you want to go this year?':"I'm thinking about Italy, but I haven't planned anything yet.",'normal',s)}
function saveVoices(){const a=document.querySelector('#voiceASelect'),b=document.querySelector('#voiceBSelect');if(a)state.settings.voiceAURI=a.value;if(b)state.settings.voiceBURI=b.value;save();home()}
document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>({home,review,vocab,browse}[b.dataset.nav]||home)());
if('serviceWorker'in navigator){navigator.serviceWorker.register('./sw.js').then(r=>r.update()).catch(()=>{});navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!window._reloading){window._reloading=true;location.reload()}})}
home();
