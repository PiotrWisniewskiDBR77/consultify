/**
 * F2-1 E1 (2026-09-14) — REALNY <InitiativesHub> z flaga
 * VITE_INITIATIVES_FOUR_BUTTONS=true, soczewka Menu 3 „Analiza".
 *
 * Montuje produkcyjny <InitiativeConsultingAnalysisView> (ten sam komponent,
 * do ktorego prowadzi jedyna sciezka w aplikacji: Menu 2 „Initiatives" ->
 * Menu 3 „Analysis"), a nie wlasna kompozycje — zeby zrzut pokazywal produkt,
 * a nie przyrzad.
 *
 * Dane analizy NIE sa recznie napisane: `dev-render/mocks/f2PortfolioAnalysisFixture.json`
 * powstaje ze skryptu `scripts/dev/f2-analiza-portfela-fikstura.mjs`, ktory
 * przepuszcza migawke przez PRODUKCYJNA deterministyczna brame modelu i
 * PRODUKCYJNY walidator `parsePortfolioAnalysisItems`. Odpowiedzi atrapy maja
 * dokladnie ten ksztalt, ktory zwracaja trasy runtime-v1.
 *
 * Query:
 *   &krok=lista        — Menu 3 „Analysis", tabela przed uruchomieniem analizy
 *   &krok=analiza      — po „Analyse portfolio": lista decyzji i rekomendacji
 *   &krok=parking      — jak wyzej + zaznaczona decyzja PARKING z powodem
 *                        i warunkiem ponownej propozycji w podgladzie
 *   &theme=light|dark, &lang=pl|en  — obsluguje main.tsx harnessu
 */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import fixture from '../mocks/f2PortfolioAnalysisFixture.json';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();
// Patrz `dec495-inicjatywy-archiwum.tsx`: sam localStorage nie wystarcza, bo
// zustand persist nadpisuje go po ~300 ms i rejestr po cichu wraca na demo.
useAppStore.setState({ isDemoMode: false });
try {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {} };
  parsed.state = { ...parsed.state, isDemoMode: false, isDemoSession: false };
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
} catch {
  // brak localStorage nie powinien wywalic harnessu
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const REGISTER_ROWS = fixture.analysis.snapshot.initiatives.map((entry) => ({
  id: entry.initiativeId,
  organizationId: fixture.analysis.snapshot.organizationId,
  name: String((entry.facts as Record<string, unknown>).name ?? entry.initiativeId),
  title: String((entry.facts as Record<string, unknown>).name ?? entry.initiativeId),
  summary: String((entry.facts as Record<string, unknown>).area ?? ''),
  status: String((entry.facts as Record<string, unknown>).status ?? 'PROPOSED'),
  archived: false,
  onHold: false,
  priority: String((entry.facts as Record<string, unknown>).priority ?? 'MEDIUM'),
  projectId: entry.projectId,
  createdAt: fixture.analysis.snapshot.asOf,
  updatedAt: fixture.analysis.snapshot.asOf,
}));

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url.includes('/api/initiatives/runtime-v1/portfolio-scenarios')) {
    return json({ scenarios: fixture.scenarios });
  }
  if (url.includes('/api/organization-context/governed/versions')) {
    return json({ versions: fixture.contextVersions });
  }
  if (url.includes('/api/initiatives/runtime-v1/portfolio-analyses')) {
    // POST (utworzenie) i GET (odczyt trwalego stanu) zwracaja ten sam,
    // zwalidowany serwerowo model odczytu.
    return json({
      version: fixture.analysis.aggregateVersion,
      capture: { status: 'APPLIED', aggregateVersion: 1 },
      analysis: fixture.analysis,
    });
  }
  if (url.includes('/capabilities')) {
    // Bramka uprawnien: tylko uprawniony aktor moze zdecydowac. Harness pokazuje
    // aktora, ktory MOZE recenzowac — inaczej ekran uczciwie chowa akcje.
    return json({ canUpdate: true, canReview: true, canSelfApprove: true });
  }
  if (url.includes('/api/initiatives/runtime-v1/initiatives')) {
    return json({ initiatives: [], nextCursor: null });
  }
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) {
    return json(REGISTER_ROWS);
  }
  return originalFetch(input, init);
};

export default function F2InicjatywyAnalizaScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="f2-inicjatywy-analiza">
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
