/**
 * @vitest-environment jsdom
 *
 * Component test for the flagship DRD maturity radar (AssessmentRadarChart).
 * Covers: renders with DRD data, bilingual labels, and fail-soft on thin data.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// i18n: return the defaultValue so we can assert on English copy without the
// runtime HttpBackend. `i18n.language` drives the PL/EN name pick.
let currentLang = 'en';
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key,
    i18n: { language: currentLang },
  }),
}));

// Recharts ResponsiveContainer measures its parent, which is 0×0 in jsdom and
// would suppress all children. Force a fixed size so the chart actually renders.
vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 400 }}>
        <actual.ResponsiveContainer width={600} height={400}>
          {children as React.ReactElement}
        </actual.ResponsiveContainer>
      </div>
    ),
  };
});

import { AssessmentRadarChart } from '../../src/components/assessment/reports/AssessmentReportVisualizations';
import type { AssessmentVisualizationData } from '../../src/components/assessment/reports/AssessmentReportVisualizations';

const drdData: AssessmentVisualizationData = {
  framework: 'DRD',
  overallScore: 3,
  targetScore: 5,
  completionPercent: 80,
  dimensions: [
    { id: '1', name: 'Digital Processes', namePL: 'Procesy Cyfrowe', current: 3, target: 5, maxLevel: 7 },
    { id: '2', name: 'Digital Products', namePL: 'Produkty Cyfrowe', current: 2, target: 4, maxLevel: 5 },
    { id: '4', name: 'Data Management', namePL: 'Zarządzanie Danymi', current: 4, target: 6, maxLevel: 7 },
    { id: '7', name: 'AI Maturity', namePL: 'Dojrzałość AI', current: 1, target: 3, maxLevel: 5 },
  ],
};

describe('AssessmentRadarChart (DRD maturity radar)', () => {
  it('renders an SVG radar with the bilingual title', () => {
    currentLang = 'en';
    const { container } = render(<AssessmentRadarChart data={drdData} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('Maturity profile')).toBeInTheDocument();
    // Two series (current + target) → at least two radar polygons.
    expect(container.querySelectorAll('.recharts-radar-polygon').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the Polish dimension name when language is pl', () => {
    currentLang = 'pl';
    render(<AssessmentRadarChart data={drdData} />);
    expect(screen.getByText('Procesy Cyfrowe')).toBeInTheDocument();
    currentLang = 'en';
  });

  it('fails soft: renders nothing when fewer than 3 dimensions carry data', () => {
    const thin: AssessmentVisualizationData = {
      ...drdData,
      dimensions: [
        { id: '1', name: 'Digital Processes', current: 3, target: 5, maxLevel: 7 },
        { id: '2', name: 'Digital Products', current: 0, target: 0, maxLevel: 5 },
      ],
    };
    const { container } = render(<AssessmentRadarChart data={thin} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('does not crash on completely empty dimensions (fail-soft)', () => {
    const empty: AssessmentVisualizationData = { ...drdData, dimensions: [] };
    const { container } = render(<AssessmentRadarChart data={empty} />);
    expect(container).toBeEmptyDOMElement();
  });
});
