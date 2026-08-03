/**
 * RES-003A — canonical KPI Recovery Card.
 *
 * Renders inside the `recovery` tab of KPITimeSeriesDrawer, gated by
 * resultsFeatureFlags.recoveryCard (default OFF). Owns the full recovery loop
 * for one open deviation case: hypothesis → confirmed cause → actions /
 * checkpoints → close (with evidence + effectiveness rating) or
 * continue / escalate — all under optimistic-concurrency `version`.
 *
 * Zero-optimistic-UI by design (CLAUDE.md rule #7 / explicit spec for this
 * card): every mutation waits for the server response and re-renders from
 * THAT payload — the local `card` state is never advanced ahead of the
 * network. On a 409 version conflict the panel re-fetches the latest card and
 * keeps the user's in-progress draft (edit form / close form) untouched so
 * nothing typed is lost.
 */
import {
  AlertTriangle,
  Check,
  Link2,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  Target,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { ROUTES } from '@/routes/routeConfig';
import {
  V8ResultsApi,
  type V8ResultsCloseRecoveryCardConflict,
  type V8ResultsKpiRecoveryAction,
  type V8ResultsKpiRecoveryCard,
  type V8ResultsKpiRecoveryCheckpoint,
  type V8ResultsRecoveryActionType,
  type V8ResultsRecoveryCardPriority,
  type V8ResultsRecoveryEffectivenessRating,
  type V8ResultsRecoveryListItem,
} from '@/services/api/v8/results';

interface RecoveryCardPanelProps {
  kpiId: string;
  deviationCaseId: string;
  onChanged?: () => void;
}

type Phase = 'loading' | 'ready' | 'empty' | 'error' | 'forbidden';

interface EditDraft {
  hypothesis: string;
  confirmedCause: string;
  impactDescription: string;
  priority: V8ResultsRecoveryCardPriority;
  expectedImpact: string;
  dependencies: V8ResultsRecoveryListItem[];
  risks: V8ResultsRecoveryListItem[];
  expectedRecoveryDate: string;
  effectivenessCriteria: string;
}

interface CreateDraft {
  hypothesis: string;
  priority: V8ResultsRecoveryCardPriority;
  expectedImpact: string;
  expectedRecoveryDate: string;
  effectivenessCriteria: string;
}

const EMPTY_CREATE_DRAFT: CreateDraft = {
  hypothesis: '',
  priority: 'MEDIUM',
  expectedImpact: '',
  expectedRecoveryDate: '',
  effectivenessCriteria: '',
};

const draftFromCard = (card: V8ResultsKpiRecoveryCard): EditDraft => ({
  hypothesis: card.hypothesis || '',
  confirmedCause: card.confirmedCause || '',
  impactDescription: card.impactDescription || '',
  priority: card.priority || 'MEDIUM',
  expectedImpact: card.expectedImpact || '',
  dependencies: [...(card.dependencies || [])],
  risks: [...(card.risks || [])],
  expectedRecoveryDate: card.expectedRecoveryDate ? card.expectedRecoveryDate.slice(0, 10) : '',
  effectivenessCriteria: card.effectivenessCriteria || '',
});

// --- shared visual tokens (mirrors KPITimeSeriesDrawer's bespoke drawer style) ---

const inputCls =
  'w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus:ring-c-focus/40 focus-visible:border-c-focus transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const textareaCls = `${inputCls} h-auto min-h-[72px] resize-none py-2`;

// Secondary (neutral) pill — cancel/retry/edit-toggle style.
const secondaryPillCls =
  'h-8 px-3 rounded-full text-xs font-medium border border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

// Emphasized pill — still neutral grayscale (CLAUDE.md rule #3: CTA = neutral,
// crimson/primary-* is reserved for brand only, never a button here).
const primaryPillCls =
  'h-8 px-3 rounded-full text-xs font-semibold border border-c-text-secondary/30 bg-c-text-secondary/10 text-c-text hover:bg-c-text-secondary/15 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';

const cardShellCls =
  'rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 p-4 space-y-3';

function lifecycleBadgeCls(status: V8ResultsKpiRecoveryCard['lifecycleStatus']): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-c-info/10 text-c-info border-c-info/30';
    case 'UNDER_REVIEW':
      return 'bg-c-warning/10 text-c-warning border-c-warning/30';
    case 'CLOSED':
      return 'bg-c-success/10 text-c-success border-c-success/30';
    case 'DRAFT':
    default:
      return 'bg-c-surface-raised text-c-text-secondary border-c-border';
  }
}

function priorityBadgeCls(priority: V8ResultsRecoveryCardPriority): string {
  switch (priority) {
    case 'CRITICAL':
      return 'bg-danger-500/15 text-danger-500 border-danger-500/40 font-semibold';
    case 'HIGH':
      return 'bg-c-warning/15 text-c-warning border-c-warning/40';
    case 'MEDIUM':
      return 'bg-c-warning/10 text-c-warning border-c-warning/25';
    case 'LOW':
    default:
      return 'bg-c-warning/5 text-c-text-secondary border-c-warning/15';
  }
}

function taskLinkBadgeCls(status: V8ResultsKpiRecoveryAction['taskLinkStatus']): string {
  switch (status) {
    case 'LINKED':
      return 'bg-c-success/10 text-c-success border-c-success/30';
    case 'PENDING':
      return 'bg-c-warning/10 text-c-warning border-c-warning/30';
    case 'LINK_FAILED':
      return 'bg-danger-500/10 text-danger-500 border-danger-500/30';
    case 'NONE':
    default:
      return 'bg-c-surface-raised text-c-text-secondary border-c-border';
  }
}

/** Maps the API's SCREAMING_SNAKE taskLinkStatus to the i18n leaf key (LINK_FAILED → "failed"). */
function taskLinkI18nKey(status: V8ResultsKpiRecoveryAction['taskLinkStatus']): string {
  switch (status) {
    case 'LINKED':
      return 'linked';
    case 'PENDING':
      return 'pending';
    case 'LINK_FAILED':
      return 'failed';
    case 'NONE':
    default:
      return 'none';
  }
}

/** Small inline segmented control — used for priority / actionType / effectivenessRating. */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (next: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={`h-8 px-3 rounded-full border text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
            value === opt.value
              ? 'border-c-text-secondary/40 bg-c-text-secondary/15 text-c-text'
              : 'border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const detailInputCls =
  'h-7 px-2 text-xs rounded border border-c-border bg-transparent text-c-text placeholder:text-c-text-muted focus-visible:outline-none focus-visible:ring-1 focus:ring-c-focus/40 disabled:opacity-60 disabled:cursor-not-allowed';

/**
 * List editor for `dependencies` / `risks` — each entry is a
 * `{ description, relatedId?, note? }` object (JSONB shape, matches the
 * migration + the backend contract, not a plain string). `description` is
 * required and shown/edited inline; `relatedId`/`note` are optional and live
 * behind a per-row "more details" expand so the common case (just a
 * description) stays a single line.
 */
function ItemListEditor({
  values,
  onChange,
  placeholder,
  disabled,
}: {
  values: V8ResultsRecoveryListItem[];
  onChange: (next: V8ResultsRecoveryListItem[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [draftDescription, setDraftDescription] = useState('');
  const [draftRelatedId, setDraftRelatedId] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [showNewDetails, setShowNewDetails] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const commit = useCallback(() => {
    const description = draftDescription.trim();
    if (!description) return;
    const relatedId = draftRelatedId.trim();
    const note = draftNote.trim();
    const item: V8ResultsRecoveryListItem = {
      description,
      ...(relatedId ? { relatedId } : {}),
      ...(note ? { note } : {}),
    };
    onChange([...values, item]);
    setDraftDescription('');
    setDraftRelatedId('');
    setDraftNote('');
    setShowNewDetails(false);
  }, [draftDescription, draftRelatedId, draftNote, values, onChange]);

  const updateItem = useCallback(
    (idx: number, patch: Partial<V8ResultsRecoveryListItem>) => {
      onChange(values.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
    },
    [values, onChange]
  );

  return (
    <div className="space-y-2">
      {values.length > 0 ? (
        <div className="space-y-1.5">
          {values.map((item, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-c-border bg-c-surface px-2.5 py-1.5 space-y-1.5"
            >
              <div className="flex items-center gap-1.5">
                {disabled ? (
                  <span className="flex-1 text-xs text-c-text-secondary">{item.description}</span>
                ) : (
                  <input
                    className={`flex-1 ${detailInputCls}`}
                    value={item.description}
                    onChange={(e) => updateItem(idx, { description: e.target.value })}
                  />
                )}
                <button
                  type="button"
                  onClick={() => setExpandedIdx((cur) => (cur === idx ? null : idx))}
                  className="flex-shrink-0 text-[11px] text-c-text-muted hover:text-c-text-secondary underline"
                >
                  {expandedIdx === idx
                    ? t('results.recoveryCard.hideDetails', 'hide details')
                    : t('results.recoveryCard.moreDetails', 'more details')}
                </button>
                {!disabled ? (
                  <button
                    type="button"
                    onClick={() => onChange(values.filter((_, i) => i !== idx))}
                    className="flex-shrink-0 text-c-text-muted hover:text-c-text-secondary"
                    aria-label="Remove"
                  >
                    <X size={12} />
                  </button>
                ) : null}
              </div>
              {expandedIdx === idx ? (
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    className={detailInputCls}
                    value={item.relatedId || ''}
                    disabled={disabled}
                    onChange={(e) => updateItem(idx, { relatedId: e.target.value || undefined })}
                    placeholder={t('results.recoveryCard.relatedId', 'Related ID')}
                  />
                  <input
                    className={detailInputCls}
                    value={item.note || ''}
                    disabled={disabled}
                    onChange={(e) => updateItem(idx, { note: e.target.value || undefined })}
                    placeholder={t('results.recoveryCard.note', 'Note')}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {!disabled ? (
        <div className="space-y-1.5">
          <input
            className={inputCls}
            value={draftDescription}
            onChange={(e) => setDraftDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
            placeholder={placeholder}
          />
          {showNewDetails ? (
            <div className="grid grid-cols-2 gap-1.5">
              <input
                className={inputCls}
                value={draftRelatedId}
                onChange={(e) => setDraftRelatedId(e.target.value)}
                placeholder={t('results.recoveryCard.relatedId', 'Related ID')}
              />
              <input
                className={inputCls}
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder={t('results.recoveryCard.note', 'Note')}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewDetails(true)}
              className="text-[11px] text-c-text-muted hover:text-c-text-secondary underline"
            >
              {t('results.recoveryCard.addDetails', 'add details')}
            </button>
          )}
          <button
            type="button"
            disabled={!draftDescription.trim()}
            onClick={commit}
            className={secondaryPillCls}
          >
            {t('common.add', 'Add')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export const RecoveryCardPanel: React.FC<RecoveryCardPanelProps> = ({
  kpiId,
  deviationCaseId,
  onChanged,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>('loading');
  const [card, setCard] = useState<V8ResultsKpiRecoveryCard | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // --- create form (empty state) ---
  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const [creating, setCreating] = useState(false);

  // --- inline edit of core fields ---
  const [editMode, setEditMode] = useState(false);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editConflict, setEditConflict] = useState(false);

  // --- actions ---
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionDescription, setNewActionDescription] = useState('');
  const [newActionType, setNewActionType] = useState<V8ResultsRecoveryActionType>('IMMEDIATE');
  const [newActionOwner, setNewActionOwner] = useState('');
  const [newActionDue, setNewActionDue] = useState('');
  const [addingAction, setAddingAction] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // --- checkpoints ---
  const [newCheckpointDate, setNewCheckpointDate] = useState('');
  const [newCheckpointNotes, setNewCheckpointNotes] = useState('');
  const [addingCheckpoint, setAddingCheckpoint] = useState(false);
  const [checkpointBusyId, setCheckpointBusyId] = useState<string | null>(null);
  const [checkpointMeasurementDraft, setCheckpointMeasurementDraft] = useState<
    Record<string, string>
  >({});

  // --- close ---
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeEvidenceText, setCloseEvidenceText] = useState('');
  const [closeEvidenceRef, setCloseEvidenceRef] = useState('');
  const [closeRating, setCloseRating] = useState<V8ResultsRecoveryEffectivenessRating | null>(null);
  const [closeValidationError, setCloseValidationError] = useState<string | null>(null);
  const [closeConflict, setCloseConflict] = useState<V8ResultsCloseRecoveryCardConflict | null>(
    null
  );
  const [closing, setClosing] = useState(false);

  // --- continue / escalate ---
  const [decisionNote, setDecisionNote] = useState('');
  const [escalateTo, setEscalateTo] = useState('');
  const [continuing, setContinuing] = useState(false);
  const [escalating, setEscalating] = useState(false);

  const fetchCard = useCallback(
    async (options?: { background?: boolean }) => {
      if (!options?.background) setPhase('loading');
      try {
        const data = await V8ResultsApi.getRecoveryCard(deviationCaseId);
        setCard(data);
        setPhase('ready');
        setErrorMessage(null);
        // Draft/edit-mode/close-form state is intentionally left untouched here —
        // callers that need a resync (e.g. after a 409) drive that separately so
        // in-progress typing is never clobbered by a background refresh.
      } catch (error: any) {
        if (error?.status === 404) {
          setCard(null);
          setPhase('empty');
          return;
        }
        if (error?.status === 403) {
          setPhase('forbidden');
          return;
        }
        setErrorMessage(error?.message || null);
        setPhase('error');
      }
    },
    [deviationCaseId]
  );

  useEffect(() => {
    void fetchCard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviationCaseId]);

  // Sync the edit draft from the server card whenever the card changes and we
  // are NOT mid-edit — entering edit mode below takes an explicit snapshot, so
  // this only keeps the draft warm for the next "Edit" click.
  useEffect(() => {
    if (!card || editMode) return;
    setEditDraft(draftFromCard(card));
  }, [card, editMode]);

  const handleCreate = useCallback(async () => {
    if (!createDraft.hypothesis.trim()) return;
    setCreating(true);
    try {
      const payload = {
        hypothesis: createDraft.hypothesis.trim() || undefined,
        priority: createDraft.priority,
        expectedImpact: createDraft.expectedImpact.trim() || undefined,
        expectedRecoveryDate: createDraft.expectedRecoveryDate || undefined,
        effectivenessCriteria: createDraft.effectivenessCriteria.trim() || undefined,
      };
      const data = await V8ResultsApi.createRecoveryCard(deviationCaseId, payload);
      setCard(data);
      setPhase('ready');
      setCreateDraft(EMPTY_CREATE_DRAFT);
      toast.success(t('results.recoveryCard.saved', 'Changes saved.'));
      onChanged?.();
    } catch (error: any) {
      if (error?.status === 403) {
        setPhase('forbidden');
        return;
      }
      toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
    } finally {
      setCreating(false);
    }
  }, [createDraft, deviationCaseId, onChanged, t]);

  const handleStartEdit = useCallback(() => {
    if (!card) return;
    setEditDraft(draftFromCard(card));
    setEditConflict(false);
    setEditMode(true);
  }, [card]);

  const handleCancelEdit = useCallback(() => {
    if (card) setEditDraft(draftFromCard(card));
    setEditConflict(false);
    setEditMode(false);
  }, [card]);

  const handleSaveEdit = useCallback(async () => {
    if (!card || !editDraft) return;
    setSavingEdit(true);
    try {
      const data = await V8ResultsApi.updateRecoveryCard(card.id, {
        version: card.version,
        hypothesis: editDraft.hypothesis,
        confirmedCause: editDraft.confirmedCause,
        impactDescription: editDraft.impactDescription,
        priority: editDraft.priority,
        expectedImpact: editDraft.expectedImpact,
        dependencies: editDraft.dependencies,
        risks: editDraft.risks,
        expectedRecoveryDate: editDraft.expectedRecoveryDate || undefined,
        effectivenessCriteria: editDraft.effectivenessCriteria,
      });
      setCard(data);
      setEditMode(false);
      setEditConflict(false);
      toast.success(t('results.recoveryCard.saved', 'Changes saved.'));
      onChanged?.();
    } catch (error: any) {
      if (error?.status === 409) {
        setEditConflict(true);
        await fetchCard({ background: true });
        return;
      }
      toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
    } finally {
      setSavingEdit(false);
    }
  }, [card, editDraft, fetchCard, onChanged, t]);

  const handleAddAction = useCallback(async () => {
    if (!card || !newActionTitle.trim()) return;
    setAddingAction(true);
    try {
      // createRecoveryAction returns only the new action (sub-resource
      // response) — refetch the card to pick it up in `actions` rather than
      // trying to splice the partial response into local state.
      await V8ResultsApi.createRecoveryAction(card.id, {
        title: newActionTitle.trim(),
        description: newActionDescription.trim() || undefined,
        actionType: newActionType,
        ownerUserId: newActionOwner.trim() || undefined,
        dueDate: newActionDue || undefined,
        idempotencyKey: crypto.randomUUID(),
      });
      await fetchCard({ background: true });
      setNewActionTitle('');
      setNewActionDescription('');
      setNewActionOwner('');
      setNewActionDue('');
      setNewActionType('IMMEDIATE');
      toast.success(t('results.recoveryCard.actionAdded', 'Action added.'));
      onChanged?.();
    } catch (error: any) {
      if (error?.status === 409) {
        await fetchCard({ background: true });
        toast.error(
          t(
            'results.recoveryCard.versionConflict',
            'This card changed — reloaded the latest state.'
          )
        );
        return;
      }
      toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
    } finally {
      setAddingAction(false);
    }
  }, [
    card,
    newActionTitle,
    newActionDescription,
    newActionType,
    newActionOwner,
    newActionDue,
    fetchCard,
    onChanged,
    t,
  ]);

  const handleToggleActionStatus = useCallback(
    async (action: V8ResultsKpiRecoveryAction) => {
      if (!card) return;
      setActionBusyId(action.id);
      try {
        const nextStatus = action.status === 'DONE' ? 'OPEN' : 'DONE';
        // updateRecoveryAction returns only the updated action — refetch to
        // refresh the card's `actions` array from the server.
        await V8ResultsApi.updateRecoveryAction(card.id, action.id, {
          status: nextStatus,
        });
        await fetchCard({ background: true });
        onChanged?.();
      } catch (error: any) {
        if (error?.status === 409) {
          await fetchCard({ background: true });
        }
        toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
      } finally {
        setActionBusyId(null);
      }
    },
    [card, fetchCard, onChanged, t]
  );

  const handleCancelAction = useCallback(
    async (action: V8ResultsKpiRecoveryAction) => {
      if (!card) return;
      setActionBusyId(action.id);
      try {
        await V8ResultsApi.updateRecoveryAction(card.id, action.id, {
          status: 'CANCELLED',
        });
        await fetchCard({ background: true });
        onChanged?.();
      } catch (error: any) {
        if (error?.status === 409) {
          await fetchCard({ background: true });
        }
        toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
      } finally {
        setActionBusyId(null);
      }
    },
    [card, fetchCard, onChanged, t]
  );

  const handleLinkTask = useCallback(
    async (action: V8ResultsKpiRecoveryAction) => {
      if (!card) return;
      setActionBusyId(action.id);
      try {
        // linkRecoveryActionTask returns only the action — refetch for the
        // card-level `actions` array to reflect the new taskLinkStatus.
        await V8ResultsApi.linkRecoveryActionTask(card.id, action.id);
        await fetchCard({ background: true });
        onChanged?.();
      } catch (error: any) {
        if (error?.status === 409) {
          await fetchCard({ background: true });
        }
        toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
      } finally {
        setActionBusyId(null);
      }
    },
    [card, fetchCard, onChanged, t]
  );

  const handleAddCheckpoint = useCallback(async () => {
    if (!card || !newCheckpointDate) return;
    setAddingCheckpoint(true);
    try {
      // createRecoveryCheckpoint returns only the new checkpoint — refetch
      // the card to pick it up in `checkpoints`.
      await V8ResultsApi.createRecoveryCheckpoint(card.id, {
        checkpointDate: newCheckpointDate,
        notes: newCheckpointNotes.trim() || undefined,
      });
      await fetchCard({ background: true });
      setNewCheckpointDate('');
      setNewCheckpointNotes('');
      toast.success(t('results.recoveryCard.checkpointAdded', 'Checkpoint added.'));
      onChanged?.();
    } catch (error: any) {
      if (error?.status === 409) {
        await fetchCard({ background: true });
        toast.error(
          t(
            'results.recoveryCard.versionConflict',
            'This card changed — reloaded the latest state.'
          )
        );
        return;
      }
      toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
    } finally {
      setAddingCheckpoint(false);
    }
  }, [card, newCheckpointDate, newCheckpointNotes, fetchCard, onChanged, t]);

  const handleResolveCheckpoint = useCallback(
    async (checkpoint: V8ResultsKpiRecoveryCheckpoint, status: 'MET' | 'MISSED') => {
      if (!card) return;
      setCheckpointBusyId(checkpoint.id);
      try {
        const kpiTimeSeriesId = checkpointMeasurementDraft[checkpoint.id]?.trim() || undefined;
        // resolveRecoveryCheckpoint returns only the checkpoint — refetch to
        // refresh the card's `checkpoints` array.
        await V8ResultsApi.resolveRecoveryCheckpoint(card.id, checkpoint.id, {
          status,
          kpiTimeSeriesId,
        });
        await fetchCard({ background: true });
        onChanged?.();
      } catch (error: any) {
        if (error?.status === 409) {
          await fetchCard({ background: true });
        }
        toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
      } finally {
        setCheckpointBusyId(null);
      }
    },
    [card, checkpointMeasurementDraft, fetchCard, onChanged, t]
  );

  const handleSubmitClose = useCallback(async () => {
    if (!card) return;
    setCloseConflict(null);
    if (!closeRating) {
      setCloseValidationError(
        t(
          'results.recoveryCard.effectivenessRatingRequired',
          'Select an effectiveness rating before closing the card.'
        )
      );
      return;
    }
    if (!closeEvidenceText.trim() && !closeEvidenceRef.trim()) {
      setCloseValidationError(
        t(
          'results.recoveryCard.closeBlocked.MISSING_EVIDENCE',
          'Add evidence before closing the card.'
        )
      );
      return;
    }
    setCloseValidationError(null);
    setClosing(true);
    try {
      const data = await V8ResultsApi.closeRecoveryCard(card.id, {
        version: card.version,
        evidenceText: closeEvidenceText.trim() || undefined,
        evidenceRef: closeEvidenceRef.trim() || undefined,
        effectivenessRating: closeRating,
      });
      // Zero-optimistic-UI: only now, after the 200 response, do we render the
      // card as closed — never before the server confirms it.
      setCard(data);
      setShowCloseForm(false);
      setCloseEvidenceText('');
      setCloseEvidenceRef('');
      setCloseRating(null);
      toast.success(t('results.recoveryCard.closed', 'Recovery card closed.'));
      onChanged?.();
    } catch (error: any) {
      if (error?.status === 409) {
        const data = error?.data as V8ResultsCloseRecoveryCardConflict | undefined;
        if (data?.reason) {
          setCloseConflict(data);
          if (data.reason === 'VERSION_CONFLICT') {
            // Refresh the version for the retry, but keep the evidence/rating
            // draft the user already typed — the close form stays open.
            await fetchCard({ background: true });
          }
          return;
        }
      }
      toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
    } finally {
      setClosing(false);
    }
  }, [card, closeRating, closeEvidenceText, closeEvidenceRef, fetchCard, onChanged, t]);

  const handleContinue = useCallback(async () => {
    if (!card) return;
    setContinuing(true);
    try {
      const data = await V8ResultsApi.continueRecoveryCard(card.id, {
        version: card.version,
        note: decisionNote.trim() || undefined,
      });
      setCard(data);
      setDecisionNote('');
      toast.success(t('results.recoveryCard.saved', 'Changes saved.'));
      onChanged?.();
    } catch (error: any) {
      if (error?.status === 409) {
        await fetchCard({ background: true });
        toast.error(
          t(
            'results.recoveryCard.versionConflict',
            'This card changed — reloaded the latest state.'
          )
        );
        return;
      }
      toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
    } finally {
      setContinuing(false);
    }
  }, [card, decisionNote, fetchCard, onChanged, t]);

  const handleEscalate = useCallback(async () => {
    if (!card) return;
    setEscalating(true);
    try {
      const data = await V8ResultsApi.escalateRecoveryCard(card.id, {
        version: card.version,
        note: decisionNote.trim() || undefined,
        escalateTo: escalateTo.trim() || undefined,
      });
      setCard(data);
      setDecisionNote('');
      setEscalateTo('');
      toast.success(t('results.recoveryCard.saved', 'Changes saved.'));
      onChanged?.();
    } catch (error: any) {
      if (error?.status === 409) {
        await fetchCard({ background: true });
        toast.error(
          t(
            'results.recoveryCard.versionConflict',
            'This card changed — reloaded the latest state.'
          )
        );
        return;
      }
      toast.error(error?.message || t('results.recoveryCard.saveFailed', 'Save failed.'));
    } finally {
      setEscalating(false);
    }
  }, [card, decisionNote, escalateTo, fetchCard, onChanged, t]);

  const priorityOptions = useMemo(
    () =>
      (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as V8ResultsRecoveryCardPriority[]).map((value) => ({
        value,
        label: t(`results.recoveryCard.priority.${value}`, value),
      })),
    [t]
  );

  const actionTypeOptions = useMemo(
    () =>
      (['IMMEDIATE', 'DURABLE'] as V8ResultsRecoveryActionType[]).map((value) => ({
        value,
        label: t(`results.recoveryCard.actionType.${value}`, value),
      })),
    [t]
  );

  const ratingOptions = useMemo(
    () =>
      (
        [
          'EFFECTIVE',
          'PARTIALLY_EFFECTIVE',
          'INEFFECTIVE',
        ] as V8ResultsRecoveryEffectivenessRating[]
      ).map((value) => ({
        value,
        label: t(`results.recoveryCard.effectivenessRating.${value}`, value),
      })),
    [t]
  );

  // ---- render: loading ----
  if (phase === 'loading') {
    return (
      <div
        data-kpi-id={kpiId}
        className="flex items-center justify-center py-16 text-slate-600 dark:text-slate-300"
      >
        <Target size={20} className="animate-pulse mr-2" />
        {t('results.recoveryCard.loading', 'Loading recovery card…')}
      </div>
    );
  }

  // ---- render: forbidden ----
  if (phase === 'forbidden') {
    return (
      <div
        data-kpi-id={kpiId}
        className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 px-4 py-8 text-center"
      >
        <ShieldAlert size={20} className="mx-auto mb-2 text-c-text-muted" />
        <p className="text-sm text-c-text-secondary">
          {t(
            'results.recoveryCard.forbidden',
            "You don't have permission to view this recovery card."
          )}
        </p>
      </div>
    );
  }

  // ---- render: error ----
  if (phase === 'error') {
    return (
      <div
        data-kpi-id={kpiId}
        className="rounded-lg border border-danger-500/30 bg-danger-500/5 px-4 py-6 space-y-3"
      >
        <div className="flex items-center gap-2 text-sm text-danger-500">
          <AlertTriangle size={16} />
          {errorMessage ||
            t('results.recoveryCard.errorGeneric', 'Could not load the recovery card.')}
        </div>
        <button type="button" className={secondaryPillCls} onClick={() => void fetchCard()}>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCw size={12} />
            {t('results.recoveryCard.retry', 'Retry')}
          </span>
        </button>
      </div>
    );
  }

  // ---- render: empty (no card yet — CTA to create one) ----
  if (phase === 'empty' || !card) {
    return (
      <div data-kpi-id={kpiId} className="space-y-4">
        <div className="rounded-lg border border-dashed border-slate-200 dark:border-white/[0.08] px-4 py-8 text-center space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('results.recoveryCard.empty', 'No recovery card for this deviation case.')}
          </p>
        </div>

        <div className={cardShellCls}>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('results.recoveryCard.title', 'Recovery Card')}
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.hypothesis', 'Hypothesis')}
            </div>
            <textarea
              className={textareaCls}
              value={createDraft.hypothesis}
              onChange={(e) => setCreateDraft((d) => ({ ...d, hypothesis: e.target.value }))}
              placeholder={t(
                'results.recoveryCard.hypothesisPlaceholder',
                'What do you think is causing this deviation?'
              )}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.priorityLabel', 'Priority')}
            </div>
            <Segmented
              options={priorityOptions}
              value={createDraft.priority}
              onChange={(value) => setCreateDraft((d) => ({ ...d, priority: value }))}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.expectedImpact', 'Expected impact')}
            </div>
            <input
              className={inputCls}
              value={createDraft.expectedImpact}
              onChange={(e) => setCreateDraft((d) => ({ ...d, expectedImpact: e.target.value }))}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.expectedRecoveryDate', 'Expected recovery date')}
            </div>
            <input
              type="date"
              className={inputCls}
              value={createDraft.expectedRecoveryDate}
              onChange={(e) =>
                setCreateDraft((d) => ({ ...d, expectedRecoveryDate: e.target.value }))
              }
            />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.effectivenessCriteria', 'Effectiveness criteria')}
            </div>
            <textarea
              className={textareaCls}
              value={createDraft.effectivenessCriteria}
              onChange={(e) =>
                setCreateDraft((d) => ({ ...d, effectivenessCriteria: e.target.value }))
              }
              placeholder={t(
                'results.recoveryCard.effectivenessCriteriaPlaceholder',
                'How will we know the recovery worked?'
              )}
            />
          </div>
          <button
            type="button"
            disabled={creating || !createDraft.hypothesis.trim()}
            onClick={() => void handleCreate()}
            className={primaryPillCls}
          >
            {creating
              ? t('common.saving', 'Saving...')
              : t('results.recoveryCard.createCta', 'Create recovery card')}
          </button>
        </div>
      </div>
    );
  }

  // ---- render: ready (card loaded) ----
  const draft = editDraft || draftFromCard(card);
  const isClosed = card.lifecycleStatus === 'CLOSED';

  return (
    <div data-kpi-id={kpiId} className="space-y-4">
      {/* Header: lifecycle + priority badges */}
      <div className={cardShellCls}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {t('results.recoveryCard.title', 'Recovery Card')}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${lifecycleBadgeCls(card.lifecycleStatus)}`}
            >
              {t(
                `results.recoveryCard.lifecycleStatus.${card.lifecycleStatus}`,
                card.lifecycleStatus
              )}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${priorityBadgeCls(card.priority)}`}
            >
              {t(`results.recoveryCard.priority.${card.priority}`, card.priority)}
            </span>
          </div>
        </div>

        {editConflict ? (
          <div className="flex items-start gap-2 rounded-lg border border-c-warning/30 bg-c-warning/10 px-3 py-2 text-xs text-c-warning">
            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              {t(
                'results.recoveryCard.versionConflict',
                'This card was changed by someone else in the meantime. Loaded the latest state — your draft was kept.'
              )}
            </span>
            <button
              type="button"
              onClick={() => setEditConflict(false)}
              className="ml-auto text-c-text-muted hover:text-c-text-secondary"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        ) : null}

        <div className="flex items-center justify-end">
          {!editMode && !isClosed ? (
            <button type="button" onClick={handleStartEdit} className={secondaryPillCls}>
              <span className="inline-flex items-center gap-1.5">
                <Pencil size={12} />
                {t('common.edit', 'Edit')}
              </span>
            </button>
          ) : null}
        </div>

        {/* Core fields */}
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.hypothesis', 'Hypothesis')}
            </div>
            <textarea
              className={textareaCls}
              value={draft.hypothesis}
              disabled={!editMode}
              onChange={(e) => setEditDraft((d) => (d ? { ...d, hypothesis: e.target.value } : d))}
              placeholder={t(
                'results.recoveryCard.hypothesisPlaceholder',
                'What do you think is causing this deviation?'
              )}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.confirmedCause', 'Confirmed cause')}
            </div>
            <textarea
              className={textareaCls}
              value={draft.confirmedCause}
              disabled={!editMode}
              onChange={(e) =>
                setEditDraft((d) => (d ? { ...d, confirmedCause: e.target.value } : d))
              }
              placeholder={t(
                'results.recoveryCard.confirmedCausePlaceholder',
                'What did the investigation confirm?'
              )}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.impactDescription', 'Impact description')}
            </div>
            <textarea
              className={textareaCls}
              value={draft.impactDescription}
              disabled={!editMode}
              onChange={(e) =>
                setEditDraft((d) => (d ? { ...d, impactDescription: e.target.value } : d))
              }
            />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.priorityLabel', 'Priority')}
            </div>
            <Segmented
              options={priorityOptions}
              value={draft.priority}
              disabled={!editMode}
              onChange={(value) => setEditDraft((d) => (d ? { ...d, priority: value } : d))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {t('results.recoveryCard.expectedImpact', 'Expected impact')}
              </div>
              <input
                className={inputCls}
                value={draft.expectedImpact}
                disabled={!editMode}
                onChange={(e) =>
                  setEditDraft((d) => (d ? { ...d, expectedImpact: e.target.value } : d))
                }
              />
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                {t('results.recoveryCard.expectedRecoveryDate', 'Expected recovery date')}
              </div>
              <input
                type="date"
                className={inputCls}
                value={draft.expectedRecoveryDate}
                disabled={!editMode}
                onChange={(e) =>
                  setEditDraft((d) => (d ? { ...d, expectedRecoveryDate: e.target.value } : d))
                }
              />
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.dependencies', 'Dependencies')}
            </div>
            <ItemListEditor
              values={draft.dependencies}
              disabled={!editMode}
              onChange={(next) => setEditDraft((d) => (d ? { ...d, dependencies: next } : d))}
              placeholder={t(
                'results.recoveryCard.dependenciesPlaceholder',
                'Add a dependency and press Enter'
              )}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.risks', 'Risks')}
            </div>
            <ItemListEditor
              values={draft.risks}
              disabled={!editMode}
              onChange={(next) => setEditDraft((d) => (d ? { ...d, risks: next } : d))}
              placeholder={t('results.recoveryCard.risksPlaceholder', 'Add a risk and press Enter')}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              {t('results.recoveryCard.effectivenessCriteria', 'Effectiveness criteria')}
            </div>
            <textarea
              className={textareaCls}
              value={draft.effectivenessCriteria}
              disabled={!editMode}
              onChange={(e) =>
                setEditDraft((d) => (d ? { ...d, effectivenessCriteria: e.target.value } : d))
              }
              placeholder={t(
                'results.recoveryCard.effectivenessCriteriaPlaceholder',
                'How will we know the recovery worked?'
              )}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-c-text-secondary">
            <span className="font-medium">
              {t(
                `results.recoveryCard.effectivenessStatus.${card.effectivenessStatus}`,
                card.effectivenessStatus
              )}
            </span>
            {card.effectivenessRating ? (
              <span>
                ·{' '}
                {t(
                  `results.recoveryCard.effectivenessRating.${card.effectivenessRating}`,
                  card.effectivenessRating
                )}
              </span>
            ) : null}
          </div>
        </div>

        {editMode ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={savingEdit}
              onClick={() => void handleSaveEdit()}
              className={primaryPillCls}
            >
              {savingEdit ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </button>
            <button
              type="button"
              disabled={savingEdit}
              onClick={handleCancelEdit}
              className={secondaryPillCls}
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </div>
        ) : null}
      </div>

      {/* Actions */}
      <div className={cardShellCls}>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('results.recoveryCard.actionsTitle', 'Actions')}
        </div>

        {card.actions.length > 0 ? (
          <div className="space-y-2">
            {card.actions.map((action) => (
              <div
                key={action.id}
                className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div
                      className={`text-sm font-medium text-slate-900 dark:text-white ${action.status === 'DONE' || action.status === 'CANCELLED' ? 'line-through opacity-60' : ''}`}
                    >
                      {action.title}
                    </div>
                    {action.description ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {action.description}
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-c-text-muted">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-c-border">
                        {t(
                          `results.recoveryCard.actionType.${action.actionType}`,
                          action.actionType
                        )}
                      </span>
                      {action.ownerUserId ? <span>{action.ownerUserId}</span> : null}
                      {action.dueDate ? <span>{action.dueDate.slice(0, 10)}</span> : null}
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${taskLinkBadgeCls(action.taskLinkStatus)}`}
                  >
                    {action.taskLinkStatus === 'PENDING' ? (
                      <Loader2 size={10} className="animate-spin mr-1" />
                    ) : null}
                    {t(
                      `results.recoveryCard.taskLink.${taskLinkI18nKey(action.taskLinkStatus)}`,
                      action.taskLinkStatus
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {action.status !== 'CANCELLED' ? (
                    <button
                      type="button"
                      disabled={actionBusyId === action.id}
                      onClick={() => void handleToggleActionStatus(action)}
                      className={secondaryPillCls}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Check size={12} />
                        {action.status === 'DONE'
                          ? t('common.edit', 'Edit')
                          : t('results.recoveryCard.markMet', 'Met')}
                      </span>
                    </button>
                  ) : null}
                  {action.status === 'OPEN' ? (
                    <button
                      type="button"
                      disabled={actionBusyId === action.id}
                      onClick={() => void handleCancelAction(action)}
                      className={secondaryPillCls}
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                  {action.taskLinkStatus === 'NONE' || action.taskLinkStatus === 'LINK_FAILED' ? (
                    <button
                      type="button"
                      disabled={actionBusyId === action.id}
                      onClick={() => void handleLinkTask(action)}
                      className={secondaryPillCls}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Link2 size={12} />
                        {action.taskLinkStatus === 'LINK_FAILED'
                          ? t('results.recoveryCard.taskLink.retry', 'Retry')
                          : t('results.recoveryCard.taskLink.connect', 'Link to task')}
                      </span>
                    </button>
                  ) : null}
                  {action.taskLinkStatus === 'LINKED' && action.linkedTaskId ? (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `${ROUTES.MY_WORK}?taskId=${encodeURIComponent(action.linkedTaskId as string)}`
                        )
                      }
                      className={secondaryPillCls}
                    >
                      {t('results.recoveryCard.taskLink.linked', 'Linked to task')}
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('results.recoveryCard.noActions', 'No actions yet.')}
          </div>
        )}

        {!isClosed ? (
          <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
            <input
              className={inputCls}
              value={newActionTitle}
              onChange={(e) => setNewActionTitle(e.target.value)}
              placeholder={t('results.recoveryCard.actionTitlePlaceholder', 'Action title')}
            />
            <input
              className={inputCls}
              value={newActionDescription}
              onChange={(e) => setNewActionDescription(e.target.value)}
              placeholder={t(
                'results.recoveryCard.actionDescriptionPlaceholder',
                'Action description (optional)'
              )}
            />
            <Segmented
              options={actionTypeOptions}
              value={newActionType}
              onChange={setNewActionType}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className={inputCls}
                value={newActionOwner}
                onChange={(e) => setNewActionOwner(e.target.value)}
                placeholder={t('results.recoveryCard.actionOwner', 'Owner')}
              />
              <input
                type="date"
                className={inputCls}
                value={newActionDue}
                onChange={(e) => setNewActionDue(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={addingAction || !newActionTitle.trim()}
              onClick={() => void handleAddAction()}
              className={secondaryPillCls}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus size={12} />
                {t('results.recoveryCard.addAction', 'Add action')}
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Checkpoints */}
      <div className={cardShellCls}>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('results.recoveryCard.checkpointsTitle', 'Checkpoints')}
        </div>

        {card.checkpoints.length > 0 ? (
          <div className="space-y-2">
            {card.checkpoints.map((checkpoint) => (
              <div
                key={checkpoint.id}
                className="rounded-lg border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.02] p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm text-slate-900 dark:text-white">
                    {checkpoint.checkpointDate.slice(0, 10)}
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-c-border bg-c-surface-raised text-c-text-secondary">
                    {t(
                      `results.recoveryCard.checkpointStatus.${checkpoint.status}`,
                      checkpoint.status
                    )}
                  </span>
                </div>
                {checkpoint.notes ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {checkpoint.notes}
                  </div>
                ) : null}
                {checkpoint.status === 'PENDING' && !isClosed ? (
                  <div className="space-y-2">
                    <input
                      className={inputCls}
                      value={checkpointMeasurementDraft[checkpoint.id] || ''}
                      onChange={(e) =>
                        setCheckpointMeasurementDraft((prev) => ({
                          ...prev,
                          [checkpoint.id]: e.target.value,
                        }))
                      }
                      placeholder={t('results.recoveryCard.linkMeasurement', 'Link measurement')}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={checkpointBusyId === checkpoint.id}
                        onClick={() => void handleResolveCheckpoint(checkpoint, 'MET')}
                        className={secondaryPillCls}
                      >
                        {t('results.recoveryCard.markMet', 'Met')}
                      </button>
                      <button
                        type="button"
                        disabled={checkpointBusyId === checkpoint.id}
                        onClick={() => void handleResolveCheckpoint(checkpoint, 'MISSED')}
                        className={secondaryPillCls}
                      >
                        {t('results.recoveryCard.markMissed', 'Missed')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('results.recoveryCard.noCheckpoints', 'No checkpoints yet.')}
          </div>
        )}

        {!isClosed ? (
          <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
            <input
              type="date"
              className={inputCls}
              value={newCheckpointDate}
              onChange={(e) => setNewCheckpointDate(e.target.value)}
            />
            <textarea
              className={textareaCls}
              value={newCheckpointNotes}
              onChange={(e) => setNewCheckpointNotes(e.target.value)}
              placeholder={t('results.recoveryCard.checkpointNotes', 'Notes')}
            />
            <button
              type="button"
              disabled={addingCheckpoint || !newCheckpointDate}
              onClick={() => void handleAddCheckpoint()}
              className={secondaryPillCls}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus size={12} />
                {t('results.recoveryCard.addCheckpoint', 'Add checkpoint')}
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {/* Close / Continue / Escalate */}
      {!isClosed ? (
        <div className={cardShellCls}>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setShowCloseForm((v) => !v)}
              className={primaryPillCls}
            >
              {t('results.recoveryCard.close', 'Close card')}
            </button>
            <button
              type="button"
              disabled={continuing}
              onClick={() => void handleContinue()}
              className={secondaryPillCls}
            >
              {continuing
                ? t('common.saving', 'Saving...')
                : t('results.recoveryCard.continue', 'Continue')}
            </button>
            <button
              type="button"
              disabled={escalating}
              onClick={() => void handleEscalate()}
              className={secondaryPillCls}
            >
              {escalating
                ? t('common.saving', 'Saving...')
                : t('results.recoveryCard.escalate', 'Escalate')}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              className={inputCls}
              value={decisionNote}
              onChange={(e) => setDecisionNote(e.target.value)}
              placeholder={t('results.recoveryCard.notePlaceholder', 'Note (optional)')}
            />
            <input
              className={inputCls}
              value={escalateTo}
              onChange={(e) => setEscalateTo(e.target.value)}
              placeholder={t('results.recoveryCard.escalateTo', 'Escalate to')}
            />
          </div>

          {showCloseForm ? (
            <div className="space-y-2 pt-2 border-t border-slate-200/70 dark:border-white/[0.06]">
              <textarea
                className={textareaCls}
                value={closeEvidenceText}
                onChange={(e) => setCloseEvidenceText(e.target.value)}
                placeholder={t('results.recoveryCard.evidenceText', 'Evidence description')}
              />
              <input
                className={inputCls}
                value={closeEvidenceRef}
                onChange={(e) => setCloseEvidenceRef(e.target.value)}
                placeholder={t(
                  'results.recoveryCard.evidenceRef',
                  'Evidence link (task, report, attachment)'
                )}
              />
              <Segmented options={ratingOptions} value={closeRating} onChange={setCloseRating} />

              {closeValidationError ? (
                <div className="text-xs text-danger-500">{closeValidationError}</div>
              ) : null}
              {closeConflict ? (
                <div className="flex items-start gap-2 rounded-lg border border-c-warning/30 bg-c-warning/10 px-3 py-2 text-xs text-c-warning">
                  <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                  <span>
                    {t(
                      `results.recoveryCard.closeBlocked.${closeConflict.reason}`,
                      closeConflict.reason
                    )}
                  </span>
                </div>
              ) : null}

              <button
                type="button"
                disabled={closing}
                onClick={() => void handleSubmitClose()}
                className={primaryPillCls}
              >
                {closing
                  ? t('common.saving', 'Saving...')
                  : t('results.recoveryCard.close', 'Close card')}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* History — static, no dedicated audit-log endpoint in this round (known gap). */}
      <div className={cardShellCls}>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('results.recoveryCard.history', 'History')}
        </div>
        <div className="space-y-1 text-xs text-c-text-secondary">
          {card.createdAt ? (
            <div>
              {t('results.recoveryCard.historyCreated', 'Created')}:{' '}
              {new Date(card.createdAt).toLocaleString()}
              {card.createdBy ? ` · ${card.createdBy}` : ''}
            </div>
          ) : null}
          {card.updatedAt ? (
            <div>
              {t('results.recoveryCard.historyUpdated', 'Updated')}:{' '}
              {new Date(card.updatedAt).toLocaleString()}
              {card.updatedBy ? ` · ${card.updatedBy}` : ''}
            </div>
          ) : null}
          {card.closedAt ? (
            <div>
              {t('results.recoveryCard.historyClosed', 'Closed')}:{' '}
              {new Date(card.closedAt).toLocaleString()}
              {card.closedBy ? ` · ${card.closedBy}` : ''}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default RecoveryCardPanel;
