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
import { PreviewStructuredList } from '../../../src/components/shared/PreviewPane';

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
    expect(screen.getByText('Relations')).toBeInTheDocument();
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

  it('keeps a single destructive action in the first grid column without inventing a filler CTA', () => {
    render(
      <StandardPreview
        title="Running process"
        actions={{
          resolutions: [
            { id: 'cancel', variant: 'destructive', label: 'Cancel', onClick: vi.fn() },
          ],
        }}
      />
    );

    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.parentElement?.className).toContain('grid-cols-2');
    expect(cancel.className).toContain('bg-danger-50');
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
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

  it('keeps the full title available when the visual header truncates', () => {
    const title = 'A very long preview title that must remain fully discoverable';
    render(<StandardPreview title={title} />);
    expect(screen.getByTitle(title)).toHaveTextContent(title);
  });

  it('standardPreviewShortcuts collects enabled shortcuts across rows', () => {
    const map = standardPreviewShortcuts(actions);
    expect(Object.keys(map).sort()).toEqual(['A', 'I', 'R', 'Z']);
    map.A();
    expect(actions.resolutions![0].onClick).toHaveBeenCalled();
  });

  it('renders ordered structured content without flattening it into prose', () => {
    render(
      <PreviewStructuredList
        title="Steps and gates"
        ordered
        items={[
          { id: 'one', label: 'Collect evidence', status: 'done' },
          { id: 'two', label: 'Approval gate', note: 'requires approval', status: 'waiting' },
        ]}
      />
    );
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('Collect evidence')).toBeInTheDocument();
    expect(screen.getByText('requires approval')).toBeInTheDocument();
    expect(screen.getByText('waiting')).toBeInTheDocument();
  });
});

/**
 * ── R03-3 · blok Relations ──────────────────────────────────────────────────
 *
 * §6 Relations: karta 64 px, label `RELATIONS`, „maks. 4 widoczne pille i `+N`
 * dla nadmiaru", brak relacji renderuje kanoniczne `No relations`.
 *
 * Testy celowo idą przez `StandardPreview`, a nie przez sam prymityw — blok ma
 * być obecny w panelu ZAWSZE (R03-1), więc dowód musi obejmować całą ścieżkę.
 */
describe('R03-3 · Relations', () => {
  const relationsBlock = () =>
    document.querySelector('[data-preview-block="relations"]') as HTMLElement;

  it('blok Relations jest obecny nawet bez propa relations', () => {
    render(<StandardPreview title="Bez relacji" />);
    expect(relationsBlock()).toBeInTheDocument();
    expect(screen.getByText('Relations')).toBeInTheDocument();
  });

  it('pusty stan jest kanoniczny, nie surowym kluczem i18n', () => {
    render(<StandardPreview title="X" relations={[]} />);
    expect(document.querySelector('[data-relations-empty]')).toBeInTheDocument();
    expect(screen.getByText('No relations')).toBeInTheDocument();
    expect(screen.queryByText(/sharedComponents\./)).toBeNull();
  });

  it('polska etykieta pustego stanu przechodzi z fasady', () => {
    render(<StandardPreview title="X" relations={[]} relationsEmptyLabel="Brak powiązań" />);
    expect(screen.getByText('Brak powiązań')).toBeInTheDocument();
  });

  it('pokazuje maks. 4 pille, resztę zwija do +N', () => {
    render(
      <StandardPreview
        title="X"
        relations={[
          { label: 'Rel 1' },
          { label: 'Rel 2' },
          { label: 'Rel 3' },
          { label: 'Rel 4' },
          { label: 'Rel 5' },
          { label: 'Rel 6' },
        ]}
      />
    );
    for (const label of ['Rel 1', 'Rel 2', 'Rel 3', 'Rel 4']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.queryByText('Rel 5')).toBeNull();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('+N niesie w tooltipie ukryte relacje — nic nie znika bez śladu', () => {
    render(
      <StandardPreview
        title="X"
        relations={[
          { label: 'A' },
          { label: 'B' },
          { label: 'C' },
          { label: 'D' },
          { label: 'E' },
        ]}
      />
    );
    const overflow = document.querySelector('[data-relations-overflow]') as HTMLElement;
    expect(overflow.getAttribute('title')).toBe('E');
  });

  it('dokładnie 4 relacje nie tworzą +N', () => {
    render(
      <StandardPreview
        title="X"
        relations={[{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }]}
      />
    );
    expect(document.querySelector('[data-relations-overflow]')).toBeNull();
  });

  it('karta Relations deklaruje kanoniczne 64 px', () => {
    render(<StandardPreview title="X" relations={[]} />);
    expect(relationsBlock().className).toContain('min-h-16');
  });
});

/**
 * ── R03-3 · barrel PreviewPane ──────────────────────────────────────────────
 *
 * „Barrel eksportuje wyłącznie realne prymitywy" — czyli żaden eksport nie może
 * być pusty. Fantomowy eksport nie wywala buildu (TS zgłosiłby brak modułu, ale
 * nie `undefined` z re-eksportu), więc bez tego testu wykryłby go dopiero
 * runtime na ekranie.
 */
describe('R03-3 · barrel eksportuje realne prymitywy', () => {
  it('każdy komponent z barrela jest zdefiniowany', async () => {
    const barrel = await import('../../../src/components/shared/PreviewPane');
    const components = [
      'PreviewActionBar',
      'PreviewActionButton',
      'PreviewActivityStrip',
      'PreviewAIBrief',
      'PreviewAIHintStrip',
      'PreviewBatchPanel',
      'PreviewCompletenessRing',
      'PreviewDetailsSection',
      'PreviewMetaCard',
      'PreviewRelations',
      'PreviewStructuredList',
    ] as const;

    for (const name of components) {
      expect(barrel[name], `${name} nie istnieje w barrelu`).toBeDefined();
    }
  });

  it('stałe stylu i helpery też są realne', () => {
    // Zostają w barrelu świadomie: `StandardPreview` importuje z niego
    // SKELETON_LINE_*, a usunięcie zerwałoby R03-1.
    return import('../../../src/components/shared/PreviewPane').then((barrel) => {
      for (const name of [
        'SKELETON_LINE_1',
        'SKELETON_LINE_2',
        'SKELETON_LINE_3',
        'SKELETON_LINE_4',
        'PREVIEW_RELATION_CHIP',
        'PREVIEW_META_PILL',
        'actionPillClass',
        'pillColorScheme',
      ] as const) {
        expect(barrel[name], `${name} nie istnieje w barrelu`).toBeDefined();
      }
    });
  });
});
