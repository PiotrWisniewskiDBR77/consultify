/**
 * StatusChangeToast
 *
 * Custom toast component for status changes with cross-module navigation.
 * Shows a toast with a link to view the initiative in its new module.
 */

import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import React from 'react';
import toast, { Toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
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
  t: toastRef,
  initiativeName,
  newStatus,
  previousModule,
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const statusMeta = getStatusMeta(newStatus);
  const newModule = getModuleForStatus(newStatus);
  const moduleConfig = MODULES[newModule];

  const hasModuleChanged =
    previousModule && previousModule !== newModule && !isBetaClosed(moduleConfig.betaModuleId);

  const handleNavigate = () => {
    navigate(moduleConfig.route);
    toast.dismiss(toastRef.id);
  };

  return (
    <div
      className={`${
        toastRef.visible ? 'animate-enter' : 'animate-leave'
      } max-w-md w-full bg-c-surface-raised shadow-xl rounded-xl pointer-events-auto ring-1 ring-c-border overflow-hidden`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${statusMeta.bgColor}`}>
            <CheckCircle2 size={20} className={statusMeta.color} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-c-text">
              {t('statusChangeToast.updatedTo', 'Status updated to {{status}}', {
                status: statusMeta.label,
              })}
            </p>
            <p className="text-xs text-c-text-secondary truncate mt-0.5">{initiativeName}</p>

            {hasModuleChanged && (
              <button
                onClick={handleNavigate}
                className="flex items-center gap-1.5 mt-2 text-xs text-c-accent hover:opacity-80 transition-opacity"
              >
                {t('statusChangeToast.viewIn', 'View in {{module}}', {
                  module: moduleConfig.name,
                })}
                <ArrowRight size={12} />
              </button>
            )}
          </div>
          <button
            onClick={() => toast.dismiss(toastRef.id)}
            className="p-1 text-c-text-secondary hover:text-c-text rounded"
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
