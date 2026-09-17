/**
 * @vitest-environment jsdom
 *
 * U-25 / DEC-572 (RAPORT-GEN, Wpis 66) — `NewAssessmentReportModal` wysyła do
 * `/report-builder` jako `sourceId` id legacy bliźniaka `assessments`
 * (`reportSourceId`), NIE `method_sessions.id`.
 *
 * POMIAR (diagnoza W98_RAPORT_GEN + kopia dumpu stagingu): `AssessmentHub`
 * buduje listę z kanonicznych sesji Method Core przez `methodSessionToAssessment`,
 * która zwracała `id = session.id` i gubiła id bliźniaka. Modal POSTował więc
 * `sourceId = session.id`, a backend (który zna tylko `assessments.id`)
 * odpowiadał „Assessment not found". Na kopii dumpu 0 z 20 sesji (0 z 2
 * zamrożonych = APPROVED, które modal w ogóle pokazuje) ma bliźniaka — dlatego
 * dla sesji BEZ bliźniaka modal pokazuje czytelny komunikat „freeze it first"
 * zamiast mylącego błędu backendu.
 *
 * Ten test broni samego modalu (samodzielny komponent, propsy wprost):
 *   1. sesja Method Core Z bliźniakiem → Create draft POSTuje `sourceId=twin.id`
 *      (nie `session.id`);
 *   2. sesja Method Core BEZ bliźniaka (`reportSourceId=null`) → przycisk
 *      zablokowany, inline-komunikat widoczny, ZERO POST;
 *   3. wiersz legacy (`reportSourceId=undefined`) → fallback na `id`
 *      (które już jest `assessments.id`) — regresja ReportBuilderView.
 *
 * DOWÓD MUTACYJNY: przywrócenie `sourceId: assessmentId` (zamiast
 * `selectedSourceId`) w onClick → test 1 RED (POST z `sess-twin`, nie `twin-1`).
 * Usunięcie `selectedSourceId` z `canCreate` → test 2 RED (przycisk aktywny).
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

vi.mock('../modals/ReportTemplatePickerModal', () => ({
  ReportTemplatePickerModal: () => null,
}));

import { Api } from '@/services/api';
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
  });

  it('blocks creation and shows a readable message for a Method Core session WITHOUT a twin', async () => {
    renderModal([
      { id: 'sess-no-twin', name: 'Frozen, no twin', status: 'APPROVED', type: 'DRD', reportSourceId: null },
    ]);
    fireEvent.change(screen.getByLabelText('Assessment'), { target: { value: 'sess-no-twin' } });

    expect(screen.getByTestId('new-assessment-report-no-source')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Create draft/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Create draft/i }));
    await waitFor(() => {});
    expect(Api.post).not.toHaveBeenCalled();
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
