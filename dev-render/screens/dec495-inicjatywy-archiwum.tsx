/**
 * DEC-495 (2026-09-14) — REALNY <InitiativesHub> z przelacznikiem
 * „Aktywne / Wszystkie / Archiwalne".
 *
 * Wzorzec 1:1 z `p2b-inicjatywy-empty.tsx` (patrz tam po uzasadnienie
 * wylaczenia demo-fallbacku i mockowania OBU wolan rejestru). Roznica: atrapa
 * `/api/initiatives` odtwarza REALNY kontrakt naprawionej trasy zamiast
 * ulatwiac sobie zycie —
 *   brak parametru        -> tylko aktualne,
 *   ?includeArchived=true -> aktualne + archiwalne,
 *   ?archived=true        -> wylacznie archiwalne.
 * Gdyby atrapa zwracala zawsze wszystko, zrzut pokazywalby przyrzad, nie
 * produkt (kształt 15 z pamieci nadzorcy).
 *
 * Rejestr wola ja z `includeArchived=true` i przycina wiersze lokalnie
 * (`rowMatchesRegisterScope`), bo wiersz moze przyjsc rowniez z projekcji
 * runtime-v1, ktora flagi archiwum nie zna.
 *
 * Query: &theme=light|dark, &lang=pl|en
 */
import React from 'react';

import { InitiativesHub } from '../../src/components/Initiatives/InitiativesHub';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// ZGLOSZENIE (znalezione przy budowie tego ekranu, dotyczy TAKZE
// `p2b-inicjatywy-empty.tsx`): sam zapis `isDemoMode:false` do localStorage NIE
// wystarcza. `seedRealisticSession()` robi `useAppStore.setState({isDemoMode:true})`,
// a zustand `persist` dopisuje ten stan do localStorage z ~300 ms opoznieniem i
// NADPISUJE nasze `false`. `shouldAllowDemoData()` czyta localStorage, wiec po
// pierwszym przerysowaniu ekran po cichu przelacza sie na wbudowany zestaw demo
// (zmierzone: 3 realne wiersze przy mount, 9 angielskich wierszy demo po
// kliknieciu w pstryczek). Dlatego gasimy flage rowniez w STORE.
useAppStore.setState({ isDemoMode: false });

try {
  const raw = window.localStorage.getItem('consultify-storage');
  const parsed = raw ? JSON.parse(raw) : { state: {} };
  parsed.state = { ...parsed.state, isDemoMode: false, isDemoSession: false };
  window.localStorage.setItem('consultify-storage', JSON.stringify(parsed));
} catch {
  // ignore — brak localStorage nie powinien wywalic harnessu
}

const ORG_ID = 'org-dec495';

const legacyRow = (
  id: string,
  name: string,
  status: string,
  archived: boolean,
  priority: string
) => ({
  id,
  organizationId: ORG_ID,
  name,
  title: name,
  summary: archived
    ? 'Zarchiwizowana — domyslnie ukryta w rejestrze.'
    : 'Aktualna pozycja rejestru inicjatyw.',
  status,
  archived,
  onHold: false,
  priority,
  createdAt: '2026-09-01T09:00:00.000Z',
  updatedAt: '2026-09-12T09:00:00.000Z',
});

const ROWS = [
  legacyRow('i-a1', 'Migracja hurtowni danych', 'IN_EXECUTION', false, 'HIGH'),
  legacyRow('i-a2', 'Standaryzacja obiegu faktur', 'APPROVED', false, 'MEDIUM'),
  legacyRow('i-a3', 'Portal samoobslugowy dla klienta', 'PENDING_APPROVAL', false, 'HIGH'),
  legacyRow('i-a4', 'Konsolidacja raportowania zarzadczego', 'CLOSED', false, 'LOW'),
  legacyRow('i-z1', 'Pilotaz RPA w ksiegowosci', 'CLOSED', true, 'MEDIUM'),
  legacyRow('i-z2', 'Wymiana systemu MES (wstrzymana)', 'REJECTED', true, 'LOW'),
  legacyRow('i-z3', 'Program oszczednosci energii 2024', 'CLOSED', true, 'HIGH'),
];

const originalFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = String(input);
  if (url.includes('/api/initiatives/runtime-v1/initiatives')) {
    // Projekcja runtime-v1 jest tu pusta — rejestr backfilluje z tabeli legacy
    // (ta sama sciezka, ktora mierzy `InitiativesHub.fetchData`).
    return new Response(JSON.stringify({ initiatives: [], nextCursor: null }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  if (url.includes('/api/initiatives') && !url.includes('runtime-v1')) {
    const includeArchived = url.includes('includeArchived=true');
    const onlyArchived = !includeArchived && url.includes('archived=true');
    const rows = includeArchived
      ? ROWS
      : ROWS.filter((row) => (onlyArchived ? row.archived : !row.archived));
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return originalFetch(input, init);
};

export default function Dec495InicjatywyArchiwumScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh' }} data-testid="dec495-inicjatywy-archiwum">
        <InitiativesHub />
      </div>
    </AppProviders>
  );
}
