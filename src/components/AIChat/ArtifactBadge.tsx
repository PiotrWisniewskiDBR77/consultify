/**
 * ArtifactBadge
 *
 * Renders a single artifact badge with type-specific icon,
 * "open in panel" button, and inline download button.
 *
 * Extracted from UnifiedChatPanel for maintainability.
 */

import { Download, ExternalLink, FileCode, FileText, GitBranch, Table2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Artifact } from '../../types';

// ============================================================================
// Types
// ============================================================================

export interface ArtifactBadgeProps {
  artifact: Artifact;
  onOpenInPanel: (artifact: Artifact) => void;
  onDownload: (artifact: Artifact) => void;
}

// ============================================================================
// Icon map
// ============================================================================

const ARTIFACT_ICONS: Record<string, React.ElementType> = {
  'pmo-document': FileText,
  table: Table2,
  diagram: GitBranch,
  code: FileCode,
};

// ============================================================================
// Component
// ============================================================================

export const ArtifactBadge: React.FC<ArtifactBadgeProps> = ({
  artifact,
  onOpenInPanel,
  onDownload,
}) => {
  const { t } = useTranslation();
  const ArtIcon = ARTIFACT_ICONS[(artifact as any).type || ''] || FileCode;

  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/30 rounded-lg text-xs group/art">
      <ArtIcon size={13} className="text-primary-500 shrink-0" />
      <span className="font-medium text-primary-700 dark:text-primary-300 max-w-[150px] truncate">
        {(artifact as any).title || 'Artifact'}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenInPanel(artifact);
        }}
        className="p-0.5 rounded text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-800/30 transition-colors"
        title={t('chat.actions.openPanel', 'Open in panel')}
      >
        <ExternalLink size={11} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDownload(artifact);
        }}
        className="p-0.5 rounded text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-800/30 transition-colors"
        title={t('chat.actions.download', 'Download')}
      >
        <Download size={11} />
      </button>
    </div>
  );
};

export default ArtifactBadge;
