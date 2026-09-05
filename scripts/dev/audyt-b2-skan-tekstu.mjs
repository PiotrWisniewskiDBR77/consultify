#!/usr/bin/env node
// Audyt B2 — skan tekstu DOM (.png.json) pod katem listy kontrolnej (ang. slowa, klucze i18n, UUID, Invalid Date).
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2] || 'evidence/audyt-mvp-20260906/B2';
const enWords = ["Loading","Search","Save","Cancel","Delete","Edit","New","Unknown","Error","Draft","Pending","Submit","Filter","Sort","Export","Import","Owner","Created","Updated","Name","Description","Type","Category","Priority","Actions","Details","Summary","Overview","Report","Comments","History","Members","Users","Role","Team","Tasks","Task","Notes","Preview","Publish","Archive","Retry","Refresh","undefined","null","NaN"];
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png.json'));
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const text = j.tekst || '';
  const hits = {};
  for (const w of enWords) {
    const re = new RegExp('\\b' + w + '\\b', 'g');
    const m = text.match(re);
    if (m) hits[w] = m.length;
  }
  const i18nKeyMatches = text.match(/\b[a-z][a-zA-Z]*\.[a-zA-Z]+\.[a-zA-Z.]+\b/g) || [];
  const uuidMatches = text.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi) || [];
  const invalidDate = text.match(/Invalid Date/g) || [];
  const objObject = text.match(/\[object Object\]/g) || [];
  const dashOnly = text.match(/(^|\n)\s*0\s*(\n|$)/g) || [];
  if (Object.keys(hits).length || i18nKeyMatches.length || uuidMatches.length || invalidDate.length || objObject.length) {
    console.log('=== ' + f + ' (url=' + j.url + ') ===');
    if (Object.keys(hits).length) console.log('  EN slowa:', JSON.stringify(hits));
    if (i18nKeyMatches.length) console.log('  mozliwe klucze i18n:', JSON.stringify([...new Set(i18nKeyMatches)].slice(0, 30)));
    if (uuidMatches.length) console.log('  UUID:', JSON.stringify([...new Set(uuidMatches)]));
    if (invalidDate.length) console.log('  Invalid Date x', invalidDate.length);
    if (objObject.length) console.log('  [object Object] x', objObject.length);
  }
}
