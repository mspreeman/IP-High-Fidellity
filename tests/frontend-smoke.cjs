// Node-only smoke test that checks the extracted classic scripts in their intended order.
// This does not replace testing in a full browser.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root,'frontend','index.html'),'utf8');
const scriptNames = [...html.matchAll(/<script defer src="\.\/scripts\/([^"]+)"/g)].map(x=>x[1]);
if (scriptNames.length !== 7) throw Error(`Expected 7 script files, found ${scriptNames.length}`);
const elements = Object.fromEntries(['app','overlay','toasts'].map(id=>[id,{innerHTML:'',appendChild(){}}]));
const listeners = {};
const store = new Map();
const ctx = vm.createContext({
  console, Date, Math, JSON, String, Number, Boolean, Array, Object, RegExp, parseInt,
  setTimeout() {}, clearTimeout() {},
  localStorage: {getItem:(key)=>store.get(key)||null, setItem:(key,v)=>store.set(key,v)},
  window: {scrollTo(){}},
  document: {getElementById:(id)=>elements[id]||null, addEventListener:(name,fn)=>{(listeners[name]??=[]).push(fn)},
    createElement:()=>({className:'',textContent:'',remove(){},click(){}})},
});
for(const f of scriptNames){
  const js = fs.readFileSync(path.join(root,'frontend','scripts',f),'utf8');
  vm.runInContext(js, ctx, {filename:f,timeout:3000});
}
function check(page,phrase){
  vm.runInContext(`nav(${JSON.stringify(page)})`,ctx,{timeout:3000});
  const body=elements.app.innerHTML;
  if(!body.includes(phrase)) throw Error(`Page ${page} missing ${phrase}`);
  console.log(`PASS ${page}: ${phrase}, ${body.length} bytes rendered`);
}
check('dashboard','Needs Attention');
if(!elements.app.innerHTML.includes('Open Promises'))throw Error('Open Promises missing');
check('inbox','Organized conversations');
check('contacts','Sarah Mitchell');
check('companies','Meridian Builders');
check('manager','Team Dashboard');
check('integrations','Microsoft Outlook');
console.log('PASS: scripts load in order and all primary screens render in simulated DOM');
