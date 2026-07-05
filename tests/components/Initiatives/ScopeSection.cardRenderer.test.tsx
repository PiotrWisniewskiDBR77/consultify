/**
 * @vitest-environment jsdom
 *
 * ScopeSection — F3 (D11) proof-of-pattern render test.
 *
 * Locks in the ADDITIVE CardBlockRenderer display layer:
 *   - With scope data present, the generic renderer (`[data-card-renderer]`)
 *     mounts BELOW the edit fields and surfaces the in-scope items as a
 *     bullet_list block.
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
    scope: {
      inScope: ['Moduł zamówień'],
      outScope: ['Migracja historyczna'],
    },
    killCriteria: ['ROI < 0'],
  },
  isGeneratingAI: null,
  handleGenerateAI: vi.fn(),
};

vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

import { ScopeSection } from '@/components/Initiatives/sections/ScopeSection';

const SECTION_PROPS: any = {
  sectionType: { id: 'scope', label: 'Scope' },
  expanded: true,
  onToggle: vi.fn(),
};

describe('ScopeSection — CardBlockRenderer display layer', () => {
  it('renders the generic CardBlockRenderer preview when scope data is present', () => {
    const { container } = render(<ScopeSection {...SECTION_PROPS} />);
    const renderer = container.querySelector('[data-card-renderer][data-section-key="scope"]');
    expect(renderer).not.toBeNull();
    // in-scope items → bullet_list block
    const bulletList = container.querySelector('[data-block="bullet_list"]');
    expect(bulletList).not.toBeNull();
    expect(bulletList?.textContent).toContain('Moduł zamówień');
  });

  it('does NOT render the renderer preview when there is no scope data', () => {
    ctxValue.initiative = { id: '2', name: 'Empty', scope: {}, killCriteria: [] };
    const { container } = render(<ScopeSection {...SECTION_PROPS} />);
    expect(container.querySelector('[data-card-renderer]')).toBeNull();
  });
});
