/**
 * Support Tickets View
 * Manages support tickets
 */

import { MessageSquare, Plus } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState } from '../../../components/Admin/AdminState';
import { Api } from '../../../services/api';

const SUPPORT_TICKETS_COPY = {
  unavailableTitle: 'Support tickets unavailable',
  malformedPayload: 'Support tickets response was not a list',
  creationNotConfirmed: 'Support ticket creation was not confirmed by the server',
  commentsLoadFailed: 'Failed to load ticket comments',
  createFailed: 'Failed to create ticket',
  replyFailed: 'Failed to add reply',
};

const LEAKY_ERROR_MARKERS = ['sqlstate', '/var/', 'internal:', 'secret', 'stack', 'trace', 'token'];

function safeSupportErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const detail = message.trim();
  if (!detail) return fallback;
  const lowered = detail.toLowerCase();
  if (LEAKY_ERROR_MARKERS.some((marker) => lowered.includes(marker))) return fallback;
  return detail;
}

function normalizeSupportTicketsPayload(payload: unknown): any[] | null {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  const anyPayload = payload as any;
  const candidates: unknown[] = [
    anyPayload.tickets,
    anyPayload.items,
    anyPayload.data,
    anyPayload?.data?.tickets,
    anyPayload?.data?.items,
    anyPayload?.data?.data?.tickets,
    anyPayload?.data?.data?.items,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return null;
}

function normalizeSupportCommentsPayload(payload: unknown): any[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const anyPayload = payload as any;
  const candidates: unknown[] = [
    anyPayload.comments,
    anyPayload.items,
    anyPayload.data,
    anyPayload?.data?.comments,
    anyPayload?.data?.items,
    anyPayload?.data?.data?.comments,
    anyPayload?.data?.data?.items,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function resolveSupportTicketId(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const anyPayload = payload as any;
  const candidates: unknown[] = [
    anyPayload.id,
    anyPayload?.ticket?.id,
    anyPayload?.data?.id,
    anyPayload?.data?.ticket?.id,
    anyPayload?.data?.data?.ticket?.id,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim();
  }
  return null;
}

function formatTicketDate(value: unknown): string {
  const parsed = new Date(typeof value === 'string' ? value : '');
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return parsed.toLocaleDateString();
}

export const SupportTicketsView: React.FC = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorTitle, setErrorTitle] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [ticketComments, setTicketComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    organizationId: '',
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTicket, setNewTicket] = useState({
    organizationId: '',
    userId: '',
    subject: '',
    description: '',
    priority: 'medium',
    category: '',
  });

  const lastFetchKeyRef = React.useRef<string | null>(null);

  useEffect(() => {
    const fetchKey = JSON.stringify(filters);
    if (lastFetchKeyRef.current === fetchKey) return;
    lastFetchKeyRef.current = fetchKey;
    void fetchTickets();
  }, [filters]);

  useEffect(() => {
    if (!showDetailsModal || !selectedTicket?.id) {
      setTicketComments([]);
      setCommentDraft('');
      return;
    }

    const loadComments = async () => {
      setCommentsLoading(true);
      try {
        const comments = await Api.getSupportTicketComments(selectedTicket.id);
        setTicketComments(normalizeSupportCommentsPayload(comments));
      } catch (err) {
        setErrorTitle(SUPPORT_TICKETS_COPY.unavailableTitle);
        setErrorDetail(safeSupportErrorMessage(err, SUPPORT_TICKETS_COPY.commentsLoadFailed));
        setTicketComments([]);
      } finally {
        setCommentsLoading(false);
      }
    };

    void loadComments();
  }, [selectedTicket?.id, showDetailsModal]);

  const fetchTickets = async (): Promise<any[] | null> => {
    setLoading(true);
    setErrorTitle(null);
    setErrorDetail(null);
    try {
      const data = await Api.getSupportTickets(filters);
      const normalized = normalizeSupportTicketsPayload(data);
      if (!normalized) {
        setTickets([]);
        setErrorTitle(SUPPORT_TICKETS_COPY.unavailableTitle);
        setErrorDetail(SUPPORT_TICKETS_COPY.malformedPayload);
        return null;
      }
      setTickets(normalized);
      return normalized;
    } catch (err) {
      setTickets([]);
      setErrorTitle(SUPPORT_TICKETS_COPY.unavailableTitle);
      setErrorDetail(safeSupportErrorMessage(err, 'Failed to fetch tickets'));
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.subject || !newTicket.description) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      const previousCount = tickets.length;
      const created = await Api.createSupportTicket(newTicket);
      const createdId = resolveSupportTicketId(created);
      const refreshed = await fetchTickets();
      const confirmed =
        !!refreshed &&
        (createdId
          ? refreshed.some((ticket) => String(ticket?.id || '') === createdId)
          : refreshed.length > previousCount);
      if (!confirmed) {
        setErrorTitle(SUPPORT_TICKETS_COPY.unavailableTitle);
        setErrorDetail(SUPPORT_TICKETS_COPY.creationNotConfirmed);
        return;
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
    } catch (err) {
      setErrorTitle(SUPPORT_TICKETS_COPY.unavailableTitle);
      setErrorDetail(safeSupportErrorMessage(err, SUPPORT_TICKETS_COPY.createFailed));
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket?.id || !commentDraft.trim()) {
      toast.error('Enter a reply before sending');
      return;
    }

    try {
      const comment = await Api.addSupportTicketComment(selectedTicket.id, {
        commentText: commentDraft.trim(),
        isInternal: false,
      });
      setTicketComments((current) => [...current, comment]);
      setCommentDraft('');
      toast.success('Reply added');
    } catch (err) {
      setErrorTitle(SUPPORT_TICKETS_COPY.unavailableTitle);
      setErrorDetail(safeSupportErrorMessage(err, SUPPORT_TICKETS_COPY.replyFailed));
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-400';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'low':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-slate-500/20 text-slate-400 dark:text-slate-500';
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
        return 'bg-slate-500/20 text-slate-400 dark:text-slate-500';
      default:
        return 'bg-slate-500/20 text-slate-400 dark:text-slate-500';
    }
  };

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
          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2"
        >
          <Plus size={18} />
          Create Ticket
        </button>
      </div>

      {errorTitle ? <DegradedState title={errorTitle} description={errorDetail || undefined} /> : null}

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

      {loading ? (
        <div className="text-center py-12 text-slate-600 dark:text-slate-400">Loading...</div>
      ) : errorTitle ? null : (
        <div className="bg-white dark:bg-navy-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-navy-900 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Ticket #
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Subject
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Priority
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Status
                </th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Created
                </th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {tickets.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-12 text-center text-slate-500 dark:text-slate-400"
                  >
                    No tickets found
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="hover:bg-slate-50 dark:hover:bg-navy-700/50">
                    <td className="px-6 py-4 text-slate-900 dark:text-white font-mono text-sm">
                      {ticket.ticket_number}
                    </td>
                    <td className="px-6 py-4 text-slate-900 dark:text-white">{ticket.subject}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${getPriorityColor(ticket.priority)}`}
                      >
                        {ticket.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs ${getStatusColor(ticket.status)}`}
                      >
                        {ticket.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                      {formatTicketDate(ticket.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        className="text-violet-400 hover:text-violet-300"
                        onClick={() => {
                          setSelectedTicket(ticket);
                          setShowDetailsModal(true);
                        }}
                        title="View ticket details"
                      >
                        <MessageSquare size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
                className="flex-1 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg"
              >
                Create Ticket
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
                      <span>
                        {comment.created_at
                          ? new Date(comment.created_at).toLocaleString()
                          : 'Just now'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-900 dark:text-white whitespace-pre-wrap">
                      {comment.comment_text || comment.commentText}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  No replies yet. Add the first response below.
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
                    className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm"
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
