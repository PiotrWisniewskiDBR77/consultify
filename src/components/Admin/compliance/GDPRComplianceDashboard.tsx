/**
 * GDPRComplianceDashboard - GDPR compliance management component
 *
 * Features:
 * - Toggle: "Enable GDPR Compliance" (OFF/ON)
 * - "What will happen?" expandable section
 * - Auto-features checklist
 * - Status indicators (configured/needs setup)
 * - Configure links
 *
 * Design: HubSpot-style compliance dashboard with impact statement
 */

import {
  AlertCircle,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  Link,
  Lock,
  Mail,
  MessageSquare,
  Shield,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Tooltip } from '../../ui/primitives/Tooltip';

export interface GDPRFeature {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  enabled: boolean;
  configured: boolean;
  configureUrl?: string;
}

export interface GDPRConfig {
  enabled: boolean;
  features: GDPRFeature[];
  lastUpdated?: string;
  updatedBy?: string;
}

interface GDPRComplianceDashboardProps {
  config: GDPRConfig;
  onChange: (enabled: boolean) => void;
  onConfigureFeature?: (featureId: string) => void;
  className?: string;
}

export const GDPRComplianceDashboard: React.FC<GDPRComplianceDashboardProps> = ({
  config,
  onChange,
  onConfigureFeature,
  className,
}) => {
  const { t } = useTranslation();
  const [showImpact, setShowImpact] = useState(false);
  const [enabling, setEnabling] = useState(false);

  // Default GDPR features
  const defaultFeatures: GDPRFeature[] = [
    {
      id: 'privacy-forms',
      name: t('admin.compliance.gdpr.features.privacyForms', 'Privacy sections in forms'),
      description: t(
        'admin.compliance.gdpr.features.privacyFormsDesc',
        'Add consent checkboxes and privacy notices to all data collection forms'
      ),
      icon: FileText,
      enabled: config.enabled,
      configured: true,
    },
    {
      id: 'privacy-meetings',
      name: t('admin.compliance.gdpr.features.privacyMeetings', 'Privacy sections in meetings'),
      description: t(
        'admin.compliance.gdpr.features.privacyMeetingsDesc',
        'Include recording consent and data processing notices in meeting invites'
      ),
      icon: Users,
      enabled: config.enabled,
      configured: true,
    },
    {
      id: 'unsubscribe-links',
      name: t('admin.compliance.gdpr.features.unsubscribeLinks', 'Unsubscribe links in emails'),
      description: t(
        'admin.compliance.gdpr.features.unsubscribeLinksDesc',
        'Automatically add unsubscribe links to all marketing and notification emails'
      ),
      icon: Mail,
      enabled: config.enabled,
      configured: true,
    },
    {
      id: 'data-retention',
      name: t('admin.compliance.gdpr.features.dataRetention', 'Automatic data retention'),
      description: t(
        'admin.compliance.gdpr.features.dataRetentionDesc',
        'Automatically delete or anonymize data after the configured retention period'
      ),
      icon: Lock,
      enabled: config.enabled,
      configured: false,
    },
    {
      id: 'consent-tracking',
      name: t('admin.compliance.gdpr.features.consentTracking', 'Consent tracking'),
      description: t(
        'admin.compliance.gdpr.features.consentTrackingDesc',
        'Track and store consent records for all data processing activities'
      ),
      icon: CheckCircle,
      enabled: config.enabled,
      configured: false,
    },
    {
      id: 'data-export',
      name: t('admin.compliance.gdpr.features.dataExport', 'Data portability'),
      description: t(
        'admin.compliance.gdpr.features.dataExportDesc',
        'Allow users to export their personal data in machine-readable format'
      ),
      icon: FileText,
      enabled: config.enabled,
      configured: true,
    },
  ];

  const features = config.features.length > 0 ? config.features : defaultFeatures;

  // Calculate compliance status
  const configuredCount = features.filter((f) => f.configured).length;
  const totalFeatures = features.length;
  const compliancePercentage = Math.round((configuredCount / totalFeatures) * 100);

  // Handle toggle
  const handleToggle = useCallback(async () => {
    setEnabling(true);
    try {
      onChange(!config.enabled);
    } finally {
      setEnabling(false);
    }
  }, [config.enabled, onChange]);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Main Card */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <ShieldCheck size={24} className="text-c-text" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-navy-900 dark:text-white flex items-center gap-2">
                {t('admin.compliance.gdpr.title', 'GDPR Compliance')}
                <Tooltip
                  content={t(
                    'admin.compliance.gdpr.tooltip',
                    'General Data Protection Regulation - EU data privacy standard'
                  )}
                >
                  <HelpCircle size={16} className="text-slate-400 dark:text-slate-500" />
                </Tooltip>
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('admin.compliance.gdpr.subtitle', 'Manage data privacy compliance for EU users')}
              </p>
            </div>
          </div>

          {/* Toggle */}
          <div className="flex items-center gap-3">
            <span
              className={cn(
                'text-sm font-medium',
                config.enabled
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              )}
            >
              {config.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              onClick={handleToggle}
              disabled={enabling}
              className={cn(
                'relative w-14 h-7 rounded-full transition-colors',
                config.enabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-navy-700',
                enabling && 'opacity-50 cursor-wait'
              )}
            >
              <span
                className={cn(
                  'absolute top-1 w-5 h-5 bg-white dark:bg-navy-900 rounded-full shadow transition-transform',
                  config.enabled ? 'left-8' : 'left-1'
                )}
              />
            </button>
          </div>
        </div>

        {/* What will happen? */}
        <div className="mb-6">
          <button
            onClick={() => setShowImpact(!showImpact)}
            className="flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            {showImpact ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {t('admin.compliance.gdpr.whatWillHappen', 'What will happen?')}
          </button>

          {showImpact && (
            <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Info size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-2">
                    {t('admin.compliance.gdpr.impactTitle', 'When you enable GDPR compliance:')}
                  </p>
                  <ul className="space-y-1.5 list-disc list-inside">
                    <li>
                      {t(
                        'admin.compliance.gdpr.impact1',
                        'Privacy sections will be added to all forms automatically'
                      )}
                    </li>
                    <li>
                      {t(
                        'admin.compliance.gdpr.impact2',
                        'Meeting invites will include consent language'
                      )}
                    </li>
                    <li>
                      {t(
                        'admin.compliance.gdpr.impact3',
                        'All marketing emails will have unsubscribe links'
                      )}
                    </li>
                    <li>
                      {t(
                        'admin.compliance.gdpr.impact4',
                        'Users can request data export and deletion'
                      )}
                    </li>
                    <li>
                      {t(
                        'admin.compliance.gdpr.impact5',
                        'Consent records will be tracked for audit purposes'
                      )}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Compliance Status */}
        {config.enabled && (
          <div className="mb-6 p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-navy-900 dark:text-white">
                {t('admin.compliance.gdpr.complianceStatus', 'Compliance Status')}
              </span>
              <span
                className={cn(
                  'text-sm font-medium',
                  compliancePercentage === 100
                    ? 'text-emerald-600'
                    : compliancePercentage >= 50
                      ? 'text-amber-600'
                      : 'text-danger-600'
                )}
              >
                {compliancePercentage}% {t('admin.compliance.gdpr.configured', 'configured')}
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full transition-all rounded-full',
                  compliancePercentage === 100
                    ? 'bg-emerald-500'
                    : compliancePercentage >= 50
                      ? 'bg-amber-500'
                      : 'bg-danger-500'
                )}
                style={{ width: `${compliancePercentage}%` }}
              />
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-navy-900 dark:text-white">
            {t('admin.compliance.gdpr.autoFeatures', 'Auto-enabled features')}
          </h4>

          {features.map((feature) => {
            const Icon = feature.icon;
            const isActive = config.enabled && feature.enabled;

            return (
              <div
                key={feature.id}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-lg border transition-all',
                  isActive
                    ? feature.configured
                      ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
                    : 'bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 opacity-60'
                )}
              >
                <div
                  className={cn(
                    'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                    isActive && feature.configured
                      ? 'bg-emerald-100 dark:bg-emerald-900/30'
                      : isActive
                        ? 'bg-amber-100 dark:bg-amber-900/30'
                        : 'bg-slate-100 dark:bg-navy-800'
                  )}
                >
                  <Icon
                    size={20}
                    className={cn(
                      isActive && feature.configured
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isActive
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-slate-400 dark:text-slate-500'
                    )}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h5 className="font-medium text-navy-900 dark:text-white">{feature.name}</h5>
                    {isActive &&
                      (feature.configured ? (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                          <Check size={10} />
                          {t('admin.compliance.gdpr.configured', 'Configured')}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full">
                          <AlertCircle size={10} />
                          {t('admin.compliance.gdpr.needsSetup', 'Needs setup')}
                        </span>
                      ))}
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {feature.description}
                  </p>
                </div>

                {isActive && !feature.configured && onConfigureFeature && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onConfigureFeature(feature.id)}
                  >
                    {t('admin.compliance.gdpr.configure', 'Configure')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Card */}
      <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-navy-900 dark:text-white mb-1">
              {t('admin.compliance.gdpr.learnMore', 'Learn more about GDPR')}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t(
                'admin.compliance.gdpr.learnMoreDesc',
                'The General Data Protection Regulation (GDPR) is a regulation in EU law on data protection and privacy. It applies to all organizations processing personal data of EU residents.'
              )}
            </p>
            <a
              href="https://gdpr.eu/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400"
            >
              <Link size={14} />
              {t('admin.compliance.gdpr.visitGDPR', 'Visit gdpr.eu')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GDPRComplianceDashboard;
