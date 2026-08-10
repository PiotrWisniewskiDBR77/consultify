/**
 * HARNESS ZRZUTOWY modułu Zlecenia (dev-only).
 *
 * CLAUDE.md reguła #7: właściciel NIGDY nie jest pierwszym testerem wizualnym.
 * Ten plik montuje REALNE komponenty modułu (`CaseWorkspaceHub` → prawdziwe
 * `StandardModuleBar`/`StandardTable`/`StandardPreview`) z realnym arkuszem
 * stylów aplikacji i realnym i18n, ale bez logowania i bez backendu —
 * odpowiedzi `/api/v8/case-workspace/*` podstawia atrapa `window.fetch`.
 *
 * NIE wchodzi do bundla produkcyjnego: produkcyjnym wejściem jest `index.html`
 * w korzeniu repo (`src/index.tsx`); ten katalog nie jest przez nic z niego
 * importowany. Serwuje go wyłącznie dev-server Vite z konfiguracji korzenia:
 *
 *   npx vite --port 3610 --strictPort
 *   http://localhost:3610/src/components/CaseWorkspace/podglad/index.html
 *
 * Parametry adresu:
 *   ?sciezka=/zlecenia            trasa startowa (domyślnie lista)
 *   &motyw=light|dark             motyw (domyślnie light)
 *   &awaria=puste|blad|brak-dostepu   wymuszony stan brzegowy listy
 */

// Realny arkusz aplikacji: warstwy Tailwind + pełny system tokenów c-*.
import '../../../index.css';

import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import i18n from '../../../i18n';
import { CaseWorkspaceHub } from '../CaseWorkspaceHub';
import {
  ARTIFACT_LINKS,
  CASES,
  GRAPHS,
  HISTORY,
  MEASUREMENTS,
  PLAN_VERSIONS,
  PROPOSALS,
  VALIDATIONS,
  WAITS,
} from './daneProbne';

const params = new URLSearchParams(window.location.search);
const startowaSciezka = params.get('sciezka') || '/zlecenia';
const motyw = params.get('motyw') === 'dark' ? 'dark' : 'light';
const awaria = params.get('awaria');

// ── Motyw ────────────────────────────────────────────────────────────────────
// Klasa `.dark` na <html> to strategia motywu w tym repo (tailwind darkMode).
const korzen = document.documentElement;
korzen.classList.toggle('dark', motyw === 'dark');
document.body.style.background = 'var(--c-bg)';
new MutationObserver(() => {
  if (korzen.classList.contains('dark') !== (motyw === 'dark')) {
    korzen.classList.toggle('dark', motyw === 'dark');
  }
}).observe(korzen, { attributes: true, attributeFilter: ['class'] });

void i18n.changeLanguage('pl');

// ── Atrapa sieci ─────────────────────────────────────────────────────────────
// Przechwytujemy WYŁĄCZNIE `/api/v8/case-workspace/*`. Wszystko inne (np.
// /locales/** dla i18n) leci normalnie, żeby harness pokazywał realne teksty.
type Odpowiedz = { status: number; body: unknown };

function ok(data: unknown): Odpowiedz {
  return { status: 200, body: { data } };
}

function blad(status: number, code: string, message: string): Odpowiedz {
  return { status, body: { error: { code, message } } };
}

function trasuj(sciezka: string): Odpowiedz {
  const bez = sciezka.replace('/api/v8/case-workspace', '');

  if (bez.startsWith('/cases') && !bez.match(/\/cases\/[^/]+/)) {
    if (awaria === 'puste') return ok([]);
    if (awaria === 'blad') return blad(500, 'INTERNAL', 'Nie udało się wczytać listy zleceń.');
    if (awaria === 'brak-dostepu') return blad(403, 'FORBIDDEN', 'Brak uprawnień do zleceń.');
    return ok(CASES);
  }

  const planGraf = bez.match(/^\/plan-versions\/([^/]+)\/graph/);
  if (planGraf) {
    const graf = GRAPHS[decodeURIComponent(planGraf[1])];
    return graf ? ok(graf) : blad(404, 'NOT_FOUND', 'Nie znaleziono grafu planu.');
  }

  const planWalidacja = bez.match(/^\/plan-versions\/([^/]+)\/validate/);
  if (planWalidacja) {
    const wynik = VALIDATIONS[decodeURIComponent(planWalidacja[1])];
    return wynik ? ok(wynik) : ok({ valid: true, blockers: [] });
  }

  const podzasob = bez.match(/^\/cases\/([^/]+)\/([^/?]+)/);
  if (podzasob) {
    const caseId = decodeURIComponent(podzasob[1]);
    switch (podzasob[2]) {
      case 'plan-versions':
        return ok(PLAN_VERSIONS[caseId] ?? []);
      case 'waits':
        return ok(WAITS[caseId] ?? []);
      case 'proposals':
        return ok(PROPOSALS[caseId] ?? []);
      case 'value-measurements':
        return ok(MEASUREMENTS[caseId] ?? []);
      case 'artifact-links':
        return ok(ARTIFACT_LINKS[caseId] ?? []);
      case 'history-events':
        return ok(HISTORY[caseId] ?? []);
      default:
        return blad(404, 'NOT_FOUND', 'Nieznany zasób zlecenia.');
    }
  }

  const jedno = bez.match(/^\/cases\/([^/?]+)/);
  if (jedno) {
    const caseId = decodeURIComponent(jedno[1]);
    const item = CASES.find((c) => c.caseId === caseId);
    return item ? ok(item) : blad(404, 'NOT_FOUND', 'Nie znaleziono zlecenia.');
  }

  return blad(404, 'NOT_FOUND', 'Nieznana ścieżka.');
}

const oryginalnyFetch = window.fetch.bind(window);
window.fetch = ((wejscie: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof wejscie === 'string' ? wejscie : wejscie instanceof URL ? wejscie.href : wejscie.url;
  const sciezka = new URL(url, window.location.origin).pathname;
  if (!sciezka.startsWith('/api/v8/case-workspace'))
    return oryginalnyFetch(wejscie as RequestInfo, init);
  const odp = trasuj(sciezka);
  return Promise.resolve(
    new Response(JSON.stringify(odp.body), {
      status: odp.status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}) as typeof window.fetch;

// ── Montaż ───────────────────────────────────────────────────────────────────
// `MemoryRouter` + trasa `/zlecenia/*`: dokładnie ta sama rejestracja co w
// `AppRoutes.tsx`, więc nawigacja wewnątrz modułu (otwarcie zlecenia, Wstecz,
// zakładki w adresie) zachowuje się tak jak w aplikacji.
class Granica extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: 24, whiteSpace: 'pre-wrap', color: '#b91c1c' }}>
          {String(this.state.error.stack || this.state.error.message)}
        </pre>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('podglad-root')!).render(
  <React.StrictMode>
    <Granica>
      <MemoryRouter initialEntries={[startowaSciezka]}>
        <Routes>
          <Route path="/zlecenia/*" element={<CaseWorkspaceHub />} />
        </Routes>
      </MemoryRouter>
    </Granica>
  </React.StrictMode>
);
