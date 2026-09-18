/**
 * Dev-render: D-28 (DLUG-PO-MVP, P2/S) — REALNY <PreviewRelations> z relacją bez
 * własnego kindu (label = surowy UUID, `type` nieustawiony), żeby zmierzyć
 * generyczny fallback etykiety w bloku RELATIONS podglądu.
 *
 * Przed naprawą `relationFallbackLabel(undefined)` oddawał twardy literał PL
 * „Powiązany rekord" niezależnie od języka — w EN UI chip czytał się po polsku.
 * Po naprawie generyk idzie przez parę i18n `sharedComponents.relationKind.record`
 * (EN „Linked record" / PL „Powiązany rekord"), więc `&lang=en` pokazuje angielski,
 * a `&lang=pl` zachowuje polski (bez regresji; spójne z e2e harness PL, który
 * asertuje tytuł `Powiązany rekord — …`).
 *
 * Drugi chip (kind `project`) to KONTROLA: jego etykieta „Linked project" pochodzi
 * z pary MTG-1 v2 (Wpis 70 P2) i NIE zmienia się w tej naprawie — dowód, że D-28
 * dotyka wyłącznie generycznego fallbacku, nie nazwanych kindów.
 */
import React from 'react';

import { PreviewRelations } from '../../src/components/shared/PreviewPane/PreviewRelations';

const GENERIC_UUID = 'd585884f-6cd0-4be2-ae04-abaf0c223659';

export default function D28RelationFallbackScreen() {
  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>
      <PreviewRelations
        items={[
          // Relacja bez kindu → generyczny fallback (D-28).
          { id: GENERIC_UUID, label: GENERIC_UUID },
          // Kontrola: kind nazwany (para MTG-1 v2), etykieta niezmienna.
          { id: 'proj-control', label: 'Project: annual-rollout', type: 'project' },
        ]}
      />
    </div>
  );
}
