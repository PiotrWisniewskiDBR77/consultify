/**
 * AttachmentsSection wrapper
 */

import React from 'react';
import toast from 'react-hot-toast';

import type { Attachment } from '../../MyWork/shared';
import { AttachmentsSection as SharedAttachmentsSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

export const AttachmentsSection: React.FC<InitiativeSectionProps> = ({ sectionType, expanded, onToggle }) => {
  const { attachments, setAttachments, isPolish } = useInitiativeContext();

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
        toast.success(isPolish ? 'Załączniki dodane' : 'Attachments added');
      }}
      onDelete={async (id) => {
        setAttachments((prev) => prev.filter((a) => a.id !== id));
        toast.success(isPolish ? 'Załącznik usunięty' : 'Attachment removed');
      }}
      expanded={expanded}
      onToggleExpand={onToggle}
    />
  );
};
