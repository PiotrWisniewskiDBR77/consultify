import { ArrowLeft, Loader2, Save, Trash2, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import type { MyIdea } from './MyIdeasListContent';

interface IdeaDetailViewProps {
  ideaId: string;
  onClose: () => void;
  onSaved: (idea: MyIdea) => void;
}

export const IdeaDetailView: React.FC<IdeaDetailViewProps> = ({ ideaId, onClose, onSaved }) => {
  const { i18n, t } = useTranslation();
  const isPolish = useMemo(() => i18n.language?.startsWith('pl'), [i18n.language]);

  const isNew = useMemo(() => ideaId.startsWith('new-idea-'), [ideaId]);

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (isNew) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const idea = (await Api.getMyIdea(ideaId)) as MyIdea;
        if (cancelled) return;
        setTitle(idea?.title || '');
        setBody((idea?.body as string) || '');
        setTags(Array.isArray(idea?.tags) ? (idea.tags as string[]) : []);
      } catch (err) {
        console.error('Failed to load idea:', err);
        toast.error(t('myWork.errors.fetchFailed', 'Failed to load idea'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [ideaId, isNew, t]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error(t('myWork.ideas.validation.titleRequired', 'Title is required'));
      return;
    }

    try {
      setSaving(true);
      let saved: any;
      if (isNew) {
        saved = await Api.createMyIdea({
          title: trimmedTitle,
          body: body?.trim() || '',
          tags,
          sourceType: 'manual',
        });
        trackFunnelEvent('my_idea_saved', { source: 'my_work', ideaId: saved?.id });
      } else {
        saved = await Api.updateMyIdea(ideaId, { title: trimmedTitle, body: body?.trim() || '', tags });
        trackFunnelEvent('my_idea_edited', { source: 'my_work', ideaId });
      }
      onSaved(saved as MyIdea);
      toast.success(t('myWork.ideas.savedToast', 'Saved'));
    } catch (err) {
      console.error('Failed to save idea:', err);
      toast.error(t('myWork.errors.saveFailed', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) {
      onClose();
      return;
    }
    try {
      setDeleting(true);
      await Api.deleteMyIdea(ideaId);
      toast.success(t('myWork.ideas.deletedToast', 'Deleted'));
      onClose();
    } catch (err) {
      console.error('Failed to delete idea:', err);
      toast.error(t('myWork.errors.deleteFailed', 'Failed to delete'));
    } finally {
      setDeleting(false);
    }
  };

  const addTag = () => {
    const t0 = newTag.trim().toLowerCase();
    if (!t0) return;
    setTags((prev) => (prev.includes(t0) ? prev : [...prev, t0]));
    setNewTag('');
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-navy-950">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            title={isPolish ? 'Wróć' : 'Back'}
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {isNew ? (isPolish ? 'Nowy pomysł' : 'New idea') : title || (isPolish ? 'Pomysł' : 'Idea')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {t('myWork.ideas.private', 'Private')}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500/15 border border-primary-500 text-primary-600 dark:text-primary-300 hover:bg-primary-500/20 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            {t('common.save', 'Save')}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-red-500/10 border border-red-500/40 text-red-600 dark:text-red-300 hover:bg-red-500/15 disabled:opacity-50 transition-colors"
          >
            {deleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
            {t('common.delete', 'Delete')}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
            title={isPolish ? 'Zamknij' : 'Close'}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">
        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('myWork.ideas.fields.title', 'Title')}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('myWork.ideas.placeholders.title', 'Idea title')}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('myWork.ideas.fields.body', 'Body')}
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            placeholder={t('myWork.ideas.placeholders.body', 'Write down your idea…')}
            className="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {t('myWork.ideas.fields.tags', 'Tags')}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder={t('myWork.ideas.placeholders.tag', 'Add tag')}
              className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addTag}
              className="px-3 py-2 rounded-xl text-sm font-medium bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
            >
              {t('common.add', 'Add')}
            </button>
          </div>
          {tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-200 border border-slate-200/70 dark:border-navy-700 hover:bg-slate-200/60 dark:hover:bg-navy-700 transition-colors"
                  title={t('myWork.ideas.removeTag', 'Remove tag')}
                >
                  <span>{tag}</span>
                  <X size={12} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdeaDetailView;

