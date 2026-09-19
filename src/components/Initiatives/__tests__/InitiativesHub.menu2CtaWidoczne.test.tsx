/**
 * @vitest-environment jsdom
 *
 * F9 (15.09.2026) — REGRESJA ZMIERZONA NA STAGINGU `c458374bfa`:
 * po wlaczeniu flag partii 2 rzad Menu 2 Inicjatyw mial PIEC pigulek
 * (Initiatives · Plan · Load · Work report · For approval) i wypychal primary
 * CTA „New initiative" poza 1440x900 — przycisk byl w DOM, ale nie na ekranie
 * (`wdrozenie-6-20260915/zrzuty/06-initiatives-l6.png`).
 *
 * SPROSTOWANIE PREMISY: „For approval" NIE byla piata pigulka MENU 3.
 * Menu 3 Inicjatyw ma 3 chipy i mial je takze przed ta naprawa. Piata pigulka
 * stala w MENU 2 (`tabs` -> `StandardModuleBar` -> `ModuleNavBar`).
 *
 * Ten plik pilnuje obu polowek naprawy przy WSZYSTKICH flagach ON:
 *   1. Menu 3 dalej ≤3 chipy,
 *   2. „For approval" nie wraca jako pigulka Menu 2 — zyje w przelaczniku
 *      „Status" (Menu 2), z ktorego mozna wejsc i wrocic,
 *   3. primary CTA „New initiative" jest w drzewie.
 *
 * Czego ten test NIE mierzy (uczciwie): jsdom nie liczy layoutu, wiec
 * `offsetLeft`/`getBoundingClientRect` sa tu zerami — WIDOCZNOSC CTA przy
 * 1280/1440/1920 mierza zrzuty Playwright w `fala-f9-20260915/zrzuty/`,
 * a nie ten plik.
 */

import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: any) => {
      if (typeof opts === 'string') return opts;
      if (opts?.defaultValue) return opts.defaultValue;
      return k;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return { default: Object.assign(fn, { success: vi.fn(), error: vi.fn() }) };
});

const {
  getPortfolio,
  getInitiative,
  listRegisteredInitiatives,
  apiGet,
  portfolioStoreState,
  appStoreState,
  conversationStoreState,
  demoModeState,
} = vi.hoisted(() => ({
  getPortfolio: vi.fn(),
  getInitiative: vi.fn(),
  listRegisteredInitiatives: vi.fn(),
  apiGet: vi.fn(),
  portfolioStoreState: { refreshTrigger: 0 },
  appStoreState: {
    currentProjectId: 'proj-1',
    currentUser: { id: 'u1', firstName: 'T', lastName: 'U', role: 'ADMIN' },
    currentOrganization: { id: 'org-1' },
  },
  conversationStoreState: { addMessage: vi.fn() },
  demoModeState: { enabled: false },
}));

vi.mock('@/services/initiatives-execution/runtimeApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/services/initiatives-execution/runtimeApi')>()),
  listRegisteredInitiatives,
}));

vi.mock('@/services/api/v8/planning', () => ({
  V8PlanningApi: {
    getPortfolio,
    getPendingDecisions: vi.fn(async () => []),
    getInitiativeSnapshot: vi.fn(async () => null),
    getInitiative,
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
    post: vi.fn(async () => ({})),
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    getUsers: vi.fn(async () => []),
    getProjects: vi.fn(async () => []),
    generateInitiatives: vi.fn(async () => ({ success: true, id: 'g1', message: 'ok' })),
  },
  shouldAllowDemoData: () => demoModeState.enabled,
}));

vi.mock('@/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../Wizard/InitiativeWizardModal', () => ({
  InitiativeWizardModal: () => null,
}));

vi.mock('../InitiativeDocumentView', () => ({
  InitiativeDocumentView: () => React.createElement('div', { 'data-testid': 'legacy-initiative' }),
}));

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: typeof conversationStoreState) => unknown) =>
    selector(conversationStoreState),
}));

vi.mock('../../../store/portfolioSlice', () => ({
  usePortfolioStore: (selector: (state: typeof portfolioStoreState) => unknown) =>
    selector(portfolioStoreState),
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: () => appStoreState,
}));

/**
 * Flagi czytane sa w module SCOPE (`const X = import.meta.env.VITE_… === 'true'`),
 * wiec `stubEnv` musi wyprzedzic ewaluacje modulu — stad dynamiczny import
 * ZAMIAST statycznego (ten drugi zostalby wyhoistowany ponad stub).
 */
const renderHubAllFlagsOn = async (entry = '/initiatives') => {
  vi.stubEnv('VITE_TRANSITION_INBOX', 'true');
  vi.stubEnv('VITE_INITIATIVES_WORK_REPORT', 'true');
  vi.stubEnv('VITE_INITIATIVES_FOUR_BUTTONS', 'true');
  vi.stubEnv('VITE_PMO_PROJECTS', 'true');
  const { InitiativesHub } = await import('../InitiativesHub');
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <InitiativesHub />
    </MemoryRouter>
  );
};

beforeEach(() => {
  vi.resetModules();
  window.localStorage.clear();
  demoModeState.enabled = false;
  getPortfolio.mockReset();
  getPortfolio.mockResolvedValue({ initiatives: [] });
  getInitiative.mockReset();
  getInitiative.mockResolvedValue(null);
  listRegisteredInitiatives.mockReset();
  listRegisteredInitiatives.mockResolvedValue({ initiatives: [] });
  apiGet.mockReset();
  apiGet.mockResolvedValue({});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('Inicjatywy · Menu 2 przy WSZYSTKICH flagach ON [F9 DEC-507]', () => {
  it('Menu 3 trzyma ≤3 chipy', async () => {
    await renderHubAllFlagsOn();
    await screen.findByTestId('initiatives-hub');

    const chips = screen.queryAllByTestId(/^(initiatives-menu3-chip-|standard-chip-)/);
    expect(chips.length).toBeLessThanOrEqual(3);
  });

  it('„For approval" NIE jest pigulka Menu 2 — rzad pigulek ma tylko zakladki modulu', async () => {
    await renderHubAllFlagsOn();
    await screen.findByTestId('initiatives-hub');

    const tablist = screen.getByRole('tablist', { name: 'Module sections' });
    const etykiety = within(tablist)
      .getAllByRole('tab')
      .map((el) => (el.textContent || '').trim());

    // MUTACJA: przywrocenie wpisu `transitionInbox` do `tabs` w
    // InitiativesHub.tsx wywraca ten wiersz na czerwono.
    expect(etykiety).not.toContain('For approval');
    expect(etykiety).toContain('Initiatives');
  });

  it('primary CTA „New initiative" jest w drzewie mimo wszystkich flag ON', async () => {
    await renderHubAllFlagsOn();
    await screen.findByTestId('initiatives-hub');

    /* Atrapa `t` wyzej przepuszcza KLUCZ, gdy wolacz nie podaje domyslki —
       a `initiatives.form.newInitiative` wolane jest bez domyslki. Dlatego
       wzorzec dopuszcza obie postacie: klucz (tu) i przetlumaczona etykieta
       (realna powloka, `public/locales/en/translation.json` → „New
       initiative"). Bez tego test mierzylby atrape, nie produkt. */
    /* `getAllBy…`, nie `getBy…`: kanoniczny wariant CTA z menu renderuje
       przycisk ORAZ jego wyzwalacz listy pod tym samym `aria-label`. */
    const cta = screen.getAllByRole('button', {
      name: /New initiative|initiatives\.form\.newInitiative/i,
    });
    expect(cta.length).toBeGreaterThan(0);
  });

  it('skrzynka recenzenta ma wejscie I wyjscie tym samym przelacznikiem „Status"', async () => {
    await renderHubAllFlagsOn('/initiatives?tab=transitionInbox');
    await screen.findByTestId('initiatives-hub');

    // Wejscie z adresu dziala (zakladka zyje mimo braku pigulki),
    // a przelacznik „Status" stoi tam, wiec da sie wrocic.
    expect(screen.getByTestId('initiatives-lifecycle-dropdown')).toBeInTheDocument();
  });
});

/**
 * Strażnik warstwy layoutu. jsdom nie liczy szerokosci, wiec JEDYNY tani
 * sposob, zeby regresja „CTA wypchniete poza ekran" nie wrocila cicho, to
 * przypilnowac trzech klas w SSOT paska (`ModuleNavBar`) — tam, gdzie
 * naprawa faktycznie siedzi. Pomiar wizualny robia zrzuty 1280/1440/1920.
 */
describe('ModuleNavBar · rzad Menu 2 nie moze wypchnac primary CTA [F9]', () => {
  it('lewy klaster i pigułki są kurczliwe, a od 1280 oba klastry zostają w jednym wierszu bez utraty CTA', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const zrodlo = fs.readFileSync(
      path.resolve(__dirname, '../../shared/ModuleHub/ModuleNavBar.tsx'),
      'utf-8'
    );

    // MUTACJA: skasowanie dowolnej części kontraktu znów pozwala wypchnąć
    // Load albo CTA poza widoczny obszar przy szerokości 1280 px.
    // QB00/Wpis 157 (DEC-653/664): próg single-row obniżony 1360→1280, żeby
    // prawy klaster Menu 2 nie zawijał się do osobnego paska (objaw „kolejne
    // menu"). Próg wyrażony NAZWANYM `xl:` (1280 px), NIE `min-[1280px]:` —
    // potok Tailwind tego projektu nie kompiluje wariantów `min-[...]` (pomiar
    // dev-render 18.09: zero reguł `flex-basis:auto` w jakimkolwiek media
    // query). Strażnik SSOT wspólnego komponentu — synchronizacja mechaniczna.
    expect(zrodlo).toContain('flex flex-wrap xl:flex-nowrap items-center');
    expect(zrodlo).toContain(
      'className="flex min-w-0 basis-full items-center gap-2 xl:basis-auto xl:gap-3"'
    );
    expect(zrodlo).toContain(
      'className="app-table-scrollbar flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap"'
    );
    expect(zrodlo).toContain(
      'flex min-w-0 basis-full flex-wrap items-center gap-2 justify-end xl:basis-auto xl:flex-nowrap'
    );
  });
});
