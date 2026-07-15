/**
 * ArtifactLinkIndicator — V5-IDEA-33
 *
 * Tiny badge that appears on workspace objects (nodes, stickies, steps, rows)
 * when they have linked artifacts. Click to expand preview list.
 *
 * Per ARTIFACT_LINKING_V5_SSOT §8.2: icon + count, lightweight, no clutter.
 */
import { ChevronDown, ExternalLink, Link2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ArtifactType } from '../../../utils/artifactLinks';
import { ARTIFACT_IDENTITY, buildArtifactCode } from '../../../utils/artifactLinks';

export interface LinkedArtifactItem {
  type: ArtifactType;
  id: string;
  title: string;
  linkRole?: string;
  pinned?: boolean;
}

export interface ArtifactLinkIndicatorProps {
  links: LinkedArtifactItem[];
  onOpen?: (ref: { type: ArtifactType; id: string }) => void;
  onRemove?: (ref: { type: ArtifactType; id: string }) => void;
  onAttach?: () => void;
  isPl?: boolean;
  size?: 'sm' | 'md';
}

export const ArtifactLinkIndicator: React.FC<ArtifactLinkIndicatorProps> = ({
  links,
  onOpen,
  onRemove,
  onAttach,
  isPl = false,
  size = 'sm',
}) => {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT(isPl ? 'pl' : 'en');
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((p) => !p), []);

  if (links.length === 0 && !onAttach) return null;

  const iconSize = size === 'sm' ? 8 : 10;
  const textSize = size === 'sm' ? 'text-[8px]' : 'text-[9px]';

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={toggle}
        className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded ${textSize} font-medium text-blue-500 dark:text-blue-400 bg-blue-500/10 dark:bg-blue-500/15 hover:bg-blue-500/20 dark:hover:bg-blue-500/25 transition-colors`}
        title={t('sharedComponents.artifactLinkIndicator.linkedCount', { count: links.length })}
      >
        <Link2 size={iconSize} />
        {links.length > 0 && <span>{links.length}</span>}
        <ChevronDown
          size={iconSize}
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="absolute top-full left-0 mt-1 z-50 w-[220px] bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200/60 dark:border-white/[0.06] overflow-hidden">
          <div className="max-h-[200px] overflow-y-auto p-1.5 space-y-0.5">
            {links.map((link) => {
              const identity = ARTIFACT_IDENTITY[link.type];
              const accent = identity?.accent || 'slate';
              return (
                <div
                  key={`${link.type}:${link.id}`}
                  className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100/60 dark:hover:bg-white/[0.03] group"
                >
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center text-[8px] font-bold bg-${accent}-500/10 text-${accent}-500`}
                  >
                    {(identity?.prefix || 'A').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpen?.({ type: link.type, id: link.id })}
                      className="text-[9px] font-semibold text-slate-700 dark:text-slate-300 truncate block w-full text-left hover:underline"
                    >
                      {link.title}
                    </button>
                    <div className="text-[7px] text-slate-600 dark:text-slate-500">
                      {buildArtifactCode(link.type, link.id)}
                      {link.linkRole ? ` · ${link.linkRole}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onOpen && (
                      <button
                        type="button"
                        onClick={() => onOpen({ type: link.type, id: link.id })}
                        className="p-0.5 rounded hover:bg-white/20 text-slate-600"
                        title={t('sharedComponents.artifactLinkIndicator.open')}
                      >
                        <ExternalLink size={8} />
                      </button>
                    )}
                    {onRemove && (
                      <button
                        type="button"
                        onClick={() => onRemove({ type: link.type, id: link.id })}
                        className="p-0.5 rounded hover:bg-danger-500/10 text-slate-600 hover:text-danger-500"
                        title={t('sharedComponents.artifactLinkIndicator.remove')}
                      >
                        <X size={8} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {onAttach && (
            <button
              type="button"
              onClick={() => {
                onAttach();
                setExpanded(false);
              }}
              className="w-full flex items-center justify-center gap-1 px-2 py-1.5 text-[9px] font-medium text-blue-500 hover:bg-blue-500/5 border-t border-slate-200/40 dark:border-white/[0.04] transition-colors"
            >
              <Link2 size={8} />
              {t('sharedComponents.artifactLinkIndicator.attachArtifact')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ArtifactLinkIndicator;
