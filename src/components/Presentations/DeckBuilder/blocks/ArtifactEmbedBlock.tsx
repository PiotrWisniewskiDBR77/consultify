import { ExternalLink } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const ArtifactEmbedBlock: React.FC<Props> = ({ block, theme }) => {
  const { t } = useTranslation();
  const artifactType = (block.content.artifact_type as string) || 'initiative';
  const artifactName =
    (block.content.artifact_name as string) ||
    t('presentations.builder.defaultContent.untitledArtifact', 'Artefakt bez nazwy');
  const status = (block.content.status as string) || '';

  return (
    <div
      className="rounded-lg p-3 flex items-center gap-3 border"
      style={{
        borderColor: theme.colors.primary + '20',
        backgroundColor: theme.colors.surface,
      }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
        style={{ backgroundColor: theme.colors.primary }}
      >
        {artifactType.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: theme.colors.heading }}>
          {artifactName}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[9px] capitalize" style={{ color: theme.colors.textSecondary }}>
            {artifactType.replace(/_/g, ' ')}
          </span>
          {status && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
              {status}
            </span>
          )}
        </div>
      </div>
      <ExternalLink size={12} style={{ color: theme.colors.textSecondary }} />
    </div>
  );
};
