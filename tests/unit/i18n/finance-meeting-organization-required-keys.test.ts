import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const LOCALES = ['en', 'pl', 'de', 'ar', 'ja', 'es'] as const;
const REQUIRED_KEYS = [
  'meeting.project',
  'finance.modelWorkspace.assumptionStatus.sourced',
  'finance.modelWorkspace.assumptionStatus.edited',
  'finance.modelWorkspace.assumptionStatus.assumed',
  'finance.modelWorkspace.assumptionStatus.missing',
  'finance.explainPanel.contribution',
  'finance.explainPanel.priorPeriod',
  'finance.explainPanel.currentPeriod',
  'finance.explainPanel.technicalDetails',
  'finance.explainPanel.lineCode',
  'finance.explainPanel.selectedCandidate',
  'organization.knowledgeGraph.stats.entities',
  'organization.knowledgeGraph.stats.relations',
  'organization.knowledgeGraph.stats.avgConfidence',
  'organization.knowledgeGraph.stats.stale',
  'organization.knowledgeGraph.stats.redacted',
  'organization.knowledgeGraph.searchPlaceholder',
  'organization.knowledgeGraph.search',
  'organization.knowledgeGraph.refreshStats',
  'organization.knowledgeGraph.emptyOrg.title',
  'organization.knowledgeGraph.emptyOrg.description',
  'organization.knowledgeGraph.emptyOrg.setupProfile',
] as const;

const localePath = (locale: string) =>
  path.join(process.cwd(), 'public', 'locales', locale, 'translation.json');

const getPath = (value: unknown, dottedPath: string): unknown =>
  dottedPath.split('.').reduce((current: any, segment) => current?.[segment], value);

describe('Finance, Meeting and Organization canonical locale contract', () => {
  it.each(LOCALES)('%s translation.json contains every semantic key', (locale) => {
    const translation = JSON.parse(readFileSync(localePath(locale), 'utf8'));
    for (const key of REQUIRED_KEYS) {
      expect(getPath(translation, key), `${locale}:${key}`).toEqual(expect.any(String));
      expect(String(getPath(translation, key)).trim(), `${locale}:${key}`).not.toBe('');
    }
  });

  it('keeps translation.json as authority instead of module namespace trees', () => {
    for (const locale of LOCALES) {
      for (const namespace of ['finance', 'meeting', 'organization']) {
        expect(
          existsSync(path.join(process.cwd(), 'public', 'locales', locale, `${namespace}.json`))
        ).toBe(false);
      }
    }
  });

  it('keeps English as the explicit fallback for every supported non-English locale', () => {
    const i18nSource = readFileSync(path.join(process.cwd(), 'src', 'i18n.ts'), 'utf8');
    for (const locale of ['pl', 'de', 'es', 'ar', 'ja']) {
      expect(i18nSource, `${locale} must fall back to English`).toContain(
        `${locale}: ['${locale}', 'en']`
      );
    }
    expect(i18nSource).toContain("default: ['en']");
  });

  it('mounts the canonical semantic keys instead of language ternaries', () => {
    const mountedSources = [
      'src/components/Finance/FinancialModelWorkspace.tsx',
      'src/components/Finance/StatementExplainPanel.tsx',
      'src/components/Meeting/MeetingHub.tsx',
      'src/components/Organization/KnowledgeGraphExplorer.tsx',
    ].map((file) => readFileSync(path.join(process.cwd(), file), 'utf8'));
    const mounted = mountedSources.join('\n');

    for (const key of REQUIRED_KEYS) expect(mounted, key).toContain(key);
    expect(mounted).not.toMatch(/isPl(?:ish)?\s*\?\s*['"](?:Projekt|Wkład|Ze źródła)/);
  });
});
