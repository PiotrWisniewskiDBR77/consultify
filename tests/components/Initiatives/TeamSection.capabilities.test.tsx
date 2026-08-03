/**
 * @vitest-environment jsdom
 *
 * TeamSection — INI-04 active UI/component test.
 *
 * `TeamSection` is the ONE real widget where the owner/sponsor SELECT
 * elements are enabled or disabled directly from `canEditOwner` —
 * `useInitiativeContext().canEditOwner`, which InitiativeDocumentView.tsx
 * derives from `gateReadiness.capabilities.topBar.canEditOwner` (the backend
 * capability contract this packet canonicalized).
 *
 * Locks in:
 *   - canEditOwner=false (server denied the capability) → BOTH selects
 *     disabled, cannot be used to reassign owner/sponsor;
 *   - canEditOwner=true (server granted it, e.g. this actor resolved to
 *     RACI Accountable via the new matrix) → both selects enabled;
 *   - the disabled state is driven ENTIRELY by the context value the backend
 *     answer feeds — no separate/duplicated client-side role check exists in
 *     this component.
 */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: () => (props: any) => <div {...props} />,
    }
  ),
}));

const baseCtx: any = {
  users: [
    { id: 'user-1', firstName: 'Ada', lastName: 'Owner' },
    { id: 'user-2', firstName: 'Bo', lastName: 'Sponsor' },
  ],
  ownerId: '',
  setOwnerId: vi.fn(),
  sponsorId: '',
  setSponsorId: vi.fn(),
  ownerName: '',
  sponsorName: '',
};

let ctxValue: any = { ...baseCtx, canEditOwner: false };

vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

import { TeamSection } from '@/components/Initiatives/sections/TeamSection';

describe('TeamSection — capability-driven owner/sponsor edit gating', () => {
  it('disables owner AND sponsor selects when the backend denies canEditOwner (e.g. no role, or RACI Consulted/Informed)', () => {
    ctxValue = { ...baseCtx, canEditOwner: false };
    render(<TeamSection sectionType={undefined as any} expanded onToggle={vi.fn()} />);

    const owner = document.getElementById('initiative-team-owner') as HTMLSelectElement;
    const sponsor = document.getElementById('initiative-team-sponsor') as HTMLSelectElement;

    expect(owner).toBeDisabled();
    expect(sponsor).toBeDisabled();
  });

  it('enables owner AND sponsor selects when the backend grants canEditOwner (e.g. INITIATIVE_OWNER or RACI Accountable)', () => {
    ctxValue = { ...baseCtx, canEditOwner: true };
    render(<TeamSection sectionType={undefined as any} expanded onToggle={vi.fn()} />);

    const owner = document.getElementById('initiative-team-owner') as HTMLSelectElement;
    const sponsor = document.getElementById('initiative-team-sponsor') as HTMLSelectElement;

    expect(owner).not.toBeDisabled();
    expect(sponsor).not.toBeDisabled();
  });
});
