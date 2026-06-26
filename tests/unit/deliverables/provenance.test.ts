// @vitest-environment node
/**
 * Unit tests — provenance (F10.2)
 *
 * PR-1: auditProvenance coverage
 * PR-2: footnotes (numbering + dedupe)
 * PR-3: formatting
 */

import { describe, expect, it } from 'vitest';
import {
  auditProvenance,
  renderProvenanceFootnotes,
  formatProvenanceRef,
  provenanceMarker,
  type Claim,
} from '../../../server/src/services/deliverables/provenance.js';

const CLAIMS: Claim[] = [
  { key: 'revenue_y3', text: 'Revenue €12M', source: { kind: 'financial_report', label: 'Model 3-letni' } },
  { key: 'churn', text: 'Churn 4%', source: { kind: 'kpi', label: 'Dashboard KPI Q1' } },
  { key: 'market', text: 'TAM €1.2B', source: { kind: 'external', label: 'Gartner', url: 'https://gartner.com' } },
  { key: 'guess', text: 'We will dominate', /* no source */ },
];

describe('provenance', () => {
  // ── PR-1 ──
  it('PR-1.1: audit reports coverage + missing keys', () => {
    const a = auditProvenance(CLAIMS);
    expect(a.total).toBe(4);
    expect(a.withSource).toBe(3);
    expect(a.missingSource).toEqual(['guess']);
    expect(a.coverage).toBeCloseTo(0.75);
  });

  it('PR-1.2: empty claims → coverage 1 (vacuously complete)', () => {
    expect(auditProvenance([]).coverage).toBe(1);
  });

  it('PR-1.3: source with blank label counts as missing', () => {
    const a = auditProvenance([{ key: 'x', text: 't', source: { kind: 'note', label: '  ' } }]);
    expect(a.missingSource).toEqual(['x']);
  });

  // ── PR-2 ──
  it('PR-2.1: footnotes numbered 1..N, markerByClaimKey maps each sourced claim', () => {
    const { footnotes, markerByClaimKey } = renderProvenanceFootnotes(CLAIMS);
    expect(footnotes).toHaveLength(3); // guess has no source
    expect(footnotes[0].index).toBe(1);
    expect(markerByClaimKey['revenue_y3']).toBe(1);
    expect(markerByClaimKey['market']).toBe(3);
    expect(markerByClaimKey['guess']).toBeUndefined();
  });

  it('PR-2.2: identical sources dedupe to one footnote number', () => {
    const dup: Claim[] = [
      { key: 'a', text: 'A', source: { kind: 'kpi', label: 'Same KPI' } },
      { key: 'b', text: 'B', source: { kind: 'kpi', label: 'Same KPI' } },
      { key: 'c', text: 'C', source: { kind: 'kpi', label: 'Other KPI' } },
    ];
    const { footnotes, markerByClaimKey } = renderProvenanceFootnotes(dup);
    expect(footnotes).toHaveLength(2); // Same KPI deduped
    expect(markerByClaimKey['a']).toBe(markerByClaimKey['b']);
    expect(markerByClaimKey['c']).not.toBe(markerByClaimKey['a']);
  });

  // ── PR-3 ──
  it('PR-3.1: formatProvenanceRef includes kind label + url', () => {
    expect(formatProvenanceRef({ kind: 'external', label: 'Gartner', url: 'https://g.com' }))
      .toBe('Źródło zewnętrzne: Gartner — https://g.com');
    expect(formatProvenanceRef({ kind: 'insight', label: 'Wywiad CFO' }))
      .toBe('Wniosek z wywiadu: Wywiad CFO');
  });

  it('PR-3.2: provenanceMarker formats inline marker', () => {
    expect(provenanceMarker(3)).toBe('[3]');
  });
});
