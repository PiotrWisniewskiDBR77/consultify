/**
 * HTMLPreview - Sandboxed HTML preview with code view toggle
 */

import { AlertTriangle, Code, ExternalLink, Eye, RefreshCw } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface HTMLPreviewProps {
  content: string;
  className?: string;
}

export const HTMLPreview: React.FC<HTMLPreviewProps> = ({ content, className = '' }) => {
  const { t } = useTranslation();
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0); // For forcing iframe refresh
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sanitize HTML to prevent XSS - basic sanitization
  const { sanitizedHTML, parseError } = useMemo(() => {
    try {
      // Remove script tags and event handlers
      let safe = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
        .replace(/javascript:/gi, '');

      // Wrap in basic HTML structure if not present
      if (!safe.includes('<html') && !safe.includes('<!DOCTYPE')) {
        safe = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: system-ui, -apple-system, sans-serif;
      padding: 16px;
      line-height: 1.5;
      color: #1e293b;
    }
    @media (prefers-color-scheme: dark) {
      body { color: #e2e8f0; background: #0f172a; }
    }
  </style>
</head>
<body>
${safe}
</body>
</html>`;
      }

      return { sanitizedHTML: safe, parseError: null };
    } catch (_err) {
      return { sanitizedHTML: '', parseError: 'Failed to parse HTML' };
    }
  }, [content]);

  // Update error state when parseError changes
  useEffect(() => {
    setError(parseError);
  }, [parseError]);

  // Create blob URL for iframe
  const blobUrl = useMemo(() => {
    if (!sanitizedHTML) return '';
    const blob = new Blob([sanitizedHTML], { type: 'text/html' });
    return URL.createObjectURL(blob);
  }, [sanitizedHTML]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  const handleRefresh = () => {
    setKey((prev) => prev + 1);
  };

  const handleOpenInNewTab = () => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(sanitizedHTML);
      newWindow.document.close();
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-navy-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCode(false)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              !showCode
                ? 'bg-slate-800 dark:bg-white/[0.12] text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
            }`}
          >
            <Eye size={14} />
            {t('html.preview', 'Preview')}
          </button>
          <button
            onClick={() => setShowCode(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              showCode
                ? 'bg-slate-800 dark:bg-white/[0.12] text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700'
            }`}
          >
            <Code size={14} />
            {t('html.code', 'Code')}
          </button>
        </div>

        <div className="flex items-center gap-1">
          {!showCode && (
            <>
              <button
                onClick={handleRefresh}
                className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700"
                title={t('html.refresh', 'Refresh')}
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={handleOpenInNewTab}
                className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700"
                title={t('html.openInNewTab', 'Open in new tab')}
              >
                <ExternalLink size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {error ? (
          <div className="flex items-center justify-center h-full p-8 text-center">
            <div className="flex flex-col items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={24} />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : showCode ? (
          <div className="h-full overflow-auto">
            <pre className="p-4 text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {content}
            </pre>
          </div>
        ) : (
          <iframe
            key={key}
            ref={iframeRef}
            src={blobUrl}
            className="w-full h-full border-0 bg-white dark:bg-navy-900"
            sandbox="allow-same-origin"
            title="HTML Preview"
          />
        )}
      </div>

      {/* Security notice */}
      <div className="px-4 py-1.5 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
          <AlertTriangle size={12} />
          {t('html.sandboxNotice', 'HTML is sandboxed for security. Scripts are disabled.')}
        </p>
      </div>
    </div>
  );
};

export default HTMLPreview;
