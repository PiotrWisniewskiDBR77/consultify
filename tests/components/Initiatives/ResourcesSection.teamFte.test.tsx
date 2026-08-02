/**
 * @vitest-environment jsdom
 *
 * ResourcesSection (Team/FTE table) — INI-05 active UI/component test.
 *
 * Covers what is ACTUALLY wired today: add and delete both call the context
 * handlers with the right arguments, and the version-carrying resource item
 * (the CAS field this packet's backend now enforces) renders correctly.
 *
 * NOT covered here, because it doesn't exist yet: an "edit" interaction.
 * `TeamTable` (and the sibling Budget/Tools/IntangibleAsset tables in this
 * SAME file) declare `onUpdate` in their props interface and the parent
 * passes `handleUpdateResource` in, but the destructured render function
 * never reads `onUpdate` — the kebab menu offers only Delete. This is a
 * pre-existing gap discovered while wiring the INI-05 CAS backend
 * (`expectedVersion`/409), not something this packet introduced or attempts
 * to fix (building a 4-table inline-edit UI is out of this pass's
 * small-integration scope) — flagged in the INI-05 report instead.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, fallback?: string) => fallback ?? k }),
}));

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  // `motion.tr`/`motion.td` are used directly for animated table rows here —
  // a blanket "render everything as <div>" mock (fine for non-table markup)
  // breaks table semantics: jsdom foster-parents a <td> that's a child of a
  // <div> INSIDE a <table> out of the table entirely, which silently detaches
  // the real inputs from where the test (and the user) expects them. Map
  // each `motion.<tag>` to its real HTML tag instead.
  motion: new Proxy(
    {},
    {
      get:
        (_target, tag: string) =>
        (props: any) => {
          const Tag = tag as keyof JSX.IntrinsicElements;
          return <Tag {...props} />;
        },
    }
  ),
}));

vi.mock('react-hot-toast', () => ({
  default: { error: vi.fn(), success: vi.fn() },
}));

const apiGet = vi.fn().mockResolvedValue([]);
const apiPost = vi.fn();
vi.mock('@/services/api', () => ({
  Api: { get: (...args: any[]) => apiGet(...args), post: (...args: any[]) => apiPost(...args) },
}));

const handleAddResource = vi.fn().mockResolvedValue(undefined);
const handleUpdateResource = vi.fn().mockResolvedValue(undefined);
const handleDeleteResource = vi.fn().mockResolvedValue(undefined);

const ctxValue: any = {
  isPolish: false,
  initiative: { id: 'init-1', name: 'X', status: 'PLANNING' },
  initiativeId: 'init-1',
  tasks: [],
  decisions: [],
  raidItems: [],
  resourceItems: [
    {
      id: 'res-1',
      initiativeId: 'init-1',
      name: 'Ada Lovelace',
      role: 'lead',
      allocationPercentage: 60,
      version: 1,
      source: 'manual',
    },
  ],
  budgetItems: [],
  toolItems: [],
  intangibleAssets: [],
  handleAddResource,
  handleUpdateResource,
  handleDeleteResource,
  handleAddBudgetItem: vi.fn(),
  handleUpdateBudgetItem: vi.fn(),
  handleDeleteBudgetItem: vi.fn(),
  handleAddTool: vi.fn(),
  handleUpdateTool: vi.fn(),
  handleDeleteTool: vi.fn(),
  handleAddIntangibleAsset: vi.fn(),
  handleUpdateIntangibleAsset: vi.fn(),
  handleDeleteIntangibleAsset: vi.fn(),
  resourcesAiRequest: null,
  clearResourcesAiRequest: vi.fn(),
};

vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => ctxValue,
}));

import { ResourcesSection } from '@/components/Initiatives/sections/ResourcesSection';

describe('ResourcesSection — Team/FTE table (INI-05)', () => {
  it('renders the FTE row with its allocation and name from context', () => {
    render(<ResourcesSection />);
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('adding a resource calls handleAddResource with the entered fields', async () => {
    const user = userEvent.setup();
    render(<ResourcesSection />);
    // Render order is Budget, Team/FTE, Tools, Intangible — the FTE table's
    // "add item" button is the second of the four identical-label buttons.
    await user.click(screen.getAllByText('initiatives.resourcesSection.addItem')[1]);

    const nameInput = screen.getByPlaceholderText('initiatives.resourcesSection.namePosition');
    await user.type(nameInput, 'Grace Hopper');
    await user.keyboard('{Enter}');

    await vi.waitFor(() => expect(handleAddResource).toHaveBeenCalled());
    expect(handleAddResource.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: 'Grace Hopper', role: 'member' })
    );
  });

  it('deleting a resource calls handleDeleteResource with its id (no false success — the row leaves via the real handler, not a local-only removal)', async () => {
    render(<ResourcesSection />);

    // Open the kebab menu for the FTE row, then click Delete.
    const kebabButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('svg.lucide-ellipsis-vertical, svg.lucide-more-vertical')
    );
    expect(kebabButtons.length).toBeGreaterThan(0);
    fireEvent.click(kebabButtons[0]);

    const deleteButton = screen.getByText('initiatives.resourcesSection.delete');
    fireEvent.click(deleteButton);

    await vi.waitFor(() => expect(handleDeleteResource).toHaveBeenCalledWith('res-1'));
  });
});
