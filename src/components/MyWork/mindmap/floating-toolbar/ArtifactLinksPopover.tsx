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
    <div className="w-72 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl p-3 space-y-3">
      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
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
                className="rounded-xl border border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface px-2.5 py-2"
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenArtifact(link)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="text-[11px] font-semibold text-c-text-secondary dark:text-c-text truncate">
                      {link.label || fallbackLabel}
                    </div>
                    <div className="mt-0.5 text-[10px] text-c-text-secondary dark:text-c-text-muted truncate">
                      {[artifactType, artifactId, link.linkRole].filter(Boolean).join(' • ')}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenArtifact(link)}
                    className="text-c-text-secondary hover:text-c-text dark:hover:text-c-text transition-colors"
                    title={isPl ? 'Otwórz artefakt' : 'Open artifact'}
                  >
                    <ExternalLink size={12} />
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onRemoveArtifact(link)}
                    className="text-c-text-secondary hover:text-c-danger transition-colors disabled:opacity-40"
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
        <div className="rounded-xl border border-dashed border-c-border-subtle dark:border-c-border-subtle px-3 py-4 text-center text-[11px] text-c-text-secondary dark:text-c-text-muted">
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
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-c-surface-raised dark:bg-c-surface px-3 py-2 text-[11px] font-semibold text-c-text-secondary dark:text-c-text disabled:opacity-40"
        >
          <Plus size={11} />
          {isPl ? 'Dołącz' : 'Attach'}
        </button>
        <button
          type="button"
          onClick={onOpenNodeDetail}
          className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-c-border-subtle dark:border-c-border-subtle px-3 py-2 text-[11px] font-semibold text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
        >
          <Link2 size={11} />
          {isPl ? 'Pełny widok' : 'Full view'}
        </button>
      </div>
    </div>
  );
};
