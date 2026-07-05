/**
 * TemplateGovernanceDrawer — read-only governance + approval-history
 * surface for `tp_base_templates` rows (Block A · EPIC-T6).
 *
 * Shows:
 *   * Status / version / owner header.
 *   * `approval_history` timeline (newest first).
 *   * `governance_rules` JSON pretty-printed in a code block.
 *
 * Drawer is right-side and follows the MELS standard (right rail). It
 * contains no mutating affordances — all edits flow through
 * `<TemplateLifecycleActions>` so this component stays safe to expose
 * to non-admins.
 */

import { Clock, Hash, ShieldCheck, User, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ApprovalHistoryEntry,
  type LifecycleTemplate,
} from '@/services/api/templateLifecycle.api';

import { TemplateLifecycleBadge } from './TemplateLifecycleBadge';

export interface TemplateGovernanceDrawerProps {
  open: boolean;
  template: LifecycleTemplate | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  testId?: string;
}

const EVENT_LABELS: Record<ApprovalHistoryEntry['event'], { en: string; pl: string }> = {
  approved: { en: 'Approved', pl: 'Zatwierdzono' },
  deprecated: { en: 'Deprecated', pl: 'Wycofano' },
  reverted_to_draft: { en: 'Reverted to draft', pl: 'Cofnięto do szkicu' },
  auto_promoted_from_legacy_featured: {
    en: 'Auto-promoted (legacy featured)',
    pl: 'Auto-promocja (legacy featured)',
  },
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })}`;
  } catch {
    return iso;
  }
}

export const TemplateGovernanceDrawer: React.FC<TemplateGovernanceDrawerProps> = ({
  open,
  template,
  loading = false,
  error = null,
  onClose,
  testId = 'template-governance-drawer',
}) => {
  const { t } = useTranslation();

  if (!open) return null;

  const sortedHistory = template
    ? [...template.approval_history].sort((a, b) => b.at.localeCompare(a.at))
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${testId}-title`}
      data-testid={testId}
      className="fixed inset-0 z-40 flex"
    >
      <div className="flex-1 bg-c-surface-raised backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <aside
        className="w-[420px] max-w-full h-full bg-c-surface border-l border-c-border-subtle shadow-2xl overflow-y-auto"
        data-testid={`${testId}-aside`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-c-border-subtle sticky top-0 bg-c-surface z-10">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-c-text-secondary" aria-hidden />
            <h2
              id={`${testId}-title`}
              className="text-sm font-semibold text-c-text"
            >
              {t('kimi.template.governance.title', 'Template governance')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-c-text-secondary hover:text-c-text-secondary focus:outline-none focus:ring-2 focus:ring-c-focus rounded p-1"
            aria-label={t('kimi.template.governance.close', 'Close')}
            data-testid={`${testId}-close`}
          >
            <X size={16} />
          </button>
        </div>

        {loading && (
          <p className="px-4 py-6 text-[12px] text-c-text-secondary" data-testid={`${testId}-loading`}>
            {t('kimi.template.governance.loading', 'Loading…')}
          </p>
        )}

        {!loading && error && (
          <p
            className="px-4 py-6 text-[12px] text-danger-600 dark:text-danger-300"
            role="alert"
            data-testid={`${testId}-error`}
          >
            {error}
          </p>
        )}

        {!loading && !error && template && (
          <div className="px-4 py-4 space-y-5" data-testid={`${testId}-body`}>
            {/* Header card */}
            <section>
              <h3 className="text-base font-semibold text-c-text">
                {template.name}
              </h3>
              {template.description && (
                <p className="mt-1 text-[12px] text-c-text-secondary">
                  {template.description}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-c-text-secondary">
                <TemplateLifecycleBadge status={template.status} testId={`${testId}-status`} />
                <span className="inline-flex items-center gap-1">
                  <Hash size={10} aria-hidden />
                  {template.version}
                </span>
                {template.owner_user_id && (
                  <span className="inline-flex items-center gap-1">
                    <User size={10} aria-hidden />
                    {template.owner_user_id}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock size={10} aria-hidden />
                  {fmtDate(template.created_at)}
                </span>
              </div>
            </section>

            {/* Approval history */}
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-c-text-secondary">
                {t('kimi.template.governance.approvalHistory', 'Approval history')}
              </h4>
              {sortedHistory.length === 0 ? (
                <p
                  className="mt-2 text-[12px] text-c-text-secondary"
                  data-testid={`${testId}-history-empty`}
                >
                  {t('kimi.template.governance.noEntries', 'No entries yet.')}
                </p>
              ) : (
                <ol className="mt-2 space-y-2" data-testid={`${testId}-history`}>
                  {sortedHistory.map((entry, idx) => {
                    const label = EVENT_LABELS[entry.event];
                    return (
                      <li
                        key={`${entry.at}-${idx}`}
                        className="rounded-md border border-c-border-subtle bg-c-surface-raised px-3 py-2"
                        data-testid={`${testId}-history-item`}
                      >
                        <div className="flex items-center justify-between text-[12px] font-semibold text-c-text">
                          <span>{t(`kimi.template.event.${entry.event}`, label.en)}</span>
                          <span className="text-[11px] font-normal text-c-text-secondary">
                            {fmtDate(entry.at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-c-text-secondary">
                          {t('kimi.template.governance.actor', 'Actor')}: {entry.actor}
                        </p>
                        {entry.previous_status && (
                          <p className="text-[11px] text-c-text-secondary">
                            {t('kimi.template.governance.previousStatus', 'Previous status')}:{' '}
                            {entry.previous_status}
                          </p>
                        )}
                        {entry.note && (
                          <p className="mt-1 text-[12px] text-c-text italic">
                            "{entry.note}"
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>

            {/* Governance rules */}
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-c-text-secondary">
                {t('kimi.template.governance.rules', 'Governance rules')}
              </h4>
              <pre
                className="mt-2 max-h-[320px] overflow-auto rounded-md border border-c-border-subtle bg-c-surface-raised text-c-text p-3 text-[11px] leading-relaxed"
                data-testid={`${testId}-rules`}
              >
                {JSON.stringify(template.governance_rules, null, 2)}
              </pre>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
};

export default TemplateGovernanceDrawer;
