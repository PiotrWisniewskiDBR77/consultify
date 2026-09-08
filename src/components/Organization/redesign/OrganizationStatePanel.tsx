/**
 * OrganizationStatePanel — prawy panel stanu ekranu Organizacji (redesign v1).
 *
 * Wzorzec WIĄŻĄCY: `org-prototyp-wzorzec.html` §PANEL STANU + zrzuty
 * proto-light.png / proto-dark.png (zaakceptowane przez właściciela 2026-08-24).
 *
 * Panel zastępuje trzy rzeczy rozsypane dziś po module (patrz §5 dokumentu
 * konsolidacji):
 *   - powtarzany na KAŻDYM z 21 ekranów baner „Teresa context: N claims"
 *     → karta ŹRÓDŁA,
 *   - pierścień „Completeness %" obecny tylko na 4 ekranach Profilu
 *     → karta STAN DANYCH (z jawnym zastrzeżeniem: kompletność ≠ gotowość),
 *   - przycisk „Save Changes" w nagłówku obecny tylko na 4 ekranach Profilu
 *     → karta akcji (jeden „Zapisz zmiany" na komplet pól ekranu).
 *
 * Moduł DEKLARUJE treść, komponent narzuca wygląd (ta sama zasada co
 * StandardTable/StandardPreview). Wyłącznie tokeny `c-*`; crimson NIE występuje
 * — kolor pojawia się tylko jako sygnał (warning/success) przy kropkach statusu.
 */

import { Loader2, Save } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../lib/utils';

export interface OrganizationStateDecision {
  id: string;
  /** Kanoniczna ścieżka pola, np. `profile.description`. */
  field: string;
  /** Jedno zdanie: dlaczego wymaga decyzji. */
  detail: string;
  severity?: 'warning' | 'info';
}

export interface OrganizationStateSource {
  id: string;
  label: string;
  detail?: string;
  status?: 'ok' | 'warning' | 'muted';
  statusLabel?: string;
}

export interface OrganizationStatePanelProps {
  /** Nagłówek karty STAN DANYCH — etykieta wersji kontekstu (np. „v1"). */
  versionLabel?: string;
  filledFields?: number;
  totalFields?: number;
  approvedFacts?: number;
  /** Zdanie pod paskiem — domyślnie zastrzeżenie z prototypu. */
  completenessNote?: string;

  decisions?: OrganizationStateDecision[];
  resolveLabel?: string;
  onResolveDecisions?: () => void;

  sourcesSummary?: string;
  sources?: OrganizationStateSource[];
  fieldSourcesLabel?: string;
  onShowFieldSources?: () => void;

  onSave?: () => void;
  saving?: boolean;
  saveLabel?: string;
  onPublish?: () => void;
  publishing?: boolean;
  publishLabel?: string;
  publishNote?: string;

  className?: string;
}

const L1 = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-muted';
const L2 = 'text-[13px] font-semibold text-c-text';
const L5 = 'text-[11px] text-c-text-muted';
const CARD =
  'rounded-xl border border-c-border-subtle bg-c-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]';
const CARD_HEADER = 'flex items-center gap-2 border-b border-c-border-subtle px-3 py-2.5';
const ACTION =
  'inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-c-border bg-transparent text-[13px] font-medium text-c-text transition-colors hover:border-c-border-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] disabled:opacity-50';
// CTA = neutralny inwert (granat w light / jasny w dark) — NIGDY crimson.
const ACTION_PRIMARY =
  'inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-navy-900 text-[13px] font-semibold text-white transition-colors hover:bg-navy-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] disabled:opacity-50 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]';

const StatusDot: React.FC<{ tone?: 'ok' | 'warning' | 'muted' | 'info' }> = ({
  tone = 'muted',
}) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-block h-1.5 w-1.5 shrink-0 rounded-full',
      tone === 'ok' && 'bg-c-success',
      tone === 'warning' && 'bg-c-warning',
      tone === 'info' && 'bg-c-info',
      tone === 'muted' && 'bg-c-border-strong'
    )}
  />
);

export const OrganizationStatePanel: React.FC<OrganizationStatePanelProps> = ({
  versionLabel,
  filledFields,
  totalFields,
  approvedFacts,
  completenessNote,
  decisions = [],
  resolveLabel,
  onResolveDecisions,
  sourcesSummary,
  sources = [],
  fieldSourcesLabel,
  onShowFieldSources,
  onSave,
  saving = false,
  saveLabel,
  onPublish,
  publishing = false,
  publishLabel,
  publishNote,
  className,
}) => {
  // Domyślne teksty panelu idą przez `t()`, nie przez polskie wartości domyślne
  // parametrów — inaczej użytkownik EN widziałby polski panel (kanał A z PLAN §1).
  const { t } = useTranslation();
  const completenessNoteText =
    completenessNote ?? t('organization.redesign.panel.completenessNote', 'Data completeness — this is not decision readiness.');
  const resolveLabelText = resolveLabel ?? t('organization.redesign.panel.resolveConflicts', 'Resolve conflicts');
  const fieldSourcesLabelText =
    fieldSourcesLabel ?? t('organization.redesign.panel.fieldSources', 'Show field sources');
  const saveLabelText = saveLabel ?? t('organization.redesign.panel.save', 'Save changes');
  const publishLabelText = publishLabel ?? t('organization.redesign.panel.publish', 'Publish context version');
  const publishNoteText = publishNote ?? t('organization.redesign.panel.publishNote', 'Publishing creates an immutable version that the other modules read.');
  const hasCompleteness = typeof filledFields === 'number' && typeof totalFields === 'number';
  const percent =
    hasCompleteness && (totalFields as number) > 0
      ? Math.round(((filledFields as number) / (totalFields as number)) * 100)
      : 0;

  return (
    <aside
      aria-label={t('organization.redesign.panel.aria', 'State of this screen')}
      data-testid="org-state-panel"
      className={cn('flex w-full flex-col gap-3', className)}
    >
      {(hasCompleteness || typeof approvedFacts === 'number') && (
        <section className={CARD}>
          <header className={CARD_HEADER}>
            <span className={cn(L1, 'flex-1')}>{t('organization.redesign.panel.dataState', 'Data state')}</span>
            {versionLabel && <span className={L5}>{versionLabel}</span>}
          </header>
          <div className="p-3">
            <div className="grid grid-cols-2 gap-3">
              {hasCompleteness && (
                <div>
                  <p className="text-[22px] font-semibold tabular-nums tracking-tight text-c-text">
                    {filledFields}/{totalFields}
                  </p>
                  <p className={L5}>{t('organization.redesign.panel.filledFields', 'Fields filled in')}</p>
                </div>
              )}
              {typeof approvedFacts === 'number' && (
                <div>
                  <p className="text-[22px] font-semibold tabular-nums tracking-tight text-c-text">
                    {approvedFacts}
                  </p>
                  <p className={L5}>{t('organization.redesign.panel.approvedFacts', 'Approved facts')}</p>
                </div>
              )}
            </div>
            {hasCompleteness && (
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={t('organization.redesign.panel.completenessAria', 'Screen field completeness')}
                className="my-2 h-1 overflow-hidden rounded-full bg-c-border-subtle"
              >
                <span
                  className="block h-full bg-c-text-secondary"
                  style={{ width: `${percent}%` }}
                />
              </div>
            )}
            <p className={L5}>{completenessNoteText}</p>
          </div>
        </section>
      )}

      {decisions.length > 0 && (
        <section className={CARD}>
          <header className={CARD_HEADER}>
            <span className={cn(L1, 'flex-1')}>{t('organization.redesign.panel.needsDecision', 'Needs a decision')}</span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-c-warning">
              <StatusDot tone="warning" />
              {decisions.length}
            </span>
          </header>
          <div className="px-3 py-1">
            {decisions.map((decision) => (
              <div
                key={decision.id}
                className="flex items-center gap-2 border-b border-c-border-subtle py-2 last:border-b-0"
              >
                <StatusDot tone={decision.severity === 'info' ? 'info' : 'warning'} />
                <div className="min-w-0 flex-1">
                  <p className={L2}>{decision.field}</p>
                  <p className={cn(L5, 'truncate')}>{decision.detail}</p>
                </div>
              </div>
            ))}
          </div>
          {onResolveDecisions && (
            <div className="p-3">
              <button type="button" className={ACTION} onClick={onResolveDecisions}>
                {resolveLabelText}
              </button>
            </div>
          )}
        </section>
      )}

      {(sources.length > 0 || sourcesSummary) && (
        <section className={CARD}>
          <header className={CARD_HEADER}>
            <span className={cn(L1, 'flex-1')}>{t('organization.redesign.panel.sources', 'Sources')}</span>
            {sourcesSummary && <span className={L5}>{sourcesSummary}</span>}
          </header>
          {sources.length > 0 && (
            <div className="px-3 py-1">
              {sources.map((source) => (
                <div
                  key={source.id}
                  className="flex items-center gap-2 border-b border-c-border-subtle py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className={L2}>{source.label}</p>
                    {source.detail && <p className={cn(L5, 'truncate')}>{source.detail}</p>}
                  </div>
                  {source.statusLabel && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-[11px]',
                        source.status === 'ok' && 'text-c-success',
                        source.status === 'warning' && 'text-c-warning',
                        (!source.status || source.status === 'muted') && 'text-c-text-secondary'
                      )}
                    >
                      <StatusDot tone={source.status ?? 'muted'} />
                      {source.statusLabel}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {onShowFieldSources && (
            <div className="p-3">
              <button type="button" className={ACTION} onClick={onShowFieldSources}>
                {fieldSourcesLabelText}
              </button>
            </div>
          )}
        </section>
      )}

      {(onSave || onPublish) && (
        <section className={CARD}>
          <div className="grid gap-2 p-3">
            {onSave && (
              <button
                type="button"
                className={ACTION_PRIMARY}
                onClick={onSave}
                disabled={saving}
                data-testid="org-state-panel-save"
              >
                {saving ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Save aria-hidden="true" className="h-4 w-4" />
                )}
                {saving ? t('organization.redesign.panel.saving', 'Saving…') : saveLabelText}
              </button>
            )}
            {onPublish && (
              <button type="button" className={ACTION} onClick={onPublish} disabled={publishing}>
                {publishLabelText}
              </button>
            )}
          </div>
          {publishNoteText && (
            <p className={cn(L5, 'border-t border-c-border-subtle px-4 py-3')}>{publishNoteText}</p>
          )}
        </section>
      )}
    </aside>
  );
};

export default OrganizationStatePanel;
