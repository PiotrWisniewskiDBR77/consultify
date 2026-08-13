/**
 * HARNESS ZRZUTOWY modułu Zlecenia (dev-only).
 *
 * ★★★ TO JEST ATRAPA. NIE DOWÓD ŻYWEGO STOSU. ★★★
 * Ten harness montuje realne komponenty React z podstawioną siecią —
 * przydatny jako SZYBKI test komponentu (layout, i18n, motyw, stany
 * brzegowe), ale sieć jest ręcznie napisaną atrapą (`trasuj()` niżej) i
 * MOŻE się rozjechać z rzeczywistym kontraktem backendu bez ostrzeżenia.
 * Dowodem, że coś działa na żywo, jest WYŁĄCZNIE test na realnym
 * PostgreSQL (`*.pg.test.ts`, `RUN_DB_TESTS=1`) albo ręczna próba na
 * żywym backendzie — nigdy ten plik. Historia: kontrakt koperty
 * `/plan-versions/:id/graph` (patrz `trasuj()` niżej) rozjechał się z
 * realną trasą i harness NIE złapał defektu P1, który zablokował całą
 * ścieżkę użytkownika (odkryty dopiero w przeglądarce na żywym stosie,
 * 2026-08-10). Napraw kontraktu tutaj NIE traktuj jako potwierdzenia, że
 * produkcyjny kod jest poprawny — sprawdzaj oba niezależnie.
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
  HISTORY,
  MEASUREMENTS,
  PLAN_VERSIONS,
  PROPOSALS,
  VALIDATIONS,
  WAITS,
} from './daneProbne';
import type { CasePlanVersion } from '../types';

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

function znajdzWersjePlanu(planVersionId: string): CasePlanVersion | undefined {
  for (const wersje of Object.values(PLAN_VERSIONS)) {
    const znaleziona = wersje.find((w) => w.casePlanVersionId === planVersionId);
    if (znaleziona) return znaleziona;
  }
  return undefined;
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
    // KONTRAKT (CW-T-F1, naprawione 2026-08-10): realna trasa
    // `GET /plan-versions/:id/graph` (server/src/routes/caseWorkspace/
    // casePlanVersions.routes.ts:158-170) woła `svc.getGraph`, ktora
    // zwraca KOPERTĘ `{ graphId, graphDigest, semanticGraph }`
    // (casePlanVersionService.ts:1382-1393) — NIGDY goły `CanonicalGraph`.
    // Ta atrapa musi oddawać dokładnie tę samą kopertę, bo to jej
    // rozbieżność z rzeczywistością ukryła defekt P1 (patrz
    // `liveStack.e2e.pg.test.ts` — „the response ENVELOPE of /graph is a
    // wrapper, not the graph"): stary kod produkcyjny przypisywał kopertę
    // wprost do `graph`, więc opublikowany plan z krokami renderował się
    // jako pusty — a harness tego NIE łapał, bo serwował goły graf.
    const wersja = znajdzWersjePlanu(decodeURIComponent(planGraf[1]));
    if (!wersja) return blad(404, 'NOT_FOUND', 'Nie znaleziono grafu planu.');
    return ok({
      graphId: wersja.semanticGraph.graphId ?? wersja.casePlanVersionId,
      graphDigest: wersja.graphDigest,
      semanticGraph: wersja.semanticGraph,
    });
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

// Widoczne oznaczenie atrapy — żeby nikt (Piotr, agent, kolejna sesja) nie
// pomylił zrzutu z tego harnessu z dowodem żywego stosu. Celowo poza
// systemem tokenów c-* produktu: to chrom narzędzia deweloperskiego, nie
// część UI, które ocenia właściciel.
function BanerAtrapy() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 999999,
        background: '#b45309',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: 12,
        padding: '4px 12px',
        textAlign: 'center',
        letterSpacing: 0.3,
      }}
    >
      ATRAPA SIECI (podglad/main.tsx) — harness komponentu, NIE dowód żywego backendu. Dowód = testy *.pg.test.ts na realnym PG.
    </div>
  );
}

createRoot(document.getElementById('podglad-root')!).render(
  <React.StrictMode>
    <Granica>
      <BanerAtrapy />
      <div style={{ paddingTop: 24 }}>
        <MemoryRouter initialEntries={[startowaSciezka]}>
          <Routes>
            <Route path="/zlecenia/*" element={<CaseWorkspaceHub />} />
          </Routes>
        </MemoryRouter>
      </div>
    </Granica>
  </React.StrictMode>
);
