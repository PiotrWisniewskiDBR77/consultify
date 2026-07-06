import {
  Clock,
  History,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState, StatusChip } from '@/components/ui/primitives';

import { ConnectorIcon, connectorMeta } from './ConnectorIcons';
import type { Connector } from './useConnectors';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ConnectorListProps {
  connectors: Connector[];
  isLoading?: boolean;
  onAdd: () => void;
  onEdit: (connector: Connector) => void;
  onDelete: (connector: Connector) => void;
  onRun: (connector: Connector) => void;
  onViewHistory: (connector: Connector) => void;
  isRunning?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Status badge                                                       */
/* ------------------------------------------------------------------ */

const statusConfig = {
  success: { tone: 'success' as const, labelEn: 'Success', labelPl: 'Sukces' },
  failed: { tone: 'danger' as const, labelEn: 'Failed', labelPl: 'Błąd' },
  running: { tone: 'info' as const, labelEn: 'Running', labelPl: 'W toku' },
  never: { tone: 'neutral' as const, labelEn: 'Never run', labelPl: 'Nigdy' },
} as const;

const StatusBadge: React.FC<{ status: Connector['lastRunStatus']; isPl: boolean }> = ({
  status,
  isPl,
}) => {
  const cfg = statusConfig[status ?? 'never'];
  return <StatusChip tone={cfg.tone} label={isPl ? cfg.labelPl : cfg.labelEn} />;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const ConnectorList: React.FC<ConnectorListProps> = ({
  connectors,
  isLoading,
  onAdd,
  onEdit,
  onDelete,
  onRun,
  onViewHistory,
  isRunning,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const formatTime = (iso?: string) => {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString(isPl ? 'pl-PL' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  /* ---- Empty state ---- */
  if (!isLoading && connectors.length === 0) {
    return (
      <EmptyState
        icon={<RefreshCw />}
        title={isPl ? 'Brak skonfigurowanych konektorów' : 'No connectors configured'}
        description={
          isPl
            ? 'Połącz zewnętrzne źródła danych, aby automatycznie importować dane do tabeli.'
            : 'Connect external data sources to automatically import data into your table.'
        }
        action={{
          label: isPl ? 'Dodaj konektor' : 'Add connector',
          onClick: onAdd,
        }}
      />
    );
  }

  /* ---- Loading ---- */
  if (isLoading) {
    return <LoadingState variant="spinner" className="py-12" />;
  }

  /* ---- List ---- */
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-c-text">
          {isPl ? 'Konektory' : 'Connectors'}{' '}
          <span className="text-c-text-secondary font-normal">({connectors.length})</span>
        </h3>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg bg-c-accent-soft px-2.5 py-1.5 text-xs font-medium text-c-accent hover:bg-c-accent-soft transition-colors"
        >
          <Plus size={12} />
          {isPl ? 'Dodaj' : 'Add'}
        </button>
      </div>

      {/* Rows */}
      {connectors.map((c) => {
        const meta = connectorMeta[c.type];
        return (
          <div
            key={c.id}
            className="group flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-4 py-3 hover:border-c-border-subtle transition-colors"
          >
            {/* Icon */}
            <div className="flex-shrink-0">
              <ConnectorIcon type={c.type} size={20} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-c-text truncate">
                  {c.name}
                </span>
                <span className="text-[11px] text-c-text-muted">
                  {isPl ? meta.labelPl : meta.labelEn}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-c-text-muted">
                <span>
                  {isPl ? 'Ostatni:' : 'Last:'} {formatTime(c.lastRunAt)}
                </span>
                {c.schedule && (
                  <span className="inline-flex items-center gap-1">
                    <Clock size={10} />
                    {c.schedule.interval}
                  </span>
                )}
              </div>
            </div>

            {/* Status */}
            <StatusBadge status={c.lastRunStatus} isPl={!!isPl} />

            {/* Actions */}
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}
                className="p-1.5 rounded-lg text-c-text-secondary hover:text-c-text-muted hover:bg-c-surface-raised transition-colors"
              >
                <MoreHorizontal size={16} />
              </button>

              {menuOpen === c.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl py-1">
                    <MenuBtn
                      icon={<Play size={13} />}
                      label={isPl ? 'Uruchom teraz' : 'Run now'}
                      onClick={() => {
                        setMenuOpen(null);
                        onRun(c);
                      }}
                    />
                    <MenuBtn
                      icon={<History size={13} />}
                      label={isPl ? 'Historia' : 'History'}
                      onClick={() => {
                        setMenuOpen(null);
                        onViewHistory(c);
                      }}
                    />
                    <MenuBtn
                      icon={<Pencil size={13} />}
                      label={isPl ? 'Edytuj' : 'Edit'}
                      onClick={() => {
                        setMenuOpen(null);
                        onEdit(c);
                      }}
                    />
                    <div className="my-1 border-t border-c-border-subtle" />
                    <MenuBtn
                      icon={<Trash2 size={13} />}
                      label={isPl ? 'Usuń' : 'Delete'}
                      danger
                      onClick={() => {
                        setMenuOpen(null);
                        onDelete(c);
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Menu button                                                        */
/* ------------------------------------------------------------------ */

const MenuBtn: React.FC<{
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}> = ({ icon, label, danger, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium transition-colors ${
      danger
        ? 'text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-500/10'
        : 'text-c-text-muted hover:bg-c-surface-raised'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default ConnectorList;
