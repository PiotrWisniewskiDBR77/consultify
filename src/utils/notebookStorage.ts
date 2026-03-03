import type { NotebookPage, NotebookVisibility } from '@/types/myWork';

export type { NotebookPage, NotebookVisibility };

const STORAGE_PREFIX = 'consultify-notebook-pages-v1:';

const keyForUser = (userId: string) => `${STORAGE_PREFIX}${userId}`;

const safeParse = (raw: string | null): NotebookPage[] => {
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(Boolean).map((x: any) => ({
      id: String(x.id),
      title: String(x.title || ''),
      projectId: x.projectId ? String(x.projectId) : null,
      visibility: x.visibility === 'project' ? 'project' : 'private',
      tags: Array.isArray(x.tags) ? x.tags.map((t: any) => String(t)).filter(Boolean) : [],
      contentJson: x.contentJson ?? { type: 'doc', content: [] },
      contentText: String(x.contentText || ''),
      maturity: (['seed', 'growing', 'mature', 'actionable'] as const).includes(x.maturity)
        ? x.maturity
        : 'seed',
      icon: x.icon != null ? String(x.icon) : null,
      summary: x.summary != null ? String(x.summary) : null,
      status: (['inbox', 'active', 'converted', 'archived'] as const).includes(x.status)
        ? x.status
        : 'active',
      pinned: Boolean(x.pinned),
      convertedTo: Array.isArray(x.convertedTo) ? x.convertedTo : null,
      createdAt: String(x.createdAt || new Date().toISOString()),
      updatedAt: String(x.updatedAt || new Date().toISOString()),
    })) as NotebookPage[];
  } catch {
    return [];
  }
};

export const loadNotebookPages = (userId: string): NotebookPage[] => {
  if (typeof window === 'undefined') return [];
  try {
    return safeParse(window.localStorage.getItem(keyForUser(userId)));
  } catch {
    return [];
  }
};

export const saveNotebookPages = (userId: string, pages: NotebookPage[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(keyForUser(userId), JSON.stringify(pages));
  } catch {
    // ignore storage quota errors
  }
};

export const upsertNotebookPage = (userId: string, page: NotebookPage): NotebookPage[] => {
  const pages = loadNotebookPages(userId);
  const idx = pages.findIndex((p) => p.id === page.id);
  const next = [...pages];
  if (idx >= 0) next[idx] = page;
  else next.unshift(page);
  saveNotebookPages(userId, next);
  return next;
};

export const deleteNotebookPage = (userId: string, pageId: string): NotebookPage[] => {
  const pages = loadNotebookPages(userId).filter((p) => p.id !== pageId);
  saveNotebookPages(userId, pages);
  return pages;
};

export const createNotebookPage = (
  userId: string,
  input: Partial<
    Pick<
      NotebookPage,
      'title' | 'projectId' | 'visibility' | 'tags' | 'contentJson' | 'contentText'
    >
  >
): NotebookPage => {
  const now = new Date().toISOString();
  const page: NotebookPage = {
    id: `nb_${Math.random().toString(36).slice(2)}_${Date.now()}`,
    title: String(input.title || 'Untitled'),
    projectId: input.projectId ?? null,
    visibility: input.visibility === 'project' ? 'project' : 'private',
    tags: Array.isArray(input.tags) ? input.tags.map(String).filter(Boolean) : [],
    contentJson: input.contentJson ?? { type: 'doc', content: [] },
    contentText: String(input.contentText || ''),
    maturity: 'seed',
    icon: null,
    summary: null,
    status: 'active',
    pinned: false,
    convertedTo: null,
    createdAt: now,
    updatedAt: now,
  };
  upsertNotebookPage(userId, page);
  return page;
};
