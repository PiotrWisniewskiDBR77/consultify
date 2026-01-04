/**
 * ActivityLog - User activity history
 *
 * Features:
 * - Display recent user actions
 * - Login history with IP/device info
 * - Profile changes
 * - Permission changes
 * - Document uploads
 * - Filtering by action type
 */

import {
    Activity,
    ChevronDown,
    Clock,
    FileText,
    Filter,
    Globe,
    Key,
    Loader2,
    LogIn,
    LogOut,
    MapPin,
    Monitor,
    RefreshCw,
    Settings,
    Shield,
    Smartphone,
    Upload,
    User as UserIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';
import { User } from '../../types';

interface ActivityLogProps {
    currentUser: User;
}

interface ActivityEntry {
    id: string;
    action: string;
    category: string;
    description: string;
    metadata?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}

// Action type configurations
const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
    LOGIN: { icon: LogIn, color: 'text-green-500 bg-green-50 dark:bg-green-500/10', label: 'Login' },
    LOGOUT: { icon: LogOut, color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10', label: 'Logout' },
    LOGIN_FAILED: { icon: LogIn, color: 'text-red-500 bg-red-50 dark:bg-red-500/10', label: 'Failed Login' },
    PROFILE_UPDATE: { icon: UserIcon, color: 'text-blue-500 bg-blue-50 dark:bg-blue-500/10', label: 'Profile Update' },
    PASSWORD_CHANGE: {
        icon: Key,
        color: 'text-purple-500 bg-purple-50 dark:bg-purple-500/10',
        label: 'Password Change',
    },
    MFA_ENABLED: { icon: Shield, color: 'text-green-500 bg-green-50 dark:bg-green-500/10', label: '2FA Enabled' },
    MFA_DISABLED: { icon: Shield, color: 'text-orange-500 bg-orange-50 dark:bg-orange-500/10', label: '2FA Disabled' },
    DOCUMENT_UPLOAD: {
        icon: Upload,
        color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10',
        label: 'Document Upload',
    },
    SETTINGS_CHANGE: {
        icon: Settings,
        color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10',
        label: 'Settings Change',
    },
    ROLE_CHANGE: { icon: Shield, color: 'text-amber-500 bg-amber-50 dark:bg-amber-500/10', label: 'Role Change' },
    DEFAULT: { icon: Activity, color: 'text-slate-500 bg-slate-50 dark:bg-slate-500/10', label: 'Activity' },
};

// Category filters
const CATEGORIES = [
    { value: 'all', label: 'All Activity' },
    { value: 'auth', label: 'Authentication' },
    { value: 'profile', label: 'Profile' },
    { value: 'security', label: 'Security' },
    { value: 'documents', label: 'Documents' },
];

// Parse user agent to get device info
const parseUserAgent = (ua?: string): { device: string; browser: string; os: string } => {
    if (!ua) return { device: 'Unknown', browser: 'Unknown', os: 'Unknown' };

    const isMobile = /Mobile|Android|iPhone|iPad/.test(ua);
    const device = isMobile ? 'Mobile' : 'Desktop';

    let browser = 'Unknown';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone')) os = 'iOS';

    return { device, browser, os };
};

// Format relative time
const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

export const ActivityLog: React.FC<ActivityLogProps> = ({ currentUser }) => {
    const { t } = useTranslation();
    const [activities, setActivities] = useState<ActivityEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [showFilters, setShowFilters] = useState(false);

    // Fetch activity log
    const fetchActivities = useCallback(async () => {
        try {
            setLoading(true);
            // Note: This endpoint would need to be implemented in the backend
            // For now, we'll simulate some data
            const data = await simulateActivityData(currentUser);
            setActivities(data);
        } catch (error) {
            console.error('Failed to fetch activity log:', error);
            toast.error(t('settings.activity.fetchError', 'Failed to load activity log'));
        } finally {
            setLoading(false);
        }
    }, [currentUser, t]);

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]);

    // Filter activities
    const filteredActivities = activities.filter((activity) => {
        if (selectedCategory === 'all') return true;
        return activity.category === selectedCategory;
    });

    // Group activities by date
    const groupedActivities = filteredActivities.reduce(
        (groups, activity) => {
            const date = new Date(activity.createdAt).toLocaleDateString();
            if (!groups[date]) groups[date] = [];
            groups[date].push(activity);
            return groups;
        },
        {} as Record<string, ActivityEntry[]>,
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {t('settings.activity.title', 'Activity Log')}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {t('settings.activity.subtitle', 'Recent account activity and security events')}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchActivities}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw size={18} className={`text-slate-500 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                            showFilters
                                ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300'
                        }`}
                    >
                        <Filter size={16} />
                        Filter
                        <ChevronDown size={14} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            {showFilters && (
                <div className="flex items-center gap-2 p-4 bg-slate-50 dark:bg-white/5 rounded-lg animate-in fade-in slide-in-from-top-2">
                    {CATEGORIES.map((category) => (
                        <button
                            key={category.value}
                            onClick={() => setSelectedCategory(category.value)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                selectedCategory === category.value
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white dark:bg-navy-800 text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-500/10'
                            }`}
                        >
                            {category.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Activity List */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                    </div>
                ) : filteredActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <Activity size={40} className="mb-3 opacity-30" />
                        <p className="text-sm">{t('settings.activity.noActivity', 'No activity found')}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {Object.entries(groupedActivities).map(([date, dayActivities]) => (
                            <div key={date}>
                                {/* Date Header */}
                                <div className="px-6 py-3 bg-slate-50 dark:bg-white/5 sticky top-0">
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        {date === new Date().toLocaleDateString() ? 'Today' : date}
                                    </p>
                                </div>

                                {/* Activities for this date */}
                                {dayActivities.map((activity) => {
                                    const config = ACTION_CONFIG[activity.action] || ACTION_CONFIG.DEFAULT;
                                    const ActionIcon = config.icon;
                                    const deviceInfo = parseUserAgent(activity.userAgent);

                                    return (
                                        <div
                                            key={activity.id}
                                            className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                                        >
                                            <div className="flex items-start gap-4">
                                                {/* Icon */}
                                                <div className={`p-2 rounded-lg ${config.color}`}>
                                                    <ActionIcon size={18} />
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="font-medium text-slate-900 dark:text-white">
                                                            {config.label}
                                                        </p>
                                                        <span className="text-xs text-slate-400">
                                                            {formatRelativeTime(activity.createdAt)}
                                                        </span>
                                                    </div>

                                                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                                                        {activity.description}
                                                    </p>

                                                    {/* Metadata */}
                                                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                                                        {activity.ipAddress && (
                                                            <div className="flex items-center gap-1">
                                                                <Globe size={12} />
                                                                <span>{activity.ipAddress}</span>
                                                            </div>
                                                        )}
                                                        {activity.userAgent && (
                                                            <>
                                                                <div className="flex items-center gap-1">
                                                                    {deviceInfo.device === 'Mobile' ? (
                                                                        <Smartphone size={12} />
                                                                    ) : (
                                                                        <Monitor size={12} />
                                                                    )}
                                                                    <span>{deviceInfo.device}</span>
                                                                </div>
                                                                <span>
                                                                    {deviceInfo.browser} on {deviceInfo.os}
                                                                </span>
                                                            </>
                                                        )}
                                                        <div className="flex items-center gap-1">
                                                            <Clock size={12} />
                                                            <span>
                                                                {new Date(activity.createdAt).toLocaleTimeString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Security Notice */}
            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-100 dark:border-white/5">
                <div className="flex items-start gap-3">
                    <Shield size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
                    <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {t('settings.activity.securityTip', 'Security Tip')}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {t(
                                'settings.activity.securityText',
                                'Review your activity regularly. If you see any suspicious activity, change your password immediately and enable two-factor authentication.',
                            )}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Simulate activity data (replace with actual API call)
async function simulateActivityData(user: User): Promise<ActivityEntry[]> {
    const now = new Date();
    const activities: ActivityEntry[] = [
        {
            id: '1',
            action: 'LOGIN',
            category: 'auth',
            description: 'Successful login from Chrome on macOS',
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
            createdAt: new Date(now.getTime() - 1000 * 60 * 5).toISOString(), // 5 mins ago
        },
        {
            id: '2',
            action: 'PROFILE_UPDATE',
            category: 'profile',
            description: 'Updated profile information: First name, Last name',
            createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
        },
        {
            id: '3',
            action: 'SETTINGS_CHANGE',
            category: 'profile',
            description: 'Changed interface theme to Dark',
            createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
        },
        {
            id: '4',
            action: 'LOGIN',
            category: 'auth',
            description: 'Successful login from Safari on iOS',
            ipAddress: '10.0.0.55',
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1',
            createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
        },
        {
            id: '5',
            action: 'DOCUMENT_UPLOAD',
            category: 'documents',
            description: 'Uploaded: project_report_q4.pdf (2.3 MB)',
            createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
        },
        {
            id: '6',
            action: 'PASSWORD_CHANGE',
            category: 'security',
            description: 'Password changed successfully',
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
            createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
        },
        {
            id: '7',
            action: 'MFA_ENABLED',
            category: 'security',
            description: 'Two-factor authentication enabled',
            createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 7 days ago
        },
    ];

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return activities;
}

export default ActivityLog;



