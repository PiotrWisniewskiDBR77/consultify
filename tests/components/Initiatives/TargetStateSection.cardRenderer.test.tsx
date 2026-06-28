/**
 * @vitest-environment jsdom
 *
 * TargetStateSection — F3 (D11) proof-of-pattern render test.
 *
 * Locks in the ADDITIVE CardBlockRenderer display layer:
 *   - With vision/criteria/deliverables present, the generic renderer
 *     (`[data-card-renderer][data-section-key="targetState"]`) mounts BELOW
 *     the edit panels and surfaces the success-criteria bullet list.
 *   - With NO data, the renderer preview is not shown (edit panels still are).
 *
 * The section consumes InitiativeContext + AIFieldEnhancer + framer-motion +
 * Api + toast + NModeBlocks; all stubbed so the test is about the
 * display-layer contract, not the edits.
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

// NModeBlocks → trivial stubs
vi.mock('@/components/shared/NModeBlocks', () => ({
  Callout: ({ children }: any) => <div data-testid="callout">{children}</div>,
  EmptyStateInline: ({ message }: any) => <div data-testid="empty-state">{message}</div>,
}));

// Api → no network
vi.mock('@/services/api', () => ({
  Api: { post: vi.fn(), get: vi.fn() },
}));

// react-hot-toast → no-op
vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const ctxValue: any = {
  initiative: { id: '1', name: 'Test initiative', status: 'DRAFT', priority: 'high' },
  isPolish: true,
  targetDescriptionDraft: 'Płynny onboarding bez tarcia',
  setTargetDescriptionDraft: vi.fn(),
  successCriteriaItems: [{ id: '1', text: 'NPS > 50', done: false }],
  setSuccessCriteriaItems: vi.fn(),
  deliverableItems: [{ id: 'd1', text: 'Kreator onboardingu', done: false }],
  setDeliverableItems: vi.fn(),
  targetStateAiRequest: undefined,
  clearTargetStateAiRequest: vi.fn(),
  handleSave: vi.fn(),
};

vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

import { TargetStateSection } from '@/components/Initiatives/sections/TargetStateSection';

const SECTION_PROPS: any = {
  sectionType: { id: 'targetState', label: 'Target State' },
  expanded: true,
  onToggle: vi.fn(),
};

describe('TargetStateSection — CardBlockRenderer display layer', () => {
  it('renders the generic CardBlockRenderer preview when data is present', () => {
    const { container } = render(<TargetStateSection {...SECTION_PROPS} />);
    const renderer = container.querySelector(
      '[data-card-renderer][data-section-key="targetState"]'
    );
    expect(renderer).not.toBeNull();
    const bulletList = renderer?.querySelector('[data-block="bullet_list"]');
    expect(bulletList).not.toBeNull();
    expect(bulletList?.textContent).toContain('NPS > 50');
  });

  it('does NOT render the renderer preview when there is no data', () => {
    ctxValue.targetDescriptionDraft = '';
    ctxValue.successCriteriaItems = [];
    ctxValue.deliverableItems = [];
    const { container } = render(<TargetStateSection {...SECTION_PROPS} />);
    expect(container.querySelector('[data-card-renderer]')).toBeNull();
  });
});
