/**
 * @vitest-environment jsdom
 *
 * GateOverrideModal — conscious soft-block override (M13 Depth · Fala 1 · §5/§6).
 *
 * Locks in:
 *   - returns null when closed;
 *   - confirm button DISABLED while reason empty / whitespace-only;
 *   - confirm ENABLED once a non-empty reason is typed;
 *   - onConfirm fires with the TRIMMED reason; onCancel via cancel/close button;
 *   - reason resets to empty when the modal is reopened;
 *   - gaps + blocking timeline flags are summarised (only 'block' severity).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, opts?: Record<string, unknown>) =>
      opts ? `${k}::${JSON.stringify(opts)}` : k,
    i18n: { language: 'pl' },
  }),
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: (p: any) => <span data-testid="icon-alert" {...p} />,
  X: (p: any) => <span data-testid="icon-x" {...p} />,
}));

import { GateOverrideModal } from '@/components/Initiatives/gate-ai/GateOverrideModal';
import { GateAiReadiness, GateAiTimeline } from '@/types/gateAi';

const readiness: GateAiReadiness = {
  score: 42,
  threshold: 70,
  verdict: 'below',
  gaps: [{ section: 'Problem', score: 30, issues: [] }],
  fixes: [],
};
const timeline: GateAiTimeline = {
  flags: [
    { severity: 'block', kind: 'dependency', message: 'Zależność niedomknięta' },
    { severity: 'warn', kind: 'date_conflict', message: 'Tylko ostrzeżenie' },
  ],
};

function setup(overrides: Partial<React.ComponentProps<typeof GateOverrideModal>> = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <GateOverrideModal
      open
      readiness={readiness}
      timeline={timeline}
      onConfirm={onConfirm}
      onCancel={onCancel}
      {...overrides}
    />
  );
  return { onConfirm, onCancel, ...utils };
}

// Locate confirm/cancel by their i18n keys (mock returns the key as text).
function confirmBtn() {
  return screen.getByText('initiatives.gateAi.override.confirm').closest('button')!;
}

describe('GateOverrideModal', () => {
  it('renders nothing when closed', () => {
    const { container } = setup({ open: false });
    expect(container).toBeEmptyDOMElement();
  });

  it('disables confirm while the reason is empty', () => {
    setup();
    expect(confirmBtn()).toBeDisabled();
  });

  it('keeps confirm disabled for whitespace-only reason', () => {
    setup();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '    ' } });
    expect(confirmBtn()).toBeDisabled();
  });

  it('enables confirm once a non-empty reason is typed', () => {
    setup();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Klient akceptuje ryzyko' } });
    expect(confirmBtn()).not.toBeDisabled();
  });

  it('calls onConfirm with the TRIMMED reason', () => {
    const { onConfirm } = setup();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  świadoma decyzja  ' },
    });
    fireEvent.click(confirmBtn());
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('świadoma decyzja');
  });

  it('does not call onConfirm when reason is empty (button click is a no-op)', () => {
    const { onConfirm } = setup();
    fireEvent.click(confirmBtn());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel from the cancel button', () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByText('initiatives.gateAi.override.cancel').closest('button')!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('resets the reason to empty when reopened', () => {
    const { rerender } = setup();
    const ta = () => screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(ta(), { target: { value: 'stary powód' } });
    expect(ta().value).toBe('stary powód');

    // Close then reopen.
    rerender(
      <GateOverrideModal
        open={false}
        readiness={readiness}
        timeline={timeline}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    rerender(
      <GateOverrideModal
        open
        readiness={readiness}
        timeline={timeline}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(ta().value).toBe('');
    expect(confirmBtn()).toBeDisabled();
  });

  it('summarises gaps and ONLY blocking timeline flags', () => {
    setup();
    expect(screen.getByText('Problem')).toBeInTheDocument();
    // Blocking flag shown.
    expect(screen.getByText('Zależność niedomknięta')).toBeInTheDocument();
    // Warn-severity flag is NOT part of the override summary.
    expect(screen.queryByText('Tylko ostrzeżenie')).not.toBeInTheDocument();
  });

  it('shows the score/threshold summary interpolated', () => {
    setup();
    const summary = screen.getByText(/override\.summaryScore/);
    expect(summary.textContent).toContain('42');
    expect(summary.textContent).toContain('70');
  });
});
