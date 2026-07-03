/**
 * @vitest-environment jsdom
 *
 * ProposedCardsPanel (R6) — render + interaction test.
 *
 * Asserts the display-layer contract:
 *   - core keys render as READ-ONLY badges (no button / no toggle),
 *   - proposed keys render as toggle chips (buttons),
 *   - clicking a proposed chip calls onToggle with that key,
 *   - selected state is reflected via data-selected.
 */
import { fireEvent, render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// react-i18next → return the EN/default fallback so labels are deterministic.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en' },
  }),
}));

import { ProposedCardsPanel } from '@/components/Initiatives/Wizard/ProposedCardsPanel';

const CORE = ['problemDefinition', 'scope'];
const PROPOSED = ['raid', 'pilot'];

describe('ProposedCardsPanel', () => {
  it('renders core as read-only badges and proposed as toggle chips', () => {
    const { container } = render(
      <ProposedCardsPanel core={CORE} proposed={PROPOSED} selected={[]} onToggle={vi.fn()} />
    );

    // Core badges present, and are NOT buttons (read-only).
    for (const key of CORE) {
      const el = container.querySelector(`[data-core-card="${key}"]`);
      expect(el).not.toBeNull();
      expect(el?.tagName.toLowerCase()).not.toBe('button');
    }

    // Proposed chips present and ARE buttons (toggle).
    for (const key of PROPOSED) {
      const el = container.querySelector(`[data-proposed-card="${key}"]`);
      expect(el).not.toBeNull();
      expect(el?.tagName.toLowerCase()).toBe('button');
    }
  });

  it('calls onToggle with the proposed key when a chip is clicked', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <ProposedCardsPanel core={CORE} proposed={PROPOSED} selected={[]} onToggle={onToggle} />
    );

    const chip = container.querySelector('[data-proposed-card="raid"]') as HTMLButtonElement;
    expect(chip).not.toBeNull();
    fireEvent.click(chip);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('raid');
  });

  it('reflects selected state via data-selected', () => {
    const { container } = render(
      <ProposedCardsPanel
        core={CORE}
        proposed={PROPOSED}
        selected={['pilot']}
        onToggle={vi.fn()}
      />
    );

    const selectedChip = container.querySelector('[data-proposed-card="pilot"]');
    const unselectedChip = container.querySelector('[data-proposed-card="raid"]');
    expect(selectedChip?.getAttribute('data-selected')).toBe('true');
    expect(selectedChip?.getAttribute('aria-pressed')).toBe('true');
    expect(unselectedChip?.getAttribute('data-selected')).toBe('false');
  });
});
