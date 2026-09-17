/**
 * @vitest-environment jsdom
 *
 * U-25 v2 / DEC-572 (RAPORT-GEN, Wpis 66 → Wpis 72) — `NewAssessmentReportModal`
 * wysyła do `/report-builder` jako `sourceId` id legacy bliźniaka `assessments`
 * (`reportSourceId`), NIE `method_sessions.id`. Od v2 zamrożona sesja BEZ
 * bliźniaka nie blokuje już przycisku — modal MATERIALIZUJE bliźniaka przez
 * `V8AssessmentApi.createLegacyTwin(sessionId)` i POSTuje nowo zwrócone id.
 *
 * POMIAR (diagnoza W98_RAPORT_GEN + kopia dumpu stagingu): `AssessmentHub`
 * buduje listę z kanonicznych sesji Method Core przez `methodSessionToAssessment`,
 * która zwracała `id = session.id` i gubiła id bliźniaka. Modal POSTował więc
 * `sourceId = session.id`, a backend (który zna tylko `assessments.id`)
 * odpowiadał „Assessment not found". Na kopii dumpu 20/20 sesji (w tym 2
 * zamrożone = APPROVED) NIE MA bliźniaka, a ścieżka `freeze` go nie tworzy —
 * dlatego w v1 modal blokował i radził „freeze it first" (fałsz: sesja JUŻ
 * zamrożona). v2 domyka źródło w locie (bloker pilotażu).
 *
 * Ten test broni samego modalu (samodzielny komponent, propsy wprost):
 *   1. sesja Method Core Z bliźniakiem → Create draft POSTuje `sourceId=twin.id`
 *      (nie `session.id`), BEZ wywołania `createLegacyTwin`;
 *   2. zamrożona sesja BEZ bliźniaka (`reportSourceId=null`) → przycisk AKTYWNY,
 *      klik → `createLegacyTwin(sessionId)` → POST `/report-builder` z
 *      `sourceId=twin-new`;
 *   3. wiersz legacy (`reportSourceId=undefined`) → fallback na `id`
 *      (które już jest `assessments.id`) — regresja ReportBuilderView.
 *
 * DOWÓD MUTACYJNY: przywrócenie `sourceId: assessmentId` (zamiast
 * `selectedSourceId`) w onClick → test 1 RED. Usunięcie bloku tworzenia
 * bliźniaka (`if (!sourceId) { … createLegacyTwin … }`) → test 2 RED
 * (`Api.post` dostaje `sourceId=null` zamiast `twin-new`).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: string) => (typeof fallback === 'string' ? fallback : _k),
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    loading: vi.fn(() => 'toast-id'),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: { post: vi.fn(async () => ({ id: 'report-1' })) },
}));

vi.mock('@/services/api/v8/assessment', () => ({
  V8AssessmentApi: {
    createLegacyTwin: vi.fn(async () => ({ assessmentId: 'twin-new', created: true })),
  },
}));

vi.mock('../modals/ReportTemplatePickerModal', () => ({
  ReportTemplatePickerModal: () => null,
}));

import { Api } from '@/services/api';
import { V8AssessmentApi } from '@/services/api/v8/assessment';
import { NewAssessmentReportModal } from '../modals/NewAssessmentReportModal';

const TEMPLATE = { id: 'tpl-1', name: 'Template One' };

function renderModal(assessments: Array<Record<string, unknown>>) {
  return render(
    <NewAssessmentReportModal
      isOpen
      assessments={assessments as any}
      onClose={() => {}}
      onCreated={() => {}}
      initialTemplate={TEMPLATE}
      lockTemplate
    />
  );
}

const selectId = 'new-assessment-report-assessment-select';

afterEach(() => {
  vi.clearAllMocks();
});

describe('U-25 / DEC-572 — NewAssessmentReportModal reportSourceId', () => {
  it('POSTs the legacy twin id (not the session id) for a Method Core session WITH a twin', async () => {
    renderModal([
      { id: 'sess-twin', name: 'Session with twin', status: 'APPROVED', type: 'DRD', reportSourceId: 'twin-1' },
    ]);
    fireEvent.change(screen.getByLabelText('Assessment'), { target: { value: 'sess-twin' } });

    const create = screen.getByRole('button', { name: /Create draft/i });
    expect(create).not.toBeDisabled();
    fireEvent.click(create);

    await waitFor(() => expect(Api.post).toHaveBeenCalled());
    const [url, body] = (Api.post as any).mock.calls[0];
    expect(url).toBe('/report-builder');
    expect(body.sourceId).toBe('twin-1');
    expect(body.sourceId).not.toBe('sess-twin');
    expect(V8AssessmentApi.createLegacyTwin).not.toHaveBeenCalled();
  });

  it('materializes the twin then POSTs for a frozen Method Core session WITHOUT a twin', async () => {
    renderModal([
      { id: 'sess-no-twin', name: 'Frozen, no twin', status: 'APPROVED', type: 'DRD', reportSourceId: null },
    ]);
    fireEvent.change(screen.getByLabelText('Assessment'), { target: { value: 'sess-no-twin' } });

    // v2: no longer a hard block — a neutral note explains the source will be
    // created, and the button stays enabled for a frozen (APPROVED) session.
    expect(screen.getByTestId('new-assessment-report-source-note')).toBeTruthy();
    const create = screen.getByRole('button', { name: /Create draft/i });
    expect(create).not.toBeDisabled();

    fireEvent.click(create);

    await waitFor(() => expect(Api.post).toHaveBeenCalled());
    expect(V8AssessmentApi.createLegacyTwin).toHaveBeenCalledWith('sess-no-twin');
    const [url, body] = (Api.post as any).mock.calls[0];
    expect(url).toBe('/report-builder');
    expect(body.sourceId).toBe('twin-new');
    expect(body.sourceId).not.toBe('sess-no-twin');
  });

  it('falls back to id for a legacy row (reportSourceId undefined) — ReportBuilderView parity', async () => {
    renderModal([
      { id: 'legacy-9', name: 'Legacy assessment', status: 'APPROVED', type: 'SWOT' },
    ]);
    fireEvent.change(screen.getByLabelText('Assessment'), { target: { value: 'legacy-9' } });

    const create = screen.getByRole('button', { name: /Create draft/i });
    expect(create).not.toBeDisabled();
    fireEvent.click(create);

    await waitFor(() => expect(Api.post).toHaveBeenCalled());
    const [, body] = (Api.post as any).mock.calls[0];
    expect(body.sourceId).toBe('legacy-9');
  });
});
