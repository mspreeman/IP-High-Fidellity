'use strict';
// Quick capture, used by the dashboard panel and every Record button: "Record Meeting" (shown
// when a calendar meeting is current or about to start) and "Record Notes" (available at any time).
//
// Reuses the existing prototype integrations rather than adding new ones:
//   - state.calendar (simulated Outlook / Google Calendar feed) decides which meeting is current.
//   - MediaRecorder captures audio on this device only. Audio is never uploaded; the user can
//     optionally download a copy.
//   - Transcription and note extraction come from 10-transcript-intelligence.js (simulated).
//     Contacts, project and the Open Promise are detected in the transcript, with the most
//     recent meeting as the fallback for contacts/project. Everything is reviewed before saving.
//   - Saved results go to the Meetings & Recordings library (08), each contact's timeline
//     (applyActivity) and, optionally, a new Open Promise (addPromiseSafe).

const QC_UPCOMING_MIN = 60;  // "upcoming" = starts within this many minutes
const QC_DEFAULT_LEN_MIN = 60;  // assumed meeting length when the event has none

const qc = {open:false, mode:null, stage:'capture', eventId:null, consent:false,
  recorder:null, stream:null, chunks:[], blob:null, blobUrl:null, mime:'',
  recording:false, simulated:false, startedAt:0, seconds:0, timer:null,
  notes:'', title:'', titleEdited:false, selected:[], projectId:'', draft:null};

function qcEventStart(e){
  let m = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(String(e.time||'').trim());
  if(!m || !e.date) return null;
  let d = new Date(e.date+'T00:00:00');
  d.setHours((+m[1] % 12) + (m[3].toUpperCase()==='PM' ? 12 : 0), +m[2], 0, 0);
  return isNaN(d) ? null : d;
}
function qcTimeLabel(d){return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}
function qcScheduled(){
  return (state.calendar||[]).filter(e=>e.status==='Scheduled'&&!e.recorded)
    .map(e=>({e,start:qcEventStart(e)})).filter(x=>x.start);
}
// The meeting that is in progress, or the soonest one starting within QC_UPCOMING_MIN.
function qcCurrentMeeting(){
  let now = Date.now();
  let live = qcScheduled().filter(x=>{
    let until = x.start - now, since = now - x.start;
    return until <= QC_UPCOMING_MIN*60e3 && since <= (x.e.durationMin||QC_DEFAULT_LEN_MIN)*60e3;
  });
  // Prefer a meeting already in progress, then the next to start.
  live.sort((a,b)=>((a.start<=now)===(b.start<=now)) ? a.start-b.start : (a.start<=now ? -1 : 1));
  return live[0]||null;
}
function qcNextMeeting(){
  let now = Date.now();
  return qcScheduled().filter(x=>x.start>now).sort((a,b)=>a.start-b.start)[0]||null;
}
function qcWhen(x){
  let mins = Math.round((x.start - Date.now())/60e3);
  if(mins > 0) return {live:false, text:'Starts in '+mins+' min'};
  return {live:true, text:mins===0 ? 'Starting now' : 'In progress · started '+(-mins)+' min ago'};
}
function qcClock(sec){sec=Math.max(0,Math.floor(sec));return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function qcProjectFor(contactId){return state.projects.find(p=>(p.contactIds||[]).includes(contactId))}
function qcProjectOptions(selected){
  return '<option value="">No project</option>'+state.projects.map(p=>'<option value="'+esc(p.id)+'" '+(p.id===selected?'selected':'')+'>'+esc(p.name)+'</option>').join('');
}

// ---------- Dashboard panel (called from renderDashboard in 05) ----------
function quickCapturePanel(){
  let cur = qcCurrentMeeting(), meeting;
  if(cur){
    let e = cur.e, c = contact(e.contactId), when = qcWhen(cur);
    meeting = '<div class="qc-tile qc-meeting '+(when.live?'is-live':'')+'">'+
      '<div class="qc-tile-head"><span class="pill '+(when.live?'danger':'gold')+'">'+(when.live?'<span class="qc-dot" aria-hidden="true"></span>':icon('clock','sm'))+' '+esc(when.text)+'</span><span class="qc-source">'+esc(e.source||'Calendar')+'</span></div>'+
      '<strong class="qc-title">'+esc(e.title)+'</strong>'+
      '<p class="company-name">'+esc([company(c?.companyId)?.name, c?.name].filter(Boolean).join(' · ')||'Calendar event')+'</p>'+
      '<p class="small muted">'+esc(qcTimeLabel(cur.start))+(e.kind?' · '+esc(e.kind):'')+'</p>'+
      '<button class="btn gold qc-big" data-qc="record-meeting" data-id="'+esc(e.id)+'">'+icon('mic')+' Record Meeting</button>'+
    '</div>';
  } else {
    let next = qcNextMeeting();
    meeting = '<div class="qc-tile qc-meeting is-idle">'+
      '<div class="qc-tile-head"><span class="pill neutral">'+icon('calendar','sm')+' No meeting right now</span></div>'+
      '<p class="small muted">Record Meeting appears here when a calendar meeting is starting within an hour or already in progress.</p>'+
      (next?'<p class="qc-next small">Next: <b>'+esc(next.e.title)+'</b><br>'+esc(dateNice(next.e.date))+' · '+esc(qcTimeLabel(next.start))+'</p>':'')+
      '<button class="btn sm qc-sim" data-qc="simulate-meeting">'+icon('calendar','sm')+' Simulate a calendar meeting starting now</button>'+
    '</div>';
  }
  return '<aside class="card pad qc-panel" aria-labelledby="qc-heading">'+
    '<div class="section-title"><h2 id="qc-heading">'+icon('mic')+' Capture</h2><a data-nav="meetings">Meetings library '+icon('arrow','sm')+'</a></div>'+
    '<p class="small muted section-desc">Record a scheduled meeting or capture notes any time. Everything is reviewed before it is filed.</p>'+
    meeting+
    '<div class="qc-tile qc-notes">'+
      '<strong class="qc-title">Notes</strong>'+
      '<p class="small muted">Dictate or type notes whenever you need to: after a call, on a site visit or between meetings.</p>'+
      '<button class="btn primary qc-big" data-qc="record-notes">'+icon('edit')+' Record Notes</button>'+
    '</div>'+
  '</aside>';
}

function qcFriday(){return days((5-new Date().getDay()+7)%7||7)}

// ---------- Recorder modal ----------
function qcStart(mode, eventId){
  if(qc.open && qc.recording){qcRender();toast('A recording is already in progress.');return}
  qcReset();
  qc.open = true; qc.mode = mode; qc.stage = 'capture'; qc.eventId = eventId||null;
  let e = (state.calendar||[]).find(x=>x.id===eventId);
  qc.title = mode==='meeting' ? (e?.title||'Customer meeting') : 'Notes · '+dateNice(today());
  qcRender();
}
function qcReset(){
  clearInterval(qc.timer);
  qc.stream?.getTracks().forEach(t=>t.stop());
  if(qc.blobUrl) URL.revokeObjectURL(qc.blobUrl);
  Object.assign(qc,{open:false,mode:null,stage:'capture',eventId:null,consent:false,recorder:null,stream:null,chunks:[],blob:null,blobUrl:null,mime:'',recording:false,simulated:false,startedAt:0,seconds:0,timer:null,notes:'',title:'',titleEdited:false,selected:[],projectId:'',draft:null});
}
function qcClose(force){
  if(qc.recording && !force){toast('Stop or discard the recording before closing.');return}
  if(qc.recording && qc.recorder?.state==='recording'){qc.recorder.onstop=null;qc.recorder.stop()}
  qcReset();
  document.getElementById('qc-modal')?.remove();
  render();
}
function qcHasCapture(){return !!(qc.blob || (qc.simulated && qc.seconds>0))}

function qcCaptureBody(){
  let e = (state.calendar||[]).find(x=>x.id===qc.eventId), c = contact(e?.contactId);
  let ctx = qc.mode==='meeting'
    ? '<div class="qc-event"><div class="company-name">'+esc(company(c?.companyId)?.name||'Calendar event')+'</div><h3>'+esc(e?.title||qc.title)+'</h3><p class="small muted">'+esc([e?.time, e?.kind, e?.source].filter(Boolean).join(' · '))+'</p></div>'
    : '<label class="field"><span>Title</span><input id="qc-title-in" value="'+esc(qc.title)+'"></label>';
  let state_, ico;
  if(qc.recording){state_ = qc.simulated ? 'Simulated capture running (no microphone)' : 'Recording on this device · microphone active'; ico='mic'}
  else if(qcHasCapture()){state_ = (qc.simulated?'Simulated capture':'Recording')+' complete · '+qcClock(qc.seconds); ico='checkcircle'}
  else {state_ = qc.mode==='meeting' ? 'Ready to record this meeting' : 'Ready to record a voice note'; ico='mic'}
  let controls = qc.recording
    ? '<button class="btn danger" data-qc="stop">'+icon('pause')+' Stop recording</button><button class="btn" data-qc="discard">'+icon('trash')+' Discard</button>'
    : qcHasCapture()
      ? '<button class="btn" data-qc="discard">'+icon('mic')+' Record again</button>'
      : '<button class="btn gold" data-qc="rec">'+icon('mic')+' Start recording</button>';
  return '<div class="modal-body">'+
    '<div class="steps"><span class="step on">1 · Capture</span> '+icon('arrow','sm')+' <span class="step">2 · Review transcript</span> '+icon('arrow','sm')+' <span class="step">3 · File</span></div>'+
    ctx+
    '<div class="qc-recorder '+(qc.recording?'is-recording':'')+'">'+
      '<div class="qc-orb">'+icon(ico,'lg')+'</div>'+
      '<div class="qc-timer" id="qc-timer" aria-live="off">'+qcClock(qc.seconds)+'</div>'+
      '<p class="small" id="qc-status" aria-live="polite">'+esc(state_)+'</p>'+
      (qc.mode==='meeting'?'<label class="checkline qc-consent"><input id="qc-consent" type="checkbox" '+(qc.consent?'checked':'')+' '+(qc.recording||qcHasCapture()?'disabled':'')+'> <span>Every participant has agreed to this meeting being recorded.</span></label>':'')+
      '<div class="btn-row qc-controls">'+controls+'</div>'+
      (qc.blobUrl?'<audio class="qc-audio" controls src="'+qc.blobUrl+'"></audio>':'')+
    '</div>'+
    '<label class="field"><span>'+(qc.mode==='meeting'?'Your notes during the meeting (optional)':'Typed notes (optional, or instead of recording)')+'</span><textarea id="qc-notes-in" placeholder="Key points, decisions, follow-ups…">'+esc(qc.notes)+'</textarea></label>'+
    '<div class="demo-disclaimer">Audio stays in this browser; nothing is uploaded. After you stop, the transcript is generated and AI pulls out the notes, people, project and any promise you made. In this prototype both steps are <strong>simulated</strong>; you review everything before it is filed.</div>'+
  '</div>';
}
function qcSourceHint(kind, why){
  if(why==='transcript') return '<p class="qc-why ok">'+icon('sparkle','sm')+' Found in the '+(qcHasCapture()?'transcript':'notes')+'</p>';
  if(why==='recent') return '<p class="qc-why">'+icon('clock','sm')+' Not mentioned, so using your most recent meeting: '+esc(qc.draft.recent?.title||'')+'</p>';
  return '<p class="qc-why">'+(kind==='contacts'?'No one identified. Choose who this is about, or leave it as a personal note.':'No project identified.')+'</p>';
}
function qcChips(){
  if(!qc.selected.length) return '<span class="qc-placeholder">No contact · personal note</span>';
  return qc.selected.map((id,i)=>'<span class="qc-chip">'+esc(contact(id)?.name||id)+(i===0&&qc.selected.length>1?' <small>primary</small>':'')+'</span>').join('');
}
function qcContactPicker(){
  let found = qc.draft.found.contactIds;
  return '<div class="field qc-field"><span id="qc-contacts-label">Contacts</span>'+
    '<details class="qc-multi" id="qc-contacts"><summary class="qc-multi-btn" aria-labelledby="qc-contacts-label"><span class="qc-chips" id="qc-chips">'+qcChips()+'</span>'+icon('down','sm')+'</summary>'+
    '<div class="qc-multi-menu" role="group" aria-labelledby="qc-contacts-label">'+
      '<input type="search" class="qc-multi-search" id="qc-contact-filter" placeholder="Filter people" aria-label="Filter people">'+
      state.contacts.map(c=>'<label class="qc-opt" data-name="'+esc((c.name+' '+(company(c.companyId)?.name||'')).toLowerCase())+'"><input type="checkbox" name="contactIds" value="'+esc(c.id)+'" '+(qc.selected.includes(c.id)?'checked':'')+'><span><b>'+esc(c.name)+'</b><small>'+esc(company(c.companyId)?.name||'')+'</small></span>'+(found.includes(c.id)?'<span class="pill ok">In transcript</span>':'')+'</label>').join('')+
    '</div></details>'+qcSourceHint('contacts', qc.draft.why.contacts)+'</div>';
}
function qcReviewBody(){
  let d = qc.draft, hasT = qcHasCapture();
  let primary = contact(qc.selected[0]);
  return '<form id="qc-form" class="modal-body">'+
    '<div class="steps"><span class="step">1 · Capture</span> '+icon('arrow','sm')+' <span class="step on">2 · Review</span> '+icon('arrow','sm')+' <span class="step">3 · File</span></div>'+
    '<label class="field"><span>Title</span><input required name="title" id="qc-review-title" value="'+esc(qc.title)+'"></label>'+
    '<div class="fields2">'+qcContactPicker()+
      '<div class="field qc-field"><label for="qc-project"><span>Project</span></label><select name="projectId" id="qc-project">'+qcProjectOptions(qc.projectId)+'</select>'+qcSourceHint('project', d.why.project)+'</div>'+
    '</div>'+
    (hasT?'<div class="field"><div class="qc-label-row"><label for="qc-transcript"><span>Transcript</span></label><span class="pill neutral">Auto-generated · simulated</span></div><textarea id="qc-transcript" name="transcript" rows="7">'+esc(d.transcript)+'</textarea>'+
      '<button type="button" class="btn sm qc-reanalyze" data-qc="reanalyze">'+icon('sparkle','sm')+' Re-analyze edited transcript</button></div>':'')+
    '<div class="field"><div class="qc-label-row"><label for="qc-summary"><span>'+(hasT?'Notes':'Your notes')+'</span></label>'+(hasT?'<span class="pill gold">'+icon('sparkle','sm')+' AI-extracted · simulated</span>':'')+'</div><textarea id="qc-summary" name="summary" rows="9">'+esc(d.summary)+'</textarea></div>'+
    '<div class="fields2"><div class="field qc-field"><label for="qc-promise"><span>Open Promise (optional)</span></label><input id="qc-promise" name="promise" value="'+esc(d.promise)+'" placeholder="e.g. Send revised pricing">'+
      (d.promiseQuote?'<p class="qc-why ok">'+icon('sparkle','sm')+' From: “'+esc(d.promiseQuote)+'”</p>':'<p class="qc-why">No commitment found'+(hasT?' in the transcript':'')+'.</p>')+
      '<p class="qc-why" id="qc-promise-owner">'+(primary?'Linked to '+esc(primary.name):'Needs a contact')+'</p></div>'+
      '<label class="field"><span>Due date</span><input name="due" type="date" value="'+esc(d.due)+'"></label></div>'+
    '<label class="field"><span>Who can see this?</span><select name="visibility">'+[['private','Only me (private)'],['manager','Managers only'],['team','Team shared']].map(([v,l])=>'<option value="'+v+'" '+(d.visibility===v?'selected':'')+'>'+l+'</option>').join('')+'</select></label>'+
    (qc.blob?'<label class="checkline"><input type="checkbox" name="keepAudio"> <span>Download a copy of the audio recording to this device (LuMaCo does not keep it).</span></label>':'')+
    '<p class="small muted">Saving files this to Meetings &amp; Recordings'+(qc.mode==='meeting'?', marks the calendar meeting as attended':'')+' and adds it to each selected contact\'s history.</p>'+
  '</form>';
}
function qcRender(){
  if(!qc.open) return;
  let title = qc.mode==='meeting' ? 'Record Meeting' : 'Record Notes';
  let body, foot;
  if(qc.stage==='capture'){
    body = qcCaptureBody();
    let canContinue = !qc.recording && (qcHasCapture() || qc.notes.trim());
    foot = '<button class="btn" data-qc="cancel">Cancel</button><button class="btn primary" data-qc="review" '+(canContinue?'':'disabled aria-disabled="true"')+'>Review &amp; file '+icon('arrow','sm')+'</button>';
  } else if(qc.stage==='processing'){
    body = '<div class="modal-body qc-processing" role="status"><div class="qc-spinner" aria-hidden="true"></div><h3>'+(qcHasCapture()?'Transcribing and extracting notes…':'Reading your notes…')+'</h3><p class="small muted">Finding people, the project and any promises you made.</p></div>';
    foot = '<button class="btn" data-qc="cancel">Cancel</button>';
  } else {
    body = qcReviewBody();
    foot = '<button class="btn" data-qc="back">Back</button><button class="btn primary" type="submit" form="qc-form">Approve &amp; save</button>';
  }
  let el = document.getElementById('qc-modal');
  if(!el){el = document.createElement('div'); el.id = 'qc-modal'; document.body.appendChild(el)}
  el.innerHTML = '<div class="modal-backdrop qc-backdrop"><section class="modal wide" role="dialog" aria-modal="true" aria-labelledby="qc-dialog-title">'+
    '<header class="modal-header"><div><div class="eyebrow">'+(qc.mode==='meeting'?'Calendar meeting':'Any time')+' · Quick capture</div><h2 id="qc-dialog-title">'+title+'</h2></div><button class="close" aria-label="Close dialog" data-qc="cancel">'+icon('close','lg')+'</button></header>'+
    body+'<footer class="modal-footer">'+foot+'</footer></section></div>';
  let focus = el.querySelector('[data-qc="rec"],[data-qc="stop"],#qc-review-title');
  focus?.focus({preventScroll:true});
}
function qcTick(){
  qc.seconds = (Date.now()-qc.startedAt)/1000;
  let t = document.getElementById('qc-timer'); if(t) t.textContent = qcClock(qc.seconds);
}
function qcBeginTimer(){qc.recording = true; qc.startedAt = Date.now(); qc.seconds = 0; qc.timer = setInterval(qcTick, 500); qcRender()}
async function qcRecord(){
  if(qc.mode==='meeting' && !qc.consent){toast('Confirm participant consent before recording.');return}
  if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder){
    qc.simulated = true; toast('Microphone recording is not available here, so capture is simulated.'); qcBeginTimer(); return;
  }
  try{
    qc.stream = await navigator.mediaDevices.getUserMedia({audio:true});
  }catch(err){
    qc.simulated = true; toast('Microphone permission was not granted, so capture is simulated.'); qcBeginTimer(); return;
  }
  qc.chunks = [];
  qc.recorder = new MediaRecorder(qc.stream);
  qc.mime = qc.recorder.mimeType || 'audio/webm';
  qc.recorder.ondataavailable = e=>{if(e.data.size) qc.chunks.push(e.data)};
  qc.recorder.onstop = ()=>{
    qc.blob = new Blob(qc.chunks,{type:qc.mime});
    qc.blobUrl = URL.createObjectURL(qc.blob);
    qc.stream?.getTracks().forEach(t=>t.stop()); qc.stream = null;
    qcRender();
  };
  qc.recorder.start(1000);
  qcBeginTimer();
}
function qcStop(){
  if(!qc.recording) return;
  clearInterval(qc.timer); qcTick(); qc.recording = false;
  if(qc.recorder?.state==='recording') qc.recorder.stop(); // onstop re-renders once the audio is ready
  else qcRender();
  toast(qc.simulated ? 'Simulated capture complete. No audio was recorded.' : 'Recording saved on this device. Review the transcript next.');
}
function qcDiscard(){
  clearInterval(qc.timer);
  if(qc.recorder?.state==='recording'){qc.recorder.onstop = null; qc.recorder.stop()}
  qc.stream?.getTracks().forEach(t=>t.stop());
  if(qc.blobUrl) URL.revokeObjectURL(qc.blobUrl);
  Object.assign(qc,{recorder:null,stream:null,chunks:[],blob:null,blobUrl:null,recording:false,simulated:false,seconds:0,timer:null});
  qcRender();
}
// Detect people/project in the text, fall back to the most recent meeting, extract notes and promise.
function qcAnalyze(transcript, typed){
  let text = [transcript, typed].filter(Boolean).join('\n');
  let found = tiDetect(text), recent = tiRecentMeeting(qc.eventId);
  let why = {contacts:'none', project:'none'};
  qc.selected = found.contactIds.slice();
  if(qc.selected.length) why.contacts = 'transcript';
  else if(recent?.contactIds.length){qc.selected = recent.contactIds.slice(); why.contacts = 'recent'}
  qc.projectId = found.projectId;
  if(qc.projectId) why.project = 'transcript';
  else if(recent?.projectId){qc.projectId = recent.projectId; why.project = 'recent'}
  let promise = tiExtractPromise(text);
  let summary = transcript ? tiExtractNotes(transcript, {contactIds:found.contactIds, projectId:found.projectId, typed}) : typed;
  if(qc.mode==='notes' && !qc.titleEdited){
    let p = state.projects.find(x=>x.id===found.projectId), names = tiNames(found.contactIds);
    qc.title = 'Notes · '+(p ? p.name : names[0] || dateNice(today()));
  }
  qc.draft = {transcript, summary, promise:promise?.title||'', promiseQuote:promise?.quote||'', due:promise?.due||'',
    visibility:qc.draft?.visibility||'private', found, recent, why};
}
function qcToReview(){
  if(qc.mode==='notes') qc.title = document.getElementById('qc-title-in')?.value.trim() || qc.title;
  qc.stage = 'processing'; qcRender();
  let transcript = qcHasCapture() ? tiSimulateTranscript({mode:qc.mode, event:(state.calendar||[]).find(x=>x.id===qc.eventId), seconds:qc.seconds}) : '';
  setTimeout(()=>{
    if(!qc.open || qc.stage!=='processing') return;
    qcAnalyze(transcript, qc.notes.trim());
    qc.stage = 'review'; qcRender();
  }, 1100);
}
function qcReanalyze(){
  let f = document.getElementById('qc-form'); if(!f) return;
  qc.title = f.title.value.trim() || qc.title; qc.titleEdited = true;
  if(qc.draft) qc.draft.visibility = f.visibility.value;
  qcAnalyze(f.transcript?.value.trim()||'', qc.notes.trim());
  qcRender();
  toast('Transcript re-analyzed. People, project, notes and promise were refreshed.');
}
function qcSave(form){
  let d = new FormData(form), v = k=>String(d.get(k)||'').trim();
  let people = qc.selected.map(contact).filter(Boolean), primary = people[0];
  let transcript = v('transcript'), summary = v('summary');
  if(!summary && !transcript){toast('Add notes or a transcript before saving.');return}
  if(v('promise') && !primary){toast('Choose a contact to create an Open Promise, or clear the promise.');return}
  let e = (state.calendar||[]).find(x=>x.id===qc.eventId);
  let source = qcHasCapture()
    ? (qc.simulated?'Simulated capture':'Recorded on this device')+' · simulated transcription and AI notes · reviewed by user'
    : 'Typed notes · entered by user';
  let rec = {id:uid('meet'), date:today(), savedAt:Date.now(), title:v('title')||qc.title,
    contactIds:people.map(c=>c.id), contactId:primary?.id||'', projectId:v('projectId'),
    transcript:transcript || summary, summary, visibility:v('visibility')||'private', kind:qc.mode,
    calendarId:e?.id||null, durationSec:Math.round(qc.seconds)||0, source, workspace:people.length?'company':'personal'};
  let wf = globalThis.LuMaCoWorkflows;
  if(wf){wf.extra.meetings.unshift(rec); wf.store()}
  people.forEach(c=>applyActivity(c,{type:qc.mode==='meeting'?'Meeting':'Note', title:rec.title, text:summary||transcript, source,
    engagement:qc.mode==='meeting', attendance:qc.mode==='meeting'?'Confirmed attended':undefined,
    visibility:rec.visibility, projectId:rec.projectId||null}));
  if(v('promise') && primary){
    let prev = state.settings.autoPromises; state.settings.autoPromises = true;
    addPromiseSafe(primary,{title:v('promise'), owner:'You', direction:'Made by me', due:v('due')||undefined, source:'Reviewed '+(qc.mode==='meeting'?'meeting':'notes')+': '+rec.title,
      origin:transcript||summary, confidence:'User-reviewed', visibility:rec.visibility, projectId:rec.projectId||null});
    state.settings.autoPromises = prev;
  }
  if(e){e.status = 'Confirmed attended'; e.recorded = true}
  if(qc.blob && d.has('keepAudio')){
    let a = document.createElement('a'), ext = /ogg/.test(qc.mime)?'ogg':/mp4/.test(qc.mime)?'m4a':'webm';
    a.href = qc.blobUrl; a.download = 'lumaco-'+(qc.mode==='meeting'?'meeting':'notes')+'-'+today()+'.'+ext; a.click();
  }
  let names = people.map(c=>c.name);
  let where = names.length ? 'Meetings & Recordings and the history for '+tiList(names) : 'Meetings & Recordings';
  let label = qc.mode==='meeting' ? 'Meeting' : 'Notes';
  persist();
  let url = qc.blobUrl; qc.blobUrl = null;
  qcClose(true);
  if(url) setTimeout(()=>URL.revokeObjectURL(url), 4000);
  toast(label+' saved to '+where+'.');
}
function qcSimulateMeeting(){
  let start = new Date(Date.now()+5*60e3);
  start.setMinutes(Math.ceil(start.getMinutes()/5)*5, 0, 0);
  let pool = state.contacts.filter(c=>qcProjectFor(c.id)), c = pool[(state.calendar||[]).length % pool.length] || state.contacts[0];
  let pr = qcProjectFor(c.id);
  let ev = {id:uid('cal'), title:(pr?pr.name+' check-in':'Check-in')+' with '+c.name, contactId:c.id,
    date:'', time:qcTimeLabel(start), kind:'Project meeting', status:'Scheduled',
    source:'Outlook Calendar · simulated', visibility:'team', ownerId:c.ownerId||'rep1', durationMin:45};
  // Keep the date in local time (toISOString is UTC).
  ev.date = start.getFullYear()+'-'+String(start.getMonth()+1).padStart(2,'0')+'-'+String(start.getDate()).padStart(2,'0');
  (state.calendar ||= []).push(ev);
  persist(); render();
  toast('Simulated calendar sync: "'+ev.title+'" at '+ev.time+'.');
}

document.addEventListener('click', e=>{
  let el = e.target.closest('[data-qc]'); if(!el) return;
  e.preventDefault(); e.stopPropagation();
  let a = el.dataset.qc;
  if(a==='record-meeting') return qcStart('meeting', el.dataset.id);
  if(a==='record-notes') return qcStart('notes');
  // Top bar, sidebar and Meetings page: record the current meeting if there is one, else notes.
  if(a==='record'){let cur = qcCurrentMeeting(); return cur ? qcStart('meeting', cur.e.id) : qcStart('notes')}
  if(a==='simulate-meeting') return qcSimulateMeeting();
  if(a==='rec') return qcRecord();
  if(a==='stop') return qcStop();
  if(a==='discard') return qcDiscard();
  if(a==='review') return qcToReview();
  if(a==='reanalyze') return qcReanalyze();
  if(a==='back'){if(qc.draft) qc.draft.visibility = document.querySelector('#qc-form [name="visibility"]')?.value || qc.draft.visibility; qc.stage='capture'; qcRender(); return}
  if(a==='cancel') return qcClose();
}, true);
document.addEventListener('input', e=>{
  if(e.target.id==='qc-notes-in'){
    qc.notes = e.target.value;
    let btn = document.querySelector('#qc-modal [data-qc="review"]');
    if(btn){let ok = !qc.recording && (qcHasCapture() || qc.notes.trim()); btn.disabled = !ok; btn.setAttribute('aria-disabled', String(!ok))}
  }
  if(e.target.id==='qc-title-in' || e.target.id==='qc-review-title'){qc.title = e.target.value; qc.titleEdited = true}
  if(e.target.id==='qc-contact-filter'){
    let q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#qc-contacts .qc-opt').forEach(o=>{o.hidden = !!q && !o.dataset.name.includes(q)});
  }
}, true);
document.addEventListener('change', e=>{
  if(e.target.id==='qc-consent'){qc.consent = e.target.checked; return}
  if(e.target.name==='contactIds' && e.target.closest('#qc-contacts')){
    let id = e.target.value;
    qc.selected = e.target.checked ? qc.selected.filter(x=>x!==id).concat(id) : qc.selected.filter(x=>x!==id);
    let chips = document.getElementById('qc-chips'); if(chips) chips.innerHTML = qcChips();
    let owner = document.getElementById('qc-promise-owner'), p = contact(qc.selected[0]);
    if(owner) owner.textContent = p ? 'Linked to '+p.name : 'Needs a contact';
  }
  if(e.target.id==='qc-project') qc.projectId = e.target.value;
}, true);
// Close the contact picker when clicking elsewhere.
document.addEventListener('click', e=>{
  let open = document.querySelector('#qc-contacts[open]');
  if(open && !open.contains(e.target)) open.removeAttribute('open');
});
document.addEventListener('submit', e=>{
  if(e.target.id!=='qc-form') return;
  e.preventDefault(); e.stopPropagation(); qcSave(e.target);
}, true);
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && qc.open){
    let open = document.querySelector('#qc-contacts[open]');
    if(open){open.removeAttribute('open'); open.querySelector('summary')?.focus(); return}
    qcClose();
  }
});
// Keep "Starts in N min" / "In progress" current while the dashboard is open.
// Only the panel is swapped, and never while the user is focused inside it.
function qcRefresh(){
  let p = document.querySelector?.('.qc-panel');
  if(p && !qc.open && !p.contains(document.activeElement)) p.outerHTML = quickCapturePanel();
  let side = document.querySelector?.('.lw-record');
  if(side) side.innerHTML = icon('mic')+' '+(qcCurrentMeeting()?'Record meeting':'Record notes');
  setTimeout(qcRefresh, 30e3);
}
setTimeout(qcRefresh, 30e3);
render();
