/**
 * Kto NAPRAWDĘ renderuje komponent w produkcie — czytane z plików, bez powłoki.
 *
 * Powód powstania (2026-09-02): mój pierwszy pomiar grepem za "<Nazwa" przegapił
 * wołaczy schowanych za `const X = lazy(() => import('...').then(m => ({default: m.Nazwa})))`
 * — dokładnie ta sama ślepota, którą miała bramka parytetu. Robotnik złapał mój błąd.
 * Druga wersja, pisana przez grep w execSync, dawała "BRAK" nawet dla komponentu
 * ręcznie potwierdzonego jako renderowany — cytowanie w powłoce zjadało wzorce.
 * Stąd: zero powłoki, czytanie plików wprost.
 */
import fs from 'fs';
import path from 'path';

const KOMP = ['AIConsultantPanel','UnifiedCreateLauncher','InitiativesTable','AssessmentReportView',
 'AssessmentPresentationView','ReportsTable','ResultsVNextLegacyArchivePanel','AuditsHub',
 'CriterionWorkspaceGate','TeresaUnavailableNotice','FinancialModelWorkspace','PredictionWorkspace'];

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
  const jsx = [], przezLazy = [];
  for (const [p, s] of tresc) {
    if (new RegExp(`<${k}[\\s/>]`).test(s)) jsx.push(p);
    // otoczka lazy: const <Alias> = lazy/React.lazy( ... m.<k> ... ) i <Alias> uzyty w tym pliku
    for (const m of s.matchAll(new RegExp(`const\\s+(\\w+)\\s*=\\s*(?:React\\.)?lazy\\(([\\s\\S]{0,400}?)\\)\\s*;`, 'g'))) {
      const [, alias, ciało] = m;
      const trafia = new RegExp(`default:\\s*m\\.${k}\\b`).test(ciało)
        || new RegExp(`import\\(['"][^'"]*/${k}['"]\\)`).test(ciało);
      if (trafia && new RegExp(`<${alias}[\\s/>]`).test(s)) przezLazy.push(`${p} jako <${alias}>`);
    }
  }
  const jsxObce = jsx.filter((p) => !p.endsWith(`${k}.tsx`));
  const w = jsxObce.length ? 'WOŁACZ JSX' : (przezLazy.length ? 'WOŁACZ przez otoczkę lazy' : 'BRAK WOŁACZA');
  console.log(`${k.padEnd(32)} ${w}`);
  for (const p of jsxObce.slice(0, 2)) console.log('        ' + p);
  for (const p of [...new Set(przezLazy)].slice(0, 2)) console.log('        ' + p);
}
