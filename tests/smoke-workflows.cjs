#!/usr/bin/env node
'use strict';
// Run: node tests/smoke-workflows.cjs
// Startup and rendering smoke checks, not full browser/integration tests.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..','frontend','scripts');
const files=['01-state-and-helpers.js','02-original-screens.js','03-original-interactions.js','04-automation-engine.js','05-enhanced-screens.js','06-automation-demonstrations.js','07-enhanced-interactions.js','08-approved-workflows.js'];
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
assert.ok(listeners.click?.length>0,'No click handlers');
assert.ok(listeners.submit?.length>0,'No submit handlers');
console.log('PASS listeners registered');
console.log('Startup smoke tests passed. Real browser and integration tests are still required.');
