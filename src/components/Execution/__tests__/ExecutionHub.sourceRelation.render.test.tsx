/**
 * Real-render replacement for the deleted ExecutionHub.sourceRelation.contract.test.ts
 * (a source-text grep that could pass even when the rendered output was wrong).
 *
 * ExecutionHub.tsx is 6000+ lines and needs many providers to mount whole, so
 * this test exercises the exact same path the Portfolio-tab preview uses —
 * `buildExecutionSourceRelations` (extracted verbatim from ExecutionHub, see
 * ../executionSourceRelations.ts) feeding a REAL `<StandardPreview>` mount —
 * and asserts on the rendered DOM, not on ExecutionHub.tsx's source text.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StandardPreview } from '../../standard/StandardPreview';
import { buildExecutionSourceRelations } from '../executionSourceRelations';

// getSourceDisplayLabel() (used inside buildExecutionSourceRelations) reads
// off the global i18n instance directly, not the react-i18next hook — mirror
// the EN dictionary from InitiativeSourceLink.getSourceDisplayLabel.test.ts
// so 'assessment' resolves to a real human label instead of a test double.
const EN_SOURCE_LABELS: Record<string, string> = {
  'initiatives.initiativeSourceLink.assessment': 'Assessment',
};
vi.mock('@/i18n', () => ({
  default: { t: (key: string) => EN_SOURCE_LABELS[key] ?? key, language: 'en' },
}));

// StandardPreview itself calls useTranslation() for its own chrome (Relations
// header, empty-state copy, etc.) — return the fallback text like the R03-1
// preview-core tests do.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

const SOURCE_PREFIX = 'Source';

describe('ExecutionHub Portfolio preview — source relation (real render)', () => {
  it('(a) shows a human source label plus the framework, never the raw sourceType', () => {
    const relations = buildExecutionSourceRelations(
      { sourceType: 'assessment', sourceFramework: 'DRD' },
      SOURCE_PREFIX
    );
    render(<StandardPreview title="Initiative A" relations={relations} />);

    expect(screen.getByText('Source: Assessment · DRD')).toBeInTheDocument();
    expect(screen.queryByText(/\bassessment\b/)).toBeNull();
  });

  it('(b) shows the label alone when there is no source framework', () => {
    const relations = buildExecutionSourceRelations(
      { sourceType: 'assessment', sourceFramework: '' },
      SOURCE_PREFIX
    );
    render(<StandardPreview title="Initiative B" relations={relations} />);

    expect(screen.getByText('Source: Assessment')).toBeInTheDocument();
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it('(c) leaves the relations section empty when there is no sourceType', () => {
    const relations = buildExecutionSourceRelations(
      { sourceType: undefined, sourceFramework: 'DRD' },
      SOURCE_PREFIX
    );
    render(<StandardPreview title="Initiative C" relations={relations} />);

    expect(relations).toEqual([]);
    expect(screen.getByText('No relations')).toBeInTheDocument();
    expect(screen.queryByText(/Source:/)).toBeNull();
  });
});
