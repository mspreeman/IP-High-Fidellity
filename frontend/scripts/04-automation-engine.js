'use strict';
// Extracted from the latest verified single-file LuMaCo prototype.
/* LuMaCo v4: progressive enhancements to the original five-prototype-based demo.
   All connections, signals, transcription and AI extraction are simulated; no live data access. */
const baseDashboard=renderDashboard, baseContactDetail=renderContactDetail, baseCompanies=renderCompanies;
const baseInbox=renderInbox, basePromises=renderPromises, baseSettings=renderSettings;
const baseIntegrations=renderIntegrations, baseRenderModal=renderModal;
const baseHandleSubmit=handleSubmit, baseHandleAction=handleAction, baseSeed=seed;
let renderManager;
const REP=[{id:'rep1',name:'Sarah Johnson',role:'Salesperson'},{id:'rep2',name:'Michael Davis',role:'Salesperson'},{id:'rep3',name:'Emily Carter',role:'Salesperson'}];
NAV.splice(7,0,['manager','users','Manager View']);
const basePageHTML=pageHTML;
pageHTML=function(){if(ui.page==='manager')return renderManager();return basePageHTML()};
function seedEnhance(){
 state.settings=Object.assign({suggestions:true,autoPromises:true,focus:false,callThreshold:2,digest:true,quietUrgentOnly:true,defaultOutreach:30,defaultEngagement:90,calendarInference:true},state.settings||{});
 state.reps=state.reps||REP;
 state.audit=state.audit||[];
 state.calendar=state.calendar||[
 {id:'cal1',title:'Lunch with Sarah Mitchell',contactId:'c1',date:days(1),time:'12:00 PM',kind:'Client lunch',status:'Scheduled',source:'Outlook Calendar · simulated',visibility:'team',ownerId:'rep1'},
 {id:'cal2',title:'Project review with Alex Morgan',contactId:'c2',date:days(3),time:'10:30 AM',kind:'Project meeting',status:'Scheduled',source:'Google Calendar · simulated',visibility:'team',ownerId:'rep2'},
 {id:'cal3',title:'Coffee with Jamie Chen',contactId:'c3',date:days(-4),time:'8:30 AM',kind:'Coffee',status:'Inferred attended',source:'Outlook Calendar · simulated',visibility:'team',ownerId:'rep3'}
 ];
 state.integrations=state.integrations||{outlook:{status:'Simulated',last:null},gmail:{status:'Simulated',last:null},calendar:{status:'Simulated',last:null},teams:{status:'Unavailable in demo',last:null},mobile:{status:'Unavailable in demo',last:null}};
 state.contacts.forEach((c,i)=>{
  if(c.lastOutreach===undefined)c.lastOutreach=c.last||null;
  if(c.lastEngagement===undefined)c.lastEngagement=c.last||null;
  if(c.companyLastOutreach===undefined)c.companyLastOutreach=c.lastOutreach||null;
  if(c.companyLastEngagement===undefined)c.companyLastEngagement=c.lastEngagement||null;
  if(c.outreachCadence===undefined)c.outreachCadence=Number(c.cadence)||30;
  if(c.engagementCadence===undefined)c.engagementCadence=90;
  if(c.aliasEmails===undefined)c.aliasEmails=[];
  if(c.aliasPhones===undefined)c.aliasPhones=[];
  if(!c.ownerId)c.ownerId=['rep1','rep2','rep3'][i%3];
  if(!c.workspace)c.workspace='company';
  if(!c.visibility)c.visibility='team';
  if(!c.engagementMode)c.engagementMode='warn';
 });
 state.interactions.forEach(i=>{if(!i.visibility)i.visibility='team';if(!i.sourceType)i.sourceType='seed';if(!i.qualifies)i.qualifies=false;if(!i.workspace)i.workspace='company';});
 state.promises.forEach(p=>{if(!p.visibility)p.visibility='team';if(!p.workspace)p.workspace='company';});
 if(!state.auditedVersion){state.auditedVersion=4;state.audit.unshift({id:uid('a'),time:today(),text:'LuMaCo automation rules initialized. Existing example interactions were not used to retroactively change cadence.',revert:null});}
}
seedEnhance();persist();
function datePlus(base,n){if(!base)return null;const d=new Date(base+'T12:00:00');d.setDate(d.getDate()+Number(n||0));return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function cadenceDate(base,cadence){if(!base)return null;const d=new Date(base+'T12:00:00'),s=String(cadence||'90');let n=Number(s)||90;
 const months=({'monthly':1,'30':1,'60':2,'quarterly':3,'90':3,'semiannual':6,'180':6,'annual':12,'365':12})[s];
 if(months){const originalDay=d.getDate();d.setDate(1);d.setMonth(d.getMonth()+months);const lastDay=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();d.setDate(Math.min(originalDay,lastDay))}else d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
nextFollow=function(c){return c?cadenceDate(c.lastOutreach,c.outreachCadence||c.cadence):null};
const dueSafe=d=>d?dueText(d):'Not yet contacted';
const dueRel=d=>d&&dayDiff(d)<0;
function companyOutreachDue(c){return cadenceDate(c.companyLastOutreach,c.outreachCadence||c.cadence)}
function companyEngagementDue(c){return datePlus(c.companyLastEngagement,c.engagementCadence||90)}
const niceCad=n=>({30:'Monthly',90:'Quarterly',180:'Every 6 months',365:'Annually',7:'Weekly'}[String(n)]||`${n} days`);
function engagementDue(c){return datePlus(c.lastEngagement,c.engagementCadence||90)}
function repName(id){return (state.reps||REP).find(r=>r.id===id)?.name||'Unassigned'}
function isShared(x){return x&&x.visibility!=='private'&&x.workspace!=='personal'}
function truthyMeaning(text){let s=(text||'').toLowerCase().trim();return s.length>35&&!/^(thanks|thank you|ok|okay|got it|received|noted|sounds good)[.!\s]*$/.test(s)&&!/(out of office|automatic reply|unsubscribe|newsletter)/.test(s)}
function identityMatch(email,phone,name){const e=(email||'').trim().toLowerCase(),ph=(phone||'').replace(/\D/g,''),nm=(name||'').trim().toLowerCase();let candidates=state.contacts.filter(c=> (e&&[c.email,...(c.aliasEmails||[])].some(x=>x?.toLowerCase()===e))||(ph&&[c.phone,...(c.aliasPhones||[])].some(x=>x?.replace(/\D/g,'')===ph)));
 if(candidates.length===1)return {contact:candidates[0],confidence:'Verified address/number'};
 if(candidates.length>1)return {contact:null,confidence:'Ambiguous match — approval required'};
 if(nm){candidates=state.contacts.filter(c=>c.name.toLowerCase()===nm);if(candidates.length===1)return {contact:candidates[0],confidence:'Name match — unverified; approval required'};}
 return {contact:null,confidence:'Not in approved contacts'};
}
function applyActivity(c,opts){if(!c)return null;
 const typ=opts.type||'Other', outgoing=opts.outgoing===true, incoming=opts.incoming===true;
 const duration=Number(opts.duration||0),qualifiesCall=typ==='Call'&&opts.answered!==false&&duration>Number(state.settings.callThreshold||2);
 const text=opts.text||'', meaningful=opts.meaningful!==undefined?!!opts.meaningful:truthyMeaning(text);
 const calendarQualified=typ==='Calendar'&&['Confirmed attended','Inferred attended'].includes(opts.attendance);
 const isEngaged=opts.engagement!==undefined?!!opts.engagement:qualifiesCall||calendarQualified||(typ==='Meeting'&&opts.attendance==='Confirmed attended')||((typ==='Email'||typ==='Text')&&incoming&&meaningful);
 const isOutreach=opts.outreach!==undefined?!!opts.outreach:(qualifiesCall&&outgoing)||(calendarQualified)||(meaningful&&outgoing&&(typ==='Email'||typ==='Text'));
 const previous={outreach:c.lastOutreach||null,engagement:c.lastEngagement||null,companyOutreach:c.companyLastOutreach||null,companyEngagement:c.companyLastEngagement||null};
 const activity={id:uid('i'),contactId:c.id,type:typ,date:opts.date||today(),title:opts.title||typ+' · automatically recognized',summary:text||opts.title||'',source:opts.source||'Simulated connected source',sourceType:'simulation',visibility:opts.visibility||'team',workspace:opts.workspace||'company',projectId:opts.projectId||null,qualifies:!!(isEngaged||isOutreach),outreach:isOutreach,engagement:isEngaged,reason:opts.reason||(isEngaged?'Meaningful two-way engagement':isOutreach?'Meaningful outreach':'Recorded activity, not a qualifying contact'),confidence:opts.confidence||'Simulated',duration:typ==='Call'?duration:undefined,attendance:opts.attendance||undefined};
 if(isOutreach&&(!c.lastOutreach||activity.date>=c.lastOutreach))c.lastOutreach=activity.date;
 if(isEngaged&&(!c.lastEngagement||activity.date>=c.lastEngagement))c.lastEngagement=activity.date;
 c.last=c.lastEngagement||c.lastOutreach||null;
 if(opts.visibility!=='private'&&opts.workspace!=='personal'){if(isOutreach&&(!c.companyLastOutreach||activity.date>=c.companyLastOutreach))c.companyLastOutreach=activity.date;if(isEngaged&&(!c.companyLastEngagement||activity.date>=c.companyLastEngagement))c.companyLastEngagement=activity.date;}
 state.interactions.unshift(activity);
 state.audit.unshift({id:uid('a'),time:today(),visibility:activity.visibility,text:`${c.name}: ${typ} recorded. ${isOutreach?'Outreach updated. ':''}${isEngaged?'Engagement updated. ':''}${!isOutreach&&!isEngaged?'No cadence reset.':''}`,revert:{type:'activity',id:activity.id,contactId:c.id,previous}});
 return activity;
}
function addPromiseSafe(c,params){if(!c||!state.settings.autoPromises)return null;
 const norm=t=>(t||'').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,28);
 const matches=state.promises.find(p=>p.status==='Open'&&p.contactId===c.id&&norm(p.title)===norm(params.title));
 if(matches)return {existing:matches};
 const p={id:uid('p'),title:params.title,owner:params.owner||'You',contactId:c.id,companyId:c.companyId,projectId:params.projectId||null,due:params.due||datePlus(today(),3),status:'Open',source:params.source||'Simulated communication',sourceId:params.sourceId||null,origin:params.origin||'',direction:params.direction||'Made by me',confidence:params.confidence||'Example rule · review suggested',visibility:params.visibility||'team',workspace:params.workspace||'company'};
 state.promises.unshift(p);state.audit.unshift({id:uid('a'),time:today(),visibility:p.visibility,text:`Open Promise detected for ${c.name}: ${p.title}`,revert:{type:'promise',id:p.id}});return {created:p};
}
function maybePromise(text,c,type,sourceId,visibility){if(!c||!text)return null;
 // Narrow deterministic demonstration rules, explicitly not a production AI extraction model.
 const sentence=text.split(/[.!\n]/).find(x=>/\b(i will|i'll|we will|we'll|i can send|we can send)\b/i.test(x));
 if(!sentence)return null;
 const promiseText=sentence.trim().slice(0,135);
 let due=datePlus(today(),3),d=/\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.exec(sentence);
 if(d){const daysMap=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'],current=new Date(today()+'T12:00:00').getDay(),target=daysMap.indexOf(d[1].toLowerCase());due=datePlus(today(),((target-current+7)%7)||7)}
 const direction=/\b(i will|i'll|we will|we'll)\b/i.test(sentence)?'Made to me':'Made to me';
 return addPromiseSafe(c,{title:promiseText.replace(/^(i will|i'll|we will|we'll)\s+/i,'').replace(/^./,x=>x.toUpperCase()),origin:promiseText,direction,owner:c.name,due,source:type+' · simulated',sourceId,confidence:'Rule-based demo · review',visibility});
}
function newestActivity(c,kind){let a=state.interactions.filter(x=>x.contactId===c.id&&(kind==='outreach'?x.outreach:x.engagement)).sort((x,y)=>y.date.localeCompare(x.date));return a[0]}
function attentionItems(){let results=[];
 for(const c of state.contacts){if(c.workspace==='personal')continue;const d=nextFollow(c),eng=engagementDue(c),co=company(c.companyId)?.name||'No company';
 if(d&&dayDiff(d)<0)results.push({kind:'outreach',id:c.id,title:`Follow up with ${c.name}`,detail:co,reason:`Outreach ${Math.abs(dayDiff(d))} days overdue`,priority:c.priority==='High'?88:62,due:d});
 if(eng&&dayDiff(eng)<0)results.push({kind:'engagement',id:c.id,title:`Reconnect with ${c.name}`,detail:co,reason:`No engagement for ${Math.abs(dayDiff(c.lastEngagement))} days`,priority:c.priority==='High'?92:64,due:eng});
 }
 for(const p of state.promises.filter(x=>x.status==='Open'&&isShared(x)&&dayDiff(x.due)<=2))results.push({kind:'promise',id:p.id,title:p.title,detail:(company(p.companyId)?.name||'')+' · '+p.owner,reason:dueSafe(p.due),priority:dayDiff(p.due)<0?100:85,due:p.due});
 for(const m of state.messages.filter(x=>x.tracked&&x.action==='Needs Reply'&&x.priority==='High'&&!x.resolved))results.push({kind:'mail',id:m.id,title:m.subject,detail:(company(m.companyId)?.name||'')+' · '+m.sender,reason:'Customer needs response',priority:86});
 for(const d of state.drafts.filter(x=>x.status==='Pending'))results.push({kind:'draft',id:d.id,title:'Review '+d.kind.toLowerCase()+' notes',detail:d.company,reason:'Unfiled context',priority:58});
 const now=today();return results.filter(x=>!(state.snoozes||{})[x.kind+':'+x.id]||state.snoozes[x.kind+':'+x.id]<now).sort((a,b)=>b.priority-a.priority).slice(0,8)
}
function actionButtons(x){let open=x.kind==='promise'?`data-open-promise="${x.id}"`:x.kind==='mail'?`data-open-mail="${x.id}"`:x.kind==='draft'?`data-open-draft="${x.id}"`:`data-open-contact="${x.id}"`;
return `<button class="btn sm" ${open}>View</button><button class="btn sm" data-extra="snooze" data-id="${x.kind}:${x.id}">Snooze</button>${x.kind==='promise'?`<button class="btn sm" data-action="complete-promise-${x.id}">Complete</button>`:x.kind==='mail'?`<button class="btn sm" data-extra="resolve-mail" data-id="${x.id}">Resolved</button>`:''}`}
