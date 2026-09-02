/**
 * Dev-render host dla #87d — kebab „⋯" panelu dokumentu Work Canvas
 * (`data-testid="canvas-diagnostics-menu"`) PO restrukturyzacji: nazwane,
 * ZWIJALNE grupy-akordeony zamiast jednej długiej listy.
 *
 * ★ NAPRAWA PARYTETU 2026-09-02 (reguła 17 `00_ZASADY_PRACY.md`, bramka R1).
 *
 * Poprzednia wersja tego pliku ODTWARZAŁA 1:1 markup kebaba — własne
 * `SectionHeader`/`Row`/`GroupSummary`, własne etykiety, własna lista pozycji.
 * Nagłówek tłumaczył to zdaniem: „real component nie montuje się tu (ciągnie
 * cały canvas draft store + API)". **To jest nieprawda i została obalona
 * pomiarem:** siostrzany ekran `dev-render/screens/canvas-new-doc.tsx` montuje
 * ten sam `WorkCanvasDocumentPanel` bez backendu od 2026-09-01 — wystarczy
 * wypełnić store auth i podstawić `Api.workCanvasListDrafts`.
 *
 * Skutek starej wersji: właściciel oceniał KOPIĘ markupu, która nie starzeje
 * się razem z produktem. Kopia zamarza w dniu jej napisania, produkt idzie
 * dalej — a ocena „A" zostaje przy obrazie, którego w aplikacji nie ma.
 *
 * Teraz montuje się REALNY `WorkCanvasDocumentPanel`
 * (`src/components/AIChat/WorkCanvasDocumentPanel.tsx:795`, wołany produkcyjnie
 * przez `src/components/AIChat/UnifiedChatPanel.tsx:7380`), a harness tylko
 * KLIKA realny trigger kebaba — bo dropdown jest stanem komponentu, a
 * `grafika-zrzuty.mjs` nie klika UI. Cały widoczny markup pochodzi z produkcji.
 *
 * URL: ?screen=canvas-kebab-restructure[&theme=light|dark][&lang=pl|en]
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

export default function CanvasKebabRestructureScreen(): React.ReactElement {
  // Otwórz REALNY kebab „⋯" po zamontowaniu panelu (dropdown jest stanem
  // komponentu — patrz nagłówek). Selektor 1:1 z produkcji: trigger siedzi
  // w `[data-testid="canvas-menu-root"]`, sam dropdown ma
  // `data-testid="canvas-diagnostics-menu"`.
  React.useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      const trigger = document.querySelector<HTMLButtonElement>(
        '[data-testid="canvas-menu-root"] button'
      );
      if (trigger) {
        trigger.click();
        window.clearInterval(timer);
        return;
      }
      if (++tries > 40) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  // ★ NAPRAWA 2026-09-02 (odbiór nadzorcy po Z-48): zwinięta sekcja NIE jest
  // dowodem, że w środku jest polski — trzeba zmierzyć każdą. Rozwijamy
  // WSZYSTKIE natywne `<details>` akordeonu wewnątrz kebaba (każda grupa menu
  // jest zwykłym `<details>/<summary>`, bez React-owego stanu open/close —
  // ustawienie `.open = true` na elemencie DOM jest więc 1:1 z kliknięciem
  // użytkownika w nagłówek grupy), żeby zrzut pokazywał TREŚĆ każdej sekcji,
  // nie tylko jej zwinięty nagłówek.
  React.useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      const menu = document.querySelector<HTMLElement>('[data-testid="canvas-diagnostics-menu"]');
      if (menu) {
        menu.querySelectorAll<HTMLDetailsElement>('details').forEach((details) => {
          details.open = true;
        });
        window.clearInterval(timer);
        return;
      }
      if (++tries > 60) window.clearInterval(timer);
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <MemoryRouter initialEntries={['/chat']}>
      <div className="h-screen w-screen overflow-hidden bg-c-bg">
        <WorkCanvasDocumentPanel conversationId="conv-atelier-toys-0001" />
      </div>
    </MemoryRouter>
  );
}
