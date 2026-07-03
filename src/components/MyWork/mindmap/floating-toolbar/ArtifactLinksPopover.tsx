import { ExternalLink, Link2, Paperclip, Plus, Trash2 } from 'lucide-react';
import React from 'react';

import { type ArtifactLink, getArtifactLabel } from '@/utils/artifactLinks';

interface ArtifactLinksPopoverProps {
  isPl: boolean;
  disabled?: boolean;
  links: ArtifactLink[];
  onAttach: () => void;
  onOpenNodeDetail: () => void;
  onOpenArtifact: (link: ArtifactLink) => void;
  onRemoveArtifact: (link: ArtifactLink) => void;
}

export const ArtifactLinksPopover: React.FC<ArtifactLinksPopoverProps> = ({
  isPl,
  disabled = false,
  links,
  onAttach,
  onOpenNodeDetail,
  onOpenArtifact,
  onRemoveArtifact,
}) => {
  return (
    <div className="w-72 rounded-xl bg-white dark:bg-navy-900 border border-slate-200/60 dark:border-white/[0.06] shadow-xl p-3 space-y-3">
      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
        <Paperclip size={11} />
        {isPl ? 'Powiązane artefakty' : 'Linked artifacts'}
      </div>

      {links.length > 0 ? (
        <div className="space-y-1.5 max-h-48 overflow-auto pr-1">
          {links.map((link, index) => {
            const artifactType = link.artifactRef?.type;
            const artifactId = link.artifactRef?.id;
            const fallbackLabel =
              artifactType && artifactId
                ? `${getArtifactLabel(artifactType, isPl ? 'pl' : 'en')} ${artifactId}`
                : isPl
                  ? 'Artefakt'
                  : 'Artifact';
            return (
              <div
                key={`${artifactType || 'artifact'}-${artifactId || index}`}
                className="rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white/50 dark:bg-navy-950/20 px-2.5 py-2"
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenArtifact(link)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate">
                      {link.label || fallbackLabel}
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 truncate">
                      {[artifactType, artifactId, link.linkRole].filter(Boolean).join(' • ')}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenArtifact(link)}
                    className="text-slate-600 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
                    title={isPl ? 'Otwórz artefakt' : 'Open artifact'}
                  >
                    <ExternalLink size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemoveArtifact(link)}
                    className="text-slate-600 hover:text-danger-500 transition-colors disabled:opacity-40"
                    title={isPl ? 'Usuń powiązanie' : 'Remove link'}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200/80 dark:border-navy-700/80 px-3 py-4 text-center text-[11px] text-slate-500 dark:text-slate-400">
          {isPl
            ? 'Brak podłączonych artefaktów do tego węzła.'
            : 'No artifacts linked to this node yet.'}
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onAttach}
          disabled={disabled}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-slate-100 dark:bg-navy-800 px-3 py-2 text-[11px] font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40"
        >
          <Plus size={11} />
          {isPl ? 'Dołącz' : 'Attach'}
        </button>
        <button
          type="button"
          onClick={onOpenNodeDetail}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200/70 dark:border-navy-700/70 px-3 py-2 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
        >
          <Link2 size={11} />
          {isPl ? 'Pełny widok' : 'Full view'}
        </button>
      </div>
    </div>
  );
};
