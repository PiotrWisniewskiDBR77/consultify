import React, { useState } from 'react';
import { AlertTriangle, BadgeCheck, ChevronRight, Clock, Database, FileSpreadsheet, FormInput, Link2, ShieldCheck, Webhook, X } from 'lucide-react';
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

const TRUST_STYLES: Record<string, { bg: string; color: string; icon: React.ReactNode; label: string; labelPl: string }> = {
  certified: {
    bg: '#dcfce7', color: '#166534',
    icon: <BadgeCheck size={10} />,
    label: 'Certified', labelPl: 'Certyfikowany',
  },
  unverified: {
    bg: '#fef3c7', color: '#92400e',
    icon: <AlertTriangle size={10} />,
    label: 'Unverified', labelPl: 'Niezweryfikowany',
  },
  deprecated: {
    bg: '#fee2e2', color: '#991b1b',
    icon: <AlertTriangle size={10} />,
    label: 'Deprecated', labelPl: 'Wycofany',
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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [showChain, setShowChain] = useState(false);

  if (!source) return null;

  const label = connectorName || SOURCE_LABELS[source] || source;
  const timeAgo = syncedAt ? formatTimeAgo(new Date(syncedAt)) : '';
  const effectiveTrust = trustLevel ?? (trusted === true ? 'certified' : trusted === false ? 'unverified' : undefined);
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
            ? '#fef3c7'
            : trustStyle
              ? trustStyle.bg
              : '#e0f2fe',
          color: manuallyOverridden
            ? '#92400e'
            : trustStyle
              ? trustStyle.color
              : '#0369a1',
          cursor: hasChain ? 'pointer' : 'default',
        }}
        title={titleParts.join(' \u2022 ')}
      >
        {/* Source icon */}
        {sourceIcon(source)}

        {/* Trust indicator */}
        {trustStyle && (
          <span style={{ color: trustStyle.color }}>{trustStyle.icon}</span>
        )}

        {/* Legacy trust icon for backward compat */}
        {!trustStyle && trusted !== undefined && (
          <ShieldCheck
            size={10}
            style={{ color: trusted ? '#16a34a' : '#d97706' }}
          />
        )}

        {manuallyOverridden && <span className="text-[9px]">&#9998;</span>}

        <span className="max-w-[80px] truncate">{label}</span>

        {timeAgo && (
          <span className="opacity-60 text-[9px]">{timeAgo}</span>
        )}

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
          className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-navy-700">
            <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
              {isPl ? 'Łańcuch pochodzenia' : 'Provenance Chain'}
            </span>
            <button
              onClick={() => setShowChain(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={10} />
            </button>
          </div>
          <div className="px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
            {provenanceChain!.map((step, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex flex-col items-center">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0"
                    style={{
                      backgroundColor:
                        step.type === 'connector' ? '#6366f1' :
                        step.type === 'run' ? '#3b82f6' :
                        step.type === 'import' ? '#10b981' :
                        step.type === 'form' ? '#f59e0b' :
                        step.type === 'manual' ? '#94a3b8' :
                        '#8b5cf6',
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
                    <div className="w-px h-3 bg-slate-200 dark:bg-navy-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-1">
                  <p className="text-[10px] font-medium text-slate-700 dark:text-slate-200 truncate">
                    {step.label}
                  </p>
                  {step.detail && (
                    <p className="text-[9px] text-slate-400 truncate">{step.detail}</p>
                  )}
                  {step.timestamp && (
                    <p className="text-[9px] text-slate-400">
                      {formatTimeAgo(new Date(step.timestamp))}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {(connectorRunId || recordId) && (
            <div className="px-3 py-1.5 border-t border-slate-100 dark:border-navy-700 text-[9px] text-slate-400 space-y-0.5">
              {connectorRunId && <p>Run: {connectorRunId.slice(0, 12)}…</p>}
              {recordId && <p>Record: {recordId.slice(0, 12)}…</p>}
            </div>
          )}
        </div>
      )}
    </span>
  );
};

export default ProvenanceBadge;
