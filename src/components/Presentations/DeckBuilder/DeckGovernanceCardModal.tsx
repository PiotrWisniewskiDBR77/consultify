import { Download, ShieldCheck, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  fetchPresentationGovernanceCard,
  type GovernanceFetchResult,
  type GovernanceVerdict,
  type PresentationGovernanceCard,
} from '@/services/presentationGovernance';

interface DeckGovernanceCardModalProps {
  deckId: string;
  onClose: () => void;
  onCardLoaded?: (card: PresentationGovernanceCard) => void;
}

const VERDICT_STYLE: Record<GovernanceVerdict, { bg: string; text: string; label: string }> = {
  PASS: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    label: 'PASS',
  },
  PASS_WITH_P2: {
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300',
    label: 'PASS · P2',
  },
  BLOCKED_P1: {
    bg: 'bg-orange-100 dark:bg-orange-500/20',
    text: 'text-orange-700 dark:text-orange-300',
    label: 'BLOCKED P1',
  },
  BLOCKED_P0: {
    bg: 'bg-danger-100 dark:bg-danger-500/20',
    text: 'text-danger-700 dark:text-danger-300',
    label: 'BLOCKED P0',
  },
  INCONCLUSIVE: {
    bg: 'bg-slate-100 dark:bg-slate-500/20',
    text: 'text-slate-700 dark:text-slate-300',
    label: 'INCONCLUSIVE',
  },
};

const CONFIDENTIALITY_STYLE: Record<string, { bg: string; text: string }> = {
  public: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-300',
  },
  internal: { bg: 'bg-blue-100 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300' },
  confidential: { bg: 'bg-danger-100 dark:bg-danger-500/20', text: 'text-danger-700 dark:text-danger-300' },
};

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return value;
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return value;
  }
}

const VerdictPill: React.FC<{ verdict: GovernanceVerdict | string }> = ({ verdict }) => {
  const style = VERDICT_STYLE[verdict as GovernanceVerdict] ?? VERDICT_STYLE.INCONCLUSIVE;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
};

const StatTile: React.FC<{
  label: string;
  value: number | string;
  tone?: 'rose' | 'amber' | 'slate' | 'emerald' | 'blue';
}> = ({ label, value, tone = 'slate' }) => {
  const toneClass: Record<string, string> = {
    rose: 'text-danger-600 dark:text-danger-300',
    amber: 'text-amber-600 dark:text-amber-300',
    slate: 'text-slate-700 dark:text-slate-200',
    emerald: 'text-emerald-600 dark:text-emerald-300',
    blue: 'text-blue-600 dark:text-blue-300',
  };
  return (
    <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className={`text-lg font-semibold ${toneClass[tone]}`}>{value}</div>
    </div>
  );
};

export const DeckGovernanceCardModal: React.FC<DeckGovernanceCardModalProps> = ({
  deckId,
  onClose,
  onCardLoaded,
}) => {
  const { t } = useTranslation();
  const [result, setResult] = useState<GovernanceFetchResult | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchPresentationGovernanceCard(deckId);
    setResult(res);
    setLoading(false);
    if (res.status === 'ok' && res.card) {
      onCardLoaded?.(res.card);
    }
  }, [deckId, onCardLoaded]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const card = result?.status === 'ok' ? result.card : undefined;

  const handleExportJson = useCallback(() => {
    if (!card) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `governance-${card.deckId}-${stamp}.json`;
    const payload = JSON.stringify(card, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [card]);

  return (
    <div
      className="fixed inset-0 z-overlay flex items-center justify-center bg-slate-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="deck-governance-card-title"
    >
      <div className="max-w-xl w-full mx-4 rounded-xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-800">
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary-500" />
            <h2
              id="deck-governance-card-title"
              className="text-sm font-semibold text-slate-700 dark:text-white"
            >
              {t('presentations.governance.title', 'Governance Card')}
            </h2>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleExportJson}
              disabled={!card}
              aria-label={t('presentations.governance.exportJson', 'Export JSON')}
              title={t('presentations.governance.exportJson', 'Export JSON')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={12} />
              <span>{t('common.exportJson', 'Export JSON')}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close', 'Close')}
              className="text-slate-600 hover:text-slate-600 dark:hover:text-white p-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8 text-sm text-slate-500 dark:text-slate-400">
              <span className="animate-pulse">
                {t('presentations.governance.loading', 'Loading governance card…')}
              </span>
            </div>
          )}

          {!loading && result && result.status !== 'ok' && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <div className="font-medium">
                {t('presentations.governance.unavailable', 'Governance card unavailable')}
              </div>
              <div className="mt-0.5 text-[12px] opacity-80">
                {result.status === 'forbidden'
                  ? t(
                      'presentations.governance.forbidden',
                      "You don't have permission to view this deck's governance card."
                    )
                  : result.status === 'not_found'
                    ? t(
                        'presentations.governance.notFound',
                        'No governance data found for this deck yet.'
                      )
                    : t('presentations.governance.retry', 'Retry to refresh the data.')}
              </div>
              {result.status !== 'forbidden' && (
                <button
                  type="button"
                  onClick={load}
                  className="mt-2 inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-600 text-white hover:bg-amber-500"
                >
                  {t('common.retry', 'Retry')}
                </button>
              )}
            </div>
          )}

          {!loading && card && (
            <>
              <section
                aria-label={t('presentations.governance.overall', 'Overall verdict')}
                className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/40 px-3 py-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {t('presentations.governance.overall', 'Overall')}
                  </span>
                  <VerdictPill verdict={card.overallVerdict} />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatTimestamp(card.generatedAt)}
                </span>
              </section>

              <section className="space-y-2" aria-label="Quality">
                <header className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('presentations.governance.quality', 'Quality')}
                  </h3>
                  <VerdictPill verdict={card.quality.verdict as GovernanceVerdict} />
                </header>
                <div className="grid grid-cols-3 gap-2">
                  <StatTile label="P0" value={card.quality.p0} tone="rose" />
                  <StatTile label="P1" value={card.quality.p1} tone="amber" />
                  <StatTile label="P2" value={card.quality.p2} tone="slate" />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('presentations.governance.gateCount', 'Total gates: {{n}}', {
                    n: card.quality.gateCount,
                  })}
                </div>
              </section>

              <section className="space-y-2" aria-label="Confidentiality">
                <header className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('presentations.governance.confidentiality', 'Confidentiality')}
                  </h3>
                </header>
                <div className="flex items-center gap-2">
                  {(() => {
                    const level = String(card.confidentiality.level || 'internal');
                    const style = CONFIDENTIALITY_STYLE[level] ?? CONFIDENTIALITY_STYLE.internal;
                    return (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${style.bg} ${style.text}`}
                      >
                        {level}
                      </span>
                    );
                  })()}
                  {typeof card.confidentiality.sharingAllowedForRole === 'string' && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t(
                        'presentations.governance.sharingAllowedForRole',
                        'Sharing for role: {{value}}',
                        {
                          value: card.confidentiality.sharingAllowedForRole,
                        }
                      )}
                    </span>
                  )}
                </div>
              </section>

              <section className="space-y-2" aria-label="Telemetry">
                <header className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    {t('presentations.governance.telemetry', 'Telemetry (last {{n}}d)', {
                      n: card.telemetry.windowDays,
                    })}
                  </h3>
                </header>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <StatTile
                    label={t('presentations.governance.proposals', 'Proposals')}
                    value={card.telemetry.proposalsCreated}
                    tone="amber"
                  />
                  <StatTile
                    label={t('presentations.governance.applied', 'Applied')}
                    value={card.telemetry.editsApplied}
                    tone="emerald"
                  />
                  <StatTile
                    label={t('presentations.governance.rejected', 'Rejected')}
                    value={card.telemetry.editsRejected}
                    tone="slate"
                  />
                  <StatTile
                    label={t('presentations.governance.exportsBlocked', 'Exports blocked')}
                    value={card.telemetry.exportsBlocked}
                    tone="rose"
                  />
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('presentations.governance.lastActivity', 'Last activity:')}{' '}
                  {formatTimestamp(card.telemetry.lastActivityAt)}
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeckGovernanceCardModal;
