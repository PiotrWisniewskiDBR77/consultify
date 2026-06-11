/**
 * chatRecentAttachments
 *
 * Shared localStorage store for the "+" menu's Recent flyout. Unlike the old
 * name-only list (which could not be re-attached and self-toasted an apology),
 * each entry now persists the server `docId`. Because the RAG vectors for an
 * uploaded attachment live server-side under that docId, re-attaching is just
 * "include this docId in the next message" — no re-upload needed. (Composer
 * audit A5.)
 */

export type RecentAttachment = {
  name: string;
  addedAt: number;
  docId?: string;
  mimeType?: string;
};

const RECENT_KEY = 'consultify-recent-attachments';
const MAX_RECENT = 6;

export function readRecentAttachments(): RecentAttachment[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((x: any) => ({
        name: String(x?.name || '').trim(),
        addedAt: Number(x?.addedAt || 0),
        docId: x?.docId ? String(x.docId) : undefined,
        mimeType: x?.mimeType ? String(x.mimeType) : undefined,
      }))
      .filter((x: RecentAttachment) => x.name && Number.isFinite(x.addedAt) && x.addedAt > 0)
      .sort((a: RecentAttachment, b: RecentAttachment) => b.addedAt - a.addedAt)
      .slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function writeAll(items: RecentAttachment[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(items.slice(0, MAX_RECENT)));
  } catch {
    /* ignore quota / disabled storage */
  }
}

/**
 * Upsert a recent attachment. Dedupes by docId when present, else by name, and
 * upgrades a name-only entry in place once its docId is known (the upload that
 * created the docId happens after the file is first picked).
 */
export function removeRecentAttachment(docId: string): RecentAttachment[] {
  const updated = readRecentAttachments().filter((x) => x.docId !== docId);
  writeAll(updated);
  return updated;
}

export function pushRecentAttachment(entry: {
  name: string;
  docId?: string;
  mimeType?: string;
}): RecentAttachment[] {
  const name = String(entry.name || '').trim();
  if (!name) return readRecentAttachments();
  const next: RecentAttachment = {
    name,
    addedAt: Date.now(),
    docId: entry.docId || undefined,
    mimeType: entry.mimeType || undefined,
  };
  const existing = readRecentAttachments().filter((x) => {
    if (next.docId && x.docId) return x.docId !== next.docId;
    return x.name !== name;
  });
  const merged = [next, ...existing].slice(0, MAX_RECENT);
  writeAll(merged);
  return merged;
}
