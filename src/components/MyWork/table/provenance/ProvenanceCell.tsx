/**
 * ProvenanceCell — Composed widget binding the Block B subcomponents to
 * the Record Provenance API.
 *
 * Surfaces, in order:
 *   * `<ConfidenceBar>` (compact in grid gutter, full in detail panel),
 *   * `<ValidationBadge>` with allowed-transitions menu,
 *   * `<SourcePopover>` toggle (count chip + popover on click),
 *   * `<AddSourceDialog>` for new entries.
 *
 * Behaviour gates:
 *   * Returns `null` when `isRecordProvenanceEnabled() === false`. This is
 *     the canonical UI killswitch for Block B.
 *   * `recordId == null` returns `null` (caller may not yet have a record
 *     id, e.g. unsaved row).
 *   * Errors from the API are caught locally; the popover surfaces them
 *     and does NOT bubble to the parent.
 */

import { ChevronDown, FileText } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createRecordSource,
  type CreateRecordSourceInput,
  deleteRecordSource,
  getValidationStatusTransitions,
  listRecordSources,
  type RecordSource,
  setValidationStatus,
  type ValidationStatus,
  verifyRecordSource,
} from '@/services/api/recordProvenance.api';
import { isRecordProvenanceEnabled } from '@/utils/recordProvenanceFlag';

import { AddSourceDialog } from './AddSourceDialog';
import { ConfidenceBar } from './ConfidenceBar';
import { SourcePopover } from './SourcePopover';
import { ValidationBadge } from './ValidationBadge';

export interface ProvenanceCellProps {
  recordId: string | null | undefined;
  /** Confidence score persisted on `tp_records.confidence_score`. */
  confidenceScore: number | null | undefined;
  /** Persisted validation status on `tp_records.validation_status`. */
  validationStatus: ValidationStatus | null | undefined;
  /** Visual variant — grid uses `compact`, detail panel uses `full`. */
  variant?: 'compact' | 'full';
  isSuperAdmin?: boolean;
  readOnly?: boolean;
  onMutated?: () => void;
  testId?: string;
}

export const ProvenanceCell: React.FC<ProvenanceCellProps> = ({
  recordId,
  confidenceScore,
  validationStatus,
  variant = 'full',
  isSuperAdmin = false,
  readOnly = false,
  onMutated,
  testId = 'provenance-cell',
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const enabled = useMemo(() => isRecordProvenanceEnabled(), []);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sources, setSources] = useState<RecordSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<ValidationStatus[]>([]);
  const [statusBusy, setStatusBusy] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close popover on outside click.
  useEffect(() => {
    if (!popoverOpen) return;
    const onClick = (e: MouseEvent): void => {
      if (!popoverRef.current?.contains(e.target as Node)) setPopoverOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [popoverOpen]);

  const reload = useCallback(async (): Promise<void> => {
    if (!recordId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listRecordSources(recordId);
      setSources(list);
    } catch (err) {
      setError(
        (err as { message?: string })?.message ??
          (isPl ? 'Nie udało się pobrać źródeł.' : 'Failed to load sources.')
      );
    } finally {
      setLoading(false);
    }
  }, [recordId, isPl]);

  const loadAllowed = useCallback(async (): Promise<void> => {
    if (!recordId) return;
    try {
      const result = await getValidationStatusTransitions(recordId);
      setAllowed(result.allowed);
    } catch {
      // Non-fatal: chip becomes read-only.
      setAllowed([]);
    }
  }, [recordId]);

  // Fetch sources on first popover open and when record changes.
  useEffect(() => {
    if (popoverOpen) void reload();
  }, [popoverOpen, reload]);

  // Fetch allowed transitions on mount when enabled.
  useEffect(() => {
    if (enabled && recordId) void loadAllowed();
  }, [enabled, recordId, loadAllowed]);

  if (!enabled || !recordId) return null;

  const activeCount = sources.filter((s) => s.archived_at === null).length;

  const handleStatusChange = async (next: ValidationStatus): Promise<void> => {
    if (!recordId || statusBusy) return;
    setStatusBusy(true);
    try {
      await setValidationStatus(recordId, next);
      onMutated?.();
      await loadAllowed();
    } catch (err) {
      setError(
        (err as { message?: string })?.message ??
          (isPl ? 'Nie udało się zmienić statusu.' : 'Failed to change status.')
      );
    } finally {
      setStatusBusy(false);
    }
  };

  const handleVerify = async (source: RecordSource): Promise<void> => {
    try {
      await verifyRecordSource(source.id);
      await reload();
      onMutated?.();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Verify failed');
    }
  };

  const handleArchive = async (source: RecordSource): Promise<void> => {
    try {
      await deleteRecordSource(source.id);
      await reload();
      onMutated?.();
    } catch (err) {
      setError((err as { message?: string })?.message ?? 'Archive failed');
    }
  };

  const handleAdd = async (input: CreateRecordSourceInput): Promise<void> => {
    if (!recordId) return;
    await createRecordSource(recordId, input);
    await reload();
    onMutated?.();
  };

  const containerClass =
    variant === 'compact' ? 'inline-flex items-center gap-2' : 'flex flex-wrap items-center gap-3';

  return (
    <div className={containerClass} data-testid={testId} ref={popoverRef}>
      <ConfidenceBar
        score={confidenceScore ?? null}
        variant={variant}
        onClick={() => setPopoverOpen((v) => !v)}
        testId={`${testId}-confidence`}
      />
      <ValidationBadge
        status={validationStatus ?? 'unverified'}
        allowed={allowed}
        onChange={readOnly ? undefined : handleStatusChange}
        isSuperAdmin={isSuperAdmin}
        disabled={statusBusy}
        testId={`${testId}-status`}
      />
      <button
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border border-slate-200/60 dark:border-white/[0.03] text-c-text-muted hover:bg-c-surface-raised focus:outline-none focus:ring-2 focus:ring-c-focus"
        aria-haspopup="dialog"
        aria-expanded={popoverOpen}
        data-testid={`${testId}-sources-toggle`}
      >
        <FileText size={11} aria-hidden />
        <span>
          {activeCount}{' '}
          {isPl
            ? activeCount === 1
              ? 'źródło'
              : 'źródeł'
            : activeCount === 1
              ? 'source'
              : 'sources'}
        </span>
        <ChevronDown size={10} aria-hidden />
      </button>
      {popoverOpen && (
        <div className="absolute z-40 mt-1" style={{ position: 'absolute' }}>
          <SourcePopover
            sources={sources}
            loading={loading}
            error={error}
            onClose={() => setPopoverOpen(false)}
            onVerify={readOnly ? undefined : handleVerify}
            onArchive={readOnly ? undefined : handleArchive}
            onAddClick={readOnly ? undefined : () => setDialogOpen(true)}
            readOnly={readOnly}
            testId={`${testId}-popover`}
          />
        </div>
      )}
      {dialogOpen && (
        <AddSourceDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSubmit={handleAdd}
          testId={`${testId}-dialog`}
        />
      )}
    </div>
  );
};

export default ProvenanceCell;
