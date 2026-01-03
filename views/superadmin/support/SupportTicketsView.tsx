/**
 * Support Tickets View
 * Manages support tickets
 */

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, MessageSquare } from 'lucide-react';
import { Api } from '../../../services/api';
import { toast } from 'react-hot-toast';

export const SupportTicketsView: React.FC = () => {
    const [tickets, setTickets] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [filters, setFilters] = useState({
        status: '',
        priority: '',
        organizationId: ''
    });
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newTicket, setNewTicket] = useState({
        organizationId: '',
        userId: '',
        subject: '',
        description: '',
        priority: 'medium',
        category: ''
    });

    useEffect(() => {
        fetchTickets();
    }, [filters]);

    const fetchTickets = async () => {
        setLoading(true);
        try {
            const data = await Api.getSupportTickets(filters);
            setTickets(data);
        } catch (err) {
            toast.error('Failed to fetch tickets');
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
            await Api.createSupportTicket(newTicket);
            toast.success('Ticket created');
            setShowCreateModal(false);
            setNewTicket({ organizationId: '', userId: '', subject: '', description: '', priority: 'medium', category: '' });
            fetchTickets();
        } catch (err: any) {
            toast.error(err.message || 'Failed to create ticket');
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-500/20 text-red-400';
            case 'medium': return 'bg-yellow-500/20 text-yellow-400';
            case 'low': return 'bg-blue-500/20 text-blue-400';
            default: return 'bg-slate-500/20 text-slate-400';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open': return 'bg-blue-500/20 text-blue-400';
            case 'in_progress': return 'bg-yellow-500/20 text-yellow-400';
            case 'resolved': return 'bg-green-500/20 text-green-400';
            case 'closed': return 'bg-slate-500/20 text-slate-400';
            default: return 'bg-slate-500/20 text-slate-400';
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">Support Tickets</h2>
                    <p className="text-slate-400 text-sm mt-1">Manage and track support tickets</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg flex items-center gap-2"
                >
                    <Plus size={18} />
                    Create Ticket
                </button>
            </div>

            <div className="bg-navy-800 rounded-xl border border-slate-700 p-4 flex gap-4">
                <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
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
                    className="bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                >
                    <option value="">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>

            {loading ? (
                <div className="text-center py-12">Loading...</div>
            ) : (
                <div className="bg-navy-800 rounded-xl border border-slate-700 overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-navy-900 border-b border-slate-700">
                            <tr>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Ticket #</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Subject</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Priority</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Status</th>
                                <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Created</th>
                                <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {tickets.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                        No tickets found
                                    </td>
                                </tr>
                            ) : (
                                tickets.map((ticket) => (
                                    <tr key={ticket.id} className="hover:bg-navy-700/50">
                                        <td className="px-6 py-4 text-white font-mono text-sm">{ticket.ticket_number}</td>
                                        <td className="px-6 py-4 text-white">{ticket.subject}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs ${getPriorityColor(ticket.priority)}`}>
                                                {ticket.priority}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs ${getStatusColor(ticket.status)}`}>
                                                {ticket.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-300">
                                            {new Date(ticket.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="text-violet-400 hover:text-violet-300">
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
                    <div className="bg-navy-800 rounded-xl p-6 w-full max-w-2xl border border-slate-700">
                        <h3 className="text-lg font-bold text-white mb-4">Create Support Ticket</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Subject *</label>
                                <input
                                    type="text"
                                    value={newTicket.subject}
                                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                                    className="w-full bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                                    placeholder="Ticket subject"
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-slate-300 mb-2">Description *</label>
                                <textarea
                                    value={newTicket.description}
                                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                                    className="w-full bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                                    rows={5}
                                    placeholder="Describe the issue..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">Priority</label>
                                    <select
                                        value={newTicket.priority}
                                        onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                                        className="w-full bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm text-slate-300 mb-2">Category</label>
                                    <input
                                        type="text"
                                        value={newTicket.category}
                                        onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                                        className="w-full bg-navy-900 border border-slate-700 text-white px-4 py-2 rounded-lg"
                                        placeholder="Category"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-2 border border-slate-700 text-slate-300 rounded-lg hover:bg-navy-700"
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
        </div>
    );
};

