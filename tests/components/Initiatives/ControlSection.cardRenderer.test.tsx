/**
 * @vitest-environment jsdom
 *
 * ControlSection — F3 (D11) proof-of-pattern render test.
 *
 * Locks in the ADDITIVE CardBlockRenderer display layer:
 *   - The generic renderer (`[data-card-renderer][data-section-key="control"]`)
 *     mounts BELOW the existing module/status/priority edit UI and surfaces a
 *     kpi_strip whose tiles carry the RESOLVED human labels (e.g. the status
 *     label 'W realizacji'), not raw status codes.
 *
 * The section consumes InitiativeContext + initiativeLifecycle + framer-motion;
 * all stubbed so the test is about the display-layer contract. `./types`
 * (MODULE_CONFIG/PRIORITY_CONFIG/getModuleFromStatus) is left REAL — the test
 * uses valid status/priority keys.
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

// initiativeLifecycle → deterministic status resolution
vi.mock('@/services/initiativeLifecycle', () => ({
  getStatusMeta: () => ({
    label: 'W realizacji',
    color: '',
    bgColor: '',
    dotColor: '',
  }),
  getStatusActions: () => [],
}));

const ctxValue: any = {
  initiative: { status: 'IN_PROGRESS', priority: 'high', name: 'X' },
  isPolish: true,
  priority: 'high',
  setPriority: vi.fn(),
  showPriorityDropdown: false,
  setShowPriorityDropdown: vi.fn(),
  statusActions: [],
  primaryActions: [],
  handleStatusAction: vi.fn(),
  isMutating: false,
};

vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

import { ControlSection } from '@/components/Initiatives/sections/ControlSection';

const SECTION_PROPS: any = {
  sectionType: { id: 'control', label: 'Control' },
  expanded: true,
  onToggle: vi.fn(),
};

describe('ControlSection — CardBlockRenderer display layer', () => {
  it('renders the generic CardBlockRenderer preview with resolved governance labels', () => {
    const { container } = render(<ControlSection {...SECTION_PROPS} />);
    const renderer = container.querySelector(
      '[data-card-renderer][data-section-key="control"]'
    );
    expect(renderer).not.toBeNull();
    const strip = renderer?.querySelector('[data-block="kpi_strip"]');
    expect(strip).not.toBeNull();
    const tiles = strip?.querySelectorAll('[data-kpi-tile]');
    expect((tiles?.length ?? 0)).toBeGreaterThan(0);
    // resolved status label, not the raw 'IN_PROGRESS' code
    expect(renderer?.textContent).toContain('W realizacji');
  });
});
