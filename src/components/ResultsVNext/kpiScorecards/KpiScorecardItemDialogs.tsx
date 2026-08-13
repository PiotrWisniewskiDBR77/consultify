/**
 * KpiScorecardItemDialogs — RN-G5 §G #8 write package: `AddKpiScorecardItemModal`
 * (`POST .../items`) and `RemoveKpiScorecardItemDialog` (`DELETE
 * .../items/:itemId`), the two item-membership write endpoints
 * `kpiScorecardPresenters.tsx`'s "not built" row-menu notes previously
 * blocked. PURE presentational, same convention as every other RN-G2/G5
 * write dialog in this program (`../roi/RoiRemoveLineItemDialog.tsx` is
 * this file's structural template for the remove half).
 *
 * `AddKpiScorecardItemModal` has NO KPI picker fetching its own list — the
 * caller (`ResultsKpiScorecardDetailPage.tsx`) already has no "list all
 * KPIs" fetch wired either, so this dialog still takes a free-text `kpiId`
 * field (same honesty posture `RoiCaseCreateModal.tsx`'s header documents
 * for its own optional fields with no real picker backing them: the org-wide
 * `GET /vnext/results/kpi` list exists, but wiring a full autocomplete
 * picker here is out of this package's scope — server-side validation
 * (`AddScorecardItemSchema`: `kpiId: z.string().uuid()`) still rejects a
 * malformed id honestly, this is not a fabricated success path).
 *
 * RN-G6 UI fix (task 3, 2026-08-12): typing a raw UUID with zero confirmation
 * of WHICH KPI it names was the actual complaint — `getKpiCurrentDefinitionVersion`
 * (`GET /kpi/:kpiId/version`, P0-D — the same read task 3's Contract-tab fix
 * uses) now resolves it to a real name, shown live below the field, so the
 * id is still what gets submitted (no picker exists to replace it) but the
 * person typing it can SEE they pasted the right one before clicking Add.
 */
import { AlertTriangle, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
import { Modal } from '@/components/ui/primitives';

import { getKpiCurrentDefinitionVersion } from '../kpiApi';
import { KPI_SCORECARD_ITEM_ROLES, type KpiScorecardItemRole } from './kpiScorecardApi';
import { kpiScorecardItemRoleLabel } from './kpiScorecardMappers';

const FIELD_CLASS =
  'w-full h-9 rounded-lg border border-c-border bg-c-surface px-3 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const TEXTAREA_CLASS =
  'w-full min-h-[64px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';
const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';
const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';
const DANGER_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg bg-c-danger px-4 text-sm font-medium text-white ' +
  'transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-50';

// ==========================================
// AddKpiScorecardItemModal
// ==========================================

export interface AddKpiScorecardItemFormValues {
  kpiId: string;
  role: KpiScorecardItemRole;
  reason: string | null;
}

export interface AddKpiScorecardItemModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: AddKpiScorecardItemFormValues) => void;
  isPolish: boolean;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

export const AddKpiScorecardItemModal: React.FC<AddKpiScorecardItemModalProps> = ({
  open,
  onClose,
  onSubmit,
  isPolish,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [kpiId, setKpiId] = useState('');
  const [role, setRole] = useState<KpiScorecardItemRole>('primary');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  // RN-G6 UI fix — resolved name for whatever id is currently typed.
  // 'loading' while a lookup is in flight, `null` once a lookup finished and
  // found nothing (not found / no visibility) — never conflated, same
  // honest-missing convention this package uses elsewhere.
  const [resolvedName, setResolvedName] = useState<string | null | 'loading'>(null);

  useEffect(() => {
    if (!open) return;
    setKpiId('');
    setRole('primary');
    setReason('');
    setTouched(false);
    setResolvedName(null);
  }, [open]);

  // Debounced live resolve — same UUID-shape pre-check the server's own
  // `z.string().uuid()` uses, just to avoid firing a request on every
  // keystroke of an obviously-incomplete id.
  useEffect(() => {
    const trimmed = kpiId.trim();
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    if (!looksLikeUuid) {
      setResolvedName(null);
      return;
    }
    let cancelled = false;
    setResolvedName('loading');
    const timer = setTimeout(() => {
      getKpiCurrentDefinitionVersion(trimmed)
        .then((version) => {
          if (!cancelled) setResolvedName(version?.name ?? null);
        })
        .catch(() => {
          if (!cancelled) setResolvedName(null);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kpiId]);

  const kpiIdError = touched && !kpiId.trim();

  const handleSubmit = () => {
    setTouched(true);
    if (!kpiId.trim()) return;
    onSubmit({ kpiId: kpiId.trim(), role, reason: reason.trim() || null });
  };

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Dodaj KPI do karty wyników' : 'Add KPI to scorecard'}
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            data-testid="kpi-scorecard-add-item-submit"
            className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Plus size={16} />
            <span>{busy ? (isPolish ? 'Dodawanie…' : 'Adding…') : isPolish ? 'Dodaj' : 'Add'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-add-item-kpi">
            KPI ID
          </label>
          <input
            id="kpi-scorecard-add-item-kpi"
            type="text"
            value={kpiId}
            onChange={(e) => setKpiId(e.target.value)}
            className={FIELD_CLASS}
            data-testid="kpi-scorecard-add-item-kpi"
            aria-invalid={kpiIdError || undefined}
            placeholder={isPolish ? 'wklej identyfikator KPI (UUID)' : 'paste the KPI id (UUID)'}
          />
          {kpiIdError ? (
            <p className="mt-1 text-[11px] text-c-danger">{isPolish ? 'KPI jest wymagane' : 'KPI is required'}</p>
          ) : resolvedName === 'loading' ? (
            <p className="mt-1 text-[11px] text-c-text-muted" data-testid="kpi-scorecard-add-item-resolve-loading">
              {isPolish ? 'Sprawdzanie…' : 'Checking…'}
            </p>
          ) : resolvedName ? (
            <p className="mt-1 text-[11px] text-c-success" data-testid="kpi-scorecard-add-item-resolve-name">
              {isPolish ? `Rozpoznano: ${resolvedName}` : `Resolved: ${resolvedName}`}
            </p>
          ) : kpiId.trim() ? (
            <p className="mt-1 text-[11px] text-c-text-muted" data-testid="kpi-scorecard-add-item-resolve-empty">
              {isPolish
                ? 'Nie rozpoznano nazwy dla tego identyfikatora (nie znaleziono lub brak widoczności).'
                : 'Could not resolve a name for this id (not found or no visibility).'}
            </p>
          ) : null}
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-add-item-role">
            {isPolish ? 'Rola' : 'Role'}
          </label>
          <select
            id="kpi-scorecard-add-item-role"
            value={role}
            onChange={(e) => setRole(e.target.value as KpiScorecardItemRole)}
            className={FIELD_CLASS}
            data-testid="kpi-scorecard-add-item-role"
          >
            {KPI_SCORECARD_ITEM_ROLES.map((r) => (
              <option key={r} value={r}>
                {kpiScorecardItemRoleLabel(r, isPolish)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-add-item-reason">
            {isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}
          </label>
          <textarea
            id="kpi-scorecard-add-item-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="kpi-scorecard-add-item-reason"
          />
        </div>
        {errorMessage ? (
          <p className="text-[12px] text-c-danger" role="alert" data-testid="kpi-scorecard-add-item-error">
            {isConflict
              ? isPolish
                ? `Konflikt zapisu: ${errorMessage}`
                : `Write conflict: ${errorMessage}`
              : errorMessage}
          </p>
        ) : null}
      </div>
    </Modal>
  );
};

// ==========================================
// RemoveKpiScorecardItemDialog
// ==========================================

export interface RemoveKpiScorecardItemDialogProps {
  open: boolean;
  itemLabel: string;
  isPolish: boolean;
  onClose: () => void;
  onSubmit: (reason: string | null) => void;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
}

export const RemoveKpiScorecardItemDialog: React.FC<RemoveKpiScorecardItemDialogProps> = ({
  open,
  itemLabel,
  isPolish,
  onClose,
  onSubmit,
  busy = false,
  errorMessage = null,
  isConflict = false,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setReason('');
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={isPolish ? 'Usuń pozycję z karty wyników' : 'Remove item from scorecard'}
      description={isPolish ? `Pozycja: ${itemLabel}` : `Item: ${itemLabel}`}
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS}>
            {isPolish ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(reason.trim() || null)}
            disabled={busy}
            data-testid="kpi-scorecard-remove-item-submit"
            className={DANGER_BUTTON_CLASS}
          >
            <Trash2 size={16} />
            <span>{busy ? (isPolish ? 'Usuwanie…' : 'Removing…') : isPolish ? 'Usuń' : 'Remove'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL_CLASS} htmlFor="kpi-scorecard-remove-item-reason">
            {isPolish ? 'Powód (opcjonalnie)' : 'Reason (optional)'}
          </label>
          <textarea
            id="kpi-scorecard-remove-item-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={TEXTAREA_CLASS}
            data-testid="kpi-scorecard-remove-item-reason"
          />
        </div>
        {errorMessage ? (
          <p className="flex items-start gap-1.5 text-[12px] text-c-danger" role="alert" data-testid="kpi-scorecard-remove-item-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              {isConflict
                ? isPolish
                  ? `Konflikt zapisu: ${errorMessage}`
                  : `Write conflict: ${errorMessage}`
                : errorMessage}
            </span>
          </p>
        ) : null}
      </div>
    </Modal>
  );
};

export default AddKpiScorecardItemModal;
