import { ChevronDown, Layers } from 'lucide-react';
import React, { useState } from 'react';

import { NModeMenu2 } from '@/components/shared/NModeLayout/NModeMenu2';

import { PracujZAI } from './PracujZAI';
import type { PracujZAIProps } from './PracujZAI.types';

export interface DocumentCardMenuSection {
  readonly id: string;
  readonly label: { readonly pl: string; readonly en: string };
}

interface DocumentCardMenu5Props {
  sections: readonly DocumentCardMenuSection[];
  activeSection: string;
  onSectionChange: (sectionId: string) => void;
  readMode: boolean;
  onReadModeChange?: (readMode: boolean) => void;
  ai: Omit<PracujZAIProps, 'aktywnaSekcja' | 'isPolish'>;
  isPolish?: boolean;
}

export const DocumentCardMenu5: React.FC<DocumentCardMenu5Props> = ({
  sections,
  activeSection,
  onSectionChange,
  readMode,
  onReadModeChange,
  ai,
  isPolish = true,
}) => {
  const [open, setOpen] = useState(false);
  return (
    <NModeMenu2
      isPolish={isPolish}
      readMode={readMode}
      onReadModeChange={onReadModeChange}
      sectionsMenu={
        <div className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:border-c-border hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <Layers size={14} aria-hidden />
            {isPolish ? 'Sekcje' : 'Sections'}
            <ChevronDown size={13} aria-hidden />
          </button>
          {open ? (
            <div role="menu" className="absolute left-0 top-full z-overlay mt-1 w-64 overflow-hidden rounded-xl border border-c-border bg-c-surface-raised py-1 shadow-lg">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  role="menuitem"
                  aria-current={section.id === activeSection ? 'true' : undefined}
                  onClick={() => {
                    onSectionChange(section.id);
                    setOpen(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-xs text-c-text-secondary hover:bg-state-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-c-focus"
                >
                  {isPolish ? section.label.pl : section.label.en}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      }
      aiButton={<PracujZAI {...ai} isPolish={isPolish} aktywnaSekcja={activeSection} />}
    />
  );
};

export default DocumentCardMenu5;
