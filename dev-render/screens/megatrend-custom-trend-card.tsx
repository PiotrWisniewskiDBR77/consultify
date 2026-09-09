/**
 * JEZYK-CRIMSON-3 (09.09) — dowod wzrokiem dla CustomTrendCard.tsx
 * (przycisk "Add to the list?", AI Suggestion Banner).
 *
 * CustomTrendCard JEST osiagalny na zywo (MegatrendsWorkspace.tsx importuje
 * go i renderuje pod trasa /discovery-tools/strategic/megatrends), ale
 * automatyczna nawigacja w tej sesji trafila na bramke dostepu (przekierowanie
 * do /interview) — harness montuje go wiec STANDALONE z atrapa danych, tak
 * samo jak pozostale dwa miejsca tej paczki, dla spojnego dowodu.
 *
 * URL: ?screen=megatrend-custom-trend-card&lang=pl|en&theme=light|dark
 */
import React, { useState } from 'react';

import { CustomTrendCard } from '../../src/components/Megatrend/CustomTrendCard';

interface CustomTrend {
  id: string;
  label: string;
  description: string;
  type: 'Technology' | 'Business' | 'Societal';
  ring: 'Now' | 'Watch Closely' | 'On the Horizon';
}

export default function MegatrendCustomTrendCardScreen(): React.ReactElement {
  const [trends, setTrends] = useState<CustomTrend[]>([
    {
      id: 'ct-1',
      label: 'Local competitor price war',
      description: 'Aggressive discounting from a regional competitor is compressing margins.',
      type: 'Business',
      ring: 'Now',
    },
  ]);

  return (
    <div className="min-h-screen bg-c-bg p-8">
      <div className="mx-auto max-w-3xl">
        <CustomTrendCard
          trends={trends}
          onAdd={(t) => setTrends((prev) => [...prev, { ...t, id: `ct-${prev.length + 1}` }])}
          onDelete={(id) => setTrends((prev) => prev.filter((t) => t.id !== id))}
        />
      </div>
    </div>
  );
}
