/**
 * Locked Framework Overlay — shown when org lacks entitlement for a framework.
 */
import { ArrowRight, Lock, ShieldCheck } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { FrameworkId } from '@/services/frameworkRegistry';
import { FRAMEWORK_CONFIGS } from '@/services/frameworkRegistry';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

interface LockedFrameworkOverlayProps {
  frameworkId: FrameworkId;
  reason?: string;
  upgradeCTA?: string;
  onRequestAccess?: () => void;
  onBack?: () => void;
}

const LockedFrameworkOverlay: React.FC<LockedFrameworkOverlayProps> = ({
  frameworkId,
  reason,
  upgradeCTA,
  onRequestAccess,
  onBack,
}) => {
  const { t } = useTranslation();
  const config = FRAMEWORK_CONFIGS[frameworkId];

  React.useEffect(() => {
    trackFunnelEvent('licensed_tool_locked_viewed', { framework: frameworkId, reason });
  }, [frameworkId, reason]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-8">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-navy-800 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-slate-600 dark:text-slate-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          {config?.fullName || frameworkId}
        </h2>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm font-medium mb-4">
          <ShieldCheck size={14} />
          {t('licensedTools.locked', 'Licensed — Access Required')}
        </div>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          {reason ||
            t(
              'licensedTools.lockedReason',
              'Your organization does not have access to this framework. Upgrade your plan or contact your administrator to unlock it.'
            )}
        </p>
        <div className="space-y-3">
          <button
            onClick={() => {
              trackFunnelEvent('licensed_tool_unlock_cta_clicked', { framework: frameworkId });
              onRequestAccess?.();
            }}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-primary-600 text-white font-medium rounded-xl hover:from-blue-600 hover:to-primary-700 transition-all shadow-lg"
          >
            <ArrowRight size={18} />
            {upgradeCTA || t('licensedTools.requestAccess', 'Request Access / Upgrade')}
          </button>
          {onBack && (
            <button
              onClick={onBack}
              className="w-full px-6 py-2.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
            >
              {t('common.goBack', 'Go Back')}
            </button>
          )}
        </div>
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-white/10">
          <p className="text-xs text-slate-500">
            {config?.legalNoticeType === 'proprietary'
              ? t(
                  'licensedTools.proprietaryNote',
                  'This is a proprietary framework requiring a paid license.'
                )
              : t(
                  'licensedTools.educationalNote',
                  'This framework is available for educational purposes.'
                )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default LockedFrameworkOverlay;
