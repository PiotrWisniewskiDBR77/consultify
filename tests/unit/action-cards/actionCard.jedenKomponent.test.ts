/** @vitest-environment node */
/**
 * Bramki statyczne kręgosłupa karty działania (P9/DEC-397).
 *
 * SKAN PRZEZ `node:fs`, NIE PRZEZ `rg` (naprawa 06.09): poprzednia wersja
 * wołała `spawnSync('rg', …)` i sprawdzała `status`. Na maszynie bez
 * ripgrepa w PATH `spawnSync` zwraca `status: null` — `expect(status).toBe(1)`
 * padało, a `expect(status).toBe(0)` też, więc test mówił „naruszenie", gdy
 * naruszenia nie było. Ten sam kontrakt realizuje teraz rekurencyjny odczyt
 * katalogu i wyrażenie regularne: zero zależności od binarki, ta sama
 * odpowiedź na te same pliki.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

const ROZSZERZENIA = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const POMIJANE_KATALOGI = new Set(['node_modules', 'dist', 'build', '.git', 'coverage']);

/** Wszystkie pliki źródłowe pod `katalog` (rekurencyjnie), ścieżki względne od `root`. */
function pliki(katalog: string, opcje: { pomijajTesty?: boolean } = {}): string[] {
  const bezwzgledny = resolve(root, katalog);
  let wpisy: string[];
  try {
    wpisy = readdirSync(bezwzgledny);
  } catch {
    return [];
  }
  const wynik: string[] = [];
  for (const wpis of wpisy) {
    const sciezka = join(bezwzgledny, wpis);
    let info;
    try {
      info = statSync(sciezka);
    } catch {
      continue;
    }
    if (info.isDirectory()) {
      if (POMIJANE_KATALOGI.has(wpis)) continue;
      if (opcje.pomijajTesty && (wpis === '__tests__' || wpis === '__mocks__')) continue;
      wynik.push(...pliki(sciezka, opcje));
      continue;
    }
    if (!ROZSZERZENIA.some((ext) => wpis.endsWith(ext))) continue;
    wynik.push(sciezka.slice(resolve(root).length + 1));
  }
  return wynik;
}

/** Ścieżki plików (względne), w których wzorzec występuje — posortowane. */
function trafienia(
  katalogi: string[],
  wzorzec: RegExp,
  opcje: { pomijajTesty?: boolean; wyklucz?: (sciezka: string) => boolean } = {}
): string[] {
  const znalezione = new Set<string>();
  for (const katalog of katalogi) {
    for (const plik of pliki(katalog, { pomijajTesty: opcje.pomijajTesty })) {
      if (opcje.wyklucz?.(plik)) continue;
      const tresc = readFileSync(resolve(root, plik), 'utf8');
      if (new RegExp(wzorzec.source, wzorzec.flags.replace('g', '')).test(tresc)) {
        znalezione.add(plik);
      }
    }
  }
  return [...znalezione].sort();
}

/** Liczba WYSTĄPIEŃ wzorca (nie plików) — odpowiednik `rg -n | wc -l`. */
function wystapienia(
  katalogi: string[],
  wzorzec: RegExp,
  opcje: { pomijajTesty?: boolean; wyklucz?: (sciezka: string) => boolean } = {}
): number {
  let suma = 0;
  const globalny = new RegExp(wzorzec.source, wzorzec.flags.includes('g') ? wzorzec.flags : `${wzorzec.flags}g`);
  for (const katalog of katalogi) {
    for (const plik of pliki(katalog, { pomijajTesty: opcje.pomijajTesty })) {
      if (opcje.wyklucz?.(plik)) continue;
      const tresc = readFileSync(resolve(root, plik), 'utf8');
      suma += (tresc.match(globalny) ?? []).length;
    }
  }
  return suma;
}

describe('P9 action-card spine static gates', () => {
  it('rejestruje wspólny komponent jako ósmą kartę N', () => {
    const registry = readFileSync(resolve(root, 'src/components/standard/registry.ts'), 'utf8');
    expect(registry).toContain("| 'action'");
    expect(registry).toContain("komponent: 'src/components/standard/ActionCard.tsx'");
  });

  it('utrzymuje rejestr action zgodny z pięcioma produkcyjnymi wołaczami', () => {
    const registry = readFileSync(resolve(root, 'src/components/standard/registry.ts'), 'utf8');
    const wolacze = trafienia(
      [
        'src/components/ResultsVNext',
        'src/components/Execution',
        'src/components/Audit',
        'src/components/Finance',
        'src/components/MyWork',
      ],
      /<ActionCard/,
      { pomijajTesty: true }
    );
    expect(wolacze.length).toBeGreaterThan(0);
    const katalogi = new Set(wolacze.map((plik) => plik.split(sep)[2]));
    expect([...katalogi].sort()).toEqual(['Audit', 'Execution', 'Finance', 'MyWork', 'ResultsVNext']);
    expect(registry).toContain("statusMigracji: 'zmigrowana'");
  });

  it('usuwa trzy historyczne implementacje karty działania', () => {
    expect(
      trafienia(['src'], /ChatActionCard|DefinitionRemediationQueue|ActionItemsPanel/, {
        pomijajTesty: true,
      })
    ).toEqual([]);
  });

  it('nie pozwala powierzchniom budować własnego markup karty działania', () => {
    expect(
      trafienia(['src'], /<article[^>]*data-action-card/, {
        pomijajTesty: true,
        wyklucz: (plik) => plik.startsWith(`src${sep}components${sep}standard${sep}`),
      })
    ).toEqual([]);
  });

  it('nie zapisuje canonical_inbox_items poza inboxService', () => {
    expect(
      trafienia(['server/src'], /INSERT INTO canonical_inbox_items/, {
        pomijajTesty: true,
        wyklucz: (plik) => plik.endsWith(`${sep}inboxService.ts`),
      })
    ).toEqual([]);
  });

  it('renderuje klikalny InitiativeSourceLink we wszystkich miejscach rodowodu', () => {
    expect(wystapienia(['src'], /<InitiativeSourceLink/, { pomijajTesty: true })).toBe(10);
    expect(
      trafienia(['src'], /getSourceDisplayLabel/, {
        pomijajTesty: true,
        wyklucz: (plik) => plik.endsWith(`${sep}InitiativeSourceLink.tsx`),
      })
    ).toEqual([]);
  });

  it('łączy K1 i K2 z kanonicznymi wołaczami oraz blokuje drugi klik K1', () => {
    const meeting = readFileSync(resolve(root, 'src/components/Meeting/MeetingObjectPage.tsx'), 'utf8');
    expect(meeting).toContain('/action-items/${actionIndex}/task');
    expect(meeting).toContain('if (actionItemTaskLocks.current.has(key) || actionItemTasks[key]) return');
    expect(meeting).toContain('disabled={Boolean(taskState)}');
    const initiative = readFileSync(resolve(root, 'src/components/Initiatives/InitiativeDocumentView.tsx'), 'utf8');
    expect(initiative).toContain('requestHandoffAcceptance(initiativeId');
    expect(initiative).toContain("id: 'request-handoff-acceptance'");
    const inbox = readFileSync(resolve(root, 'src/components/MyWork/InboxContent.tsx'), 'utf8');
    expect(inbox).toContain('<HandoffAcceptanceQueue />');
  });

  it('migracja jest addytywna i zachowuje identyfikatory tekstowe SSOT', () => {
    const migration = readFileSync(resolve(root, 'server/migrations/20261105_action_cards_spine.sql'), 'utf8');
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(migration).toContain('organization_id TEXT NOT NULL');
    expect(migration).toContain('owner_user_id TEXT NOT NULL');
  });
});
