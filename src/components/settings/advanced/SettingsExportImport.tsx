/**
 * SettingsExportImport - Export and Import all settings
 */

import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Copy,
  Download,
  FileJson,
  FileText,
  Loader2,
  Upload,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { InfoButton } from '../../shared/InfoButton';

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
  const [importPreview, setImportPreview] = useState<any>(null);
  const [importValidation, setImportValidation] = useState<{
    valid: boolean;
    warnings: string[];
    errors: string[];
  }>({
    valid: true,
    warnings: [],
    errors: [],
  });

  const categories = [
    { key: 'profile', label: 'Profile & Contact', icon: '👤' },
    { key: 'security', label: 'Security Settings', icon: '🔒' },
    { key: 'privacy', label: 'Privacy Settings', icon: '🛡️' },
    { key: 'aiPreferences', label: 'AI Preferences', icon: '🤖' },
    { key: 'notifications', label: 'Notifications', icon: '🔔' },
    { key: 'integrations', label: 'Integrations', icon: '🔗' },
    { key: 'appearance', label: 'Appearance', icon: '🎨' },
    { key: 'keyboard', label: 'Keyboard Shortcuts', icon: '⌨️' },
  ];

  const handleExport = async () => {
    try {
      setExporting(true);

      // Get selected categories
      const selectedCategories = Object.entries(exportConfig)
        .filter(([_, selected]) => selected)
        .map(([key]) => key);

      // Call API to get export data
      const response = await Api.exportSettings(selectedCategories);

      if (!response?.data) {
        throw new Error('No data received');
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

      toast.success('Settings exported successfully');
    } catch (error) {
      toast.error('Failed to export settings');
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
      const data = JSON.parse(text);
      setImportPreview(data);

      // Validate
      const warnings: string[] = [];
      const errors: string[] = [];

      if (!data.version) errors.push('Missing version information');
      if (!data.settings) errors.push('Missing settings data');
      if (data.version && data.version !== '1.0.0')
        warnings.push('Different settings version - some options may not apply');
      if (data.userId && data.userId !== currentUser.id)
        warnings.push('Settings from different user account');

      setImportValidation({
        valid: errors.length === 0,
        warnings,
        errors,
      });
    } catch (error) {
      setImportValidation({
        valid: false,
        warnings: [],
        errors: ['Invalid JSON file'],
      });
    }
  };

  const handleImport = async () => {
    if (!importPreview || !importValidation.valid) return;

    try {
      setImporting(true);

      // Call API to import settings
      const response = await Api.importSettings(importPreview, true);

      if (response?.imported?.length > 0) {
        toast.success(`Settings imported successfully (${response.imported.length} categories)`);
      } else {
        toast.success('Settings imported successfully');
      }

      setImportFile(null);
      setImportPreview(null);
    } catch (error) {
      toast.error('Failed to import settings');
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
      <InfoButton cardId="settings-export-import" position="top-right" />

      <div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <FileJson size={28} className="text-emerald-500" />
          Settings Export & Import
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Backup and restore your settings configuration
        </p>
      </div>

      {/* Export Section */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-500/20 rounded-lg">
              <Download size={20} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Export Settings</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Download your settings as JSON file
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg disabled:opacity-50"
          >
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            Export Selected
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-navy-950 rounded-lg">
            <span className="font-medium text-slate-700 dark:text-slate-300">Select All</span>
            <input
              type="checkbox"
              checked={Object.values(exportConfig).every(Boolean)}
              onChange={(e) => toggleAll(e.target.checked)}
              className="w-5 h-5 rounded border-slate-300 dark:border-navy-700 text-emerald-600 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => (
              <label
                key={cat.key}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-navy-950 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-navy-800"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cat.icon}</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {cat.label}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={exportConfig[cat.key as keyof ExportConfig]}
                  onChange={(e) =>
                    setExportConfig({ ...exportConfig, [cat.key]: e.target.checked })
                  }
                  className="w-5 h-5 rounded border-slate-300 dark:border-navy-700 text-emerald-600 focus:ring-emerald-500"
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Import Section */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
            <Upload size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">Import Settings</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Restore settings from a JSON file
            </p>
          </div>
        </div>

        {!importFile ? (
          <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-white/20 rounded-xl cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-colors">
            <FileText size={48} className="text-slate-400 dark:text-slate-500 mb-3" />
            <p className="font-medium text-slate-700 dark:text-slate-300">
              Drop settings file here or click to browse
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Accepts .json files exported from Consultify
            </p>
            <input type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-navy-950 rounded-lg">
              <div className="flex items-center gap-3">
                <FileJson size={24} className="text-blue-500" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{importFile.name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {importPreview?.exportedAt && (
                      <>Exported: {new Date(importPreview.exportedAt).toLocaleDateString()}</>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setImportFile(null);
                  setImportPreview(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 dark:text-slate-400"
              >
                ×
              </button>
            </div>

            {/* Validation Results */}
            {importValidation.errors.length > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-medium mb-2">
                  <AlertTriangle size={16} />
                  Errors Found
                </div>
                <ul className="text-sm text-red-600 dark:text-red-300 space-y-1">
                  {importValidation.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            {importValidation.warnings.length > 0 && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-medium mb-2">
                  <AlertTriangle size={16} />
                  Warnings
                </div>
                <ul className="text-sm text-yellow-600 dark:text-yellow-300 space-y-1">
                  {importValidation.warnings.map((warn, i) => (
                    <li key={i}>• {warn}</li>
                  ))}
                </ul>
              </div>
            )}

            {importValidation.valid && importValidation.warnings.length === 0 && (
              <div className="p-4 bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-lg">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle size={16} />
                  <span className="font-medium">File validated successfully</span>
                </div>
              </div>
            )}

            {/* Preview */}
            {importPreview?.settings && (
              <div className="p-4 bg-slate-50 dark:bg-navy-950 rounded-lg">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Settings to import:
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
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg disabled:opacity-50"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              Import Settings
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
        <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">💡 Tips</h4>
        <ul className="text-sm text-slate-500 dark:text-slate-400 space-y-1">
          <li>• Export settings before making major changes</li>
          <li>• Settings files are portable between devices</li>
          <li>• Sensitive data (passwords, tokens) is not exported</li>
          <li>• Integration credentials need to be re-authenticated after import</li>
        </ul>
      </div>
    </div>
  );
};

export default SettingsExportImport;
