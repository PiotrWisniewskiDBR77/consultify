import React, { useEffect, useMemo, useState } from 'react';

import {
  type Attachment,
  AttachmentsSection,
  type MutationResult,
} from '@/components/MyWork/shared/AttachmentsSection';
import { Api } from '@/services/api';
import type { NotebookAttachment } from '@/types/myWork';

interface NotebookAttachmentsSectionProps {
  noteId: string;
  attachments: NotebookAttachment[];
  onUpload: (files: FileList) => Promise<void>;
  onDelete: (attachmentId: string) => Promise<void>;
}

const canPreviewAttachment = (attachment: NotebookAttachment) =>
  attachment.type.startsWith('image/') || attachment.type === 'application/pdf';

export const NotebookAttachmentsSection: React.FC<NotebookAttachmentsSectionProps> = ({
  noteId,
  attachments,
  onUpload,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (attachments.length > 0) {
      setExpanded(true);
    }
  }, [attachments.length]);

  useEffect(() => {
    let cancelled = false;
    const previousUrls = { ...previewUrls };
    const activeAttachmentIds = new Set(attachments.map((attachment) => attachment.id));

    Object.entries(previousUrls).forEach(([attachmentId, url]) => {
      if (!activeAttachmentIds.has(attachmentId)) {
        URL.revokeObjectURL(url);
      }
    });

    setPreviewUrls((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([attachmentId]) => activeAttachmentIds.has(attachmentId))
      )
    );

    const missingPreviewAttachments = attachments.filter(
      (attachment) => canPreviewAttachment(attachment) && !previousUrls[attachment.id]
    );

    if (missingPreviewAttachments.length === 0) {
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      missingPreviewAttachments.map(async (attachment) => {
        const { blob } = await Api.downloadNotebookAttachment(noteId, attachment.id);
        return {
          id: attachment.id,
          url: URL.createObjectURL(blob),
        };
      })
    )
      .then((entries) => {
        if (cancelled) {
          entries.forEach((entry) => URL.revokeObjectURL(entry.url));
          return;
        }
        setPreviewUrls((current) => ({
          ...current,
          ...Object.fromEntries(entries.map((entry) => [entry.id, entry.url])),
        }));
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [attachments, noteId]);

  useEffect(
    () => () => {
      Object.values(previewUrls).forEach((url) => URL.revokeObjectURL(url));
    },
    [previewUrls]
  );

  const sectionAttachments = useMemo<Attachment[]>(
    () =>
      attachments.map((attachment) => {
        const previewUrl = previewUrls[attachment.id];
        const previewReady = Boolean(previewUrl);
        return {
          id: attachment.id,
          name: attachment.name,
          type:
            canPreviewAttachment(attachment) && !previewReady
              ? 'application/octet-stream'
              : attachment.type,
          size: attachment.size,
          url: previewUrl || '',
          uploadedAt: attachment.uploadedAt,
          uploadedBy: attachment.uploadedBy,
        };
      }),
    [attachments, previewUrls]
  );

  const adaptMutation = async (mutation: () => Promise<void>): Promise<MutationResult> => {
    try {
      await mutation();
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  };

  return (
    <AttachmentsSection
      attachments={sectionAttachments}
      expanded={expanded}
      onToggleExpand={() => setExpanded((current) => !current)}
      onUpload={(files) => adaptMutation(() => onUpload(files))}
      onDelete={(attachmentId) => adaptMutation(() => onDelete(attachmentId))}
      onDownload={(attachment) => {
        void Api.downloadNotebookAttachment(noteId, attachment.id).then(({ blob, filename }) => {
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
        });
      }}
    />
  );
};
