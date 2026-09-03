/**
 * MYW-PHOTO-001 / MYW-PHOTO-007 — pokrycie stanów w fikstrach demo Mojej Pracy.
 *
 * Dyżur 2026-09-03 (`agent/mw-dane-demo-20260903`) zmierzył, że dane pokazowe
 * dla Skrzynki/Zadań/Decyzji/Kalendarza (dev-render/screens/mywork-*.tsx)
 * pokrywają enumeracje stanów z kodu produkcyjnego CZĘŚCIOWO — Skrzynka nie
 * miała żadnej pozycji w sekcjach `fyi_system`/`other` (2 z 9 wartości
 * `InboxSection`), Kalendarz żadnego wydarzenia źródła `event`/`outlook`
 * (2 z 7 wartości `CalendarEventSource`). Naprawione w tym samym dyżurze.
 *
 * Ten test NIE renderuje komponentów (import realnego `<MyWorkHub>` w
 * dev-render/screens/*.tsx ciągnie cały drzewo providerów — kosztowne i
 * kruche pod vitest). Zamiast tego czyta źródło jako tekst i sprawdza, czy
 * KAŻDA wartość enumeracji zdefiniowanej w kodzie produkcyjnym pojawia się
 * co najmniej raz w literałach mocka. Cel: jeśli ktoś przy kolejnej edycji
 * usunie pozycję niosącą jedyny egzemplarz danego stanu, ten test się wywali
 * — "stan nie wypada" bez komunikatu (patrz `naprawa-per-wywolanie-odrasta`
 * w pamięci nadzorcy).
 *
 * Enumeracje źródłowe wyciągane DYNAMICZNIE z plików produkcyjnych (regex na
 * blok typu/switcha) tam, gdzie źródło to czysty union type lub switch —
 * jeśli ktoś dołoży nową wartość stanu w produkcie, ten test zacznie żądać
 * jej też w mocku. Tam, gdzie enumeracja żyje w tablicy opcji UI (statusy/
 * priorytety zadań), wartości są zacytowane ręcznie z dokładną linią kodu
 * (zweryfikowane w źródle 2026-09-03, nie zgadywane).
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

/** Wyciąga literały `'wartosc'` z pierwszego bloku `export type <Name> = ... ;` w tekście. */
function extractUnionType(source: string, typeName: string): string[] {
  const re = new RegExp(`export type ${typeName}\\s*=([\\s\\S]*?);`);
  const match = source.match(re);
  if (!match) {
    throw new Error(`Nie znaleziono \`export type ${typeName} = ...;\` w źródle — cytat nieaktualny.`);
  }
  return [...match[1].matchAll(/'([a-zA-Z0-9_]+)'/g)].map((m) => m[1]);
}

/** Wyciąga literały z pola interfejsu `fieldName: 'a' | 'b' | ...;`. */
function extractInterfaceFieldUnion(source: string, fieldName: string): string[] {
  const re = new RegExp(`\\b${fieldName}:\\s*((?:'[a-zA-Z0-9_]+'\\s*\\|?\\s*)+);`);
  const match = source.match(re);
  if (!match) {
    throw new Error(`Nie znaleziono pola \`${fieldName}: '...' | ...;\` — cytat nieaktualny.`);
  }
  return [...match[1].matchAll(/'([a-zA-Z0-9_]+)'/g)].map((m) => m[1]);
}

/** Wyciąga wszystkie `key: 'VALUE'` (dowolna wielkość liter) dla danego klucza pola z fikstury. */
function extractFixtureValues(source: string, fieldName: string): Set<string> {
  const re = new RegExp(`\\b${fieldName}:\\s*'([a-zA-Z0-9_]+)'`, 'g');
  return new Set([...source.matchAll(re)].map((m) => m[1]));
}

describe('MYW-PHOTO-001/007 — pokrycie enumeracji stanów w danych pokazowych Mojej Pracy', () => {
  describe('Skrzynka (mywork-inbox.tsx) vs InboxContent.tsx', () => {
    const inboxSource = read('src/components/MyWork/InboxContent.tsx');
    const v8Types = read('src/services/api/v8/my-work.ts');
    const fixture = read('dev-render/screens/mywork-inbox.tsx');

    it('każda wartość InboxSection ma co najmniej jedną pozycję w mocku', () => {
      const possible = extractUnionType(inboxSource, 'InboxSection');
      expect(possible.length).toBeGreaterThanOrEqual(9); // strażnik: było 9 w chwili pomiaru
      const present = extractFixtureValues(fixture, 'section');
      const missing = possible.filter((v) => !present.has(v));
      expect(missing).toEqual([]);
    });

    it('każda wartość itemType (V8CanonicalInboxItem) ma co najmniej jedną pozycję w mocku', () => {
      const possible = extractInterfaceFieldUnion(v8Types, 'itemType');
      expect(possible.length).toBeGreaterThanOrEqual(6);
      const present = extractFixtureValues(fixture, 'itemType');
      const missing = possible.filter((v) => !present.has(v));
      expect(missing).toEqual([]);
    });

    it('wszystkie trzy zakładki Skrzynki (Otwarte/Zamknięte/Zapisane) mają dane — status pending/resolved/snoozed', () => {
      // Zgodnie z mapCanonicalItemStatus (InboxContent.tsx): resolved→done,
      // snoozed→saved, wszystko inne (w tym 'pending')→open.
      const present = extractFixtureValues(fixture, 'status');
      for (const required of ['pending', 'resolved', 'snoozed']) {
        expect(present.has(required)).toBe(true);
      }
    });
  });

  describe('Kalendarz (mywork-calendar.tsx) vs calendarTypes.ts', () => {
    const calendarTypesSource = read('src/components/MyWork/Calendar/calendarTypes.ts');
    const fixture = read('dev-render/screens/mywork-calendar.tsx');

    it('każda wartość CalendarEventSource ma co najmniej jedno wydarzenie w mocku', () => {
      const possible = extractUnionType(calendarTypesSource, 'CalendarEventSource');
      expect(possible.length).toBeGreaterThanOrEqual(7); // strażnik: było 7 w chwili pomiaru
      const present = extractFixtureValues(fixture, 'source');
      const missing = possible.filter((v) => !present.has(v));
      expect(missing).toEqual([]);
    });
  });

  describe('Zadania (mywork-tasks.tsx) vs MyTasksListContent.tsx', () => {
    const fixture = read('dev-render/screens/mywork-tasks.tsx');

    // Zweryfikowane w źródle 2026-09-03: MyTasksListContent.tsx INLINE_STATUS_OPTIONS
    // (linie ~567-588, jedyny selektor statusu widoczny w UI listy) oferuje
    // dokładnie te 5 wartości. `getStatusConfig` (linie ~285-341) rozpoznaje
    // też 'pending_approval'/'cancelled', ale te dwie NIE są osiągalne przez
    // żaden kontrolny element UI listy — nieprzemierzony obszar, opisany w
    // meldunku dyżuru, celowo pominięty tutaj.
    const REACHABLE_STATUS_VALUES = ['todo', 'in_progress', 'review', 'blocked', 'done'];

    // Zweryfikowane w źródle: getPriorityConfig (linie ~236-278) ma dokładnie
    // 5 rozróżnialnych etykiet (Critical dla 'urgent'/'critical', High,
    // Medium, Low, Normal jako domyślna gałąź).
    const DISPLAY_PRIORITY_VALUES = ['critical', 'high', 'medium', 'low', 'normal'];

    it('każdy z 5 widocznych statusów zadania ma co najmniej jedno zadanie w mocku', () => {
      const present = extractFixtureValues(fixture, 'status');
      const missing = REACHABLE_STATUS_VALUES.filter((v) => !present.has(v));
      expect(missing).toEqual([]);
    });

    it('każdy z 5 widocznych priorytetów zadania ma co najmniej jedno zadanie w mocku', () => {
      const present = extractFixtureValues(fixture, 'priority');
      const missing = DISPLAY_PRIORITY_VALUES.filter((v) => !present.has(v));
      expect(missing).toEqual([]);
    });
  });

  describe('Decyzje (mywork-decisions.tsx) vs DecisionsPanelContent.tsx', () => {
    const decisionsPanelSource = read('src/components/MyWork/DecisionsPanelContent.tsx');
    const fixture = read('dev-render/screens/mywork-decisions.tsx');

    function extractStatusLabelCases(source: string): string[] {
      const fnMatch = source.match(/const statusLabel[\s\S]*?switch[\s\S]*?\{([\s\S]*?)\n\};/);
      if (!fnMatch) {
        throw new Error('Nie znaleziono funkcji `statusLabel` — cytat nieaktualny.');
      }
      const cases = [...fnMatch[1].matchAll(/case '([A-Z_]+)':/g)].map((m) => m[1]);
      return [...new Set(cases)];
    }

    it('każdy status z statusLabel() ma co najmniej jedną decyzję w mocku', () => {
      const possible = extractStatusLabelCases(decisionsPanelSource);
      expect(possible.length).toBeGreaterThanOrEqual(5); // PENDING/APPROVED/REJECTED/DEFERRED/ESCALATED
      const present = extractFixtureValues(fixture, 'status');
      const missing = possible.filter((v) => !present.has(v));
      expect(missing).toEqual([]);
    });

    it('każdy priorytet z priorityOrder ma co najmniej jedną decyzję w mocku', () => {
      const orderMatch = decisionsPanelSource.match(
        /const priorityOrder: Record<string, number> = \{([^}]+)\};/
      );
      if (!orderMatch) {
        throw new Error('Nie znaleziono `priorityOrder` — cytat nieaktualny.');
      }
      const possible = [...orderMatch[1].matchAll(/([A-Z]+):/g)].map((m) => m[1]);
      expect(possible.length).toBeGreaterThanOrEqual(4); // CRITICAL/HIGH/MEDIUM/LOW
      const present = extractFixtureValues(fixture, 'priority');
      const missing = possible.filter((v) => !present.has(v));
      expect(missing).toEqual([]);
    });
  });
});
