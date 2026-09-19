/**
 * @vitest-environment node
 *
 * W77 ratchet for the seven J-małe modules. The expanded English detector made
 * the old zero threshold dishonest: it now exposes real untranslated UI. These
 * are ceilings, so every fix can lower them while any new hit fails the gate.
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { wartoscTechniczna, wykryjAngielski } from '../pomiar-jezyka.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PROGI = {
  '13 Organization': { K1def: 0, K4pl: 0, K4en: 2, K7: 0 },
  '08 Results': { K1def: 0, K4pl: 0, K4en: 65, K7: 0 },
  '12 Meeting': { K1def: 0, K4pl: 0, K4en: 0, K7: 0 },
  '03 Interview': { K1def: 0, K4pl: 0, K4en: 19, K7: 0 },
  '11 Audits': { K1def: 0, K4pl: 0, K4en: 4, K7: 0 },
  '06 Initiatives': { K1def: 1, K4pl: 0, K4en: 128, K7: 0 },
  // D-118: 138→137 — paczka 772ac6c601 (DEC-461 „localize Polish execution
  // report") owinęła twardy EN „AI Executive Readout" w
  // tr('execution.report.section.aiReadout', …) w
  // src/components/Execution/ReportDocumentView.tsx:1979 (klucz sparowany en/pl:
  // en translation.json:19421, pl:18683). K4en liczy EN POZA t(), więc uczciwie
  // spadł o 1; baseline.json odświeżony do 137 w bd7ff49431. Zmierzono: jedyny
  // ubytek w liście trafień Execution między e75274e6fb (138) a tipem (137).
  '07 Execution': { K1def: 0, K4pl: 0, K4en: 137, K7: 0 },
};
const KATEGORIE = ['K1def', 'K4pl', 'K4en', 'K7'];

function zmierz() {
  const surowy = execFileSync(
    process.execPath,
    [path.join(ROOT, 'scripts/i18n/pomiar-jezyka.mjs'), '--json'],
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  return JSON.parse(surowy.slice(surowy.indexOf('{')));
}

describe('W77 / J-małe — uczciwy ratchet rozszerzonego miernika', () => {
  const wynik = zmierz();
  const baseline = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'docs/program/JEZYK_EN_PL_20260908/baseline.json'), 'utf8')
  );
  const receipt = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, 'docs/program/JEZYK_EN_PL_20260908/K1_FIX_W77_JMALE_SAMPLE.json'),
      'utf8'
    )
  );

  it.each(Object.entries(PROGI))('%s nie przekracza jawnych progów', (modul, progi) => {
    for (const k of KATEGORIE) {
      expect(wynik.moduly[modul][k], `${modul}.${k}`).toBeLessThanOrEqual(progi[k]);
      expect(baseline.moduly[modul][k], `baseline ${modul}.${k}`).toBe(progi[k]);
    }
  });

  it.each(Object.entries(PROGI))('%s ma sprawdzalną próbkę do 10 realnych trafień K4en', (modul, progi) => {
    const sample = receipt.samples[modul];
    expect(receipt.moduleRationales[modul]).toMatch(/\S.{15,}/);
    expect(sample).toHaveLength(Math.min(10, progi.K4en));
    for (const hit of sample) {
      const separator = hit.gdzie.lastIndexOf(':');
      const relativePath = hit.gdzie.slice(0, separator);
      const line = Number(hit.gdzie.slice(separator + 1));
      const sourceLines = fs.readFileSync(path.join(ROOT, relativePath), 'utf8').split('\n');
      // K4en points at the opening JSX tag; visible text may be on the next line.
      const sourceWindow = sourceLines.slice(line - 1, line + 3).join('\n');
      expect(sourceWindow, hit.gdzie).toContain(hit.tekst);
      expect(hit.classification).toBe('real-en-ui');
      expect(wartoscTechniczna(hit.tekst), `technical false positive: ${hit.gdzie}`).toBe(false);
      expect(wykryjAngielski(hit.tekst), `missing EN evidence: ${hit.gdzie}`).toBeTruthy();
    }
  });
});
