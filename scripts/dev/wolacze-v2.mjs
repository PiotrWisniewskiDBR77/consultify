/**
 * Pomiar wołaczy v2 (tor funkcji, 2026-09-02) — poprawka TRZECIEJ ślepoty.
 *
 * v1 (`grafika-wolacze.mjs`) łapie `lazy(...)` i `React.lazy(...)`, ale NIE łapie
 * `lazyWithRetry(...)` — własnej otoczki repo używanej w `AppRoutes.tsx`. Skutek:
 * `CriterionWorkspaceGate` był meldowany jako "BRAK WOŁACZA", choć jest montowany
 * pod `/audit-programs/:programId/criteria/:criterionId` (AppRoutes.tsx:1703) przez
 * alias `<CriterionWorkspace>`. To ta sama klasa błędu co dwie poprzednie.
 *
 * v2 dodatkowo: (1) dowolna otoczka *lazy* (lazyWithRetry, lazyNamed, ...),
 * (2) import domyślny bez `.then(m => ...)`, (3) alias przez zwykły import
 * `import X from '...'` + użycie `<X`, (4) re-eksport przez index konsumowany dalej.
 */
import fs from 'fs';
import path from 'path';

const KOMP = process.argv.slice(2).length ? process.argv.slice(2) : [
 'AIConsultantPanel','UnifiedCreateLauncher','InitiativesTable','AssessmentReportView',
 'AssessmentPresentationView','ReportsTable','ResultsVNextLegacyArchivePanel','AuditsHub',
 'CriterionWorkspaceGate','TeresaUnavailableNotice'];

const pliki = [];
(function chodz(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') chodz(p); }
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) pliki.push(p);
  }
})('src');
const tresc = new Map(pliki.map((p) => [p, fs.readFileSync(p, 'utf8')]));
console.log('przeskanowanych plikow produkcji (bez testow):', pliki.length, '\n');

for (const k of KOMP) {
  const trafienia = [];
  for (const [p, s] of tresc) {
    if (p.endsWith(`/${k}.tsx`) || p.endsWith(`/${k}.ts`)) continue;
    if (new RegExp(`<${k}[\\s/>]`).test(s)) trafienia.push(`JSX wprost: ${p}`);
    // dowolna otoczka zawierajaca "lazy" (lazy, React.lazy, lazyWithRetry, ...)
    for (const m of s.matchAll(/const\s+(\w+)\s*=\s*(?:React\.)?(\w*[lL]azy\w*)\(([\s\S]{0,500}?)\)\s*;/g)) {
      const [, alias, otoczka, ciało] = m;
      const trafia = new RegExp(`default:\\s*m\\.${k}\\b`).test(ciało)
        || new RegExp(`import\\(['"][^'"]*/${k}['"]\\)`).test(ciało)
        || new RegExp(`\\bm\\.${k}\\b`).test(ciało);
      if (trafia && new RegExp(`<${alias}[\\s/>]`).test(s)) trafienia.push(`${otoczka} jako <${alias}>: ${p}`);
    }
    // zwykly import z aliasem: import { X as Y } / import Y from '.../X'
    for (const m of s.matchAll(new RegExp(`import\\s+(\\w+)\\s+from\\s+['"][^'"]*/${k}['"]`, 'g'))) {
      if (new RegExp(`<${m[1]}[\\s/>]`).test(s)) trafienia.push(`import domyslny jako <${m[1]}>: ${p}`);
    }
    for (const m of s.matchAll(new RegExp(`\\b${k}\\s+as\\s+(\\w+)\\b`, 'g'))) {
      if (new RegExp(`<${m[1]}[\\s/>]`).test(s)) trafienia.push(`alias <${m[1]}>: ${p}`);
    }
  }
  const u = [...new Set(trafienia)];
  console.log(`${k.padEnd(32)} ${u.length ? 'WOŁACZ (' + u.length + ')' : 'BRAK WOŁACZA'}`);
  for (const t of u.slice(0, 3)) console.log('        ' + t);
}
