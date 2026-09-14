/**
 * @vitest-environment jsdom
 *
 * DEC-461 / fala J1 — the DRD questionnaire ON SCREEN follows the interface
 * language.
 *
 * ★ WHAT THIS TEST CAN AND CANNOT SEE. `tests/setup.ts` mocks `react-i18next`
 * globally with a stub whose `i18n.language` is the constant `'en'`. Anything
 * on this screen that reads `useTranslation().i18n` (the breadcrumb's axis/area
 * caption) is therefore pinned to English INSIDE THE HARNESS regardless of the
 * real language — an instrument artifact, not product behaviour (verified by
 * eye in dev-render, see evidence/zrzuty-j1-drd-en). What this test asserts is
 * everything driven by the PACK — navigator names, question wording, "Why do
 * we ask" — which reads the real `i18next` singleton through
 * `useDrdPackLanguage()`, so the harness and the product agree there.
 *
 * Why a screen test and not only the compiler test next door: the compiler
 * could be perfectly bilingual and the screen still Polish, because the pack
 * used to be a MODULE-LEVEL const (`export const { pack } = compileDrdPack()`
 * in `drdWorkspaceViewModel.ts`) — compiled once, at import time, in whatever
 * language happened to be first. That is exactly the "wołacz istnieje ≠
 * renderuje się" shape. This test renders the real screen and reads the words.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import i18n from 'i18next';

import { DRD_STRUCTURE } from '@/services/drdStructure';
import { getDRDKnowledge } from '@/services/assessmentKnowledge';
import { DrdMethodWorkspaceScreen } from '../DrdMethodWorkspaceScreen';

const JEZYK_STARTOWY = i18n.language;

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

/** Area 1A ("Sales Processes" / "Procesy Sprzedaży") — the screen the owner screenshotted. */
const AREA_1A = DRD_STRUCTURE[0].areas[0];
/**
 * `seedTo="matrix"` confirms 1A levels 1-2, so the interview opens on the
 * blocked level — 3. Measured, not assumed (a wrong level here would silently
 * make this test assert nothing).
 */
const POZIOM_OGNISKOWY = 3;
const PYTANIE_EN = getDRDKnowledge(AREA_1A.id, POZIOM_OGNISKOWY, 'en').questions[0];
const PYTANIE_PL = getDRDKnowledge(AREA_1A.id, POZIOM_OGNISKOWY, 'pl').questions[0];

describe('DRD workspace — questionnaire language follows i18next', () => {
  beforeEach(() => {
    // The two wordings must genuinely differ, or this test proves nothing.
    expect(PYTANIE_EN).not.toBe(PYTANIE_PL);
  });

  afterAll(async () => {
    await i18n.changeLanguage(JEZYK_STARTOWY);
  });

  it('EN: the area header and the focus question are English', async () => {
    await i18n.changeLanguage('en');
    render(
      <DrdMethodWorkspaceScreen
        storage={makeMemoryStorage()}
        seedTo="matrix"
        initialViewMode="interview"
      />
    );

    // The area name appears in both the navigator and the focus header —
    // `findAllByText`, not `findByText`.
    expect((await screen.findAllByText(AREA_1A.name)).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(AREA_1A.namePL!)).toEqual([]);
    expect(screen.getAllByText(PYTANIE_EN).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(PYTANIE_PL)).toEqual([]);
  });

  it('PL: the same screen shows the Polish area name and the Polish question', async () => {
    await i18n.changeLanguage('pl');
    render(
      <DrdMethodWorkspaceScreen
        storage={makeMemoryStorage()}
        seedTo="matrix"
        initialViewMode="interview"
      />
    );

    expect((await screen.findAllByText(AREA_1A.namePL!)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(PYTANIE_PL).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(PYTANIE_EN)).toEqual([]);
  });

  it('switching the language in Settings re-renders the questionnaire — no page reload', async () => {
    await i18n.changeLanguage('pl');
    render(
      <DrdMethodWorkspaceScreen
        storage={makeMemoryStorage()}
        seedTo="matrix"
        initialViewMode="interview"
      />
    );
    expect((await screen.findAllByText(PYTANIE_PL)).length).toBeGreaterThan(0);

    // This is what the Settings language selector does — nothing else.
    await i18n.changeLanguage('en');

    await waitFor(() => {
      expect(screen.getAllByText(PYTANIE_EN).length).toBeGreaterThan(0);
    });
    expect(screen.queryAllByText(PYTANIE_PL)).toEqual([]);
  });
});
