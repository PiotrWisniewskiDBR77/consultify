/**
 * Export Controls Component
 * Buttons for exporting reports to PDF, PowerPoint, sharing
 */

import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  Presentation,
  Share2,
} from 'lucide-react';
import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface ExportControlsProps {
  reportId: string;
  onExportPDF?: () => Promise<string>;
  onExportPPTX?: () => Promise<string>;
  onShare?: () => Promise<{ shareUrl: string; expiresAt: string }>;
  onEmail?: () => void;
  disabled?: boolean;
  className?: string;
}

export const ExportControls: React.FC<ExportControlsProps> = ({
  reportId,
  onExportPDF,
  onExportPPTX,
  onShare,
  onEmail,
  disabled = false,
  className = '',
}) => {
  const { t } = useTranslation();
  const [exportingPDF, setExportingPDF] = useState(false);
  const [exportingPPTX, setExportingPPTX] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleExportPDF = async () => {
    if (!onExportPDF || exportingPDF) return;

    setExportingPDF(true);
    try {
      const url = await onExportPDF();
      window.open(url, '_blank');
      toast.success(t('reports.export.pdfSuccess', 'PDF wygenerowany pomyślnie'));
    } catch (error) {
      toast.error(t('reports.export.pdfError', 'Nie udało się wygenerować PDF'));
      console.error('PDF export error:', error);
    } finally {
      setExportingPDF(false);
    }
  };

  const handleExportPPTX = async () => {
    if (!onExportPPTX || exportingPPTX) return;

    setExportingPPTX(true);
    try {
      const url = await onExportPPTX();
      window.open(url, '_blank');
      toast.success(t('reports.export.pptxSuccess', 'PowerPoint wygenerowany pomyślnie'));
    } catch (error) {
      toast.error(t('reports.export.pptxError', 'Nie udało się wygenerować PowerPoint'));
      console.error('PPTX export error:', error);
    } finally {
      setExportingPPTX(false);
    }
  };

  const handleShare = async () => {
    if (!onShare || sharing) return;

    setSharing(true);

    // Optimistic update - show placeholder immediately
    const optimisticUrl = `/reports/shared/generating...`;
    setShareUrl(optimisticUrl);

    try {
      const result = await onShare();
      // Replace optimistic URL with real one
      setShareUrl(result.shareUrl);
      toast.success(t('reports.export.shareLinkCreated', 'Link do udostępniania utworzony'));
    } catch (error) {
      // Rollback optimistic update
      setShareUrl(null);
      toast.error(t('reports.export.shareLinkError', 'Nie udało się utworzyć linku'));
      console.error('Share error:', error);
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(window.location.origin + shareUrl);
      setCopied(true);
      toast.success(t('reports.export.linkCopied', 'Link skopiowany do schowka'));
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error(t('reports.export.copyError', 'Nie udało się skopiować linku'));
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Export PDF */}
      {onExportPDF && (
        <button
          onClick={handleExportPDF}
          disabled={disabled || exportingPDF}
          className="flex items-center gap-2 px-4 py-2 bg-danger-500 hover:bg-danger-600 disabled:bg-danger-300 text-white rounded-lg font-medium transition-colors"
        >
          {exportingPDF ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
          <span>Export PDF</span>
        </button>
      )}

      {/* Export PowerPoint */}
      {onExportPPTX && (
        <button
          onClick={handleExportPPTX}
          disabled={disabled || exportingPPTX}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-lg font-medium transition-colors"
        >
          {exportingPPTX ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Presentation size={18} />
          )}
          <span>Export PPTX</span>
        </button>
      )}

      {/* Share */}
      {onShare && (
        <>
          {shareUrl ? (
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-navy-800 rounded-lg">
              {shareUrl.includes('generating...') ? (
                // Optimistic state - show loading indicator
                <>
                  <Loader2 size={16} className="animate-spin text-primary-500" />
                  <span className="text-sm text-slate-500 dark:text-slate-400 italic">
                    Generating share link...
                  </span>
                </>
              ) : (
                // Real URL state
                <>
                  <span className="text-sm text-slate-600 dark:text-slate-300 max-w-[200px] truncate">
                    {window.location.origin + shareUrl}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-navy-700 rounded transition-colors"
                    title="Copy link"
                  >
                    {copied ? (
                      <Check size={16} className="text-emerald-500" />
                    ) : (
                      <Copy size={16} className="text-slate-500 dark:text-slate-400" />
                    )}
                  </button>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-navy-700 rounded transition-colors"
                    title="Open link"
                  >
                    <ExternalLink size={16} className="text-slate-500 dark:text-slate-400" />
                  </a>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={handleShare}
              disabled={disabled || sharing}
              className="flex items-center gap-2 px-4 py-2 bg-c-text hover:bg-c-text-secondary disabled:bg-c-border-strong text-c-bg rounded-lg font-medium transition-colors"
            >
              {sharing ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
              <span>Share Link</span>
            </button>
          )}
        </>
      )}

      {/* Email */}
      {onEmail && (
        <button
          onClick={onEmail}
          disabled={disabled}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white rounded-lg font-medium transition-colors"
        >
          <Mail size={18} />
          <span>Email</span>
        </button>
      )}

      {/* Download all as ZIP (future) */}
      <button
        disabled={disabled}
        className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50"
        title="Download all exports"
      >
        <Download size={18} />
        <span>All</span>
      </button>
    </div>
  );
};

export default ExportControls;
