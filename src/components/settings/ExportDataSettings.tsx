/**
 * ExportDataSettings - GDPR data export and account management
 *
 * Features:
 * - Request data export
 * - Download exported data
 * - Export history
 * - Data retention info
 *
 * Backend endpoint: POST /api/settings/export-data
 * Account deletion: POST /api/settings/gdpr/deletion-request (bcrypt-gated, canonical)
 */

import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  FileText,
  HardDrive,
  Info,
  Loader2,
  Mail,
  Shield,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed';

import { Api } from '../../services/api';
import { User } from '../../types';
import { normalizeApiErrorMessage } from '../../utils/apiError';
import { DegradedState } from '../Admin/AdminState';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Button } from '../ui/primitives/Button';
import { Select } from '../ui/select';
import { Separator } from '../ui/separator';
import { Skeleton } from '../ui/skeleton';
import { useToast } from '../ui/use-toast';

interface ExportRequest {
  id: string;
  status: 'pending' | 'processing' | 'ready' | 'expired';
  requestedAt: string;
  completedAt?: string;
  expiresAt?: string;
  downloadUrl?: string;
  format: string;
  size?: string;
}

interface ExportDataSettingsProps {
  currentUser: User;
}

const normalizeExportRequests = (data: unknown): ExportRequest[] => {
  const requests = Array.isArray((data as { requests?: unknown })?.requests)
    ? (data as { requests: unknown[] }).requests
    : data;
  if (!Array.isArray(requests)) {
    throw new Error('Export history response was invalid');
  }
  return requests as ExportRequest[];
};

export const ExportDataSettings: React.FC<ExportDataSettingsProps> = ({
  currentUser: _currentUser,
}) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [exportRequests, setExportRequests] = useState<ExportRequest[]>([]);
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>('json');
  const [includeOptions, setIncludeOptions] = useState({
    profile: true,
    preferences: true,
    activity: true,
    documents: false,
    messages: false,
  });

  const fetchExports = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      setHistoryLoadError(null);
      const data = await Api.get('/settings/export-history');
      const requests = normalizeExportRequests(data);
      setExportRequests(requests);
      return requests;
    } catch (error: unknown) {
      setExportRequests([]);
      setHistoryLoadError(normalizeApiErrorMessage(error, 'Failed to load export history'));
      return null;
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  // Fetch export history
  useEffect(() => {
    fetchExports();
  }, [fetchExports]);

  // Request data export
  const handleRequestExport = async () => {
    setRequesting(true);
    setActionError(null);
    try {
      const response = await Api.post('/settings/export-data', {
        format: exportFormat,
        include: includeOptions,
      });

      const requestId = response?.requestId || response?.id;
      if (!requestId) {
        throw new Error('Export request response did not include a request id');
      }
      const refreshedRequests = await fetchExports(false);
      if (!refreshedRequests?.some((request) => request.id === requestId)) {
        throw new Error('Data export request was not confirmed by the server');
      }

      toast({
        title: t('settings.export.requested', 'Export Requested'),
        description: t(
          'settings.export.requestedDesc',
          'You will receive an email when your data is ready for download'
        ),
      });

      setShowExportDialog(false);
    } catch (error: unknown) {
      const message = normalizeApiErrorMessage(error, 'Failed to request data export');
      setActionError(message);
      toast({
        title: t('settings.export.error', 'Error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setRequesting(false);
    }
  };

  // Get status badge
  const getStatusBadge = (status: ExportRequest['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="w-3 h-3" />
            {t('settings.export.statusPending', 'Pending')}
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            <Loader2 className="w-3 h-3 animate-spin" />
            {t('settings.export.statusProcessing', 'Processing')}
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            {t('settings.export.statusReady', 'Ready')}
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-c-surface-raised text-c-text-secondary">
            <AlertCircle className="w-3 h-3" />
            {t('settings.export.statusExpired', 'Expired')}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info Alert */}
      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400"
        >
          {actionError}
        </div>
      )}

      {/* Info Alert */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>{t('settings.export.gdprTitle', 'Your Data Rights')}</AlertTitle>
        <AlertDescription>
          {t(
            'settings.export.gdprDesc',
            'Under GDPR, you have the right to access and download all personal data we hold about you. Data exports are available for 7 days after processing.'
          )}
        </AlertDescription>
      </Alert>

      {/* Request Export Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-c-accent-soft rounded-lg">
              <FileArchive className="w-5 h-5 text-c-accent" />
            </div>
            <div>
              <CardTitle>{t('settings.export.title', 'Export Your Data')}</CardTitle>
              <CardDescription>
                {t('settings.export.description', 'Download a copy of all your personal data')}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-c-text-secondary">
              {t(
                'settings.export.info',
                'Your export will include your profile information, settings, activity history, and other personal data. Processing typically takes 24-48 hours.'
              )}
            </p>
            <Button onClick={() => setShowExportDialog(true)}>
              <Download className="w-4 h-4 mr-2" />
              {t('settings.export.request', 'Request Data Export')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('settings.export.history', 'Export History')}
          </CardTitle>
          <CardDescription>
            {t('settings.export.historyDesc', 'Your recent data export requests')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyLoadError ? (
            <DegradedState title="Export history unavailable" description={historyLoadError} />
          ) : exportRequests.length === 0 ? (
            <EmptyState
              icon={<FileText />}
              title={t('settings.export.noHistory', 'No export requests yet')}
            />
          ) : (
            <div className="space-y-3">
              {exportRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 bg-c-surface-raised rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-c-surface rounded-lg shadow-sm">
                      <FileArchive className="w-5 h-5 text-c-text-secondary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-c-text">
                          {t('settings.export.dataExport', 'Data Export')}
                        </span>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-c-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(request.requestedAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {request.format}
                        </span>
                        {request.size && (
                          <span className="flex items-center gap-1">
                            <HardDrive className="w-3 h-3" />
                            {request.size}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {request.status === 'ready' && request.downloadUrl && (
                    <Button variant="outline" size="sm">
                      <Download className="w-4 h-4 mr-2" />
                      {t('common.download', 'Download')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Included Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('settings.export.whatIncluded', "What's Included")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: FileText, title: 'Profile Information', desc: 'Name, email, avatar, bio' },
              { icon: Calendar, title: 'Activity History', desc: 'Login history, actions taken' },
              { icon: Mail, title: 'Communications', desc: 'Notifications, messages' },
              { icon: HardDrive, title: 'Documents & Files', desc: 'Uploaded files and documents' },
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="p-2 bg-c-surface-raised rounded-lg">
                  <item.icon className="w-4 h-4 text-c-text-muted" />
                </div>
                <div>
                  <p className="font-medium text-sm text-c-text">{item.title}</p>
                  <p className="text-xs text-c-text-muted">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('settings.export.dialogTitle', 'Request Data Export')}</DialogTitle>
            <DialogDescription>
              {t('settings.export.dialogDesc', 'Choose what data to include in your export')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Format Selection */}
            <div className="space-y-2">
              <Label>{t('settings.export.format', 'Export Format')}</Label>
              <Select
                value={exportFormat}
                onChange={(v) => setExportFormat(v as typeof exportFormat)}
                options={[
                  { value: 'json', label: 'JSON (Machine-readable)' },
                  { value: 'csv', label: 'CSV (Spreadsheet)' },
                  { value: 'pdf', label: 'PDF (Human-readable)' },
                ]}
                fullWidth
              />
            </div>

            <Separator />

            {/* Data Selection */}
            <div className="space-y-3">
              <Label>{t('settings.export.includeData', 'Include Data')}</Label>
              {Object.entries(includeOptions).map(([key, value]) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={key}
                    checked={value}
                    onCheckedChange={(checked) =>
                      setIncludeOptions((prev) => ({ ...prev, [key]: !!checked }))
                    }
                  />
                  <Label htmlFor={key} className="text-sm font-normal cursor-pointer">
                    {t(
                      `settings.export.include.${key}`,
                      key.charAt(0).toUpperCase() + key.slice(1)
                    )}
                  </Label>
                </div>
              ))}
            </div>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {t(
                  'settings.export.processingTime',
                  'Processing typically takes 24-48 hours. You will receive an email when your export is ready.'
                )}
              </AlertDescription>
            </Alert>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button onClick={handleRequestExport} disabled={requesting}>
              {requesting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('settings.export.requesting', 'Requesting...')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  {t('settings.export.request', 'Request Export')}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ExportDataSettings;
