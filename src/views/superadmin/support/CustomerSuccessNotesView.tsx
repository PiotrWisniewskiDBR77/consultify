/**
 * Customer Success Notes View
 */

import { Plus } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

type OrganizationRow = {
  id: string;
  name: string;
};

type CustomerSuccessNoteRow = {
  id: string;
  title?: string;
  content?: string;
  note_type?: string;
  created_at?: string | null;
};

const formatNoteDate = (value?: string | null) => {
  if (!value) return 'Unknown date';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleDateString();
};

type JsonRecord = Record<string, unknown> & {
  data?: JsonRecord | unknown[];
};

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null;

const getListPayload = <T,>(value: unknown, keys: string[]): T[] => {
  if (Array.isArray(value)) return value as T[];
  if (!isRecord(value)) return [];
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const candidates = [value, data, nestedData].filter(isRecord);
  for (const candidate of candidates) {
    if (Array.isArray(candidate.data)) return candidate.data as T[];
    for (const key of keys) {
      if (Array.isArray(candidate[key])) return candidate[key] as T[];
    }
  }
  return [];
};

const hasListShape = (value: unknown, keys: string[]) => {
  if (Array.isArray(value)) return true;
  if (!isRecord(value)) return false;
  const data = isRecord(value.data) ? value.data : null;

  return (
    'data' in value ||
    keys.some((key) => key in value) ||
    Boolean(data && keys.some((key) => key in data))
  );
};

const getCreatedNoteId = (value: unknown) => {
  if (!isRecord(value)) return '';
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const note = isRecord(value.note) ? value.note : null;
  return String(
    value.id ||
      note?.id ||
      data?.id ||
      (isRecord(data?.note) ? data.note.id : '') ||
      nestedData?.id ||
      (isRecord(nestedData?.note) ? nestedData.note.id : '') ||
      ''
  );
};

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
    (
      (payload.data as Record<string, unknown> | undefined)?.error as
        | Record<string, unknown>
        | undefined
    )?.code,
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
    (
      (payload.data as Record<string, unknown> | undefined)?.data as
        | Record<string, unknown>
        | undefined
    )?.notes,
    (
      (payload.data as Record<string, unknown> | undefined)?.data as
        | Record<string, unknown>
        | undefined
    )?.items,
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
    (
      (payload.data as Record<string, unknown> | undefined)?.note as
        | Record<string, unknown>
        | undefined
    )?.id,
    (
      (
        (payload.data as Record<string, unknown> | undefined)?.data as
          | Record<string, unknown>
          | undefined
      )?.note as Record<string, unknown> | undefined
    )?.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }
  return null;
}

export const CustomerSuccessNotesView: React.FC = () => {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [notes, setNotes] = useState<CustomerSuccessNoteRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [organizationsLoadError, setOrganizationsLoadError] = useState<string | null>(null);
  const [notesLoadError, setNotesLoadError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    note_type: 'General',
  });

  const fetchOrganizations = useCallback(async () => {
    try {
      const orgs = await Api.getOrganizations();
      if (!hasListShape(orgs, ['organizations', 'items'])) {
        throw new Error('Organizations response was not a list');
      }
      const normalizedOrgs = getListPayload<OrganizationRow>(orgs, ['organizations', 'items']);
      setOrganizations(normalizedOrgs);
      setSelectedOrgId((current) => current || normalizedOrgs[0]?.id || '');
    } catch (err: unknown) {
      setErrorCode(normalizeCsNotesErrorCode(err));
      setErrorDetail(normalizeCsNotesErrorDetail(err));
      setLoadError(CUSTOMER_SUCCESS_NOTES_COPY.organizationsLoadFailed);
      toast.error(CUSTOMER_SUCCESS_NOTES_COPY.organizationsLoadFailed);
    }
  }, []);

  const fetchNotes = useCallback(async (): Promise<CustomerSuccessNoteRow[] | null> => {
    if (!selectedOrgId) return null;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await Api.getCustomerSuccessNotes(selectedOrgId);
      if (!hasListShape(data, ['notes', 'items'])) {
        throw new Error('Customer success notes response was not a list');
      }
      const normalized = getListPayload<CustomerSuccessNoteRow>(data, ['notes', 'items']);
      setNotes(normalized);
      return normalized;
    } catch (err: unknown) {
      setErrorCode(normalizeCsNotesErrorCode(err));
      setErrorDetail(normalizeCsNotesErrorDetail(err));
      setNotes([]);
      setLoadError(CUSTOMER_SUCCESS_NOTES_COPY.notesLoadFailed);
      toast.error(CUSTOMER_SUCCESS_NOTES_COPY.notesLoadFailed);
      return null;
    } finally {
      setLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    void fetchOrganizations();
  }, [fetchOrganizations]);

  useEffect(() => {
    if (selectedOrgId) {
      void fetchNotes();
    }
  }, [selectedOrgId, fetchNotes]);

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
      setActionError(null);
      const result = await Api.createCustomerSuccessNote(selectedOrgId, {
        title: newNote.title.trim(),
        content: newNote.content.trim(),
        note_type: newNote.note_type || 'General',
      });
      if (isRecord(result) && result.success === false) {
        throw new Error(String(result.error || 'Failed to create note'));
      }
      const createdId = getCreatedNoteId(result);
      const refreshed = await fetchNotes();
      if (
        !refreshed?.some(
          (note) => (createdId && note.id === createdId) || note.title === newNote.title.trim()
        )
      ) {
        throw new Error('Customer success note creation was not confirmed by the server');
      }
      toast.success('Note created');
      setShowCreateModal(false);
      setNewNote({ title: '', content: '', note_type: 'General' });
    } catch (err: unknown) {
      setErrorCode(normalizeCsNotesErrorCode(err));
      setErrorDetail(normalizeCsNotesErrorDetail(err));
      setActionError(CUSTOMER_SUCCESS_NOTES_COPY.createFailed);
      toast.error(CUSTOMER_SUCCESS_NOTES_COPY.createFailed);
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
            disabled={!selectedOrgId || Boolean(loadError)}
            className="px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
          >
            <Plus size={18} />
            Add Note
          </button>
        </div>
      </div>

      {loadError && (
        <DegradedState title="Customer success notes unavailable" description={loadError} />
      )}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : loadError ? null : (
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
                    {formatNoteDate(note.created_at)}
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
                  className="px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
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
