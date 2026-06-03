/**
 * NotesPanel - Free-form notes for Interview
 *
 * Allows adding notes per category or general session notes.
 * Notes are organized by category with rich text support.
 */

import { Edit3, FileText, MoreVertical, Plus, Trash2, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-navy-900 dark:text-white">
            {isPolish ? 'Notatki' : 'Notes'}
          </h3>
          <span className="px-2 py-0.5 text-xs bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 rounded-full">
            {filteredNotes.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center bg-slate-100 dark:bg-navy-800 rounded-lg p-0.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filter === 'all'
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {isPolish ? 'Wszystkie' : 'All'}
            </button>
            <button
              onClick={() => setFilter('category')}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${
                filter === 'category'
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {isPolish ? 'Kategoria' : 'Category'}
            </button>
          </div>

          {/* Add button */}
          {!readOnly && (
            <button
              onClick={() => setShowNewNote(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
            >
              <Plus size={14} />
              {isPolish ? 'Dodaj' : 'Add'}
            </button>
          )}
        </div>
      </div>

      {/* New Note Form */}
      {showNewNote && (
        <div className="bg-white dark:bg-navy-900 rounded-lg border border-blue-300 dark:border-blue-500/50 p-3 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="w-full p-2 text-sm font-medium border border-slate-200 dark:border-navy-700 rounded-lg bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={isPolish ? 'Tytuł notatki...' : 'Note title...'}
            autoFocus
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            className="w-full p-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            rows={4}
            placeholder={isPolish ? 'Treść notatki...' : 'Note content...'}
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-600">
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
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
              >
                {isPolish ? 'Anuluj' : 'Cancel'}
              </button>
              <button
                onClick={handleCreateNote}
                disabled={!newTitle.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-lg"
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
              className="bg-white dark:bg-navy-900 rounded-lg border border-slate-200 dark:border-navy-700 overflow-hidden"
            >
              {isEditing ? (
                <div className="p-3 space-y-3">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full p-2 text-sm font-medium border border-slate-200 dark:border-navy-700 rounded-lg bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full p-2 text-sm border border-slate-200 dark:border-navy-700 rounded-lg bg-slate-50 dark:bg-navy-950 text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={4}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditTitle('');
                        setEditContent('');
                      }}
                      className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400"
                    >
                      {isPolish ? 'Anuluj' : 'Cancel'}
                    </button>
                    <button
                      onClick={() => handleSaveEdit(note.id)}
                      disabled={!editTitle.trim()}
                      className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 disabled:bg-slate-300 text-white rounded-lg"
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
                        <FileText size={14} className="text-slate-600 shrink-0" />
                        <h4 className="text-sm font-medium text-navy-900 dark:text-white truncate">
                          {note.title}
                        </h4>
                        {categoryConfig && (
                          <span
                            className={`px-1.5 py-0.5 text-xs rounded ${categoryConfig.bgColor} ${categoryConfig.color}`}
                          >
                            {isPolish ? categoryConfig.labelPl : categoryConfig.labelEn}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                        {new Date(note.updatedAt).toLocaleString()}
                      </p>
                    </div>

                    {!readOnly && (
                      <div className="relative">
                        <button
                          onClick={() => setShowMenuId(showMenuId === note.id ? null : note.id)}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-800"
                        >
                          <MoreVertical size={16} className="text-slate-600" />
                        </button>

                        {showMenuId === note.id && (
                          <div className="absolute top-full right-0 mt-1 bg-white dark:bg-navy-900 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-10 min-w-[120px]">
                            <button
                              onClick={() => handleStartEdit(note)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800"
                            >
                              <Edit3 size={14} />
                              {isPolish ? 'Edytuj' : 'Edit'}
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
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
                      <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
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
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="w-12 h-12 text-slate-600 dark:text-slate-600 mb-3" />
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
              {isPolish ? 'Brak notatek' : 'No notes yet'}
            </p>
            {!readOnly && (
              <button
                onClick={() => setShowNewNote(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg"
              >
                <Plus size={16} />
                {isPolish ? 'Dodaj notatkę' : 'Add note'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotesPanel;
