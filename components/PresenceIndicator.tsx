import React, { useEffect, useState } from 'react';
import { realtimeClient } from '../services/realtimeClient';
import { Users } from 'lucide-react';

interface PresenceIndicatorProps {
    className?: string;
}

export const PresenceIndicator: React.FC<PresenceIndicatorProps> = ({ className = '' }) => {
    const [activeUsers, setActiveUsers] = useState<string[]>([]);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
         
        const handlePresence = (data: any) => {
            setActiveUsers(data.users || []);
        };

        const handleConnected = () => {
            setIsConnected(true);
        };

        const handleDisconnected = () => {
            setIsConnected(false);
            setActiveUsers([]);
        };

        realtimeClient.on('presence_update', handlePresence);
        realtimeClient.on('connected', handleConnected);
        realtimeClient.on('disconnected', handleDisconnected);

        return () => {
            realtimeClient.off('presence_update', handlePresence);
            realtimeClient.off('connected', handleConnected);
            realtimeClient.off('disconnected', handleDisconnected);
        };
    }, []);

    if (!isConnected) {
        return null;
    }

    const count = activeUsers.length;

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="relative">
                    <Users size={16} className="text-green-500" />
                    <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                    {count} online
                </span>
            </div>
        </div>
    );
};

interface LiveUpdateBadgeProps {
    show: boolean;
    message: string;
}

export const LiveUpdateBadge: React.FC<LiveUpdateBadgeProps> = ({ show, message }) => {
    if (!show) return null;

    return (
        <div className="fixed top-20 right-4 z-50 animate-in slide-in-from-right fade-in">
            <div className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-sm font-medium">{message}</span>
            </div>
        </div>
    );
};
