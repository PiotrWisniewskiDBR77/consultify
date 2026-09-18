import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import fs from 'node:fs';
const dir='/Users/piotrwisniewski/Developer/cto-codex/a-air1b-v2-w244';
const b=await chromium.launch({headless:true}), result=[];
const luminance=(rgb)=>rgb.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);
function contrast(file,box){const png=PNG.sync.read(fs.readFileSync(file)),colors=new Map();for(let y=Math.ceil(box.y);y<Math.floor(box.y+box.height);y++)for(let x=Math.ceil(box.x);x<Math.floor(box.x+box.width);x++){const i=(y*png.width+x)*4,k=Array.from(png.data.subarray(i,i+3)).join(',');colors.set(k,(colors.get(k)||0)+1)}const palette=[...colors].sort((a,b)=>b[1]-a[1]);const bg=palette[0][0].split(',').map(Number),l=luminance(bg);const glyph=palette.filter(([,n])=>n>=3).map(([rgb,n])=>{const z=luminance(rgb.split(',').map(Number));return{rgb,n,ratio:(Math.max(l,z)+.05)/(Math.min(l,z)+.05)}}).sort((a,b)=>b.ratio-a.ratio)[0];return {background:bg,glyph,method:'PNG dominant background versus strongest glyph color present in at least 3 pixels'};}
try {
const page=await b.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(String(e)));
await page.route('**/*',route=>/^https?:\/\/(127\.0\.0\.1|localhost)/.test(route.request().url())?route.continue():route.abort());
for(const theme of ['light','dark']){
 await page.goto(`http://127.0.0.1:3228/w244-air.html?theme=${theme}&tab=managed&lang=en&uwagi=0`);
 await page.locator('[data-ai-review-badge]').last().waitFor();
 const badges=await page.locator('[data-ai-review-badge]').allTextContents();
 if(!badges.join('|').includes('90')||!badges.join('|').includes('70')||!badges.join('|').includes('Blocked'))throw Error('real scores missing');
 const boxes=await page.locator('[data-ai-review-badge] > span').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,x:r.x,y:r.y,width:r.width,height:r.height}}));
 const file=`${dir}/interview-${theme}.png`;await page.screenshot({path:file});
 const pixels=boxes.map(box=>({...box,...contrast(file,box)}));
 const geometry=await page.locator('[data-ai-review-badge]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),c=e.closest('td').getBoundingClientRect();return{text:e.textContent,insideCell:r.left>=c.left&&r.right<=c.right,width:r.width,cellWidth:c.width}}));
 if(geometry.some(g=>!g.insideCell))throw Error('badge outside cell');
 result.push({theme,badges,geometry,pixels});
 await page.goto(`http://127.0.0.1:3228/w244-air.html?theme=${theme}&tab=sessions&lang=en&uwagi=0`);
 await page.locator('tbody tr').first().click();
 await page.locator('[data-ai-review-panel="interview"]').waitFor();
 await page.waitForTimeout(600);
 await page.screenshot({path:`${dir}/preview-${theme}.png`});
}
fs.writeFileSync(`${dir}/browser-proof.json`,JSON.stringify({result,errors},null,2));
console.log(JSON.stringify({themes:result.map(r=>({theme:r.theme,geometry:r.geometry,contrast:r.pixels.map(p=>({text:p.text,ratio:p.glyph.ratio}))})),errors},null,2));
} finally {await b.close()}
