/**
 * NotesPanel - Free-form notes for Interview
 *
 * Allows adding notes per category or general session notes.
 * Notes are organized by category with rich text support.
 */

import { Edit3, FileText, MoreVertical, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MetaChip } from '@/components/ui/primitives';
import { EmptyState } from '@/components/shared/states/EmptyState';
import { LoadingState } from '@/components/shared/states/LoadingState';

import type { InterviewCategory } from './CategorySidebar';
import { CATEGORY_CONFIG } from './CategorySidebar';

// Types
export interface InterviewNote {
  id: string;
  sessionId: string;
  category?: InterviewCategory | 'general';
  title: string;
  content: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotesPanelProps {
  notes: InterviewNote[];
  activeCategory?: InterviewCategory;
  onCreateNote: (title: string, content: string, category?: InterviewCategory) => Promise<void>;
  onUpdateNote: (noteId: string, updates: Partial<InterviewNote>) => Promise<void>;
  onDeleteNote: (noteId: string) => Promise<void>;
  isLoading?: boolean;
  readOnly?: boolean;
}

export const NotesPanel: React.FC<NotesPanelProps> = ({
  notes,
  activeCategory,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  isLoading = false,
  readOnly = false,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const [showNewNote, setShowNewNote] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [showMenuId, setShowMenuId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'category'>('all');

  // Filter notes
  const filteredNotes =
    filter === 'category' && activeCategory
      ? notes.filter((n) => n.category === activeCategory)
      : notes;

  // Create note
  const handleCreateNote = useCallback(async () => {
    if (!newTitle.trim()) return;
    await onCreateNote(newTitle.trim(), newContent.trim(), activeCategory);
    setNewTitle('');
    setNewContent('');
    setShowNewNote(false);
  }, [newTitle, newContent, activeCategory, onCreateNote]);

  // Start editing
  const handleStartEdit = useCallback((note: InterviewNote) => {
    setEditingId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
    setShowMenuId(null);
  }, []);

  // Save edit
  const handleSaveEdit = useCallback(
    async (noteId: string) => {
      if (!editTitle.trim()) return;
      await onUpdateNote(noteId, {
        title: editTitle.trim(),
        content: editContent.trim(),
      });
      setEditingId(null);
      setEditTitle('');
      setEditContent('');
    },
    [editTitle, editContent, onUpdateNote]
  );

  // Delete note
  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      await onDeleteNote(noteId);
      setShowMenuId(null);
    },
    [onDeleteNote]
  );

  if (isLoading) {
    return <LoadingState template="list" rows={4} />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--c-text)]">
            {isPolish ? 'Notatki' : 'Notes'}
          </h3>
          <MetaChip label={filteredNotes.length} />
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center bg-[var(--c-surface-raised)] rounded-token-pill p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 text-xs rounded-token-pill transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] ${
                filter === 'all'
                  ? 'bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm'
                  : 'text-[var(--c-text-secondary)]'
              }`}
            >
              {isPolish ? 'Wszystkie' : 'All'}
            </button>
            <button
              onClick={() => setFilter('category')}
              className={`px-2 py-1 text-xs rounded-token-pill transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)] ${
                filter === 'category'
                  ? 'bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm'
                  : 'text-[var(--c-text-secondary)]'
              }`}
            >
              {isPolish ? 'Kategoria' : 'Category'}
            </button>
          </div>

          {/* Add button */}
          {!readOnly && (
            <button
              onClick={() => setShowNewNote(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--c-accent)] hover:bg-[var(--c-accent-soft)] rounded-token-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
            >
              <Plus size={14} />
              {isPolish ? 'Dodaj' : 'Add'}
            </button>
          )}
        </div>
      </div>

      {/* New Note Form */}
      {showNewNote && (
        <div className="bg-[var(--c-surface)] rounded-token-md border border-[var(--c-accent)]/40 p-3 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full p-2 text-sm font-medium border border-[var(--c-border)] rounded-token-md bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-focus)]"
            placeholder={isPolish ? 'Tytuł notatki...' : 'Note title...'}
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="w-full p-2 text-sm border border-[var(--c-border)] rounded-token-md bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-focus)] resize-none"
            rows={4}
            placeholder={isPolish ? 'Treść notatki...' : 'Note content...'}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--c-text-muted)]">
              {activeCategory && (
                <>
                  {isPolish ? 'Kategoria:' : 'Category:'}{' '}
                  <span className="font-medium">
                    {isPolish
                      ? CATEGORY_CONFIG[activeCategory].labelPl
                      : CATEGORY_CONFIG[activeCategory].labelEn}
                  </span>
                </>
              )}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowNewNote(false);
                  setNewTitle('');
                  setNewContent('');
                }}
                className="px-3 py-1.5 text-sm text-[var(--c-text-secondary)] hover:text-[var(--c-text)] rounded-token-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={handleCreateNote}
                disabled={!newTitle.trim()}
                className="px-3 py-1.5 text-sm bg-[var(--c-text)] text-[var(--c-surface)] hover:brightness-110 disabled:opacity-50 rounded-token-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
              >
                {isPolish ? 'Zapisz' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-2">
        {filteredNotes.map((note) => {
          const isEditing = editingId === note.id;
          const categoryConfig =
            note.category && note.category !== 'general' ? CATEGORY_CONFIG[note.category] : null;

          return (
            <div
              key={note.id}
              className="bg-[var(--c-surface)] rounded-token-md border border-[var(--c-border-subtle)] overflow-hidden"
            >
              {isEditing ? (
                <div className="p-3 space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-2 text-sm font-medium border border-[var(--c-border)] rounded-token-md bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-focus)]"
                    autoFocus
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 text-sm border border-[var(--c-border)] rounded-token-md bg-[var(--c-surface)] text-[var(--c-text)] placeholder:text-[var(--c-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--c-focus)] resize-none"
                    rows={4}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditTitle('');
                        setEditContent('');
                      }}
                      className="px-3 py-1.5 text-sm text-[var(--c-text-secondary)] hover:text-[var(--c-text)] rounded-token-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
                    >
                      {isPolish ? 'Anuluj' : 'Cancel'}
                    </button>
                    <button
                      onClick={() => handleSaveEdit(note.id)}
                      disabled={!editTitle.trim()}
                      className="px-3 py-1.5 text-sm bg-[var(--c-text)] text-[var(--c-surface)] hover:brightness-110 disabled:opacity-50 rounded-token-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
                    >
                      {isPolish ? 'Zapisz' : 'Save'}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between p-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-[var(--c-text-muted)] shrink-0" />
                        <h4 className="text-sm font-medium text-[var(--c-text)] truncate">
                          {note.title}
                        </h4>
                        {categoryConfig && (
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded-token-xs ${categoryConfig.bgColor} ${categoryConfig.color}`}
                          >
                            {isPolish ? categoryConfig.labelPl : categoryConfig.labelEn}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--c-text-muted)] mt-1">
                        {new Date(note.updatedAt).toLocaleString()}
                      </p>
                    </div>

                    {!readOnly && (
                      <div className="relative">
                        <button
                          onClick={() => setShowMenuId(showMenuId === note.id ? null : note.id)}
                          className="p-1 rounded-token-xs hover:bg-[var(--c-surface-raised)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
                        >
                          <MoreVertical size={16} className="text-[var(--c-text-muted)]" />
                        </button>

                        {showMenuId === note.id && (
                          <div className="absolute top-full right-0 mt-1 bg-[var(--c-surface-raised)] rounded-token-md shadow-hig-lg border border-[var(--c-border)] py-1 z-10 min-w-[120px]">
                            <button
                              onClick={() => handleStartEdit(note)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-text)] hover:bg-[var(--c-surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
                            >
                              <Edit3 size={14} />
                              {isPolish ? 'Edytuj' : 'Edit'}
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--c-danger)] hover:bg-[var(--c-danger)]/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-focus)]"
                            >
                              <Trash2 size={14} />
                              {isPolish ? 'Usuń' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {note.content && (
                    <div className="px-3 pb-3">
                      <p className="text-sm text-[var(--c-text-secondary)] whitespace-pre-wrap">
                        {note.content}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}

        {/* Empty State */}
        {filteredNotes.length === 0 && !showNewNote && (
          <EmptyState
            variant="new"
            icon={FileText}
            title={isPolish ? 'Brak notatek' : 'No notes yet'}
            description={
              isPolish
                ? 'Dodaj pierwszą notatkę, aby zapisać obserwacje z wywiadu.'
                : 'Add your first note to capture observations from the interview.'
            }
            compact
            primaryAction={
              readOnly
                ? undefined
                : {
                    label: isPolish ? 'Dodaj notatkę' : 'Add note',
                    onClick: () => setShowNewNote(true),
                    icon: Plus,
                  }
            }
          />
        )}
      </div>
    </div>
  );
};

export default NotesPanel;
