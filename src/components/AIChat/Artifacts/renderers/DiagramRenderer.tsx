/**
 * DiagramRenderer - Mermaid diagram rendering with zoom and export
 */

import { AlertTriangle, Code, Download, Eye, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import mermaid from 'mermaid';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DiagramRendererProps {
  content: string;
  className?: string;
}

// Initialize mermaid with default config
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
  },
  sequence: {
    useMaxWidth: true,
  },
  gantt: {
    useMaxWidth: true,
  },
});

export const DiagramRenderer: React.FC<DiagramRendererProps> = ({ content, className = '' }) => {
  const { t } = useTranslation();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [showCode, setShowCode] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  // Render mermaid diagram
  useEffect(() => {
    const renderDiagram = async () => {
      try {
        // Update mermaid theme based on current color scheme
        const isDark = document.documentElement.classList.contains('dark');
        mermaid.initialize({
          theme: isDark ? 'dark' : 'default',
        });

        const id = `mermaid-${Date.now()}`;
        const { svg: renderedSvg } = await mermaid.render(id, content);
        setSvg(renderedSvg);
        setError(null);
      } catch (err: any) {
        console.error('Mermaid rendering error:', err);
        setError(err.message || 'Failed to render diagram');
        setSvg('');
      }
    };

    renderDiagram();
  }, [content]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 25, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 25, 25));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoom(100);
  }, []);

  const handleDownload = useCallback(async () => {
    if (!svg) return;

    // Convert SVG to PNG using canvas
    const svgElement = svgContainerRef.current?.querySelector('svg');
    if (!svgElement) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width * 2; // 2x for better quality
      canvas.height = img.height * 2;
      ctx.scale(2, 2);
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = `diagram-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [svg]);

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
            {t('diagram.preview', 'Preview')}
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
            {t('diagram.code', 'Code')}
          </button>
        </div>

        {!showCode && !error && (
          <div className="flex items-center gap-1">
            <button
              onClick={handleZoomOut}
              disabled={zoom <= 25}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700 disabled:opacity-30"
              title={t('diagram.zoomOut', 'Zoom out')}
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[40px] text-center">
              {zoom}%
            </span>
            <button
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700 disabled:opacity-30"
              title={t('diagram.zoomIn', 'Zoom in')}
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700 ml-1"
              title={t('diagram.resetZoom', 'Reset zoom')}
            >
              <RotateCcw size={16} />
            </button>
            <button
              onClick={handleDownload}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700 ml-2"
              title={t('diagram.download', 'Download as PNG')}
            >
              <Download size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div ref={containerRef} className="flex-1 overflow-auto">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <AlertTriangle size={32} className="text-amber-500 mb-3" />
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
              {t('diagram.renderError', 'Failed to render diagram')}
            </p>
            <pre className="text-xs text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/20 p-3 rounded-lg max-w-md overflow-auto">
              {error}
            </pre>
            <button
              onClick={() => setShowCode(true)}
              className="mt-4 text-sm text-brand hover:text-brand-dark"
            >
              {t('diagram.viewSource', 'View source code')}
            </button>
          </div>
        ) : showCode ? (
          <pre className="p-4 text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
            {content}
          </pre>
        ) : (
          <div
            ref={svgContainerRef}
            className="flex items-center justify-center min-h-full p-4"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center top' }}
          >
            <div
              className="[&>svg]:max-w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('diagram.poweredBy', 'Powered by Mermaid')} • {content.split('\n').length}{' '}
          {t('diagram.lines', 'lines')}
        </p>
      </div>
    </div>
  );
};

export default DiagramRenderer;
