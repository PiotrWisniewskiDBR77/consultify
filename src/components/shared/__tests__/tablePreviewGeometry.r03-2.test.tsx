/**
 * R03-2 — geometria kontenera preview i zachowanie zamykania.
 *
 * Kontrakt: `MY_WORK_TABLE_SURFACE_CONTRACT_V1.md` §6 („Kontener i otwieranie":
 * szerokość `clamp(340px, 28%, 480px)`, gap 6 px, brak własnego `border-left`,
 * „Esc i × zamykają, focus wraca do rekordu"). Liczby z `contracts/tableSurface/canon.ts`.
 *
 * ZAKRES: wyłącznie `TableWithPreviewLayout` i `PreviewPaneShell`. NIE dotyka
 * `StandardPreview`, `previewContract`, `PreviewRelations`, Menu 3, KEBAB ani
 * preview domenowych.
 *
 * OGRANICZENIE DOWODOWE: jsdom nie liczy layoutu — `clamp()` nie jest
 * ewaluowany. Geometria jest więc dowodzona przez zadeklarowaną wartość stylu
 * i klasy, które ją ustalają; piksele domyka dowód wizualny G3/G4.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PreviewPaneShell } from '@/components/ui/ResizableTable/PreviewPaneShell';
import { CANON_PREVIEW } from '@/contracts/tableSurface/canon';

import {
  PREVIEW_PANE_GAP_CLASS,
  PREVIEW_PANE_GAP_PX,
  PREVIEW_PANE_WIDTH,
} from '../PreviewPane/previewGeometry';
import { TableWithPreviewLayout } from '../TableWithPreviewLayout';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => fallback ?? _k,
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/hooks/useDeviceType', () => ({
  useDeviceType: () => ({ isMobile: false, safeAreaInsets: { bottom: 0 } }),
}));

/** `PreviewableItem` wymaga `id` i `title` — trzymamy się kontraktu komponentu. */
interface Row {
  id: string;
  title: string;
}

const items: Row[] = [
  { id: 'a', title: 'Alpha' },
  { id: 'b', title: 'Beta' },
];

/**
 * Renderuje layout z listą przycisków-wierszy, żeby focus miał dokąd wrócić.
 *
 * `itemIds` jest wymagane: bez niego handler klawiatury wychodzi wcześniej
 * (`if (!itemIds.length && !actionShortcuts) return`) i Escape nic nie robi.
 * `previewOpen` wymuszamy, bo stan wewnętrzny startuje zamknięty.
 */
function renderLayout() {
  const onSelect = vi.fn();
  const utils = render(
    <TableWithPreviewLayout<Row>
      selectedId="a"
      selectedItem={items[0]}
      itemIds={items.map((item) => item.id)}
      previewOpen
      onSelect={onSelect}
      renderPreview={(item) => (
        <PreviewPaneShell title={item.title} onClose={() => undefined}>
          <div>preview body</div>
        </PreviewPaneShell>
      )}
    >
      {items.map((item) => (
        <button key={item.id} type="button" data-testid={`row-${item.id}`}>
          {item.title}
        </button>
      ))}
    </TableWithPreviewLayout>
  );
  return { ...utils, onSelect };
}

// ── Geometria (§6 Kontener) ────────────────────────────────────────────────

/*
 * UWAGA DOWODOWA: jsdom NIE parsuje `clamp()` — odrzuca całą deklarację, więc
 * po renderze `style.width` jest puste, a atrybut `style` nie istnieje.
 * Zmierzone empirycznie, nie założone. Dlatego szerokość jest dowodzona na
 * stałej `PREVIEW_PANE_WIDTH`, którą komponent realnie wstawia (jedyne dwa
 * miejsca użycia), a która powstaje z `CANON_PREVIEW` — nie z literału.
 */

describe('R03-2 · geometria kontenera preview', () => {
  it('szerokość jest złożona z kanonu: clamp(340px, 28%, 480px)', () => {
    expect(PREVIEW_PANE_WIDTH).toBe('clamp(340px, 28%, 480px)');
  });

  it('szerokość nie może zdryfować od kanonu', () => {
    // Gdyby ktoś zmienił CANON_PREVIEW, stała pójdzie za nim — a ten test
    // przypilnuje, że idzie za nim DOKŁADNIE.
    expect(PREVIEW_PANE_WIDTH).toBe(
      `clamp(${CANON_PREVIEW.minWidth}px, ${Math.round(
        CANON_PREVIEW.preferredRatio * 100
      )}%, ${CANON_PREVIEW.maxWidth}px)`
    );
    expect(CANON_PREVIEW.minWidth).toBe(340);
    expect(CANON_PREVIEW.maxWidth).toBe(480);
    expect(CANON_PREVIEW.preferredRatio).toBeCloseTo(0.28);
  });

  it('odstęp preview ↔ tabela to 6 px (gap-1.5)', () => {
    const { container } = renderLayout();
    const root = container.firstElementChild as HTMLElement;
    expect(PREVIEW_PANE_GAP_PX).toBe(CANON_PREVIEW.gapFromTable);
    expect(PREVIEW_PANE_GAP_PX).toBe(6);
    // gap-1.5 = 0.375rem = 6 px.
    expect(PREVIEW_PANE_GAP_CLASS).toBe('gap-1.5');
    expect(root.className).toContain(PREVIEW_PANE_GAP_CLASS);
  });

  it('preview NIE ma własnego border-left (§6)', () => {
    const { container } = renderLayout();
    const withBorderLeft = container.querySelectorAll(
      '[class*="border-l-"], [class*=" border-l "], [class^="border-l "]'
    );
    expect(withBorderLeft).toHaveLength(0);
  });
});

// ── Powłoka panelu ─────────────────────────────────────────────────────────

describe('R03-2 · PreviewPaneShell', () => {
  it('× ma dostępną nazwę i cel co najmniej 32 px', () => {
    render(
      <PreviewPaneShell title="Alpha" onClose={vi.fn()}>
        <div>body</div>
      </PreviewPaneShell>
    );
    const close = screen.getByRole('button', { name: 'Close' });
    // h-9/w-9 = 36 px, czyli powyżej kanonicznego minimum 32×32.
    expect(close.className).toContain('h-9');
    expect(close.className).toContain('w-9');
  });

  it('× woła onClose dokładnie raz', () => {
    const onClose = vi.fn();
    render(
      <PreviewPaneShell title="Alpha" onClose={onClose}>
        <div>body</div>
      </PreviewPaneShell>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('pełny tytuł pozostaje dostępny mimo truncate', () => {
    const title = 'A very long preview title that will visually truncate';
    render(
      <PreviewPaneShell title={title}>
        <div>body</div>
      </PreviewPaneShell>
    );
    expect(screen.getByTitle(title)).toHaveTextContent(title);
  });

  it('nie renderuje stopki, gdy jej nie podano', () => {
    const { container } = render(
      <PreviewPaneShell title="Alpha">
        <div>body</div>
      </PreviewPaneShell>
    );
    expect(container.querySelectorAll('.border-t')).toHaveLength(0);
  });
});

// ── Escape, × i focus return (§6) ──────────────────────────────────────────

describe('R03-2 · zamykanie i focus return', () => {
  it('Escape zamyka preview', () => {
    const { container, onSelect } = renderLayout();
    const root = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(root, { key: 'Escape' });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('Escape oddaje focus elementowi, z którego preview otwarto', () => {
    const { container } = renderLayout();
    const root = container.firstElementChild as HTMLElement;
    const row = screen.getByTestId('row-b');

    // Użytkownik jest na wierszu i stamtąd otwiera preview.
    row.focus();
    expect(document.activeElement).toBe(row);
    fireEvent.keyDown(root, { key: 'j' });

    fireEvent.keyDown(root, { key: 'Escape' });
    expect(document.activeElement).toBe(row);
  });

  it('gdy element otwierający zniknął, focus wraca na kontener — skróty żyją dalej', () => {
    const { container } = renderLayout();
    const root = container.firstElementChild as HTMLElement;

    // Element spoza listy, usuwany przed zamknięciem (np. przefiltrowany wiersz).
    const ephemeral = document.createElement('button');
    document.body.appendChild(ephemeral);
    ephemeral.focus();
    fireEvent.keyDown(root, { key: 'j' });
    ephemeral.remove();

    fireEvent.keyDown(root, { key: 'Escape' });
    expect(document.activeElement).toBe(root);
  });

  it('× i Escape prowadzą do tej samej ścieżki zamknięcia', () => {
    // Obie drogi wołają `handleClose`, więc obie zamykają i obie zwracają focus.
    const { container, onSelect } = renderLayout();
    const root = container.firstElementChild as HTMLElement;
    const row = screen.getByTestId('row-a');

    row.focus();
    fireEvent.keyDown(root, { key: 'j' });
    fireEvent.keyDown(root, { key: 'Escape' });

    expect(onSelect).toHaveBeenCalledWith(null);
    expect(document.activeElement).toBe(row);
  });
});
