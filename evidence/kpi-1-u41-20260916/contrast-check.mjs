import { chromium } from 'playwright';
const browser=await chromium.launch();
const results=[];
const measure=async(page,locator,label,theme)=>{
 const el=locator.first(); await el.waitFor({state:'visible'});
 const v=await el.evaluate((node,source)=>{
  const parse=(s)=>{const m=s.match(/rgba?\(([^)]+)\)/);if(!m)return [0,0,0,0];const p=m[1].split(',').map(Number);return [p[0],p[1],p[2],p.length>3?p[3]:1]};
  const chain=[]; for(let n=node;n;n=n.parentElement) chain.unshift(n);
  let bg=[255,255,255]; for(const n of chain){const c=parse(getComputedStyle(n).backgroundColor);bg=[c[0]*c[3]+bg[0]*(1-c[3]),c[1]*c[3]+bg[1]*(1-c[3]),c[2]*c[3]+bg[2]*(1-c[3])]}
  const fg=parse(getComputedStyle(node).color).slice(0,3);
  const lum=(c)=>{const x=c.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*x[0]+.7152*x[1]+.0722*x[2]};
  const ratio=(Math.max(lum(fg),lum(bg))+.05)/(Math.min(lum(fg),lum(bg))+.05);
  return {label:source.label,theme:source.theme,ratio:Number(ratio.toFixed(2)),foreground:fg.map(Math.round),background:bg.map(Math.round),text:node.textContent?.trim()};
 },{label,theme});
 results.push(v);
};
for(const theme of ['light','dark']){
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 await page.route('**/*',route=>{const u=route.request().url();if(u.startsWith('http://127.0.0.1')||u.startsWith('data:')||u.startsWith('blob:'))return route.continue();return route.abort()});
 const base='http://127.0.0.1:4214/?screen=results-vnext-kpi-tool&lang=en&theme='+theme;
 await page.goto(base,{waitUntil:'domcontentloaded'}); await page.waitForTimeout(3500);
 await page.getByText('Actions',{exact:true}).first().click();
 await measure(page,page.locator('button.bg-navy-900').filter({hasText:'Suspend'}),'Suspend',theme);
 await measure(page,page.locator('[data-testid="kpi-tool-propose-initiative-id"]'),'Initiative select',theme);
 await page.goto(base+'&kpiStatus=suspended',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(3500);
 await measure(page,page.getByText('Suspended',{exact:true}),'Suspended status',theme);
 await page.goto(base+'&registry=runtime-error',{waitUntil:'domcontentloaded'}); await page.waitForTimeout(3500);
 await page.getByText('Actions',{exact:true}).first().click();
 await measure(page,page.getByRole('alert').locator('p'),'Registry error',theme);
 await measure(page,page.getByRole('button',{name:'Retry'}),'Retry',theme);
 await page.close();
}
await browser.close();
const minimum=Math.min(...results.map(x=>x.ratio));
console.log(JSON.stringify({threshold:4.5,minimum,passed:minimum>=4.5,results},null,2));
if(minimum<4.5)process.exitCode=1;
