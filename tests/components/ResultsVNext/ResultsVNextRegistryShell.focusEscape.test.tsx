/**
 * ResultsVNextRegistryShell — Esc-to-close + focus return (tor PLATFORMY,
 * punkt zakresu 5, 2026-08-11).
 *
 * Zbadano: ta powłoka komponuje `StandardTable`+`StandardPreview` RĘCZNIE,
 * poza `TableWithPreviewLayout` (który już ma ten wzorzec — R03-2). Żadna z
 * trzech domen RN-G2 (KPI/ROI/OKR) nie dostawała więc Esc-to-close ani
 * powrotu fokusu — potwierdzone czytaniem `ResultsKpiRegistryPage.tsx` /
 * `ResultsRoiRegistryPage.tsx` / `ResultsOkrRegistryPage.tsx`: `onClose`
 * tylko zeruje stan zaznaczenia, zero listenera klawiatury.
 *
 * Ten test dowodzi łatki na poziomie powłoki (bez zmiany API): Escape woła
 * `preview.onClose`, a po zamknięciu (dowolną drogą — Escape albo ×) focus
 * wraca na element, z którego preview zostało otwarte.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ResultsVNextRegistryShell } from '../../../src/components/ResultsVNext/ResultsVNextRegistryShell';
import type { TableColumn, TableRow } from '../../../src/components/standard/StandardTable';

const columns: TableColumn[] = [{ id: 'name', label: 'Name' }];
const data: TableRow[] = [{ id: '1', name: 'Alpha' }];

/** Harness: a real "row opener" button outside the shell, like a table row would be. */
const Harness: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <div>
    <button type="button" data-testid="opener">
      Alpha
    </button>
    <ResultsVNextRegistryShell
      domain="kpi"
      moduleBar={{}}
      table={{ columns, data, persistKey: 'results-vnext.test-registry' }}
      preview={open ? { title: 'Alpha', onClose } : null}
    />
  </div>
);

describe('ResultsVNextRegistryShell · Esc-to-close i powrót fokusu', () => {
  it('Escape woła preview.onClose, gdy podgląd jest otwarty', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape NIE robi nic, gdy podgląd jest zamknięty (brak listenera)', () => {
    const onClose = vi.fn();
    render(<Harness open={false} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('focus wraca na element-otwieracz po zamknięciu (× albo Esc)', () => {
    const onClose = vi.fn();
    const { rerender } = render(<Harness open={false} onClose={onClose} />);

    const opener = screen.getByTestId('opener');
    opener.focus();
    expect(document.activeElement).toBe(opener);

    // Otwórz podgląd — powłoka zapamiętuje `opener` jako aktualnie
    // sfokusowany element w chwili przejścia null -> preview.
    rerender(<Harness open onClose={onClose} />);

    // Zamknij (symulacja: caller reaguje na onClose i chowa preview ponownie).
    rerender(<Harness open={false} onClose={onClose} />);

    expect(document.activeElement).toBe(opener);
  });

  it('nie wybucha, gdy otwieracz zniknął z DOM przed zamknięciem', () => {
    const onClose = vi.fn();
    const { rerender, unmount } = render(<Harness open={false} onClose={onClose} />);
    const opener = screen.getByTestId('opener');
    opener.focus();

    rerender(<Harness open onClose={onClose} />);
    // Symuluj zniknięcie otwieracza (np. wiersz przefiltrowany) — usuwamy go z DOM.
    opener.remove();

    expect(() => rerender(<Harness open={false} onClose={onClose} />)).not.toThrow();
    unmount();
  });
});
