'use strict';
// Transcript intelligence for quick capture (09-quick-capture.js).
//
//   tiSimulateTranscript  – the prototype's simulated transcription integration. It writes a
//                           realistic transcript from calendar/project data; audio is never analysed.
//   tiDetect              – finds approved contacts and a project mentioned in the text.
//   tiRecentMeeting       – fallback context: the most recent meeting (calendar or library).
//   tiExtractNotes        – "AI" note extraction: summary, key points, decisions, action items.
//   tiExtractPromise      – the first commitment you made, with its due date, or null.
//
// Extraction is simulated with transparent rules so the prototype runs offline with no AI
// service. Each function takes plain text and returns plain data, so a real model call can
// replace it later without changing the capture UI.

function tiReEsc(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}
function tiFind(text,term){let m = new RegExp('\\b'+tiReEsc(term)+'\\b','i').exec(text); return m ? m.index : -1}
function tiCount(text,term){return (text.match(new RegExp('\\b'+tiReEsc(term)+'\\b','gi'))||[]).length}
function tiFirst(name){return String(name||'').split(' ')[0]}
function tiNames(ids){return ids.map(id=>contact(id)?.name).filter(Boolean)}
function tiList(xs){return xs.length<3 ? xs.join(' and ') : xs.slice(0,-1).join(', ')+' and '+xs.at(-1)}
function tiProjectFor(contactId){return state.projects.find(p=>(p.contactIds||[]).includes(contactId))}

// ---------- Simulated transcription ----------
const TI_TOPICS = {
  pr1:{concern:'Our main concern is the schedule. We need the revised dates before our next coordination meeting.',
       detail:'On our side, the equipment clearances in the mechanical room still need to be confirmed.',
       promise:'I\'ll send the updated schedule and the revised drawing package by Friday.',
       decision:'That works. Let\'s keep the coordination meeting on the calendar for next Tuesday.',
       note:'the revised drawing package is the open item and the mechanical room clearances still need to be confirmed'},
  pr2:{concern:'We\'re worried the equipment delivery date has slipped. The rooftop units are the long-lead items.',
       detail:'If the units arrive late, we will need to resequence the crane day.',
       promise:'I\'ll confirm the revised delivery date with the supplier by Thursday.',
       decision:'Agreed. Let\'s hold the current install sequence until the date is confirmed.',
       note:'the rooftop units are now the long-lead items and the delivery date may have slipped'},
  pr3:{concern:'We need the owner requirements pinned down before design moves forward.',
       detail:'The tenant layout for the second floor is still changing, so please flag anything that depends on it.',
       promise:'I\'ll send a short summary of the owner requirements by Monday.',
       decision:'Sounds good. Let\'s schedule a design workshop for later this month.',
       note:'the owner requirements need to be locked before design moves forward and the second-floor layout is still changing'}
};
const TI_DEFAULT_TOPIC = {concern:'We need a clear next step on the open items.', detail:'Timing is the main thing we are watching.',
  promise:'I\'ll send a recap with next steps by Friday.', decision:'That works. Let\'s check in again next week.', note:'the open items need a clear next step'};

let tiNoteScenario = 0;
function tiSimulateTranscript({mode, event, seconds}){
  let len = Math.max(seconds||0, 60), t = f=>'['+qcClock(Math.round(len*f))+'] ';
  if(mode==='meeting' && event){
    let c = contact(event.contactId);
    let p = state.projects.find(x=>x.id===event.projectId) || tiProjectFor(event.contactId);
    let other = contact((p?.contactIds||[]).find(id=>id!==event.contactId));
    let topic = TI_TOPICS[p?.id] || TI_DEFAULT_TOPIC, where = p ? p.name : 'the project';
    let lines = [
      t(0)+'You: Thanks for joining, '+tiFirst(c?.name)+'.'+(other?' '+tiFirst(other.name)+', glad you could make it too.':'')+' I wanted to walk through where '+where+' stands.',
      t(.18)+(c?.name||'Guest')+': Sure. '+topic.concern];
    if(other) lines.push(t(.36)+other.name+': '+topic.detail);
    lines.push(t(.55)+'You: Understood. '+topic.promise,
      t(.75)+(c?.name||'Guest')+': '+topic.decision,
      t(.92)+'You: Great. I\'ll follow up by email with the details.');
    return lines.join('\n');
  }
  // Voice notes rotate through: one person, two people, and nothing identifiable (shows the fallback).
  let scenario = tiNoteScenario++ % 3;
  let p = state.projects[(Math.floor(tiNoteScenario/3)+ (scenario===0?1:2)) % state.projects.length];
  let topic = TI_TOPICS[p?.id] || TI_DEFAULT_TOPIC;
  let people = (p?.contactIds||[]).map(contact).filter(Boolean);
  if(scenario===0 && people[0]){
    return 'Quick note after talking with '+people[0].name+' about '+p.name+'. '+tiFirst(people[0].name)+' says '+topic.note+'. '+topic.promise+' Also need to update the weekly plan.';
  }
  if(scenario===1 && people.length>1){
    return 'Site walk notes for '+p.name+' with '+people[0].name+' and '+people[1].name+'. '+tiFirst(people[0].name)+' mentioned that '+topic.note+'. '+tiFirst(people[1].name)+' wants an update before the next coordination meeting. '+topic.promise;
  }
  return 'Reminder to self: review the open items list before the end of the week, check equipment lead times, and update the weekly plan.';
}

// ---------- Detection ----------
function tiDetect(text){
  text = String(text||'');
  let firstCounts = {};
  state.contacts.forEach(c=>{let f = tiFirst(c.name).toLowerCase(); firstCounts[f] = (firstCounts[f]||0)+1});
  let contacts = state.contacts.map(c=>{
    let full = tiFind(text, c.name), first = firstCounts[tiFirst(c.name).toLowerCase()]===1 ? tiFind(text, tiFirst(c.name)) : -1;
    let at = [full, first].filter(i=>i>=0);
    return at.length ? {id:c.id, at:Math.min(...at)} : null;
  }).filter(Boolean).sort((a,b)=>a.at-b.at).map(x=>x.id);
  let companyFirstWords = state.companies.map(c=>tiFirst(c.name).toLowerCase());
  let projects = state.projects.map(p=>{
    let words = p.name.split(' '), terms = [p.name];
    if(words.length>2) terms.push(words.slice(0,2).join(' '));
    if(words[0].length>=5 && !companyFirstWords.includes(words[0].toLowerCase())) terms.push(words[0]);
    let score = 0, at = Infinity;
    terms.forEach((term,i)=>{let n = tiCount(text, term); if(n){score += n*(3-Math.min(i,2)); at = Math.min(at, tiFind(text, term))}});
    // Terms overlap (the full name also contains the short forms), so full-name mentions weigh most.
    return {id:p.id, score, at};
  }).filter(x=>x.score>0).sort((a,b)=>b.score-a.score || a.at-b.at);
  return {contactIds:contacts, projectId:projects[0]?.id||''};
}

// ---------- Fallback: most recent meeting ----------
function tiRecentMeeting(currentEventId){
  let now = Date.now(), cands = [];
  (state.calendar||[]).forEach(e=>{
    if(/cancel/i.test(e.status||'')) return;
    let start = qcEventStart(e);
    if(!start || (start > now && e.id!==currentEventId)) return;
    cands.push({when:e.id===currentEventId ? now+1 : +start, title:e.title, date:e.date,
      contactIds:e.contactId?[e.contactId]:[], projectId:e.projectId || tiProjectFor(e.contactId)?.id || ''});
  });
  (globalThis.LuMaCoWorkflows?.extra.meetings||[]).forEach(m=>{
    if(m.kind==='notes' || (typeof visible==='function' && !visible(m))) return;  // notes aren't meetings
    cands.push({when:m.savedAt || +new Date(m.date+'T12:00:00'), title:m.title, date:m.date,
      contactIds:m.contactIds || (m.contactId?[m.contactId]:[]), projectId:m.projectId||''});
  });
  return cands.sort((a,b)=>b.when-a.when)[0] || null;
}

// ---------- Utterances ----------
function tiUtterances(text){
  let out = [];
  String(text||'').split('\n').map(l=>l.trim()).filter(Boolean).forEach(line=>{
    line = line.replace(/^\[\d{1,2}:\d{2}(?::\d{2})?\]\s*/,'');
    let m = /^([A-Z][\w.'-]*(?: [A-Z][\w.'-]*){0,2}):\s+(.*)$/.exec(line);
    let speaker = m ? m[1] : 'You', body = m ? m[2] : line;
    body.split(/(?<=[.!?])\s+/).map(s=>s.trim()).filter(Boolean).forEach(s=>out.push({speaker, text:s}));
  });
  return out;
}
function tiClean(s){return s.replace(/\s+/g,' ').replace(/^(sure|ok|okay|yes|great|understood|agreed|sounds good|that works)[,.!]?\s+/i,'').trim()}
function tiCap(s){return s.charAt(0).toUpperCase()+s.slice(1)}

// ---------- Due dates ----------
const TI_DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
function tiDue(s){
  s = s.toLowerCase();
  let wd = TI_DAYS.findIndex(d=>new RegExp('\\b(by|on|before|this|next)?\\s*'+d+'\\b').test(s));
  if(wd>=0){let diff = (wd - new Date().getDay() + 7) % 7 || 7; if(/\bnext\s+\w+day\b/.test(s) && diff<7) diff += 7; return days(diff)}
  if(/\btomorrow\b/.test(s)) return days(1);
  if(/\b(today|end of (the )?day|tonight)\b/.test(s)) return days(0);
  if(/\bend of (the )?week\b/.test(s)) return days((5 - new Date().getDay() + 7) % 7 || 7);
  if(/\bnext week\b/.test(s)) return days(7);
  return '';
}
const TI_DUE_PHRASE = /\s+(by|on|before)\s+(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|the end of (the )?(day|week)|end of (the )?(day|week))\b.*$|\s+(tomorrow|today|next week)\b.*$/i;

// ---------- Promise ----------
function tiExtractPromise(text){
  let u = tiUtterances(text).find(x=>x.speaker==='You' && /\b(I'll|I will|we'll|we will)\b/i.test(x.text) && !/\bfollow up by email\b/i.test(x.text));
  if(!u) return null;
  let clause = u.text.replace(/^.*?\b(I'll|I will|we'll|we will)\s+(also\s+)?/i,'').replace(/[.!?]+$/,'');
  let due = tiDue(clause);
  let title = tiCap(clause.replace(TI_DUE_PHRASE,'').trim());
  return title ? {title, due, quote:u.text} : null;
}

// ---------- "AI" notes ----------
const TI_POINT = /\b(concern|worried|need|needs|issue|risk|slipped|changing|clearances?|long-lead|requirements?|flag|wants|mentioned|says|check)\b/i;
const TI_DECISION = /\b(let's|agreed to|decided|we'll keep|hold the|schedule a)\b/i;
const TI_COMMIT = /\b(I'll|I will|we'll|we will)\b|(^|\b(I|we|also)\s+)need to\b/i;
const TI_FILLER = /^(sure|ok|okay|yes|great|understood|agreed|sounds good|that works|thanks|thank you)\b[^a-z]*$/i;
const TI_SELF_LIST = /^(reminder( to self)?|to ?do|remember to)[:\s]+/i;
function tiExtractNotes(text, {contactIds=[], projectId='', typed=''}={}){
  let us = tiUtterances(text), names = tiNames(contactIds), p = state.projects.find(x=>x.id===projectId);
  if(!us.length) return typed.trim();
  let isMeeting = us.some(x=>x.speaker!=='You');
  let points = [], decisions = [], mine = [], requested = [];
  let task = (raw,due)=>{let t = tiCap(raw.replace(/[.!?]+$/,'').replace(TI_DUE_PHRASE,'').trim()); return t ? t+(due?' (by '+dateNice(due)+')':'') : ''};
  us.forEach(x=>{
    let s = tiClean(x.text); if(!s || TI_FILLER.test(s) || /^(thanks|thank you)\b/i.test(s)) return;
    let you = x.speaker==='You';
    if(you && TI_SELF_LIST.test(s)){   // "Reminder to self: a, b, and c" -> one action each
      s.replace(TI_SELF_LIST,'').replace(/[.!?]+$/,'').split(/,\s*(?:and\s+)?|\s+and\s+/).forEach(part=>{let t = task(part, tiDue(part)); if(t) mine.push(t)});
      return;
    }
    if(you && TI_COMMIT.test(s)){
      let t = task(s.replace(/^.*?\b(I'll|I will|we'll|we will|need to)\s+(also\s+)?/i,''), tiDue(s));
      if(t && !/^follow up by email/i.test(t)) mine.push(t);
      return;
    }
    if(!you && /\bplease\b/i.test(s)){
      let t = task(s.replace(/^.*?\bplease\s+/i,''), tiDue(s));
      if(t) requested.push(t+' (asked by '+x.speaker+')');
      if(TI_POINT.test(s)) points.push(x.speaker+': '+s);
      return;
    }
    if(TI_DECISION.test(s)){decisions.push(tiCap(s.replace(/^let's\s+/i,'')));return}
    if(TI_POINT.test(s)) points.push(isMeeting && !you ? x.speaker+': '+s : tiCap(s));
  });
  let actions = mine.concat(requested);
  let about = p ? p.name : 'open items';
  let lead = isMeeting
    ? 'Discussed '+about+(names.length?' with '+tiList(names):'')+'.'
    : 'Voice note about '+about+(names.length?' ('+tiList(names)+')':'')+'.';
  let first = (points[0]||'').replace(/^[^:]+:\s*/,'').replace(/[.!?]+$/,'');
  let concern = !first ? '' : /^our main concern is\s+/i.test(first) ? ' Main concern: '+first.replace(/^our main concern is\s+/i,'')+'.'
    : ' Key point: '+(/^(we|our|the|if)\b/i.test(first) ? first.charAt(0).toLowerCase()+first.slice(1) : first)+'.';
  let next = actions[0] ? ' Next step: '+actions[0].charAt(0).toLowerCase()+actions[0].slice(1)+'.' : '';
  let sec = (h,xs)=>xs.length ? '\n\n'+h+'\n'+xs.slice(0,5).map(x=>'• '+x).join('\n') : '';
  return ('Summary\n'+lead+concern+next+sec('Key points',points)+sec('Decisions',decisions)+sec('Action items',actions)+(typed.trim()?'\n\nYour notes\n'+typed.trim():'')).trim();
}
