/**
 * @vitest-environment jsdom
 *
 * InitiativeCharterWizard — portfolio-aware dedup (M13 Depth · Seria C · C1 FE).
 *
 * Locks in the debounced, advisory duplicate-detection on the TITLE field:
 *   - typing ≥ 4 chars triggers checkSimilarInitiatives(title, thesis) after the
 *     500ms debounce, and any returned matches render in an amber "Podobne
 *     inicjatywy już istnieją" box (one row per match name);
 *   - short text (< 4 chars) never calls the service and shows no box;
 *   - an empty result list shows no box;
 *   - rapid edits are coalesced — only the final value is checked once.
 *
 * WizardModal is stubbed to render the first step's content (defineBody, which
 * holds the title field) so we test the dedup wiring, not the modal shell.
 * Setup mirrors InitiativeCharterWizard.b3-hints.test.tsx 1:1.
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

// Render the active step's content so the title field is in the DOM.
vi.mock('@/components/shared/WizardModal', () => ({
  // CharterWizard passes `open={isOpen}` + `activeStepIndex` to WizardModal.
  WizardModal: ({ open, steps, activeStepIndex = 0 }: any) =>
    open ? <div data-testid="wizard">{steps?.[activeStepIndex]?.content}</div> : null,
}));

import { InitiativeCharterWizard } from '@/components/Initiatives/Wizard/InitiativeCharterWizard';

// This suite stubs i18n with `t(key) => key`, so select the controls by the
// stable translation contracts rather than by locale-specific copy.
const TITLE_PLACEHOLDER = 'initiatives.initiativeCharterWizard.titlePlaceholder';
const SIMILAR_HEADING = 'initiatives.initiativeCharterWizard.similarWarning';

function renderWizard() {
  return render(<InitiativeCharterWizard isOpen onClose={vi.fn()} onCreated={vi.fn()} />);
}

async function flush() {
  // Resolve the checkSimilarInitiatives promise + the setState it schedules.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('InitiativeCharterWizard — C1 dedup', () => {
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

  it('checks for similar initiatives after debounce and renders the amber box', async () => {
    checkSimilarMock.mockResolvedValue([
      { id: 'i-1', name: 'Standaryzacja przekazań zmianowych', status: 'IN_PROGRESS', score: 0.82 },
    ]);
    renderWizard();
    const titleInput = screen.getByPlaceholderText(TITLE_PLACEHOLDER);

    fireEvent.change(titleInput, { target: { value: 'Standaryzacja przekazań' } });
    expect(checkSimilarMock).not.toHaveBeenCalled(); // debounce not elapsed

    await act(async () => {
      vi.advanceTimersByTime(550);
    });
    await flush();

    expect(checkSimilarMock).toHaveBeenCalledTimes(1);
    expect(checkSimilarMock).toHaveBeenCalledWith('Standaryzacja przekazań', '');
    expect(screen.getByText(SIMILAR_HEADING)).toBeInTheDocument();
    expect(screen.getByText('Standaryzacja przekazań zmianowych')).toBeInTheDocument();
  });

  it('does not check when the title is shorter than 4 chars', async () => {
    renderWizard();
    const titleInput = screen.getByPlaceholderText(TITLE_PLACEHOLDER);

    fireEvent.change(titleInput, { target: { value: 'abc' } });
    await act(async () => {
      vi.advanceTimersByTime(550);
    });
    await flush();

    expect(checkSimilarMock).not.toHaveBeenCalled();
    expect(screen.queryByText(SIMILAR_HEADING)).not.toBeInTheDocument();
  });

  it('renders no box when no similar initiatives are returned', async () => {
    checkSimilarMock.mockResolvedValue([]);
    renderWizard();
    const titleInput = screen.getByPlaceholderText(TITLE_PLACEHOLDER);

    fireEvent.change(titleInput, { target: { value: 'Zupełnie nowa inicjatywa' } });
    await act(async () => {
      vi.advanceTimersByTime(550);
    });
    await flush();

    expect(checkSimilarMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(SIMILAR_HEADING)).not.toBeInTheDocument();
  });

  it('coalesces rapid edits into a single check of the final value', async () => {
    checkSimilarMock.mockResolvedValue([]);
    renderWizard();
    const titleInput = screen.getByPlaceholderText(TITLE_PLACEHOLDER);

    fireEvent.change(titleInput, { target: { value: 'Pierwsza' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    fireEvent.change(titleInput, { target: { value: 'Finalny tytuł inicjatywy' } });
    await act(async () => {
      vi.advanceTimersByTime(550);
    });
    await flush();

    expect(checkSimilarMock).toHaveBeenCalledTimes(1);
    expect(checkSimilarMock).toHaveBeenCalledWith('Finalny tytuł inicjatywy', '');
  });
});
