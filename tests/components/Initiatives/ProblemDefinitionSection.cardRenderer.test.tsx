/**
 * @vitest-environment jsdom
 *
 * ProblemDefinitionSection — F3 (D11) proof-of-pattern render test.
 *
 * Locks in the ADDITIVE CardBlockRenderer display layer:
 *   - With problem data present, the generic renderer (`[data-card-renderer]`)
 *     mounts BELOW the edit fields and surfaces the danger callout for the
 *     cost-of-inaction field.
 *   - With NO data, the renderer preview is not shown (edit fields still are).
 *
 * The section consumes InitiativeContext + AIFieldEnhancer + framer-motion;
 * all stubbed so the test is about the display-layer contract, not the edits.
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

// AIFieldEnhancer → trivial marker (avoids API/network deps)
vi.mock('@/components/shared/AIFieldEnhancer', () => ({
  AIFieldEnhancer: () => <span data-testid="ai-enhancer" />,
}));

const ctxValue: any = {
  initiative: {
    id: '1',
    name: 'Test initiative',
    status: 'DRAFT',
    priority: 'high',
    problemDefinition: {
      symptom: 'Orders fell 12% QoQ',
      rootCause: 'No post-onboarding retention',
      costOfInaction: '2M PLN lost revenue per year',
    },
  },
  isGeneratingAI: null,
  handleGenerateAI: vi.fn(),
};

vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

import { ProblemDefinitionSection } from '@/components/Initiatives/sections/ProblemDefinitionSection';

const SECTION_PROPS: any = {
  sectionType: { id: 'problemDefinition', label: 'Problem' },
  expanded: true,
  onToggle: vi.fn(),
};

describe('ProblemDefinitionSection — CardBlockRenderer display layer', () => {
  it('renders the generic CardBlockRenderer preview when problem data is present', () => {
    const { container } = render(<ProblemDefinitionSection {...SECTION_PROPS} />);
    const renderer = container.querySelector('[data-card-renderer]');
    expect(renderer).not.toBeNull();
    expect(renderer?.getAttribute('data-section-key')).toBe('problemDefinition');
    // cost-of-inaction → danger callout
    const callout = container.querySelector('[data-block="callout"][data-tone="danger"]');
    expect(callout).not.toBeNull();
    expect(callout?.textContent).toContain('2M PLN');
  });

  it('does NOT render the renderer preview when there is no problem data', () => {
    ctxValue.initiative = { id: '2', name: 'Empty', status: 'DRAFT', priority: 'low' };
    const { container } = render(<ProblemDefinitionSection {...SECTION_PROPS} />);
    expect(container.querySelector('[data-card-renderer]')).toBeNull();
  });
});
