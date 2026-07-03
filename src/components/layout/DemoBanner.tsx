import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  ExternalLink,
  Eye,
  Info,
  Sparkles,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '../../store/useAppStore';

/**
 * DemoBanner — Demo Session Indicator
 *
 * Shows when user is logged in as a demo user
 * Provides link to contact sales for commercial access
 */

interface DemoBannerProps {
  onStartTrialClick?: () => void;
}

const DemoBanner: React.FC<DemoBannerProps> = ({ onStartTrialClick }) => {
  const { t } = useTranslation();
  const { currentOrganization, demoOrganization, isDemoMode } = useAppStore();
  const [showLimitations, setShowLimitations] = useState(false);

  const DEMO_LIMITATIONS = [
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
  ];

  const handleContactSales = () => {
    window.open(
      'https://meetings.hubspot.com/piotr-wisniewski1?uuid=a2976570-a2d2-4682-9e5f-c3958a7af017',
      '_blank'
    );
  };

  const activeOrgName =
    demoOrganization?.name || currentOrganization?.name || t('common.organization', 'Organization');
  const activeOrgId = demoOrganization?.id || currentOrganization?.id || null;

  return (
    <div
      data-tour="demo-banner"
      className="bg-navy-900/95 dark:bg-navy-950 border-b border-white/5 text-slate-100 relative z-50"
    >
      {/* Main Banner — DBR77 */}
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-sm font-medium">
          <div className="flex items-center gap-2 bg-navy-800/50 px-2 py-1 rounded border border-white/5">
            <Sparkles size={14} className="text-primary-400" />
            <span className="font-bold tracking-wide uppercase text-slate-200 text-xs">
              {t('demo.banner.mode', 'Demo')}
            </span>
          </div>
          <span className="text-slate-600">
            <span className="font-medium text-slate-200">{activeOrgName}</span>
            {activeOrgId ? (
              <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-slate-600">
                {activeOrgId}
              </span>
            ) : null}
            <span className="ml-2 hidden sm:inline">
              {isDemoMode
                ? t(
                    'demo.banner.descriptionActive',
                    'Demo mode is overriding the active organization context'
                  )
                : t('demo.banner.description', 'Exploring sample data')}
            </span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLimitations(!showLimitations)}
            className="flex items-center gap-1 text-xs text-slate-600 hover:text-slate-200 transition-colors"
          >
            <AlertCircle size={14} />
            <span className="hidden sm:inline">
              {t('demo.banner.showLimitations', 'Limitations')}
            </span>
            {showLimitations ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <button
            data-tour="demo-exit"
            onClick={onStartTrialClick || handleContactSales}
            className="bg-primary-500 hover:bg-primary-600 text-white text-xs px-3 py-1.5 rounded-lg transition-colors font-semibold flex items-center gap-1.5"
          >
            {t('demo.banner.startTrial', 'Start Trial')}
            <ExternalLink size={14} />
          </button>
        </div>
      </div>

      {/* Expanded Limitations */}
      {showLimitations && (
        <div className="px-4 py-3 bg-navy-800/60 border-t border-white/5">
          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-600">
            {DEMO_LIMITATIONS.map((limitation, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <limitation.icon size={14} className="text-slate-500" />
                <span>{limitation.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DemoBanner;
