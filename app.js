(() => {
  'use strict';
  const TOPICS = window.IOI_CURRICULUM || [];
  const STORE_KEY = 'ioi-os-progress-v1';
  const CURRICULUM_PREFS_KEY = 'ioi-os-curriculum-customizations-v1';
  const SUPABASE_URL = 'https://bztsnkejidzjjlaghtly.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Cef2U5pCDcDJp9DUpe36KA_8DrAetWc';
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const today = () => new Date().toISOString().slice(0,10);
  const dateLabel = (iso) => new Date(iso+'T12:00:00').toLocaleDateString(undefined,{day:'numeric',month:'short'});
  const freshState = () => ({version:1,topics:{},sessions:[],activeDays:[],preferences:{timerMinutes:25}});
  let state = loadState();
  let selectedTopic = 1;
  applyCurriculumPreferences();
  let timerSeconds = 25*60, timerRunning = false, timerInterval = null;
  let toastTimeout;
  let supabaseClient = null, cloudUser = null, cloudChannel = null, cloudSaveTimer = null, cloudBusy = false, lastCloudJson = '';
  let handlingCloudEvent = false;

  function loadState(){
    try { return {...freshState(), ...JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}; }
    catch { return freshState(); }
  }
  function loadCurriculumPreferences(){
    try { return JSON.parse(localStorage.getItem(CURRICULUM_PREFS_KEY)||'{}') || {}; } catch { return {}; }
  }
  function saveCurriculumPreferences(){
    const prefs=loadCurriculumPreferences();
    prefs.playlists=Object.fromEntries(TOPICS.map(t=>[String(t.number),t.playlist]));
    prefs.order=TOPICS.map(t=>t.number);
    localStorage.setItem(CURRICULUM_PREFS_KEY,JSON.stringify(prefs));
  }
  function applyCurriculumPreferences(){
    const prefs=loadCurriculumPreferences();
    TOPICS.forEach(t=>{if(prefs.playlists && typeof prefs.playlists[String(t.number)]==='string') t.playlist=prefs.playlists[String(t.number)];});
    if(Array.isArray(prefs.order)){
      const byId=new Map(TOPICS.map(t=>[t.number,t]));
      const reordered=prefs.order.map(id=>byId.get(Number(id))).filter(Boolean);
      TOPICS.forEach(t=>{if(!reordered.includes(t))reordered.push(t);});
      TOPICS.splice(0,TOPICS.length,...reordered);
    }
  }
  function moveTopic(topicId,delta){
    const index=TOPICS.findIndex(t=>t.number===topicId), target=index+delta;
    if(index<0||target<0||target>=TOPICS.length)return;
    const [topic]=TOPICS.splice(index,1);TOPICS.splice(target,0,topic);
    saveCurriculumPreferences();renderAll();renderTopicList();populateSessionTopics();
    toast(`Moved ${topic.title} ${delta<0?'up':'down'}.`);
  }
  function editPlaylist(topicId){
    const topic=TOPICS.find(t=>t.number===topicId);if(!topic)return;
    const value=prompt(`Edit YouTube playlist URL for ${topic.title}:`,topic.playlist);
    if(value===null)return;
    const url=value.trim();
    if(!/^https?:\/\/(www\.)?(youtube\.com|m\.youtube\.com|youtu\.be)\//i.test(url)){toast('Enter a valid YouTube URL.');return;}
    topic.playlist=url;saveCurriculumPreferences();renderAll();renderTopicList();renderTopicDetail();
    toast('Playlist link updated on this device.');
  }
  function saveState(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); renderAll(); if(!handlingCloudEvent) queueCloudSave(); }
  function queueCloudSave(){ if(!supabaseClient || !cloudUser) return; clearTimeout(cloudSaveTimer); cloudSaveTimer=setTimeout(()=>pushCloudState(),650); }
  function setCloudStatus(label,message,kind=''){ const pill=$('#cloud-status-pill'), copy=$('#cloud-status-copy'); if(pill){pill.textContent=label;pill.className='cloud-pill'+(kind?' '+kind:'');} if(copy)copy.textContent=message; }
  function showCloudAccount(user){ cloudUser=user||null; const form=$('#cloud-auth-form'), panel=$('#cloud-account-panel'); if(form)form.hidden=!!cloudUser; if(panel)panel.hidden=!cloudUser; if(cloudUser){$('#cloud-account-email').textContent=cloudUser.email||'Signed-in account';setCloudStatus('SYNC ENABLED','Signed in. Your progress is syncing across devices.','connected');} else if(supabaseClient){setCloudStatus('LOCAL MODE','Sign in on this device and your other device to enable cloud sync.');} }
  function mergeStates(local,remote){
    const merged={...remote,...local,version:1,topics:{},sessions:[],activeDays:[],preferences:{...(remote.preferences||{}),...(local.preferences||{})}};
    const ids=new Set([...Object.keys(remote.topics||{}),...Object.keys(local.topics||{})]);
    ids.forEach(id=>{const a=(local.topics||{})[id],b=(remote.topics||{})[id];if(!a){merged.topics[id]=b;return;}if(!b){merged.topics[id]=a;return;}if(a.updatedAt&&b.updatedAt){merged.topics[id]=new Date(a.updatedAt)>=new Date(b.updatedAt)?a:b;return;}merged.topics[id]={...b,...a,playlistDone:!!(a.playlistDone||b.playlistDone),solved:[...new Set([...(b.solved||[]),...(a.solved||[])])]};});
    const sessions=new Map();[...(remote.sessions||[]),...(local.sessions||[])].forEach(x=>sessions.set(x.createdAt||JSON.stringify(x),x));merged.sessions=[...sessions.values()].sort((a,b)=>String(a.createdAt||'').localeCompare(String(b.createdAt||'')));
    merged.activeDays=[...new Set([...(remote.activeDays||[]),...(local.activeDays||[])])].sort();return merged;
  }
  async function pushCloudState(){
    if(!supabaseClient||!cloudUser||cloudBusy)return; cloudBusy=true; const snapshot=JSON.stringify(state);
    try{const {data,error}=await supabaseClient.rpc('ioi_os_merge_cloud_state',{p_state:JSON.parse(snapshot)});if(error)throw error;lastCloudJson=JSON.stringify(data||{});if(JSON.stringify(state)===snapshot&&data){state={...freshState(),...data};localStorage.setItem(STORE_KEY,JSON.stringify(state));renderAll();}else if(data){state=mergeStates(state,data);localStorage.setItem(STORE_KEY,JSON.stringify(state));renderAll();}setCloudStatus('SYNCED','Last cloud sync succeeded · '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}),'connected');}
    catch(err){console.error('IOI OS cloud sync failed',err);setCloudStatus('SYNC ERROR',err.message||'Could not sync. Your local progress is safe.','error');}
    finally{cloudBusy=false;}
  }
  async function syncCloudNow(){if(!supabaseClient||!cloudUser)return;setCloudStatus('SYNCING','Merging this device with your cloud progress…');await pushCloudState();}
  async function attachCloudRealtime(user){if(cloudChannel){await supabaseClient.removeChannel(cloudChannel);cloudChannel=null;}if(!user)return;cloudChannel=supabaseClient.channel('ioi-os-state-'+user.id).on('postgres_changes',{event:'UPDATE',schema:'public',table:'ioi_os_cloud_state',filter:'user_id=eq.'+user.id},payload=>{if(!payload.new?.state)return;const incoming=payload.new.state;if(JSON.stringify(incoming)===JSON.stringify(state))return;handlingCloudEvent=true;state=mergeStates(state,incoming);localStorage.setItem(STORE_KEY,JSON.stringify(state));renderAll();handlingCloudEvent=false;queueCloudSave();}).subscribe();}
  async function handleCloudAuth(user){showCloudAccount(user);if(user){await syncCloudNow();await attachCloudRealtime(user);}else if(cloudChannel){await supabaseClient.removeChannel(cloudChannel);cloudChannel=null;}}
  async function initCloud(){
    if(!window.supabase?.createClient){setCloudStatus('OFFLINE','Supabase client could not load. Local progress still works.','error');return;}
    supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    $('#cloud-sign-in').addEventListener('click',async()=>{const email=$('#cloud-email').value.trim(),password=$('#cloud-password').value;if(!email||!password){toast('Enter your email and password.');return;}setCloudStatus('SIGNING IN','Checking your account…');const {data,error}=await supabaseClient.auth.signInWithPassword({email,password});if(error){setCloudStatus('SIGN-IN FAILED',error.message,'error');return;}await handleCloudAuth(data.user);toast('Signed in. Cloud sync is enabled.');});
    $('#cloud-sign-up').addEventListener('click',async()=>{const email=$('#cloud-email').value.trim(),password=$('#cloud-password').value;if(!email||password.length<8){toast('Enter an email and a password with at least 8 characters.');return;}setCloudStatus('CREATING ACCOUNT','Creating your private sync account…');const {data,error}=await supabaseClient.auth.signUp({email,password});if(error){setCloudStatus('SIGN-UP FAILED',error.message,'error');return;}if(data.session){await handleCloudAuth(data.user);toast('Account created. Cloud sync is enabled.');}else{setCloudStatus('CHECK YOUR EMAIL','Account created. Confirm your email, then sign in on both devices.');toast('Check your email to confirm your account.');}});
    $('#cloud-sign-out').addEventListener('click',async()=>{const {error}=await supabaseClient.auth.signOut();if(error){toast(error.message);return;}showCloudAccount(null);setCloudStatus('LOCAL MODE','Signed out. Local progress remains on this device.');toast('Signed out.');});
    $('#cloud-sync-now').addEventListener('click',syncCloudNow);
    supabaseClient.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){showCloudAccount(null);if(cloudChannel){supabaseClient.removeChannel(cloudChannel);cloudChannel=null;}return;}if(session?.user&&cloudUser?.id!==session.user.id){setTimeout(()=>handleCloudAuth(session.user),0);}});
    const {data:{session},error}=await supabaseClient.auth.getSession();if(error){setCloudStatus('AUTH ERROR',error.message,'error');return;}if(session?.user)await handleCloudAuth(session.user);else showCloudAccount(null);
  }
  function topicState(id){
    if(!state.topics[id]) state.topics[id]={playlistDone:false,solved:[],updatedAt:new Date().toISOString()};
    return state.topics[id];
  }
  function allTaskCount(){ return TOPICS.reduce((n,t)=>n+t.tasks.length,0); }
  function solvedCount(){ return TOPICS.reduce((n,t)=>n+t.tasks.filter((p,i)=>topicState(t.number).solved.includes(i)).length,0); }
  function playlistCount(){ return TOPICS.filter(t=>topicState(t.number).playlistDone).length; }
  function completedTopics(){ return TOPICS.filter(t=>isComplete(t)).length; }
  function isComplete(t){ const s=topicState(t.number); return s.playlistDone && s.solved.length >= t.tasks.length; }
  function topicStatus(t){
    const s=topicState(t.number);
    if(isComplete(t)) return 'completed';
    if(s.playlistDone || s.solved.length) return 'in-progress';
    return 'not-started';
  }
  function totalMinutes(){ return state.sessions.reduce((n,s)=>n+(Number(s.minutes)||0),0); }
  function streak(){
    const days = [...new Set([...(state.activeDays||[]), ...state.sessions.map(s=>s.date)])].sort().reverse();
    if(!days.length) return 0;
    const d=new Date(); d.setHours(0,0,0,0);
    const iso=x=>x.toISOString().slice(0,10);
    let cursor=iso(d);
    if(!days.includes(cursor)){ d.setDate(d.getDate()-1); cursor=iso(d); if(!days.includes(cursor)) return 0; }
    let n=0;
    while(days.includes(cursor)){ n++; d.setDate(d.getDate()-1); cursor=iso(d); }
    return n;
  }
  function escapeHtml(s){ return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function topicProgress(t){
    const s=topicState(t.number), total=t.tasks.length;
    const done=(s.solved||[]).length + (s.playlistDone?1:0);
    return Math.round(done/(total+1)*100);
  }
  function toast(message){
    const el=$('#toast'); if(!el) return;
    el.textContent=message; el.classList.add('show');
    clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>el.classList.remove('show'),2600);
  }
  function go(view){
    $$('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
    $('#crumb-current').textContent=view.replaceAll('-',' ').toUpperCase();
    $('#sidebar').classList.remove('open');
    if(view==='curriculum') renderTopicList();
    if(view==='practice') renderPractice();
    if(view==='analytics') renderAnalytics();
    if(view==='session') populateSessionTopics();
    window.scrollTo({top:0,behavior:'smooth'});
  }
  function nextTopic(){ return TOPICS.find(t=>!isComplete(t)) || TOPICS[TOPICS.length-1]; }
  function renderDashboard(){
    const complete=completedTopics(), solved=solvedCount(), tasks=allTaskCount(), pl=playlistCount();
    $('#metric-topics').innerHTML=`${complete}<span class="metric-small"> / ${TOPICS.length}</span>`;
    $('#metric-solved').innerHTML=`${solved}<span class="metric-small" id="metric-task-total"> / ${tasks}</span>`;
    $('#metric-streak').textContent=streak();
    $('#metric-hours').textContent=(totalMinutes()/60).toFixed(1);
    $('#metric-topic-next').textContent=complete===TOPICS.length?'All topics complete':`Next: ${String(nextTopic().number).padStart(2,'0')}`;
    $('#metric-task-note').textContent=`${tasks-solved} task assignments remaining`;
    const pct=Math.round(complete/TOPICS.length*100);
    $('#readiness-value').textContent=pct+'%';
    $('#readiness-ring').style.setProperty('--progress',pct+'%');
    $('#readiness-title').textContent=pct===100?'Sequence completed':pct>=50?'Strong progress':'Build your baseline';
    $('#readiness-copy').textContent=`${complete} of ${TOPICS.length} topics complete. A topic counts only when its playlist and all listed tasks are checked.`;
    $('#playlist-complete-count').textContent=`${pl} / ${TOPICS.length}`;
    $('#task-complete-count').textContent=`${solved} / ${tasks}`;
    $('#sidebar-progress-label').textContent=pct+'%';
    $('#sidebar-progress-bar').style.width=pct+'%';
    $('#nav-topic-count').textContent=TOPICS.length;
    $('#nav-problem-count').textContent=tasks-solved;
    const next=nextTopic(), ns=topicState(next.number);
    $('#next-topic-title').textContent=`${String(next.number).padStart(2,'0')} · ${next.title}`;
    $('#next-topic-card').innerHTML=`<div class="next-topic-meta"><span class="status-pill ${topicStatus(next)}">${topicStatus(next).replace('-',' ')}</span><span>${next.tasks.length} CSES tasks</span></div><p>${isComplete(next)?'This sequence is complete. Review any topic or revisit its practice set.':'Study the linked playlist, then solve every task listed for this topic.'}</p><div class="next-topic-actions"><a class="button button-primary" href="${next.playlist}" target="_blank" rel="noopener">Open playlist ↗</a><button class="button button-quiet" data-open-topic="${next.number}">Open topic details</button></div><div class="mini-progress"><div class="progress-track"><div class="progress-fill" style="width:${topicProgress(next)}%"></div></div><span>${topicProgress(next)}% checklist</span></div>`;
    $('#next-topic-card [data-open-topic]').addEventListener('click',()=>{selectedTopic=next.number;go('curriculum');renderTopicList();renderTopicDetail();});
    const upcoming=TOPICS.filter(t=>!isComplete(t)).slice(0,5);
    $('#upcoming-list').innerHTML=upcoming.map(t=>`<div class="timeline-item"><div class="timeline-marker">${String(t.number).padStart(2,'0')}</div><div class="timeline-copy"><strong>${escapeHtml(t.title)}</strong><span>${topicState(t.number).solved.length}/${t.tasks.length} tasks · ${topicState(t.number).playlistDone?'playlist watched':'playlist pending'}</span></div><button class="tiny-open" data-open-topic="${t.number}">Open</button></div>`).join('')||'<p class="muted-small">All topics complete. Excellent work.</p>';
    $$('[data-open-topic]', $('#upcoming-list')).forEach(b=>b.addEventListener('click',()=>{selectedTopic=Number(b.dataset.openTopic);go('curriculum');renderTopicList();renderTopicDetail();}));
    const blocks=[];
    for(let start=0;start<TOPICS.length;start+=10){
      const group=TOPICS.slice(start,start+10), solvedIn=group.reduce((n,t)=>n+topicState(t.number).solved.length,0), total=group.reduce((n,t)=>n+t.tasks.length,0);
      blocks.push(`<div class="practice-block"><div class="flex-between"><strong>Topics ${String(group[0].number).padStart(2,'0')}–${String(group[group.length-1].number).padStart(2,'0')}</strong><span>${solvedIn}/${total} tasks</span></div><div class="progress-track"><div class="progress-fill" style="width:${total?solvedIn/total*100:0}%"></div></div></div>`);
    }
    $('#practice-summary').innerHTML=blocks.join('');
  }
  function renderTopicList(){
    const q=($('#topic-search')?.value||'').trim().toLowerCase(), filter=$('#topic-filter')?.value||'all';
    const filtered=TOPICS.filter(t=>(`${t.number} ${t.title}`.toLowerCase().includes(q))&&(filter==='all'||topicStatus(t)===filter));
    $('#topic-result-count').textContent=`${filtered.length} topics`;
    $('#topic-list').innerHTML=filtered.map(t=>`<button class="topic-row ${selectedTopic===t.number?'selected':''}" data-topic="${t.number}"><span class="topic-number">${String(t.number).padStart(2,'0')}</span><span class="topic-row-copy"><strong>${escapeHtml(t.title)}</strong><span>${topicState(t.number).solved.length}/${t.tasks.length} tasks solved · ${topicState(t.number).playlistDone?'playlist watched':'playlist not watched'}</span><span class="topic-row-progress"><i style="width:${topicProgress(t)}%"></i></span></span><span class="status-dot ${topicStatus(t)}"></span></button>`).join('')||'<div class="empty-state">No topics match this filter.</div>';
    $$('[data-topic]', $('#topic-list')).forEach(b=>b.addEventListener('click',()=>{selectedTopic=Number(b.dataset.topic);renderTopicList();renderTopicDetail();}));
    if(filtered.some(t=>t.number===selectedTopic)) renderTopicDetail();
    else if(filtered.length){selectedTopic=filtered[0].number;renderTopicList();renderTopicDetail();}
    else $('#topic-detail').innerHTML='<div class="empty-detail"><h2>No topic found</h2><p>Try a different search or filter.</p></div>';
  }
  function renderTopicDetail(){
    const t=TOPICS.find(x=>x.number===selectedTopic); if(!t)return;
    const s=topicState(t.number), status=topicStatus(t);
    $('#topic-detail').innerHTML=`<div class="detail-top"><div><div class="eyebrow">TOPIC ${String(t.number).padStart(2,'0')} / ${TOPICS.length}</div><h2>${escapeHtml(t.title)}</h2></div><span class="status-pill ${status}">${status.replace('-',' ')}</span></div><div class="topic-edit-controls"><button class="button button-quiet" id="edit-playlist">Edit playlist link</button><button class="button button-quiet" id="move-topic-up" ${TOPICS.indexOf(t)===0?'disabled':''}>↑ Move up</button><button class="button button-quiet" id="move-topic-down" ${TOPICS.indexOf(t)===TOPICS.length-1?'disabled':''}>↓ Move down</button></div><p class="detail-intro">Follow the sequence from your study PDF: playlist first, then the full CSES set.</p><a class="playlist-card" href="${escapeHtml(t.playlist)}" target="_blank" rel="noopener"><span class="playlist-icon">▶</span><span><strong>Open video playlist</strong><small>Study the linked lecture playlist</small></span><span class="external-mark">↗</span></a><label class="check-row playlist-check"><input type="checkbox" id="playlist-done" ${s.playlistDone?'checked':''}><span class="custom-check"></span><span><strong>Playlist completed</strong><small>Check after finishing the videos</small></span></label><div class="detail-section-head"><div><div class="eyebrow">PRACTICE SET</div><h3>CSES tasks <span>${s.solved.length}/${t.tasks.length}</span></h3></div><a class="subtle-link" href="https://cses.fi/problemset/" target="_blank" rel="noopener">CSES home ↗</a></div><div class="task-checklist">${t.tasks.map((p,i)=>`<label class="task-row"><input type="checkbox" data-task-index="${i}" ${s.solved.includes(i)?'checked':''}><span class="custom-check"></span><span class="task-name">${escapeHtml(p.name)}</span><a href="${p.url}" target="_blank" rel="noopener" class="task-open" aria-label="Open ${escapeHtml(p.name)} on CSES">↗</a></label>`).join('')}</div><div class="detail-footer"><div class="mini-progress"><div class="progress-track"><div class="progress-fill" style="width:${topicProgress(t)}%"></div></div><span>${topicProgress(t)}% topic checklist</span></div><button class="button button-quiet" id="clear-topic">Reset this topic</button></div>`;
    $('#edit-playlist').addEventListener('click',()=>editPlaylist(t.number));
    $('#move-topic-up').addEventListener('click',()=>moveTopic(t.number,-1));
    $('#move-topic-down').addEventListener('click',()=>moveTopic(t.number,1));
    $('#playlist-done').addEventListener('change',e=>{topicState(t.number).playlistDone=e.target.checked;topicState(t.number).updatedAt=new Date().toISOString();saveState();renderTopicList();renderTopicDetail();});
    $$('[data-task-index]', $('#topic-detail')).forEach(input=>input.addEventListener('change',e=>{
      const i=Number(e.target.dataset.taskIndex), solved=topicState(t.number).solved;
      if(e.target.checked&&!solved.includes(i))solved.push(i);
      if(!e.target.checked)topicState(t.number).solved=solved.filter(x=>x!==i);
      topicState(t.number).updatedAt=new Date().toISOString();saveState();renderTopicList();renderTopicDetail();
    }));
    $('#clear-topic').addEventListener('click',()=>{if(confirm(`Reset progress for "${t.title}"?`)){state.topics[t.number]={playlistDone:false,solved:[],updatedAt:new Date().toISOString()};saveState();renderTopicList();renderTopicDetail();}});
  }
  function renderPractice(){
    const q=($('#practice-search')?.value||'').trim().toLowerCase(), filter=$('#practice-filter')?.value||'all', topicFilter=$('#practice-topic-filter')?.value||'all';
    const rows=[];
    TOPICS.forEach(t=>t.tasks.forEach((p,i)=>rows.push({topic:t,task:p,index:i,solved:topicState(t.number).solved.includes(i)})));
    const filtered=rows.filter(r=>(`${r.task.name} ${r.topic.title} ${r.topic.number}`.toLowerCase().includes(q))&&(filter==='all'||(filter==='solved'?r.solved:!r.solved))&&(topicFilter==='all'||Number(topicFilter)===r.topic.number));
    $('#practice-result-count').textContent=`${filtered.length} task assignments`;
    $('#practice-list').innerHTML=filtered.map(r=>`<div class="practice-row ${r.solved?'is-solved':''}"><label class="task-row"><input type="checkbox" data-practice-topic="${r.topic.number}" data-practice-index="${r.index}" ${r.solved?'checked':''}><span class="custom-check"></span><span class="practice-task-copy"><strong>${escapeHtml(r.task.name)}</strong><small>Topic ${String(r.topic.number).padStart(2,'0')} · ${escapeHtml(r.topic.title)}</small></span></label><a href="${r.task.url}" target="_blank" rel="noopener" class="button button-quiet">Open CSES ↗</a></div>`).join('')||'<div class="empty-state">No tasks match your filters.</div>';
    $$('[data-practice-topic]', $('#practice-list')).forEach(input=>input.addEventListener('change',e=>{
      const tid=Number(e.target.dataset.practiceTopic), i=Number(e.target.dataset.practiceIndex), solved=topicState(tid).solved;
      if(e.target.checked&&!solved.includes(i))solved.push(i);
      if(!e.target.checked)state.topics[tid].solved=solved.filter(x=>x!==i);topicState(tid).updatedAt=new Date().toISOString();
      saveState();renderPractice();
    }));
  }
  function renderAnalytics(){
    const topicChart=$('#topic-chart'), taskChart=$('#task-chart');
    const groups=[]; for(let start=0;start<TOPICS.length;start+=10)groups.push(TOPICS.slice(start,start+10));
    topicChart.innerHTML=groups.map(g=>{const n=g.filter(isComplete).length;return `<div class="bar-row"><span>Topics ${String(g[0].number).padStart(2,'0')}–${String(g[g.length-1].number).padStart(2,'0')}</span><div class="bar-track"><i style="width:${n/g.length*100}%"></i></div><strong>${n}/${g.length}</strong></div>`}).join('');
    taskChart.innerHTML=groups.map(g=>{const n=g.reduce((sum,t)=>sum+topicState(t.number).solved.length,0), total=g.reduce((sum,t)=>sum+t.tasks.length,0);return `<div class="bar-row"><span>${String(g[0].number).padStart(2,'0')}–${String(g[g.length-1].number).padStart(2,'0')}</span><div class="bar-track"><i style="width:${total?n/total*100:0}%"></i></div><strong>${n}/${total}</strong></div>`}).join('');
    const recent=[...state.sessions].reverse().slice(0,10);
    $('#session-history').innerHTML=recent.map(s=>`<div class="timeline-item"><div class="timeline-marker">◷</div><div class="timeline-copy"><strong>${escapeHtml(s.topicTitle||'Study session')}</strong><span>${dateLabel(s.date)} · ${s.minutes} min · ${escapeHtml(s.kind||'study')}</span>${s.notes?`<small>${escapeHtml(s.notes)}</small>`:''}</div></div>`).join('')||'<p class="muted-small">No sessions logged yet. Start a focus session to build your history.</p>';
  }
  function populateSessionTopics(){
    $('#session-topic').innerHTML=TOPICS.map(t=>`<option value="${t.number}">${String(t.number).padStart(2,'0')} · ${escapeHtml(t.title)}</option>`).join('');
    $('#session-topic').value=String(nextTopic().number);
  }
  function logSession(minutes,kind,topicId,notes){
    const topic=TOPICS.find(t=>t.number===Number(topicId))||nextTopic();
    state.sessions.push({date:today(),minutes:Number(minutes),kind,topicId:topic.number,topicTitle:topic.title,notes:notes||'',createdAt:new Date().toISOString()});
    state.activeDays=[...new Set([...(state.activeDays||[]),today()])];
    saveState();toast('Study session saved.');
  }
  function renderAll(){renderDashboard();if($('#view-curriculum').classList.contains('active'))renderTopicList();if($('#view-practice').classList.contains('active'))renderPractice();if($('#view-analytics').classList.contains('active'))renderAnalytics();}
  function updateTimerDisplay(){const m=Math.floor(timerSeconds/60),s=timerSeconds%60;$('#timer-display').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;$('#timer-ring').classList.toggle('running',timerRunning);$('#timer-state').textContent=timerRunning?'FOCUS IN PROGRESS':(timerSeconds===0?'SESSION COMPLETE':'READY TO FOCUS');$('#timer-start').textContent=timerRunning?'Pause session':(timerSeconds===0?'Start again':'Start session');}
  function pauseTimer(){timerRunning=false;clearInterval(timerInterval);timerInterval=null;updateTimerDisplay();}
  function startTimer(){
    if(timerRunning){pauseTimer();return;}
    if(timerSeconds<=0)timerSeconds=(state.preferences.timerMinutes||25)*60;
    timerRunning=true;updateTimerDisplay();
    timerInterval=setInterval(()=>{
      timerSeconds--;updateTimerDisplay();
      if(timerSeconds<=0){pauseTimer();logSession(state.preferences.timerMinutes||25,'focus timer',$('#session-topic').value||nextTopic().number,'Completed focus timer');toast('Focus block complete — great work!');}
    },1000);
  }
  function exportBackup(){
    const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString(),app:'IOI OS'},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ioi-os-backup-${today()}.json`;a.click();URL.revokeObjectURL(url);toast('Backup exported.');
  }
  function importBackup(){
    const file=$('#import-file').files[0];if(!file){toast('Choose a JSON backup first.');return;}
    const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(reader.result);if(!data||typeof data.topics!=='object'||!Array.isArray(data.sessions))throw new Error('Invalid backup');state={...freshState(),...data};saveState();toast('Backup imported.');}catch{toast('That file is not a valid IOI OS backup.');}};reader.readAsText(file);
  }
  function init(){
    $('#today-label').textContent='IOI 2027 PREPARATION · '+new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'}).toUpperCase();
    $$('.nav-item[data-view]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.view)));
    $$('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
    $('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
    $('#continue-button').addEventListener('click',()=>{const t=nextTopic();selectedTopic=t.number;go('curriculum');renderTopicList();renderTopicDetail();});
    $('#global-search').addEventListener('keydown',e=>{if(e.key==='Enter'){const q=e.target.value.trim();$('#topic-search').value=q;$('#practice-search').value=q;go('curriculum');renderTopicList();}});
    $('#topic-search').addEventListener('input',renderTopicList);$('#topic-filter').addEventListener('change',renderTopicList);
    $('#practice-search').addEventListener('input',renderPractice);$('#practice-filter').addEventListener('change',renderPractice);$('#practice-topic-filter').addEventListener('change',renderPractice);
    $('#practice-topic-filter').innerHTML='<option value="all">All topics</option>'+TOPICS.map(t=>`<option value="${t.number}">${String(t.number).padStart(2,'0')} · ${escapeHtml(t.title)}</option>`).join('');
    $('#timer-start').addEventListener('click',startTimer);
    $('#timer-reset').addEventListener('click',()=>{pauseTimer();timerSeconds=(state.preferences.timerMinutes||25)*60;updateTimerDisplay();});
    $$('.timer-presets button').forEach(b=>b.addEventListener('click',()=>{pauseTimer();state.preferences.timerMinutes=Number(b.dataset.minutes);timerSeconds=state.preferences.timerMinutes*60;$$('.timer-presets button').forEach(x=>x.classList.toggle('active',x===b));updateTimerDisplay();}));
    $('#log-session').addEventListener('click',()=>{const mins=Number($('#session-minutes').value);if(!Number.isFinite(mins)||mins<1||mins>600){toast('Enter a session length between 1 and 600 minutes.');return;}logSession(mins,$('#session-kind').value,$('#session-topic').value,$('#session-notes').value.trim());$('#session-notes').value='';});
    $('#export-backup').addEventListener('click',exportBackup);$('#import-backup').addEventListener('click',importBackup);
    $('#reset-progress').addEventListener('click',()=>{if(confirm('Permanently clear IOI OS progress on this device? Export a backup first if needed.')){localStorage.removeItem(STORE_KEY);state=freshState();saveState();selectedTopic=1;toast('Local progress cleared.');}});
    populateSessionTopics();renderAll();renderTopicList();updateTimerDisplay();initCloud();
  }
  document.addEventListener('DOMContentLoaded',init);
})();