/**
 * @vitest-environment jsdom
 *
 * MethodReportView — renders strictly from a ReportSnapshot + the accepted
 * Finding objects behind it. MPQ criteria covered:
 *  1. finding headline = recommendation (a conclusion), not a section label.
 *  4. an unscored unit renders "Nieocenione", not a red/blocker look.
 *  5. missing evidence never renders with a red/danger class.
 *  6. level, evidence and approval are three separate elements.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { buildReportSnapshot } from '@/method-core/outputs';
import { makeFinding, makeOutput } from '@/method-core/outputs/__tests__/testFixtures';

import { MethodReportView } from '../MethodReportView';

function buildSnapshot(overrides: Parameters<typeof makeOutput>[0] = {}) {
  const output = makeOutput(overrides);
  const report = buildReportSnapshot(output, {
    id: 'report-1',
    executiveSummary: 'Organizacja jest na wczesnym etapie transformacji cyfrowej.',
    participants: ['Anna (CIO)'],
    strengths: ['Silne wsparcie zarządu.'],
    initiativeCandidates: [],
    appendices: [],
    createdAt: '2026-08-13T10:00:00.000Z',
  });
  return { output, report };
}

describe('MethodReportView', () => {
  it('uses finding.recommendation as the headline — a conclusion, not a section label (criterion 1)', () => {
    const { report, output } = buildSnapshot({
      findings: [makeFinding({ recommendation: 'Wdroż jednego właściciela danych klienta.' })],
    });
    render(<MethodReportView report={report} findings={output.findings} methodName="DRD" />);
    expect(screen.getByText('Wdroż jednego właściciela danych klienta.')).toBeInTheDocument();
    expect(screen.queryByText(/Wyniki osi/)).not.toBeInTheDocument();
  });

  it('renders an unscored unit as "Nieocenione" with no danger/red class (criterion 4)', () => {
    const { report, output } = buildSnapshot({
      current: { 'axis-1.criterion-1': null },
      findings: [makeFinding({ currentLevel: null, gap: null })],
    });
    render(<MethodReportView report={report} findings={output.findings} methodName="DRD" />);
    const label = screen.getByTestId('report-unscored-label');
    expect(label).toHaveTextContent('Nieocenione');
    const row = screen.getByTestId('report-gap-row');
    expect(row.innerHTML).not.toMatch(/text-c-danger|bg-c-danger/);
  });

  it('shows the evidence chip in neutral styling, never danger/red, even for E0 (criterion 5)', () => {
    const { report, output } = buildSnapshot({
      findings: [
        makeFinding({
          supportingEvidence: [{ evidenceId: 'ev-1', evidenceType: 'document', strength: 'E0', locator: 'x' }],
        }),
      ],
    });
    render(<MethodReportView report={report} findings={output.findings} methodName="DRD" />);
    const chip = screen.getByTestId('report-evidence-chip');
    expect(chip).toHaveTextContent('Brak dowodu');
    expect(chip.className).not.toMatch(/text-c-danger|bg-c-danger/);
  });

  it('renders level, evidence and approval as three SEPARATE elements per finding (criterion 6)', () => {
    const { report, output } = buildSnapshot();
    render(<MethodReportView report={report} findings={output.findings} methodName="DRD" />);
    expect(screen.getByTestId('report-level-chip')).toBeInTheDocument();
    expect(screen.getByTestId('report-evidence-chip')).toBeInTheDocument();
    const approval = screen.getByTestId('report-approval-chip');
    expect(approval).toHaveTextContent('Zaakceptowane');
    // Three distinct DOM nodes, not one node carrying three meanings.
    const nodes = new Set([
      screen.getByTestId('report-level-chip'),
      screen.getByTestId('report-evidence-chip'),
      approval,
    ]);
    expect(nodes.size).toBe(3);
  });

  it('★ tytuł dokumentu to WNIOSEK, a nie etykieta zakresu', () => {
    const { report, output } = buildSnapshot();
    render(<MethodReportView report={report} findings={output.findings} methodName="DRD" />);

    // Do 2026-08-13 <h1> niósł `report.scope` („Sesja <uuid> — drd@2.0.0…"),
    // a wniosek był akapitem pod spodem. Niezależny audyt MPQ wskazał to jako
    // odwrotność kanonu materiału doradczego.
    const title = screen.getByTestId('report-action-title');
    expect(title.tagName).toBe('H1');
    expect(title).toHaveTextContent('Organizacja jest na wczesnym etapie transformacji cyfrowej.');
    // ...a zakres schodzi do metadanych, nie znika.
    expect(title).not.toHaveTextContent(report.scope);
    expect(screen.getByText(new RegExp(report.scope.slice(0, 20)))).toBeInTheDocument();
  });

  it('★ stopka niesie liczbę dowodów i klauzulę poufności', () => {
    const { report, output } = buildSnapshot();
    render(<MethodReportView report={report} findings={output.findings} methodName="DRD" />);

    // Oba elementy kanonu były w `MethodPresentationView`, ale brakowało ich
    // tutaj — klient musi wiedzieć, na ilu dowodach stoi dokument i czy wolno
    // go przekazać dalej.
    const unique = new Set(
      output.findings.flatMap((f) => f.supportingEvidence.map((e) => e.evidenceId))
    ).size;
    expect(screen.getByTestId('report-evidence-count')).toHaveTextContent(String(unique));
    expect(screen.getByTestId('report-confidentiality')).toHaveTextContent('Materiał dla klienta');
  });
});
