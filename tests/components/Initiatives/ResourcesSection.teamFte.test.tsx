/**
 * @vitest-environment jsdom
 *
 * ResourcesSection (Team/FTE table) — INI-05 active UI/component test.
 *
 * Covers add, edit, and delete — all three call the context handlers
 * (ResourcesSection -> InitiativeDocumentView.handleAddResource/
 * handleUpdateResource/handleDeleteResource, the CAS/tenant/capability-gated
 * backend this packet hardened) with the right arguments, and the
 * version-carrying resource item renders correctly.
 *
 * "Edit" used to have no UI path at all: `TeamTable` (and the sibling
 * Budget/Tools/IntangibleAsset tables in this same file) declared `onUpdate`
 * in their props interface and the parent passed `handleUpdateResource` in,
 * but the destructured render function never read it — only Add/Delete were
 * wired. Fixed for TeamTable (this packet's Resources scope) by adding an
 * inline edit row via the kebab menu, mirroring the existing "add row"
 * pattern. The sibling tables (Budget/Tools/IntangibleAsset) are out of this
 * pass's scope and still have the same gap — noted in the INI-05 report.
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

  it('editing a resource opens an inline edit row prefilled with its data, and Save calls handleUpdateResource (INI-05: the previously-missing edit path)', async () => {
    render(<ResourcesSection />);

    const kebabButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('svg.lucide-ellipsis-vertical, svg.lucide-more-vertical')
    );
    fireEvent.click(kebabButtons[0]);

    const editButton = screen.getByText('Edit');
    fireEvent.click(editButton);

    // Prefilled with the existing row's data.
    const nameInput = screen.getByDisplayValue('Ada Lovelace') as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: 'Ada Lovelace-Byron' } });
    fireEvent.click(screen.getByTitle('initiatives.resourcesSection.save'));

    await vi.waitFor(() => expect(handleUpdateResource).toHaveBeenCalledWith('res-1', expect.objectContaining({ name: 'Ada Lovelace-Byron' })));
  });

  it('Cancel on an edit row discards changes without calling handleUpdateResource', async () => {
    render(<ResourcesSection />);

    const kebabButtons = screen.getAllByRole('button').filter((btn) =>
      btn.querySelector('svg.lucide-ellipsis-vertical, svg.lucide-more-vertical')
    );
    fireEvent.click(kebabButtons[0]);
    fireEvent.click(screen.getByText('Edit'));

    const nameInput = screen.getByDisplayValue('Ada Lovelace') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Should not save' } });
    fireEvent.click(screen.getByTitle('initiatives.resourcesSection.cancel'));

    expect(handleUpdateResource).not.toHaveBeenCalled();
    // Edit row closed — original value shown again, not the discarded draft.
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Should not save')).not.toBeInTheDocument();
  });
});
