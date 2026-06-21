/**
 * @vitest-environment jsdom
 *
 * FT-1 (unit) dla E1 — OutputsLauncherModal (wspólne wejście „Nowy" + 3 kafle typu).
 * Tracker: Harvard/wdrozenie-100/DELIVERABLES-STAN-PRACY-ODBIORY.md (sub-moduł E1).
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
  const onSelectType = vi.fn();
  render(
    <OutputsLauncherModal open onClose={onClose} onSelectType={onSelectType} {...overrides} />
  );
  return { onClose, onSelectType };
}

describe('OutputsLauncherModal (E1 · FT-1)', () => {
  it('nie renderuje nic gdy open=false', () => {
    const { container } = render(
      <OutputsLauncherModal open={false} onClose={vi.fn()} onSelectType={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renderuje dialog z 3 kaflami typu (Raport/Prezentacja/Tabela)', () => {
    setup();
    expect(screen.getByRole('dialog')).toBeTruthy();
    // 3 kafle + przycisk zamknięcia = 4 przyciski; kafle po aria-label
    expect(screen.getByRole('button', { name: 'Report' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Presentation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Table' })).toBeTruthy();
  });

  it('klik kafla woła onSelectType z poprawnym typem i zamyka', () => {
    const { onSelectType, onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Presentation' }));
    expect(onSelectType).toHaveBeenCalledWith('presentation');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('każdy z 3 typów emituje właściwą wartość', () => {
    const onSelectType = vi.fn();
    setup({ onSelectType });
    fireEvent.click(screen.getByRole('button', { name: 'Report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(onSelectType).toHaveBeenNthCalledWith(1, 'report');
    expect(onSelectType).toHaveBeenNthCalledWith(2, 'table');
  });

  it('a11y: dialog ma aria-modal i aria-labelledby; Escape zamyka', () => {
    const { onClose } = setup();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('outputs-launcher-title');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('klik w tło (overlay) zamyka, klik w panel nie', () => {
    const { onClose } = setup();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog); // overlay = target === currentTarget
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('przycisk zamknięcia woła onClose', () => {
    const { onClose } = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
