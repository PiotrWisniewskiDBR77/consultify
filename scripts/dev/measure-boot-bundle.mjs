import fs from 'node:fs';
import path from 'node:path';
if (!process.argv[2]) throw new Error('Usage: node measure-boot-bundle.mjs DIST [MAX_BOOT_BYTES]');
const maximum = process.argv[3] == null ? null : Number(process.argv[3]);
if (maximum != null && (!Number.isSafeInteger(maximum) || maximum <= 0)) throw new Error('MAX_BOOT_BYTES must be a positive integer');
const dist = path.resolve(process.argv[2]);
const manifest = JSON.parse(fs.readFileSync(path.join(dist, '.vite/manifest.json'), 'utf8'));
const walk = (keys) => {
  const seen = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    const entry = manifest[key];
    if (!entry) throw new Error(`Missing manifest key ${key}`);
    seen.add(key);
    for (const dependency of entry.imports || []) visit(dependency);
  }
  keys.forEach(visit);
  return [...new Set([...seen].map(key => manifest[key].file))]
    .filter(file => file.endsWith('.js'))
    .map(file => ({file, bytes: fs.statSync(path.join(dist, file)).size}))
    .sort((a,b) => b.bytes-a.bytes);
};
const html = fs.readFileSync(path.join(dist,'index.html'),'utf8');
const htmlPaths = [...html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+\.js)"/g)].map(m => m[1].replace(/^\//,''));
const entries = Object.keys(manifest).filter(k=>htmlPaths.includes(manifest[k].file));
const appKeys = Object.keys(manifest).filter(k => manifest[k].name === 'App' && manifest[k].isDynamicEntry);
if (!entries.length || appKeys.length !== 1 || !entries.some(k => (manifest[k].dynamicImports || []).includes(appKeys[0]))) throw new Error('Unrecognized app entry; inspect HTML/boot before measuring');
const htmlStatic = walk(entries);
// index.tsx unconditionally imports App during normal boot. Include its static
// closure even though Rollup calls this entry dynamic; moving App behind import()
// must never manufacture a smaller launch measurement.
const appBoot = walk([...entries, ...appKeys]);
const chunks = [...new Set(Object.values(manifest).map(x=>x.file))].filter(f=>f.endsWith('.js'))
  .map(file=>({file,bytes:fs.statSync(path.join(dist,file)).size}));
const out = {method:'manifest transitive static closure, HTML roots plus unconditional normal-boot App import',dist,htmlStaticBytes:htmlStatic.reduce((a,x)=>a+x.bytes,0),bootBytes:appBoot.reduce((a,x)=>a+x.bytes,0),bootChunkCount:appBoot.length,boot:appBoot,chunksOver200KB:chunks.filter(x=>x.bytes>200000).sort((a,b)=>b.bytes-a.bytes),totalChunks:chunks.length};
console.log(JSON.stringify(out,null,2));

if (maximum != null && out.bootBytes > maximum) process.exitCode = 1;
