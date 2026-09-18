/**
 * @vitest-environment jsdom
 *
 * U-29 resztki (Wpis 125, stanowisko B) — test na REALNYM `ConclusionReadout`
 * (nie lustrze): wniosek z audytu (sourceModule 'audit', dowody
 * `audit_evidence`/`audit_report` — kształt pisany przez serwerowy most
 * `auditReportConclusionBridge.ts:135/:52/:50`) renderuje NAZWY: chip źródła
 * „Audit" i wiersze dowodów „Audit evidence"/„Audit report"; surowe klucze
 * NIE wypływają, plakietka „Other" znika.
 *
 * MUTACJE (dowód): (M1) usunięcie `audit` z mapy `sourceLabel`
 * (conclusionMeta.ts) → asercja chipa „Audit" RED (wraca „Other");
 * (M2) przywrócenie `{ev.type}` w ConclusionReadout.tsx:106 → asercje
 * „Audit evidence"/„Audit report" RED + negatywne asercje surowych kluczy RED.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => (typeof fallback === 'string' ? fallback : _k),
  }),
}));

import type { ConclusionDetail } from '@/services/api/conclusions.api';

import { ConclusionReadout } from '../ConclusionReadout';

const detail: ConclusionDetail = {
  conclusion: {
    id: 'conc-audit-1',
    organizationId: 'org-1',
    title: 'Line 3 Quality and Safety Audit — audit report',
    statement: 'The audit identified 7 findings across 3 clauses.',
    sourceModule: 'audit',
    sourceArtifactRefs: [],
    confidenceLevel: 'medium',
    limits: 'Verify objective evidence before executive action.',
    evidenceRefs: [
      { type: 'audit_evidence', ref: 'ev-1', excerpt: 'Maintenance log excerpt' },
      { type: 'audit_evidence', ref: 'ev-2', excerpt: 'Operator interview note' },
      { type: 'audit_report', ref: 'rep-1', excerpt: 'Source audit report' },
    ],
    recommendedNextAction: null,
    status: 'candidate',
    createdBy: 'u1',
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
  },
  sourcePack: null,
  conversions: [],
} as unknown as ConclusionDetail;

describe('ConclusionReadout — wniosek z audytu bez surowych kluczy (U-29)', () => {
  it('chip źródła „Audit" (nie „Other"), dowody „Audit evidence"/„Audit report", zero surowych kluczy', () => {
    render(<ConclusionReadout detail={detail} onBack={() => {}} />);

    // Źródło: plakietka „Other" (uwaga U-29) znika dla sourceModule='audit'
    expect(screen.getByText('Audit')).toBeInTheDocument();
    expect(screen.queryByText('Other')).not.toBeInTheDocument();

    // Dowody: nazwy zamiast surowych kluczy (2× audit_evidence + 1× audit_report)
    expect(screen.getAllByText('Audit evidence')).toHaveLength(2);
    expect(screen.getByText('Audit report')).toBeInTheDocument();

    // Surowe klucze serwera NIGDY nie wypływają do UI
    expect(screen.queryByText('audit_evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('audit_report')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain('audit_evidence');
    expect(document.body.textContent).not.toContain('audit_report');

    // Treść dowodów (excerpt) pozostaje widoczna — naprawa nie zjada danych
    expect(screen.getByText('Maintenance log excerpt')).toBeInTheDocument();
  });
});
