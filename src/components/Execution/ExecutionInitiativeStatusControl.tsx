import React from 'react';
import { useTranslation } from 'react-i18next';

import { EntityStatusChip } from '@/components/ui/primitives/chips';
import { getStatusActions, STATUS_METADATA } from '@/services/initiativeLifecycle';

import { InitiativeStatus } from '../../types';

export interface ExecutionInitiativeStatusControlProps {
  initiativeName: string;
  currentStatus: InitiativeStatus;
  onChange: (nextStatus: InitiativeStatus) => void;
  /** Hides the mutation control while still showing the status chip (e.g. pilot participants). */
  disabled?: boolean;
}

/**
 * Inline status chip + transparent select overlay used by the Execution
 * table's Status column. Extracted from ExecutionHub so it can be mounted
 * and tested on its own instead of the whole 4000+ line hub.
 */
export const ExecutionInitiativeStatusControl: React.FC<ExecutionInitiativeStatusControlProps> = ({
  initiativeName,
  currentStatus,
  onChange,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const meta = STATUS_METADATA[currentStatus];
  const actions = getStatusActions(currentStatus);
  const canMutateStatus = !disabled && actions.length > 0;

  return (
    <div className="relative group">
      <EntityStatusChip
        status={String(currentStatus)}
        label={meta?.label || String(currentStatus)}
      />
      {canMutateStatus && (
        <select
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          value=""
          aria-label={t('execution.table.changeStatusFor', 'Change status for {{name}}', {
            name: initiativeName,
          })}
          onChange={(e) => {
            if (e.target.value) {
              onChange(e.target.value as InitiativeStatus);
            }
          }}
        >
          <option value="">{meta?.label || currentStatus}</option>
          {actions.map((a) => (
            <option key={a.targetStatus} value={a.targetStatus}>
              {a.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
