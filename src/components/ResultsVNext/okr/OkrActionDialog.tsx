/**
 * OkrActionDialog — RN-G3 lane `okr` prompt-removal pass (2026-08-11).
 *
 * Shared 1-2 field text dialog for OKR review/support actions that used to
 * call native `window.prompt` (CLAUDE.md "standard jest KODEM" — a native
 * browser dialog has no theme, no keyboard kanon, no test surface, and
 * reads as a crash, not a product). Same shape as
 * `../roi/RoiTransitionDialog.tsx` and `./OkrCancelDialog.tsx` (Modal +
 * textarea(s) + busy/error/isConflict), generalized to a caller-supplied
 * field list because the five call sites this backs vary in field COUNT
 * and required-ness — one field per underlying Zod schema field, never
 * invented here:
 *  - `OkrReviewReflectionView.tsx` manager "Request changes":
 *    `changeRequestNotes` — optional (`RequestChangesOnOkrSetManagerReviewSchema`).
 *  - `OkrSupportView.tsx` "Resolve": `resolutionNote` — required
 *    (`ResolveSupportRequestSchema`).
 *  - `OkrSupportView.tsx` "Request decision": `requestedDecision` +
 *    `impactOfDelay` — both required (`RequestDecisionFromSupportRequestSchema`).
 *  - `OkrSupportView.tsx` "Dismiss": `dismissedReason` — required
 *    (`DismissSupportRequestSchema`).
 *
 * Required vs optional is shown BOTH in the field label suffix and via
 * inline validation (touched-after-submit-attempt, same pattern as
 * `RoiTransitionDialog`) — never conflated the way `window.prompt` treated
 * every field identically.
 */
import { AlertTriangle } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/primitives';
import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';

export interface OkrActionDialogField {
  id: string;
  label: { pl: string; en: string };
  required: boolean;
}

export interface OkrActionDialogProps {
  open: boolean;
  title: string;
  description?: string;
  fields: OkrActionDialogField[];
  isPolish: boolean;
  onClose: () => void;
  /** Values keyed by field id, trimmed. A blank optional field is `''`
   * (never sent as `null` here — the caller decides that conversion, same
   * convention as `RoiTransitionDialog`'s `reason.trim() || null`). Only
   * called once every `required` field is non-empty. */
  onSubmit: (values: Record<string, string>) => void;
  submitLabel: string;
  busy?: boolean;
  errorMessage?: string | null;
  isConflict?: boolean;
  /** Danger-styled submit button for destructive actions (e.g. Dismiss). */
  destructive?: boolean;
}

const TEXTAREA_CLASS =
  'w-full min-h-[80px] rounded-lg border border-c-border bg-c-surface px-3 py-2 text-sm text-c-text ' +
  'placeholder:text-c-text-muted transition-colors resize-y ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:border-c-border-strong';

const LABEL_CLASS = 'block text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-1.5';

const GHOST_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-c-border bg-transparent px-4 ' +
  'text-sm font-medium text-c-text transition-colors hover:bg-c-surface-raised ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus';

const PRIMARY_BUTTON_CLASS = `${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`;

const DESTRUCTIVE_BUTTON_CLASS =
  'inline-flex h-9 items-center gap-2 rounded-lg border border-danger-300/40 dark:border-danger-500/30 ' +
  'bg-danger-50 dark:bg-danger-500/10 text-danger-700 dark:text-danger-200 px-4 text-sm font-medium ' +
  'transition-colors hover:bg-danger-100/70 dark:hover:bg-danger-500/15 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:cursor-not-allowed disabled:opacity-50';

export const OkrActionDialog: React.FC<OkrActionDialogProps> = ({
  open,
  title,
  description,
  fields,
  isPolish,
  onClose,
  onSubmit,
  submitLabel,
  busy = false,
  errorMessage = null,
  isConflict = false,
  destructive = false,
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues({});
    setTouched(false);
  }, [open, fields]);

  const missingRequired = fields.some((f) => f.required && !(values[f.id] ?? '').trim());
  // Submit stays clickable even with a missing required field — same fix as
  // `RoiTransitionDialog`/`RoiCaseCreateModal`: a `disabled` button never
  // fires `onClick`, which would make the inline validation permanently
  // unreachable. Only `busy` (save in flight) disables it.
  const submitDisabled = busy;

  const handleSubmit = () => {
    setTouched(true);
    if (missingRequired) return;
    const out: Record<string, string> = {};
    for (const f of fields) out[f.id] = (values[f.id] ?? '').trim();
    onSubmit(out);
  };

  const buttonClass = destructive ? DESTRUCTIVE_BUTTON_CLASS : PRIMARY_BUTTON_CLASS;

  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      description={description}
      size="sm"
      preventOverlayClose={busy}
      preventEscapeClose={busy}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={busy} className={GHOST_BUTTON_CLASS} data-testid="okr-action-dialog-back">
            {isPolish ? 'Wstecz' : 'Back'}
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitDisabled} data-testid="okr-action-dialog-submit" className={buttonClass}>
            <span>{busy ? (isPolish ? 'Zapisywanie…' : 'Saving…') : submitLabel}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {fields.map((f, idx) => {
          const val = values[f.id] ?? '';
          const fieldError = touched && f.required && !val.trim();
          return (
            <div key={f.id}>
              <label className={LABEL_CLASS} htmlFor={`okr-action-dialog-${f.id}`}>
                {isPolish ? f.label.pl : f.label.en}
                {f.required ? (isPolish ? ' (wymagane)' : ' (required)') : isPolish ? ' (opcjonalnie)' : ' (optional)'}
              </label>
              <textarea
                id={`okr-action-dialog-${f.id}`}
                autoFocus={idx === 0}
                value={val}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.id]: e.target.value }))}
                className={TEXTAREA_CLASS}
                data-testid={`okr-action-dialog-${f.id}`}
                aria-invalid={fieldError || undefined}
                aria-describedby={fieldError ? `okr-action-dialog-${f.id}-error` : undefined}
              />
              {fieldError ? (
                <p id={`okr-action-dialog-${f.id}-error`} className="mt-1 text-[11px] text-c-danger" data-testid={`okr-action-dialog-${f.id}-error`}>
                  {isPolish ? 'To pole jest wymagane' : 'This field is required'}
                </p>
              ) : null}
            </div>
          );
        })}

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-c-danger/30 bg-c-danger/10 px-3 py-2 text-[12px] text-c-text"
            data-testid="okr-action-dialog-error"
          >
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-c-danger" />
            <span>
              {isConflict
                ? isPolish
                  ? `Konflikt zapisu: ${errorMessage}`
                  : `Write conflict: ${errorMessage}`
                : errorMessage}
            </span>
          </div>
        ) : null}
      </div>
    </Modal>
  );
};

export default OkrActionDialog;
