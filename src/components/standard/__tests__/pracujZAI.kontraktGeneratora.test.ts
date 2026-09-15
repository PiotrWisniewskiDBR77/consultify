/**
 * F10 / P-J01 — KONTRAKT KLASY: karta, która buduje źródła mostem
 * `zbudujZrodlaPracujZAI`, musi podłączyć OBA (`sekcja` + `dokument`).
 *
 * DLACZEGO TEN TEST ISTNIEJE (zmierzone, nie założone): `InsightViewer`
 * budował oba źródła w `useMemo`, a do `PracujZAI` oddawał tylko `sekcja`.
 * Skutek na żywym stagingu (15.09, Wniosek w trybie Edycja): pozycja
 * „Uzupełnij cały dokument" wyszarzona z powodem `brakGeneratora`
 * („No generator for this card") — mimo że generator stał dwie linie wyżej.
 * Testerka zgłosiła to jako BLOKER (P-J01): „nie mogę wypełnić dokumentu z ai".
 * Trzy karty-rodzeństwo podłączały oba od początku; Wniosek był wyjątkiem,
 * którego nic nie pilnowało.
 *
 * Test jest ŹRÓDŁOWY (skan pliku), bo defekt był w podłączeniu propsa — nie
 * w zachowaniu komponentu. Renderowy test `PracujZAI.test.tsx` przechodził
 * przez cały czas trwania defektu.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const KORZEN = path.resolve(__dirname, '../../..');

/** Pliki, które wołają most — wyliczone ze źródła, nie wpisane z ręki. */
function konsumenciMostu(): string[] {
  const znalezione: string[] = [];
  const idz = (dir: string) => {
    for (const wpis of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, wpis.name);
      if (wpis.isDirectory()) {
        if (wpis.name === '__tests__' || wpis.name === 'node_modules') continue;
        idz(p);
        continue;
      }
      if (!/\.tsx?$/.test(wpis.name)) continue;
      if (p.endsWith(path.join('standard', 'pracujZAIzKartAnalizy.ts'))) continue;
      const src = fs.readFileSync(p, 'utf8');
      if (src.includes('zbudujZrodlaPracujZAI(')) znalezione.push(p);
    }
  };
  idz(KORZEN);
  return znalezione;
}

describe('kontrakt: most `zbudujZrodlaPracujZAI` → PracujZAI', () => {
  const konsumenci = konsumenciMostu();

  it('most ma co najmniej czterech konsumentów (inaczej skan mierzy pustkę)', () => {
    expect(konsumenci.length).toBeGreaterThanOrEqual(4);
  });

  it.each(konsumenci.map((p) => [path.relative(KORZEN, p), p] as const))(
    '%s podłącza OBA źródła (sekcja + dokument)',
    (_nazwa, plik) => {
      const src = fs.readFileSync(plik, 'utf8');
      // Nazwa zmiennej bywa różna — bierzemy tę, do której przypisano most.
      const m = src.match(/const\s+([A-Za-z0-9_$]+)\s*=\s*useMemo\(\s*\(\)\s*=>\s*\n?\s*zbudujZrodlaPracujZAI\(/);
      const zmienna = m ? m[1] : 'zrodlaPracujZAI';
      expect(src).toContain(`uzupelnijSekcje={${zmienna}.sekcja}`);
      expect(src).toContain(`uzupelnijDokument={${zmienna}.dokument}`);
    }
  );
});
