'use strict';
// Project files on the contact profile.
//
// Each project gets a "file" assembled automatically from everything already linked to it:
// reviewed meeting and voice notes (09/10), calls, meetings and other timeline activity,
// emails, calendar events, Open Promises, and documents/opportunities from Insights (08).
// Nothing is copied: the file is rebuilt from the source records on every render, so it
// updates as soon as a new note, email or integration event is filed against the project.
//
// The contact page shows the most recently updated project file for that contact, with a
// dropdown to switch between the contact's projects.

const PF_TYPE_ICON = {'Meeting notes':'mic','Voice notes':'edit',Meeting:'calendar',Calendar:'calendar',Call:'phone',Email:'mail',Text:'message',Note:'file'};

function pfExtra(){return globalThis.LuMaCoWorkflows?.extra || {meetings:[],documents:[],opportunities:[]}}
function pfSummaryLine(text){
  let t = String(text||'').trim();
  let m = /^Summary\s*\n([^\n]+)/.exec(t);
  t = m ? m[1] : t.split('\n').find(Boolean) || '';
  return t.length>240 ? t.slice(0,237).trimEnd()+'…' : t;
}
function pfMentions(p, title){
  let first = p.name.split(' ')[0];
  return new RegExp('\\b'+first.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(title||'');
}

// Every record linked to the project, newest first.
function pfEntries(p){
  let x = pfExtra(), out = [], seen = new Set();
  (x.meetings||[]).filter(m=>m.projectId===p.id).forEach(m=>{
    seen.add(m.date+'|'+m.title);
    out.push({type:m.kind==='notes'?'Voice notes':'Meeting notes', date:m.date, sort:m.savedAt||+new Date(m.date+'T12:00:00'),
      title:m.title, text:pfSummaryLine(m.summary||m.transcript), source:m.source||'Meetings & Recordings',
      people:m.contactIds||(m.contactId?[m.contactId]:[]), private:m.visibility==='private', open:{lw:'view-meeting', id:m.id}});
  });
  (state.interactions||[]).filter(i=>i.projectId===p.id).forEach(i=>{
    if(seen.has(i.date+'|'+i.title)) return;  // the same meeting also lands on the contact timeline
    out.push({type:i.type, date:i.date, sort:+new Date(i.date+'T12:00:00'), title:i.title, text:pfSummaryLine(i.summary),
      source:i.source, people:[i.contactId], private:i.visibility==='private'});
  });
  (state.messages||[]).filter(m=>m.projectId===p.id).forEach(m=>{
    out.push({type:'Email', date:m.date, sort:+new Date(m.date+'T12:00:00')+1, title:m.subject, text:m.preview||'',
      source:(m.outgoing?'Sent':'Received')+' · '+(m.sender||'Inbox'), people:[m.contactId], open:{mail:m.id}});
  });
  let today_ = today();
  (state.calendar||[]).filter(e=>e.date<=today_ && (e.projectId===p.id || ((p.contactIds||[]).includes(e.contactId) && pfMentions(p, e.title)))).forEach(e=>{
    if(seen.has(e.date+'|'+e.title)) return;
    out.push({type:'Calendar', date:e.date, sort:+new Date(e.date+'T12:00:00'), title:e.title, text:e.status||'', source:e.source||'Calendar', people:[e.contactId]});
  });
  return out.sort((a,b)=>b.sort-a.sort);
}
function pfFile(p){
  let x = pfExtra(), entries = pfEntries(p);
  let promises = state.promises.filter(q=>q.projectId===p.id && q.status==='Open').sort((a,b)=>(a.due||'').localeCompare(b.due||''));
  let docs = (x.documents||[]).filter(d=>d.projectId===p.id);
  let opp = (x.opportunities||[]).find(o=>o.projectId===p.id);
  let people = [...new Set([...(p.contactIds||[]), ...entries.flatMap(e=>e.people||[])])].filter(id=>contact(id));
  let latest = entries[0];
  let upcoming = (state.calendar||[]).filter(e=>e.date>today() && e.status==='Scheduled' && (e.projectId===p.id || ((p.contactIds||[]).includes(e.contactId) && pfMentions(p,e.title))))
    .sort((a,b)=>a.date.localeCompare(b.date))[0];
  let brief = entries.find(e=>e.type==='Meeting notes'||e.type==='Voice notes'||e.type==='Meeting') || latest;
  return {p, entries, promises, docs, opp, people, latest, upcoming, brief, updated:latest?.sort||0};
}
// Projects for a contact: linked directly, or through any record that involves them.
function pfProjectsFor(c){
  let ids = new Set(state.projects.filter(p=>(p.contactIds||[]).includes(c.id)).map(p=>p.id));
  (pfExtra().meetings||[]).forEach(m=>{if(m.projectId && (m.contactIds||[m.contactId]).includes(c.id)) ids.add(m.projectId)});
  [...(state.interactions||[]), ...(state.messages||[]), ...(state.promises||[])].forEach(r=>{if(r.projectId && r.contactId===c.id) ids.add(r.projectId)});
  return state.projects.filter(p=>ids.has(p.id)).map(pfFile).sort((a,b)=>b.updated-a.updated);
}

function pfEntryRow(e){
  let attrs = e.open?.lw ? 'data-lw="'+e.open.lw+'" data-id="'+esc(e.open.id)+'"' : e.open?.mail ? 'data-open-mail="'+esc(e.open.mail)+'"' : '';
  let names = (e.people||[]).map(id=>contact(id)?.name).filter(Boolean);
  return '<div class="pf-entry">'+
    '<div class="row-icon">'+icon(PF_TYPE_ICON[e.type]||'file')+'</div>'+
    '<div class="row-main"><div class="pf-entry-top"><strong>'+esc(e.title)+'</strong><span class="pf-date">'+esc(dateNice(e.date))+'</span></div>'+
      (e.text?'<p>'+esc(e.text)+'</p>':'')+
      '<div class="row-meta"><span class="pill neutral">'+esc(e.type)+'</span>'+(names.length?'<span class="pf-people">'+esc(names.join(', '))+'</span>':'')+(e.private?'<span class="pill neutral">'+icon('lock','sm')+' Only me</span>':'')+'</div></div>'+
    (attrs?'<button class="row-arrow" '+attrs+' aria-label="Open '+esc(e.title)+'">'+icon('arrow')+'</button>':'')+
  '</div>';
}
function pfSection(c){
  let files = pfProjectsFor(c);
  if(!files.length) return '<div class="profile-section pf"><div class="section-title"><h2>'+icon('briefcase')+' Project file</h2></div><p class="small muted">No projects linked to '+esc(c.name)+' yet. Projects appear here automatically once a meeting, email or note for this contact is filed to one.</p></div>';
  ui.projectFile = ui.projectFile || {};
  let f = files.find(x=>x.p.id===ui.projectFile[c.id]) || files[0], p = f.p, co = company(p.companyId);
  let updatedLabel = f.latest ? 'Updated '+dateNice(f.latest.date)+' · '+f.latest.type : 'No activity filed yet';
  let pick = '<label class="pf-pick"><span class="sr-only">Choose project</span><select id="pf-select" data-contact="'+esc(c.id)+'">'+files.map((x,i)=>'<option value="'+esc(x.p.id)+'" '+(x===f?'selected':'')+'>'+esc(x.p.name)+(i===0&&files.length>1?' · most recent':'')+'</option>').join('')+'</select></label>';
  let showN = 5;
  return '<div class="profile-section pf">'+
    '<div class="section-title"><h2>'+icon('briefcase')+' Project file</h2>'+pick+'</div>'+
    '<article class="pf-file" aria-label="Project file: '+esc(p.name)+'">'+
      '<header class="pf-head">'+
        '<div><div class="company-name">'+esc(co?.name||'')+'</div><h3>'+esc(p.name)+'</h3>'+
        '<div class="pill-line"><span class="pill blue">'+esc(p.status)+'</span><span class="pill gold">'+icon('sparkle','sm')+' '+esc(updatedLabel)+'</span>'+(f.opp?'<span class="pill neutral">Opportunity: '+esc(f.opp.stage)+(f.opp.value?' · $'+Number(f.opp.value).toLocaleString():'')+'</span>':'')+'</div></div>'+
        '<div class="pf-progress"><span>'+esc(p.progress??0)+'%</span><div class="progress"><b style="width:'+Number(p.progress||0)+'%"></b></div></div>'+
      '</header>'+
      '<div class="pf-brief"><strong>Latest</strong><p>'+esc(f.brief?.text || p.description || 'No summary yet.')+'</p>'+
        (f.brief?'<p class="small muted">From '+esc(f.brief.type.toLowerCase())+' · '+esc(f.brief.title)+' · '+esc(dateNice(f.brief.date))+'</p>':'')+
        (f.upcoming?'<p class="pf-next">'+icon('calendar','sm')+' Next: '+esc(f.upcoming.title)+' · '+esc(dateNice(f.upcoming.date))+' '+esc(f.upcoming.time||'')+'</p>':'')+
      '</div>'+
      '<div class="pf-cols">'+
        '<div><h4>Open promises</h4>'+(f.promises.length?f.promises.slice(0,4).map(q=>'<button class="pf-promise" data-open-promise="'+esc(q.id)+'"><span>'+esc(q.title)+'<small>'+esc(contact(q.contactId)?.name||q.owner||'')+'</small></span>'+promisePill(q)+'</button>').join(''):'<p class="small muted">None open.</p>')+'</div>'+
        '<div><h4>People</h4><div class="pf-chips">'+f.people.map(id=>'<button class="qc-chip pf-person'+(id===c.id?' is-current':'')+'" data-open-contact="'+esc(id)+'">'+esc(contact(id).name)+'</button>').join('')+'</div>'+
          (f.docs.length?'<h4 style="margin-top:14px">Documents</h4>'+f.docs.map(d=>'<p class="pf-doc">'+icon('file','sm')+' <span><b>'+esc(d.title)+'</b> '+esc(d.summary||'')+'</span></p>').join(''):'')+
        '</div>'+
      '</div>'+
      '<div class="pf-log"><h4>Activity filed to this project <span class="small muted">('+f.entries.length+')</span></h4>'+
        (f.entries.length?f.entries.slice(0,showN).map(pfEntryRow).join('')+
          (f.entries.length>showN?'<details class="pf-more"><summary>Show '+(f.entries.length-showN)+' older</summary>'+f.entries.slice(showN).map(pfEntryRow).join('')+'</details>':'')
        :'<p class="small muted">Nothing filed yet. Meeting notes, emails and calendar events linked to this project will appear here.</p>')+
      '</div>'+
      '<p class="pf-foot small muted">Filed automatically from meeting notes, email, calendar and other connected sources (simulated in this prototype). Items marked Only me are visible just to you.</p>'+
    '</article>'+
  '</div>';
}

(function(){
  const base = renderContactDetail;
  renderContactDetail = function(c){
    let html = base(c), at = html.indexOf('<div class="profile-section">');
    return at<0 ? html+pfSection(c) : html.slice(0,at)+pfSection(c)+html.slice(at);
  };
  document.addEventListener('change', e=>{
    if(e.target.id!=='pf-select') return;
    ui.projectFile = ui.projectFile || {};
    ui.projectFile[e.target.dataset.contact] = e.target.value;
    let y = window.scrollY; render(); window.scrollTo(0, y);
    document.getElementById('pf-select')?.focus({preventScroll:true});
  }, true);
  render();
})();
