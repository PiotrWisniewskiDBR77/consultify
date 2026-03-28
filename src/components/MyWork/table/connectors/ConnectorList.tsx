import {
  Clock,
  History,
  Loader2,
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
  success: {
    bgCls: 'bg-emerald-50 dark:bg-emerald-500/10',
    textCls: 'text-emerald-600 dark:text-emerald-400',
    dotCls: 'bg-emerald-500',
    labelEn: 'Success',
    labelPl: 'Sukces',
  },
  failed: {
    bgCls: 'bg-red-50 dark:bg-red-500/10',
    textCls: 'text-red-600 dark:text-red-400',
    dotCls: 'bg-red-500',
    labelEn: 'Failed',
    labelPl: 'Błąd',
  },
  running: {
    bgCls: 'bg-blue-50 dark:bg-blue-500/10',
    textCls: 'text-blue-600 dark:text-blue-400',
    dotCls: 'bg-blue-500 animate-pulse',
    labelEn: 'Running',
    labelPl: 'W toku',
  },
  never: {
    bgCls: 'bg-slate-100 dark:bg-navy-800',
    textCls: 'text-slate-500 dark:text-slate-400',
    dotCls: 'bg-slate-400',
    labelEn: 'Never run',
    labelPl: 'Nigdy',
  },
} as const;

const StatusBadge: React.FC<{ status: Connector['lastRunStatus']; isPl: boolean }> = ({
  status,
  isPl,
}) => {
  const cfg = statusConfig[status ?? 'never'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${cfg.bgCls} ${cfg.textCls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dotCls}`} />
      {isPl ? cfg.labelPl : cfg.labelEn}
    </span>
  );
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
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-2xl bg-slate-100 dark:bg-navy-800 p-4 mb-4">
          <RefreshCw size={28} className="text-slate-400 dark:text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {isPl ? 'Brak skonfigurowanych konektorów' : 'No connectors configured'}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
          {isPl
            ? 'Połącz zewnętrzne źródła danych, aby automatycznie importować dane do tabeli.'
            : 'Connect external data sources to automatically import data into your table.'}
        </p>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 transition-colors"
        >
          <Plus size={14} />
          {isPl ? 'Dodaj konektor' : 'Add connector'}
        </button>
      </div>
    );
  }

  /* ---- Loading ---- */
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={20} className="animate-spin text-slate-400" />
      </div>
    );
  }

  /* ---- List ---- */
  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
          {isPl ? 'Konektory' : 'Connectors'}{' '}
          <span className="text-slate-400 font-normal">({connectors.length})</span>
        </h3>
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-1 rounded-lg bg-primary-50 dark:bg-primary-500/10 px-2.5 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors"
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
            className="group flex items-center gap-3 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 px-4 py-3 hover:border-slate-300 dark:hover:border-navy-600 transition-colors"
          >
            {/* Icon */}
            <div className="flex-shrink-0">
              <ConnectorIcon type={c.type} size={20} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-800 dark:text-white truncate">
                  {c.name}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {isPl ? meta.labelPl : meta.labelEn}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
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
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              >
                <MoreHorizontal size={16} />
              </button>

              {menuOpen === c.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 shadow-xl py-1">
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
                    <div className="my-1 border-t border-slate-100 dark:border-navy-800" />
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
        ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10'
        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800'
    }`}
  >
    {icon}
    {label}
  </button>
);

export default ConnectorList;
