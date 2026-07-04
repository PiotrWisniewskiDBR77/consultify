/**
 * DataHostingSettings - Data hosting location selection component
 *
 * Features:
 * - Region selector (EU, US East, US West, APAC)
 * - Compliance badges (GDPR, HIPAA, SOC2)
 * - Warning banner for region change
 * - Current region display with change button
 *
 * Design: HubSpot-style settings page with info banners
 */

import {
  AlertTriangle,
  Check,
  Database,
  Globe,
  HelpCircle,
  Info,
  Lock,
  MapPin,
  RefreshCw,
  Save,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../../utils/cn';
import { Button } from '../../ui/primitives/Button';
import { Modal } from '../../ui/primitives/Modal';
import { Tooltip } from '../../ui/primitives/Tooltip';

// Data hosting regions
interface DataRegion {
  id: string;
  name: string;
  location: string;
  flag: string;
  compliance: string[];
  latency: string;
  available: boolean;
}

const DATA_REGIONS: DataRegion[] = [
  {
    id: 'eu-west',
    name: 'European Union',
    location: 'Frankfurt, Germany',
    flag: '🇪🇺',
    compliance: ['GDPR', 'SOC2', 'ISO27001'],
    latency: '~20ms',
    available: true,
  },
  {
    id: 'us-east',
    name: 'US East',
    location: 'Virginia, USA',
    flag: '🇺🇸',
    compliance: ['SOC2', 'HIPAA', 'ISO27001'],
    latency: '~50ms',
    available: true,
  },
  {
    id: 'us-west',
    name: 'US West',
    location: 'Oregon, USA',
    flag: '🇺🇸',
    compliance: ['SOC2', 'HIPAA', 'ISO27001'],
    latency: '~80ms',
    available: true,
  },
  {
    id: 'apac',
    name: 'Asia Pacific',
    location: 'Singapore',
    flag: '🇸🇬',
    compliance: ['SOC2', 'ISO27001'],
    latency: '~120ms',
    available: true,
  },
  {
    id: 'me-south',
    name: 'Middle East',
    location: 'Bahrain',
    flag: '🇧🇭',
    compliance: ['SOC2', 'ISO27001'],
    latency: '~100ms',
    available: false,
  },
];

// Compliance badge info
const COMPLIANCE_BADGES: Record<string, { label: string; color: string; description: string }> = {
  GDPR: {
    label: 'GDPR',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    description: 'General Data Protection Regulation - EU data privacy standard',
  },
  HIPAA: {
    label: 'HIPAA',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    description:
      'Health Insurance Portability and Accountability Act - US healthcare data protection',
  },
  SOC2: {
    label: 'SOC 2',
    color: 'bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300',
    description: 'Service Organization Control 2 - Security, availability, and confidentiality',
  },
  ISO27001: {
    label: 'ISO 27001',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    description: 'International standard for information security management',
  },
};

export interface DataHostingConfig {
  region: string;
  compliance: string[];
}

interface DataHostingSettingsProps {
  config?: DataHostingConfig;
  onChange: (config: DataHostingConfig) => void;
  onSave?: () => Promise<void>;
  className?: string;
}

export const DataHostingSettings: React.FC<DataHostingSettingsProps> = ({
  config,
  onChange,
  onSave,
  className,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  const currentRegion = DATA_REGIONS.find((r) => r.id === config?.region) || DATA_REGIONS[0];

  const handleRegionSelect = useCallback(
    (regionId: string) => {
      if (regionId === currentRegion.id) return;
      setSelectedRegion(regionId);
      setShowChangeModal(true);
      setConfirmText('');
    },
    [currentRegion.id]
  );

  const handleConfirmChange = useCallback(async () => {
    if (confirmText !== 'MIGRATE' || !selectedRegion) return;

    const newRegion = DATA_REGIONS.find((r) => r.id === selectedRegion);
    if (!newRegion) return;

    onChange({
      region: selectedRegion,
      compliance: newRegion.compliance,
    });

    setShowChangeModal(false);
    setSelectedRegion(null);
    setConfirmText('');

    if (onSave) {
      setSaving(true);
      try {
        await onSave();
      } finally {
        setSaving(false);
      }
    }
  }, [confirmText, selectedRegion, onChange, onSave]);

  const handleCancelChange = useCallback(() => {
    setShowChangeModal(false);
    setSelectedRegion(null);
    setConfirmText('');
  }, []);

  const newRegion = DATA_REGIONS.find((r) => r.id === selectedRegion);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Current Region Card */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database size={20} className="text-primary-500" />
            <h3 className="text-lg font-medium text-navy-900 dark:text-white">
              {t('admin.org.dataHosting.title', 'Data Hosting Location')}
            </h3>
            <Tooltip
              content={t(
                'admin.org.dataHosting.tooltip',
                'Your data is stored and processed in this region. Changing regions may affect latency and compliance requirements.'
              )}
            >
              <button className="text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300">
                <HelpCircle size={16} />
              </button>
            </Tooltip>
          </div>
        </div>

        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          {t(
            'admin.org.dataHosting.description',
            "Select where your organization's data is stored and processed for optimal performance and compliance."
          )}
        </p>

        {/* Current Region Display */}
        <div className="p-4 bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-xl border border-primary-200 dark:border-primary-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">{currentRegion.flag}</div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-lg font-semibold text-navy-900 dark:text-white">
                    {currentRegion.name}
                  </h4>
                  <span className="px-2 py-0.5 text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full">
                    {t('admin.org.dataHosting.active', 'Active')}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1 mt-1">
                  <MapPin size={14} />
                  {currentRegion.location}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('admin.org.dataHosting.latency', 'Avg. Latency')}
              </p>
              <p className="text-sm font-medium text-navy-900 dark:text-white">
                {currentRegion.latency}
              </p>
            </div>
          </div>

          {/* Compliance Badges */}
          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
              {t('admin.org.dataHosting.compliance', 'Compliance')}:
            </span>
            {currentRegion.compliance.map((cert) => {
              const badge = COMPLIANCE_BADGES[cert];
              return (
                <Tooltip key={cert} content={badge?.description || cert}>
                  <span
                    className={cn(
                      'px-2 py-1 text-xs font-medium rounded-full flex items-center gap-1',
                      badge?.color || 'bg-slate-100 text-slate-700 dark:text-slate-300'
                    )}
                  >
                    <ShieldCheck size={12} />
                    {badge?.label || cert}
                  </span>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>

      {/* Available Regions Card */}
      <div className="p-6 bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-navy-700">
        <h3 className="text-lg font-medium text-navy-900 dark:text-white mb-4 flex items-center gap-2">
          <Globe size={20} className="text-primary-500" />
          {t('admin.org.dataHosting.availableRegions', 'Available Regions')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DATA_REGIONS.map((region) => {
            const isCurrentRegion = region.id === currentRegion.id;

            return (
              <button
                key={region.id}
                onClick={() => region.available && handleRegionSelect(region.id)}
                disabled={!region.available || isCurrentRegion}
                className={cn(
                  'p-4 rounded-xl border text-left transition-all',
                  isCurrentRegion
                    ? 'bg-primary-50 dark:bg-primary-900/20 border-primary-300 dark:border-primary-700 cursor-default'
                    : region.available
                      ? 'bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-navy-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 cursor-pointer'
                      : 'bg-slate-100 dark:bg-navy-900/50 border-slate-200 dark:border-navy-700 opacity-60 cursor-not-allowed'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{region.flag}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-navy-900 dark:text-white">{region.name}</h4>
                        {isCurrentRegion && (
                          <Check size={16} className="text-primary-600 dark:text-primary-400" />
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {region.location}
                      </p>
                    </div>
                  </div>
                  {!region.available && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded-full">
                      {t('admin.org.dataHosting.planned', 'Planned')}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mt-3">
                  {region.compliance.map((cert) => {
                    const badge = COMPLIANCE_BADGES[cert];
                    return (
                      <span
                        key={cert}
                        className={cn(
                          'px-1.5 py-0.5 text-[10px] font-medium rounded',
                          badge?.color || 'bg-slate-100 text-slate-600 dark:text-slate-400'
                        )}
                      >
                        {badge?.label || cert}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Security Info Card */}
      <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700">
        <div className="flex items-start gap-3">
          <Lock size={20} className="text-slate-400 dark:text-slate-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-navy-900 dark:text-white mb-1">
              {t('admin.org.dataHosting.securityTitle', 'Data Security')}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {t(
                'admin.org.dataHosting.securityDescription',
                'All data is encrypted at rest (AES-256) and in transit (TLS 1.3). Regular backups are stored in geographically separate locations within your selected region.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Region Change Confirmation Modal */}
      <Modal
        open={showChangeModal}
        onClose={handleCancelChange}
        title={t('admin.org.dataHosting.changeRegionTitle', 'Change Data Hosting Region')}
        size="md"
      >
        <div className="space-y-4">
          {/* Warning Banner */}
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={20}
                className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5"
              />
              <div>
                <h4 className="font-medium text-amber-800 dark:text-amber-200">
                  {t('admin.org.dataHosting.warningTitle', 'Important: Data Migration Required')}
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {t(
                    'admin.org.dataHosting.warningDescription',
                    'Changing your data hosting region will trigger a data migration. This may cause temporary service interruptions and increased latency during the migration process.'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Migration Details */}
          {newRegion && (
            <div className="p-4 bg-slate-50 dark:bg-navy-900 rounded-lg">
              <h5 className="text-sm font-medium text-navy-900 dark:text-white mb-3">
                {t('admin.org.dataHosting.migrationDetails', 'Migration Details')}
              </h5>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t('admin.org.dataHosting.from', 'From')}:
                  </span>
                  <span className="font-medium text-navy-900 dark:text-white">
                    {currentRegion.flag} {currentRegion.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t('admin.org.dataHosting.to', 'To')}:
                  </span>
                  <span className="font-medium text-navy-900 dark:text-white">
                    {newRegion.flag} {newRegion.name}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t('admin.org.dataHosting.estimatedTime', 'Estimated Time')}:
                  </span>
                  <span className="font-medium text-navy-900 dark:text-white">2-4 hours</span>
                </div>
              </div>
            </div>
          )}

          {/* Confirmation Input */}
          <div>
            <label className="block text-sm font-medium text-navy-900 dark:text-white mb-2">
              {t('admin.org.dataHosting.confirmLabel', 'Type MIGRATE to confirm')}
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="MIGRATE"
              className="w-full px-4 py-3 bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl text-navy-900 dark:text-white focus:ring-2 focus:ring-c-focus focus:border-c-focus-solid"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-navy-700">
          <Button variant="outline" onClick={handleCancelChange}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirmChange}
            disabled={confirmText !== 'MIGRATE'}
            loading={saving}
          >
            {t('admin.org.dataHosting.confirmMigration', 'Start Migration')}
          </Button>
        </div>
      </Modal>
    </div>
  );
};

export default DataHostingSettings;
