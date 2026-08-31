/**
 * AttachmentsSection wrapper
 */

import React from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import type { Attachment } from '../../MyWork/shared';
import { AttachmentsSection as SharedAttachmentsSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const AttachmentsSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { t } = useTranslation();
  const { attachments, setAttachments } = useInitiativeContext();

  return (
    <SharedAttachmentsSection
      attachments={attachments}
      onUpload={async (files) => {
        const newAttachments: Attachment[] = Array.from(files).map((f) => ({
          id: Math.random().toString(36).substr(2, 9),
          name: f.name,
          type: f.type,
          size: f.size,
          url: URL.createObjectURL(f),
          uploadedAt: new Date().toISOString(),
        }));
        setAttachments((prev) => [...prev, ...newAttachments]);
        toast.success(t('initiatives.attachmentsSection.attachmentsAdded'));
        return { ok: true } as const;
      }}
      onDelete={async (id) => {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
        toast.success(t('initiatives.attachmentsSection.attachmentRemoved'));
        return { ok: true } as const;
      }}
      expanded={expanded}
      onToggleExpand={onToggle}
    />
  );
};
