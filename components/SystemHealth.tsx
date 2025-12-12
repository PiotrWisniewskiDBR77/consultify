import React, { useState, useEffect } from 'react';
import { Api } from '../services/api';


export const SystemHealth = () => {
    const [status, setStatus] = useState<'online' | 'offline' | 'loading'>('loading');
    const [latency, setLatency] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkHealth = async () => {
            try {
                const data = await Api.checkSystemHealth();
                setStatus('online');
                setLatency(data.latency);
                setError(null);
            } catch (err) {
                setStatus('offline');
                setError(err instanceof Error ? err.message : 'System unreachable');
            }
        };

        // Initial check
        checkHealth();

        // Poll every 30 seconds
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    if (status === 'loading') return null;

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10" title={error || `System Online - DB Latency: ${latency}ms`}>
            <div className={`w-2 h-2 rounded-full ${status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <div className="flex flex-col leading-none">
                <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    {status === 'online' ? 'System Online' : 'System Offline'}
                </span>
                {status === 'online' && (
                    <span className="text-[9px] text-slate-400">
                        {latency}ms latency
                    </span>
                )}
            </div>
        </div>
    );
};
