import React, { useEffect, useState } from 'react';
import { ArrowRight, History } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Api } from '../../services/api';

/**
 * WelcomeBackWidget — "Pick up where you left off"
 * 
 * Shows the last active context/view to quickly resume work.
 */

interface LastActivity {
    view: string;
    label: string;
    timestamp: string;
    context?: any;
    url: string;
}

export const WelcomeBackWidget: React.FC = () => {
    const [lastActivity, setLastActivity] = useState<LastActivity | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // In a real implementation, we would fetch this from backend
        // For now, we'll simulate reading from local storage history
        const history = localStorage.getItem('consultify_view_history');
        if (history) {
            try {
                const parsed = JSON.parse(history);
                const last = parsed[0]; // Most recent
                if (last) {
                    setLastActivity({
                        view: last.viewId,
                        label: last.title || 'Ostatnia aktywność',
                        timestamp: last.timestamp,
                        url: last.path
                    });
                }
            } catch (e) {
                console.error('Failed to parse history', e);
            }
        }
    }, []);

    if (!lastActivity) return null;

    return (
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <History size={120} />
            </div>

            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 text-indigo-100 text-sm font-medium">
                    <History size={16} />
                    <span>Witaj z powrotem!</span>
                </div>

                <h3 className="text-2xl font-bold mb-1">
                    Chcesz wrócić do pracy?
                </h3>
                <p className="text-indigo-100 mb-6 max-w-md">
                    Ostatnio pracowałeś nad: <strong className="text-white">{lastActivity.label}</strong>
                </p>

                <button
                    onClick={() => navigate(lastActivity.url)}
                    className="bg-white text-indigo-600 px-5 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-indigo-50 transition-colors shadow-sm"
                >
                    Kontynuuj pracę
                    <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
};

export default WelcomeBackWidget;
