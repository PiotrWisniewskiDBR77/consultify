import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getArtifactPath } from '../../src/utils/artifactLinks';
import { UKRYTE_DEC406 } from '../../src/components/MyWork/mojaPracaWidocznosc';
import { resolveOpenItemRoute } from '../../src/components/MyWork/openItemRouting';
import {
  czyNazwaZastepcza,
  pobierzTytulRekordu,
  sciezkaTytuluRekordu,
  wyciagnijTytul,
} from '../../src/components/MyWork/tytulyKartMenu3';

/**
 * [ODMROZENIE 07_MY_WORK_AGENT DEC-397] [05_INITIATIVES]
 * DEC-406 (CTO, 2026-09-06) — przejście właściciela 06.09, Moja Praca → Zadania.
 *
 * Właściciel kliknął chip „inicjatywa" w Menu 3 Mojej Pracy i trafił na ekran ze
 * stepperem ŹRÓDŁO — PRZEGLĄD — PLANOWANIE — REALIZACJA — KORZYŚCI i przyciskami
 * bramki: „nie wiem, co to za ekran — nie wiem, po co on jest". To był stary
 * warsztat `Initiatives/InitiativeFullView.tsx` (sam oznaczony `@deprecated`),
 * którego JEDYNYM wołaczem w repo był `MyWork/MyWorkHub.tsx`.
 *
 * Kontrakt DEC-406:
 *  (1) KAŻDE wejście do inicjatywy z Mojej Pracy prowadzi do KANONICZNEJ karty
 *      inicjatywy (`InitiativeDocumentView`, trasa `/initiatives?…open=<id>&mode=doc`);
 *  (2) chipy Menu 3 noszą TYTUŁ rekordu i mają „×" do zamknięcia.
 *
 * MUTACJA, która musi dać RED: powrót do warsztatu — czyli
 *  - `UKRYTE_DEC406.warsztatInicjatywy = false`, albo
 *  - `resolveOpenItemRoute('initiative')` znów 'in-context', albo
 *  - renderowanie `<InitiativeFullView>` w Mojej Pracy bez osłony stałej ukrycia.
 */

const KORZEN = process.cwd();
const zrodlo = (wzgledna: string): string =>
  fs.readFileSync(path.join(KORZEN, wzgledna), 'utf8');

describe('DEC-406 — inicjatywa z Mojej Pracy otwiera kanoniczną kartę', () => {
  const hub = zrodlo('src/components/MyWork/MyWorkHub.tsx');

  it('stała ukrycia warsztatu jest JEDNYM miejscem i jest włączona', () => {
    expect(UKRYTE_DEC406.warsztatInicjatywy).toBe(true);
    const widocznosc = zrodlo('src/components/MyWork/mojaPracaWidocznosc.ts');
    expect(widocznosc).toContain('warsztatInicjatywy');
    // Komentarz „do Fali 2" — kod warsztatu zostaje, znika tylko widok.
    expect(widocznosc).toMatch(/Fali 2/);
    expect(fs.existsSync(path.join(KORZEN, 'src/components/Initiatives/InitiativeFullView.tsx'))).toBe(
      true
    );
  });

  it('routing zdarzenia `mywork-open-item` odsyła inicjatywę poza Moją Pracę', () => {
    expect(resolveOpenItemRoute('initiative')).toBe('navigate');
  });

  it('trasa docelowa to kanoniczna karta modułu Inicjatywy (open=<id>&mode=doc)', () => {
    const sciezka = getArtifactPath('initiative', 'abc-123');
    expect(sciezka.startsWith('/initiatives')).toBe(true);
    expect(sciezka).toContain('open=abc-123');
    expect(sciezka).toContain('mode=doc');
  });

  it('MyWorkHub kieruje klik w inicjatywę na kanoniczną trasę (nie do warsztatu)', () => {
    // handleInitiativeClick — wejście z Kalendarza i innych powierzchni Mojej Pracy.
    const uchwyt = hub.slice(
      hub.indexOf('const handleInitiativeClick'),
      hub.indexOf('const handleInitiativeClick') + 1400
    );
    expect(uchwyt).toContain('UKRYTE_DEC406.warsztatInicjatywy');
    expect(uchwyt).toContain("getArtifactPath('initiative'");
  });

  it('warsztat NIE renderuje się w Mojej Pracy, dopóki stała ukrycia jest włączona', () => {
    const indeks = hub.indexOf('<InitiativeFullView');
    expect(indeks).toBeGreaterThan(0); // komponent zostaje w kodzie (Fala 2)
    // Osłona MUSI stać BEZPOŚREDNIO nad renderem — inaczej warsztat wraca na ekran.
    const przed = hub.slice(Math.max(0, indeks - 900), indeks);
    expect(przed).toContain('UKRYTE_DEC406.warsztatInicjatywy');
    expect(przed).toContain("getArtifactPath('initiative'");
  });

  it('karty warsztatu zapisane przed ukryciem nie wracają po odświeżeniu', () => {
    expect(hub).toMatch(/doc\.type === 'initiative' && UKRYTE_DEC406\.warsztatInicjatywy/);
  });
});

describe('DEC-406 (2) — chip Menu 3 nosi tytuł rekordu, nie nazwę typu', () => {
  const hub = zrodlo('src/components/MyWork/MyWorkHub.tsx');

  it('rozpoznaje nazwy zastępcze w obu językach', () => {
    for (const nazwa of ['Task', 'task', 'Zadanie', '  zadanie ']) {
      expect(czyNazwaZastepcza(nazwa, 'task')).toBe(true);
    }
    for (const nazwa of ['inicjatywa', 'initiative']) {
      expect(czyNazwaZastepcza(nazwa, 'initiative')).toBe(true);
    }
    expect(czyNazwaZastepcza('', 'task')).toBe(true);
    expect(czyNazwaZastepcza(null, 'decision')).toBe(true);
    expect(czyNazwaZastepcza('DBR77: Ustalić SLA dla kluczowych procesów', 'task')).toBe(false);
    expect(czyNazwaZastepcza('Zadanie na jutro', 'task')).toBe(false);
  });

  it('czyta tytuł spod zasobu rekordu (task/decision), reszty nie dociąga', () => {
    expect(sciezkaTytuluRekordu('task', 'a/b')).toBe('/my-work/personal-tasks/a%2Fb');
    expect(sciezkaTytuluRekordu('decision', 'd1')).toBe('/decisions/d1/detail');
    expect(sciezkaTytuluRekordu('idea', 'i1')).toBeNull();
    expect(sciezkaTytuluRekordu('notification', 'n1')).toBeNull();
  });

  it('wyłuskuje tytuł niezależnie od kształtu odpowiedzi', () => {
    expect(wyciagnijTytul({ title: 'A' })).toBe('A');
    expect(wyciagnijTytul({ data: { title: 'B' } })).toBe('B');
    expect(wyciagnijTytul({ data: { name: 'C' } })).toBe('C');
    expect(wyciagnijTytul({ data: {} })).toBeNull();
    expect(wyciagnijTytul(null)).toBeNull();
  });

  it('dociąga tytuł i nie wywraca się na błędzie sieci', async () => {
    await expect(
      pobierzTytulRekordu('task', 't1', async () => ({ title: 'Realny tytuł' }))
    ).resolves.toBe('Realny tytuł');
    await expect(
      pobierzTytulRekordu('task', 't1', async () => {
        throw new Error('503');
      })
    ).resolves.toBeNull();
    await expect(pobierzTytulRekordu('idea', 'i1', async () => ({ title: 'X' }))).resolves.toBeNull();
  });

  it('MyWorkHub faktycznie uruchamia dociąganie tytułu (wołacz istnieje)', () => {
    expect(hub).toContain('pobierzTytulRekordu');
    expect(hub).toContain('czyNazwaZastepcza');
  });

  it('każdy chip ma widoczny „×" (nie tylko po najechaniu myszą)', () => {
    expect(hub).not.toContain('opacity-0 group-hover:opacity-100');
    expect(hub).toContain('myWork.closeOpenDocument');
  });
});
