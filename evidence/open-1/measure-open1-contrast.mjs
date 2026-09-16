import { chromium } from 'playwright';
import fs from 'node:fs';
const base='http://127.0.0.1:4214/';
const parse=s=>{const m=s.match(/rgba?\(([^)]+)\)/); if(!m)return null; const x=m[1].split(/[, ]+/).filter(Boolean).map(Number); return {r:x[0],g:x[1],b:x[2],a:x[3]??1};};
const over=(fg,bg)=>{const a=fg.a+bg.a*(1-fg.a); return a?{r:(fg.r*fg.a+bg.r*bg.a*(1-fg.a))/a,g:(fg.g*fg.a+bg.g*bg.a*(1-fg.a))/a,b:(fg.b*fg.a+bg.b*bg.a*(1-fg.a))/a,a}:bg;};
const lum=c=>{const q=[c.r,c.g,c.b].map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*q[0]+.7152*q[1]+.0722*q[2];};
const ratio=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
async function metric(loc,label,theme){const node=loc.first(); return await node.evaluate((el,{label,theme})=>{function parse(s){const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return null;const x=m[1].split(/[, ]+/).filter(Boolean).map(Number);return{r:x[0],g:x[1],b:x[2],a:x[3]??1}} function over(fg,bg){const a=fg.a+bg.a*(1-fg.a);return a?{r:(fg.r*fg.a+bg.r*bg.a*(1-fg.a))/a,g:(fg.g*fg.a+bg.g*bg.a*(1-fg.a))/a,b:(fg.b*fg.a+bg.b*bg.a*(1-fg.a))/a,a}:bg} function lum(c){const q=[c.r,c.g,c.b].map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*q[0]+.7152*q[1]+.0722*q[2]} let target=el.closest('button,[role="button"]')||el;let bg={r:255,g:255,b:255,a:1};const chain=[];for(let n=target;n;n=n.parentElement)chain.push(n);for(let i=chain.length-1;i>=0;i--){const c=parse(getComputedStyle(chain[i]).backgroundColor);if(c&&c.a)bg=over(c,bg)} const fg=parse(getComputedStyle(target).color);const cr=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05);const cls=String(target.className||'');const hueBg=/(?:^|\s)bg-(?:c-)?(danger|warning|success|red|amber|green)(?:-|\/|\s|$)/.exec(cls)?.[1]||null;const hueText=/(?:^|\s)text-(?:c-)?(danger|warning|success|red|amber|green)(?:-|\/|\s|$)/.exec(cls)?.[1]||null;return{label,theme,text:(target.textContent||'').trim().replace(/\s+/g,' '),foreground:getComputedStyle(target).color,background:`rgb(${Math.round(bg.r)}, ${Math.round(bg.g)}, ${Math.round(bg.b)})`,ratio:Number(cr.toFixed(2)),sameHueBackgroundAndText:Boolean(hueBg&&hueText&&hueBg===hueText),className:cls}}, {label,theme});}
const browser=await chromium.launch({headless:true}); const out=[];
for(const theme of ['light','dark']){const p=await browser.newPage({viewport:{width:1440,height:900}});
 const go=async u=>{await p.goto(base+u,{waitUntil:'domcontentloaded',timeout:30000});await p.waitForTimeout(2500)};
 await go(`?screen=assessment-five-surfaces&tab=processes&lang=en&theme=${theme}`);
 out.push(await metric(p.getByText('Draft',{exact:true}), 'Assessment status filter: Draft',theme));
 out.push(await metric(p.getByText('Approved',{exact:true}).first(), 'Assessment status filter: Approved',theme));
 await go(`?screen=assessment-five-surfaces&tab=outputs&lang=en&theme=${theme}`); await p.getByText('Session record',{exact:true}).first().evaluate(e=>e.click()); await p.waitForTimeout(300);
 out.push(await metric(p.getByText('Open session',{exact:true}).last(),'Assessment CTA: Open session',theme));
 await go(`?screen=k5-preview-work&lang=en&theme=${theme}`); await p.getByText('Risk management',{exact:true}).evaluate(e=>e.click());await p.waitForTimeout(500);await p.getByText('Choose the canonical demand forecast source',{exact:true}).evaluate(e=>e.click());await p.waitForTimeout(300);
 out.push(await metric(p.getByText('Open',{exact:true}).last(),'Execution Decision CTA: Open',theme));
 await go(`?screen=k5-preview-work&lang=en&theme=${theme}`); await p.getByText('Close the security audit',{exact:true}).evaluate(e=>e.click());await p.waitForTimeout(300);
 out.push(await metric(p.getByText('Open',{exact:true}).last(),'Execution Work CTA: Open',theme));
 await p.close();}
await browser.close();
const min=Math.min(...out.map(x=>x.ratio)); const verdict=min>=4.5&&!out.some(x=>x.sameHueBackgroundAndText)?'PASS':'FAIL'; const result={measuredAt:new Date().toISOString(),standard:'WCAG 2.x normal text >= 4.5:1',verdict,minRatio:min,semanticRule:'No measured control combines same semantic hue background and text.',measurements:out}; fs.writeFileSync('docs/program/PROGRAM_NAPRAWCZY_20260905/INTEGRATOR_MVP_20260912/OPEN_1_EVIDENCE_20260916/CONTRAST_RECEIPT.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(verdict!=='PASS')process.exit(1);
