/**
 * Wpis 159 pkt 1 (DEC-655) — dowód PIN-u trzech baz systemowych.
 *
 * Montuje REALNY <ReportsAndPresentationsHub />; wiersze przechodzą przez
 * produkcyjną ścieżkę: fetch (stub w ../mocks/w159-template-pin-fetch,
 * importowany PIERWSZY, bo loader flag strzela fetch-em już w fazie importu)
 * → `mapCanonicalTemplateArtifact` → `useTemplates` (sort updatedAt DESC + PIN)
 * → <TemplatesTabContent />.
 *
 * Cel zrzutu (rule #7): trzy bazy systemowe (family DOC-BASE/DECK-BASE/SHEET-BASE,
 * `system:true`) mają STARSZE `updatedAt` niż wzorce organizacji. Bez pina
 * wylądowałyby NA DOLE (sort malejący po dacie). Z pinem są ZAWSZE na górze
 * biblioteki — to widać gołym okiem na zrzucie.
 *
 * URL: ?screen=qoder-w159-template-pin&tab=templates[&lang=pl|en][&theme=light|dark]
 */
import '../mocks/w159-template-pin-fetch';

import React from 'react';

import { ReportsAndPresentationsHub } from '../../src/components/ReportsAndPresentations/ReportsAndPresentationsHub';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

export default function QoderW159TemplatePinScreen(): React.ReactElement {
  return (
    <FeatureFlagsProvider>
      <AppProviders>
        <div className="h-screen min-h-0 bg-c-canvas text-c-text" data-testid="w159-template-pin">
          <ReportsAndPresentationsHub />
        </div>
      </AppProviders>
    </FeatureFlagsProvider>
  );
}
