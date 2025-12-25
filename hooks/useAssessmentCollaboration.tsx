/**
 * useAssessmentCollaboration Hook
 * Real-time collaboration for assessment workflows
 * Provides presence indicators, activity feed, and live updates
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

// Types
export interface CollaboratorPresence {
    userId: string;
    userName: string;
    userEmail: string;
    avatarColor: string;
    currentAxis?: string;
    currentView: string;
    lastActivity: Date;
    isActive: boolean;
}

export interface ActivityEvent {
    id: string;
    type: 'AXIS_UPDATE' | 'COMMENT_ADDED' | 'REVIEW_SUBMITTED' | 'STATUS_CHANGE' | 'USER_JOINED' | 'USER_LEFT';
    userId: string;
    userName: string;
    timestamp: Date;
    data: {
        axisId?: string;
        axisName?: string;
        oldValue?: any;
        newValue?: any;
        message?: string;
    };
}

export interface CollaborationState {
    collaborators: CollaboratorPresence[];
    activities: ActivityEvent[];
    isConnected: boolean;
    connectionError: string | null;
}

interface UseAssessmentCollaborationOptions {
    assessmentId: string;
    projectId?: string;
    enablePolling?: boolean;
    pollingInterval?: number;
}

// Generate consistent avatar color from user ID
const getAvatarColor = (userId: string): string => {
    const colors = [
        'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-amber-500',
        'bg-pink-500', 'bg-indigo-500', 'bg-cyan-500', 'bg-rose-500'
    ];
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

// Axis Labels
const AXIS_LABELS: Record<string, string> = {
    processes: 'Digital Processes',
    digitalProducts: 'Digital Products',
    businessModels: 'Business Models',
    dataManagement: 'Data & Analytics',
    culture: 'Organizational Culture',
    cybersecurity: 'Cybersecurity',
    aiMaturity: 'AI Maturity'
};

export const useAssessmentCollaboration = ({
    assessmentId,
    projectId,
    enablePolling = true,
    pollingInterval = 5000
}: UseAssessmentCollaborationOptions) => {
    const { currentUser } = useAppStore();
    
    const [state, setState] = useState<CollaborationState>({
        collaborators: [],
        activities: [],
        isConnected: false,
        connectionError: null
    });

    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const lastActivityRef = useRef<Date>(new Date());
    const currentAxisRef = useRef<string | undefined>(undefined);

    // Helper to get user display name
    const getUserDisplayName = (user: typeof currentUser) => {
        if (!user) return 'Unknown';
        return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown';
    };

    // Heartbeat to update presence
    const sendHeartbeat = useCallback(async () => {
        if (!currentUser || !assessmentId) return;

        try {
            const response = await fetch(`/api/assessment-workflow/${assessmentId}/presence`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUser.id,
                    userName: getUserDisplayName(currentUser),
                    currentAxis: currentAxisRef.current,
                    currentView: 'assessment'
                })
            });

            if (response.ok) {
                const data = await response.json();
                setState(prev => ({
                    ...prev,
                    collaborators: data.collaborators || [],
                    isConnected: true,
                    connectionError: null
                }));
            }
        } catch (error) {
            setState(prev => ({
                ...prev,
                isConnected: false,
                connectionError: 'Connection lost'
            }));
        }
    }, [currentUser, assessmentId]);

    // Fetch recent activities
    const fetchActivities = useCallback(async () => {
        if (!assessmentId) return;

        try {
            const response = await fetch(
                `/api/assessment-workflow/${assessmentId}/activities?since=${lastActivityRef.current.toISOString()}`
            );

            if (response.ok) {
                const data = await response.json();
                if (data.activities && data.activities.length > 0) {
                    setState(prev => ({
                        ...prev,
                        activities: [...data.activities, ...prev.activities].slice(0, 50)
                    }));
                    lastActivityRef.current = new Date();
                }
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
        }
    }, [assessmentId]);

    // Set current axis (for presence indicator)
    const setCurrentAxis = useCallback((axisId: string | undefined) => {
        currentAxisRef.current = axisId;
        sendHeartbeat(); // Immediate update
    }, [sendHeartbeat]);

    // Broadcast activity
    const broadcastActivity = useCallback(async (activity: Omit<ActivityEvent, 'id' | 'userId' | 'userName' | 'timestamp'>) => {
        if (!currentUser || !assessmentId) return;

        const userName = getUserDisplayName(currentUser);
        
        try {
            await fetch(`/api/assessment-workflow/${assessmentId}/activities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...activity,
                    userId: currentUser.id,
                    userName
                })
            });

            // Immediately add to local state
            const newActivity: ActivityEvent = {
                id: `local-${Date.now()}`,
                userId: currentUser.id,
                userName: userName || 'You',
                timestamp: new Date(),
                ...activity
            };

            setState(prev => ({
                ...prev,
                activities: [newActivity, ...prev.activities].slice(0, 50)
            }));
        } catch (error) {
            console.error('Error broadcasting activity:', error);
        }
    }, [currentUser, assessmentId]);

    // Axis update notification
    const notifyAxisUpdate = useCallback((axisId: string, actualScore: number, targetScore: number, previousActual?: number) => {
        broadcastActivity({
            type: 'AXIS_UPDATE',
            data: {
                axisId,
                axisName: AXIS_LABELS[axisId] || axisId,
                oldValue: previousActual,
                newValue: actualScore,
                message: `updated ${AXIS_LABELS[axisId] || axisId} to ${actualScore}/${targetScore}`
            }
        });
    }, [broadcastActivity]);

    // Comment notification
    const notifyCommentAdded = useCallback((axisId: string, commentPreview: string) => {
        broadcastActivity({
            type: 'COMMENT_ADDED',
            data: {
                axisId,
                axisName: AXIS_LABELS[axisId] || axisId,
                message: commentPreview.slice(0, 100)
            }
        });
    }, [broadcastActivity]);

    // Status change notification
    const notifyStatusChange = useCallback((oldStatus: string, newStatus: string) => {
        broadcastActivity({
            type: 'STATUS_CHANGE',
            data: {
                oldValue: oldStatus,
                newValue: newStatus,
                message: `changed status from ${oldStatus} to ${newStatus}`
            }
        });
    }, [broadcastActivity]);

    // Get collaborators on same axis
    const getCollaboratorsOnAxis = useCallback((axisId: string): CollaboratorPresence[] => {
        return state.collaborators.filter(c => 
            c.currentAxis === axisId && c.userId !== currentUser?.id
        );
    }, [state.collaborators, currentUser]);

    // Start/stop polling
    useEffect(() => {
        if (!enablePolling || !assessmentId) return;

        // Initial fetch
        sendHeartbeat();
        fetchActivities();

        // Start polling
        pollingRef.current = setInterval(() => {
            sendHeartbeat();
            fetchActivities();
        }, pollingInterval);

        return () => {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
            }
        };
    }, [enablePolling, assessmentId, pollingInterval, sendHeartbeat, fetchActivities]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (currentUser && assessmentId) {
                // Send leave notification
                fetch(`/api/assessment-workflow/${assessmentId}/presence/leave`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUser.id })
                }).catch(() => {});
            }
        };
    }, [currentUser, assessmentId]);

    return {
        ...state,
        setCurrentAxis,
        broadcastActivity,
        notifyAxisUpdate,
        notifyCommentAdded,
        notifyStatusChange,
        getCollaboratorsOnAxis,
        refresh: () => {
            sendHeartbeat();
            fetchActivities();
        }
    };
};

// Presence Indicator Component
export const PresenceIndicator: React.FC<{
    collaborators: CollaboratorPresence[];
    maxVisible?: number;
}> = ({ collaborators, maxVisible = 4 }) => {
    const visible = collaborators.slice(0, maxVisible);
    const overflow = collaborators.length - maxVisible;

    if (collaborators.length === 0) return null;

    return (
        <div className="flex items-center -space-x-2">
            {visible.map((collaborator, index) => (
                <div
                    key={collaborator.userId}
                    className={`w-8 h-8 rounded-full ${collaborator.avatarColor} flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-navy-900 relative group`}
                    style={{ zIndex: visible.length - index }}
                    title={collaborator.userName}
                >
                    {collaborator.userName.charAt(0).toUpperCase()}
                    
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        {collaborator.userName}
                        {collaborator.currentAxis && (
                            <span className="text-gray-300"> • {AXIS_LABELS[collaborator.currentAxis] || collaborator.currentAxis}</span>
                        )}
                    </div>

                    {/* Active indicator */}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-navy-900 ${
                        collaborator.isActive ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                </div>
            ))}
            
            {overflow > 0 && (
                <div className="w-8 h-8 rounded-full bg-gray-400 flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-navy-900">
                    +{overflow}
                </div>
            )}
        </div>
    );
};

// Activity Feed Component
export const ActivityFeed: React.FC<{
    activities: ActivityEvent[];
    maxItems?: number;
}> = ({ activities, maxItems = 10 }) => {
    const getActivityIcon = (type: ActivityEvent['type']) => {
        switch (type) {
            case 'AXIS_UPDATE': return '📊';
            case 'COMMENT_ADDED': return '💬';
            case 'REVIEW_SUBMITTED': return '✅';
            case 'STATUS_CHANGE': return '🔄';
            case 'USER_JOINED': return '👋';
            case 'USER_LEFT': return '🚶';
            default: return '📝';
        }
    };

    const getTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - new Date(date).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMs / 3600000);
        if (diffHours < 24) return `${diffHours}h ago`;
        return new Date(date).toLocaleDateString();
    };

    if (activities.length === 0) {
        return (
            <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">
                No recent activity
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {activities.slice(0, maxItems).map(activity => (
                <div key={activity.id} className="flex items-start gap-2">
                    <span className="text-sm">{getActivityIcon(activity.type)}</span>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">{activity.userName}</span>
                            {' '}
                            {activity.data.message || activity.type.toLowerCase().replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {getTimeAgo(activity.timestamp)}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default useAssessmentCollaboration;

