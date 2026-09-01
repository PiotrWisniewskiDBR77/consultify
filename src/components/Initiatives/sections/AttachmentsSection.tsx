/**
 * AttachmentsSection wrapper
 *
 * DZIEŃ 2026-09-01 — naprawa utraty danych: `onUpload`/`onDelete` wołały
 * WYŁĄCZNIE `URL.createObjectURL` (efemeryczny odnośnik w pamięci przeglądarki)
 * i pokazywały komunikat sukcesu bez jakiegokolwiek wywołania API — po
 * odświeżeniu strony załącznik znikał bez śladu. Wzorzec naprawy przejęty
 * 1:1 z `TaskDetailView.tsx` (`uploadTaskAttachmentsAndReload`) i
 * `DecisionDetailView.tsx` (`uploadDecisionAttachmentsAndReload`): realne
 * wywołanie `/my-work/object-attachments/initiative/:id`, przeładowanie
 * listy Z SERWERA, komunikat sukcesu tylko gdy `SharedAttachmentsSection`
 * dostanie `{ ok: true }` (toast leży po stronie wspólnego komponentu, nie
 * tutaj — podwójne/fałszywe powiadomienie było częścią tego samego defektu).
 */

import React from 'react';

import { Api } from '@/services/api';

import type { Attachment } from '../../MyWork/shared';
import { AttachmentsSection as SharedAttachmentsSection } from '../../MyWork/shared';
import { useInitiativeContext } from './InitiativeContext';
import type { InitiativeSectionProps } from './types';

type InitiativeObjectAttachmentApi = Pick<typeof Api, 'get' | 'postMultipart' | 'delete'>;

const mapInitiativeServerAttachment = (initiativeId: string, attachment: any): Attachment => ({
  id: String(attachment.id),
  name: String(attachment.fileName || 'attachment'),
  type: String(attachment.mimeType || 'application/octet-stream'),
  size: Number(attachment.sizeBytes || 0),
  url: `/my-work/object-attachments/initiative/${encodeURIComponent(initiativeId)}/${encodeURIComponent(String(attachment.id))}/download`,
  uploadedAt: String(attachment.createdAt || ''),
  uploadedBy: attachment.createdBy ? String(attachment.createdBy) : undefined,
});

export async function uploadInitiativeAttachmentsAndReload(
  api: InitiativeObjectAttachmentApi,
  initiativeId: string,
  files: File[]
): Promise<Attachment[]> {
  const baseUrl = `/my-work/object-attachments/initiative/${encodeURIComponent(initiativeId)}`;
  for (const file of files) {
    const formData = new FormData();
    formData.append('file', file);
    await api.postMultipart(baseUrl, formData);
  }
  const response = await api.get(baseUrl);
  return (response.data.data || []).map((attachment: any) =>
    mapInitiativeServerAttachment(initiativeId, attachment)
  );
}

export async function loadInitiativeAttachments(
  api: Pick<typeof Api, 'get'>,
  initiativeId: string
): Promise<Attachment[]> {
  const baseUrl = `/my-work/object-attachments/initiative/${encodeURIComponent(initiativeId)}`;
  const response = await api.get(baseUrl);
  return (response.data.data || []).map((attachment: any) =>
    mapInitiativeServerAttachment(initiativeId, attachment)
  );
}

export async function deleteInitiativeAttachmentAndReload(
  api: InitiativeObjectAttachmentApi,
  initiativeId: string,
  attachmentId: string
): Promise<Attachment[]> {
  const baseUrl = `/my-work/object-attachments/initiative/${encodeURIComponent(initiativeId)}`;
  await api.delete(`${baseUrl}/${encodeURIComponent(attachmentId)}`);
  const response = await api.get(baseUrl);
  return (response.data.data || []).map((attachment: any) =>
    mapInitiativeServerAttachment(initiativeId, attachment)
  );
}

export const AttachmentsSection: React.FC<InitiativeSectionProps> = ({
  sectionType,
  expanded,
  onToggle,
}) => {
  const { attachments, setAttachments, initiativeId } = useInitiativeContext();

  return (
    <SharedAttachmentsSection
      attachments={attachments}
      onUpload={async (files) => {
        if (!initiativeId) {
          return { ok: false as const, error: new Error('Save the initiative first') };
        }
        try {
          const reloaded = await uploadInitiativeAttachmentsAndReload(
            Api,
            initiativeId,
            Array.from(files)
          );
          setAttachments(reloaded);
          return { ok: true as const };
        } catch (error) {
          return { ok: false as const, error };
        }
      }}
      onDelete={async (id) => {
        if (!initiativeId) {
          return { ok: false as const, error: new Error('Save the initiative first') };
        }
        try {
          const reloaded = await deleteInitiativeAttachmentAndReload(Api, initiativeId, id);
          setAttachments(reloaded);
          return { ok: true as const };
        } catch (error) {
          return { ok: false as const, error };
        }
      }}
      expanded={expanded}
      onToggleExpand={onToggle}
    />
  );
};
