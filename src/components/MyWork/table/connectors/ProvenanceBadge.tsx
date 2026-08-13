/**
 * ProvenanceBadge — Data-source provenance indicator for MyWork table rows.
 *
 * This component displays where a **data record** was synced from (CSV, Jira,
 * Google Sheets, webhooks, etc.) and its trust/verification level at the
 * connector/import layer.
 *
 * NOT related to P18 artifact lifecycle trust-state (source/run/stage/
 * visibility/export_ledger). P18 trust-state is served by
 * `GET /api/artifacts/:id/trust-state` and rendered by the Outputs Library
 * preview (`TrustStatePreviewSection`). The naming overlap is intentional —
 * both concepts address "where did this come from" but at different layers:
 * - ProvenanceBadge → data-record import/sync origin
 * - P18 trust-state → artifact lifecycle governance grammar
 */
import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  Clock,
  Database,
  FileSpreadsheet,
  FormInput,
  Link2,
  ShieldCheck,
  Webhook,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ProvenanceChainStep {
  type: 'connector' | 'run' | 'record' | 'import' | 'form' | 'manual';
  label: string;
  timestamp?: string;
  detail?: string;
}

interface ProvenanceBadgeProps {
  source?: string;
  syncedAt?: string;
  manuallyOverridden?: boolean;
  connectorName?: string;
  trusted?: boolean;
  trustLevel?: 'certified' | 'unverified' | 'deprecated';
  lastVerifiedAt?: string;
  connectorRunId?: string;
  recordId?: string;
  provenanceChain?: ProvenanceChainStep[];
}

const SOURCE_LABELS: Record<string, string> = {
  csv: 'CSV Import',
  csv_xlsx: 'CSV/XLSX',
  jira: 'Jira',
  google_sheets: 'Google Sheets',
  airtable: 'Airtable',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  webhook: 'Webhook',
  manual: 'Manual',
  form: 'Form',
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function sourceIcon(source: string) {
  switch (source) {
    case 'csv':
    case 'csv_xlsx':
      return <FileSpreadsheet size={10} />;
    case 'webhook':
      return <Webhook size={10} />;
    case 'form':
      return <FormInput size={10} />;
    case 'manual':
      return <Database size={10} />;
    default:
      return <Link2 size={10} />;
  }
}

const TRUST_STYLES: Record<
  string,
  { bg: string; color: string; icon: React.ReactNode; label: string; labelPl: string }
> = {
  certified: {
    bg: 'color-mix(in srgb, var(--c-success) 15%, transparent)',
    color: 'var(--c-success)',
    icon: <BadgeCheck size={10} />,
    label: 'Certified',
    labelPl: 'Certyfikowany',
  },
  unverified: {
    bg: 'color-mix(in srgb, var(--c-warning) 15%, transparent)',
    color: 'var(--c-warning)',
    icon: <AlertTriangle size={10} />,
    label: 'Unverified',
    labelPl: 'Niezweryfikowany',
  },
  deprecated: {
    bg: 'color-mix(in srgb, var(--c-danger) 15%, transparent)',
    color: 'var(--c-danger)',
    icon: <AlertTriangle size={10} />,
    label: 'Deprecated',
    labelPl: 'Wycofany',
  },
};

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  source,
  syncedAt,
  manuallyOverridden,
  connectorName,
  trusted,
  trustLevel,
  lastVerifiedAt,
  connectorRunId,
  recordId,
  provenanceChain,
}) => {
  const { t } = useTranslation();
  const [showChain, setShowChain] = useState(false);

  if (!source) return null;

  const label = connectorName || SOURCE_LABELS[source] || source;
  const timeAgo = syncedAt ? formatTimeAgo(new Date(syncedAt)) : '';
  const effectiveTrust =
    trustLevel ?? (trusted === true ? 'certified' : trusted === false ? 'unverified' : undefined);
  const trustStyle = effectiveTrust ? TRUST_STYLES[effectiveTrust] : null;

  const titleParts = [`Synced from ${label}`];
  if (timeAgo) titleParts.push(timeAgo);
  if (manuallyOverridden) titleParts.push('Manually overridden');
  if (effectiveTrust) titleParts.push(trustStyle?.label ?? effectiveTrust);
  if (lastVerifiedAt) titleParts.push(`Verified ${formatTimeAgo(new Date(lastVerifiedAt))}`);

  const hasChain = provenanceChain && provenanceChain.length > 0;

  return (
    <span className="relative inline-flex items-center">
      <button
        onClick={(e) => {
          e.stopPropagation();
          if (hasChain) setShowChain(!showChain);
        }}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium transition-colors hover:opacity-80"
        style={{
          backgroundColor: manuallyOverridden
            ? 'color-mix(in srgb, var(--c-warning) 15%, transparent)'
            : trustStyle
              ? trustStyle.bg
              : 'color-mix(in srgb, var(--c-info) 15%, transparent)',
          color: manuallyOverridden
            ? 'var(--c-warning)'
            : trustStyle
              ? trustStyle.color
              : 'var(--c-info)',
          cursor: hasChain ? 'pointer' : 'default',
        }}
        title={titleParts.join(' \u2022 ')}
      >
        {/* Source icon */}
        {sourceIcon(source)}

        {/* Trust indicator */}
        {trustStyle && <span style={{ color: trustStyle.color }}>{trustStyle.icon}</span>}

        {/* Legacy trust icon for backward compat */}
        {!trustStyle && trusted !== undefined && (
          <ShieldCheck
            size={10}
            style={{ color: trusted ? 'var(--c-success)' : 'var(--c-warning)' }}
          />
        )}

        {manuallyOverridden && <span className="text-[9px]">&#9998;</span>}

        <span className="max-w-[80px] truncate">{label}</span>

        {timeAgo && <span className="opacity-60 text-[9px]">{timeAgo}</span>}

        {lastVerifiedAt && (
          <span className="opacity-50 text-[9px] flex items-center gap-0.5">
            <Clock size={8} />
            {formatTimeAgo(new Date(lastVerifiedAt))}
          </span>
        )}

        {hasChain && (
          <ChevronRight
            size={9}
            className={`transition-transform ${showChain ? 'rotate-90' : ''}`}
          />
        )}
      </button>

      {/* Provenance chain popover */}
      {showChain && hasChain && (
        <div
          className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-c-border-subtle">
            <span className="text-[10px] font-semibold text-c-text-muted uppercase tracking-wider">
              {t('ideas.table.provenanceChain', 'Provenance Chain')}
            </span>
            <button
              onClick={() => setShowChain(false)}
              className="text-c-text-secondary hover:text-c-text-secondary"
            >
              <X size={10} />
            </button>
          </div>
          <div className="px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
            {provenanceChain!.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex flex-col items-center">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-c-text shrink-0"
                    style={{
                      backgroundColor:
                        step.type === 'connector'
                          ? 'var(--c-tag-2)'
                          : step.type === 'run'
                            ? 'var(--c-tag-1)'
                            : step.type === 'import'
                              ? 'var(--c-tag-6)'
                              : step.type === 'form'
                                ? 'var(--c-tag-9)'
                                : step.type === 'manual'
                                  ? 'var(--c-tag-8)'
                                  : 'var(--c-tag-2)',
                    }}
                  >
                    {step.type === 'connector' && <Link2 size={9} />}
                    {step.type === 'run' && <Clock size={9} />}
                    {step.type === 'record' && <Database size={9} />}
                    {step.type === 'import' && <FileSpreadsheet size={9} />}
                    {step.type === 'form' && <FormInput size={9} />}
                    {step.type === 'manual' && <Database size={9} />}
                  </div>
                  {idx < provenanceChain!.length - 1 && (
                    <div className="w-px h-3 bg-c-surface-raised" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-[10px] font-medium text-c-text truncate">{step.label}</p>
                  {step.detail && (
                    <p className="text-[9px] text-c-text-secondary truncate">{step.detail}</p>
                  )}
                  {step.timestamp && (
                    <p className="text-[9px] text-c-text-secondary">
                      {formatTimeAgo(new Date(step.timestamp))}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {(connectorRunId || recordId) && (
            <div className="px-3 py-1.5 border-t border-c-border-subtle text-[9px] text-c-text-secondary space-y-0.5">
              {connectorRunId && (
                <p>
                  {t('ideas.table.provenanceRunId', 'Run: {{id}}…', {
                    id: connectorRunId.slice(0, 12),
                  })}
                </p>
              )}
              {recordId && (
                <p>
                  {t('ideas.table.provenanceRecordId', 'Record: {{id}}…', {
                    id: recordId.slice(0, 12),
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </span>
  );
};

export default ProvenanceBadge;
