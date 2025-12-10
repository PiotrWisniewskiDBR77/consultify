import React, { useEffect, useState } from 'react';
import { Api } from '../../services/api';
import { Feedback } from '../../types';
import { CheckCircle2, Circle, XCircle, MessageSquare, ExternalLink, Loader2, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

export const AdminFeedbackView: React.FC = () => {
    const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'new' | 'resolved'>('all');

    useEffect(() => {
        loadFeedback();
    }, []);

    const loadFeedback = async () => {
        setIsLoading(true);
        try {
            const data = await Api.getFeedback();
            setFeedbacks(data);
        } catch (error) {
            toast.error('Failed to load feedback');
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdateStatus = async (id: string, status: string) => {
        try {
            await Api.updateFeedbackStatus(id, status);
            toast.success('Status updated');
            // Optimistic update
            setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status: status as any } : f));
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const filteredFeedbacks = feedbacks.filter(f => {
        if (filter === 'all') return true;
        if (filter === 'new') return f.status === 'new' || f.status === 'read';
        if (filter === 'resolved') return f.status === 'resolved';
        return true;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'new': return <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 border border-blue-200">New</span>;
            case 'read': return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700 border border-yellow-200">Read</span>;
            case 'resolved': return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700 border border-green-200">Resolved</span>;
            case 'rejected': return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 border border-red-200">Rejected</span>;
            default: return status;
        }
    };

    return (
        <div className="h-full flex flex-col p-6 bg-gray-50 dark:bg-navy-950 overflow-hidden">
            <div className="mb-6 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-navy-900 dark:text-white">User Feedback</h1>
                    <p className="text-slate-500 dark:text-slate-400">Manage bug reports and feature requests</p>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilter('new')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'new' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                    >
                        Active
                    </button>
                    <button
                        onClick={() => setFilter('resolved')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}
                    >
                        Resolved
                    </button>
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col">
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="animate-spin text-purple-600" size={32} />
                    </div>
                ) : filteredFeedbacks.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                        <MessageSquare size={48} className="mb-4 opacity-50" />
                        <p>No feedback found</p>
                    </div>
                ) : (
                    <div className="overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-slate-50 dark:bg-navy-800 sticky top-0 z-10">
                                <tr>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Data</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-40">User</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">Type</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Message</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Status</th>
                                    <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                {filteredFeedbacks.map(f => (
                                    <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group">
                                        <td className="p-4 text-sm text-slate-500 whitespace-nowrap">
                                            {new Date(f.createdAt).toLocaleDateString()}
                                            <div className="text-xs opacity-70">{new Date(f.createdAt).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm font-medium text-navy-900 dark:text-white">
                                                {f.user?.firstName} {f.user?.lastName}
                                            </div>
                                            <div className="text-xs text-slate-500">{f.user?.email || 'Unknown'}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="capitalize text-sm font-medium text-slate-700 dark:text-slate-300">{f.type}</span>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap max-w-lg">{f.message}</div>
                                            {f.url && (
                                                <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-purple-600 hover:underline mt-1">
                                                    <ExternalLink size={10} />
                                                    View Page Context
                                                </a>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {getStatusBadge(f.status)}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {f.status !== 'resolved' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(f.id, 'resolved')}
                                                        className="p-1 text-green-600 hover:bg-green-50 rounded"
                                                        title="Mark Resolved"
                                                    >
                                                        <CheckCircle2 size={18} />
                                                    </button>
                                                )}
                                                {f.status !== 'rejected' && f.status !== 'resolved' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(f.id, 'rejected')}
                                                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                        title="Reject"
                                                    >
                                                        <XCircle size={18} />
                                                    </button>
                                                )}
                                                {f.status === 'new' && (
                                                    <button
                                                        onClick={() => handleUpdateStatus(f.id, 'read')}
                                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                        title="Mark Read"
                                                    >
                                                        <Circle size={18} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
