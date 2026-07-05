/**
 * RecoveryOptionsSettings - Account recovery options management
 *
 * Features:
 * - Recovery email configuration
 * - Recovery phone configuration
 * - Backup codes generation
 * - Recovery status display
 *
 * Backend endpoints exist in server/routes/settings.js:
 * - GET /api/settings/recovery
 * - PUT /api/settings/recovery
 */

import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  Key,
  Mail,
  Phone,
  RefreshCw,
  Shield,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '../../lib/utils';
import { Api } from '../../services/api';
import { User } from '../../types';
import { DegradedState } from '../Admin/AdminState';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/primitives/Button';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '../ui/use-toast';

interface RecoveryOptions {
  recoveryEmail: string;
  recoveryPhone: string;
  backupCodesCount: number;
  lastBackupCodesGenerated?: string;
}

interface RecoveryOptionsSettingsProps {
  currentUser: User;
}

export const RecoveryOptionsSettings: React.FC<RecoveryOptionsSettingsProps> = ({
  currentUser,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recoveryOptions, setRecoveryOptions] = useState<RecoveryOptions>({
    recoveryEmail: '',
    recoveryPhone: '',
    backupCodesCount: 0,
  });
  const [editMode, setEditMode] = useState<'email' | 'phone' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [generatingCodes, setGeneratingCodes] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch recovery options
  useEffect(() => {
    const fetchRecoveryOptions = async () => {
      setLoading(true);
      try {
        setLoadError(null);
        const data = await Api.get('/settings/recovery');
        if (data) {
          setRecoveryOptions(data);
        } else {
          throw new Error('Recovery options response was empty');
        }
      } catch (error) {
        console.error('Failed to fetch recovery options:', error);
        setLoadError(error instanceof Error ? error.message : 'Failed to load recovery options');
        setRecoveryOptions({ recoveryEmail: '', recoveryPhone: '', backupCodesCount: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchRecoveryOptions();
  }, [currentUser]);

  // Save recovery option
  const handleSave = async () => {
    if (!editMode) return;

    setSaving(true);
    try {
      const updates =
        editMode === 'email' ? { recoveryEmail: editValue } : { recoveryPhone: editValue };

      await Api.put('/settings/recovery', updates);
      const persisted = await Api.get('/settings/recovery');
      if (!persisted) {
        throw new Error('Recovery options were saved but could not be reloaded');
      }
      setRecoveryOptions((prev) => ({ ...prev, ...updates, ...persisted }));
      toast({
        title: t('settings.recovery.saved', 'Recovery Option Updated'),
        description: t('settings.recovery.savedDesc', 'Your recovery option has been saved'),
      });

      setEditMode(null);
      setEditValue('');
    } catch (error) {
      console.error('Failed to save recovery option:', error);
      toast({
        title: t('settings.recovery.error', 'Error'),
        description: t('settings.recovery.saveFailed', 'Failed to save recovery option'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Generate backup codes
  const handleGenerateBackupCodes = async () => {
    setGeneratingCodes(true);
    try {
      const response = await Api.post('/settings/recovery/backup-codes', {});
      const codes = Array.isArray(response?.codes) ? response.codes : [];
      if (codes.length === 0) {
        throw new Error('Backup code generation returned no codes');
      }

      setBackupCodes(codes);
      setShowBackupCodes(true);
      setRecoveryOptions((prev) => ({
        ...prev,
        backupCodesCount: codes.length,
        lastBackupCodesGenerated: new Date().toISOString(),
      }));

      toast({
        title: t('settings.recovery.codesGenerated', 'Backup Codes Generated'),
        description: t(
          'settings.recovery.codesGeneratedDesc',
          'Save these codes in a secure location'
        ),
      });
    } catch (error) {
      console.error('Failed to generate backup codes:', error);
      toast({
        title: t('settings.recovery.error', 'Error'),
        description: t('settings.recovery.generateFailed', 'Failed to generate backup codes'),
        variant: 'destructive',
      });
    } finally {
      setGeneratingCodes(false);
    }
  };

  // Copy codes to clipboard
  const handleCopyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    toast({
      title: t('settings.recovery.copied', 'Copied'),
      description: t('settings.recovery.copiedDesc', 'Backup codes copied to clipboard'),
    });
  };

  // Download codes as file
  const handleDownloadCodes = () => {
    const content = `Consultify Backup Codes\nGenerated: ${new Date().toLocaleString()}\n\n${backupCodes.join('\n')}\n\nStore these codes in a safe place. Each code can only be used once.`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'consultify-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Mask email/phone for display
  const maskEmail = (email: string) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
    if (!domain) return email;
    return `${local.substring(0, 2)}***@${domain}`;
  };

  const maskPhone = (phone: string) => {
    if (!phone) return '';
    return phone.replace(/(\d{2})\d+(\d{2})/, '$1******$2');
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    );
  }

  // Calculate recovery score
  const hasRecoveryEmail = !!recoveryOptions.recoveryEmail;
  const hasRecoveryPhone = !!recoveryOptions.recoveryPhone;
  const hasBackupCodes = recoveryOptions.backupCodesCount > 0;
  const recoveryScore = [hasRecoveryEmail, hasRecoveryPhone, hasBackupCodes].filter(Boolean).length;

  return (
    <div className="space-y-6">
      {loadError && <DegradedState title="Recovery options unavailable" description={loadError} />}

      {/* Recovery Status */}
      {!loadError && (
        <Alert
          className={cn(
            recoveryScore === 3
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
              : recoveryScore >= 1
                ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
                : 'border-danger-200 bg-danger-50 dark:border-danger-800 dark:bg-danger-900/20'
          )}
        >
          <Shield
            className={cn(
              'w-5 h-5',
              recoveryScore === 3
                ? 'text-emerald-600'
                : recoveryScore >= 1
                  ? 'text-amber-600'
                  : 'text-danger-600'
            )}
          />
          <AlertTitle
            className={cn(
              recoveryScore === 3
                ? 'text-emerald-800 dark:text-emerald-200'
                : recoveryScore >= 1
                  ? 'text-amber-800 dark:text-amber-200'
                  : 'text-danger-800 dark:text-danger-200'
            )}
          >
            {recoveryScore === 3
              ? t('settings.recovery.statusExcellent', 'Excellent Recovery Protection')
              : recoveryScore >= 1
                ? t('settings.recovery.statusGood', 'Good Recovery Protection')
                : t('settings.recovery.statusWeak', 'Weak Recovery Protection')}
          </AlertTitle>
          <AlertDescription
            className={cn(
              recoveryScore === 3
                ? 'text-emerald-700 dark:text-emerald-300'
                : recoveryScore >= 1
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-danger-700 dark:text-danger-300'
            )}
          >
            {recoveryScore === 3
              ? t('settings.recovery.statusExcellentDesc', 'All recovery options are configured')
              : t(
                  'settings.recovery.statusImprove',
                  'Add more recovery options to secure your account'
                )}
          </AlertDescription>
        </Alert>
      )}

      {/* Recovery Email */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {t('settings.recovery.email', 'Recovery Email')}
                </CardTitle>
                <CardDescription>
                  {t(
                    'settings.recovery.emailDesc',
                    'Used to recover your account if you forget your password'
                  )}
                </CardDescription>
              </div>
            </div>
            {hasRecoveryEmail && <Check className="w-5 h-5 text-emerald-500" />}
          </div>
        </CardHeader>
        <CardContent>
          {editMode === 'email' ? (
            <div className="flex gap-2">
              <Input
                type="email"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={t('settings.recovery.emailPlaceholder', 'Enter recovery email')}
                className="flex-1"
              />
              <Button onClick={handleSave} disabled={saving || !!loadError}>
                {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
              </Button>
              <Button variant="outline" onClick={() => setEditMode(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-c-text-secondary">
                {recoveryOptions.recoveryEmail
                  ? maskEmail(recoveryOptions.recoveryEmail)
                  : t('settings.recovery.notSet', 'Not configured')}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!!loadError}
                onClick={() => {
                  setEditMode('email');
                  setEditValue(recoveryOptions.recoveryEmail);
                }}
              >
                {recoveryOptions.recoveryEmail
                  ? t('common.change', 'Change')
                  : t('common.add', 'Add')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recovery Phone */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Phone className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {t('settings.recovery.phone', 'Recovery Phone')}
                </CardTitle>
                <CardDescription>
                  {t('settings.recovery.phoneDesc', 'Receive verification codes via SMS')}
                </CardDescription>
              </div>
            </div>
            {hasRecoveryPhone && <Check className="w-5 h-5 text-emerald-500" />}
          </div>
        </CardHeader>
        <CardContent>
          {editMode === 'phone' ? (
            <div className="flex gap-2">
              <Input
                type="tel"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={t('settings.recovery.phonePlaceholder', 'Enter phone number')}
                className="flex-1"
              />
              <Button onClick={handleSave} disabled={saving || !!loadError}>
                {saving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
              </Button>
              <Button variant="outline" onClick={() => setEditMode(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-c-text-secondary">
                {recoveryOptions.recoveryPhone
                  ? maskPhone(recoveryOptions.recoveryPhone)
                  : t('settings.recovery.notSet', 'Not configured')}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!!loadError}
                onClick={() => {
                  setEditMode('phone');
                  setEditValue(recoveryOptions.recoveryPhone);
                }}
              >
                {recoveryOptions.recoveryPhone
                  ? t('common.change', 'Change')
                  : t('common.add', 'Add')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Codes */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-c-accent-soft rounded-lg">
                <Key className="w-5 h-5 text-c-accent" />
              </div>
              <div>
                <CardTitle className="text-base">
                  {t('settings.recovery.backupCodes', 'Backup Codes')}
                </CardTitle>
                <CardDescription>
                  {t(
                    'settings.recovery.backupCodesDesc',
                    'One-time use codes for account recovery'
                  )}
                </CardDescription>
              </div>
            </div>
            {hasBackupCodes && <Check className="w-5 h-5 text-emerald-500" />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-c-text-secondary">
                {recoveryOptions.backupCodesCount > 0
                  ? t('settings.recovery.codesRemaining', '{{count}} codes remaining', {
                      count: recoveryOptions.backupCodesCount,
                    })
                  : t('settings.recovery.noCodes', 'No backup codes generated')}
              </span>
              {recoveryOptions.lastBackupCodesGenerated && (
                <p className="text-xs text-c-text-secondary mt-1">
                  {t('settings.recovery.lastGenerated', 'Last generated: {{date}}', {
                    date: new Date(recoveryOptions.lastBackupCodesGenerated).toLocaleDateString(),
                  })}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateBackupCodes}
              disabled={generatingCodes || !!loadError}
            >
              {generatingCodes ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              {recoveryOptions.backupCodesCount > 0
                ? t('settings.recovery.regenerate', 'Regenerate')
                : t('settings.recovery.generate', 'Generate')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t('settings.recovery.backupCodesTitle', 'Your Backup Codes')}
            </DialogTitle>
            <DialogDescription>
              {t(
                'settings.recovery.backupCodesDialogDesc',
                'Save these codes in a secure location. Each code can only be used once.'
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{t('settings.recovery.warning', 'Important')}</AlertTitle>
              <AlertDescription>
                {t(
                  'settings.recovery.warningDesc',
                  'These codes will only be shown once. Make sure to save them now.'
                )}
              </AlertDescription>
            </Alert>
            <div className="grid grid-cols-2 gap-2 p-4 bg-c-surface-raised rounded-lg font-mono text-sm">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="px-3 py-2 bg-c-surface rounded border border-c-border-subtle dark:border-navy-600"
                >
                  {code}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleCopyCodes}>
                <Copy className="w-4 h-4 mr-2" />
                {t('common.copy', 'Copy')}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownloadCodes}>
                <Download className="w-4 h-4 mr-2" />
                {t('common.download', 'Download')}
              </Button>
            </div>
            <Button onClick={() => setShowBackupCodes(false)}>
              {t('settings.recovery.savedCodes', "I've saved my codes")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecoveryOptionsSettings;
