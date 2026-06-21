/**
 * @vitest-environment jsdom
 *
 * FT-1 (unit) dla E1+E2 — OutputsLauncherModal (wspólne wejście 2-krokowe:
 * typ → template). Tracker: Harvard/wdrozenie-100/DELIVERABLES-STAN-PRACY-ODBIORY.md.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OutputsLauncherModal } from '@/components/ReportsAndPresentations/OutputsLauncherModal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function setup(overrides: Partial<React.ComponentProps<typeof OutputsLauncherModal>> = {}) {
  const onClose = vi.fn();
  const onSelect = vi.fn();
  render(<OutputsLauncherModal open onClose={onClose} onSelect={onSelect} {...overrides} />);
  return { onClose, onSelect };
}

describe('OutputsLauncherModal (E1+E2 · FT-1)', () => {
  it('nie renderuje nic gdy open=false', () => {
    const { container } = render(
      <OutputsLauncherModal open={false} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('krok 1: dialog z 3 kaflami typu', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Report' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Presentation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Table' })).toBeTruthy();
  });

  it('krok 1→2: wybór typu pokazuje galerię template (Blank + kuratorowane)', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Presentation' }));
    expect(screen.getByRole('button', { name: 'Blank' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Board deck' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Diagnostic read-out' })).toBeTruthy();
    // tytuł kroku 2
    expect(screen.getByText('Choose a template')).toBeTruthy();
  });

  it('wybór template emituje onSelect({type, templateId}) i zamyka', () => {
    const { onSelect, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Presentation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Board deck' }));
    expect(onSelect).toHaveBeenCalledWith({ type: 'presentation', templateId: 'board-deck' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Blank emituje templateId "blank"', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blank' }));
    expect(onSelect).toHaveBeenCalledWith({ type: 'report', templateId: 'blank' });
  });

  it('każdy typ ma własną galerię (tabela → Rejestr ryzyk)', () => {
    const { onSelect } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    fireEvent.click(screen.getByRole('button', { name: 'Risk register' }));
    expect(onSelect).toHaveBeenCalledWith({ type: 'table', templateId: 'risk-register' });
  });

  it('przycisk Wstecz wraca z kroku 2 do kroku 1', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Presentation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    // znów widać kafle typu
    expect(screen.getByRole('button', { name: 'Report' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Table' })).toBeTruthy();
  });

  it('a11y: dialog ma aria-modal i aria-labelledby; Escape na kroku 1 zamyka', () => {
    const { onClose } = setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('outputs-launcher-title');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape na kroku 2 cofa do kroku 1 (nie zamyka)', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Presentation' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Report' })).toBeTruthy();
  });

  it('klik w tło (overlay) zamyka; przycisk Zamknij zamyka', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
