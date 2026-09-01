/**
 * Dev-render: #87a — menu „+" (Nowy canvas) w panelu dokumentu Work Canvas.
 *
 * ★ NAPRAWA PARYTETU 2026-09-01 (AUDYT_PRZYRZADU_20260901.md, Kategoria 4).
 * Poprzednia wersja tego pliku ODTWARZAŁA 1:1 markup dropdownu — własne
 * `CapabilityBadge`, własne etykiety, własne stany. Nagłówek pliku tłumaczył
 * to tym, że „realny komponent ciągnie Api.workCanvasListDrafts i cały store
 * draftów, więc się tu nie zmontuje". To okazało się nieprawdą: panel montuje
 * się bez backendu, jeśli podstawić DWA wołania (lista draftów + lista
 * konwersacji) i wypełnić store auth — co ten plik teraz robi. Właściciel
 * ocenia więc realny `WorkCanvasDocumentPanel`
 * (`src/components/AIChat/WorkCanvasDocumentPanel.tsx`, montowany produkcyjnie
 * przez `UnifiedChatPanel.tsx:7380`), a nie kopię jego markupu.
 *
 * Menu „+" jest dropdownem — otwiera je KLIKNIĘCIE. `grafika-zrzuty.mjs` nie
 * klika UI, więc harness klika sam, po montażu, w REALNY przycisk
 * (`[data-testid="canvas-new-menu-root"] button`). To sterowanie realnym
 * komponentem, nie podmiana jego treści: cały widoczny markup pochodzi
 * z produkcji.
 *
 * Flaga `ff_canvasNewDocOptions` jest domyślnie ON (zaakceptowana 07-13), więc
 * nie ustawiamy jej tutaj — harness ma pokazywać stan domyślny.
 *
 * URL: ?screen=canvas-new-doc[&lang=pl|en][&theme=light|dark]
 *      &fromCanvasState=populated|empty (default populated — lista „Z canvasa")
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { WorkCanvasDocumentPanel } from '../../src/components/AIChat/WorkCanvasDocumentPanel';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';

const params = new URLSearchParams(window.location.search);
const fromCanvasState = params.get('fromCanvasState') || 'populated';

const OTHER_DRAFTS =
  fromCanvasState === 'empty'
    ? []
    : [
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

export default function CanvasNewDocScreen(): React.ReactElement {
  // Otwórz REALNE menu „+" po zamontowaniu panelu (dropdown jest stanem
  // komponentu, a narzędzie zrzutowe nie klika — patrz nagłówek).
  React.useEffect(() => {
    let tries = 0;
    const timer = window.setInterval(() => {
      const trigger = document.querySelector<HTMLButtonElement>(
        '[data-testid="canvas-new-menu-root"] button'
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

  return (
    <MemoryRouter initialEntries={['/chat']}>
      <div className="h-screen w-screen overflow-hidden bg-c-bg">
        <WorkCanvasDocumentPanel conversationId="conv-atelier-toys-0001" />
      </div>
    </MemoryRouter>
  );
}
