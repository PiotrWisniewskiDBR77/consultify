import { randomUUID, createHmac } from 'crypto';
import { Pool } from 'pg';
const SECRET = process.env.JWT_SECRET!;
const ORG = 'a3e05d4a-5397-419d-b486-8e44366c0063';
const USER = 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2';
const b64 = (o:any)=>Buffer.from(typeof o==='string'?o:JSON.stringify(o)).toString('base64url');
const now = Math.floor(Date.now()/1000);
const h = b64({alg:'HS256',typ:'JWT'});
const p = b64({ id:USER, email:'piotr.wisniewski@dbr77.com', role:'OWNER', organizationId:ORG, jti:randomUUID(), iat:now, exp:now+3600 });
const sig = createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url');
const token = `${h}.${p}.${sig}`;
const pool = new Pool({ connectionString: process.env.DATABASE_PUBLIC_URL || process.env.DATABASE_URL });
const before = (await pool.query("SELECT count(*)::int c FROM initiatives WHERE organization_id=$1",[ORG])).rows[0].c;
console.log('INIT_BEFORE=', before);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';
const body = { message: 'Stwórz inicjatywę: Transformacja cyfrowa DBR77 — uporządkowanie procesów i integracja danych ERP/CRM.', conversationId: randomUUID(), language: 'pl' };
console.log('POST /api/ai/chat/stream ...');
const ctrl = new AbortController(); const to = setTimeout(()=>ctrl.abort(), 90000);
let sse = ''; let status = 0;
try {
  const r = await fetch('https://demo.consultify.ai/api/ai/chat/stream', { method:'POST', signal: ctrl.signal,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type':'application/json', 'User-Agent': UA, 'Accept':'text/event-stream' }, body: JSON.stringify(body) });
  status = r.status; console.log('HTTP status:', status);
  if (status===200){ const reader = r.body?.getReader(); const dec=new TextDecoder();
    if(reader){ while(true){ const {done,value}=await reader.read(); if(done)break; sse+=dec.decode(value,{stream:true}); if(sse.length>30000)break; } } }
  else { console.log('BODY:', (await r.text()).slice(0,300)); }
} catch(e:any){ console.log('stream ended:', e?.name||e?.message); }
clearTimeout(to);
const types = Array.from(new Set((sse.match(/"type"\s*:\s*"([a-z_]+)"/gi)||[]).map(s=>s.replace(/.*"([a-z_]+)"$/i,'$1'))));
console.log('SSE types:', types.join(', ')||'(none)');
console.log('SSE generate_initiative?', sse.includes('generate_initiative'), '| deliverable-event?', sse.includes('"type":"deliverable"'));
const msgMatch = sse.match(/Created (?:and drafted )?initiative|utworzy|inicjatyw[a-zł]*/i);
console.log('SSE msg-signal:', msgMatch?msgMatch[0]:'(none)');
const after = (await pool.query("SELECT count(*)::int c FROM initiatives WHERE organization_id=$1",[ORG])).rows[0].c;
const newest = (await pool.query("SELECT id,name,status,source FROM initiatives WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 1",[ORG])).rows[0];
console.log('INIT_AFTER=', after, '| DELTA=', after-before);
console.log('NEWEST:', JSON.stringify(newest));
await pool.end(); process.exit(0);
