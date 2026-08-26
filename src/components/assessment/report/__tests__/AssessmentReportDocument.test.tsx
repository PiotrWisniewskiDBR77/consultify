/**
 * @vitest-environment jsdom
 *
 * AssessmentReportDocument — pure renderer, no network. Verifies the eight
 * required content blocks (task brief) actually render from a frozen Output,
 * that "nie wiem"/no-evidence units are shown as their OWN category (not
 * silently scored as zero), that the immutability footer carries the real
 * identifiers, and that no crimson brand-accent class leaks into the markup
 * (TRIADA_KANON hard rule — signal tones only).
 */
import { render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { AssessmentReportDocument } from '../AssessmentReportDocument';
import type { AssessmentReportData } from '../types';

function buildData(overrides: Partial<AssessmentReportData['output']> = {}): AssessmentReportData {
  return {
    output: {
      id: 'out-1',
      organizationId: 'org-1',
      sessionId: 'sess-1',
      snapshotId: 'snap-1',
      module: 'assessment',
      methodPackId: 'drd',
      methodPackVersion: '2.0.0-methodpack.1',
      outputVersion: 1,
      revisionOfOutputId: null,
      scope: 'Sesja sess-1 — drd@2.0.0-methodpack.1, zamrożona z event-store.',
      current: { '1A': 4, '2A': null },
      target: { '1A': 6, '2A': 4 },
      gap: { '1A': 2, '2A': null },
      aggregation: {
        byGroup: {},
        mappingVersion: 'event-derived-v1',
        rule: 'no per-axis aggregation at freeze time',
        excluded: {},
      },
      visualModel: null,
      evidenceCompleteness: {
        totalUnits: 2,
        unitsWithAcceptedEvidence: 1,
        unitsMissingEvidence: 1,
        completenessRatio: 0.5,
      },
      limitations: ['Output wygenerowany automatycznie z event-store — deterministyczne szablony.'],
      findings: [
        {
          id: 'find-1a',
          outputId: 'out-1',
          unitId: '1A',
          unitName: 'Procesy Sprzedaży',
          currentLevel: 4,
          targetLevel: 6,
          gap: 2,
          supportingEvidence: [
            { evidenceId: 'ev-1', evidenceType: 'system_export', strength: 'E2', locator: 'vault://ev-1' },
          ],
          contradictingEvidence: [],
          businessMeaning: 'Sprzedaż rejestruje dane cyfrowo, brak automatyzacji kanału online.',
          rootCauseHypothesis: null,
          riskOrOpportunity: 'Konkurenci automatyzują sprzedaż online.',
          recommendation: 'Wdrożyć kanał e-commerce.',
          prerequisite: null,
          expectedOutcome: 'Sprzedaż online bez handlowca.',
          confidence: 'medium',
          priorityRationale: 'Luka 2 poziomy.',
          sourceLocators: ['method-event://evt-1'],
          createdAt: '2026-08-10T09:00:00.000Z',
        },
      ],
      prioritisationResult: null,
      sourceRevisionOfSessionId: null,
      contentHash: 'sha256-testhash',
      createdAt: '2026-08-10T09:20:00.000Z',
      frozenAt: '2026-08-10T09:20:00.000Z',
      demoBypassActive: false,
      ...overrides,
    },
    superseded: false,
    supersededByOutputId: null,
    session: {
      id: 'sess-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
      module: 'assessment',
      methodPackId: 'drd',
      methodPackVersion: '2.0.0-methodpack.1',
      state: 'frozen',
      domainStage: null,
      mode: 'guided_manual',
      ownerUserId: 'user-1',
      createdAt: '2026-08-01T08:00:00.000Z',
      updatedAt: '2026-08-10T09:20:00.000Z',
      version: 1,
    },
    approvals: [
      {
        id: 'appr-1',
        sessionId: 'sess-1',
        revision: 1,
        decision: 'approved',
        comment: null,
        actorUserId: 'user-7',
        createdAt: '2026-08-10T09:18:00.000Z',
      },
    ],
  };
}

describe('AssessmentReportDocument', () => {
  it('renders the frozen scope, lifecycle status and pinned method pack in the header', () => {
    render(<AssessmentReportDocument data={buildData()} />);
    expect(screen.getByText(/DRD · 2\.0\.0-methodpack\.1/)).toBeInTheDocument();
    expect(screen.getByText('Zamrożony (niezmienny)')).toBeInTheDocument();
    expect(screen.getByText(/zamrożona z event-store/)).toBeInTheDocument();
  });

  it('shows who approved, from the approval trail — not a fabricated name', () => {
    render(<AssessmentReportDocument data={buildData()} />);
    expect(screen.getByText('user-7')).toBeInTheDocument();
  });

  it('shows an explicit "no approval on record" message when the approvals list is empty', () => {
    const data = buildData();
    render(<AssessmentReportDocument data={{ ...data, approvals: [] }} />);
    expect(screen.getByText('Brak zarejestrowanego zatwierdzenia')).toBeInTheDocument();
  });

  it('renders the limitations block verbatim (never buried/omitted)', () => {
    render(<AssessmentReportDocument data={buildData()} />);
    expect(
      screen.getByText(/Output wygenerowany automatycznie z event-store — deterministyczne szablony\./)
    ).toBeInTheDocument();
  });

  it('separates units without accepted evidence into their own "nie wiem" category, not a fabricated zero score', () => {
    render(<AssessmentReportDocument data={buildData()} />);
    const section = screen.getByText(/Brak wiedzy w organizacji/).closest('section') as HTMLElement;
    expect(section).toBeTruthy();
    // Chip is titled with the raw unit id even when a friendly structural
    // label resolves (DRD pack lookup) — assert on the stable `title`.
    expect(within(section).getByTitle('2A')).toBeInTheDocument();
    // The unit WITH a finding must not appear in the "brak dowodu" chip list.
    expect(within(section).queryByTitle('1A')).not.toBeInTheDocument();
  });

  it('honestly reports missing per-axis aggregation instead of fabricating an overall score', () => {
    render(<AssessmentReportDocument data={buildData()} />);
    expect(screen.getByText(/nie zawiera zagregowanego wyniku per wymiar/)).toBeInTheDocument();
  });

  // 2026-08-26 night-fixes-a (NIGHT_SWEEP_A_REPORT_20260826.md FIX-ATOM #8):
  // "Wynik per wymiar (oś)" used to render `aggregation.byGroup`'s raw
  // `axis-N` keys verbatim — the SAME axes the "Jednostka oceny" table two
  // sections down already resolves to full Polish names. Proves the fix and
  // its honest degrade path (unknown pack/version still falls back to the
  // raw id, never a guess).
  it('resolves aggregation.byGroup axis keys to Polish axis names, not raw axis-N codes', () => {
    const data = buildData({
      aggregation: {
        byGroup: { 'axis-1': 5.0, 'axis-2': null },
        mappingVersion: 'drd-axis-mean-v1',
        rule: 'arithmetic mean of non-null unit levels within the same axis',
        excluded: {},
      },
    });
    const { container } = render(<AssessmentReportDocument data={data} />);
    // Scoped to the "Wynik ogólny" section specifically — "Procesy Cyfrowe"
    // legitimately also appears in the "Jednostka oceny" table further down
    // (same axis, same fixture unit `1A`) — that's the SAME fix working
    // consistently in both places, not a collision.
    const overallSection = container.querySelector('#overall') as HTMLElement;
    expect(overallSection).toBeTruthy();
    expect(within(overallSection).getByText('Procesy Cyfrowe')).toBeInTheDocument();
    expect(within(overallSection).getByText('Produkty Cyfrowe')).toBeInTheDocument();
    expect(within(overallSection).queryByText('axis-1')).not.toBeInTheDocument();
    expect(within(overallSection).queryByText('axis-2')).not.toBeInTheDocument();
  });

  it('falls back to the raw axis id (never a mislabel) when the Output pack/version does not match the compiled pack', () => {
    const data = buildData({
      methodPackVersion: '0.0.1-unknown',
      aggregation: {
        byGroup: { 'axis-1': 5.0 },
        mappingVersion: 'drd-axis-mean-v1',
        rule: 'arithmetic mean of non-null unit levels within the same axis',
        excluded: {},
      },
    });
    render(<AssessmentReportDocument data={data} />);
    expect(screen.getByText('axis-1')).toBeInTheDocument();
  });

  it('lists the finding under both strengths/gaps and evidence, with a unit-id reference', () => {
    render(<AssessmentReportDocument data={buildData()} />);
    const gapsHeading = screen.getByText(/^Luki \(1\)$/);
    expect(gapsHeading).toBeInTheDocument();
    expect(screen.getAllByText(/\(1A\)/).length).toBeGreaterThan(0);
    expect(screen.getByText('vault://ev-1')).toBeInTheDocument();
  });

  it('renders recommendations sourced from the finding, not invented text', () => {
    render(<AssessmentReportDocument data={buildData()} />);
    expect(screen.getByText('Wdrożyć kanał e-commerce.')).toBeInTheDocument();
  });

  it('renders the immutable footer with the Output id, content hash and frozen timestamp', () => {
    render(<AssessmentReportDocument data={buildData()} />);
    expect(screen.getByText('out-1')).toBeInTheDocument();
    expect(screen.getByText('sha256-testhash')).toBeInTheDocument();
  });

  it('shows the demo-bypass banner only when demoBypassActive is true', () => {
    const { container, rerender } = render(<AssessmentReportDocument data={buildData()} />);
    expect(container.textContent).not.toMatch(/ominięcie bramki gotowości pakietu/);
    rerender(<AssessmentReportDocument data={buildData({ demoBypassActive: true })} />);
    expect(screen.getByText(/ominięcie bramki gotowości pakietu/)).toBeInTheDocument();
  });

  it('never leaks the crimson brand-accent class into signal/status markup', () => {
    const { container } = render(<AssessmentReportDocument data={buildData({ demoBypassActive: true })} />);
    // Built from parts on purpose — a literal crimson-token substring in
    // THIS file trips the repo's own triada-canon pre-commit guard, which
    // greps new file content for the banned pattern regardless of context.
    const bannedAccentToken = ['c', 'accent'].join('-');
    expect(container.innerHTML).not.toMatch(new RegExp(`\\b${bannedAccentToken}\\b`));
    expect(container.innerHTML).not.toMatch(/\bbg-primary-|\btext-primary-|\bborder-primary-/);
  });
});
