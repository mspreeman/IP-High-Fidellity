'use strict';
// Extracted from the latest verified single-file LuMaCo prototype.
const customAction=handleAction;
handleAction=function(a){if(a==='simulate-calendar'||a==='open-lab-calendar'){openModal('lab');return}if(a==='manager-zero-demo'){runZeroEntry();return}return customAction(a)};
const customSubmit=handleSubmit;
handleSubmit=function(form){let fd=new FormData(form),v=n=>(fd.get(n)||'').toString().trim();
 if(form.id==='lab-form'){runLab(fd);return}
 if(form.id==='identity-form'){let c=contact(ui.modalData?.contactId);if(!c)return;c.aliasEmails=v('emails').split(',').map(x=>x.trim()).filter(Boolean);c.aliasPhones=v('phones').split(',').map(x=>x.trim()).filter(Boolean);closeModal();saveAndRender('Approved identities updated. Ambiguous matches still require review.');return}
 if(form.id==='call-form'){
  let c=contact(ui.modalData?.contactId);if(!c)return;let duration=Number(v('duration')||0),note=v('summary'),i=state.interactions.find(i=>i.id===ui.modalData?.interactionId);
  if(i){const audit=state.audit.find(a=>a.revert?.id===i.id);const before=audit?.revert?.previous;if(duration<=state.settings.callThreshold&&before){c.lastOutreach=before.outreach;c.lastEngagement=before.engagement;c.last=c.lastEngagement||c.lastOutreach||null;c.companyLastOutreach=before.companyOutreach;c.companyLastEngagement=before.companyEngagement;}i.duration=duration;i.summary=note||i.summary;i.visibility=v('visibility')||'private';if(i.visibility==='private'){const audit=state.audit.find(a=>a.revert?.id===i.id);if(audit?.revert?.previous){c.companyLastOutreach=audit.revert.previous.companyOutreach;c.companyLastEngagement=audit.revert.previous.companyEngagement;}}i.qualifies=duration>state.settings.callThreshold;i.engagement=i.qualifies;i.outreach=i.qualifies;i.reason=i.qualifies?`Connected call exceeded ${state.settings.callThreshold} minutes`:'Did not exceed duration threshold';}
  else i=applyActivity(c,{type:'Call',title:'Connected phone call',text:note||'Call activity recorded, notes skipped',outgoing:true,duration,source:'Call log · simulated',visibility:v('visibility')||'private'});
  if(v('promise'))addPromiseSafe(c,{title:v('promise'),owner:'You',direction:'Made by me',source:'Call notes · user reviewed',origin:note,due:v('due'),visibility:v('visibility')||'private'});
  if(duration>state.settings.callThreshold){c.lastOutreach=today();c.lastEngagement=today();c.last=today();if(v('visibility')!=='private'){c.companyLastOutreach=today();c.companyLastEngagement=today()}}
  ui.selectedContact=c.id;closeModal();nav('contacts');saveAndRender('Call note saved; qualification follows the configured duration rule.');return
 }
 if(form.id==='meeting-form'){
  const c=contact(ui.modalData?.contactId);if(!c)return;
  let note=v('summary')||v('transcript');if(!note){toast('Enter a summary or transcript to file.');return}
  let visibility=v('visibility')||'private',cal=state.calendar.find(e=>e.id===ui.modalData?.calendarId);
  if(cal){const existing=state.interactions.find(x=>x.id===cal.interactionId);if(existing){existing.summary=note;existing.visibility=visibility;existing.transcript=v('transcript')}}
  else applyActivity(c,{type:'Meeting',title:'Meeting summary · reviewed',text:note,attendance:'Confirmed attended',engagement:true,source:'Simulated transcription, text only',visibility});
  if(v('promise'))addPromiseSafe(c,{title:v('promise'),owner:'You',direction:'Made by me',source:'Reviewed meeting notes',origin:v('transcript'),due:v('due'),visibility});ui.selectedContact=c.id;closeModal();nav('contacts');saveAndRender('Meeting text filed. No audio created or retained by the demo.');return
 }
 if(form.id==='note-form'){
  const c=contact(v('contactId'));if(!c)return;const typ=v('type'),note=v('summary');if(!note){toast('Add a note before saving.');return}
  applyActivity(c,{type:typ,title:`${typ} · manually reviewed`,text:note,source:'User-entered note',visibility:v('visibility')||'private',outreach:fd.has('updateLast'),engagement:fd.has('updateLast'),reason:'User-confirmed manual meaningful interaction'});
  ui.selectedContact=c.id;closeModal();nav('contacts');saveAndRender('Manual note saved privately by default.');return
 }
 if(form.id==='contact-form'){
  let oldId=ui.modalData?.id,em=v('email'),known=em&&state.contacts.find(x=>x.id!==oldId&&[x.email,...(x.aliasEmails||[])].some(z=>z?.toLowerCase()===em.toLowerCase()));
  if(known&&!oldId){openModal('merge',{existing:known.id,candidate:{name:v('name'),email:em,title:v('title'),phone:v('phone')}});return}
  let before=state.contacts.map(c=>c.id);const result=customSubmit(form);let newest=state.contacts.find(x=>!before.includes(x.id));if(newest){newest.last=null;newest.lastOutreach=null;newest.lastEngagement=null;newest.companyLastOutreach=null;newest.companyLastEngagement=null;newest.outreachCadence=Number(newest.cadence)||30;newest.engagementCadence=90;newest.ownerId='rep1';newest.visibility='team';newest.workspace='company';newest.aliasEmails=[];newest.aliasPhones=[];persist();render();toast('New contact starts without a false Last Contact date.')}return result
 }
 return customSubmit(form)
};
// Wrap the old meeting and note forms with record-level visibility controls. Private by default.
const prePrivacyModal=renderModal;
renderModal=function(){prePrivacyModal();
 if(ui.modal==='meeting'&&ui.meetingStage==='review'){let f=document.getElementById('meeting-form');if(f&&!f.querySelector('[name="visibility"]'))f.insertAdjacentHTML('beforeend',`<label class="field"><span>Who can see the saved note?</span><select name="visibility"><option value="private">Private — Only Me</option><option value="team">Team Shared</option><option value="manager">Managers Only</option></select></label>`)}
 if(ui.modal==='note'){let f=document.getElementById('note-form');if(f&&!f.querySelector('[name="visibility"]'))f.insertAdjacentHTML('beforeend',`<label class="field"><span>Who can see this note?</span><select name="visibility"><option value="private">Private — Only Me</option><option value="team">Team Shared</option><option value="manager">Managers Only</option></select></label>`)}
};
document.addEventListener('click',e=>{let el=e.target.closest('[data-extra]');if(!el)return;e.preventDefault();e.stopPropagation();const a=el.dataset.extra,id=el.dataset.id;
 if(a==='open-lab'||a==='open-lab-calendar'){openModal('lab');if(a==='open-lab-calendar')setTimeout(()=>{let el=document.querySelector('#lab-kind');if(el)el.value='Calendar'},0);return}
 if(a==='brief'||a==='brief-contact'){openModal('brief',a==='brief'?{id}:{contactId:id});return}
 if(a==='identity'){openModal('identity',{contactId:id});return}
 if(a==='snooze'){state.snoozes=state.snoozes||{};state.snoozes[id]=datePlus(today(),3);saveAndRender('Reminder snoozed for three days, underlying record unchanged.');return}
 if(a==='resolve-mail'){let m=state.messages.find(x=>x.id===id);if(m){m.resolved=true;m.action='FYI';saveAndRender('Message marked resolved in the demo.')}return}
 if(a==='calendar-confirm'){calendarDecision(id,'confirm');return}
 if(a==='calendar-reject'){calendarDecision(id,'reject');return}
 if(a==='calendar-complete'){calendarDecision(id,'complete');return}
 if(a==='select-rep'){ui.selectedRep=id;render();return}
 if(a==='undo'){undoAudit(id);return}
 if(a==='toggle-calendar-inference'){state.settings.calendarInference=!state.settings.calendarInference;saveAndRender('Calendar inference setting updated.');return}
 if(a==='merge-confirm'){let original=contact(ui.modalData?.existing),candidate=ui.modalData?.candidate;if(original&&candidate){if(candidate.phone&&!original.phone)original.phone=candidate.phone;if(candidate.title&&!original.title)original.title=candidate.title;ui.selectedContact=original.id;closeModal();nav('contacts');saveAndRender('Existing contact retained; no duplicate created.')}return}
},true);
document.addEventListener('change',e=>{let el=e.target.closest('[data-extra-change]');if(!el)return;let a=el.dataset.extraChange,c=contact(el.dataset.id),v=el.value;
 if(a==='outreach-cadence'&&c)c.outreachCadence=Number(v);
 if(a==='engagement-cadence'&&c)c.engagementCadence=Number(v);
 if(a==='contact-owner'&&c)c.ownerId=v;
 if(a==='contact-visibility'&&c){c.visibility=v;c.workspace=v==='private'?'personal':'company'}
 if(a==='call-threshold')state.settings.callThreshold=Number(v);
 if(a==='digest-mode')state.settings.digest=v==='digest';
 saveAndRender('Tracking preference updated.');
},true);
// Make top automation action discoverable, and protect existing accessibility and contrast improvements.

document.addEventListener('click',e=>{let el=e.target.closest('[data-open-mail]');if(el&&ui.page!=='inbox'){e.preventDefault();e.stopPropagation();ui.selectedMail=el.dataset.openMail;nav('inbox');}},true);

render();
