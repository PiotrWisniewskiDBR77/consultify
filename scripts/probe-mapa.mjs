import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({viewport:{width:1480,height:840}})).newPage();
p.on('pageerror', e=>console.log('PAGEERR', String(e).slice(0,200)));
await p.goto('http://localhost:3332/?screen=mindmap-canvas&ff_ideaBottomBarUnified=1',{waitUntil:'load'});
await p.waitForTimeout(5000);
await p.evaluate(()=>{for(const el of document.querySelectorAll('div')){const cs=getComputedStyle(el);if(cs.position==='fixed'&&Number(cs.zIndex)>2000000000)el.style.display='none';}});
const real = () => p.evaluate(()=>{const v=document.querySelector('.react-flow__viewport');const m=/matrix\(([-\d.]+)/.exec(getComputedStyle(v).transform);return m?Math.round(parseFloat(m[1])*100):null;});
const shown = () => p.evaluate(()=>[...document.querySelectorAll('div')].filter(d=>/^\d{1,3}%$/.test((d.textContent||'').trim())&&!d.children.length).map(d=>d.textContent.trim()));
console.log('start', await real(), await shown());
for (let i=0;i<4;i++){
  await p.locator('button[title="Przybliż"]').first().click();
  await p.waitForTimeout(800);
  console.log('po przybliz #'+(i+1), await real(), await shown());
}
for (let i=0;i<3;i++){
  await p.locator('button[title="Oddal"]').first().click();
  await p.waitForTimeout(800);
  console.log('po oddal #'+(i+1), await real(), await shown());
}
console.log('minZoom/maxZoom?', await p.evaluate(()=>{const w=document.querySelector('.react-flow');return w?w.className:'brak';}));
await b.close();
