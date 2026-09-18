/**
 * K-29 (Wpis 138 / QB2) — task attachments drag & drop, REAL <AttachmentsSection>.
 *
 * Renders the production shared component (src/components/MyWork/shared/
 * AttachmentsSection.tsx) exactly as TaskDetailView mounts it: collapsed by
 * default, `onUpload` appends the dropped file (mimics the real
 * uploadTaskAttachmentsAndReload → setAttachments path), `onToggleExpand`
 * drives local expand state so the K-29 auto-expand-on-drop is visible.
 *
 * The driver (dev-render/qoder-k29-drop.mjs) dispatches a REAL `drop` event
 * with a small image File (→ uploads, thumbnail appears, success toast) and a
 * large File whose `size` reports 26 MB (→ rejected by the 25 MB guard with an
 * error toast, never uploaded). Theme/lang/Toaster come from the harness shell.
 *
 * URL: ?screen=k29-attachments-drop[&lang=en|pl][&theme=light|dark]
 */
import React, { useState } from 'react';

import {
  AttachmentsSection,
  type Attachment,
} from '../../src/components/MyWork/shared/AttachmentsSection';

export function K29AttachmentsDropScreen(): React.ReactElement {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [expanded, setExpanded] = useState(false);

  const onUpload = async (files: FileList) => {
    const next: Attachment[] = Array.from(files).map((f, i) => {
      const url = URL.createObjectURL(f);
      return {
        id: `att-${Date.now()}-${i}`,
        name: f.name,
        type: f.type || 'application/octet-stream',
        size: f.size,
        url,
        thumbnailUrl: f.type.startsWith('image/') ? url : undefined,
        uploadedAt: new Date().toISOString(),
        uploadedBy: 'Kasia (Northwind)',
      };
    });
    setAttachments((prev) => [...prev, ...next]);
    return { ok: true as const };
  };

  const onDelete = async (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
    return { ok: true as const };
  };

  return (
    <div style={{ padding: 32, maxWidth: 720, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 4, fontSize: 18, fontWeight: 600 }}>
        Task · Attachments (K-29)
      </h2>
      <p style={{ opacity: 0.7, marginBottom: 16, fontSize: 13 }}>
        Drop a file anywhere on the card — collapsed or expanded. Files over 25 MB are rejected
        with a message.
      </p>
      <AttachmentsSection
        attachments={attachments}
        onUpload={onUpload}
        onDelete={onDelete}
        expanded={expanded}
        onToggleExpand={() => setExpanded((v) => !v)}
      />
    </div>
  );
}

export default K29AttachmentsDropScreen;
