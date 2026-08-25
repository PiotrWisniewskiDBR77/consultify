/**
 * SettingsExportImport - Export and Import all settings
 */

import {
  AlertTriangle,
  CheckCircle,
  Download,
  FileJson,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Banner } from '@/components/shared/Banner';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

interface SettingsExportImportProps {
  currentUser: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

interface ExportConfig {
  profile: boolean;
  security: boolean;
  privacy: boolean;
  aiPreferences: boolean;
  notifications: boolean;
  integrations: boolean;
  appearance: boolean;
  keyboard: boolean;
}

interface ImportPreview {
  version?: string;
  userId?: string;
  exportedAt?: string;
  settings?: Record<string, unknown>;
}

interface ImportSettingsResponse {
  success?: boolean;
  imported?: string[];
  skipped?: string[];
}

export const SettingsExportImport: React.FC<SettingsExportImportProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportConfig, setExportConfig] = useState<ExportConfig>({
    profile: true,
    security: true,
    privacy: true,
    aiPreferences: true,
    notifications: true,
    integrations: true,
    appearance: true,
    keyboard: true,
  });
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importValidation, setImportValidation] = useState<{
    valid: boolean;
    warnings: string[];
    errors: string[];
  }>({
    valid: true,
    warnings: [],
    errors: [],
  });
  const [lastImportResult, setLastImportResult] = useState<{
    imported: string[];
    skipped: string[];
  } | null>(null);

  const categories = [
    { key: 'profile', label: t('settings.importExport.categories.profile', 'Profile & Contact') },
    { key: 'security', label: t('settings.importExport.categories.security', 'Security Settings') },
    { key: 'privacy', label: t('settings.importExport.categories.privacy', 'Privacy Settings') },
    {
      key: 'aiPreferences',
      label: t('settings.importExport.categories.aiPreferences', 'AI Preferences'),
    },
    {
      key: 'notifications',
      label: t('settings.importExport.categories.notifications', 'Notifications'),
    },
    {
      key: 'integrations',
      label: t('settings.importExport.categories.integrations', 'Integrations'),
    },
    { key: 'appearance', label: t('settings.importExport.categories.appearance', 'Appearance') },
    {
      key: 'keyboard',
      label: t('settings.importExport.categories.keyboard', 'Keyboard Shortcuts'),
    },
  ];

  const handleExport = async () => {
    try {
      setExporting(true);
      setActionError(null);

      // Get selected categories
      const selectedCategories = Object.entries(exportConfig)
        .filter(([, selected]) => selected)
        .map(([key]) => key);

      // Call API to get export data
      const response = await Api.exportSettings(selectedCategories);

      if (!response?.data) {
        throw new Error(t('settings.importExport.noData', 'No data received'));
      }

      // Create download
      const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `consultify-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(t('settings.importExport.exportSuccess', 'Settings exported successfully'));
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.importExport.exportError', 'Failed to export settings')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);

    try {
      const text = await file.text();
      const data = JSON.parse(text) as ImportPreview;
      setImportPreview(data);

      // Validate
      const warnings: string[] = [];
      const errors: string[] = [];

      if (!data.version)
        errors.push(
          t('settings.importExport.validation.missingVersion', 'Missing version information')
        );
      if (!data.settings)
        errors.push(t('settings.importExport.validation.missingSettings', 'Missing settings data'));
      if (data.version && data.version !== '1.0.0')
        warnings.push(
          t(
            'settings.importExport.validation.versionWarning',
            'Different settings version - some options may not apply'
          )
        );
      if (data.userId && data.userId !== currentUser.id)
        warnings.push(
          t(
            'settings.importExport.validation.differentUser',
            'Settings from different user account'
          )
        );

      setImportValidation({
        valid: errors.length === 0,
        warnings,
        errors,
      });
    } catch {
      setImportValidation({
        valid: false,
        warnings: [],
        errors: [t('settings.importExport.validation.invalidJson', 'Invalid JSON file')],
      });
    }
  };

  const handleImport = async () => {
    if (!importPreview || !importValidation.valid) return;

    try {
      setImporting(true);
      setActionError(null);

      // Call API to import settings
      const response = (await Api.importSettings(importPreview, true)) as ImportSettingsResponse;
      if (response?.success === false) {
        throw new Error('Settings import was rejected by the server');
      }
      const imported = response?.imported || [];
      const skipped = response?.skipped || [];
      if (imported.length === 0) {
        throw new Error('Settings import did not confirm any imported categories');
      }
      setLastImportResult({ imported, skipped });

      if (imported.length > 0) {
        toast.success(
          t('settings.importExport.importSuccessWithCount', {
            defaultValue: 'Settings imported successfully ({{count}} categories)',
            count: imported.length,
          })
        );
      } else {
        toast.success(t('settings.importExport.importSuccess', 'Settings imported successfully'));
      }

      setImportFile(null);
      setImportPreview(null);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(
        error,
        t('settings.importExport.importError', 'Failed to import settings')
      );
      setActionError(message);
      toast.error(message);
    } finally {
      setImporting(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    setExportConfig({
      profile: checked,
      security: checked,
      privacy: checked,
      aiPreferences: checked,
      notifications: checked,
      integrations: checked,
      appearance: checked,
      keyboard: checked,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in relative">
      <div>
        <h2 className="text-2xl font-bold text-c-text flex items-center gap-3">
          <FileJson size={28} className="text-emerald-500" />
          {t('settings.importExport.title', 'Settings Export & Import')}
        </h2>
        <p className="text-c-text-muted text-sm mt-1">
          {t('settings.importExport.subtitle', 'Backup and restore your settings configuration')}
        </p>
      </div>

      {actionError && <Banner variant="danger" title={actionError} />}

      {/* Export Section */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
              <Download size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-c-text">
                {t('settings.importExport.exportTitle', 'Export Settings')}
              </h3>
              <p className="text-sm text-c-text-muted">
                {t('settings.importExport.exportDesc', 'Download your settings as JSON file')}
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 text-white dark:text-navy-950 bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {t('settings.importExport.exportSelected', 'Export Selected')}
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 bg-c-surface-raised rounded-lg">
            <span className="font-medium text-c-text-secondary">
              {t('settings.importExport.selectAll', 'Select All')}
            </span>
            <input
              type="checkbox"
              checked={Object.values(exportConfig).every(Boolean)}
              onChange={(e) => toggleAll(e.target.checked)}
              className="w-5 h-5 rounded border-c-border-subtle dark:border-navy-700 text-emerald-600 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => (
              <label
                key={cat.key}
                className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg cursor-pointer hover:bg-c-surface-raised dark:hover:bg-navy-800"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-c-text-secondary">{cat.label}</span>
                </div>
                <input
                  type="checkbox"
                  checked={exportConfig[cat.key as keyof ExportConfig]}
                  onChange={(e) =>
                    setExportConfig({ ...exportConfig, [cat.key]: e.target.checked })
                  }
                  className="w-5 h-5 rounded border-c-border-subtle dark:border-navy-700 text-emerald-600 focus:ring-emerald-500"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <Upload size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-c-text">
              {t('settings.importExport.importTitle', 'Import Settings')}
            </h3>
            <p className="text-sm text-c-text-muted">
              {t('settings.importExport.importDesc', 'Restore settings from a JSON file')}
            </p>
          </div>
        </div>

        {!importFile ? (
          <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-c-border-subtle rounded-xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-colors">
            <FileText size={48} className="text-c-text-secondary mb-3" />
            <p className="font-medium text-c-text-secondary">
              {t('settings.importExport.dropFile', 'Drop settings file here or click to browse')}
            </p>
            <p className="text-sm text-c-text-muted mt-1">
              {t(
                'settings.importExport.acceptsJson',
                'Accepts .json files exported from Consultify'
              )}
            </p>
            <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg">
              <div className="flex items-center gap-3">
                <FileJson size={24} className="text-blue-500" />
                <div>
                  <p className="font-medium text-c-text">{importFile.name}</p>
                  <p className="text-sm text-c-text-muted">
                    {importPreview?.exportedAt && (
                      <>
                        {t('settings.importExport.exportedAt', 'Exported')}:{' '}
                        {new Date(importPreview.exportedAt).toLocaleDateString()}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setImportFile(null);
                  setImportPreview(null);
                }}
                className="p-2 text-c-text-secondary hover:text-c-text-secondary"
              >
                ×
              </button>
            </div>

            {/* Validation Results */}
            {importValidation.errors.length > 0 && (
              <div className="p-4 bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-danger-700 dark:text-danger-400 font-medium mb-2">
                  <AlertTriangle size={16} />
                  {t('settings.importExport.errorsFound', 'Errors Found')}
                </div>
                <ul className="text-sm text-danger-600 dark:text-danger-300 space-y-1">
                  {importValidation.errors.map((err, i) => (
                    <li key={i}>- {err}</li>
                  ))}
                </ul>
              </div>
            )}

            {importValidation.warnings.length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-medium mb-2">
                  <AlertTriangle size={16} />
                  {t('settings.importExport.warnings', 'Warnings')}
                </div>
                <ul className="text-sm text-yellow-600 dark:text-yellow-300 space-y-1">
                  {importValidation.warnings.map((warn, i) => (
                    <li key={i}>- {warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {importValidation.valid && importValidation.warnings.length === 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle size={16} />
                  <span className="font-medium">
                    {t('settings.importExport.fileValid', 'File validated successfully')}
                  </span>
                </div>
              </div>
            )}

            {/* Preview */}
            {importPreview?.settings && (
              <div className="p-4 bg-c-surface-raised rounded-lg">
                <p className="text-sm font-medium text-c-text-secondary mb-2">
                  {t('settings.importExport.settingsToImport', 'Settings to import:')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {Object.keys(importPreview.settings).map((key) => (
                    <span
                      key={key}
                      className="px-2 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded text-sm"
                    >
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={importing || !importValidation.valid}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white dark:text-navy-950 bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] rounded-lg disabled:opacity-50 transition-colors"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {t('settings.importExport.importButton', 'Import Settings')}
            </button>
          </div>
        )}
      </div>

      {lastImportResult && (
        <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-4">
          <h4 className="font-medium text-green-700 dark:text-green-400 mb-2">
            {t('settings.importExport.lastImportTitle', 'Last import result')}
          </h4>
          <p className="text-sm text-green-700 dark:text-green-300">
            {t('settings.importExport.lastImportSummary', {
              defaultValue: 'Imported: {{imported}}. Skipped: {{skipped}}.',
              imported: lastImportResult.imported.length,
              skipped: lastImportResult.skipped.length,
            })}
          </p>
        </div>
      )}

      {/* Info */}
      <div className="bg-c-surface-raised border border-c-border-subtle dark:border-navy-700 rounded-xl p-4">
        <h4 className="font-medium text-c-text-secondary mb-2">
          {t('settings.importExport.tipsTitle', 'Tips')}
        </h4>
        <ul className="text-sm text-c-text-muted space-y-1">
          <li>
            {t('settings.importExport.tipBackup', 'Export settings before making major changes')}
          </li>
          <li>
            {t('settings.importExport.tipPortable', 'Settings files are portable between devices')}
          </li>
          <li>
            {t(
              'settings.importExport.tipSensitive',
              'Sensitive data (passwords, tokens) is not exported'
            )}
          </li>
          <li>
            {t(
              'settings.importExport.tipIntegrations',
              'Integration credentials need to be re-authenticated after import'
            )}
          </li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsExportImport;
