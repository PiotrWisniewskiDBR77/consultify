/**
 * @vitest-environment jsdom
 *
 * RES-003A — component tests for the canonical KPI Recovery Card panel.
 *
 * Unlike the sibling KPITimeSeriesDrawer tests, this file deliberately does
 * NOT mock `react-i18next`. The Recovery Card ships brand-new i18n keys
 * (`results.recoveryCard.*`) added alongside the component in this same
 * change, and a `t(key, fallback) => fallback` mock would happily render the
 * English fallback string even if the real key were missing/misspelled in
 * `public/locales/<lang>/translation.json` — exactly the class of regression that
 * hit `results.deviation.*` previously. Instead we boot a real, isolated
 * i18next instance seeded with the actual `en` resource file and wrap every
 * render in a real `I18nextProvider`, so every `screen.getByText(...)`
 * assertion in this file is implicitly a "the key resolves" assertion too.
 */
import i18next from 'i18next';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// `tests/setup.ts` globally mocks `react-i18next` (key-agnostic proxy, `t()`
// just echoes back the fallback) to keep the wider suite fast/OOM-safe. That
// mock would happily "pass" this file even if a `results.recoveryCard.*` key
// were missing or misspelled in the real locale JSON — the exact class of
// regression this file exists to catch (see file-level comment below).
// `vi.unmock` here restores the REAL `react-i18next` for this file only.
vi.unmock('react-i18next');

import { I18nextProvider, initReactI18next } from 'react-i18next';
import enTranslation from '../../../public/locales/en/translation.json';

const { mockNavigate } = vi.hoisted(() => ({ mockNavigate: vi.fn() }));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getRecoveryCard: vi.fn(),
    createRecoveryCard: vi.fn(),
    updateRecoveryCard: vi.fn(),
    createRecoveryAction: vi.fn(),
    updateRecoveryAction: vi.fn(),
    linkRecoveryActionTask: vi.fn(),
    createRecoveryCheckpoint: vi.fn(),
    resolveRecoveryCheckpoint: vi.fn(),
    closeRecoveryCard: vi.fn(),
    continueRecoveryCard: vi.fn(),
    escalateRecoveryCard: vi.fn(),
    listRecoveryExperiments: vi.fn(),
    createRecoveryExperiment: vi.fn(),
    reviewRecoveryExperiment: vi.fn(),
    decideRecoveryExperiment: vi.fn(),
    confirmRecoveryCause: vi.fn(),
  },
}));

import { RecoveryCardPanel } from '../../../src/components/Results/RecoveryCardPanel';
import {
  V8ResultsApi,
  type V8ResultsKpiRecoveryAction,
  type V8ResultsKpiRecoveryCard,
} from '../../../src/services/api/v8/results';

const rc = enTranslation.results.recoveryCard;
const common = enTranslation.common;

// --- isolated real i18next instance, seeded from the real `en` resource file ---
const testI18n = i18next.createInstance();

beforeAll(async () => {
  await testI18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    ns: ['translation'],
    defaultNS: 'translation',
    resources: { en: { translation: enTranslation } },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
});

function renderPanel(props?: Partial<React.ComponentProps<typeof RecoveryCardPanel>>) {
  const defaultProps: React.ComponentProps<typeof RecoveryCardPanel> = {
    kpiId: 'kpi-1',
    deviationCaseId: 'case-1',
  };
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <RecoveryCardPanel {...defaultProps} {...props} />
      </MemoryRouter>
    </I18nextProvider>
  );
}

function makeCard(overrides: Partial<V8ResultsKpiRecoveryCard> = {}): V8ResultsKpiRecoveryCard {
  return {
    id: 'card-1',
    deviationCaseId: 'case-1',
    kpiId: 'kpi-1',
    hypothesis: 'Adoption dropped after the rollout',
    confirmedCause: null,
    impactDescription: null,
    priority: 'MEDIUM',
    expectedImpact: null,
    dependencies: [],
    risks: [],
    expectedRecoveryDate: null,
    effectivenessCriteria: null,
    effectivenessStatus: 'NOT_YET_DUE',
    effectivenessRating: null,
    lifecycleStatus: 'ACTIVE',
    decision: null,
    version: 3,
    evidenceText: null,
    evidenceRef: null,
    actions: [],
    checkpoints: [],
    createdBy: 'user-1',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedBy: 'user-1',
    updatedAt: '2026-07-15T00:00:00.000Z',
    closedBy: null,
    closedAt: null,
    ...overrides,
  };
}

function makeAction(
  overrides: Partial<V8ResultsKpiRecoveryAction> = {}
): V8ResultsKpiRecoveryAction {
  return {
    id: 'action-1',
    actionType: 'IMMEDIATE',
    title: 'Fix onboarding pipeline',
    description: null,
    ownerUserId: null,
    dueDate: null,
    status: 'OPEN',
    linkedTaskId: null,
    taskLinkStatus: 'NONE',
    rowVersion: 1,
    ...overrides,
  };
}

describe('RecoveryCardPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8ResultsApi.listRecoveryExperiments).mockResolvedValue([]);
  });

  it('projects the versioned experiment and keeps cause confirmation separate', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(makeCard());
    vi.mocked(V8ResultsApi.listRecoveryExperiments).mockResolvedValue([
      {
        id: 'experiment-1',
        recoveryCardId: 'card-1',
        version: 2,
        intervention: 'New routing',
        comparison: 'Prior routing',
        baseline: '12 days',
        measurementWindow: '30 days',
        successCriterion: '< 8 days',
        ownerUserId: 'owner-1',
        remeasureAt: '2031-03-01T12:00:00.000Z',
        approvalStatus: 'PENDING',
        approvedBy: null,
        approvedAt: null,
        verdict: null,
        verdictEvidence: null,
        decision: null,
        createdBy: 'user-1',
        createdAt: '2031-01-01T00:00:00.000Z',
      },
      {
        id: 'experiment-approved',
        recoveryCardId: 'card-1',
        version: 1,
        intervention: 'Approved routing',
        comparison: null,
        baseline: '12 days',
        measurementWindow: '30 days',
        successCriterion: '< 8 days',
        ownerUserId: 'owner-1',
        remeasureAt: '2099-03-01T12:00:00.000Z',
        approvalStatus: 'APPROVED',
        approvedBy: 'owner-1',
        approvedAt: '2031-01-02T00:00:00.000Z',
        verdict: null,
        verdictEvidence: null,
        decision: null,
        createdBy: 'user-1',
        createdAt: '2031-01-01T00:00:00.000Z',
      },
    ]);
    renderPanel();
    expect(await screen.findByText(/v2 · New routing/)).toBeInTheDocument();
    expect(screen.getByText(/verdict never confirms a cause/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'supported' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'not_supported' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'continue' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'close' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record verdict' })).toBeDisabled();
    expect(screen.getByText('Remeasurement is not due yet.')).toHaveClass('sr-only');
    expect(
      screen.getByRole('button', { name: /Confirm cause as a separate human decision/i })
    ).toBeDisabled();
  });

  it('1. shows a loading indicator while the initial fetch is pending', () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockReturnValue(new Promise(() => {}));

    renderPanel();

    expect(screen.getByText(rc.loading)).toBeInTheDocument();
  });

  it('2. shows the create CTA when there is no card yet (404)', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockRejectedValue({ status: 404 });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(rc.empty)).toBeInTheDocument();
    });

    const cta = screen.getByRole('button', { name: rc.createCta });
    expect(cta).toBeInTheDocument();
    // Disabled until a hypothesis is entered — becomes clickable once filled.
    expect(cta).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(rc.hypothesisPlaceholder), {
      target: { value: 'A working theory' },
    });
    expect(cta).toBeEnabled();
  });

  it('3. create flow: fills hypothesis + priority, submits, then shows the card view', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockRejectedValue({ status: 404 });
    vi.mocked(V8ResultsApi.createRecoveryCard).mockResolvedValue(
      makeCard({ hypothesis: 'My hypothesis text', priority: 'HIGH', lifecycleStatus: 'DRAFT' })
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(rc.empty)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(rc.hypothesisPlaceholder), {
      target: { value: 'My hypothesis text' },
    });
    fireEvent.click(screen.getByRole('button', { name: rc.priority.HIGH }));
    fireEvent.click(screen.getByRole('button', { name: rc.createCta }));

    await waitFor(() => {
      expect(V8ResultsApi.createRecoveryCard).toHaveBeenCalledWith('case-1', {
        hypothesis: 'My hypothesis text',
        priority: 'HIGH',
        expectedImpact: undefined,
        expectedRecoveryDate: undefined,
        effectivenessCriteria: undefined,
      });
    });

    // Panel switched from the create form to the loaded-card view.
    await waitFor(() => {
      expect(screen.queryByText(rc.empty)).not.toBeInTheDocument();
      expect(screen.getByText(rc.actionsTitle)).toBeInTheDocument();
    });
  });

  it('4. shows a generic error + retry on an unexpected failure, and retry re-calls getRecoveryCard', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockRejectedValue(new Error('Server exploded'));

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Server exploded')).toBeInTheDocument();
    });

    expect(V8ResultsApi.getRecoveryCard).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: rc.retry }));

    await waitFor(() => {
      expect(V8ResultsApi.getRecoveryCard).toHaveBeenCalledTimes(2);
    });
  });

  it('5. shows a forbidden message with no action buttons on 403', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockRejectedValue({ status: 403 });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(rc.forbidden)).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: /close|zamknij/i })).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('6. renders a full card: hypothesis, priority, lifecycle status, and dependency descriptions', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(
      makeCard({
        hypothesis: 'Root cause is a broken webhook',
        priority: 'HIGH',
        lifecycleStatus: 'UNDER_REVIEW',
        actions: [makeAction()],
        checkpoints: [{ id: 'cp-1', checkpointDate: '2026-08-15', status: 'PENDING', notes: null, rowVersion: 1 }],
        dependencies: [
          { description: 'Depends on Initiative Alpha', relatedId: 'INI-2', note: 'blocked' },
        ],
        risks: [{ description: 'Might regress adoption' }],
      })
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Root cause is a broken webhook')).toBeInTheDocument();
    });

    expect(screen.getByText(rc.priority.HIGH, { selector: 'span' })).toBeInTheDocument();
    expect(
      screen.getByText(rc.lifecycleStatus.UNDER_REVIEW, { selector: 'span' })
    ).toBeInTheDocument();
    expect(screen.getByText('Depends on Initiative Alpha')).toBeInTheDocument();
    expect(screen.getByText('Might regress adoption')).toBeInTheDocument();
  });

  it('7. edit inline + 409 version conflict keeps the draft and shows the conflict banner', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard)
      .mockResolvedValueOnce(makeCard({ hypothesis: 'Original hypothesis', version: 3 }))
      .mockResolvedValueOnce(makeCard({ hypothesis: 'Someone else changed this', version: 4 }));
    vi.mocked(V8ResultsApi.updateRecoveryCard).mockRejectedValue({
      status: 409,
      data: { reason: 'VERSION_CONFLICT' },
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Original hypothesis')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: common.edit }));

    const hypothesisField = screen.getByDisplayValue('Original hypothesis');
    fireEvent.change(hypothesisField, { target: { value: 'My unsaved draft edit' } });

    fireEvent.click(screen.getByRole('button', { name: common.save }));

    await waitFor(() => {
      expect(screen.getByText(rc.versionConflict)).toBeInTheDocument();
    });

    // The user's in-progress draft must survive the 409 + background refetch.
    expect(screen.getByDisplayValue('My unsaved draft edit')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Someone else changed this')).not.toBeInTheDocument();
  });

  it('8. adding an action sends a non-empty idempotencyKey and refetches the card', async () => {
    const created = makeAction();
    vi.mocked(V8ResultsApi.getRecoveryCard)
      .mockResolvedValueOnce(makeCard())
      .mockResolvedValueOnce(makeCard({ actions: [created] }));
    vi.mocked(V8ResultsApi.createRecoveryAction).mockResolvedValue(created);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(rc.actionsTitle)).toBeInTheDocument();
    });

    expect(V8ResultsApi.getRecoveryCard).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText(rc.actionTitlePlaceholder), {
      target: { value: 'Patch the webhook handler' },
    });
    fireEvent.click(screen.getByRole('button', { name: rc.actionType.DURABLE }));
    fireEvent.click(screen.getByRole('button', { name: rc.addAction }));

    await waitFor(() => {
      expect(V8ResultsApi.createRecoveryAction).toHaveBeenCalledTimes(1);
    });

    const [cardId, payload] = vi.mocked(V8ResultsApi.createRecoveryAction).mock.calls[0];
    expect(cardId).toBe('card-1');
    expect(payload).toMatchObject({ title: 'Patch the webhook handler', actionType: 'DURABLE' });
    expect(typeof payload.idempotencyKey).toBe('string');
    expect(payload.idempotencyKey!.length).toBeGreaterThan(0);

    // Sub-resource mutation contract: refetch the card, no local merge.
    await waitFor(() => {
      expect(V8ResultsApi.getRecoveryCard).toHaveBeenCalledTimes(2);
    });
  });

  it('8b. keeps the same durable key and draft when canonical cold readback does not confirm create', async () => {
    window.sessionStorage.clear();
    const created = makeAction({ id: 'action-lost' });
    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(makeCard());
    vi.mocked(V8ResultsApi.createRecoveryAction).mockResolvedValue(created);
    renderPanel();
    await screen.findByText(rc.actionsTitle);
    const title = screen.getByPlaceholderText(rc.actionTitlePlaceholder);
    fireEvent.change(title, { target: { value: 'Persistent recovery action' } });
    fireEvent.click(screen.getByRole('button', { name: rc.addAction }));
    await waitFor(() => expect(V8ResultsApi.createRecoveryAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByDisplayValue('Persistent recovery action')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: rc.addAction }));
    await waitFor(() => expect(V8ResultsApi.createRecoveryAction).toHaveBeenCalledTimes(2));
    const firstKey = vi.mocked(V8ResultsApi.createRecoveryAction).mock.calls[0][1].idempotencyKey;
    const retryKey = vi.mocked(V8ResultsApi.createRecoveryAction).mock.calls[1][1].idempotencyKey;
    expect(retryKey).toBe(firstKey);
  });

  it('9. a LINKED action shows a clickable link that navigates to /my-work with the taskId', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(
      makeCard({
        actions: [
          makeAction({
            id: 'action-9',
            title: 'Already linked action',
            taskLinkStatus: 'LINKED',
            linkedTaskId: 'task-123',
          }),
        ],
      })
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Already linked action')).toBeInTheDocument();
    });

    const linkButton = screen.getByRole('button', { name: rc.taskLink.linked });
    fireEvent.click(linkButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const navigatedUrl = mockNavigate.mock.calls[0][0] as string;
    expect(navigatedUrl).toContain('/my-work');
    expect(navigatedUrl).toContain('taskId=task-123');
  });

  it('10. Close is blocked client-side when no evidence was entered', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(makeCard());

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(rc.actionsTitle)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: rc.close })[0]);

    // Rating segmented option, but no evidence text/ref filled in.
    fireEvent.click(screen.getByRole('button', { name: rc.effectivenessRating.EFFECTIVE }));

    const closeButtons = screen.getAllByRole('button', { name: rc.close });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    expect(screen.getByText(rc.closeBlocked.MISSING_EVIDENCE)).toBeInTheDocument();
    expect(V8ResultsApi.closeRecoveryCard).not.toHaveBeenCalled();
  });

  it('11. Close 409 STILL_BREACHING shows the exact blocked-reason text and re-enables Close', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(makeCard());
    vi.mocked(V8ResultsApi.closeRecoveryCard).mockRejectedValue({
      status: 409,
      data: { reason: 'STILL_BREACHING', latestMeasurement: { value: 42 } },
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(rc.actionsTitle)).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: rc.close })[0]);
    fireEvent.change(screen.getByPlaceholderText(rc.evidenceText), {
      target: { value: 'Verified via dashboard' },
    });
    fireEvent.click(screen.getByRole('button', { name: rc.effectivenessRating.EFFECTIVE }));

    let closeButtons = screen.getAllByRole('button', { name: rc.close });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(rc.closeBlocked.STILL_BREACHING)).toBeInTheDocument();
    });

    expect(V8ResultsApi.closeRecoveryCard).toHaveBeenCalledTimes(1);

    closeButtons = screen.getAllByRole('button', { name: rc.close });
    expect(closeButtons[closeButtons.length - 1]).toBeEnabled();
  });

  it('12. Close success has zero optimistic UI: status only flips to CLOSED after the response resolves', async () => {
    const activeCard = makeCard({ lifecycleStatus: 'ACTIVE', version: 5 });
    const closedCard = {
      ...activeCard,
      lifecycleStatus: 'CLOSED' as const,
      closedAt: '2026-08-01T12:00:00.000Z',
    };

    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(activeCard);
    vi.mocked(V8ResultsApi.closeRecoveryCard).mockReturnValue(
      new Promise((resolve) => {
        setTimeout(() => resolve(closedCard), 50);
      })
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(rc.actionsTitle)).toBeInTheDocument();
    });

    // Sanity: badge shows ACTIVE before any close interaction.
    expect(screen.getByText(rc.lifecycleStatus.ACTIVE, { selector: 'span' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: rc.close })[0]);
    fireEvent.change(screen.getByPlaceholderText(rc.evidenceText), {
      target: { value: 'Verified via dashboard' },
    });
    fireEvent.click(screen.getByRole('button', { name: rc.effectivenessRating.EFFECTIVE }));

    const closeButtons = screen.getAllByRole('button', { name: rc.close });
    fireEvent.click(closeButtons[closeButtons.length - 1]);

    // Immediately after the click (well before the 50ms server delay elapses)
    // the UI must still show the pre-close lifecycle status — no optimistic flip.
    expect(screen.getByText(rc.lifecycleStatus.ACTIVE, { selector: 'span' })).toBeInTheDocument();
    expect(
      screen.queryByText(rc.lifecycleStatus.CLOSED, { selector: 'span' })
    ).not.toBeInTheDocument();

    await waitFor(
      () => {
        expect(
          screen.getByText(rc.lifecycleStatus.CLOSED, { selector: 'span' })
        ).toBeInTheDocument();
      },
      { timeout: 1000 }
    );
  });

  it('13a. Continue sends the card current version', async () => {
    const card = makeCard({ version: 7 });
    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(card);
    vi.mocked(V8ResultsApi.continueRecoveryCard).mockResolvedValue(card);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(rc.actionsTitle)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: rc.continue }));

    await waitFor(() => {
      expect(V8ResultsApi.continueRecoveryCard).toHaveBeenCalledWith(
        'card-1',
        expect.objectContaining({ version: 7 })
      );
    });
  });

  it('13b. Escalate sends the card current version', async () => {
    const card = makeCard({ version: 9 });
    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(card);
    vi.mocked(V8ResultsApi.escalateRecoveryCard).mockResolvedValue(card);

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(rc.actionsTitle)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: rc.escalate }));

    await waitFor(() => {
      expect(V8ResultsApi.escalateRecoveryCard).toHaveBeenCalledWith(
        'card-1',
        expect.objectContaining({ version: 9 })
      );
    });
  });

  it('14. CRITICAL priority badge uses a danger token, never a `primary` class', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(makeCard({ priority: 'CRITICAL' }));

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText(rc.actionsTitle)).toBeInTheDocument();
    });

    const badge = screen.getByText(rc.priority.CRITICAL, { selector: 'span' });
    expect(badge.className).not.toMatch(/primary/i);
    expect(badge.className).toMatch(/danger/i);
  });

  it('15. dependencies/risks render description by default; relatedId/note stay hidden until expanded', async () => {
    vi.mocked(V8ResultsApi.getRecoveryCard).mockResolvedValue(
      makeCard({
        dependencies: [{ description: 'X', relatedId: 'INI-1', note: 'test' }],
      })
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('X')).toBeInTheDocument();
    });

    expect(screen.queryByDisplayValue('INI-1')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('test')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(rc.moreDetails));

    await waitFor(() => {
      expect(screen.getByDisplayValue('INI-1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    });
  });
});
