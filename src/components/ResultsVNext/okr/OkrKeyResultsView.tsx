/**
 * OkrKeyResultsView — RN-G2 §G #25, the Key-Results-under-one-Objective
 * drill view. Reached from `OkrObjectivesView.tsx`'s "Kluczowe Rezultaty"
 * action — same breadcrumb-drill routing decision documented in
 * `OkrObjectivesView.tsx`'s header.
 *
 * List source: `getObjectiveWithKeyResults(objectiveId)` — there is NO
 * separate "list Key Results for an Objective" endpoint (see
 * `okrObjectiveApi.ts` file header for the full, code-cited proof); the
 * backend nests KRs onto the Objective response instead. Every mutation
 * here (create/update/cancel KR) therefore refetches the WHOLE Objective
 * (not just a KR list) to stay honest about what the real API actually
 * returns.
 */
import React, { useCallback, useEffect, useState } from 'react';

import type { StandardBreadcrumb } from '@/components/standard';
import { tokenService } from '@/services/tokenService';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import type { OkrSetDto } from './okrApi';
import {
  cancelKeyResult,
  createKeyResult,
  getObjectiveWithKeyResults,
  newOkrIdempotencyKey,
  OkrObjectiveApiError,
  updateKeyResult,
  type CreateOkrKeyResultInput,
  type OkrKeyResultDto,
  type OkrObjectiveWithKeyResultsDto,
  type UpdateOkrKeyResultInput,
} from './okrObjectiveApi';
import { getOkrSetChildEditLock } from './okrObjectiveMappers';
import { buildOkrKeyResultColumns, buildOkrKeyResultPreview, buildOkrKeyResultRowMenu } from './okrKeyResultPresenters';
import { OkrCancelDialog } from './OkrCancelDialog';
import { OkrKeyResultFormModal, type OkrKeyResultFormValues } from './OkrKeyResultFormModal';
import { toUserFacingErrorMessage } from '../shared/errorMessage';

function resolveCurrentUserIdFromToken(): string | null {
  try {
    const token = tokenService.getToken();
    if (!token) return null;
    return tokenService.decodeToken(token)?.id ?? null;
  } catch {
    return null;
  }
}

function withId<T extends { keyResultId: string }>(row: T): T & { id: string } {
  return { ...row, id: row.keyResultId };
}

export interface OkrKeyResultsViewProps {
  set: OkrSetDto;
  objectiveId: string;
  isPolish: boolean;
  breadcrumbs: StandardBreadcrumb[];
  onOpenCheckIns: (keyResult: OkrKeyResultDto, objective: OkrObjectiveWithKeyResultsDto, set: OkrSetDto) => void;
}

export const OkrKeyResultsView: React.FC<OkrKeyResultsViewProps> = ({ set, objectiveId, isPolish, breadcrumbs, onOpenCheckIns }) => {
  const [objective, setObjective] = useState<OkrObjectiveWithKeyResultsDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeyResultId, setSelectedKeyResultId] = useState<string | null>(null);

  const currentUserId = React.useMemo(() => resolveCurrentUserIdFromToken(), []);
  const childLock = getOkrSetChildEditLock(set.status);
  const childLockReason = childLock ? (isPolish ? childLock.reason.pl : childLock.reason.en) : null;

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formInitial, setFormInitial] = useState<OkrKeyResultDto | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formConflict, setFormConflict] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<OkrKeyResultDto | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelConflict, setCancelConflict] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getObjectiveWithKeyResults(objectiveId)
      .then((obj) => setObjective(obj))
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setLoading(false));
  }, [objectiveId]);

  useEffect(() => {
    load();
  }, [load]);

  const keyResults = objective?.keyResults ?? [];
  const selected = keyResults.find((kr) => kr.keyResultId === selectedKeyResultId) ?? null;

  const openCreate = useCallback(() => {
    setFormMode('create');
    setFormInitial(null);
    setFormError(null);
    setFormConflict(false);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row: OkrKeyResultDto) => {
    setFormMode('edit');
    setFormInitial(row);
    setFormError(null);
    setFormConflict(false);
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    (values: OkrKeyResultFormValues) => {
      setFormBusy(true);
      setFormError(null);
      setFormConflict(false);
      const idempotencyKey = newOkrIdempotencyKey();
      const request =
        formMode === 'create'
          ? createKeyResult(objectiveId, { ...values, idempotencyKey } as CreateOkrKeyResultInput)
          : formInitial
            ? updateKeyResult(formInitial.keyResultId, {
                expectedVersion: formInitial.rowVersion,
                title: values.title,
                description: values.description,
                ownerUserId: values.ownerUserId,
                measurementType: values.measurementType,
                unit: values.unit,
                currency: values.currency,
                baselineValue: values.baselineValue,
                targetValue: values.targetValue,
                startValue: values.startValue,
                currentValue: values.currentValue,
                direction: values.direction,
                rangeMin: values.rangeMin,
                rangeMax: values.rangeMax,
                confidence: values.confidence,
                confidenceNumericValue: values.confidenceNumericValue,
                sourceType: values.sourceType,
                sourceReference: values.sourceReference,
                weight: values.weight,
                reason: values.reason,
                idempotencyKey,
              } as UpdateOkrKeyResultInput)
            : Promise.reject(new Error('missing initial key result for edit'));
      request
        .then(() => {
          setFormOpen(false);
          if (formMode === 'create') setSelectedKeyResultId(null);
          load();
        })
        .catch((err) => {
          const isConflict = err instanceof OkrObjectiveApiError && err.status === 409;
          setFormConflict(isConflict);
          setFormError(toUserFacingErrorMessage(err, isPolish));
        })
        .finally(() => setFormBusy(false));
    },
    [formMode, formInitial, objectiveId, load]
  );

  const handleCancelSubmit = useCallback(
    (reason: string | null) => {
      if (!cancelTarget) return;
      setCancelBusy(true);
      setCancelError(null);
      setCancelConflict(false);
      cancelKeyResult(cancelTarget.keyResultId, {
        expectedVersion: cancelTarget.rowVersion,
        reason,
        idempotencyKey: newOkrIdempotencyKey(),
      })
        .then(() => {
          setCancelTarget(null);
          load();
        })
        .catch((err) => {
          const isConflict = err instanceof OkrObjectiveApiError && err.status === 409;
          setCancelConflict(isConflict);
          setCancelError(toUserFacingErrorMessage(err, isPolish));
        })
        .finally(() => setCancelBusy(false));
    },
    [cancelTarget, load]
  );

  const rows = keyResults.map(withId);

  return (
    <>
      <ResultsVNextRegistryShell
        domain="okr"
        moduleBar={{
          breadcrumbs,
          breadcrumbCta: {
            label: isPolish ? 'Nowy Kluczowy Rezultat' : 'New Key Result',
            onClick: openCreate,
            testId: 'okr-kr-create-cta',
            locked: !!childLock,
            lockedReason: childLockReason ?? undefined,
          },
        }}
        table={{
          columns: buildOkrKeyResultColumns(isPolish, set.status, currentUserId),
          data: rows,
          // D09 fix — see OkrObjectivesView.tsx's identical note. Was
          // `results-vnext.okr-key-results.${objectiveId}` (OQ-UI-H).
          persistKey: 'results-vnext.okr-key-results',
          loading,
          error,
          onRetry: load,
          empty:
            !loading && !error && rows.length === 0
              ? {
                  title: isPolish ? 'Brak Kluczowych Rezultatów' : 'No Key Results yet',
                  description: isPolish
                    ? 'Ten cel nie ma jeszcze żadnego Kluczowego Rezultatu.'
                    : 'This objective has no Key Result yet.',
                  actionLabel: childLock ? undefined : isPolish ? 'Nowy Kluczowy Rezultat' : 'New Key Result',
                  onAction: childLock ? undefined : openCreate,
                }
              : undefined,
          selectedRowId: selectedKeyResultId,
          onRowClick: (row) => setSelectedKeyResultId(String(row.keyResultId)),
          rowMenu: (row) =>
            buildOkrKeyResultRowMenu(row as unknown as OkrKeyResultDto, isPolish, set.status, {
              onPreview: (r) => setSelectedKeyResultId(r.keyResultId),
              onOpenCheckIns: (r) => objective && onOpenCheckIns(r, objective, set),
              onEdit: openEdit,
              onCancel: setCancelTarget,
            }),
          defaultSort: { columnId: 'updatedAt', direction: 'desc' },
        }}
        preview={
          selected
            ? buildOkrKeyResultPreview(selected, {
                isPolish,
                currentUserId,
                parentSetStatus: set.status,
                onClose: () => setSelectedKeyResultId(null),
                onOpenCheckIns: (r) => objective && onOpenCheckIns(r, objective, set),
                onEdit: openEdit,
                onCancel: setCancelTarget,
              })
            : null
        }
      />
      <OkrKeyResultFormModal
        open={formOpen}
        mode={formMode}
        initial={formInitial}
        onClose={() => (formBusy ? undefined : setFormOpen(false))}
        onSubmit={handleFormSubmit}
        isPolish={isPolish}
        currentUserId={currentUserId}
        blockedReason={childLockReason}
        busy={formBusy}
        errorMessage={formError}
        isConflict={formConflict}
      />
      <OkrCancelDialog
        open={!!cancelTarget}
        entityTitle={cancelTarget?.title ?? ''}
        entityKind="keyResult"
        isPolish={isPolish}
        onClose={() => (cancelBusy ? undefined : setCancelTarget(null))}
        onSubmit={handleCancelSubmit}
        busy={cancelBusy}
        errorMessage={cancelError}
        isConflict={cancelConflict}
      />
    </>
  );
};

export default OkrKeyResultsView;
