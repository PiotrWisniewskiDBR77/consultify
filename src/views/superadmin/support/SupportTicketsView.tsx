/**
 * Support Tickets View
 * Manages support tickets
 */

import { Eye, MessageSquare, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { StandardTable, type TableColumn, type TableRow } from '../../../components/standard';
import { Api } from '../../../services/api';
import { normalizeApiErrorMessage } from '../../../utils/apiError';

type SupportTicketRow = {
  id: string;
  ticket_number?: string;
  subject?: string;
  description?: string;
  priority?: string;
  status?: string;
  created_at?: string | null;
};

type SupportTicketCommentRow = {
  id: string;
  isInternal?: boolean;
  created_at?: string | null;
  comment_text?: string;
  commentText?: string;
};

const formatSupportDate = (value?: string | null, fallback = 'Unknown date') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString();
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
  const nestedData = data && isRecord(data.data) ? data.data : null;

  return (
    Array.isArray(value.data) ||
    keys.some((key) => key in value) ||
    Boolean(data && (Array.isArray(data.data) || keys.some((key) => key in data))) ||
    Boolean(nestedData && keys.some((key) => key in nestedData))
  );
};

const getCreatedTicketId = (value: unknown) => {
  if (!isRecord(value)) return '';
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const ticket = isRecord(value.ticket) ? value.ticket : null;
  return String(
    value.id ||
      ticket?.id ||
      data?.id ||
      (isRecord(data?.ticket) ? data.ticket.id : '') ||
      nestedData?.id ||
      (isRecord(nestedData?.ticket) ? nestedData.ticket.id : '') ||
      ''
  );
};

const getCreatedCommentId = (value: unknown) => {
  if (!isRecord(value)) return '';
  const data = isRecord(value.data) ? value.data : null;
  const nestedData = data && isRecord(data.data) ? data.data : null;
  const comment = isRecord(value.comment) ? value.comment : null;
  return String(
    value.id ||
      comment?.id ||
      data?.id ||
      (isRecord(data?.comment) ? data.comment.id : '') ||
      nestedData?.id ||
      (isRecord(nestedData?.comment) ? nestedData.comment.id : '') ||
      ''
  );
};

// canon TRIADA §27 — StandardTable columns. Kebab (actions) is auto-appended
// by StandardTable itself; it is intentionally NOT declared here.
const buildColumns = (
  getPriorityColor: (priority: string) => string,
  getStatusColor: (status: string) => string
): TableColumn[] => [
  {
    id: 'ticket_number',
    label: 'Ticket #',
    render: (row: TableRow) => (
      <span className="text-slate-900 dark:text-white font-mono text-sm">
        {(row as unknown as SupportTicketRow).ticket_number}
      </span>
    ),
  },
  {
    id: 'subject',
    label: 'Subject',
    sortable: true,
    sortAccessor: (row: TableRow) => String((row as unknown as SupportTicketRow).subject || ''),
    render: (row: TableRow) => (
      <span className="text-slate-900 dark:text-white">
        {(row as unknown as SupportTicketRow).subject}
      </span>
    ),
  },
  {
    id: 'priority',
    label: 'Priority',
    render: (row: TableRow) => {
      const priority = (row as unknown as SupportTicketRow).priority || 'unknown';
      return (
        <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(priority)}`}>
          {priority}
        </span>
      );
    },
  },
  {
    id: 'status',
    label: 'Status',
    render: (row: TableRow) => {
      const status = (row as unknown as SupportTicketRow).status || 'unknown';
      return (
        <span className={`px-2 py-1 rounded text-xs ${getStatusColor(status)}`}>{status}</span>
      );
    },
  },
  {
    id: 'created_at',
    label: 'Created',
    sortable: true,
    sortAccessor: (row: TableRow) => String((row as unknown as SupportTicketRow).created_at || ''),
    render: (row: TableRow) => (
      <span className="text-slate-700 dark:text-slate-300">
        {formatSupportDate((row as unknown as SupportTicketRow).created_at)}
      </span>
    ),
  },
];

export const SupportTicketsView: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicketRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketRow | null>(null);
  const [ticketComments, setTicketComments] = useState<SupportTicketCommentRow[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoadError, setCommentsLoadError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    organizationId: '',
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTicket, setNewTicket] = useState({
    organizationId: '',
    userId: '',
    subject: '',
    description: '',
    priority: 'medium',
    category: '',
  });

  const fetchTickets = useCallback(async (): Promise<SupportTicketRow[] | null> => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await Api.getSupportTickets(filters);
      if (!hasListShape(data, ['tickets', 'items'])) {
        throw new Error('Support tickets response was not a list');
      }
      const normalized = getListPayload<SupportTicketRow>(data, ['tickets', 'items']);
      setTickets(normalized);
      return normalized;
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to fetch tickets');
      setTickets([]);
      setLoadError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    if (!showDetailsModal || !selectedTicket?.id) {
      setTicketComments([]);
      setCommentDraft('');
      return;
    }

    const loadComments = async () => {
      setCommentsLoading(true);
      setCommentsLoadError(null);
      try {
        const comments = await Api.getSupportTicketComments(selectedTicket.id);
        if (!hasListShape(comments, ['comments', 'items'])) {
          throw new Error('Ticket comments response was not a list');
        }
        setTicketComments(getListPayload<SupportTicketCommentRow>(comments, ['comments', 'items']));
      } catch (err: unknown) {
        const message = normalizeApiErrorMessage(err, 'Failed to load ticket comments');
        toast.error(message);
        setCommentsLoadError(message);
        setTicketComments([]);
      } finally {
        setCommentsLoading(false);
      }
    };

    void loadComments();
  }, [selectedTicket?.id, showDetailsModal]);

  const handleCreateTicket = async () => {
    if (!newTicket.subject || !newTicket.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      setCreating(true);
      setActionError(null);
      const result = await Api.createSupportTicket(newTicket);
      const createdId = getCreatedTicketId(result);
      const refreshed = await fetchTickets();
      if (
        !refreshed?.some(
          (ticket) =>
            (createdId && ticket.id === createdId) || ticket.subject === newTicket.subject.trim()
        )
      ) {
        throw new Error('Support ticket creation was not confirmed by the server');
      }
      toast.success('Ticket created');
      setShowCreateModal(false);
      setNewTicket({
        organizationId: '',
        userId: '',
        subject: '',
        description: '',
        priority: 'medium',
        category: '',
      });
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to create ticket');
      setActionError(message);
      toast.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket?.id || !commentDraft.trim()) {
      toast.error('Enter a reply before sending');
      return;
    }

    try {
      setActionError(null);
      const comment = await Api.addSupportTicketComment(selectedTicket.id, {
        commentText: commentDraft.trim(),
        isInternal: false,
      });
      const comments = await Api.getSupportTicketComments(selectedTicket.id);
      if (!hasListShape(comments, ['comments', 'items'])) {
        throw new Error('Ticket comments response was not a list');
      }
      const normalizedComments = getListPayload<SupportTicketCommentRow>(comments, [
        'comments',
        'items',
      ]);
      const createdCommentId = getCreatedCommentId(comment);
      const expectedText = commentDraft.trim();
      if (
        !normalizedComments.some(
          (item: SupportTicketCommentRow) =>
            (createdCommentId && item.id === createdCommentId) ||
            item.comment_text === expectedText ||
            item.commentText === expectedText
        )
      ) {
        throw new Error('Support ticket reply was not confirmed by the server');
      }
      setTicketComments(normalizedComments);
      setCommentDraft('');
      toast.success('Reply added');
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to add reply');
      setActionError(message);
      toast.error(message);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-danger-500/20 text-danger-400';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'low':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-slate-500/20 text-slate-600 dark:text-slate-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-500/20 text-blue-400';
      case 'in_progress':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'resolved':
        return 'bg-green-500/20 text-green-400';
      case 'closed':
        return 'bg-slate-500/20 text-slate-600 dark:text-slate-500';
      default:
        return 'bg-slate-500/20 text-slate-600 dark:text-slate-500';
    }
  };

  const columns = useMemo(() => buildColumns(getPriorityColor, getStatusColor), []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Support Tickets</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Manage and track support tickets
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          disabled={Boolean(loadError)}
          className="px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg flex items-center gap-2"
        >
          <Plus size={18} />
          Create Ticket
        </button>
      </div>

      {loadError && <DegradedState title="Support tickets unavailable" description={loadError} />}

      {actionError && (
        <div
          role="alert"
          className="rounded-lg border border-danger-200 dark:border-danger-500/20 bg-danger-50 dark:bg-danger-500/10 p-4 text-sm text-danger-700 dark:text-danger-300"
        >
          {actionError}
        </div>
      )}

      <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex gap-4">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={filters.priority}
          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
          className="bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
        >
          <option value="">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {loadError ? null : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <StandardTable
            columns={columns}
            data={tickets as unknown as TableRow[]}
            loading={loading}
            empty={{ icon: MessageSquare, title: 'No tickets found' }}
            rowMenu={(row) => {
              const ticket = row as unknown as SupportTicketRow;
              return {
                primary: [
                  {
                    id: 'view-details',
                    label: 'View ticket details',
                    icon: Eye,
                    onClick: () => {
                      setSelectedTicket(ticket);
                      setShowDetailsModal(true);
                    },
                  },
                ],
              };
            }}
          />
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-2xl border border-slate-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              Create Support Ticket
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                  Subject *
                </label>
                <input
                  type="text"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                  placeholder="Ticket subject"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                  Description *
                </label>
                <textarea
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                  rows={5}
                  placeholder="Describe the issue..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                    Priority
                  </label>
                  <select
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg"
                    placeholder="Category"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-700"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={creating}
                className="flex-1 px-4 py-2 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50 text-white rounded-lg"
              >
                {creating ? 'Creating...' : 'Create Ticket'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedTicket && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => {
            setShowDetailsModal(false);
            setSelectedTicket(null);
          }}
        >
          <div
            className="bg-white dark:bg-navy-800 rounded-xl p-6 w-full max-w-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                  {selectedTicket.subject || 'Support Ticket'}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-mono">
                  #{selectedTicket.ticket_number || selectedTicket.id}
                </p>
              </div>
              <button
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-700/50 text-sm"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedTicket(null);
                }}
              >
                Close
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Status</div>
                <div className="text-sm text-slate-900 dark:text-white mt-1">
                  {selectedTicket.status || '—'}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400">Priority</div>
                <div className="text-sm text-slate-900 dark:text-white mt-1">
                  {selectedTicket.priority || '—'}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-navy-900">
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">Description</div>
              <div className="text-sm text-slate-900 dark:text-white whitespace-pre-wrap">
                {selectedTicket.description || 'No description provided.'}
              </div>
            </div>

            <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">Conversation</div>
            <div className="mt-3 rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-navy-900 space-y-3">
              {commentsLoading ? (
                <div className="text-sm text-slate-500 dark:text-slate-400">Loading replies...</div>
              ) : ticketComments.length > 0 ? (
                ticketComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 p-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span>{comment.isInternal ? 'Internal note' : 'Reply'}</span>
                      <span>{formatSupportDate(comment.created_at, 'Just now')}</span>
                    </div>
                    <div className="mt-2 text-sm text-slate-900 dark:text-white whitespace-pre-wrap">
                      {comment.comment_text || comment.commentText}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {commentsLoadError || 'No replies yet. Add the first response below.'}
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400">
                  Add reply
                </label>
                <textarea
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-800 px-3 py-2 text-sm text-slate-900 dark:text-white"
                  placeholder="Write a customer-visible reply or operator note..."
                />
                <div className="flex justify-end">
                  <button
                    className="px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] text-sm"
                    onClick={() => void handleAddComment()}
                  >
                    Send reply
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
