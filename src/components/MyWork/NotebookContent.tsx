import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { BookOpen, Plus, Search, Trash2 } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useAppStore } from '@/store/useAppStore';
import {
  createNotebookPage,
  deleteNotebookPage,
  loadNotebookPages,
  type NotebookPage,
  upsertNotebookPage,
} from '@/utils/notebookStorage';

interface NotebookCounts {
  total: number;
}

interface NotebookContentProps {
  projectId?: string | null;
  searchQuery: string;
  onCountsChange?: (counts: NotebookCounts) => void;
}

const extractText = (json: any): string => {
  try {
    const parts: string[] = [];
    const walk = (node: any) => {
      if (!node) return;
      if (typeof node.text === 'string') parts.push(node.text);
      if (Array.isArray(node.content)) node.content.forEach(walk);
    };
    walk(json);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
};

export const NotebookContent: React.FC<NotebookContentProps> = ({
  projectId,
  searchQuery,
  onCountsChange,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentUser } = useAppStore();

  const userId = currentUser?.id || 'anonymous';

  const [pages, setPages] = useState<NotebookPage[]>(() => loadNotebookPages(userId));
  const [activeId, setActiveId] = useState<string | null>(pages[0]?.id || null);
  const activePage = useMemo(() => pages.find((p) => p.id === activeId) || null, [pages, activeId]);

  const [title, setTitle] = useState(activePage?.title || '');
  const [pageProjectId, setPageProjectId] = useState(activePage?.projectId || '');
  const saveTimer = useRef<number | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder: isPolish ? 'Zacznij pisać…' : 'Start writing…',
      }),
    ],
    content: activePage?.contentJson || { type: 'doc', content: [] },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm max-w-none dark:prose-invert focus:outline-none min-h-[360px] px-3 py-3',
      },
    },
  });

  // Sync editor when switching pages
  useEffect(() => {
    if (!editor) return;
    if (!activePage) {
      editor.commands.setContent({ type: 'doc', content: [] }, { emitUpdate: false });
      setTitle('');
      setPageProjectId('');
      return;
    }
    editor.commands.setContent(activePage.contentJson || { type: 'doc', content: [] }, { emitUpdate: false });
    setTitle(activePage.title || '');
    setPageProjectId(activePage.projectId || '');
  }, [activePage?.id, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Counts
  useEffect(() => {
    onCountsChange?.({ total: pages.length });
  }, [pages.length, onCountsChange]);

  const filteredPages = useMemo(() => {
    const q = String(searchQuery || '')
      .trim()
      .toLowerCase();
    let list = pages;
    if (projectId) {
      list = list.filter((p) => p.projectId === projectId);
    }
    if (!q) return list;
    return list.filter((p) => {
      return (
        p.title.toLowerCase().includes(q) ||
        String(p.contentText || '')
          .toLowerCase()
          .includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [pages, projectId, searchQuery]);

  const scheduleSave = (next: Partial<NotebookPage>) => {
    if (!activePage) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const base = pages.find((p) => p.id === activePage.id);
      if (!base) return;
      const updated: NotebookPage = {
        ...base,
        ...next,
        updatedAt: new Date().toISOString(),
      };
      const nextPages = upsertNotebookPage(userId, updated);
      setPages(nextPages);
    }, 350);
  };

  const handleNewPage = () => {
    const page = createNotebookPage(userId, {
      title: isPolish ? 'Nowa strona' : 'New page',
      projectId: projectId || null,
      visibility: projectId ? 'project' : 'private',
      tags: [],
      contentJson: { type: 'doc', content: [] },
      contentText: '',
    });
    setPages(loadNotebookPages(userId));
    setActiveId(page.id);
    toast.success(isPolish ? 'Utworzono stronę' : 'Page created');
  };

  const handleDeletePage = () => {
    if (!activePage) return;
    const nextPages = deleteNotebookPage(userId, activePage.id);
    setPages(nextPages);
    setActiveId(nextPages[0]?.id || null);
    toast.success(isPolish ? 'Usunięto stronę' : 'Page deleted');
  };

  // Persist editor changes
  useEffect(() => {
    if (!editor || !activePage) return;
    const handler = () => {
      const json = editor.getJSON();
      const text = extractText(json);
      scheduleSave({ contentJson: json, contentText: text });
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
  }, [editor, activePage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-[calc(100vh-220px)] min-h-[520px]">
      {/* Sidebar */}
      <div className="w-72 shrink-0 border-r border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950">
        <div className="flex items-center justify-between px-3 py-3 border-b border-slate-200 dark:border-navy-800">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            <BookOpen size={16} />
            <span>{t('myWork.notebook.title', 'Notebook')}</span>
          </div>
          <button
            onClick={handleNewPage}
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            title={t('myWork.notebook.new', 'New page')}
            aria-label={t('myWork.notebook.new', 'New page')}
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="px-3 py-2 border-b border-slate-200 dark:border-navy-800">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 px-2 py-1.5">
            <Search size={14} className="text-slate-500 dark:text-slate-400" />
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('myWork.notebook.searchHint', 'Use the main search above')}
            </div>
          </div>
        </div>

        <div className="overflow-y-auto p-2 space-y-1">
          {filteredPages.length === 0 ? (
            <div className="p-3 text-xs text-slate-500 dark:text-slate-400">
              {t('myWork.notebook.empty', 'No pages yet')}
            </div>
          ) : (
            filteredPages.map((p) => {
              const isActive = p.id === activeId;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveId(p.id)}
                  className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-500/12 text-primary-700 dark:text-primary-300'
                      : 'hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="font-medium truncate">
                    {p.title || (isPolish ? 'Bez tytułu' : 'Untitled')}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {p.projectId
                      ? `${t('myWork.notebook.project', 'Project')}: ${p.projectId}`
                      : t('myWork.notebook.private', 'Private')}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 bg-slate-50 dark:bg-navy-950">
        {!activePage ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {t('myWork.notebook.noSelection', 'Select or create a page')}
              </div>
              <button
                onClick={handleNewPage}
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 text-sm font-medium"
              >
                <Plus size={16} />
                {t('myWork.notebook.new', 'New page')}
              </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950">
              <div className="flex-1 min-w-0">
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    scheduleSave({ title: e.target.value });
                  }}
                  placeholder={isPolish ? 'Tytuł strony…' : 'Page title…'}
                  className="w-full bg-transparent text-lg font-semibold text-slate-900 dark:text-white outline-none"
                />
                <div className="mt-1 flex items-center gap-2">
                  <input
                    value={pageProjectId}
                    onChange={(e) => {
                      setPageProjectId(e.target.value);
                      scheduleSave({
                        projectId: e.target.value || null,
                        visibility: e.target.value ? 'project' : 'private',
                      });
                    }}
                    placeholder={isPolish ? 'Project ID (opcjonalnie)' : 'Project ID (optional)'}
                    className="w-72 max-w-full rounded-md border border-slate-200 dark:border-navy-800 bg-slate-50 dark:bg-navy-900 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 outline-none"
                  />
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('myWork.notebook.autoSaved', 'Auto-saved')}
                  </span>
                </div>
              </div>
              <button
                onClick={handleDeletePage}
                className="ml-3 inline-flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.10] text-slate-700 dark:text-slate-200 px-3 py-2 text-sm font-medium"
                title={t('common.delete', 'Delete')}
              >
                <Trash2 size={16} />
                {t('common.delete', 'Delete')}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto max-w-4xl py-4">
                <div className="rounded-xl border border-slate-200 dark:border-navy-800 bg-white dark:bg-navy-950">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
