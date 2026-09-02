/**
 * Dev-render host dla #87c (rewizja 07-13) — GŁÓWNY PASEK panelu dokumentu
 * Work Canvas (`data-testid="canvas-header"`) po naprawie: ikona „Historia"
 * zdjęta z widoku głównego (trigger przeniesiony do kebaba „⋯", sekcja
 * „Manual editing"), import/eksport Markdown w grupie akcji plikowych.
 *
 * ★ NAPRAWA PARYTETU 2026-09-02 (reguła 17 `00_ZASADY_PRACY.md`, bramka R1).
 *
 * Poprzednia wersja tego pliku ODTWARZAŁA 1:1 markup paska i kebaba — własne
 * `ToolbarGroup`, własne `NewBadge`, własne ikony, dwa `?variant=`. Nagłówek
 * tłumaczył to zdaniem: „real component ciągnie cały canvas draft store i nie
 * zmontuje się tu". **To jest nieprawda i została obalona pomiarem:**
 * siostrzany `dev-render/screens/canvas-new-doc.tsx` montuje ten sam
 * `WorkCanvasDocumentPanel` bez backendu od 2026-09-01.
 *
 * Dlaczego to było groźne akurat tutaj: ekran twierdził, że pasek NIE MA ikony
 * Historii. Sprawdzić to na kopii markupu jest niemożliwe — kopia pokazuje
 * dokładnie to, co jej autor wpisał. Dopiero realny komponent może zaprzeczyć.
 * (W produkcie `data-testid="canvas-history-root"` istnieje nadal, ale jest
 * już tylko kotwicą popovera `CanvasVersionHistory`, bez własnej ikony —
 * `WorkCanvasDocumentPanel.tsx:3660-3680`.)
 *
 * ZDJĘTY `?variant=kebab`: montował drugi raz to samo, co
 * `?screen=canvas-kebab-restructure` (tam kebab jest otwierany klikiem
 * w realny trigger). Dwa identyczne kadry w odbiorze to podwójna praca
 * właściciela, nie podwójny dowód. Ten ekran pokazuje PASEK, tamten KEBAB.
 *
 * Montuje REALNY `WorkCanvasDocumentPanel`
 * (`src/components/AIChat/WorkCanvasDocumentPanel.tsx:795`, wołany produkcyjnie
 * przez `src/components/AIChat/UnifiedChatPanel.tsx:7380`) — bez klikania
 * czegokolwiek, bo pasek jest widoczny od razu po montażu.
 *
 * URL: ?screen=canvas-toolbar-md-history[&theme=light|dark][&lang=pl|en]
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { WorkCanvasDocumentPanel } from '../../src/components/AIChat/WorkCanvasDocumentPanel';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';

const OTHER_DRAFTS = [
  {
    id: 'draft-diagnoza',
    title: 'Diagnoza wąskich gardeł — Atelier Toys',
    kind: 'document',
    contentMd:
      '# Diagnoza wąskich gardeł\n\nLinia pakowania traci 18% wydajności na przezbrojeniach.',
    updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'draft-oferta',
    title: 'Notatka z warsztatu zarządu',
    kind: 'document',
    contentMd: '# Warsztat zarządu\n\nTrzy decyzje do domknięcia przed końcem kwartału.',
    updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

useAppStore.setState({
  currentUser: {
    id: 'usr-piotr',
    email: 'piotr@atelier-toys.pl',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    role: 'OWNER',
    organizationId: 'org-atelier-toys-0001',
  },
  currentOrganization: { id: 'org-atelier-toys-0001', name: 'Atelier Toys Sp. z o.o.' },
  isAuthInitializing: false,
} as never);

Object.assign(Api, {
  workCanvasListDrafts: async () => OTHER_DRAFTS,
});

// Panel hydratuje draft DRUGĄ ścieżką — surowym `fetch('/api/work-canvas/drafts
// ?conversationId=')` (`WorkCanvasDocumentPanel.tsx:1271`), obok
// `Api.workCanvasListDrafts` (linia 1939). Bez backendu daje to 404 w konsoli.
// Kadr był poprawny mimo tego (panel wchodzi na starter domyślny), ale czerwień
// w konsoli maskuje przyszłe, prawdziwe błędy — więc podstawiamy PUSTĄ kopertę
// w kształcie SERWERA (`{ data: [] }`, reguła 21), nie w kształcie wygodnym
// dla frontu. Pusta lista = ten sam stan co dziś, bez fałszywego alarmu.
const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (url.includes('/api/work-canvas/drafts?')) {
    return new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return realFetch(input as RequestInfo, init);
};

export default function CanvasToolbarMdHistoryScreen(): React.ReactElement {
  return (
    <MemoryRouter initialEntries={['/chat']}>
      <div className="h-screen w-screen overflow-hidden bg-c-bg">
        <WorkCanvasDocumentPanel conversationId="conv-atelier-toys-0001" />
      </div>
    </MemoryRouter>
  );
}
