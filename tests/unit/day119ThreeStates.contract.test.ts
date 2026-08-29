import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  formatPresentationCount,
  knownPresentation,
  partialPresentation,
  unknownPresentation,
} from '../../src/utils/presentationState';

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Day 119 three-state presentation contract', () => {
  it('renders a known zero as an honest zero', () => {
    expect(
      formatPresentationCount(knownPresentation(0), { hidden: 'hidden', unknown: 'unknown' })
    ).toBe('0');
  });

  it('renders a partial count with hidden scale and reason', () => {
    expect(
      formatPresentationCount(partialPresentation(2, 3, 'restricted'), {
        hidden: 'hidden',
        unknown: 'unknown',
      })
    ).toBe('2 · 3 hidden: restricted');
  });

  it('renders an unknown count as an explicit error instead of zero', () => {
    expect(
      formatPresentationCount(unknownPresentation('read failed'), {
        hidden: 'hidden',
        unknown: 'unknown',
      })
    ).toBe('— · unknown: read failed');
  });

  it('applies the shared contract to Assessment status chips', () => {
    const source = read('src/components/assessment/AssessmentHub.tsx');
    expect(source).toContain('formatPresentationCount(');
    expect(source).toContain('partialPresentation(');
    expect(source).toContain('outputStatusHiddenReason');
  });

  it('does not turn an Insight findings read failure into an empty array', () => {
    const source = read('src/components/Interview/InsightViewer.tsx');
    const loader = source.slice(
      source.indexOf('const loadPersistedFindings'),
      source.indexOf('const loadInsightAnalysis')
    );
    expect(loader).toContain('setFindingsPresentation(');
    expect(loader).toContain('findingsLoadFailedReason');
    expect(loader).not.toContain('return [];');
  });

  it('renders Interview template read failure separately from a known empty list', () => {
    const source = read('src/components/Interview/InterviewHub.tsx');
    expect(source).toContain("templatesPresentation.state === 'unknown'");
    expect(source).toContain('formatPresentationCount(templatesPresentation');
    expect(source).toContain('templatesLoadFailedReason');
    const templatesBranch = source.slice(
      source.indexOf("if (activeTab === 'templates')", source.indexOf('const renderListContent')),
      source.indexOf("if (activeTab === 'my_assignments'", source.indexOf('const renderListContent'))
    );
    expect(templatesBranch).toContain('{renderDegradedBanner()}');
  });

  it('ships the shared copy in English and Polish', () => {
    const en = JSON.parse(read('public/locales/en/translation.json'));
    const pl = JSON.parse(read('public/locales/pl/translation.json'));
    expect(en.presentationState.findingsLoadFailedReason).toBeTruthy();
    expect(pl.presentationState.findingsLoadFailedReason).toBeTruthy();
    expect(en.presentationState.templatesLoadFailedReason).toBeTruthy();
    expect(pl.presentationState.templatesLoadFailedReason).toBeTruthy();
  });
});
