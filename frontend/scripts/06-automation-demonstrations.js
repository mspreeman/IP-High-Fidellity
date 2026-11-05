'use strict';
// Extracted from the latest verified single-file LuMaCo prototype.
function runLab(fd){const get=k=>(fd.get(k)||'').toString().trim(),kind=get('kind'),id=get('contactId'),c=contact(id),text=get('message'),title=get('title')||kind+' update',visibility=get('visibility')||'team',direction=get('direction'),incoming=direction==='incoming',duration=Number(get('duration')||0),attendance=get('attendance');
 if(kind==='Email'){
  let m={id:uid('m'),contactId:c?.id||null,sender:c?.name||(id==='unknownBusiness'?'Taylor Brooks':'Unapproved personal sender'),email:c?.email||(id==='unknownBusiness'?'taylor@prospect.example':'unknown.personal@example.test'),companyId:c?.companyId||null,subject:title,preview:text.slice(0,140),body:text,category:c?(c.categories||[]).includes('Coworker')?'Internal':(c.categories||[]).includes('Vendor')?'Vendors':'External':(id==='unknownBusiness'?'External':'Personal'),action:state.settings.autoPromises&&/\b(i will|i'll|we will|we'll)\b/i.test(text)?'Open Promise':incoming&&truthyMeaning(text)?'Needs Reply':'FYI',priority:c?.priority||'Low',date:today(),time:'Simulated now',tracked:!!c,source:'Fictional email scenario',history:[]};
  if(!c)m.action='FYI';state.messages.unshift(m);
  if(!c&&id==='unknownBusiness'&&state.settings.suggestions){let count=state.messages.filter(x=>x.email===m.email).length;if(count>=3&&!state.suggestions.some(x=>x.email===m.email))state.suggestions.push({id:uid('s'),name:m.sender,email:m.email,company:'Prospect Company',title:'Unapproved business correspondent',reason:'Three fictional business emails received; approval required before tracking.',category:'Vendor'})}
  let promise=null;
  if(c){applyActivity(c,{type:'Email',title:incoming?'Customer email: '+title:'Sent email: '+title,text,source:'Outlook/Gmail · simulated',incoming,outgoing:!incoming,visibility});
    if(incoming)promise=maybePromise(text,c,'Email',m.id,visibility);
    if(promise?.created)m.action='Open Promise';
    const mayComplete=/\b(sent|attached|completed|delivered)\b/i.test(text);
    if(mayComplete){const p=state.promises.find(p=>p.status==='Open'&&p.contactId===c.id&&p.id!==promise?.created?.id);if(p){p.completionSuggested=true;state.audit.unshift({id:uid('a'),time:today(),text:`Possible promise completion detected for ${p.title}; user verification required`,revert:null})}}
  }
  ui.selectedMail=m.id;ui.mailAction='All';ui.mailCategory='All';closeModal();nav('inbox');saveAndRender(c?'Simulated email: sorted, approved contact matched, tracking and promises evaluated.':'Email sorted only — sender not enrolled or tracked.');return
 }
 if(!c){closeModal();nav('suggested');toast('Unapproved sender: no relationship tracking, reminder changes, or promises.');return}
 if(kind==='Text'){
  applyActivity(c,{type:'Text',title:'Text · '+title,text,source:'Simulated permitted messaging source',incoming,outgoing:!incoming,visibility});
  if(incoming)maybePromise(text,c,'Text',null,visibility);ui.selectedContact=c.id;closeModal();nav('contacts');saveAndRender('Simulated text categorized; contact activity and commitments updated when applicable.');return
 }
 if(kind==='Call'){
  let i=applyActivity(c,{type:'Call',title:'Connected phone call',text:'Call metadata recorded automatically. Add optional notes after the call.',source:'Phone call log · simulated',duration,answered:duration>0,outgoing:true,incoming:false,visibility,reason:duration>state.settings.callThreshold?`Connected ${duration}-minute call exceeded threshold`:`${duration}-minute call did not exceed the ${state.settings.callThreshold}-minute threshold`});
  persist();closeModal();if(detailed(c)){openModal('call',{contactId:c.id,duration,interactionId:i.id});toast('Call automatically evaluated. Detailed-contact notes are optional.')}else{ui.selectedContact=c.id;nav('contacts');toast(duration>state.settings.callThreshold?'Qualifying call recorded; engagement reset.':'Short call logged without resetting follow-up.')}return
 }
 if(kind==='Calendar'||kind==='Meeting'){
  const ev={id:uid('cal'),title,contactId:c.id,date:today(),time:'Simulated event ended',kind:kind==='Meeting'?'Customer meeting':'Client lunch / calendar',status:attendance,source:'Google/Outlook Calendar · simulated',visibility,workspace:visibility==='private'?'personal':'company',ownerId:c.ownerId};
  state.calendar.unshift(ev);if(['Confirmed attended','Inferred attended'].includes(attendance)){
   const i=applyActivity(c,{type:'Calendar',title,attendance,text:'Calendar event '+title+' · attendance '+attendance.toLowerCase(),source:ev.source,visibility,reason:'Matched approved contact; calendar event ended; attendance '+attendance.toLowerCase()});ev.interactionId=i.id;ev.previous=state.audit[0]?.revert?.previous;
  }
  persist();closeModal();if(kind==='Meeting'&&attendance!=='Canceled'&&detailed(c)){openModal('meeting',{contactId:c.id,calendarId:ev.id});toast('Meeting activity captured. Choose a consent-based recording simulation or a verbal recap.')}else{nav('followups');toast('Calendar event processed. Scheduled/canceled events do not count as engagement.')}return
 }
}
function runZeroEntry(){let c1=contact('c1'),c2=contact('c2'),c3=contact('c3');
 applyActivity(c1,{type:'Email',title:'Personalized Riverside update',text:'Hello Sarah, here is the revised Riverside project summary and proposed review agenda.',outgoing:true,source:'Outlook Email · simulation',visibility:'team'});
 applyActivity(c2,{type:'Call',title:'Client call · delivery coordination',text:'Discussed revised delivery timeline and purchasing needs.',outgoing:true,duration:7,source:'Phone metadata · hypothetical permitted integration',visibility:'team'});
 let ev={id:uid('cal'),title:'Lunch with Jamie Chen',contactId:c3.id,date:today(),time:'12:30 PM',kind:'Client lunch',status:'Inferred attended',source:'Outlook Calendar · simulated',visibility:'team',ownerId:c3.ownerId};state.calendar.unshift(ev);
 let i=applyActivity(c3,{type:'Calendar',title:ev.title,attendance:'Inferred attended',text:'Client lunch inferred from an ended calendar event.',source:ev.source,visibility:'team'});ev.interactionId=i.id;ev.previous=state.audit[0]?.revert?.previous;
 addPromiseSafe(c1,{title:'Review updated Riverside plan',owner:c1.name,direction:'Made to me',due:datePlus(today(),5),source:'Simulated customer email',origin:'I will review the new plan by next week.'});
 state.audit.unshift({id:uid('a'),time:today(),text:'Zero manual entry scenario completed. Three approved contacts updated; unconnected sources still shown as unavailable.',revert:null});
 ui.page='manager';ui.selectedRep='rep1';persist();render();toast('Zero-entry demonstration complete. Review individual progress and data coverage.');}
function undoAudit(id){let audit=state.audit.find(x=>x.id===id);if(!audit?.revert)return;const r=audit.revert;
 if(r.type==='activity'){state.interactions=state.interactions.filter(x=>x.id!==r.id);let c=contact(r.contactId);if(c){c.lastOutreach=r.previous.outreach;c.lastEngagement=r.previous.engagement;c.last=c.lastEngagement||c.lastOutreach||null;c.companyLastOutreach=r.previous.companyOutreach;c.companyLastEngagement=r.previous.companyEngagement}}
 if(r.type==='promise')state.promises=state.promises.filter(x=>x.id!==r.id);
 state.audit=state.audit.filter(x=>x.id!==id);saveAndRender('Simulated automation undone.');}
function calendarDecision(id,choice){let e=state.calendar.find(x=>x.id===id);if(!e)return;const c=contact(e.contactId);if(choice==='reject'){
  e.status='Not attended';if(e.interactionId){state.interactions=state.interactions.filter(i=>i.id!==e.interactionId);if(c&&e.previous){c.lastOutreach=e.previous.outreach;c.lastEngagement=e.previous.engagement;c.last=c.lastEngagement||c.lastOutreach||null;c.companyLastOutreach=e.previous.companyOutreach;c.companyLastEngagement=e.previous.companyEngagement}}
  state.audit.unshift({id:uid('a'),time:today(),text:`Attendance corrected for ${e.title}: not attended; inferred engagement reversed.`,revert:null});saveAndRender('Calendar attendance marked not attended. Related engagement reversed.');return
 }
 if(choice==='confirm'){e.status='Confirmed attended';let activity=state.interactions.find(i=>i.id===e.interactionId);if(activity)activity.attendance=e.status;saveAndRender('Attendance confirmed.');return}
 if(choice==='complete'){if(e.date>today())e.date=today();e.status=state.settings.calendarInference?'Inferred attended':'Awaiting confirmation';if(e.status==='Inferred attended'&&c){let i=applyActivity(c,{type:'Calendar',title:e.title,attendance:e.status,text:'Calendar event inferred attended: '+e.title,source:e.source,visibility:e.visibility});e.interactionId=i.id;e.previous=state.audit[0]?.revert?.previous}saveAndRender('Calendar event ended. Attendance '+e.status.toLowerCase()+'.');if(detailed(c))openModal('meeting',{contactId:c.id,calendarId:e.id});return}
}
