/**
 * ArtifactsPanel - Main panel for displaying and managing AI-generated artifacts
 * Similar to Claude's Artifacts feature - shows code, documents, diagrams in a side panel
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  X, 
  Maximize2, 
  Minimize2, 
  Copy, 
  Download, 
  Edit3, 
  Check,
  ChevronLeft,
  ChevronRight,
  Code,
  FileText,
  Table,
  BarChart3,
  FileCode,
  Folder
} from 'lucide-react';
import { Artifact } from '../../../types';
import { ArtifactViewer } from './ArtifactViewer';
import { ArtifactEditor } from './ArtifactEditor';

interface ArtifactsPanelProps {
  artifacts: Artifact[];
  activeArtifactId: string | null;
  onSelectArtifact: (id: string) => void;
  onUpdateArtifact: (id: string, content: string) => void;
  onClose: () => void;
  onExport?: (artifact: Artifact, format: string) => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const ARTIFACT_ICONS: Record<Artifact['type'], React.ReactNode> = {
  code: <Code size={16} />,
  markdown: <FileText size={16} />,
  html: <FileCode size={16} />,
  diagram: <BarChart3 size={16} />,
  table: <Table size={16} />,
  'pmo-document': <Folder size={16} />
};

export const ArtifactsPanel: React.FC<ArtifactsPanelProps> = ({
  artifacts,
  activeArtifactId,
  onSelectArtifact,
  onUpdateArtifact,
  onClose,
  onExport,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const activeArtifact = artifacts.find(a => a.id === activeArtifactId) || artifacts[0];
  const currentIndex = artifacts.findIndex(a => a.id === activeArtifact?.id);

  const handleCopy = useCallback(async () => {
    if (!activeArtifact) return;
    try {
      await navigator.clipboard.writeText(activeArtifact.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [activeArtifact]);

  const handleDownload = useCallback(() => {
    if (!activeArtifact || !onExport) return;
    const format = activeArtifact.type === 'code' ? 'txt' : 
                   activeArtifact.type === 'markdown' ? 'md' :
                   activeArtifact.type === 'html' ? 'html' : 'txt';
    onExport(activeArtifact, format);
  }, [activeArtifact, onExport]);

  const handleSaveEdit = useCallback((content: string) => {
    if (activeArtifact) {
      onUpdateArtifact(activeArtifact.id, content);
      setIsEditing(false);
    }
  }, [activeArtifact, onUpdateArtifact]);

  const navigateArtifact = useCallback((direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' 
      ? Math.max(0, currentIndex - 1)
      : Math.min(artifacts.length - 1, currentIndex + 1);
    onSelectArtifact(artifacts[newIndex].id);
  }, [currentIndex, artifacts, onSelectArtifact]);

  if (artifacts.length === 0) {
    return null;
  }

  return (
    <div 
      className={`
        flex flex-col bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700
        ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 dark:text-slate-500">
            {ARTIFACT_ICONS[activeArtifact?.type || 'markdown']}
          </span>
          <h3 className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
            {activeArtifact?.title || t('artifacts.untitled', 'Untitled')}
          </h3>
          {activeArtifact?.language && (
            <span className="px-2 py-0.5 text-xs font-mono bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400 rounded">
              {activeArtifact.language}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Navigation for multiple artifacts */}
          {artifacts.length > 1 && (
            <div className="flex items-center gap-1 mr-2 pr-2 border-r border-slate-200 dark:border-navy-700">
              <button
                onClick={() => navigateArtifact('prev')}
                disabled={currentIndex === 0}
                className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-100 dark:hover:bg-navy-700"
                title={t('artifacts.previous', 'Previous')}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400 min-w-[40px] text-center">
                {currentIndex + 1} / {artifacts.length}
              </span>
              <button
                onClick={() => navigateArtifact('next')}
                disabled={currentIndex === artifacts.length - 1}
                className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed rounded hover:bg-slate-100 dark:hover:bg-navy-700"
                title={t('artifacts.next', 'Next')}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Edit button */}
          {activeArtifact?.editable && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`p-1.5 rounded transition-colors ${
                isEditing 
                  ? 'text-brand bg-brand/10' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-700'
              }`}
              title={isEditing ? t('artifacts.viewing', 'View') : t('artifacts.edit', 'Edit')}
            >
              <Edit3 size={16} />
            </button>
          )}

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            title={t('artifacts.copy', 'Copy')}
          >
            {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          </button>

          {/* Download button */}
          {onExport && (
            <button
              onClick={handleDownload}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              title={t('artifacts.download', 'Download')}
            >
              <Download size={16} />
            </button>
          )}

          {/* Fullscreen toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
              title={isFullscreen ? t('artifacts.exitFullscreen', 'Exit fullscreen') : t('artifacts.fullscreen', 'Fullscreen')}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors ml-1"
            title={t('common.close', 'Close')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Tabs for multiple artifacts */}
      {artifacts.length > 1 && (
        <div className="flex gap-1 px-2 py-2 overflow-x-auto border-b border-slate-200 dark:border-navy-700 bg-slate-50/50 dark:bg-navy-800/30 scrollbar-thin">
          {artifacts.map((artifact) => (
            <button
              key={artifact.id}
              onClick={() => onSelectArtifact(artifact.id)}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors
                ${artifact.id === activeArtifact?.id 
                  ? 'bg-white dark:bg-navy-700 text-brand shadow-sm border border-slate-200 dark:border-navy-600' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700/50'
                }
              `}
            >
              {ARTIFACT_ICONS[artifact.type]}
              <span className="max-w-[120px] truncate">{artifact.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeArtifact && (
          isEditing ? (
            <ArtifactEditor
              artifact={activeArtifact}
              onSave={handleSaveEdit}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            <ArtifactViewer artifact={activeArtifact} />
          )
        )}
      </div>

      {/* Footer with metadata */}
      {activeArtifact && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              {t('artifacts.version', 'Version')} {activeArtifact.version}
              {activeArtifact.metadata?.framework && (
                <span className="ml-2 px-1.5 py-0.5 bg-brand/10 text-brand rounded">
                  {activeArtifact.metadata.framework}
                </span>
              )}
            </span>
            <span>
              {new Date(activeArtifact.createdAt).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ArtifactsPanel;

