/**
 * DeadlineAlertBanner
 * Shows deadline warnings based on due date proximity
 * Professional alert design with urgency levels
 */

import { motion } from 'framer-motion';
import { AlertTriangle, CalendarClock, CheckCircle2, Clock, XCircle } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface DeadlineAlertBannerProps {
  dueDate: string | null;
  status: string;
  onExtendRequest?: () => void;
}

type UrgencyLevel = 'overdue' | 'critical' | 'warning' | 'approaching' | 'ok' | 'none';

export const DeadlineAlertBanner: React.FC<DeadlineAlertBannerProps> = ({
  dueDate,
  status,
  onExtendRequest,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const { urgency, daysRemaining, message } = useMemo(() => {
    // If no due date or decision is already made, no alert needed
    if (!dueDate || status !== 'pending') {
      return { urgency: 'none' as UrgencyLevel, daysRemaining: null, message: '' };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let urgency: UrgencyLevel;
    let message: string;

    if (diffDays < 0) {
      urgency = 'overdue';
      const overdueDays = Math.abs(diffDays);
      message = isPolish
        ? `Termin minął ${overdueDays} ${overdueDays === 1 ? 'dzień' : 'dni'} temu!`
        : `Overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}!`;
    } else if (diffDays === 0) {
      urgency = 'critical';
      message = t('myWork.deadlineAlert.dueToday', 'Due today!');
    } else if (diffDays === 1) {
      urgency = 'critical';
      message = t('myWork.deadlineAlert.dueTomorrow', 'Due tomorrow!');
    } else if (diffDays <= 3) {
      urgency = 'warning';
      message = isPolish ? `Pozostały ${diffDays} dni do terminu` : `${diffDays} days remaining`;
    } else if (diffDays <= 7) {
      urgency = 'approaching';
      message = isPolish
        ? `Pozostało ${diffDays} dni do terminu`
        : `${diffDays} days until deadline`;
    } else {
      urgency = 'ok';
      message = '';
    }

    return { urgency, daysRemaining: diffDays, message };
  }, [dueDate, status, isPolish]);

  // Don't render if no urgency or OK
  if (urgency === 'none' || urgency === 'ok') {
    return null;
  }

  // Configuration for each urgency level
  const config: Record<
    Exclude<UrgencyLevel, 'none' | 'ok'>,
    {
      bgColor: string;
      borderColor: string;
      textColor: string;
      icon: typeof AlertTriangle;
      iconColor: string;
      pulse: boolean;
    }
  > = {
    overdue: {
      bgColor: 'bg-danger-50 dark:bg-danger-500/10',
      borderColor: 'border-danger-200 dark:border-danger-500/30',
      textColor: 'text-danger-700 dark:text-danger-400',
      icon: XCircle,
      iconColor: 'text-danger-500',
      pulse: true,
    },
    critical: {
      bgColor: 'bg-danger-50 dark:bg-danger-500/10',
      borderColor: 'border-danger-200 dark:border-danger-500/30',
      textColor: 'text-danger-700 dark:text-danger-400',
      icon: AlertTriangle,
      iconColor: 'text-danger-500',
      pulse: true,
    },
    warning: {
      bgColor: 'bg-amber-50 dark:bg-amber-500/10',
      borderColor: 'border-amber-200 dark:border-amber-500/30',
      textColor: 'text-amber-700 dark:text-amber-400',
      icon: Clock,
      iconColor: 'text-amber-500',
      pulse: false,
    },
    approaching: {
      bgColor: 'bg-blue-50 dark:bg-blue-500/10',
      borderColor: 'border-blue-200 dark:border-blue-500/30',
      textColor: 'text-blue-700 dark:text-blue-400',
      icon: CalendarClock,
      iconColor: 'text-blue-500',
      pulse: false,
    },
  };

  const currentConfig = config[urgency as keyof typeof config];
  const Icon = currentConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10, height: 0 }}
      animate={{ opacity: 1, y: 0, height: 'auto' }}
      exit={{ opacity: 0, y: -10, height: 0 }}
      className={`rounded-xl border ${currentConfig.bgColor} ${currentConfig.borderColor} overflow-hidden`}
    >
      <div className="px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <motion.div
            animate={
              currentConfig.pulse
                ? {
                    scale: [1, 1.1, 1],
                    opacity: [1, 0.8, 1],
                  }
                : {}
            }
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <Icon size={20} className={currentConfig.iconColor} />
          </motion.div>
          <div>
            <p className={`text-sm font-semibold ${currentConfig.textColor}`}>{message}</p>
            {urgency === 'overdue' && (
              <p className="text-xs text-danger-600/70 dark:text-danger-400/70 mt-0.5">
                {t(
                  'myWork.deadlineAlert.thisDecisionRequiresImmediate',
                  'This decision requires immediate attention'
                )}
              </p>
            )}
          </div>
        </div>

        {/* Countdown/Overdue badge */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
            urgency === 'overdue'
              ? 'bg-danger-100 dark:bg-danger-500/20'
              : urgency === 'critical'
                ? 'bg-danger-100 dark:bg-danger-500/20'
                : urgency === 'warning'
                  ? 'bg-amber-100 dark:bg-amber-500/20'
                  : 'bg-blue-100 dark:bg-blue-500/20'
          }`}
        >
          <Clock size={14} className={currentConfig.iconColor} />
          <span className={`text-sm font-bold ${currentConfig.textColor}`}>
            {urgency === 'overdue'
              ? `${Math.abs(daysRemaining!)}d ${t('myWork.deadlineAlert.overdue', 'overdue')}`
              : daysRemaining === 0
                ? t('myWork.deadlineAlert.today', 'Today')
                : `${daysRemaining}d`}
          </span>
        </div>
      </div>

      {/* Progress bar showing time elapsed */}
      {urgency !== 'overdue' && daysRemaining !== null && (
        <div className="h-1 bg-slate-200/50 dark:bg-navy-700/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{
              width: `${Math.max(0, Math.min(100, ((7 - daysRemaining) / 7) * 100))}%`,
            }}
            transition={{ duration: 0.5 }}
            className={`h-full ${
              urgency === 'critical'
                ? 'bg-danger-500'
                : urgency === 'warning'
                  ? 'bg-amber-500'
                  : 'bg-blue-500'
            }`}
          />
        </div>
      )}
    </motion.div>
  );
};

export default DeadlineAlertBanner;
