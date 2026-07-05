import { AlertTriangle, Download, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

const AccountManagementSettings: React.FC<{ className?: string }> = ({ className }) => {
  const { t } = useTranslation();
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const handleExportData = async () => {
    setExporting(true);
    try {
      const blob = await Api.exportUserData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'consultify-data-export.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('settings.account.exportSuccess', 'Data exported successfully'));
    } catch (_error) {
      toast.error(t('settings.account.exportError', 'Failed to export data'));
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    try {
      await Api.deleteAccount(deleteConfirmText);
      localStorage.clear();
      window.location.href = '/';
    } catch (_error) {
      toast.error(t('settings.account.deleteError', 'Failed to delete account'));
    }
  };

  return (
    <div className={`space-y-8 ${className}`}>
      {/* Export Data */}
      <div className="p-6 border border-c-border-subtle dark:border-navy-700 rounded-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <Download className="text-blue-600 dark:text-blue-400" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-c-text">
              {t('settings.account.exportTitle', 'Export Your Data')}
            </h3>
            <p className="text-sm text-c-text-muted mt-1">
              {t(
                'settings.account.exportDesc',
                'Download a copy of all your data including projects, assessments, and settings.'
              )}
            </p>
            <button
              onClick={handleExportData}
              disabled={exporting}
              className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Download size={16} />
              {exporting
                ? t('common.exporting', 'Exporting...')
                : t('settings.account.export', 'Export Data')}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account */}
      <div className="p-6 border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-900/10 rounded-xl">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-lg">
            <Trash2 className="text-rose-600 dark:text-rose-400" size={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-medium text-rose-900 dark:text-rose-400">
              {t('settings.account.deleteTitle', 'Delete Account')}
            </h3>
            <p className="text-sm text-rose-700 dark:text-rose-300/70 mt-1">
              {t(
                'settings.account.deleteDesc',
                'Permanently delete your account and all associated data. This action cannot be undone.'
              )}
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
              >
                <Trash2 size={16} />
                {t('settings.account.delete', 'Delete Account')}
              </button>
            ) : (
              <div className="mt-4 p-4 bg-c-surface rounded-lg border border-rose-200 dark:border-rose-800">
                <div className="flex items-center gap-2 text-rose-600 mb-3">
                  <AlertTriangle size={18} />
                  <span className="font-medium">
                    {t('settings.account.confirmTitle', 'Are you sure?')}
                  </span>
                </div>
                <p className="text-sm text-c-text-secondary mb-3">
                  {t('settings.account.confirmDesc', 'Type DELETE to confirm account deletion:')}
                </p>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 border border-c-border dark:border-navy-600 rounded-lg mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'DELETE'}
                    className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('settings.account.confirmDelete', 'Confirm Delete')}
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmText('');
                    }}
                    className="px-4 py-2 border border-c-border dark:border-navy-600 rounded-lg hover:bg-c-surface-raised dark:hover:bg-navy-700"
                  >
                    {t('common.cancel', 'Cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountManagementSettings;
