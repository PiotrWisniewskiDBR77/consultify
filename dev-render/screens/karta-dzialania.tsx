import React from 'react';

import { ActionCard } from '../../src/components/standard/ActionCard';

export default function KartaDzialaniaScreen() {
  return (
    <main className="min-h-screen bg-c-app p-8 text-c-text">
      <div className="mx-auto max-w-3xl">
        <ActionCard card={{
          id: 'action-demo-1', sourceKind: 'kpi_deviation', sourceId: 'kpi-demo-1',
          periodStart: '2026-09-01', periodEnd: '2026-09-30', goalMet: false,
          actionRequired: true, problem: 'Wskaźnik terminowości spadł poniżej progu 92%.',
          rootCause: 'Brak właściciela kontroli danych wejściowych.',
          actionText: 'Wyznaczyć właściciela i uruchomić cotygodniową kontrolę jakości.',
          ownerName: 'Anna Kowalska', dueDate: '2026-10-05',
          comment: 'Pierwszy przegląd na odprawie operacyjnej.', status: 'OPEN', severity: 'RED',
        }} />
      </div>
    </main>
  );
}
