import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    MessageSquareWarning,
    CheckCircle2,
    Clock,
    Bug,
    Lightbulb,
    User,
    Mail,
    Filter,
    Search
} from 'lucide-react';
import { format } from 'date-fns';
import { pl, enUS } from 'date-fns/locale';
import { Api } from '../../services/api';

interface FeedbackItem {
    id: string;
    user_id: string;
    user_email: string;
    type: 'BUG' | 'IDEA';
    message: string;
    status: 'NEW' | 'READ' | 'RESOLVED';
    created_at: string;
}

export const SuperAdminFeedbackView: React.FC = () => {
    const { t, i18n } = useTranslation();
    const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'NEW' | 'RESOLVED'>('ALL');
    const [search, setSearch] = useState('');

    const fetchFeedback = async () => {
        try {
            const data = await Api.getFeedback();
            setFeedback(data);
        } catch (error) {
            console.error('Error fetching feedback:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchFeedback();
    }, []);

    const updateStatus = async (id: string, newStatus: 'READ' | 'RESOLVED') => {
        try {
            await Api.updateFeedbackStatus(id, newStatus);
            setFeedback(prev => prev.map(item =>
                item.id === id ? { ...item, status: newStatus } : item
            ));
        } catch (error) {
            console.error('Error updating status:', error);
        }
    };

    const filteredFeedback = feedback
        .filter(item => {
            if (filter === 'ALL') return true;
            if (filter === 'NEW') return item.status === 'NEW' || item.status === 'READ';
            return item.status === 'RESOLVED';
        })
        .filter(item =>
            item.message.toLowerCase().includes(search.toLowerCase()) ||
            item.user_email.toLowerCase().includes(search.toLowerCase())
        );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <MessageSquareWarning className="text-amber-500" size={32} />
                        User Feedback & Bugs
                    </h1>
                    <p className="text-slate-400 mt-1">Manage incoming reports and ideas from users.</p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="bg-navy-900 border border-slate-700 text-slate-200 pl-9 pr-4 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none w-64"
                        />
                    </div>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value as any)}
                        className="bg-navy-900 border border-slate-700 text-slate-200 px-3 py-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                        <option value="ALL">All Status</option>
                        <option value="NEW">Active (New/Read)</option>
                        <option value="RESOLVED">Resolved</option>
                    </select>
                </div>
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin text-blue-500">Loading...</div>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredFeedback.length === 0 ? (
                        <div className="text-center py-12 bg-navy-800/50 rounded-xl border border-dashed border-slate-700">
                            <p className="text-slate-500">No feedback found matching your criteria.</p>
                        </div>
                    ) : (
                        filteredFeedback.map((item) => (
                            <div key={item.id} className="bg-navy-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide flex items-center gap-1.5 ${item.type === 'BUG'
                                                ? 'bg-red-900/40 text-red-400 border border-red-900'
                                                : 'bg-amber-900/40 text-amber-400 border border-amber-900'
                                                }`}>
                                                {item.type === 'BUG' ? <Bug size={12} /> : <Lightbulb size={12} />}
                                                {item.type}
                                            </span>
                                            <span className="text-slate-500 text-xs flex items-center gap-1">
                                                <Clock size={12} />
                                                {format(new Date(item.created_at), 'PPP p', { locale: i18n.language === 'pl' ? pl : enUS })}
                                            </span>
                                        </div>

                                        <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                                            {item.message}
                                        </p>

                                        <div className="flex items-center gap-2 mt-2">
                                            <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
                                                <User size={12} className="text-slate-300" />
                                            </div>
                                            <span className="text-xs text-slate-400 font-medium">{item.user_email}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-2 shrink-0">
                                        {item.status !== 'RESOLVED' && (
                                            <button
                                                onClick={() => updateStatus(item.id, 'RESOLVED')}
                                                className="flex items-center gap-2 px-3 py-1.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 text-xs font-medium rounded-lg transition-colors border border-green-600/20"
                                            >
                                                <CheckCircle2 size={14} />
                                                Mark Resolved
                                            </button>
                                        )}
                                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold text-center border ${item.status === 'NEW' ? 'bg-blue-600/10 text-blue-400 border-blue-600/20' :
                                            item.status === 'RESOLVED' ? 'bg-slate-700/50 text-slate-400 border-slate-700' :
                                                'bg-slate-700/50 text-slate-400 border-slate-700'
                                            }`}>
                                            {item.status}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};
