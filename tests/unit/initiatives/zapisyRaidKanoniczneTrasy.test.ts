/**
 * Bezpiecznik: front NIE MOZE wolac wycofanych tras zapisu RAID.
 *
 * POWOD: 07.09 wlasciciel wycofal odbior Inicjatyw, bo dodanie/edycja/usuniecie
 * ryzyka nie robily nic — komponenty wolaly `/initiatives/:id/raid*`, a bramka
 * `requireCanonicalInitiativeExecutionWriter` odpowiada na te trasy 409.
 *
 * MUTACJA (sprawdzona): przywroc w dowolnym z tych plikow
 * `Api.post('/initiatives/${id}/raid', ...)` albo `.catch(() => {})` na sciezce
 * zapisu — test staje sie czerwony.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

/** Pliki, ktore realnie zapisuja pozycje RAID inicjatywy. */
const RAID_WRITERS = [
  'src/components/Initiatives/sections/RaidSection.tsx',
  'src/components/Initiatives/InitiativeDocumentView.tsx',
  'src/components/Initiatives/sections/GateReadinessSection.tsx',
];

const read = (relative: string): string => readFileSync(join(ROOT, relative), 'utf8');

/** Wycofane zapisy legacy — POST/PATCH/PUT/DELETE na `/initiatives/:id/raid`. */
const LEGACY_RAID_WRITE = /Api\.(post|put|patch|delete)\(\s*`\/initiatives\/\$\{[^}]+\}\/raid/;

describe('zapisy RAID inicjatywy ida wylacznie kanoniczna trasa (26A)', () => {
  it.each(RAID_WRITERS)('%s nie wola wycofanej trasy legacy', (relative) => {
    expect(LEGACY_RAID_WRITE.test(read(relative))).toBe(false);
  });

  it.each(RAID_WRITERS)('%s uzywa kanonicznego klienta raidWrites', (relative) => {
    expect(read(relative)).toContain("@/services/initiatives-execution/raidWrites");
  });

  it('kanoniczny klient uderza w Runtime-v1, a nie w powierzchnie legacy', () => {
    const client = read('src/services/initiatives-execution/raidWrites.ts');
    expect(client).toContain("'/api/initiatives/runtime-v1/initiatives'");
    expect(client).toMatch(/raid-items/);
  });

  it('zaden zapis RAID nie polyka awarii po cichu', () => {
    // `.catch(() => {})` / `catch {}` na sciezce zapisu = uzytkownik klika i nic
    // sie nie dzieje, bez komunikatu. To wlasnie zglosil wlasciciel.
    const swallow = /\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/;
    for (const relative of [...RAID_WRITERS, 'src/services/initiatives-execution/raidWrites.ts']) {
      const source = read(relative);
      const raidBlocks = source
        .split('\n')
        // Komentarze opisuja WYCOFANY wzorzec — nie sa kodem, ktory polyka.
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .filter((line) => /raid/i.test(line) || swallow.test(line));
      expect(
        raidBlocks.filter((line) => swallow.test(line)),
        `polykacz bledu w ${relative}`
      ).toEqual([]);
    }
  });

  /**
   * DEC-453: po zdjeciu bramki 26A ze sciezek bez kanonicznego nastepcy te
   * zapisy znowu dochodza do serwera. Nie moga wracac do stanu, w ktorym
   * niepowodzenie znika bez sladu — wiersz na ekranie zmieniony, serwer nie.
   *
   * MUTACJA: zamien `toast.error(...)` w ktoryms z tych catchow na pusty
   * komentarz — test staje sie czerwony.
   */
  it.each([
    ['src/components/Initiatives/InitiativeDocumentView.tsx', '/resources/${id}`, data)'],
    ['src/components/Initiatives/InitiativeDocumentView.tsx', '/resources/${id}`)'],
    ['src/components/Initiatives/InitiativeDocumentView.tsx', '/budget-items/${id}`, data)'],
    ['src/components/Initiatives/InitiativeDocumentView.tsx', '/budget-items/${id}`)'],
    ['src/components/Initiatives/sections/ResourcesSection.tsx', '/resources/ai-apply-log`'],
  ])('%s — zapis %s konczy sie komunikatem, nie cisza', (relative, fragment) => {
    const linie = read(relative).split('\n');
    const indeks = linie.findIndex((line) => line.includes(fragment));
    expect(indeks, `nie znalazlem wywolania ${fragment}`).toBeGreaterThan(-1);
    // Bierzemy WYLACZNIE cialo najblizszego `catch` po tym wywolaniu — inaczej
    // `toast.success` z bloku `try` falszywie zazielenilby cichy catch.
    const poczatekCatch = linie.findIndex(
      (line, i) => i >= indeks && /\}\s*catch\b/.test(line)
    );
    expect(poczatekCatch, `brak catch po ${fragment}`).toBeGreaterThan(-1);
    const cialo = [];
    for (let i = poczatekCatch + 1; i < linie.length && i < poczatekCatch + 20; i += 1) {
      if (/^\s{0,8}\}/.test(linie[i])) break;
      cialo.push(linie[i]);
    }
    expect(cialo.join('\n'), `cichy catch przy ${fragment}`).toMatch(/toast[.(]/);
  });

  it('kazda odmowa zapisu ma komunikat po polsku, bez kodow technicznych', () => {
    const client = read('src/services/initiatives-execution/raidWrites.ts');
    for (const phrase of [
      'Sesja wygasła',
      'Odśwież stronę',
      'Sprawdź połączenie',
      'spróbuj ponownie',
    ]) {
      expect(client, `brak komunikatu: ${phrase}`).toContain(phrase);
    }
    // Zadnych kodow/statusow na ekranie.
    expect(client).not.toMatch(/EXECUTION_RUNTIME_V1_WRITE_REQUIRED'[^)]*message/);
  });
});
