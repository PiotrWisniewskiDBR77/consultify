/**
 * Customer Success Notes View
 */

import { FileText, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Api } from '../../../services/api';

const CUSTOMER_SUCCESS_NOTES_COPY = {
  organizationsLoadFailed: 'Could not load organizations.',
  notesLoadFailed: 'Customer success notes unavailable.',
  createFailed: 'Could not create customer success note.',
  createNotConfirmed: 'Customer success note creation was not confirmed by the server',
  notesPayloadInvalid: 'Customer success notes response was not a list',
};

const LEAKY_TOKENS = ['sqlstate', '/var/', 'internal:', 'secret', 'stack', 'trace'];

function normalizeCsNotesErrorCode(input: unknown): string | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const payload = input as Record<string, unknown>;
  const candidates = [
    payload.code,
    (payload.error as Record<string, unknown> | undefined)?.code,
    (payload.data as Record<string, unknown> | undefined)?.code,
    ((payload.data as Record<string, unknown> | undefined)?.error as Record<string, unknown> | undefined)
      ?.code,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  return null;
}

function normalizeCsNotesErrorDetail(input: unknown): string | null {
  const raw = input instanceof Error ? input.message : typeof input === 'string' ? input : '';
  const detail = raw.trim();
  if (!detail) return null;
  const lowered = detail.toLowerCase();
  if (LEAKY_TOKENS.some((token) => lowered.includes(token))) {
    return null;
  }
  return detail;
}

function normalizeOrganizationsPayload(input: unknown): any[] {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'object') return [];

  const payload = input as Record<string, unknown>;
  const direct = payload.organizations;
  if (Array.isArray(direct)) return direct as any[];

  const nestedData = payload.data as Record<string, unknown> | undefined;
  if (nestedData) {
    if (Array.isArray(nestedData.organizations)) return nestedData.organizations as any[];
    const nestedDataData = nestedData.data as Record<string, unknown> | undefined;
    if (nestedDataData && Array.isArray(nestedDataData.organizations)) {
      return nestedDataData.organizations as any[];
    }
  }

  return [];
}

function normalizeNotesPayload(input: unknown): any[] | null {
  if (Array.isArray(input)) return input;
  if (!input || typeof input !== 'object') return null;

  const payload = input as Record<string, unknown>;
  const candidates: unknown[] = [
    payload.notes,
    payload.items,
    (payload.data as Record<string, unknown> | undefined)?.notes,
    (payload.data as Record<string, unknown> | undefined)?.items,
    ((payload.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined)
      ?.notes,
    ((payload.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined)
      ?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as any[];
    }
  }

  return null;
}

function resolveCreatedNoteId(input: unknown): string | null {
  if (!input || typeof input !== 'object') return null;
  const payload = input as Record<string, unknown>;
  const candidates: unknown[] = [
    payload.id,
    (payload.note as Record<string, unknown> | undefined)?.id,
    (payload.data as Record<string, unknown> | undefined)?.id,
    ((payload.data as Record<string, unknown> | undefined)?.note as Record<string, unknown> | undefined)
      ?.id,
    (((payload.data as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined)
      ?.note as Record<string, unknown> | undefined)?.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

function formatNoteDate(value: unknown): string {
  const parsed = new Date(typeof value === 'string' ? value : '');
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return parsed.toLocaleDateString();
}

export const CustomerSuccessNotesView: React.FC = () => {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [organizationsLoadError, setOrganizationsLoadError] = useState<string | null>(null);
  const [notesLoadError, setNotesLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    note_type: 'General',
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  useEffect(() => {
    if (selectedOrgId) {
      fetchNotes();
    }
  }, [selectedOrgId]);

  const fetchOrganizations = async () => {
    setOrganizationsLoadError(null);
    setErrorCode(null);
    setErrorDetail(null);
    try {
      const raw = await Api.getOrganizations();
      const orgs = normalizeOrganizationsPayload(raw);
      setOrganizations(orgs);
      if (orgs.length > 0) {
        setSelectedOrgId(orgs[0].id);
      }
    } catch (err) {
      console.error('[CustomerSuccessNotesView] Failed to fetch organizations:', err);
      setOrganizations([]);
      setSelectedOrgId('');
      setNotes([]);
      setOrganizationsLoadError(CUSTOMER_SUCCESS_NOTES_COPY.organizationsLoadFailed);
      setErrorCode(normalizeCsNotesErrorCode(err));
      setErrorDetail(normalizeCsNotesErrorDetail(err));
    }
  };

  const fetchNotes = async () => {
    if (!selectedOrgId) return;
    setLoading(true);
    setNotesLoadError(null);
    setErrorCode(null);
    setErrorDetail(null);
    try {
      const data = await Api.getCustomerSuccessNotes(selectedOrgId);
      const normalized = normalizeNotesPayload(data);
      if (!normalized) {
        setNotes([]);
        setNotesLoadError(CUSTOMER_SUCCESS_NOTES_COPY.notesLoadFailed);
        setErrorDetail(CUSTOMER_SUCCESS_NOTES_COPY.notesPayloadInvalid);
        return;
      }
      setNotes(normalized);
    } catch (err) {
      console.error('[CustomerSuccessNotesView] Failed to fetch notes:', err);
      setNotes([]);
      setNotesLoadError(CUSTOMER_SUCCESS_NOTES_COPY.notesLoadFailed);
      setErrorCode(normalizeCsNotesErrorCode(err));
      setErrorDetail(normalizeCsNotesErrorDetail(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNote = async () => {
    if (!selectedOrgId) return;
    if (!newNote.title.trim() || !newNote.content.trim()) {
      toast.error('Title and content are required');
      return;
    }
    setCreating(true);
    setCreateError(null);
    setErrorCode(null);
    setErrorDetail(null);
    try {
      const previousCount = notes.length;
      const result = await Api.createCustomerSuccessNote(selectedOrgId, {
        title: newNote.title.trim(),
        content: newNote.content.trim(),
        note_type: newNote.note_type || 'General',
      });
      if (!result?.success) throw new Error(result?.error || 'Failed to create note');
      const createdId = resolveCreatedNoteId(result);
      const readBack = await Api.getCustomerSuccessNotes(selectedOrgId);
      const normalizedNotes = normalizeNotesPayload(readBack);
      if (!normalizedNotes) {
        setCreateError(CUSTOMER_SUCCESS_NOTES_COPY.createNotConfirmed);
        setErrorDetail(CUSTOMER_SUCCESS_NOTES_COPY.notesPayloadInvalid);
        setNotes([]);
        return;
      }

      setNotes(normalizedNotes);
      const confirmedById = createdId
        ? normalizedNotes.some((item) => String((item as any)?.id || '') === createdId)
        : false;
      const confirmedByCount = normalizedNotes.length > previousCount;
      if (!confirmedById && !confirmedByCount) {
        setCreateError(CUSTOMER_SUCCESS_NOTES_COPY.createNotConfirmed);
        return;
      }

      toast.success('Note created');
      setShowCreateModal(false);
      setNewNote({ title: '', content: '', note_type: 'General' });
    } catch (err) {
      console.error('[CustomerSuccessNotesView] Failed to create note:', err);
      setCreateError(CUSTOMER_SUCCESS_NOTES_COPY.createFailed);
      setErrorCode(normalizeCsNotesErrorCode(err));
      setErrorDetail(normalizeCsNotesErrorDetail(err));
    } finally {
      setCreating(false);
    }
  };

  const activeError = organizationsLoadError || notesLoadError || createError;

  return (
    <div className="p-6 space-y-6">
      {activeError ? (
        <div>
          <DegradedState title={activeError} description={errorDetail || undefined} />
          {errorCode ? (
            <div
              data-testid="customer-success-notes-error-code"
              className="mt-2 text-xs font-medium text-orange-700 dark:text-orange-200"
            >
              Code: {errorCode}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Customer Success Notes
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Track customer interactions and success metrics
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedOrgId}
            onChange={(e) => setSelectedOrgId(e.target.value)}
            className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
          >
            <option value="">Select Organization</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={!selectedOrgId}
            className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
          >
            <Plus size={18} />
            Add Note
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : notesLoadError || organizationsLoadError ? null : (
        <div className="space-y-4">
          {notes.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              No notes found
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-slate-900 dark:text-white font-semibold">{note.title}</h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {note.note_type || 'General'}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {formatNoteDate((note as any)?.created_at)}
                  </span>
                </div>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                  {note.content}
                </p>
              </div>
            ))
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add CS Note</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Close
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                  Type
                </label>
                <select
                  value={newNote.note_type}
                  onChange={(e) => setNewNote((p) => ({ ...p, note_type: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                >
                  <option value="General">General</option>
                  <option value="Call">Call</option>
                  <option value="Email">Email</option>
                  <option value="Onboarding">Onboarding</option>
                  <option value="Risk">Risk</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                  Title *
                </label>
                <input
                  value={newNote.title}
                  onChange={(e) => setNewNote((p) => ({ ...p, title: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                  placeholder="e.g. QBR notes"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                  Content *
                </label>
                <textarea
                  value={newNote.content}
                  onChange={(e) => setNewNote((p) => ({ ...p, content: e.target.value }))}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                  rows={6}
                  placeholder="Write the note..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateNote}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
                >
                  <Plus size={18} />
                  {creating ? 'Creating…' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
