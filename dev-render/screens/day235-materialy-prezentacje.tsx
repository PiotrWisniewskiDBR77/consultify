/** Day 235: real deck template builder with a four-slide fixture. */
import React from 'react';

import type { TemplateDraft } from '@/components/TemplateBuilder';
import { TemplateBuilder } from '@/components/TemplateBuilder';

const draft: TemplateDraft = {
  type: 'deck',
  name: 'Transformacja operacyjna — przegląd zarządczy',
  description: 'Czterosllajdowy pakiet decyzji dla komitetu sterującego.',
  scope: 'org',
  themeRef: 'brand-navy',
  doc: [],
  table: [],
  deck: [
    {
      id: 's1',
      title: 'Transformacja operacyjna',
      archetype: 'cover',
      hint: 'Cel, sponsor i horyzont 90 dni',
      aiFilled: false,
    },
    {
      id: 's2',
      title: 'Stan programu',
      archetype: 'kpi',
      hint: 'Postęp, budżet, ryzyka i decyzje',
      aiFilled: true,
    },
    {
      id: 's3',
      title: 'Plan 30 / 60 / 90 dni',
      archetype: 'roadmap',
      hint: 'Kamienie milowe i właściciele',
      aiFilled: true,
    },
    {
      id: 's4',
      title: 'Decyzje komitetu',
      archetype: 'closing',
      hint: 'Trzy decyzje z terminami',
      aiFilled: false,
    },
  ],
};

export default function Day235MaterialyPrezentacjeScreen(): React.ReactElement {
  return (
    <TemplateBuilder
      initialDraft={draft}
      persistRailState={false}
      saveFn={async () => ({ id: 'day235-deck-fixture' })}
    />
  );
}
