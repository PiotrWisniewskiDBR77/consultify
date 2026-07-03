/**
 * StatusChangeToast
 *
 * Custom toast component for status changes with cross-module navigation.
 * Shows a toast with a link to view the initiative in its new module.
 */

import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import React from 'react';
import toast, { Toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import {
  getModuleForStatus,
  getStatusMeta,
  ModuleId,
  MODULES,
} from '@/services/initiativeLifecycle';
import { isBetaClosed } from '@/utils/betaAccess';

import { InitiativeStatus } from '../../types';

interface StatusChangeToastProps {
  t: Toast;
  initiativeName: string;
  newStatus: InitiativeStatus;
  previousModule?: ModuleId;
}

export const StatusChangeToast: React.FC<StatusChangeToastProps> = ({
  t,
  initiativeName,
  newStatus,
  previousModule,
}) => {
  const navigate = useNavigate();
  const statusMeta = getStatusMeta(newStatus);
  const newModule = getModuleForStatus(newStatus);
  const moduleConfig = MODULES[newModule];

  const hasModuleChanged =
    previousModule &&
    previousModule !== newModule &&
    !isBetaClosed(moduleConfig.betaModuleId);

  const handleNavigate = () => {
    navigate(moduleConfig.route);
    toast.dismiss(t.id);
  };

  return (
    <div
      className={`${
        t.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-white dark:bg-navy-900 shadow-xl rounded-xl pointer-events-auto ring-1 ring-slate-200 dark:ring-navy-700 overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${statusMeta.bgColor}`}>
            <CheckCircle2 size={20} className={statusMeta.color} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Status updated to {statusMeta.label}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {initiativeName}
            </p>

            {hasModuleChanged && (
              <button
                onClick={handleNavigate}
                className="flex items-center gap-1.5 mt-2 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View in {moduleConfig.name}
                <ArrowRight size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(t.id)}
            className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Show a status change toast with optional navigation
 */
export const showStatusChangeToast = (
  initiativeName: string,
  newStatus: InitiativeStatus,
  previousStatus?: InitiativeStatus
): void => {
  const previousModule = previousStatus ? getModuleForStatus(previousStatus) : undefined;

  toast.custom(
    (t) => (
      <StatusChangeToast
        t={t}
        initiativeName={initiativeName}
        newStatus={newStatus}
        previousModule={previousModule}
      />
    ),
    {
      duration: 5000,
      position: 'bottom-right',
    }
  );
};

export default StatusChangeToast;
