import React from 'react';

import { type FinanceStatementValidation } from '../Economics/financeTypes';

interface Props {
  validations: FinanceStatementValidation[];
  emptyLabel: string;
}

function badgeClass(status: FinanceStatementValidation['status']): string {
  if (status === 'fail') {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300';
  }
  if (status === 'warning') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300';
  }
  return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
}

export const StatementValidationBadges: React.FC<Props> = ({ validations, emptyLabel }) => {
  if (!validations.length) {
    return <div className="text-xs text-slate-500 dark:text-slate-400">{emptyLabel}</div>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {validations.map((validation) => (
        <span
          key={`${validation.checkCode}-${validation.computedAt || ''}`}
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${badgeClass(validation.status)}`}
          title={validation.message || validation.checkName}
        >
          {validation.checkName}
        </span>
      ))}
    </div>
  );
};
