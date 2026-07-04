import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  Eye,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SmartDemoBannerProps {
  sessionStartTime?: Date;
  onUpgradeClick?: () => void;
  onContactSales?: () => void;
  demoEmail?: string;
  aiInteractionsRemaining?: number;
  aiInteractionsLimit?: number;
  isWorkspaceDemo?: boolean;
}

export const SmartDemoBanner: React.FC<SmartDemoBannerProps> = ({
  sessionStartTime = new Date(),
  onUpgradeClick,
  onContactSales,
  demoEmail = 'piotr.wisniewski@demo.com',
  aiInteractionsRemaining,
  aiInteractionsLimit,
  isWorkspaceDemo = false,
}) => {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState('23:59:59');

  // Calculate remaining time (24h session)
  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const elapsed = now.getTime() - sessionStartTime.getTime();
      const remaining = Math.max(0, 24 * 60 * 60 * 1000 - elapsed);

      const hours = Math.floor(remaining / (60 * 60 * 1000));
      const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
      const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

      setTimeRemaining(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  const handleContactSales = () => {
    window.open(
      'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017',
      '_blank'
    );
    onContactSales?.();
  };

  const LIMITATIONS = [
    {
      icon: Eye,
      text: t('demo.banner.limitations.readOnly', "Read-only mode — changes won't persist"),
    },
    {
      icon: Database,
      text: t(
        'demo.banner.limitations.sampleData',
        'Sample data — explore with realistic examples'
      ),
    },
    { icon: Clock, text: t('demo.banner.limitations.session', 'Session expires in 24h') },
    ...(typeof aiInteractionsLimit === 'number'
      ? [
          {
            icon: Sparkles,
            text: t(
              'demo.banner.limitations.aiQuota',
              `AI interactions limited (${aiInteractionsRemaining ?? 0}/${aiInteractionsLimit})`
            ),
          },
        ]
      : []),
  ];

  const DEMO_ORG_NAME = 'Atelier Toys';

  if (isMinimized) {
    return (
      <motion.button
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => setIsMinimized(false)}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-overlay px-4 py-2 bg-navy-800/95 dark:bg-navy-900 text-slate-100 text-sm font-medium rounded-full shadow-lg border border-c-border-subtle hover:border-c-border-subtle transition-all flex items-center gap-2"
      >
        <Sparkles size={16} className="text-primary-400" />
        {t('demo.banner.minimizedLabel', 'Demo')} • {DEMO_ORG_NAME}
        <span className="text-slate-600 font-mono text-xs">{timeRemaining}</span>
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-0 left-0 right-0 z-overlay"
    >
      {/* Main Banner — DBR77: navy base, primary CTA only */}
      <div className="bg-navy-900/95 dark:bg-navy-950 border-b border-c-border-subtle text-slate-100">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            {/* Left: Demo Info */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="font-semibold text-sm">
                  {isWorkspaceDemo
                    ? t('demo.banner.sampleWorkspace', 'Sample Workspace')
                    : t('demo.banner.title', 'Demo Mode')}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-white/70 text-xs">
                <code className="px-2 py-0.5 bg-white/10 rounded font-mono">{demoEmail}</code>
                <span>•</span>
                <span>{t('demo.banner.exploring', 'Exploring with sample data')}</span>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Timer */}
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-lg text-xs font-mono">
                <Clock size={12} className="text-white/70" />
                <span>{timeRemaining}</span>
              </div>

              {/* AI quota */}
              {typeof aiInteractionsLimit === 'number' && (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-lg text-xs font-mono">
                  <Sparkles size={12} className="text-white/70" />
                  <span>
                    {aiInteractionsRemaining ?? 0}/{aiInteractionsLimit}
                  </span>
                </div>
              )}

              {/* Expand/Collapse */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-white/70 hover:text-white transition-colors"
              >
                {isExpanded ? (
                  <>
                    <span className="hidden sm:inline">
                      {t('demo.banner.hideLimitations', 'Hide')}
                    </span>
                    <ChevronUp size={14} />
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">
                      {t('demo.banner.showLimitations', 'Limitations')}
                    </span>
                    <ChevronDown size={14} />
                  </>
                )}
              </button>

              {/* Primary action */}
              <button
                onClick={() => {
                  if (onUpgradeClick) {
                    onUpgradeClick();
                    return;
                  }
                  handleContactSales();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-navy-900 text-primary-700 text-xs font-semibold rounded-lg hover:bg-white/90 transition-colors"
              >
                <Calendar size={12} />
                <span className="hidden sm:inline">
                  {isWorkspaceDemo
                    ? t('demo.banner.backToWorkspace', 'Back to my workspace')
                    : t('demo.banner.getFullAccess', 'Get Full Access')}
                </span>
                <span className="sm:hidden">
                  {isWorkspaceDemo
                    ? t('demo.banner.exitShort', 'Exit')
                    : t('demo.banner.upgrade', 'Upgrade')}
                </span>
                <ArrowRight size={12} />
              </button>

              {/* Minimize */}
              <button
                onClick={() => setIsMinimized(true)}
                className="p-1 text-slate-500 hover:text-slate-200 transition-colors"
                title={t('demo.banner.minimize', 'Minimize')}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-navy-800/80 dark:bg-navy-900/80 border-b border-c-border-subtle overflow-hidden"
          >
            <div className="max-w-7xl mx-auto px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Limitations */}
                <div className="flex flex-wrap items-center gap-6">
                  {LIMITATIONS.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-slate-600 text-xs">
                      <item.icon size={14} className="text-slate-500" />
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                <div className="text-xs text-slate-600">
                  {isWorkspaceDemo
                    ? t(
                        'demo.banner.readyForMoreWorkspace',
                        'Ready to try the same flow in your own workspace?'
                      )
                    : t('demo.banner.readyForMore', 'Ready for your own data?')}{' '}
                  <button
                    onClick={() => onUpgradeClick?.()}
                    className="text-primary-400 hover:text-primary-300 font-medium"
                  >
                    {isWorkspaceDemo
                      ? t('demo.banner.backToWorkspace', 'Back to my workspace')
                      : t('demo.banner.startTrial', 'Start your 7-day trial')}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
