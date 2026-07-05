/**
 * @vitest-environment jsdom
 *
 * OXFORD #103/#104 — SIRI & ADMA report templates are now MOUNTED in the report
 * view. These tests render each template with data reconstructed by the report
 * data adapter (the exact path ReportEditor uses) and assert that:
 *   1. the core report sections render (WNIOSKOWA executive summary + gap cards
 *      + "Ścieżka dojrzałości N→N+1" maturity pathway),
 *   2. the CONCLUSION_LAYER push bridge fires on render when a conclusionSource
 *      is supplied (the P5 #41 bridge, activated by the render), and
 *   3. fail-soft: an empty axisData renders (headers/verdict) rather than crashing.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Conclusions API so the push bridge is observable without network.
// vi.hoisted keeps the spy available inside the hoisted vi.mock factory.
const { createConclusion } = vi.hoisted(() => ({
  createConclusion: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('@/services/api', () => ({ Api: { createConclusion } }));
// The push service imports Api from '../api', which the '@' alias resolves to
// the same module — so the mock intercepts the bridge.

import {
  buildADMAAssessmentData,
  buildSIRIAssessmentData,
} from '../../../../src/services/report/assessmentReportDataAdapter';
import { SIRIReportTemplate } from '../../../../src/components/assessment/reports/templates/SIRIReportTemplate';
import { ADMAReportTemplate } from '../../../../src/components/assessment/reports/templates/ADMAReportTemplate';

// Report-row axisData (the flat, prefixed shape the backend stores). Several
// dimensions carry a gap so the conclusion + pathway sections have content.
const SIRI_AXIS_DATA = {
  _framework: 'SIRI',
  dim_operations: { actual: 3, target: 4 },
  dim_supply_chain: { actual: 2, target: 4 }, // gap 2
  dim_connectivity: { actual: 1, target: 4 }, // gap 3 (largest)
  dim_intelligence: { actual: 2, target: 3 },
  dim_talent_readiness: { actual: 3, target: 4 },
  block_PROCESS: { actual: 2.5, target: 4 },
  area_vertical_integration: { actual: 2.4 },
};

const ADMA_AXIS_DATA = {
  _framework: 'ADMA',
  dim_digital_strategy: { actual: 2, target: 4 }, // gap 2
  dim_production_tech: { actual: 1, target: 4 }, // gap 3
  dim_data_analytics: { actual: 2, target: 3 },
  dim_digital_culture: { actual: 3, target: 4 },
  pillar_strategy: { actual: 2.5, target: 4 },
};

describe('SIRI report template — mounted in report view (OXFORD #103)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the WNIOSKOWA sections and the N→N+1 maturity pathway', () => {
    const data = buildSIRIAssessmentData(SIRI_AXIS_DATA);
    render(<SIRIReportTemplate data={data} organizationName="Acme Sp. z o.o." />);

    // Header + org
    expect(screen.getByText('SIRI Assessment Report')).toBeInTheDocument();
    expect(screen.getByText('Acme Sp. z o.o.')).toBeInTheDocument();
    // Conclusion-layer executive summary
    expect(screen.getByText('Podsumowanie Wykonawcze')).toBeInTheDocument();
    // Gap-priority cards
    expect(screen.getByText('Kluczowe Luki — Priorytety')).toBeInTheDocument();
    // Maturity pathway N→N+1 (the fala-R4 service, rendered)
    expect(screen.getByText(/Ścieżka dojrzałości/)).toBeInTheDocument();
  });

  it('fires the CONCLUSION_LAYER push bridge on render when a source is given', async () => {
    const data = buildSIRIAssessmentData(SIRI_AXIS_DATA);
    render(
      <SIRIReportTemplate
        data={data}
        organizationName="Acme"
        conclusionSource={{ assessmentId: 'assess-siri-1', assessmentName: 'Acme SIRI' }}
      />
    );
    await waitFor(() => expect(createConclusion).toHaveBeenCalledTimes(1));
    const payload = createConclusion.mock.calls[0][0];
    expect(payload.sourceModule).toBe('assessment_siri');
    expect(payload.status).toBe('candidate');
    expect(payload.sourceRefs[0].id).toBe('assess-siri-1');
  });

  it('does NOT push when no conclusionSource is supplied (fail-soft, no side effects)', async () => {
    const data = buildSIRIAssessmentData(SIRI_AXIS_DATA);
    render(<SIRIReportTemplate data={data} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(createConclusion).not.toHaveBeenCalled();
  });

  it('renders without crashing for empty axisData (fail-soft)', () => {
    const data = buildSIRIAssessmentData({});
    render(<SIRIReportTemplate data={data} organizationName="Empty Co" />);
    expect(screen.getByText('SIRI Assessment Report')).toBeInTheDocument();
    expect(screen.getByText('Podsumowanie Wykonawcze')).toBeInTheDocument();
  });
});

describe('ADMA report template — mounted in report view (OXFORD #104)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the WNIOSKOWA sections, FoF road and the N→N+1 maturity pathway', () => {
    const data = buildADMAAssessmentData(ADMA_AXIS_DATA);
    render(<ADMAReportTemplate data={data} organizationName="Fabryka X" />);

    expect(screen.getByText('ADMA 2.0 Assessment Report')).toBeInTheDocument();
    expect(screen.getByText('Fabryka X')).toBeInTheDocument();
    expect(screen.getByText('Podsumowanie Wykonawcze')).toBeInTheDocument();
    // ADMA-specific: road to Factory of the Future (appears in heading + body)
    expect(screen.getAllByText(/Factory of the Future/).length).toBeGreaterThan(0);
    // Maturity pathway N→N+1
    expect(screen.getByText(/Ścieżka dojrzałości/)).toBeInTheDocument();
  });

  it('fires the CONCLUSION_LAYER push bridge on render when a source is given', async () => {
    const data = buildADMAAssessmentData(ADMA_AXIS_DATA);
    render(
      <ADMAReportTemplate
        data={data}
        organizationName="Fabryka X"
        conclusionSource={{ assessmentId: 'assess-adma-1', assessmentName: 'Fabryka ADMA' }}
      />
    );
    await waitFor(() => expect(createConclusion).toHaveBeenCalledTimes(1));
    const payload = createConclusion.mock.calls[0][0];
    expect(payload.sourceModule).toBe('assessment_adma');
    expect(payload.status).toBe('candidate');
    expect(payload.sourceRefs[0].id).toBe('assess-adma-1');
  });

  it('renders without crashing for empty axisData (fail-soft)', () => {
    const data = buildADMAAssessmentData({});
    render(<ADMAReportTemplate data={data} organizationName="Empty Co" />);
    expect(screen.getByText('ADMA 2.0 Assessment Report')).toBeInTheDocument();
  });
});

describe('assessmentReportDataAdapter — reconstruction contract', () => {
  it('SIRI: reconstructs dimension gaps and building-block scores from flat axisData', () => {
    const data = buildSIRIAssessmentData(SIRI_AXIS_DATA);
    expect(data.dimensions.connectivity).toEqual({ current: 1, target: 4, gap: 3 });
    expect(data.dimensions.supply_chain.gap).toBe(2);
    // explicit block_ cell wins for PROCESS
    expect(data.buildingBlocks.PROCESS.score).toBe(2.5);
    // prioritisation matrix picked up from area_ cells
    expect(data.prioritisationMatrix.vertical_integration).toBe(2.4);
    expect(data.overallScore).toBeGreaterThan(0);
  });

  it('ADMA: reconstructs dimension gaps and pillar scores from flat axisData', () => {
    const data = buildADMAAssessmentData(ADMA_AXIS_DATA);
    expect(data.dimensions.production_tech).toEqual({ current: 1, target: 4, gap: 3 });
    expect(data.dimensions.digital_strategy.gap).toBe(2);
    expect(data.pillars.strategy.current).toBe(2.5);
    expect(data.overallMaturity).toBeGreaterThan(0);
  });
});
