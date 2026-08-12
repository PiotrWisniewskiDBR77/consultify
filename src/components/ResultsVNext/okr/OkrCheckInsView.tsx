/**
 * OkrCheckInsView — RN-G2 §G #25, the check-in-history-under-one-Key-Result
 * drill view. Reached from `OkrKeyResultsView.tsx`'s "Check-iny" action —
 * same breadcrumb-drill routing decision documented in
 * `OkrObjectivesView.tsx`'s header.
 *
 * "New check-in" gate: `getOkrCheckInSetLock(set.status)` — the OPPOSITE
 * lifecycle window from Objective/KR content edits (see
 * `okrObjectiveMappers.ts` header) — PLUS the KR's own `status !==
 * 'cancelled'` check (`okrCheckInCommands.ts` L433-439,
 * `KEY_RESULT_CANCELLED`), combined here since both are real, independent
 * server-enforced blockers for `recordCheckIn` specifically.
 * "Correct" has NO such gate (see `okrCheckInApi.ts`'s `correctCheckIn` doc
 * comment) — the row-level "Skoryguj" action is never disabled for a
 * lifecycle reason.
 */
import React, { useCallback, useEffect, useState } from 'react';

import type { StandardBreadcrumb } from '@/components/standard';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import type { OkrSetDto } from './okrApi';
import type { OkrKeyResultDto, OkrObjectiveWithKeyResultsDto } from './okrObjectiveApi';
import { getOkrCheckInSetLock } from './okrObjectiveMappers';
import {
  correctCheckIn,
  listCheckIns,
  newOkrCheckInIdempotencyKey,
  OkrCheckInApiError,
  recordCheckIn,
  suggestNextCheckInValue,
  type CorrectOkrCheckInInput,
  type OkrCheckInDto,
  type OkrSuggestNextCheckInValue,
  type RecordOkrCheckInInput,
} from './okrCheckInApi';
import { buildOkrCheckInColumns, buildOkrCheckInPreview, buildOkrCheckInRowMenu } from './okrCheckInPresenters';
import { OkrCheckInCorrectDialog, type OkrCheckInCorrectFormValues } from './OkrCheckInCorrectDialog';
import { OkrCheckInRecordDialog, type OkrCheckInRecordFormValues } from './OkrCheckInRecordDialog';
import { toUserFacingErrorMessage } from '../shared/errorMessage';

function withId<T extends { checkInId: string }>(row: T): T & { id: string } {
  return { ...row, id: row.checkInId };
}

export interface OkrCheckInsViewProps {
  set: OkrSetDto;
  objective: OkrObjectiveWithKeyResultsDto;
  keyResult: OkrKeyResultDto;
  isPolish: boolean;
  breadcrumbs: StandardBreadcrumb[];
}

export const OkrCheckInsView: React.FC<OkrCheckInsViewProps> = ({ set, keyResult, isPolish, breadcrumbs }) => {
  const [checkIns, setCheckIns] = useState<OkrCheckInDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCheckInId, setSelectedCheckInId] = useState<string | null>(null);

  const setLock = getOkrCheckInSetLock(set.status);
  const krCancelled = keyResult.status === 'cancelled';
  const blockedReason = setLock
    ? isPolish
      ? setLock.reason.pl
      : setLock.reason.en
    : krCancelled
      ? isPolish
        ? 'Kluczowy Rezultat jest anulowany — check-iny nie są przyjmowane (kod serwera: KEY_RESULT_CANCELLED).'
        : 'The Key Result is cancelled — check-ins are not accepted (server rule: KEY_RESULT_CANCELLED).'
      : null;

  const [recordOpen, setRecordOpen] = useState(false);
  const [recordBusy, setRecordBusy] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordConflict, setRecordConflict] = useState(false);
  const [suggestion, setSuggestion] = useState<OkrSuggestNextCheckInValue | null | undefined>(undefined);

  const [correctTarget, setCorrectTarget] = useState<OkrCheckInDto | null>(null);
  const [correctBusy, setCorrectBusy] = useState(false);
  const [correctError, setCorrectError] = useState<string | null>(null);
  const [correctConflict, setCorrectConflict] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listCheckIns(keyResult.keyResultId)
      .then((rows) => setCheckIns(rows))
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setLoading(false));
  }, [keyResult.keyResultId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = (checkIns ?? []).find((c) => c.checkInId === selectedCheckInId) ?? null;

  const openRecord = useCallback(() => {
    setRecordError(null);
    setRecordConflict(false);
    setSuggestion(undefined);
    setRecordOpen(true);
    suggestNextCheckInValue(keyResult.keyResultId)
      .then((s) => setSuggestion(s))
      .catch(() => setSuggestion(null));
  }, [keyResult.keyResultId]);

  const handleRecordSubmit = useCallback(
    (values: OkrCheckInRecordFormValues) => {
      setRecordBusy(true);
      setRecordError(null);
      setRecordConflict(false);
      const input: RecordOkrCheckInInput = { ...values, idempotencyKey: newOkrCheckInIdempotencyKey() };
      recordCheckIn(keyResult.keyResultId, input)
        .then(() => {
          setRecordOpen(false);
          load();
        })
        .catch((err) => {
          const isConflict = err instanceof OkrCheckInApiError && err.status === 409;
          setRecordConflict(isConflict);
          setRecordError(toUserFacingErrorMessage(err, isPolish));
        })
        .finally(() => setRecordBusy(false));
    },
    [keyResult.keyResultId, load]
  );

  const handleCorrectSubmit = useCallback(
    (values: OkrCheckInCorrectFormValues) => {
      if (!correctTarget) return;
      setCorrectBusy(true);
      setCorrectError(null);
      setCorrectConflict(false);
      const input: CorrectOkrCheckInInput = { ...values, idempotencyKey: newOkrCheckInIdempotencyKey() };
      correctCheckIn(keyResult.keyResultId, correctTarget.checkInId, input)
        .then(() => {
          setCorrectTarget(null);
          load();
        })
        .catch((err) => {
          const isConflict = err instanceof OkrCheckInApiError && err.status === 409;
          setCorrectConflict(isConflict);
          setCorrectError(toUserFacingErrorMessage(err, isPolish));
        })
        .finally(() => setCorrectBusy(false));
    },
    [correctTarget, keyResult.keyResultId, load]
  );

  const rows = (checkIns ?? []).map(withId);

  return (
    <>
      <ResultsVNextRegistryShell
        domain="okr"
        moduleBar={{
          breadcrumbs,
          breadcrumbCta: {
            label: isPolish ? 'Nowy check-in' : 'New check-in',
            onClick: openRecord,
            testId: 'okr-checkin-create-cta',
            locked: !!blockedReason,
            lockedReason: blockedReason ?? undefined,
          },
        }}
        table={{
          columns: buildOkrCheckInColumns(isPolish),
          data: rows,
          // D09 fix — see OkrObjectivesView.tsx's identical note. Was
          // `results-vnext.okr-check-ins.${keyResult.keyResultId}` (OQ-UI-H).
          persistKey: 'results-vnext.okr-check-ins',
          loading,
          error,
          onRetry: load,
          empty:
            !loading && !error && rows.length === 0
              ? {
                  title: isPolish ? 'Brak check-inów' : 'No check-ins yet',
                  description: isPolish
                    ? 'Dla tego Kluczowego Rezultatu nie zarejestrowano jeszcze żadnego check-inu.'
                    : 'No check-in has been recorded for this Key Result yet.',
                  actionLabel: blockedReason ? undefined : isPolish ? 'Nowy check-in' : 'New check-in',
                  onAction: blockedReason ? undefined : openRecord,
                }
              : undefined,
          selectedRowId: selectedCheckInId,
          onRowClick: (row) => setSelectedCheckInId(String(row.checkInId)),
          rowMenu: (row) =>
            buildOkrCheckInRowMenu(row as unknown as OkrCheckInDto, isPolish, {
              onPreview: (r) => setSelectedCheckInId(r.checkInId),
              onCorrect: setCorrectTarget,
            }),
          defaultSort: { columnId: 'submittedAt', direction: 'desc' },
        }}
        preview={
          selected
            ? buildOkrCheckInPreview(selected, {
                isPolish,
                onClose: () => setSelectedCheckInId(null),
                onCorrect: setCorrectTarget,
              })
            : null
        }
      />
      <OkrCheckInRecordDialog
        open={recordOpen}
        keyResultTitle={keyResult.title}
        isPolish={isPolish}
        onClose={() => (recordBusy ? undefined : setRecordOpen(false))}
        onSubmit={handleRecordSubmit}
        suggestion={suggestion}
        blockedReason={blockedReason}
        busy={recordBusy}
        errorMessage={recordError}
        isConflict={recordConflict}
      />
      <OkrCheckInCorrectDialog
        open={!!correctTarget}
        original={correctTarget}
        isPolish={isPolish}
        onClose={() => (correctBusy ? undefined : setCorrectTarget(null))}
        onSubmit={handleCorrectSubmit}
        busy={correctBusy}
        errorMessage={correctError}
        isConflict={correctConflict}
      />
    </>
  );
};

export default OkrCheckInsView;
