#!/usr/bin/env node
'use strict';
// Run: node tests/smoke-workflows.cjs
// Startup and rendering smoke checks, not full browser/integration tests.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','frontend','scripts');
const files=['01-state-and-helpers.js','02-original-screens.js','03-original-interactions.js','04-automation-engine.js','05-enhanced-screens.js','06-automation-demonstrations.js','07-enhanced-interactions.js','08-approved-workflows.js','09-quick-capture.js','10-transcript-intelligence.js','11-project-files.js'];
const listeners={},storage={},nodes={app:{innerHTML:''},overlay:{innerHTML:''},toasts:{appendChild(){}}};
const document={getElementById(id){return nodes[id]||null},querySelector(){return null},addEventListener(type,handler){(listeners[type]??=[]).push(handler)},createElement(){return {textContent:'',className:'',remove(){}}},body:{appendChild(){}}};
const sandbox={document,window:{scrollTo(){}},navigator:{},localStorage:{getItem(k){return storage[k]||null},setItem(k,v){storage[k]=v}},setTimeout(){},clearTimeout(){},console,Date,Math,JSON,FormData,URL,Blob};
vm.createContext(sandbox);
for(const file of files){const source=fs.readFileSync(path.join(root,file),'utf8');new vm.Script(source,{filename:file});vm.runInContext(source,sandbox,{filename:file});}
const pages=['dashboard','inbox','promises','contacts','companies','projects','followups','suggested','integrations','settings','meetings','search-all','insights','manager-workflow'];
for(const page of pages){vm.runInContext('nav('+JSON.stringify(page)+')',sandbox);const html=nodes.app.innerHTML;assert.ok(html.length>150,page+' did not render');console.log('PASS render',page,html.length);}
vm.runInContext('nav("dashboard")',sandbox);
assert.match(nodes.app.innerHTML,/Your five priorities/);
assert.match(nodes.app.innerHTML,/Needs Attention/);
assert.match(nodes.app.innerHTML,/Open Promises/);
const main=nodes.app.innerHTML.split('<main class="content">')[1]||nodes.app.innerHTML;
assert.ok(main.indexOf('Needs Attention')<main.indexOf('Open Promises'),'Dashboard content section order changed');
console.log('PASS dashboard section order');
assert.match(main,/class="attention-split"/,'Needs Attention is not in the split layout');
assert.match(main,/Record Notes/,'Record Notes button missing');
assert.ok(main.indexOf('qc-panel')<main.indexOf('Needs Attention'),'Capture panel must precede Needs Attention so it stacks above on mobile');
assert.doesNotMatch(main,/data-qc="record-meeting"/,'Record Meeting should only show with a current/upcoming meeting');
vm.runInContext(`(()=>{let s=new Date(Date.now()+10*60e3);let h=s.getHours(),m=s.getMinutes();state.calendar.push({id:'calT',title:'Test meeting',contactId:'c1',date:s.getFullYear()+'-'+String(s.getMonth()+1).padStart(2,'0')+'-'+String(s.getDate()).padStart(2,'0'),time:((h%12)||12)+':'+String(m).padStart(2,'0')+' '+(h<12?'AM':'PM'),status:'Scheduled'});nav('dashboard')})()`,sandbox);
assert.match(nodes.app.innerHTML,/data-qc="record-meeting" data-id="calT"/,'Record Meeting missing for an upcoming meeting');
console.log('PASS quick capture panel');
// Transcript intelligence: detection, fallback and extraction.
const ti=vm.runInContext(`(()=>{
  const t=tiSimulateTranscript({mode:'meeting',event:{contactId:'c1'},seconds:120});
  const d=tiDetect(t), p=tiExtractPromise(t), notes=tiExtractNotes(t,{contactIds:d.contactIds,projectId:d.projectId});
  const none=tiDetect('Reminder to self: check equipment lead times.'), noPromise=tiExtractPromise('Reminder to self: check equipment lead times.');
  return JSON.stringify({ids:d.contactIds,project:d.projectId,promise:p&&p.title,due:p&&p.due,notes,none,noPromise,recent:tiRecentMeeting()});
})()`,sandbox);
const r=JSON.parse(ti);
assert.deepEqual(r.ids,['c1','c3'],'Meeting transcript should name Sarah Mitchell and Jamie Chen');
assert.equal(r.project,'pr1','Riverside project should be detected');
assert.match(r.promise,/^Send the updated schedule/);
assert.ok(r.due,'Promise due date should be parsed');
assert.match(r.notes,/Summary[\s\S]*Action items/);
assert.deepEqual(r.none,{contactIds:[],projectId:''});
assert.equal(r.noPromise,null,'No commitment should leave the promise blank');
assert.ok(r.recent&&r.recent.contactIds.length,'Most recent meeting fallback should exist in sample data');
console.log('PASS transcript intelligence');
// Project file on the contact profile: above the snapshot, newest project first, switchable.
vm.runInContext(`ui.selectedContact='c3';nav('contacts')`,sandbox);
let prof=nodes.app.innerHTML;
assert.match(prof,/Project file/,'Project file missing on contact profile');
assert.ok(prof.indexOf('Project file')<prof.indexOf('Relationship Snapshot'),'Project file must sit above the Relationship Snapshot');
assert.match(prof,/id="pf-select"/,'Jamie Chen has several projects, so the picker should show');
const pfOrder=JSON.parse(vm.runInContext(`JSON.stringify(pfProjectsFor(contact('c3')).map(f=>[f.p.id,f.updated]))`,sandbox));
assert.ok(pfOrder.every((x,i,a)=>!i||a[i-1][1]>=x[1]),'Project files should be sorted by most recently updated');
vm.runInContext(`LuMaCoWorkflows.extra.meetings.unshift({id:'mT',date:today(),savedAt:Date.now()+1e6,title:'Westlake test notes',contactIds:['c3'],contactId:'c3',projectId:'pr3',summary:'Summary\\nTest line.',transcript:'x',visibility:'private',kind:'notes'});ui.projectFile={};nav('contacts')`,sandbox);
prof=nodes.app.innerHTML;
assert.match(prof,/<option value="pr3" selected>Westlake Office Expansion · most recent/,'A newly filed note should make its project the default');
assert.match(prof,/Westlake test notes/,'Filed note should appear in the project log');
console.log('PASS project files');
assert.ok(listeners.click?.length>0,'No click handlers');
assert.ok(listeners.submit?.length>0,'No submit handlers');
console.log('PASS listeners registered');
console.log('Startup smoke tests passed. Real browser and integration tests are still required.');
