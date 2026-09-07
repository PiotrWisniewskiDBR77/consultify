// Dowod dwoch poprawek po odbiorze nocnym 08.09: pigulka „Wstrzymana” w rejestrze Inicjatyw
// (onHold z wiersza legacy) oraz „Nowa analiza z tego planu” otwierajaca formularz.
import { chromium } from 'playwright';
import fs from 'node:fs';
const S='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad';
const OUT='/private/tmp/wt-fable-inicjatywy/evidence/odbior-noc-0809/inicjatywy';
const BASE='http://localhost:3184';
const b=await chromium.launch(); const c=await b.newContext({viewport:{width:1440,height:900},colorScheme:'light',storageState:`${S}/auth-audyt.json`,locale:'pl-PL'});
const p=await c.newPage(); const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,200))});
async function zrzut(n,opis,extra={}){await p.screenshot({path:`${OUT}/${n}.png`});fs.writeFileSync(`${OUT}/${n}.png.json`,JSON.stringify({nazwa:n,opis,url:p.url(),bledyKonsoli:[...errs],czas:new Date().toISOString(),...extra},null,2));console.log('ZRZUT',n,JSON.stringify(extra));}
async function pomin(){const x=p.getByText('Pomiń na razie',{exact:true}); if(await x.first().isVisible({timeout:1500}).catch(()=>false)){await x.first().click({force:true});await p.waitForTimeout(400);}}
await p.goto(`${BASE}/`,{waitUntil:'domcontentloaded'});
await p.evaluate(()=>{const K='consultify-storage';const r=localStorage.getItem(K);const o=r?JSON.parse(r):{state:{},version:0};o.state={...(o.state||{}),theme:'light'};localStorage.setItem(K,JSON.stringify(o));});
// 1. Rejestr inicjatyw — pigulka Wstrzymana
await p.goto(`${BASE}/initiatives`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000); await pomin();
await p.waitForSelector('table tbody tr',{timeout:20000});
const rows=await p.locator('table tbody tr').count();
const hold=await p.locator('table tbody tr').filter({hasText:'Wstrzymana'}).count();
if(hold>0){ await p.locator('table tbody tr').filter({hasText:'Wstrzymana'}).first().scrollIntoViewIfNeeded(); }
await zrzut('09-rejestr-pigulka-wstrzymana','Rejestr Inicjatyw po poprawce onHold: wiersze on_hold maja pigulke „Wstrzymana”.',{wierszy:rows,wierszeWstrzymana:hold});
// 2. Plan -> karta -> Sekcje -> Obciazenie rol -> Nowa analiza z tego planu -> formularz
await p.goto(`${BASE}/initiatives?tab=plan`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500); await pomin();
await p.waitForSelector('table tbody tr',{timeout:20000});
const plan=p.locator('table tbody tr').first(); const planNazwa=(await plan.innerText()).split('\n')[0];
await plan.dblclick(); await p.waitForTimeout(2500);
await p.getByRole('button',{name:/^Sekcje/}).click(); await p.waitForTimeout(400);
await p.getByRole('menuitem',{name:/Obciążenie ról/}).click(); await p.waitForTimeout(800);
const btn=p.getByRole('button',{name:/Nowa analiza z tego planu/});
const maBtn=await btn.count();
if(maBtn){ await btn.first().click(); }
await p.getByText('Wczytywanie rejestru obciążenia').first().waitFor({state:'hidden',timeout:90000}).catch(()=>{});
const form=p.locator('input[aria-label="Capacity analysis name"]');
const formOk=await form.first().isVisible({timeout:10000}).catch(()=>false);
const wybranyPlan=formOk?await p.locator('select[aria-label="Capacity source plan"]').inputValue().catch(()=>''):'';
await zrzut('C02b-nowa-analiza-formularz','Po „Nowa analiza z tego planu” z karty planu: zakladka Obciazenie z otwartym formularzem nowej analizy (przed poprawka: cicho lista).',{planNazwa,przyciskJest:maBtn,formularzWidoczny:formOk,planZrodlowy:wybranyPlan});
// 3. powrot na zakladke bez ponownego otwarcia formularza
await p.getByRole('button',{name:/^Plan$/}).first().click().catch(()=>{}); await p.waitForTimeout(800);
await p.goto(`${BASE}/initiatives?tab=capacity`,{waitUntil:'domcontentloaded'}); await p.waitForTimeout(3000);
const formPoPowrocie=await form.first().isVisible({timeout:1500}).catch(()=>false);
console.log(JSON.stringify({formPoPowrocie}));
await b.close();
