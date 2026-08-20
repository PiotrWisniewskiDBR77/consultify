import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { type FinanceStatementValidation } from '../Economics/financeTypes';

interface Props {
  validations: FinanceStatementValidation[];
  emptyLabel: string;
}

const STATUS_CONFIG: Record<
  FinanceStatementValidation['status'],
  { bg: string; text: string; icon: React.ReactNode }
> = {
  fail: {
    bg: 'bg-danger-50 border-danger-200/60 dark:bg-danger-500/10 dark:border-danger-500/20',
    text: 'text-danger-700 dark:text-danger-300',
    icon: <XCircle size={11} className="text-danger-500 flex-shrink-0" />,
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200/60 dark:bg-amber-500/10 dark:border-amber-500/20',
    text: 'text-amber-700 dark:text-amber-300',
    icon: <AlertTriangle size={11} className="text-amber-500 flex-shrink-0" />,
  },
  pass: {
    bg: 'bg-emerald-50 border-emerald-200/60 dark:bg-emerald-500/10 dark:border-emerald-500/20',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" />,
  },
};

export const StatementValidationBadges: React.FC<Props> = ({ validations, emptyLabel }) => {
  const { t } = useTranslation();
  if (!validations.length) {
    if (!emptyLabel) return null;
    return <div className="text-xs text-slate-500 dark:text-slate-400">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-wrap gap-1.5" role="list" aria-label="Validation results">
      {validations.map((validation) => {
        const cfg = STATUS_CONFIG[validation.status] || STATUS_CONFIG.pass;
        const localizedName = t(
          `finance.pack.validation.${validation.checkCode}`,
          validation.checkName
        );
        return (
          <span
            key={`${validation.checkCode}-${validation.computedAt || ''}`}
            role="listitem"
            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium ${cfg.bg} ${cfg.text}`}
            title={validation.message || localizedName}
          >
            {cfg.icon}
            {localizedName}
          </span>
        );
      })}
    </div>
  );
};
