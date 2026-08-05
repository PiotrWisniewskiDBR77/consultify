/**
 * @vitest-environment jsdom
 * StandardPreview — podstawowe testy renderu (Triada standard, 6 bloków).
 */
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  StandardPreview,
  standardPreviewShortcuts,
  type StandardPreviewActions,
} from '../../../src/components/standard/StandardPreview';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : _key),
    i18n: { language: 'en', resolvedLanguage: 'en' },
  }),
}));

const actions: StandardPreviewActions = {
  resolutions: [
    { id: 'approve', variant: 'positive', label: 'Approve', shortcut: 'A', onClick: vi.fn() },
    { id: 'reject', variant: 'destructive', label: 'Reject', shortcut: 'R', onClick: vi.fn() },
  ],
  informational: [
    { id: 'info', variant: 'neutral', label: 'More info', shortcut: 'I', onClick: vi.fn() },
  ],
  time: [{ id: 'snooze', variant: 'neutral', label: 'Snooze', shortcut: 'Z', onClick: vi.fn() }],
};

describe('StandardPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the 6 blocks in the iron order (header, meta, details, AI, relations, actions)', () => {
    render(
      <StandardPreview
        title="Decision Alpha"
        onClose={vi.fn()}
        onOpenFull={vi.fn()}
        meta={{ pills: [{ label: 'Pending', tone: 'warning' }], trailing: <span>Jul 10</span> }}
        details={{ text: 'Some details body', onCopy: vi.fn() }}
        ai={{ hints: ['Summarize context'], onRunHint: vi.fn() }}
        relations={[]}
        relationsEmptyLabel="No relations"
        actions={actions}
      />
    );
    expect(screen.getByText('Decision Alpha')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Some details body')).toBeInTheDocument();
    expect(screen.getByText('Summarize context')).toBeInTheDocument();
    expect(screen.getByText('No relations')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('renders action rows as 2-column grids with shortcut badges', () => {
    render(<StandardPreview title="X" actions={actions} />);
    const approve = screen.getByText('Approve').closest('button');
    expect(approve?.parentElement?.className).toContain('grid-cols-2');
    // Badge skrótu [A]
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('Z')).toBeInTheDocument();
  });

  it('shows pin toggle and loading skeleton', () => {
    const { rerender } = render(
      <StandardPreview title="X" pinned={false} onTogglePin={vi.fn()} loading />
    );
    expect(screen.getByTestId('standard-preview-loading')).toBeInTheDocument();
    expect(screen.getByTitle('Pin for comparison')).toBeInTheDocument();

    rerender(<StandardPreview title="X" pinned onTogglePin={vi.fn()} loading />);
    expect(screen.getByTitle('Unpin')).toBeInTheDocument();
  });

  it('can suppress the word counter for metadata-only details', () => {
    render(
      <StandardPreview
        title="X"
        details={{ text: 'Owner: Piotr\nExports: PDF', showWordCount: false }}
      />
    );
    expect(screen.queryByLabelText(/words$/)).not.toBeInTheDocument();
    expect(screen.getByText(/Owner: Piotr/)).toBeInTheDocument();
  });

  it('standardPreviewShortcuts collects enabled shortcuts across rows', () => {
    const map = standardPreviewShortcuts(actions);
    expect(Object.keys(map).sort()).toEqual(['A', 'I', 'R', 'Z']);
    map.A();
    expect(actions.resolutions![0].onClick).toHaveBeenCalled();
  });
});
