/**
 * MW-DEC-001 — read-only audit history for one decision, sourced from
 * `decision_history` via GET /api/decisions/:id/detail (`auditTrail`).
 * Purely presentational: renders exactly what the server returned, in the
 * order the server returned it (chronological ASC).
 */
import { History } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { DecisionHistoryEntryDTO } from './types';
import { formatDateTime } from './workspaceHelpers';

export interface DecisionAuditTrailProps {
  entries: DecisionHistoryEntryDTO[];
}

export const DecisionAuditTrail: React.FC<DecisionAuditTrailProps> = ({ entries }) => {
  const { t } = useTranslation();

  if (entries.length === 0) {
    return (
      <div className="text-xs text-c-text-muted italic py-2">
        {t('myWork.decisionWorkspace.audit.empty', 'No history yet.')}
      </div>
    );
  }

  return (
    <ol className="space-y-2.5">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-2.5 text-xs">
          <div className="mt-0.5 shrink-0 text-c-text-muted">
            <History size={13} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="font-medium text-c-text">
                {entry.userName ||
                  t('myWork.decisionWorkspace.audit.unknownActor', 'Unknown user')}
              </span>
              <span className="text-c-text-muted">
                {entry.oldStatus && entry.newStatus && entry.oldStatus !== entry.newStatus
                  ? t('myWork.decisionWorkspace.audit.statusChange', '{{action}}: {{from}} → {{to}}', {
                      action: entry.action,
                      from: entry.oldStatus,
                      to: entry.newStatus,
                    })
                  : entry.action}
              </span>
              <span className="text-c-text-muted">·</span>
              <span className="text-c-text-muted">{formatDateTime(entry.at)}</span>
            </div>
            {entry.notes ? (
              <div className="mt-0.5 text-c-text-secondary">{entry.notes}</div>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
};

export default DecisionAuditTrail;
