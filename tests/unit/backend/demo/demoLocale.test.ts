import { describe, expect, it } from 'vitest';

import { normalizeDemoLocale } from '../../../../server/src/services/demo/demoLocale.ts';
import {
  getAtelierToysDemoScenarios,
  getAtelierToysKnowledgeDocs,
  getAtelierToysInitiatives,
  getAtelierToysLeadership,
  getAtelierToysProjects,
  getAtelierToysPrompts,
  getAtelierToysReports,
  getAtelierToysToolCoverage,
} from '../../../../server/src/services/demo/atelierToysDemoTemplate.ts';

describe('demo locale helpers', () => {
  it('normalizes only supported bilingual locales', () => {
    expect(normalizeDemoLocale('pl-PL')).toBe('pl');
    expect(normalizeDemoLocale('en-US')).toBe('en');
    expect(normalizeDemoLocale('de-DE')).toBe('en');
    expect(normalizeDemoLocale(undefined)).toBe('en');
  });

  it('returns localized scenarios and coverage for polish demo sessions', () => {
    const scenario = getAtelierToysDemoScenarios('pl').find((item) => item.id === 'factory-operations');
    const coverage = getAtelierToysToolCoverage('pl').find((item) => item.tool === 'Portfolio i PMO');

    expect(scenario?.title).toBe('Operacje Zakładu');
    expect(coverage?.ahaMoment).toContain('workflow');
  });

  it('localizes seeded initiative copy without changing shared slugs', () => {
    const initiative = getAtelierToysInitiatives('pl').find((item) => item.slug === 'line-3-digital-twin');

    expect(initiative?.slug).toBe('line-3-digital-twin');
    expect(initiative?.name).toBe('Rollout Digital Twin dla Linii 3');
    expect(initiative?.tasks[0]?.title).toBe('Domknąć luki czujników na Linii 3');
  });

  it('keeps bilingual dataset structure aligned across EN and PL', () => {
    expect(getAtelierToysLeadership('pl')).toHaveLength(getAtelierToysLeadership('en').length);
    expect(getAtelierToysProjects('pl')).toHaveLength(getAtelierToysProjects('en').length);
    expect(getAtelierToysInitiatives('pl')).toHaveLength(getAtelierToysInitiatives('en').length);
    expect(getAtelierToysReports('pl')).toHaveLength(getAtelierToysReports('en').length);
    expect(getAtelierToysKnowledgeDocs('pl')).toHaveLength(getAtelierToysKnowledgeDocs('en').length);
    expect(getAtelierToysPrompts('pl')).toHaveLength(getAtelierToysPrompts('en').length);
    expect(getAtelierToysToolCoverage('pl')).toHaveLength(getAtelierToysToolCoverage('en').length);
    expect(getAtelierToysDemoScenarios('pl')).toHaveLength(getAtelierToysDemoScenarios('en').length);
  });
});
