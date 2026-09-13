import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const phase=process.argv[2];
if(!['before','after'].includes(phase))throw new Error('before or after required');
const base='http://127.0.0.1:5214';
const out=path.resolve('/Users/piotrwisniewski/Developer/codex-wt/codex4-dlug-mvp/evidence/bundle-chunks',phase);
fs.mkdirSync(out,{recursive:true});
const session=JSON.parse(fs.readFileSync(new URL('./e3-session.json',import.meta.url),'utf8'));
const card=JSON.parse(fs.readFileSync(new URL('./e3-card.json',import.meta.url),'utf8')).card;
const inventory=JSON.parse(fs.readFileSync('/Users/piotrwisniewski/Developer/codex-wt/codex4-artefakty/e3-sidebar-inventory.json','utf8'));
const labels=inventory.filter(x=>x.tag==='BUTTON'&&!['Expand','Log Out'].includes(x.text)).map(x=>x.text);
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},locale:'en-US'});
await context.addInitScript(session=>{performance.setResourceTimingBufferSize(10000);localStorage.setItem('token',session.token);localStorage.setItem('refreshToken',session.refreshToken||'');localStorage.setItem('user',JSON.stringify(session.user));localStorage.setItem('i18nextLng','en');localStorage.setItem('consultify-storage',JSON.stringify({state:{theme:'light',language:'en'},version:0}));},session);
const page=await context.newPage();
let pageErrors=[],productConsole=[],httpErrors=[],apiRequests=[],js=[];
page.on('pageerror',e=>pageErrors.push(e.message));
page.on('console',m=>{if(m.type()==='error')productConsole.push(m.text());});
page.on('response',r=>{if(r.status()>=400)httpErrors.push({method:r.request().method(),status:r.status(),url:r.url().replace(base,'')});});
page.on('request',r=>{if(new URL(r.url()).pathname.startsWith('/api/'))apiRequests.push(r.method()+' '+r.url().replace(base,''));});
page.on('requestfinished',r=>{if(r.resourceType()==='script')js.push(r.url().replace(base,''));});
const reset=()=>{pageErrors=[];productConsole=[];httpErrors=[];apiRequests=[];js=[];};
async function stable(prev,timeout=60000){
 const started=Date.now();let last='',count=0,firstChangedMs=null;
 while(Date.now()-started<timeout){
  const d=await page.evaluate(()=>({text:document.body.innerText||'',root:document.getElementById('root')?.innerHTML.length||0,spinners:document.querySelectorAll('.animate-spin').length}));
  const ready=d.root>20000&&d.text!==prev&&!/Nie udało się wczytać danych na czas|Failed to load data in time/.test(d.text)&&!/(^|\s)(Loading…|Loading\.\.\.|Ładowanie…|Ładowanie\.\.\.)(\s|$)/.test(d.text)&&d.spinners===0;
  if(ready&&firstChangedMs===null)firstChangedMs=Date.now()-started;
  count=ready&&d.text===last?count+1:0;last=d.text;
  if(count>=3)return {firstChangedMs,stableMs:Date.now()-started};
  await page.waitForTimeout(400);
 }
 throw new Error('NEW_STABLE_CONTENT_TIMEOUT');
}
async function navButton(label){
 const buttons=page.getByRole('button',{name:label,exact:true});
 for(let i=0;i<await buttons.count();i++){const b=buttons.nth(i),box=await b.boundingBox();if(box&&box.x<72&&box.width>0){await b.click();return;}}
 throw new Error('LIVE_SIDEBAR_BUTTON_MISSING: '+label);
}
const all=[];
async function capture(name,trigger,isInitial=false){
 reset();await page.evaluate(()=>performance.clearResourceTimings()).catch(()=>{});const prior=await page.locator('body').innerText().catch(()=>'');const priorUrl=page.url();const start=Date.now();let timing=null,instrumentError=null,sameTarget=false;
 try{
  await trigger();
  if(!isInitial){await page.waitForTimeout(100);sameTarget=page.url()===priorUrl&&(await page.locator('body').innerText())===prior;}
  if(sameTarget)timing={firstChangedMs:null,stableMs:null,reason:'Sidebar action retained same URL and content; no navigation latency claimed'};
  else timing=await stable(isInitial?null:prior);
 }catch(e){instrumentError=e.message;}
 const readyFromTriggerMs=instrumentError||sameTarget?null:Date.now()-start;
 const observationWindowMs=2000;
 await page.waitForTimeout(observationWindowMs);
 const observedFromTriggerMs=Date.now()-start;
 const scriptResourceTiming=await page.evaluate(()=>performance.getEntriesByType('resource')
  .filter(e=>e.initiatorType==='script'||/\.m?js(?:[?#]|$)/.test(e.name))
  .map(e=>({url:e.name,initiatorType:e.initiatorType,startTime:e.startTime,responseEnd:e.responseEnd,
   duration:e.duration,decodedBodySize:e.decodedBodySize,encodedBodySize:e.encodedBodySize,
   transferSize:e.transferSize,responseStatus:e.responseStatus??null,deliveryType:e.deliveryType??null})));
 const measuredScriptUrls=new Set(scriptResourceTiming.map(x=>x.url.replace(base,'')));
 const scriptTimingMissingUrls=[...new Set(js)].filter(url=>!measuredScriptUrls.has(url));
 const scriptBytes={timingMissingUrls:scriptTimingMissingUrls,requestCount:scriptResourceTiming.length,
  decodedBodyBytes:scriptResourceTiming.reduce((n,e)=>n+e.decodedBodySize,0),
  encodedBodyBytes:scriptResourceTiming.reduce((n,e)=>n+e.encodedBodySize,0),
  transferBytes:scriptResourceTiming.reduce((n,e)=>n+e.transferSize,0),
  zeroTransferCount:scriptResourceTiming.filter(e=>e.transferSize===0).length,
  zeroBodySizeCount:scriptResourceTiming.filter(e=>e.decodedBodySize===0).length};
 const text=await page.locator('body').innerText();
 // Readiness excludes the observation window. JS/errors include the explicit
 // post-ready window; the screenshot cannot influence either timestamp.
 await page.mouse.move(1000,880);
 const filename=name.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 await page.screenshot({path:path.join(out,filename+'.png')});
 const item={capturedAt:new Date().toISOString(),name,phase,url:page.url().replace(base,''),timing,readyFromTriggerMs,observationWindowMs,observedFromTriggerMs,totalCaptureMs:Date.now()-start,scriptBytes,scriptResourceTiming,sameTarget,instrumentError,pageErrors:[...pageErrors],productConsole:[...productConsole],httpErrors:[...httpErrors],apiRequestCount:apiRequests.length,apiRequests:[...apiRequests],scriptRequests:[...js],text:text.slice(0,1600)};
 fs.writeFileSync(path.join(out,filename+'.json'),JSON.stringify(item,null,2));all.push(item);
 console.log(JSON.stringify({name,url:item.url,timing,readyFromTriggerMs,scriptBytes,pageErrors:pageErrors.length,consoleErrors:productConsole.length,httpErrors:httpErrors.length,instrumentError}));
 const close=page.getByRole('button',{name:/^(Close|Cancel|Got it|Skip for now)$/}).first();
 if(await page.getByRole('dialog').count()&&await close.isVisible().catch(()=>false))await close.click();
}
try{
 await capture('Cold My Work',()=>page.goto(base+'/my-work',{waitUntil:'domcontentloaded',timeout:60000}),true);
 const skip=page.getByRole('button',{name:'Skip for now',exact:true});if(await skip.isVisible().catch(()=>false))await skip.click();
 for(const label of labels)await capture(label,()=>navButton(label));
 // Initiative ID came from the local Northwind copy; task/action card were created through real APIs for this local reviewer; card deep links verified in InitiativesHub and MyWorkHub source.
 for(const [name,url] of [['Initiative card','/initiatives?open=e33b0b36-f9c9-5cc9-b516-ae04f7311de2&mode=doc'],['Task card','/my-work?taskId=62aef7e9-e13b-4863-976e-dfad798cfc78'],['Action card',`/action-cards/${card.id}`]]){
  await capture(name,()=>page.evaluate(url=>{history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'));},url));
 }
 fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({phase,base,viewport:{width:1440,height:900},theme:'light',moduleLabelsFromLiveSidebar:labels,sidebarModuleCount:labels.length,requiredByOldBrief:16,denominatorNote:'15 live sidebar items + cold My Work + 3 cards. Do not fabricate a sixteenth menu item. Inventory excludes Expand and Log Out.',measurementNotes:{readiness:'readyFromTriggerMs ends at stable content, before the 2000ms observation window and screenshot; JS/errors are observed until the window ends; totalCaptureMs includes screenshot and must not be used as navigation latency.',resourceTiming:'ResourceTiming buffer enlarged to 10000; timingMissingUrls flags any completed script URL absent from timing entries. Completed script resources at the end of the explicit 2000ms post-ready observation window. Fresh browser/context for cold start; later navigation uses the same context and may use cache. transferSize includes response headers and may be zero for memory/disk cache or unavailable cross-origin timing. encoded/decoded body sizes can describe cached payload and are not transferred network bytes. In-flight resources at observation end are absent; these numbers are observed first-screen JS, not a whole-application or total-session byte count.'},coldFirstScreenJs:all.find(x=>x.name==='Cold My Work')?.scriptBytes,results:all},null,2));
}finally{await browser.close();}
