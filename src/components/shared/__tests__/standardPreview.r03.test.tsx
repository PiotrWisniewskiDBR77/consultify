/**
 * R03-1 — testy kanonicznego rdzenia preview.
 *
 * Kontrakt: `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §6 (Preview), §9 (kolor,
 * focus). Kontrakt maszynowy: `src/contracts/tableSurface` (R00) — liczby
 * pochodzą z `canon.ts`, żeby test i implementacja nie mogły rozjechać się
 * po cichu.
 *
 * ZAKRES: wyłącznie czysty rdzeń R03-1 (`StandardPreview`, `PreviewActionButton`).
 * NIE dotyka `PreviewRelations`, `PreviewPane/index.ts`, `PreviewPaneShell`,
 * `TableWithPreviewLayout` ani 31 preview domenowych — to R03-2/R03-3 i fale
 * domenowe.
 *
 * OGRANICZENIE DOWODOWE: jsdom nie liczy layoutu, więc geometria jest dowodzona
 * przez klasy, które ją ustalają. Piksele domyka dowód wizualny G3/G4.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  orderPreviewActionRows,
  StandardPreview,
  type StandardPreviewActions,
  type StandardPreviewDetails,
  standardPreviewShortcuts,
} from '@/components/standard/StandardPreview';
import { CANON_PREVIEW_BLOCK_ORDER, CANON_PREVIEW_LIMIT } from '@/contracts/tableSurface/canon';
import {
  buildPreviewSchema,
  buildRowActionMenu,
  populatedFixture,
} from '@/contracts/tableSurface/fixtures';
import { flattenPreviewActions } from '@/contracts/tableSurface/previewSchema';

import { PreviewActionButton } from '../PreviewPane/PreviewActionButton';
import { validatePreviewContract } from '../PreviewPane/previewContract';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en' },
  }),
}));

const baseActions: StandardPreviewActions = {
  resolutions: [
    { id: 'approve', variant: 'positive', label: 'Approve', shortcut: 'A', onClick: vi.fn() },
    { id: 'reject', variant: 'destructive', label: 'Reject', shortcut: 'R', onClick: vi.fn() },
  ],
  informational: [
    { id: 'info', variant: 'neutral', label: 'More info', shortcut: 'I', onClick: vi.fn() },
  ],
};

/**
 * Walidator przyjmuje rzędy JUŻ uporządkowane (`orderPreviewActionRows`) —
 * dokładnie tak, jak robi to komponent. Ta sama kompozycja w teście i w kodzie
 * znaczy, że test sprawdza realną ścieżkę, a nie własną wersję kolejności.
 */
const codes = (props: { actions?: StandardPreviewActions; details?: StandardPreviewDetails }) =>
  validatePreviewContract({
    rows: orderPreviewActionRows(props.actions),
    details: props.details,
  }).violations.map((v) => v.code);

// ── Blok 5: Relations obowiązkowe (§6) ─────────────────────────────────────

describe('R03-1 · Relations jest blokiem obowiązkowym', () => {
  it('renderuje empty state, gdy ekran NIE poda propa relations', () => {
    // To był defekt: brak propa kasował cały blok, więc panel nie miał gdzie
    // powiedzieć „brak powiązań".
    render(<StandardPreview title="Bez relacji" />);
    expect(screen.getByText('No relations')).toBeInTheDocument();
  });

  it('renderuje empty state dla pustej tablicy', () => {
    render(<StandardPreview title="Pusto" relations={[]} />);
    expect(screen.getByText('No relations')).toBeInTheDocument();
  });

  it('respektuje własną etykietę pustego stanu', () => {
    render(<StandardPreview title="X" relationsEmptyLabel="Brak powiązań" />);
    expect(screen.getByText('Brak powiązań')).toBeInTheDocument();
  });

  it('renderuje realne relacje, gdy są', () => {
    render(<StandardPreview title="X" relations={[{ label: 'Initiative A' }]} />);
    expect(screen.getByText('Initiative A')).toBeInTheDocument();
    expect(screen.queryByText('No relations')).toBeNull();
  });
});

// ── Kolejność bloków (§6) ──────────────────────────────────────────────────

describe('R03-1 · kolejność bloków', () => {
  it('kanon deklaruje sześć bloków w stałej kolejności', () => {
    expect(CANON_PREVIEW_BLOCK_ORDER).toEqual([
      'header',
      'meta',
      'details',
      'ai',
      'relations',
      'actions',
    ]);
  });

  it('renderuje meta → details → AI → relations → actions w tej kolejności DOM', () => {
    const { container } = render(
      <StandardPreview
        title="Alpha"
        onOpenFull={vi.fn()}
        meta={{ pills: [{ label: 'Pending', tone: 'warning' }] }}
        details={{ text: 'Body of the details block' }}
        ai={{ hints: ['Summarize'], onRunHint: vi.fn() }}
        relations={[]}
        actions={baseActions}
      />
    );
    const text = container.textContent ?? '';
    const order = ['Pending', 'Body of the details block', 'Summarize', 'No relations', 'Approve'];
    const positions = order.map((needle) => text.indexOf(needle));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

// ── Blok 1: dokładnie jeden Open (§6) ──────────────────────────────────────

describe('R03-1 · dokładnie jeden Open', () => {
  it('renderuje Open raz, w headerze', () => {
    render(<StandardPreview title="X" onOpenFull={vi.fn()} />);
    expect(screen.getAllByText('Open')).toHaveLength(1);
  });

  it('nie renderuje Open, gdy ekran go nie deklaruje', () => {
    render(<StandardPreview title="X" />);
    expect(screen.queryByText('Open')).toBeNull();
  });

  it('wykrywa drugi Open wstawiony do siatki akcji', () => {
    expect(
      codes({
        actions: {
          resolutions: [{ id: 'open', variant: 'neutral', label: 'Open', onClick: vi.fn() }],
        },
      })
    ).toContain('PREVIEW_OPEN_NOT_UNIQUE');
  });
});

// ── Blok 6: siatka akcji (§6) ──────────────────────────────────────────────

describe('R03-1 · siatka akcji', () => {
  it('destructive ląduje na końcu, choćby ekran podał go pierwszego', () => {
    const rows = orderPreviewActionRows({
      resolutions: [
        { id: 'delete', variant: 'destructive', label: 'Delete', onClick: vi.fn() },
        { id: 'approve', variant: 'positive', label: 'Approve', onClick: vi.fn() },
      ],
      informational: [{ id: 'info', variant: 'neutral', label: 'Info', onClick: vi.fn() }],
    });
    const flat = rows.flat();
    expect(flat[flat.length - 1].id).toBe('delete');
  });

  it('pojedyncza akcja destructive zajmuje pierwszą kolumnę, bez atrapy-wypełniacza', () => {
    render(
      <StandardPreview
        title="X"
        actions={{
          resolutions: [
            { id: 'cancel', variant: 'destructive', label: 'Cancel', onClick: vi.fn() },
          ],
        }}
      />
    );
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    expect(cancel.parentElement?.className).toContain('grid-cols-2');
    expect(screen.getAllByRole('button', { name: 'Cancel' })).toHaveLength(1);
  });

  it('nigdy nie renderuje więcej niż trzech rzędów', () => {
    const rows = orderPreviewActionRows({
      resolutions: [{ id: 'a', variant: 'neutral', label: 'A', onClick: vi.fn() }],
      informational: [{ id: 'b', variant: 'neutral', label: 'B', onClick: vi.fn() }],
      time: [{ id: 'c', variant: 'neutral', label: 'C', onClick: vi.fn() }],
    });
    expect(rows.length).toBeLessThanOrEqual(CANON_PREVIEW_LIMIT.actionGridRowsMax);
  });

  it('zgłasza przekroczenie sześciu akcji bezpośrednich', () => {
    const many = Array.from({ length: 4 }, (_, i) => ({
      id: `x${i}`,
      variant: 'neutral' as const,
      label: `X${i}`,
      onClick: vi.fn(),
    }));
    expect(codes({ actions: { resolutions: many, informational: many } })).toContain(
      'PREVIEW_ACTION_GRID_OVERFLOW'
    );
  });

  it('NIE gubi akcji przy przekroczeniu limitu — raportuje, nie obcina', () => {
    const many = Array.from({ length: 4 }, (_, i) => ({
      id: `x${i}`,
      variant: 'neutral' as const,
      label: `X${i}`,
      onClick: vi.fn(),
    }));
    render(<StandardPreview title="X" actions={{ resolutions: many, informational: many }} />);
    // Osiem akcji nadal renderuje się w całości: kontrakt jest naruszony,
    // ale funkcja biznesowa nie znika (bramka G1).
    expect(screen.getAllByRole('button', { name: /^X\d$/ })).toHaveLength(8);
  });
});

// ── Unikalność akcji (§6) ──────────────────────────────────────────────────

describe('R03-1 · unikalność akcji', () => {
  it('wykrywa zduplikowany actionId (wzorzec T43)', () => {
    expect(
      codes({
        actions: {
          resolutions: [{ id: 'dup', variant: 'neutral', label: 'One', onClick: vi.fn() }],
          informational: [{ id: 'dup', variant: 'neutral', label: 'Two', onClick: vi.fn() }],
        },
      })
    ).toContain('PREVIEW_DUPLICATE_ACTION_ID');
  });

  it('wykrywa zduplikowaną etykietę', () => {
    expect(
      codes({
        actions: {
          resolutions: [{ id: 'a', variant: 'neutral', label: 'Same', onClick: vi.fn() }],
          informational: [{ id: 'b', variant: 'neutral', label: 'Same', onClick: vi.fn() }],
        },
      })
    ).toContain('PREVIEW_DUPLICATE_ACTION_LABEL');
  });

  it('wykrywa etykietę dłuższą niż limit kanonu', () => {
    expect(
      codes({
        actions: {
          resolutions: [
            {
              id: 'long',
              variant: 'neutral',
              label: 'A label far beyond the canonical character budget',
              onClick: vi.fn(),
            },
          ],
        },
      })
    ).toContain('PREVIEW_ACTION_LABEL_TOO_LONG');
  });

  it('kanoniczny zestaw przechodzi bez naruszeń', () => {
    expect(validatePreviewContract({ rows: orderPreviewActionRows(baseActions) }).valid).toBe(true);
  });
});

// ── Kolory, kształty, stany (§6, §9, §10) ──────────────────────────────────

describe('R03-1 · kolory, kształty i stany', () => {
  it('tylko destructive jest czerwony', () => {
    render(<StandardPreview title="X" actions={baseActions} />);
    const red = screen.getAllByRole('button').filter((b) => b.className.includes('bg-danger-50'));
    // Etykieta niesie też badge skrótu, więc porównujemy przez zawieranie,
    // a nie przez równość całego textContent.
    expect(red).toHaveLength(1);
    expect(red[0].textContent).toContain('Reject');
  });

  it('positive i neutral nie są czerwone', () => {
    render(<StandardPreview title="X" actions={baseActions} />);
    const approve = screen.getByRole('button', { name: /Approve/ });
    const info = screen.getByRole('button', { name: /More info/ });
    expect(approve.className).not.toContain('danger');
    expect(info.className).not.toContain('danger');
  });

  it('przycisk akcji ma kanoniczne 36 px i kształt pigułki', () => {
    render(<PreviewActionButton variant="neutral" label="X" onClick={vi.fn()} />);
    const button = screen.getByRole('button');
    expect(button.className).toContain('h-9');
    expect(button.className).toContain('rounded-full');
    expect(button.className).toContain('border');
  });

  it('disabled jest widoczny, jaśniejszy i BEZ komentarza', () => {
    render(<PreviewActionButton variant="neutral" label="Blocked" onClick={vi.fn()} disabled />);
    const button = screen.getByRole('button', { name: 'Blocked' });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    // Ta sama wartość co w R01 i R02-B — disabled wygląda tak samo w całym kanonie.
    expect(button.className).toContain('disabled:opacity-45');
    expect(button.getAttribute('title')).toBeNull();
    expect(button.textContent?.trim()).toBe('Blocked');
  });

  it('focus jest niebieski, nigdy crimson (§9)', () => {
    render(<PreviewActionButton variant="destructive" label="Delete" onClick={vi.fn()} />);
    expect(screen.getByRole('button').className).toContain('ring-c-focus');
  });
});

// ── Klawiatura ─────────────────────────────────────────────────────────────

describe('R03-1 · skróty klawiszowe', () => {
  it('zbiera skróty ze wszystkich rzędów', () => {
    const map = standardPreviewShortcuts(baseActions);
    expect(Object.keys(map).sort()).toEqual(['A', 'I', 'R']);
  });

  it('pomija skróty akcji wyłączonych', () => {
    const map = standardPreviewShortcuts({
      resolutions: [
        {
          id: 'a',
          variant: 'neutral',
          label: 'A',
          shortcut: 'A',
          onClick: vi.fn(),
          disabled: true,
        },
      ],
    });
    expect(Object.keys(map)).toHaveLength(0);
  });

  it('akcja reaguje na kliknięcie', () => {
    const onClick = vi.fn();
    render(
      <StandardPreview
        title="X"
        actions={{ resolutions: [{ id: 'go', variant: 'neutral', label: 'Go', onClick }] }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

// ── Parity z R01 (§6 „Relacja z kebabem") ──────────────────────────────────

describe('R03-1 · parity actionId z menu wiersza (R01)', () => {
  it('wspólne actionId mają identyczną etykietę i ikonę w preview i w kebabie', () => {
    // §6: zestawy NIE muszą być identyczne, ale część wspólna musi się zgadzać.
    const fixture = populatedFixture('T05');
    const schema = buildPreviewSchema(fixture.contract);
    const kebab = buildRowActionMenu(fixture.contract, fixture.rows[0]);

    const previewActions = flattenPreviewActions(schema, fixture.rows[0]);
    const byId = new Map(kebab.actions.map((a) => [a.actionId, a]));

    // Para (akcja preview, bliźniak z kebaba) budowana bez asercji non-null —
    // `flatMap` odsiewa brak bliźniaka, więc typ jest zawężony strukturalnie.
    const shared = previewActions.flatMap((action) => {
      const twin = byId.get(action.actionId);
      return twin ? [{ action, twin }] : [];
    });
    expect(shared.length).toBeGreaterThan(0);

    for (const { action, twin } of shared) {
      expect(action.label).toBe(twin.label);
      expect(action.icon).toBe(twin.icon);
    }
  });

  it('preview nie wprowadza akcji o tym samym id, lecz innym skutku', () => {
    const fixture = populatedFixture('T05');
    const schema = buildPreviewSchema(fixture.contract);
    const ids = flattenPreviewActions(schema, fixture.rows[0]).map((a) => a.actionId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ── Zachowana zgodność wsteczna ────────────────────────────────────────────

describe('R03-1 · zgodność wsteczna publicznego API', () => {
  it('renderuje skeleton w stanie loading', () => {
    render(<StandardPreview title="X" loading />);
    expect(screen.getByTestId('standard-preview-loading')).toBeInTheDocument();
  });

  it('nadal renderuje opcjonalny blok What’s next', () => {
    render(
      <StandardPreview
        title="X"
        whatsNext={{ items: [{ id: 'i', label: 'Convert', onClick: vi.fn() }], note: 'One note' }}
      />
    );
    expect(screen.getByText('Convert')).toBeInTheDocument();
    expect(screen.getByText('One note')).toBeInTheDocument();
  });

  it('nadal renderuje properties zamiast prozy bez licznika słów', () => {
    render(
      <StandardPreview
        title="X"
        details={{ properties: [{ id: 'owner', label: 'Owner', value: 'Ada' }] }}
      />
    );
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.queryByText(/words/i)).toBeNull();
  });
});
