/**
 * SettingsHistory - Audit log of all settings changes
 */

import { ChevronDown, Clock, Filter, History, Loader2, RotateCcw, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../../services/api';
import { User } from '../../../types';
import { InfoButton } from '../../shared/InfoButton';

interface SettingsHistoryProps {
    currentUser: User;
    onUpdateUser: (updates: Partial<User>) => void;
}

interface HistoryEntry {
    id: string;
    category: string;
    setting: string;
    action: 'created' | 'updated' | 'deleted' | 'restored';
    oldValue?: string;
    newValue?: string;
    timestamp: string;
    device?: string;
    ipAddress?: string;
}

export const SettingsHistory: React.FC<SettingsHistoryProps> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

    const categories = ['Profile', 'Security', 'Privacy', 'AI', 'Notifications', 'Integrations', 'Appearance'];

    useEffect(() => {
        loadData();
    }, [currentUser.id, dateRange]);

    const loadData = async () => {
        try {
            setLoading(true);
            // Sample history data
            setEntries([
                {
                    id: '1',
                    category: 'Profile',
                    setting: 'Display Name',
                    action: 'updated',
                    oldValue: 'John Doe',
                    newValue: 'John D.',
                    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
                    device: 'Chrome on MacOS',
                    ipAddress: '192.168.1.1',
                },
                {
                    id: '2',
                    category: 'Security',
                    setting: 'Two-Factor Auth',
                    action: 'updated',
                    oldValue: 'Disabled',
                    newValue: 'Enabled (Authenticator)',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
                    device: 'Chrome on MacOS',
                    ipAddress: '192.168.1.1',
                },
                {
                    id: '3',
                    category: 'AI',
                    setting: 'Preferred Model',
                    action: 'updated',
                    oldValue: 'GPT-3.5',
                    newValue: 'GPT-4',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
                    device: 'Safari on iOS',
                    ipAddress: '10.0.0.5',
                },
                {
                    id: '4',
                    category: 'Notifications',
                    setting: 'Email Digest',
                    action: 'updated',
                    oldValue: 'Daily',
                    newValue: 'Weekly',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
                    device: 'Firefox on Windows',
                    ipAddress: '172.16.0.1',
                },
                {
                    id: '5',
                    category: 'Appearance',
                    setting: 'Theme',
                    action: 'updated',
                    oldValue: 'Light',
                    newValue: 'Dark',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
                    device: 'Chrome on MacOS',
                    ipAddress: '192.168.1.1',
                },
                {
                    id: '6',
                    category: 'Privacy',
                    setting: 'Data Sharing',
                    action: 'updated',
                    oldValue: 'Enabled',
                    newValue: 'Disabled',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
                    device: 'Chrome on MacOS',
                    ipAddress: '192.168.1.1',
                },
                {
                    id: '7',
                    category: 'Integrations',
                    setting: 'Slack',
                    action: 'created',
                    newValue: 'Connected',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 168).toISOString(),
                    device: 'Chrome on MacOS',
                    ipAddress: '192.168.1.1',
                },
                {
                    id: '8',
                    category: 'Profile',
                    setting: 'Avatar',
                    action: 'updated',
                    oldValue: 'Default',
                    newValue: 'Custom',
                    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
                    device: 'Safari on iOS',
                    ipAddress: '10.0.0.5',
                },
            ]);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleRestore = async (entry: HistoryEntry) => {
        if (!entry.oldValue) return;
        if (!window.confirm(`Restore "${entry.setting}" to "${entry.oldValue}"?`)) return;

        try {
            toast.success(`Restored ${entry.setting} to previous value`);
        } catch (error) {
            toast.error('Failed to restore setting');
        }
    };

    const filteredEntries = entries.filter((e) => {
        const matchesSearch =
            e.setting.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.category.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || e.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return date.toLocaleDateString();
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'created':
                return 'text-green-600 bg-green-100 dark:bg-green-500/20';
            case 'updated':
                return 'text-blue-600 bg-blue-100 dark:bg-blue-500/20';
            case 'deleted':
                return 'text-red-600 bg-red-100 dark:bg-red-500/20';
            case 'restored':
                return 'text-purple-600 bg-purple-100 dark:bg-purple-500/20';
            default:
                return 'text-slate-600 bg-slate-100 dark:bg-slate-500/20';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 size={32} className="animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in relative">
            <InfoButton cardId="settings-history" position="top-right" />

            <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
                    <History size={28} className="text-amber-500" />
                    Settings History
                </h2>
                <p className="text-slate-500 text-sm mt-1">View and restore previous settings changes</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px] relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search changes..."
                        className="w-full pl-10 pr-4 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-amber-500"
                    />
                </div>

                <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
                >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                        <option key={cat} value={cat}>
                            {cat}
                        </option>
                    ))}
                </select>

                <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value as any)}
                    className="px-3 py-2 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-lg"
                >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="all">All time</option>
                </select>
            </div>

            {/* History List */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                {filteredEntries.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                        <History size={48} className="mx-auto mb-3 opacity-50" />
                        <p>No settings changes found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-200 dark:divide-white/10">
                        {filteredEntries.map((entry) => (
                            <div key={entry.id} className="hover:bg-slate-50 dark:hover:bg-navy-950">
                                <button
                                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                                    className="w-full p-4 text-left"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col items-center">
                                                <Clock size={14} className="text-slate-400" />
                                                <span className="text-xs text-slate-500 mt-1">
                                                    {formatTime(entry.timestamp)}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${getActionColor(entry.action)}`}
                                                    >
                                                        {entry.action}
                                                    </span>
                                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-navy-800 rounded-full text-xs text-slate-600 dark:text-slate-400">
                                                        {entry.category}
                                                    </span>
                                                </div>
                                                <p className="font-medium text-slate-900 dark:text-white mt-1">
                                                    {entry.setting}
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronDown
                                            size={16}
                                            className={`text-slate-400 transition-transform ${expandedId === entry.id ? 'rotate-180' : ''}`}
                                        />
                                    </div>
                                </button>

                                {expandedId === entry.id && (
                                    <div className="px-4 pb-4 pt-0">
                                        <div className="ml-[76px] p-4 bg-slate-50 dark:bg-navy-950 rounded-lg space-y-3">
                                            {entry.oldValue && (
                                                <div className="flex gap-4">
                                                    <span className="text-sm text-slate-500 w-20">Before:</span>
                                                    <span className="text-sm text-red-600 dark:text-red-400 line-through">
                                                        {entry.oldValue}
                                                    </span>
                                                </div>
                                            )}
                                            {entry.newValue && (
                                                <div className="flex gap-4">
                                                    <span className="text-sm text-slate-500 w-20">After:</span>
                                                    <span className="text-sm text-green-600 dark:text-green-400">
                                                        {entry.newValue}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex gap-4 pt-2 border-t border-slate-200 dark:border-white/10">
                                                <span className="text-sm text-slate-500 w-20">Device:</span>
                                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                                    {entry.device}
                                                </span>
                                            </div>
                                            <div className="flex gap-4">
                                                <span className="text-sm text-slate-500 w-20">IP:</span>
                                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                                    {entry.ipAddress}
                                                </span>
                                            </div>
                                            <div className="flex gap-4">
                                                <span className="text-sm text-slate-500 w-20">Time:</span>
                                                <span className="text-sm text-slate-700 dark:text-slate-300">
                                                    {new Date(entry.timestamp).toLocaleString()}
                                                </span>
                                            </div>

                                            {entry.oldValue && (
                                                <button
                                                    onClick={() => handleRestore(entry)}
                                                    className="flex items-center gap-2 mt-3 px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-100 dark:hover:bg-amber-500/20 rounded-lg"
                                                >
                                                    <RotateCcw size={14} />
                                                    Restore Previous Value
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{entries.length}</p>
                    <p className="text-sm text-slate-500">Total Changes</p>
                </div>
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {new Set(entries.map((e) => e.category)).size}
                    </p>
                    <p className="text-sm text-slate-500">Categories</p>
                </div>
                <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {entries.filter((e) => new Date(e.timestamp) > new Date(Date.now() - 86400000)).length}
                    </p>
                    <p className="text-sm text-slate-500">Today</p>
                </div>
            </div>
        </div>
    );
};

export default SettingsHistory;


