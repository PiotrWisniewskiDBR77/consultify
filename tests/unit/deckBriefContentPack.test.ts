import { describe, expect, it } from 'vitest';

import { coercePack } from '../../server/src/services/deckBriefContentPack.js';

/**
 * Kontrakt kształtu JSON→artifactData dla generatora content-packu decka z czatu
 * (Fala A3, obejście silnika). coercePack jest pure — testujemy parsowanie i
 * koercję do pól, które konsumuje buildSlideContentBase, oraz fail-soft na
 * śmieciach. Sam LLM-call weryfikowany live (treść).
 */
describe('deckBriefContentPack.coercePack', () => {
  it('mapuje pełny, dobrze uformowany JSON na pola artifactData', () => {
    const raw = JSON.stringify({
      key_findings: ['Pilot ograniczył błędy o 30% (założenie)', 'Cykl skrócony do 1,8 dnia'],
      key_messages: [{ title: 'Skala', description: 'Rekomendujemy roll-out na całą organizację.' }],
      recommendations: [
        { title: 'Roll-out', description: 'Wdrożyć na pozostałe działy', impact: 'High', priority: 'high', category: 'Transformacja' },
      ],
      headline_recommendation: 'Zatwierdzić pełne wdrożenie w Q3 (założenie).',
      actions: [{ action: 'Zatwierdzić budżet', owner: 'Sponsor', deadline: '30 dni (założenie)' }],
      root_causes: [{ cause: 'Ręczne przetwarzanie', impact: 'Opóźnienia', severity: 'high' }],
      risks: [{ risk: 'Opór zmian', likelihood: 'medium', impact: 'high', mitigation: 'Szkolenia', owner: 'HR' }],
      phases: [
        { label: 'Faza 1', timeframe: '0-3m', items: ['Pilot+'] },
        { label: 'Faza 2', timeframe: '3-6m', items: [] },
        { label: 'Faza 3', timeframe: '6-12m', items: [] },
      ],
      kpis: [{ label: 'ROI', value: 187, unit: '%' }],
    });
    const pack = coercePack(raw);
    expect(pack).not.toBeNull();
    expect(pack?._keyFindings).toHaveLength(2);
    expect(pack?._keyMessages?.[0]).toEqual({ title: 'Skala', description: 'Rekomendujemy roll-out na całą organizację.' });
    expect(pack?._recommendations?.[0].priority).toBe('high');
    expect(pack?._recommendation).toContain('Q3');
    expect(pack?._actions?.[0].owner).toBe('Sponsor');
    expect(pack?._rootCauses?.[0].severity).toBe('high');
    expect(pack?._risks?.[0].likelihood).toBe('medium');
    expect(pack?._phases).toHaveLength(3);
    expect(pack?._kpis?.[0]).toEqual({ label: 'ROI', value: 187, unit: '%' });
    expect(pack?._performanceKpis?.[0].label).toBe('ROI');
  });

  it('toleruje fence markdown i braki pól (częściowy pack)', () => {
    const raw = '```json\n' + JSON.stringify({ key_findings: ['Jedno ustalenie'] }) + '\n```';
    const pack = coercePack(raw);
    expect(pack?._keyFindings).toEqual(['Jedno ustalenie']);
    expect(pack?._keyMessages).toBeUndefined();
  });

  it('odrzuca puste/śmieciowe wejście jako null (fail-soft)', () => {
    expect(coercePack('nie-json')).toBeNull();
    expect(coercePack('')).toBeNull();
    expect(coercePack('{}')).toBeNull();
    expect(coercePack(JSON.stringify({ key_findings: [] }))).toBeNull();
    expect(coercePack(JSON.stringify({ unrelated: 'x' }))).toBeNull();
  });

  it('odfiltrowuje wpisy bez wymaganych pól, nie wysypuje się', () => {
    const raw = JSON.stringify({
      key_messages: [{ title: 'x' }, { description: 'ok wniosek' }],
      recommendations: [{ description: 'brak title' }],
      kpis: [{ label: 'brak value' }, { label: 'ok', value: 5 }],
    });
    const pack = coercePack(raw);
    // key_messages: pierwszy bez description odpada, drugi zostaje (title dziedziczy z opisu)
    expect(pack?._keyMessages).toHaveLength(1);
    // recommendations bez title → odpada → pole nieobecne
    expect(pack?._recommendations).toBeUndefined();
    // kpis bez value → odpada, zostaje 1
    expect(pack?._kpis).toHaveLength(1);
  });
});
