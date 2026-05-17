import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '../ui/primitives/Button';
import { Modal } from '../ui/primitives/Modal';

type BookmarkRole = 'ai' | 'user';

type ChatBookmark = {
  id: string;
  content: string;
  role: BookmarkRole;
  timestamp?: string;
  savedAt: string;
};

function readBookmarks(): ChatBookmark[] {
  try {
    const raw = localStorage.getItem('chat_bookmarks');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ChatBookmark[]) : [];
  } catch {
    return [];
  }
}

function writeBookmarks(next: ChatBookmark[]) {
  try {
    localStorage.setItem('chat_bookmarks', JSON.stringify(next));
    window.dispatchEvent(new CustomEvent('chat:bookmarks-changed'));
  } catch {
    // ignore
  }
}

export function BookmarksModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onChanged = () => setRev((x) => x + 1);
    window.addEventListener('chat:bookmarks-changed', onChanged as any);
    return () => window.removeEventListener('chat:bookmarks-changed', onChanged as any);
  }, [open]);

  const bookmarks = useMemo(() => {
    const list = readBookmarks();
    return list
      .filter((b) => b && typeof b.id === 'string' && typeof b.savedAt === 'string')
      .sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rev]);

  const handleRemove = useCallback((id: string) => {
    const next = readBookmarks().filter((b) => b.id !== id);
    writeBookmarks(next);
    setRev((x) => x + 1);
  }, []);

  const handleClear = useCallback(() => {
    writeBookmarks([]);
    setRev((x) => x + 1);
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('chat.bookmarks.title', 'Bookmarks')}
      description={t('chat.bookmarks.description', 'Saved message snippets from chat.')}
      size="lg"
      footer={
        <div className="flex items-center gap-2 w-full">
          <Button
            variant="ghost"
            onClick={handleClear}
            disabled={bookmarks.length === 0}
            className="text-red-600 dark:text-red-400"
          >
            {t('chat.bookmarks.clear', 'Clear all')}
          </Button>
          <div className="flex-1" />
          <Button variant="secondary" onClick={onClose}>
            {t('common.close', 'Close')}
          </Button>
        </div>
      }
    >
      {bookmarks.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          {t('chat.bookmarks.empty', 'No bookmarks yet. Use “Bookmark” on a message to save it.')}
        </div>
      ) : (
        <div className="space-y-3">
          {bookmarks.map((b) => (
            <div
              key={b.id}
              className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-3"
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    b.role === 'user'
                      ? 'bg-slate-100 text-slate-700 dark:bg-navy-800 dark:text-slate-200'
                      : 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-200'
                  }`}
                >
                  {b.role === 'user' ? t('chat.role.user', 'User') : t('chat.role.ai', 'AI')}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">
                    {b.content}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                    {t('chat.bookmarks.savedAt', 'Saved')}: {new Date(b.savedAt).toLocaleString()}
                  </div>
                </div>

                <Button variant="ghost" size="sm" onClick={() => handleRemove(b.id)}>
                  {t('common.remove', 'Remove')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
