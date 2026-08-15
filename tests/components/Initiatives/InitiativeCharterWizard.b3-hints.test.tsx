/**
 * @vitest-environment jsdom
 *
 * InitiativeCharterWizard — §B3 quality hints (M13 Depth · Seria K · K1 FE).
 *
 * Locks in the debounced, advisory §B3 hints on the thesis/hypothesis field:
 *   - typing ≥ 8 chars triggers validateCard(text, ['lang_pl','no_filler',
 *     'hypothesis_format']) after the 600ms debounce, and the returned issues
 *     render as amber hint rows;
 *   - short text (< 8 chars) never calls validateCard and shows no hints;
 *   - rapid edits are coalesced — only the final value is validated once.
 *
 * WizardModal is stubbed to render the first step's content (defineBody, which
 * holds the thesis field) so we test the hint wiring, not the modal shell.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const validateCardMock = vi.fn(async () => [] as Array<{ rule: string; message: string }>);
const checkSimilarMock = vi.fn(async () => [] as any[]);

vi.mock('@/services/api/cardValidators', () => ({
  validateCard: (...a: any[]) => validateCardMock(...a),
}));
vi.mock('@/services/api/initiativeSimilar', () => ({
  checkSimilarInitiatives: (...a: any[]) => checkSimilarMock(...a),
}));
vi.mock('@/services/api', () => ({ Api: { post: vi.fn(), get: vi.fn(), put: vi.fn() } }));
vi.mock('@/services/initiativeWriteTruth', () => ({ createInitiativeWriteTruth: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'pl' } }),
}));
vi.mock('@/components/shared/forms', () => ({
  Select: (p: any) => <select {...p} />,
}));

// Render the active step's content so the thesis field is in the DOM.
vi.mock('@/components/shared/WizardModal', () => ({
  // CharterWizard passes `open={isOpen}` + `activeStepIndex` to WizardModal.
  WizardModal: ({ open, steps, activeStepIndex = 0 }: any) =>
    open ? <div data-testid="wizard">{steps?.[activeStepIndex]?.content}</div> : null,
}));

import { InitiativeCharterWizard } from '@/components/Initiatives/Wizard/InitiativeCharterWizard';

const THESIS_PLACEHOLDER = 'initiatives.initiativeCharterWizard.thesisPlaceholder';

function renderWizard() {
  return render(
    <InitiativeCharterWizard isOpen onClose={vi.fn()} onCreated={vi.fn()} />
  );
}

async function flush() {
  // Resolve the validateCard promise + the setState it schedules.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('InitiativeCharterWizard — §B3 hints', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    validateCardMock.mockReset();
    validateCardMock.mockResolvedValue([]);
    checkSimilarMock.mockReset();
    checkSimilarMock.mockResolvedValue([]);
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('validates the thesis after debounce and renders amber hints', async () => {
    validateCardMock.mockResolvedValue([
      { rule: 'no_filler', message: 'Usuń frazy-wypełniacze.' },
      { rule: 'hypothesis_format', message: 'Użyj formatu Jeśli/To/Ponieważ.' },
    ]);
    renderWizard();
    const ta = screen.getByPlaceholderText(THESIS_PLACEHOLDER);

    fireEvent.change(ta, { target: { value: 'zrobimy synergię i będzie dobrze' } });
    expect(validateCardMock).not.toHaveBeenCalled(); // debounce not elapsed

    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await flush();

    expect(validateCardMock).toHaveBeenCalledTimes(1);
    expect(validateCardMock).toHaveBeenCalledWith('zrobimy synergię i będzie dobrze', [
      'lang_pl',
      'no_filler',
      'hypothesis_format',
    ]);
    expect(screen.getByText('Usuń frazy-wypełniacze.')).toBeInTheDocument();
    expect(screen.getByText('Użyj formatu Jeśli/To/Ponieważ.')).toBeInTheDocument();
  });

  it('does not validate when the thesis is shorter than 8 chars', async () => {
    renderWizard();
    const ta = screen.getByPlaceholderText(THESIS_PLACEHOLDER);

    fireEvent.change(ta, { target: { value: 'krótko' } });
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await flush();

    expect(validateCardMock).not.toHaveBeenCalled();
  });

  it('coalesces rapid edits into a single validation of the final value', async () => {
    validateCardMock.mockResolvedValue([]);
    renderWizard();
    const ta = screen.getByPlaceholderText(THESIS_PLACEHOLDER);

    fireEvent.change(ta, { target: { value: 'pierwsza wersja tezy' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.change(ta, { target: { value: 'finalna wersja tezy hipotezy' } });
    await act(async () => {
      vi.advanceTimersByTime(650);
    });
    await flush();

    expect(validateCardMock).toHaveBeenCalledTimes(1);
    expect(validateCardMock).toHaveBeenCalledWith(
      'finalna wersja tezy hipotezy',
      expect.any(Array)
    );
  });
});
