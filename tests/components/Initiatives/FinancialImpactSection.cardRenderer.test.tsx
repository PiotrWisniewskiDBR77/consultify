/**
 * @vitest-environment jsdom
 *
 * FinancialImpactSection — F3 (D11) proof-of-pattern render test.
 *
 * Locks in the ADDITIVE CardBlockRenderer display layer:
 *   - With financial data present, the generic renderer (`[data-card-renderer]`)
 *     mounts BELOW the existing UI and surfaces the business-case KPI strip with
 *     the formatted revenue value.
 *   - With NO financial data, the renderer preview is not shown (existing UI is).
 *
 * The section consumes InitiativeContext + framer-motion; both stubbed so the
 * test is about the display-layer contract, not the inputs.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// react-i18next → return the key (so labels are deterministic, non-empty)
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// framer-motion → plain elements
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: () => (props: any) => <div {...props} />,
    }
  ),
}));

const ctxValue: any = {
  initiative: {
    id: '1',
    name: 'Test initiative',
    status: 'DRAFT',
    priority: 'high',
    revenueImpact: 1800000,
    costSavings: 500000,
    benefitsRealized: 40,
  },
  isGeneratingAI: null,
  handleGenerateAI: vi.fn(),
};

vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

import { FinancialImpactSection } from '@/components/Initiatives/sections/FinancialImpactSection';

const SECTION_PROPS: any = {
  sectionType: { id: 'financialImpact', label: 'Financial Impact' },
  expanded: true,
  onToggle: vi.fn(),
};

describe('FinancialImpactSection — CardBlockRenderer display layer', () => {
  it('renders the generic CardBlockRenderer preview when financial data is present', () => {
    const { container } = render(<FinancialImpactSection {...SECTION_PROPS} />);
    const renderer = container.querySelector('[data-card-renderer]');
    expect(renderer).not.toBeNull();
    expect(renderer?.getAttribute('data-section-key')).toBe('businessCase');
    // business-case KPI strip
    const kpiStrip = container.querySelector('[data-block="kpi_strip"]');
    expect(kpiStrip).not.toBeNull();
    // some KPI tile surfaces the formatted revenue value
    const tiles = Array.from(container.querySelectorAll('[data-kpi-tile]'));
    expect(tiles.some((t) => (t.textContent || '').includes('1,800,000'))).toBe(true);
  });

  it('does NOT render the renderer preview when there is no financial data', () => {
    ctxValue.initiative = { id: '2', name: 'Empty', status: 'DRAFT', priority: 'low' };
    const { container } = render(<FinancialImpactSection {...SECTION_PROPS} />);
    expect(container.querySelector('[data-card-renderer]')).toBeNull();
  });
});
