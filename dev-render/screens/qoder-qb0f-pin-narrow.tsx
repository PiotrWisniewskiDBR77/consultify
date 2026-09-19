/**
 * QB0f (Wpis 234/242, DEC-691) — dowód zawężenia PIN-u biblioteki wzorców.
 *
 * Montuje REALNY <ReportsAndPresentationsHub />; wiersze przechodzą przez
 * produkcyjną ścieżkę: fetch (stub w ../mocks/qb0f-pin-narrow-fetch) →
 * `mapCanonicalTemplateArtifact` → `useTemplates` (sort updatedAt DESC + PIN) →
 * <TemplatesTabContent />.
 *
 * Cel zrzutu (rule #7): biblioteka orgu niesie 20 KEEP TPL-1b (legacy DOC-BASE,
 * `scope:'system'`) + trzy kanoniczne bazy. PRZED zawężeniem predykatu PIN
 * łapał wszystkie 21 kart DOC-BASE i ustawiał je na górze; PO zawężeniu o
 * `source !== 'legacy'` na górze zostaje wyłącznie kanoniczna baza, a 20 KEEP
 * wraca do zwykłego sortu po dacie. Różnicę widać gołym okiem.
 *
 * URL: ?screen=qoder-qb0f-pin-narrow&tab=templates[&lang=pl|en][&theme=light|dark]
 */
import '../mocks/qb0f-pin-narrow-fetch';

import React from 'react';

import { ReportsAndPresentationsHub } from '../../src/components/ReportsAndPresentations/ReportsAndPresentationsHub';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { AppProviders } from '../../src/providers/AppProviders';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

export default function QoderQb0fPinNarrowScreen(): React.ReactElement {
  return (
    <FeatureFlagsProvider>
      <AppProviders>
        <div className="h-screen min-h-0 bg-c-canvas text-c-text" data-testid="qb0f-pin-narrow">
          <ReportsAndPresentationsHub />
        </div>
      </AppProviders>
    </FeatureFlagsProvider>
  );
}
