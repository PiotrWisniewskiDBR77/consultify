import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Button from '@/components/ui/primitives/Button';

interface PresentationBriefModalProps {
  open: boolean;
  onSubmit: (brief: string) => void;
  onSkip: () => void;
}

export const PresentationBriefModal: React.FC<PresentationBriefModalProps> = ({
  open,
  onSubmit,
  onSkip,
}) => {
  const { t } = useTranslation();
  const [brief, setBrief] = useState('');

  useEffect(() => {
    if (open) setBrief('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onSkip();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onSkip]);

  if (!open) return null;

  const title = t('kimi.artifactHome.briefModal.title', 'What should this presentation be about?');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="presentation-brief-modal-title"
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4"
      data-testid="presentation-brief-modal"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onSkip();
      }}
    >
      <form
        className="w-full max-w-md rounded-xl border border-c-border bg-c-surface p-4 shadow-xl"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(brief);
        }}
      >
        <h2 id="presentation-brief-modal-title" className="text-sm font-semibold text-c-text">
          {title}
        </h2>
        <textarea
          autoFocus
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          rows={5}
          className="mt-3 w-full resize-y rounded-lg border border-c-border bg-c-background px-3 py-2 text-sm text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          aria-label={title}
          placeholder={t(
            'kimi.artifactHome.briefModal.placeholder',
            'Describe the goal, audience, key facts, dates, and numbers.'
          )}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onSkip}>
            {t('kimi.artifactHome.briefModal.skip', 'Skip')}
          </Button>
          <Button type="submit" variant="primary" size="sm">
            {t('kimi.artifactHome.briefModal.next', 'Next')}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default PresentationBriefModal;
