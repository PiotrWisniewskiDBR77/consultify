/**
 * R02-B — testy jednego kanonicznego klastra selection.
 *
 * Kontrakt: `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §4 Formuła 2 (bulk),
 * §9 (kolor, focus), §10 (przycisk bulk = 32 px). Liczby z `contracts/tableSurface/canon.ts`.
 *
 * Testowane są OBA publiczne wejścia — pływający pill z `ResizableTable`
 * i pasek inline z `ModuleHub` — plus ich parity, bo cała pointa R02-B jest
 * taka, że obie powłoki renderują tę samą zawartość.
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CANON_HEIGHT } from '@/contracts/tableSurface/canon';

import { type BulkClusterAction, BulkSelectionCluster } from '../BulkSelectionCluster';
import { BulkActionBar as ModuleHubBulkBar } from '../ModuleHub/BulkActionBar';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      initial: _i,
      animate: _a,
      exit: _e,
      transition: _t,
      ...props
    }: Record<string, unknown> & { children?: React.ReactNode }) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false, safeAreaInsets: { bottom: 0 } }),
}));

// Importowany PO mockach — fasada ciągnie framer-motion i useDeviceType.
const { BulkActionBar: FloatingBulkBar } =
  await import('@/components/ui/ResizableTable/BulkActionBar');

const actions = (over: Partial<BulkClusterAction> = {}): BulkClusterAction[] => [
  { id: 'archive', label: 'Archive', onClick: vi.fn(), ...over },
  { id: 'delete', label: 'Delete', onClick: vi.fn(), variant: 'danger' },
];

const cluster = () => document.querySelector('[data-bulk-selection-cluster]') as HTMLElement;
const clearBtn = () => document.querySelector('[data-bulk-clear]') as HTMLButtonElement;
const actionButtons = () => [...cluster().querySelectorAll('button')] as HTMLButtonElement[];

// ── Maszyna stanu: pasek istnieje tylko przy zaznaczeniu ────────────────────

describe('R02-B · widoczność klastra', () => {
  it('nie renderuje się przy zerowym zaznaczeniu', () => {
    const { container } = render(
      <BulkSelectionCluster count={0} onClear={vi.fn()} actions={actions()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderuje się od pierwszego zaznaczonego wiersza', () => {
    render(<BulkSelectionCluster count={1} onClear={vi.fn()} actions={actions()} />);
    expect(cluster()).toBeInTheDocument();
  });
});

// ── Anatomia i kolejność (§4 Formuła 2) ─────────────────────────────────────

describe('R02-B · anatomia klastra', () => {
  it('pokazuje „N selected"', () => {
    render(<BulkSelectionCluster count={3} onClear={vi.fn()} actions={actions()} />);
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  it('Select all jest OPCJONALNE — brak handlera znaczy brak przycisku', () => {
    const { rerender } = render(
      <BulkSelectionCluster count={2} onClear={vi.fn()} actions={actions()} />
    );
    expect(screen.queryByRole('button', { name: 'Select all' })).toBeNull();

    rerender(
      <BulkSelectionCluster count={2} onClear={vi.fn()} onSelectAll={vi.fn()} actions={actions()} />
    );
    expect(screen.getByRole('button', { name: 'Select all' })).toBeInTheDocument();
  });

  it('Clear jest ZAWSZE obecny i ma ikonę X ORAZ etykietę', () => {
    render(<BulkSelectionCluster count={2} onClear={vi.fn()} actions={actions()} />);
    const clear = clearBtn();
    expect(clear).toBeInTheDocument();
    expect(clear.querySelector('svg')).toBeInTheDocument();
    expect(clear.textContent).toContain('Clear');
  });

  it('kolejność to N selected → Select all → Clear → akcje, danger na końcu', () => {
    render(
      <BulkSelectionCluster count={2} onClear={vi.fn()} onSelectAll={vi.fn()} actions={actions()} />
    );
    expect(actionButtons().map((b) => b.textContent?.trim())).toEqual([
      'Select all',
      'Clear',
      'Archive',
      'Delete',
    ]);
  });

  it('przesuwa danger na koniec, nawet gdy wywołujący poda go pierwszego', () => {
    render(
      <BulkSelectionCluster
        count={2}
        onClear={vi.fn()}
        actions={[
          { id: 'delete', label: 'Delete', onClick: vi.fn(), variant: 'danger' },
          { id: 'archive', label: 'Archive', onClick: vi.fn() },
        ]}
      />
    );
    const labels = actionButtons().map((b) => b.textContent?.trim());
    expect(labels[labels.length - 1]).toBe('Delete');
  });

  it('Clear wywołuje handler', () => {
    const onClear = vi.fn();
    render(<BulkSelectionCluster count={2} onClear={onClear} actions={actions()} />);
    fireEvent.click(clearBtn());
    expect(onClear).toHaveBeenCalledOnce();
  });
});

// ── Kolory i stany (§9, §10) ────────────────────────────────────────────────

describe('R02-B · kolory i stany', () => {
  it('tylko danger jest czerwony', () => {
    render(<BulkSelectionCluster count={2} onClear={vi.fn()} actions={actions()} />);
    const red = actionButtons().filter((b) => b.className.includes('text-c-danger'));
    expect(red.map((b) => b.textContent?.trim())).toEqual(['Delete']);
  });

  it('każdy przycisk ma kanoniczne 32 px (h-8)', () => {
    render(
      <BulkSelectionCluster count={2} onClear={vi.fn()} onSelectAll={vi.fn()} actions={actions()} />
    );
    expect(CANON_HEIGHT.menu3BulkButton).toBe(32);
    for (const button of actionButtons()) expect(button.className).toContain('h-8');
  });

  it('disabled zostaje WIDOCZNY, jaśniejszy i bez komentarza', () => {
    render(
      <BulkSelectionCluster count={2} onClear={vi.fn()} actions={actions({ disabled: true })} />
    );
    const archive = screen.getByText('Archive').closest('button')!;
    expect(archive).toBeInTheDocument();
    expect(archive).toBeDisabled();
    expect(archive.className).toContain('disabled:opacity-45');
    // Decyzja R01/R02: powód nie jest prezentowany.
    expect(archive.getAttribute('title')).toBeNull();
    expect(archive.textContent?.trim()).toBe('Archive');
  });

  it('nie renderuje atrap ani duplikatów Clear', () => {
    render(<BulkSelectionCluster count={2} onClear={vi.fn()} actions={actions()} />);
    expect(document.querySelectorAll('[data-bulk-clear]')).toHaveLength(1);
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });
});

// ── Klawiatura i focus ──────────────────────────────────────────────────────

describe('R02-B · klawiatura i focus', () => {
  const renderFull = () =>
    render(
      <BulkSelectionCluster count={2} onClear={vi.fn()} onSelectAll={vi.fn()} actions={actions()} />
    );

  it('ArrowRight przechodzi po kontrolkach', () => {
    renderFull();
    actionButtons()[0].focus();
    fireEvent.keyDown(cluster(), { key: 'ArrowRight' });
    expect(document.activeElement?.textContent?.trim()).toBe('Clear');
  });

  it('ArrowLeft cofa i zawija', () => {
    renderFull();
    actionButtons()[0].focus();
    fireEvent.keyDown(cluster(), { key: 'ArrowLeft' });
    expect(document.activeElement?.textContent?.trim()).toBe('Delete');
  });

  it('Home i End skaczą na skraje', () => {
    renderFull();
    fireEvent.keyDown(cluster(), { key: 'End' });
    expect(document.activeElement?.textContent?.trim()).toBe('Delete');
    fireEvent.keyDown(cluster(), { key: 'Home' });
    expect(document.activeElement?.textContent?.trim()).toBe('Select all');
  });

  it('nawigacja pomija pozycje wyłączone, nie ukrywając ich', () => {
    render(
      <BulkSelectionCluster count={2} onClear={vi.fn()} actions={actions({ disabled: true })} />
    );
    fireEvent.keyDown(cluster(), { key: 'End' });
    expect(document.activeElement?.textContent?.trim()).toBe('Delete');
    expect(screen.getByText('Archive')).toBeInTheDocument();
  });

  it('klaster ma dostępną nazwę grupy', () => {
    renderFull();
    expect(screen.getByRole('group', { name: 'Bulk selection actions' })).toBeInTheDocument();
  });
});

// ── Brak clippingu przy 1280×720 ────────────────────────────────────────────

describe('R02-B · brak clippingu na minimalnym desktopie', () => {
  it('klaster zawija się i przewija zamiast chować akcje', () => {
    render(
      <BulkSelectionCluster
        count={9}
        onClear={vi.fn()}
        onSelectAll={vi.fn()}
        actions={Array.from({ length: 6 }, (_, i) => ({
          id: `a${i}`,
          label: `Action ${i}`,
          onClick: vi.fn(),
        }))}
      />
    );
    expect(cluster().className).toContain('flex-wrap');
    expect(cluster().className).toContain('overflow-x-auto');
    // Wszystkie sześć akcji jest realnie w DOM — żadna nie chowa się w „More".
    for (let i = 0; i < 6; i += 1) {
      expect(screen.getByText(`Action ${i}`)).toBeInTheDocument();
    }
  });
});

// ── Oba publiczne wejścia i ich parity ──────────────────────────────────────

describe('R02-B · parity obu powłok', () => {
  const selectionApi = (count: number, clear = vi.fn()) =>
    ({
      selectedIds: new Set(Array.from({ length: count }, (_, i) => String(i))),
      count,
      toggleRow: vi.fn(),
      toggleAll: vi.fn(),
      clear,
      isAllSelected: false,
      isIndeterminate: true,
      selectionProp: {} as never,
      runBulk: vi.fn(),
    }) as never;

  it('pływający pill (ResizableTable) renderuje kanoniczny klaster', () => {
    render(
      <FloatingBulkBar
        selectedCount={2}
        onClearSelection={vi.fn()}
        actions={[
          { id: 'archive', label: 'Archive', icon: <span>A</span>, onClick: vi.fn() },
          {
            id: 'delete',
            label: 'Delete',
            icon: <span>D</span>,
            onClick: vi.fn(),
            variant: 'danger',
          },
        ]}
      />
    );
    expect(screen.getByTestId('bulk-action-bar')).toBeInTheDocument();
    expect(cluster().getAttribute('data-bulk-selection-cluster')).toBe('floating');
    expect(clearBtn().querySelector('svg')).toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('pasek inline (ModuleHub) renderuje kanoniczny klaster', () => {
    render(
      <ModuleHubBulkBar
        selection={selectionApi(2)}
        actions={[
          { id: 'archive', label: 'Archive', onRun: vi.fn() },
          { id: 'delete', label: 'Delete', onRun: vi.fn(), variant: 'danger' },
        ]}
      />
    );
    expect(cluster().getAttribute('data-bulk-selection-cluster')).toBe('strip');
    expect(clearBtn().querySelector('svg')).toBeInTheDocument();
  });

  it('obie powłoki dają IDENTYCZNĄ kolejność i etykiety', () => {
    const { unmount } = render(
      <FloatingBulkBar
        selectedCount={2}
        onClearSelection={vi.fn()}
        actions={[
          { id: 'archive', label: 'Archive', icon: <span>A</span>, onClick: vi.fn() },
          {
            id: 'delete',
            label: 'Delete',
            icon: <span>D</span>,
            onClick: vi.fn(),
            variant: 'danger',
          },
        ]}
      />
    );
    const floating = actionButtons().map((b) => b.textContent?.replace(/^[AD]/, '').trim());
    unmount();

    render(
      <ModuleHubBulkBar
        selection={selectionApi(2)}
        actions={[
          { id: 'archive', label: 'Archive', onRun: vi.fn() },
          { id: 'delete', label: 'Delete', onRun: vi.fn(), variant: 'danger' },
        ]}
      />
    );
    const strip = actionButtons().map((b) => b.textContent?.trim());

    expect(strip).toEqual(floating);
    expect(strip).toEqual(['Clear', 'Archive', 'Delete']);
  });

  it('ModuleHub przekazuje żywe selection do onRun', () => {
    const onRun = vi.fn();
    const api = selectionApi(3);
    render(
      <ModuleHubBulkBar selection={api} actions={[{ id: 'archive', label: 'Archive', onRun }]} />
    );
    fireEvent.click(screen.getByText('Archive').closest('button')!);
    expect(onRun).toHaveBeenCalledWith(api);
  });

  it('obie powłoki znikają przy zerowym zaznaczeniu', () => {
    const { container: floatingContainer } = render(
      <FloatingBulkBar selectedCount={0} onClearSelection={vi.fn()} actions={[]} />
    );
    expect(within(floatingContainer).queryByTestId('bulk-action-bar')).toBeNull();

    const { container: stripContainer } = render(
      <ModuleHubBulkBar selection={selectionApi(0)} actions={[]} />
    );
    expect(stripContainer.firstChild).toBeNull();
  });
});
