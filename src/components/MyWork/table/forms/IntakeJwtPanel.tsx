/**
 * IntakeJwtPanel — Admin-side panel for the Form Intake (JWT) workflow.
 *
 * Block D · EPIC-T14 · Sprint D-S4. Surfaces the four operator-facing
 * actions delivered by `FormIntakeService` (D-S2):
 *
 *   1. Show current intake context (target table id, hard expiry, current
 *      allow-list, published flag).
 *   2. Issue a JWT link to a recipient (subject + TTL → token + URL).
 *   3. Edit the field allow-list — multi-select against the form's
 *      configured fields. Empty list falls back to the form's `config.fields`
 *      (no filter).
 *   4. Copy the public URL to the clipboard.
 *
 * Hosted as a modal inside `FormsIndex` when the form has the
 * `tabele_form_intake` kill switch flipped on. The panel itself does not
 * mutate the form record; all writes flow through `tablePlatform.api`.
 *
 * Compliance:
 *   - DBR77 hex audit clean — Tailwind tokens only.
 *   - All actions emit toasts so the user never has to refresh to see
 *     what changed.
 *   - The component is idempotent: closing & reopening the modal reloads
 *     the intake context.
 */

import {
  AlertTriangle,
  Check,
  ClipboardCopy,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
// `TFunction` is exported by `i18next`, not by `react-i18next` — importing it from the
// latter compiles under esbuild (which strips types without checking them) and fails
// under `tsc` with TS2305.
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { type ActionContext, runIdeaAction } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';
import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';
import {
  type FormIntakeContext,
  getFormIntakeContext,
  type IssuedFormIntakeJwt,
  issueFormIntakeJwt,
  setFormIntakeAllowList,
} from '@/services/api/tablePlatform.api';

const SUBJECT_MAX_CHARS = 320;
const DEFAULT_TTL_SECONDS = 30 * 24 * 60 * 60;
const getTtlOptions = (t: TFunction): Array<{ label: string; seconds: number }> => [
  { label: t('ideas.table.intakeJwt.ttl1Day', '1 day'), seconds: 24 * 60 * 60 },
  { label: t('ideas.table.intakeJwt.ttl7Days', '7 days'), seconds: 7 * 24 * 60 * 60 },
  { label: t('ideas.table.intakeJwt.ttl30Days', '30 days'), seconds: 30 * 24 * 60 * 60 },
  { label: t('ideas.table.intakeJwt.ttl90Days', '90 days'), seconds: 90 * 24 * 60 * 60 },
];

export interface IntakeJwtPanelFormFieldOption {
  fieldId: string;
  label: string;
}

export interface IntakeJwtPanelProps {
  formId: string;
  /** All fields configured on the form. Used to render the allow-list editor. */
  configuredFields: IntakeJwtPanelFormFieldOption[];
  /** Origin used to render the recipient URL (e.g. https://app.consultify.io). */
  baseUrl: string;
  onClose: () => void;
  /** Test seam: skip the network call and seed initial context. */
  testInitialContext?: FormIntakeContext | null;
}

export const IntakeJwtPanel: React.FC<IntakeJwtPanelProps> = ({
  formId,
  configuredFields,
  baseUrl,
  onClose,
  testInitialContext,
}) => {
  const { t } = useTranslation();
  const TTL_OPTIONS = useMemo(() => getTtlOptions(t), [t]);
  const [context, setContext] = useState<FormIntakeContext | null>(testInitialContext ?? null);
  const [loading, setLoading] = useState(testInitialContext === undefined);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open: true, onClose, containerRef });

  const [subject, setSubject] = useState('');
  const [ttlSeconds, setTtlSeconds] = useState<number>(DEFAULT_TTL_SECONDS);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<IssuedFormIntakeJwt | null>(null);
  const [copied, setCopied] = useState<'token' | 'url' | null>(null);

  const [allowListDraft, setAllowListDraft] = useState<string[]>([]);
  const [savingAllowList, setSavingAllowList] = useState(false);

  const useNetwork = testInitialContext === undefined;

  const refresh = useCallback(async () => {
    if (!useNetwork) return;
    setLoading(true);
    setError(null);
    try {
      const ctx = await getFormIntakeContext(formId);
      setContext(ctx);
      setAllowListDraft(ctx.fieldAllowList ?? []);
    } catch (e) {
      setError((e as Error)?.message ?? t('ideas.table.intakeJwt.failedToLoad', 'Failed to load intake context'));
    } finally {
      setLoading(false);
    }
  }, [formId, useNetwork]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (testInitialContext) {
      setAllowListDraft(testInitialContext.fieldAllowList ?? []);
    }
  }, [testInitialContext]);

  const allowListDirty = useMemo(() => {
    const current = context?.fieldAllowList ?? [];
    if (current.length !== allowListDraft.length) return true;
    const a = [...current].sort();
    const b = [...allowListDraft].sort();
    return a.some((entry, i) => entry !== b[i]);
  }, [context, allowListDraft]);

  const recipientUrl = useMemo(() => {
    if (!issued) return null;
    return `${baseUrl.replace(/\/$/, '')}/public/forms/jwt/${encodeURIComponent(issued.token)}`;
  }, [issued, baseUrl]);

  const handleIssue = useCallback(async () => {
    if (!subject.trim()) {
      toast.error(t('ideas.table.intakeJwt.subjectRequired', 'Recipient subject is required'));
      return;
    }
    if (subject.trim().length > SUBJECT_MAX_CHARS) {
      toast.error(
        t('ideas.table.intakeJwt.subjectTooLong', 'Subject must be {{max}} characters or fewer', {
          max: SUBJECT_MAX_CHARS,
        })
      );
      return;
    }
    setIssuing(true);
    setIssued(null);
    try {
      const result = await issueFormIntakeJwt(formId, {
        subject: subject.trim(),
        expiresInSeconds: ttlSeconds,
      });
      setIssued(result);
      toast.success(t('ideas.table.intakeJwt.linkIssued', 'Intake link issued'));
    } catch (e) {
      toast.error(
        t('ideas.table.intakeJwt.failedToIssue', 'Failed to issue link: {{message}}', {
          message: (e as Error)?.message ?? t('ideas.table.intakeJwt.unknown', 'unknown'),
        })
      );
    } finally {
      setIssuing(false);
    }
  }, [formId, subject, ttlSeconds]);

  const handleCopy = useCallback(async (value: string, kind: 'token' | 'url') => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(value);
      }
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error(t('ideas.table.intakeJwt.failedToCopy', 'Failed to copy to clipboard'));
    }
  }, []);

  const handleToggleField = useCallback((fieldId: string) => {
    setAllowListDraft((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    setAllowListDraft(configuredFields.map((f) => f.fieldId));
  }, [configuredFields]);

  const handleClearAllowList = useCallback(() => {
    setAllowListDraft([]);
  }, []);

  // Program B (E02) — klik człowieka = `ctx.params.run` (rejestr wykonuje
  // ORYGINALNY callback wprost); Teresa = ta sama funkcja rejestru woła REST
  // bezpośrednio (`runTableFormIntakeSaveAllowListCallback` w `ideaActionRegistry.ts`).
  const handleSaveAllowList = useCallback(() => {
    const ctx: ActionContext = {
      ideaId: formId,
      tool: 'table',
      selection: EMPTY_SELECTION,
      surface: 'panel',
      source: 'ui',
      params: {
        formId,
        fieldIds: allowListDraft,
        run: async () => {
          setSavingAllowList(true);
          try {
            const next = allowListDraft.length > 0 ? Array.from(new Set(allowListDraft)) : null;
            const updated = await setFormIntakeAllowList(formId, next);
            setContext(updated);
            setAllowListDraft(updated.fieldAllowList ?? []);
            toast.success(t('ideas.table.intakeJwt.allowListSaved', 'Allow-list saved'));
          } catch (e) {
            toast.error(
              t('ideas.table.intakeJwt.failedToSaveAllowList', 'Failed to save allow-list: {{message}}', {
                message: (e as Error)?.message ?? t('ideas.table.intakeJwt.unknown', 'unknown'),
              })
            );
          } finally {
            setSavingAllowList(false);
          }
        },
      },
    };
    void runIdeaAction('table.form_intake.save_allow_list', ctx);
  }, [formId, allowListDraft]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-c-surface-raised px-4"
      data-testid="intake-jwt-panel-overlay"
    >
      <section
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-c-border-subtle bg-c-surface shadow-2xl border-c-border-subtle bg-c-surface-raised outline-none"
        data-testid="intake-jwt-panel"
        aria-label={t('ideas.table.intakeJwt.panelAriaLabel', 'Form intake settings')}
      >
        <header className="flex items-center justify-between border-b border-c-border-subtle px-5 py-3 border-c-border-subtle">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-c-success" />
            <h2 className="text-sm font-semibold text-c-text">
              {t('ideas.table.intakeJwt.panelTitle', 'Form intake (private link)')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text-muted"
            aria-label={t('ideas.table.intakeJwt.closePanel', 'Close intake panel')}
            data-testid="intake-jwt-close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-c-text-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('ideas.table.intakeJwt.loadingContext', 'Loading intake context…')}
            </div>
          ) : error ? (
            <div className="rounded-md border border-c-danger bg-[color-mix(in_srgb,var(--c-danger)_12%,transparent)] px-3 py-2 text-c-danger border-c-danger bg-[color-mix(in_srgb,var(--c-danger)_18%,transparent)] text-c-danger">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            </div>
          ) : !context ? null : (
            <>
              <section
                className="rounded-md border border-c-border-subtle bg-c-surface-raised p-3 border-c-border-subtle bg-c-surface-raised"
                aria-label={t('ideas.table.intakeJwt.summaryAriaLabel', 'Intake summary')}
              >
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('ideas.table.intakeJwt.summary', 'Summary')}
                </h3>
                <dl className="grid grid-cols-3 gap-y-1 text-xs">
                  <dt className="text-c-text-muted">{t('ideas.table.intakeJwt.targetTable', 'Target table')}</dt>
                  <dd className="col-span-2 truncate text-c-text" data-testid="intake-target-table">
                    {context.targetTableId}
                  </dd>
                  <dt className="text-c-text-muted">{t('ideas.table.intakeJwt.allowList', 'Allow-list')}</dt>
                  <dd className="col-span-2 text-c-text" data-testid="intake-allow-list-summary">
                    {context.fieldAllowList && context.fieldAllowList.length > 0
                      ? t('ideas.table.intakeJwt.fieldCount', {
                          count: context.fieldAllowList.length,
                        })
                      : t('ideas.table.intakeJwt.allConfiguredFields', 'All configured fields')}
                  </dd>
                  <dt className="text-c-text-muted">{t('ideas.table.intakeJwt.hardExpiry', 'Hard expiry')}</dt>
                  <dd className="col-span-2 text-c-text" data-testid="intake-hard-expiry">
                    {context.publicLinkExpiresAt
                      ? new Date(context.publicLinkExpiresAt).toLocaleString()
                      : t('ideas.table.intakeJwt.none', 'None')}
                  </dd>
                  <dt className="text-c-text-muted">{t('ideas.table.intakeJwt.status', 'Status')}</dt>
                  <dd className="col-span-2 text-c-text">
                    {context.isPublished
                      ? t('ideas.table.intakeJwt.published', 'Published')
                      : t('ideas.table.intakeJwt.draftWontVerify', 'Draft (links will not verify)')}
                  </dd>
                </dl>
              </section>

              <section
                className="rounded-md border border-c-border-subtle p-3 border-c-border-subtle"
                aria-label={t('ideas.table.intakeJwt.allowListEditorAriaLabel', 'Allow-list editor')}
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                    {t('ideas.table.intakeJwt.fieldAllowList', 'Field allow-list')}
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="rounded-md border border-c-border-subtle px-2 py-0.5 text-[11px] text-c-text-secondary hover:bg-c-surface-raised border-c-border-subtle text-c-text-muted hover:bg-c-surface-raised"
                      data-testid="intake-allow-list-select-all"
                    >
                      {t('ideas.table.intakeJwt.selectAll', 'Select all')}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAllowList}
                      className="inline-flex items-center gap-1 rounded-md border border-c-border-subtle px-2 py-0.5 text-[11px] text-c-text-secondary hover:bg-c-surface-raised border-c-border-subtle text-c-text-muted hover:bg-c-surface-raised"
                      data-testid="intake-allow-list-clear"
                      aria-label={t('ideas.table.intakeJwt.clearAllowList', 'Clear allow-list (use form fields)')}
                    >
                      <Trash2 className="h-3 w-3" /> {t('ideas.table.intakeJwt.clear', 'Clear')}
                    </button>
                  </div>
                </div>
                <p className="mb-2 text-[11px] text-c-text-muted">
                  {t(
                    'ideas.table.intakeJwt.allowListHint',
                    "Empty allow-list falls back to the form's configured fields. Selecting a subset narrows what recipients can submit."
                  )}
                </p>
                <ul
                  className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto"
                  data-testid="intake-allow-list-options"
                >
                  {configuredFields.length === 0 ? (
                    <li className="text-[11px] text-c-text-muted">
                      {t('ideas.table.intakeJwt.noConfiguredFields', 'The form has no configured fields yet.')}
                    </li>
                  ) : (
                    configuredFields.map((f) => {
                      const checked = allowListDraft.includes(f.fieldId);
                      return (
                        <li key={f.fieldId}>
                          <label className="flex items-center gap-2 rounded-md px-1.5 py-1 text-xs text-c-text-secondary hover:bg-c-surface-raised text-c-text hover:bg-c-surface-raised">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleField(f.fieldId)}
                              className="h-3.5 w-3.5"
                              data-testid={`intake-allow-list-toggle-${f.fieldId}`}
                            />
                            <span className="truncate">{f.label}</span>
                            <span className="ml-auto truncate text-[10px] text-c-text-secondary">
                              {f.fieldId.slice(0, 8)}
                            </span>
                          </label>
                        </li>
                      );
                    })
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => void handleSaveAllowList()}
                  disabled={!allowListDirty || savingAllowList}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-c-surface-raised px-3 py-1.5 text-xs font-medium text-c-text hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:bg-c-border-subtle text-c-text hover:bg-c-surface-raised disabled:bg-c-surface-raised disabled:text-c-text-muted"
                  data-testid="intake-allow-list-save"
                >
                  {savingAllowList ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  {t('ideas.table.intakeJwt.saveAllowList', 'Save allow-list')}
                </button>
              </section>

              <section
                className="rounded-md border border-c-border-subtle p-3 border-c-border-subtle"
                aria-label={t('ideas.table.intakeJwt.issueLinkAriaLabel', 'Issue intake link')}
              >
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
                  {t('ideas.table.intakeJwt.issuePrivateLink', 'Issue private link')}
                </h3>
                <label className="block">
                  <span className="text-[11px] text-c-text-muted">
                    {t('ideas.table.intakeJwt.recipientSubject', 'Recipient subject (email or label)')}
                  </span>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    maxLength={SUBJECT_MAX_CHARS}
                    placeholder="recipient@partner.com"
                    className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text border-c-border-subtle bg-c-surface-raised text-c-text"
                    data-testid="intake-issue-subject"
                    aria-label={t('ideas.table.intakeJwt.recipientSubjectAriaLabel', 'Recipient subject')}
                  />
                </label>
                <label className="mt-2 block">
                  <span className="text-[11px] text-c-text-muted">
                    {t('ideas.table.intakeJwt.expiresIn', 'Expires in')}
                  </span>
                  <select
                    value={ttlSeconds}
                    onChange={(e) => setTtlSeconds(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-xs text-c-text border-c-border-subtle bg-c-surface-raised text-c-text"
                    data-testid="intake-issue-ttl"
                    aria-label={t('ideas.table.intakeJwt.expiresIn', 'Expires in')}
                  >
                    {TTL_OPTIONS.map((o) => (
                      <option key={o.seconds} value={o.seconds}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => void handleIssue()}
                  disabled={issuing || !context.isPublished}
                  className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-c-success px-3 py-1.5 text-xs font-semibold text-c-text hover:bg-c-success disabled:cursor-not-allowed disabled:bg-c-surface-raised"
                  data-testid="intake-issue-submit"
                >
                  {issuing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <KeyRound className="h-3 w-3" />
                  )}
                  {t('ideas.table.intakeJwt.issueLink', 'Issue link')}
                </button>
                {!context.isPublished ? (
                  <p className="mt-1.5 text-[11px] text-c-danger">
                    {t(
                      'ideas.table.intakeJwt.publishFirst',
                      "Publish the form first; private links won't verify on a draft form."
                    )}
                  </p>
                ) : null}

                {issued && recipientUrl ? (
                  <div
                    className="mt-3 space-y-2 rounded-md border border-c-success bg-c-success p-2 text-xs text-c-success border-c-success bg-c-success text-c-success"
                    data-testid="intake-issued-result"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[10px]">{recipientUrl}</span>
                      <button
                        type="button"
                        onClick={() => void handleCopy(recipientUrl, 'url')}
                        className="inline-flex items-center gap-1 rounded-md border border-c-success bg-c-surface px-2 py-0.5 text-[10px] text-c-success hover:bg-c-success border-c-success bg-c-success text-c-success"
                        data-testid="intake-issued-copy-url"
                      >
                        {copied === 'url' ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <ClipboardCopy className="h-3 w-3" />
                        )}
                        {copied === 'url'
                          ? t('ideas.table.intakeJwt.copied', 'Copied')
                          : t('ideas.table.intakeJwt.copyUrl', 'Copy URL')}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-c-success">
                        {t('ideas.table.intakeJwt.expires', 'Expires {{date}}', {
                          date: new Date(issued.expiresAt).toLocaleString(),
                        })}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopy(issued.token, 'token')}
                        className="inline-flex items-center gap-1 rounded-md border border-c-success bg-c-surface px-2 py-0.5 text-[10px] text-c-success hover:bg-c-success border-c-success bg-c-success text-c-success"
                        data-testid="intake-issued-copy-token"
                      >
                        {copied === 'token' ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <ClipboardCopy className="h-3 w-3" />
                        )}
                        {copied === 'token'
                          ? t('ideas.table.intakeJwt.copied', 'Copied')
                          : t('ideas.table.intakeJwt.copyToken', 'Copy token')}
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default IntakeJwtPanel;
