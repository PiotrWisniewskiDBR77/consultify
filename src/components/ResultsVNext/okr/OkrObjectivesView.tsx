/**
 * OkrObjectivesView — RN-G2 §G #25, the Objectives-under-one-Set drill view.
 * Reached from `ResultsOkrHub.tsx` via the Set preview's "Cele" informational
 * action (§ROUTING DECISION below) — NOT a new route.
 *
 * ── ROUTING DECISION (task brief: "wybierz i uzasadnij, nie twórz nowych
 * tras") ─────────────────────────────────────────────────────────────────
 * Chose BREADCRUMB DRILL-DOWN under the existing `/results/okr` route
 * (`StandardModuleBar`'s Menu-1 `breadcrumbs`/`breadcrumbCta`, "embedded hub"
 * mode) over new Menu-2 tabs, because every level below Sets is STRUCTURALLY
 * SCOPED to exactly one parent: `GET .../objectives` needs a `setId`,
 * `GET .../check-ins` needs a `keyResultId` — there is no "all Objectives
 * across the org" list endpoint to back a flat tab (confirmed by reading
 * `okr.routes.ts` in full). A Menu-2 tab implies a sibling-perspective
 * toggle on the SAME parent scope (like Sets' own Organization/My/Company);
 * Objectives-of-a-Set is a CHILD scope, which is exactly what breadcrumbs
 * are for. This also keeps `ResultsOkrHub.tsx`'s existing Sets tabs/chips
 * untouched — the drill-down is additive state, not a fourth tab.
 */
import React, { useCallback, useEffect, useState } from 'react';

import type { StandardBreadcrumb } from '@/components/standard';
import { tokenService } from '@/services/tokenService';

import { ResultsVNextRegistryShell } from '../ResultsVNextRegistryShell';
import type { OkrSetDto } from './okrApi';
import {
  cancelObjective,
  createObjective,
  listObjectivesForSet,
  newOkrIdempotencyKey,
  OkrObjectiveApiError,
  updateObjective,
  type CreateOkrObjectiveInput,
  type OkrObjectiveWithKeyResultsDto,
  type UpdateOkrObjectiveInput,
} from './okrObjectiveApi';
import { getOkrSetChildEditLock } from './okrObjectiveMappers';
import { buildOkrObjectiveColumns, buildOkrObjectivePreview, buildOkrObjectiveRowMenu } from './okrObjectivePresenters';
import { OkrCancelDialog } from './OkrCancelDialog';
import { OkrObjectiveFormModal, type OkrObjectiveFormValues } from './OkrObjectiveFormModal';
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

function withId<T extends { objectiveId: string }>(row: T): T & { id: string } {
  return { ...row, id: row.objectiveId };
}

export interface OkrObjectivesViewProps {
  set: OkrSetDto;
  isPolish: boolean;
  breadcrumbs: StandardBreadcrumb[];
  onOpenKeyResults: (objective: OkrObjectiveWithKeyResultsDto, set: OkrSetDto) => void;
}

export const OkrObjectivesView: React.FC<OkrObjectivesViewProps> = ({ set, isPolish, breadcrumbs, onOpenKeyResults }) => {
  const [objectives, setObjectives] = useState<OkrObjectiveWithKeyResultsDto[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);

  const currentUserId = React.useMemo(() => resolveCurrentUserIdFromToken(), []);
  const childLock = getOkrSetChildEditLock(set.status);
  const childLockReason = childLock ? (isPolish ? childLock.reason.pl : childLock.reason.en) : null;

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [formInitial, setFormInitial] = useState<OkrObjectiveWithKeyResultsDto | null>(null);
  const [formBusy, setFormBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formConflict, setFormConflict] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<OkrObjectiveWithKeyResultsDto | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelConflict, setCancelConflict] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listObjectivesForSet(set.setId)
      .then((rows) => setObjectives(rows))
      .catch((err) => setError(toUserFacingErrorMessage(err, isPolish)))
      .finally(() => setLoading(false));
  }, [set.setId]);

  useEffect(() => {
    load();
  }, [load]);

  const selected = React.useMemo(
    () => (objectives ?? []).find((o) => o.objectiveId === selectedObjectiveId) ?? null,
    [objectives, selectedObjectiveId]
  );

  const openCreate = useCallback(() => {
    setFormMode('create');
    setFormInitial(null);
    setFormError(null);
    setFormConflict(false);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((row: OkrObjectiveWithKeyResultsDto) => {
    setFormMode('edit');
    setFormInitial(row);
    setFormError(null);
    setFormConflict(false);
    setFormOpen(true);
  }, []);

  const handleFormSubmit = useCallback(
    (values: OkrObjectiveFormValues) => {
      setFormBusy(true);
      setFormError(null);
      setFormConflict(false);
      const idempotencyKey = newOkrIdempotencyKey();
      const request =
        formMode === 'create'
          ? createObjective(set.setId, { ...values, idempotencyKey } as CreateOkrObjectiveInput)
          : formInitial
            ? updateObjective(formInitial.objectiveId, {
                expectedVersion: formInitial.rowVersion,
                title: values.title,
                description: values.description,
                rationale: values.rationale,
                ambitionType: values.ambitionType,
                ownerUserId: values.ownerUserId,
                reason: values.reason,
                idempotencyKey,
              } as UpdateOkrObjectiveInput)
            : Promise.reject(new Error('missing initial objective for edit'));
      request
        .then(() => {
          setFormOpen(false);
          if (formMode === 'create') setSelectedObjectiveId(null);
          load();
        })
        .catch((err) => {
          const isConflict = err instanceof OkrObjectiveApiError && err.status === 409;
          setFormConflict(isConflict);
          setFormError(toUserFacingErrorMessage(err, isPolish));
        })
        .finally(() => setFormBusy(false));
    },
    [formMode, formInitial, set.setId, load]
  );

  const handleCancelSubmit = useCallback(
    (reason: string | null) => {
      if (!cancelTarget) return;
      setCancelBusy(true);
      setCancelError(null);
      setCancelConflict(false);
      cancelObjective(cancelTarget.objectiveId, {
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

  const rows = (objectives ?? []).map(withId);

  return (
    <>
      <ResultsVNextRegistryShell
        domain="okr"
        moduleBar={{
          breadcrumbs,
          breadcrumbCta: {
            label: isPolish ? 'Nowy cel' : 'New objective',
            onClick: openCreate,
            testId: 'okr-objectives-create-cta',
            locked: !!childLock,
            lockedReason: childLockReason ?? undefined,
          },
        }}
        table={{
          columns: buildOkrObjectiveColumns(isPolish, set.status, currentUserId),
          data: rows,
          // D09 (task brief, 2026-08-11): persistKey is per SURFACE, never per
          // record id — a `${set.setId}` suffix here would (a) not carry
          // column layout between Sets the user opens (column layout belongs
          // to the "Objectives of a Set" surface, not to one specific Set)
          // and (b) grow the browser's localStorage key count without bound,
          // one per Set ever opened, with no cleanup. Fixed from the prior
          // `results-vnext.okr-objectives.${set.setId}` (flagged as OQ-UI-H
          // in RN_G2_OPEN_QUESTIONS_UI.md) to the stable surface key below.
          persistKey: 'results-vnext.okr-objectives',
          loading,
          error,
          onRetry: load,
          empty:
            !loading && !error && rows.length === 0
              ? {
                  title: isPolish ? 'Brak celów w tym zestawie' : 'No objectives in this set',
                  description: isPolish
                    ? 'W tym zestawie OKR nie utworzono jeszcze żadnego celu.'
                    : 'No objective has been created in this OKR set yet.',
                  actionLabel: childLock ? undefined : isPolish ? 'Nowy cel' : 'New objective',
                  onAction: childLock ? undefined : openCreate,
                }
              : undefined,
          selectedRowId: selectedObjectiveId,
          onRowClick: (row) => setSelectedObjectiveId(String(row.objectiveId)),
          rowMenu: (row) =>
            buildOkrObjectiveRowMenu(row as unknown as OkrObjectiveWithKeyResultsDto, isPolish, set.status, {
              onPreview: (r) => setSelectedObjectiveId(r.objectiveId),
              onOpenKeyResults: (r) => onOpenKeyResults(r, set),
              onEdit: openEdit,
              onCancel: setCancelTarget,
            }),
          defaultSort: { columnId: 'updatedAt', direction: 'desc' },
        }}
        preview={
          selected
            ? buildOkrObjectivePreview(selected, {
                isPolish,
                parentSetStatus: set.status,
                onClose: () => setSelectedObjectiveId(null),
                onOpenKeyResults: (r) => onOpenKeyResults(r, set),
                onEdit: openEdit,
                onCancel: setCancelTarget,
              })
            : null
        }
      />
      <OkrObjectiveFormModal
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
        entityKind="objective"
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

export default OkrObjectivesView;
