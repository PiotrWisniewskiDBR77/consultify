/**
 * ExportSharePanel
 *
 * Panel for exporting reports to PDF and creating/managing share links.
 */

import {
  AlertTriangle,
  Calendar,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  Link2,
  Loader2,
  Lock,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

// ==========================================
// TYPES
// ==========================================

interface ShareLink {
  id: string;
  token: string;
  url: string;
  hasPassword: boolean;
  expiresAt?: string;
  viewCount: number;
  createdAt: string;
}

interface BlockForReadiness {
  id: string;
  title: string;
  enabled: boolean;
  content?: string;
  isGenerated?: boolean;
}

interface ExportSharePanelProps {
  reportId: string;
  reportTitle?: string;
  reportStatus: string;
  onExportPdf: () => Promise<void>;
  onExportPptx?: () => Promise<void>;
  onExportWord?: () => Promise<void>;
  onCreateShareLink: (options?: {
    password?: string;
    expiresInDays?: number;
    showCompanyLogo?: boolean;
    showConsultifyBranding?: boolean;
    customMessage?: string;
  }) => Promise<{
    id: string;
    token: string;
    url: string;
    hasPassword: boolean;
    expiresAt?: string;
  } | null>;
  onGetShareLinks: () => Promise<ShareLink[] | null>;
  onRevokeShareLink: (linkId: string) => Promise<boolean>;
  isLoading?: boolean;
  /** Blocks for readiness check (optional) */
  blocks?: BlockForReadiness[];
}

interface QualityGateResponse {
  canExport: boolean;
  gates: Array<{ id: string; severity: 'error' | 'warning' | 'info'; message: string }>;
}

// ==========================================
// COMPONENT
// ==========================================

export const ExportSharePanel: React.FC<ExportSharePanelProps> = ({
  reportId,
  reportTitle,
  reportStatus,
  onExportPdf,
  onExportPptx,
  onExportWord,
  onCreateShareLink,
  onGetShareLinks,
  onRevokeShareLink,
  isLoading = false,
  blocks = [],
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [isCreatingLink, setIsCreatingLink] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [qualityReport, setQualityReport] = useState<QualityGateResponse | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);

  // Share link form state
  const [password, setPassword] = useState('');
  const [expiresInDays, setExpiresInDays] = useState<number | ''>('');
  const [customMessage, setCustomMessage] = useState('');
  const [showBranding, setShowBranding] = useState(true);

  // Load share links when modal opens
  useEffect(() => {
    if (showShareModal) {
      loadShareLinks();
    }
  }, [showShareModal]);

  useEffect(() => {
    let cancelled = false;
    setQualityLoading(true);
    Api.get(`/api/report-builder/${reportId}/quality-gates`)
      .then((result: any) => {
        if (!cancelled) setQualityReport(result as QualityGateResponse);
      })
      .catch(() => {
        if (!cancelled) setQualityReport(null);
      })
      .finally(() => {
        if (!cancelled) setQualityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportId]);

  const loadShareLinks = async () => {
    setIsLoadingLinks(true);
    const links = await onGetShareLinks();
    setShareLinks(links || []);
    setIsLoadingLinks(false);
  };

  const handleExportPdf = async () => {
    await onExportPdf();
  };

  const handleExportPptx = async () => {
    if (!onExportPptx) return;
    await onExportPptx();
  };

  const handleExportWord = async () => {
    if (!onExportWord) return;
    await onExportWord();
  };

  const handleCreateLink = async () => {
    setIsCreatingLink(true);
    const link = await onCreateShareLink({
      password: password || undefined,
      expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      customMessage: customMessage || undefined,
      showConsultifyBranding: showBranding,
      showCompanyLogo: true,
    });

    if (link) {
      setShareLinks((prev) => [
        {
          ...link,
          viewCount: 0,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      // Reset form
      setPassword('');
      setExpiresInDays('');
      setCustomMessage('');
    }
    setIsCreatingLink(false);
  };

  const handleRevokeLink = async (linkId: string) => {
    const success = await onRevokeShareLink(linkId);
    if (success) {
      setShareLinks((prev) => prev.filter((l) => l.id !== linkId));
    }
  };

  const handleCopyLink = useCallback((link: ShareLink) => {
    const fullUrl = `${window.location.origin}${link.url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLinkId(link.id);
    setTimeout(() => setCopiedLinkId(null), 2000);
  }, []);

  const canShare = ['GENERATED', 'IN_REVIEW', 'APPROVED', 'UTILIZED'].includes(reportStatus);

  // ==========================================
  // READINESS WARNINGS
  // ==========================================

  const readinessWarnings = useMemo(() => {
    const warnings: Array<{ type: 'error' | 'warning'; message: string }> = [];

    // Check for enabled blocks without content
    const enabledBlocks = blocks.filter((b) => b.enabled);
    const emptyBlocks = enabledBlocks.filter((b) => !b.content || b.content.trim().length === 0);
    const notGeneratedBlocks = enabledBlocks.filter((b) => !b.isGenerated && !b.content);

    if (enabledBlocks.length === 0) {
      warnings.push({
        type: 'error',
        message: t(
          'reportBuilder.exportSharePanel.noEnabledBlocksInTheReport',
          'No enabled blocks in the report'
        ),
      });
    }

    if (emptyBlocks.length > 0) {
      warnings.push({
        type: 'warning',
        message: t('reportBuilder.exportSharePanel.nBlocksWithoutContent', {
          defaultValue: `${emptyBlocks.length} block(s) without content: ${emptyBlocks.map((b) => b.title).join(', ')}`,
          count: emptyBlocks.length,
          titles: emptyBlocks.map((b) => b.title).join(', '),
        }),
      });
    }

    if (notGeneratedBlocks.length > 0 && emptyBlocks.length === 0) {
      warnings.push({
        type: 'warning',
        message: t('reportBuilder.exportSharePanel.nBlocksNotGenerated', {
          defaultValue: `${notGeneratedBlocks.length} block(s) not generated`,
          count: notGeneratedBlocks.length,
        }),
      });
    }

    // Check report status
    if (!['GENERATED', 'IN_REVIEW', 'APPROVED', 'UTILIZED'].includes(reportStatus)) {
      warnings.push({
        type: 'error',
        message: t(
          'reportBuilder.exportSharePanel.reportHasNotBeenGeneratedYet',
          'Report has not been generated yet'
        ),
      });
    }

    for (const gate of qualityReport?.gates || []) {
      if (gate.severity !== 'error' && gate.severity !== 'warning') continue;
      warnings.push({
        type: gate.severity,
        message: gate.message,
      });
    }

    return warnings;
  }, [blocks, reportStatus, t, qualityReport]);

  const hasErrors =
    readinessWarnings.some((w) => w.type === 'error') || qualityReport?.canExport === false;
  const hasWarnings = readinessWarnings.length > 0;
  const exportDisabled = isLoading || qualityLoading || hasErrors;

  return (
    <div className="space-y-4">
      {/* Readiness Warnings */}
      {hasWarnings && (
        <div className="space-y-2">
          {readinessWarnings.map((warning, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 p-3 rounded-lg text-sm ${
                warning.type === 'error'
                  ? 'bg-danger-50 dark:bg-danger-900/20 text-danger-700 dark:text-danger-300 border border-danger-200 dark:border-danger-800'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{warning.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Export Buttons Row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Export PDF Button */}
        <button
          onClick={handleExportPdf}
          disabled={exportDisabled}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-c-surface border border-c-border-subtle rounded-lg hover:bg-c-surface-raised disabled:opacity-50"
        >
          {isLoading || qualityLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>PDF</span>
        </button>

        {/* Export PPTX Button */}
        {onExportPptx && (
          <button
            onClick={handleExportPptx}
            disabled={exportDisabled}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-c-surface border border-c-border-subtle rounded-lg hover:bg-c-surface-raised disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>PPTX</span>
          </button>
        )}

        {/* Export Word Button */}
        {onExportWord && (
          <button
            onClick={handleExportWord}
            disabled={exportDisabled}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-c-surface border border-c-border-subtle rounded-lg hover:bg-c-surface-raised disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            <span>{t('reportBuilder.exportSharePanel.docx', 'DOCX')}</span>
          </button>
        )}

        {/* Share Button */}
        <button
          onClick={() => setShowShareModal(true)}
          disabled={!canShare}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-c-text rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          title={
            !canShare
              ? t(
                  'reportBuilder.exportSharePanel.reportMustBeGenerated',
                  'Report must be generated'
                )
              : ''
          }
        >
          <Share2 className="w-4 h-4" />
          <span>{t('reportBuilder.exportSharePanel.share', 'Share')}</span>
        </button>
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-c-surface rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-c-border-subtle">
              <h3 className="font-semibold text-c-text flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-500" />
                {t('reportBuilder.exportSharePanel.shareReport', 'Share Report')}
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-c-text-secondary hover:text-c-text-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Create New Link Section */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-c-text">
                  {t('reportBuilder.exportSharePanel.createNewLink', 'Create New Link')}
                </h4>

                {/* Password */}
                <div>
                  <label className="block text-sm text-c-text-secondary mb-1">
                    <Lock className="w-3 h-3 inline mr-1" />
                    {t('reportBuilder.exportSharePanel.passwordOptional', 'Password (optional)')}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t(
                      'reportBuilder.exportSharePanel.leaveEmptyForPublicAccess',
                      'Leave empty for public access'
                    )}
                    className="w-full px-3 py-2 text-sm border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text"
                  />
                </div>

                {/* Expiration */}
                <div>
                  <label className="block text-sm text-c-text-secondary mb-1">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {t('reportBuilder.exportSharePanel.expiresAfterDays', 'Expires after (days)')}
                  </label>
                  <input
                    type="number"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value ? Number(e.target.value) : '')}
                    placeholder={t(
                      'reportBuilder.exportSharePanel.leaveEmptyForNoExpiration',
                      'Leave empty for no expiration'
                    )}
                    min={1}
                    className="w-full px-3 py-2 text-sm border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text"
                  />
                </div>

                {/* Custom Message */}
                <div>
                  <label className="block text-sm text-c-text-secondary mb-1">
                    <FileText className="w-3 h-3 inline mr-1" />
                    {t('reportBuilder.exportSharePanel.messageOptional', 'Message (optional)')}
                  </label>
                  <input
                    type="text"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder={t(
                      'reportBuilder.exportSharePanel.eGReportForManagement',
                      'E.g., "Report for management"'
                    )}
                    className="w-full px-3 py-2 text-sm border border-slate-200/60 dark:border-white/[0.03] rounded-lg bg-c-surface text-c-text"
                  />
                </div>

                {/* Branding Toggle */}
                <label className="flex items-center gap-2 text-sm text-c-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showBranding}
                    onChange={(e) => setShowBranding(e.target.checked)}
                    className="rounded border-c-border-subtle"
                  />
                  {t(
                    'reportBuilder.exportSharePanel.showConsultifyBranding',
                    'Show Consultify branding'
                  )}
                </label>

                <button
                  onClick={handleCreateLink}
                  disabled={isCreatingLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-c-text rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreatingLink ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  {t('reportBuilder.exportSharePanel.createLink', 'Create Link')}
                </button>
              </div>

              {/* Existing Links Section */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-c-text">
                  {t('reportBuilder.exportSharePanel.activeLinks', 'Active Links')}
                </h4>

                {isLoadingLinks ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-c-text-secondary" />
                  </div>
                ) : shareLinks.length === 0 ? (
                  <div className="text-center py-8 text-c-text-secondary">
                    {t('reportBuilder.exportSharePanel.noActiveLinks', 'No active links')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {shareLinks.map((link) => (
                      <div
                        key={link.id}
                        className="flex items-center justify-between p-3 bg-c-surface-raised rounded-lg border border-c-border-subtle"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm text-c-text">
                            <Link2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                            <span className="truncate font-mono text-xs">{link.url}</span>
                            {link.hasPassword && (
                              <Lock className="w-3 h-3 text-amber-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-c-text-secondary">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" />
                              {link.viewCount} {t('reportBuilder.exportSharePanel.views', 'views')}
                            </span>
                            {link.expiresAt && (
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {t('reportBuilder.exportSharePanel.expires', 'Expires')}:{' '}
                                {new Date(link.expiresAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={() => handleCopyLink(link)}
                            className="p-2 text-c-text-secondary hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            title={t('reportBuilder.exportSharePanel.copyLink', 'Copy link')}
                          >
                            {copiedLinkId === link.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRevokeLink(link.id)}
                            className="p-2 text-c-text-secondary hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded"
                            title={t('reportBuilder.exportSharePanel.revokeLink', 'Revoke link')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-c-border-subtle">
              <button
                onClick={() => setShowShareModal(false)}
                className="w-full px-4 py-2 text-c-text-secondary hover:bg-c-surface-raised rounded-lg"
              >
                {t('reportBuilder.exportSharePanel.close', 'Close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export type { BlockForReadiness };
export default ExportSharePanel;
