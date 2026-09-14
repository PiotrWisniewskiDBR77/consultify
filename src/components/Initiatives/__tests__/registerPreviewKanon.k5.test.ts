/**
 * K5-7 / PARTIA B — kanon podglądu rejestru Inicjatyw (2026-09-13).
 *
 * Test kontraktu ŹRÓDŁA (wzór: `InterviewPreviewFooter.ownerContract.test.ts`).
 * Powód tej formy: `CanonicalInitiativeRegister` renderuje się dopiero z pełnym
 * zestawem providerów i żywym `useInitiativeLifecycle`, więc render w teście
 * mierzyłby atrapy, a nie deklarację ekranu. Tu pilnujemy dokładnie tych trzech
 * rzeczy, które właściciel zobaczył na zrzutach i które mogą cicho odrosnąć.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), 'utf8');

const REJESTR = 'src/components/Initiatives/CanonicalInitiativeRegister.tsx';
const LIFECYCLE = 'src/components/Initiatives/lifecycle/InitiativeLifecycleActions.tsx';

describe('P2 — meta podglądu bez wartości-śmieci', () => {
  const zrodlo = read(REJESTR);

  it('wersja renderuje się TYLKO gdy rekord ją ma (koniec z „v—")', () => {
    // Odchylenie P2: „Draft · Unknown · v—". Mutacja: powrót do
    // `v{String(initiative.canonicalVersion || '—')}` wywraca ten test.
    expect(zrodlo).not.toContain("canonicalVersion || '—'");
    expect(zrodlo).toContain('initiative.canonicalVersion ? (');
  });

  it('brak oczekiwanego efektu to „—", nie słowo „Unknown"', () => {
    expect(zrodlo).not.toContain("t('enums.unknown', 'Unknown')");
  });

  it('linia rekomendacji znika, gdy nie ma co rekomendować', () => {
    expect(zrodlo).not.toContain("String(initiative.nextAction || '—')");
  });
});

describe('P4 — łańcuch zarządzania w bloku akcji, nie jako siódmy blok', () => {
  const zrodlo = read(REJESTR);

  it('podgląd NIE renderuje sekcji „Initiative stage" w swoim ciele', () => {
    // Odchylenie P4: nagłówek sekcji + akapit ostrzeżenia pod wyłączonym
    // przyciskiem, poza sześcioma blokami kanonu (TRIADA §A7).
    expect(zrodlo).not.toContain("heading={t('initiatives.lifecycle.heading'");
    expect(zrodlo).not.toContain('density="full"');
  });

  it('łańcuch stoi w stopce podglądu (blok 6) w wariancie zwartym', () => {
    const stopka = zrodlo.indexOf('renderPreviewFooter');
    const lancuch = zrodlo.indexOf('<InitiativeLifecycleActions');
    expect(stopka).toBeGreaterThan(-1);
    expect(lancuch).toBeGreaterThan(stopka);
    expect(zrodlo).toContain('density="compact"');
  });

  it('powód niedostępności w wariancie zwartym idzie do dymka, nie do akapitu', () => {
    const zrodloLifecycle = read(LIFECYCLE);
    expect(zrodloLifecycle).toContain("density === 'full'");
    expect(zrodloLifecycle).toContain('aria-label=');
    // Mutacja: usunięcie warunku `density === 'full'` przy `blocked` przywraca
    // listę powodów w podglądzie — dokładnie obraz ze zrzutu właściciela.
    const blocked = zrodloLifecycle.indexOf('const blocked');
    expect(zrodloLifecycle.slice(blocked, blocked + 200)).toContain("density === 'full'");
  });
});

describe('T1 — komórki rejestru nie zawijają się na dwie linie', () => {
  const kolumny = read('src/components/Initiatives/initiativeRegisterColumns.shared.ts');

  it('status i następne działanie skracają się wielokropkiem w jednej linii', () => {
    // „Pending approval" w kolumnie 105 px łamało się na dwie linie i rozpychało
    // wiersz; `text-overflow` nie działa na anonimowym elemencie flexa, więc
    // etykieta musi mieć WŁASNY span z `truncate`.
    expect(kolumny).toContain("h('span', { className: 'truncate' },");
    expect(kolumny).toContain('block truncate text-xs font-medium text-c-text');
  });
});
