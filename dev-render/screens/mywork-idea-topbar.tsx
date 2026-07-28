/**
 * Vegas-render — REALNY `MyWorkHub` z OTWARTĄ ideą, żeby zobaczyć CAŁĄ górę:
 * rząd pilli otwartych dokumentów („Lista · … · …") + Menu 1 powłoki Idei
 * + Menu 3. To jedyny harness, w którym te rzędy stoją razem — same ekrany
 * `?screen=mindmap-canvas` pokazują wyłącznie powłokę Idei, bez pilli huba.
 *
 * PO CO: zgłoszenie właściciela 2026-07-28 „z tego zrobimy jedną linię".
 * Flaga `ff_ideaTopBarOneLine=1` scala klaster poleceń Menu 1 do rzędu pilli
 * (portal do `IDEA_TOP_BAR_SLOT_ID`) i kasuje Menu 3. Bez tego ekranu nie da
 * się sprawdzić WZROKIEM ani scalenia, ani braku nachodzenia rzędów.
 *
 * Mechanika mocków: import `./mindmap-canvas` dla EFEKTÓW UBOCZNYCH — ten
 * moduł już seeduje sesję, podmienia `Api.getMyIdea*` na mock STANOWY i
 * zakłada siatkę bezpieczeństwa na `fetch`. Zero duplikatu fixture'ów.
 *
 * URL: ?screen=mywork-idea-topbar
 *      [&ff_ideaTopBarOneLine=1 → scalony układ]
 *      [&theme=light|dark]
 */
import React from 'react';

// Efekty uboczne: seed sesji + mock Api mapy + siatka bezpieczeństwa fetch
// + wymuszenie `ff_melsCanvas=1`. MUSI być przed importem huba.
import './mindmap-canvas';

import { MyWorkHub } from '../../src/components/MyWork/MyWorkHub';
import { AppProviders } from '../../src/providers/AppProviders';

const IDEA_ID = 'idea-dbr77-demo-mindmap-canvas';

// Rząd pilli huba odtwarza się z `sessionStorage` (`readStoredMyWorkDocuments`).
// Zasiewamy DWIE otwarte idee — dokładnie jak na zrzucie właściciela („Proces
// ofertowania" + aktywna) — żeby było widać kropki statusu i przewijanie kart.
try {
  window.sessionStorage.setItem(
    'moduleHub.openDocuments.mywork',
    JSON.stringify({
      openDocuments: [
        {
          id: 'idea-demo-proces-ofertowania',
          type: 'idea',
          name: 'Proces ofertowania',
          status: 'in_progress',
        },
        {
          id: IDEA_ID,
          type: 'idea',
          name: 'Podnieść marżę na projektach wdrożeniowych',
          status: 'in_progress',
        },
      ],
      activeDocumentId: IDEA_ID,
    })
  );
} catch {
  /* prywatny tryb — hub wystartuje z pustym rzędem pilli */
}

export function MyWorkIdeaTopBarScreen(): React.ReactElement {
  return (
    <AppProviders>
      <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <MyWorkHub />
      </div>
    </AppProviders>
  );
}

export default MyWorkIdeaTopBarScreen;
