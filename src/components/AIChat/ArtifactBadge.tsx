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
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-c-surface-raised dark:bg-c-surface-raised border border-c-border dark:border-c-border rounded-lg text-xs group/art">
      <ArtIcon size={13} className="text-c-text-secondary shrink-0" />
      <span className="font-medium text-c-text-secondary dark:text-c-text-secondary max-w-[150px] truncate">
        {(artifact as any).title || 'Artifact'}
      </span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpenInPanel(artifact);
        }}
        className="p-0.5 rounded text-c-text-secondary hover:text-c-text dark:hover:text-c-text hover:bg-c-surface-hover dark:hover:bg-c-surface-hover transition-colors"
        title={t('chat.actions.openPanel', 'Open in panel')}
      >
        <ExternalLink size={11} />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDownload(artifact);
        }}
        className="p-0.5 rounded text-c-text-secondary hover:text-c-text dark:hover:text-c-text hover:bg-c-surface-hover dark:hover:bg-c-surface-hover transition-colors"
        title={t('chat.actions.download', 'Download')}
      >
        <Download size={11} />
      </button>
    </div>
  );
};

export default ArtifactBadge;
