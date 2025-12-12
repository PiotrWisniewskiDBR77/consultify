import React, { useEffect, useState } from 'react';
import { Api } from '../services/api';
import UsageMeters from './billing/UsageMeters';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

interface SidebarUsageProps {
    showFull: boolean;
}

export const SidebarUsage: React.FC<SidebarUsageProps> = ({ showFull }) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { freeSessionData } = useAppStore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [usage, setUsage] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                const data = await Api.getUsage();
                setUsage(data);
            } catch (error) {
                console.error('Failed to fetch sidebar usage:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchUsage();
    }, []);

    if (loading) {
        if (!showFull) return null; // Don't show loader in mini mode
        return (
            <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
            </div>
        );
    }

    if (!usage) return null;

    return (
        <div className={`transition-all duration-300 ${!showFull ? 'px-2' : 'px-4'}`}>
            <UsageMeters usage={usage} compact={!showFull} />
        </div>
    );
};
