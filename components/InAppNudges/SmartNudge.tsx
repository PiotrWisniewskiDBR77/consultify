import React, { useEffect, useState } from 'react';
import { Lightbulb, X, ArrowRight } from 'lucide-react';
import { useLocation } from 'react-router-dom';

/**
 * SmartNudge — In-app guidance triggered by inactivity
 * 
 * Detects idle time and suggests next steps based on current view.
 */

const IDLE_THRESHOLD = 30000; // 30 seconds for demo purposes
// In production: 120000 (2 minutes)

interface NudgeConfig {
    pathPattern: RegExp;
    message: string;
    actionLabel: string;
    actionUrl: string;
}

const NUDGES: NudgeConfig[] = [
    {
        pathPattern: /\/full-step1/,
        message: "Wygląda na to, że analizujesz obecny stan. Potrzebujesz pomocy AI w ocenie?",
        actionLabel: "Zapytaj AI",
        actionUrl: "#ai-chat"
    },
    {
        pathPattern: /\/drd/,
        message: "Stworzenie osi decyzyjnej to kluczowy krok. Możesz zacząć od szablonu.",
        actionLabel: "Użyj szablonu",
        actionUrl: "#templates"
    }
];

export const SmartNudge: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);
    const [activeNudge, setActiveNudge] = useState<NudgeConfig | null>(null);
    const location = useLocation();

    useEffect(() => {
        let timeout: NodeJS.Timeout;

        const resetTimer = () => {
            setIsVisible(false);
            clearTimeout(timeout);
            timeout = setTimeout(checkAndShowNudge, IDLE_THRESHOLD);
        };

        const checkAndShowNudge = () => {
            const path = location.pathname;
            const nudge = NUDGES.find(n => n.pathPattern.test(path));

            if (nudge) {
                setActiveNudge(nudge);
                setIsVisible(true);
            }
        };

        // Events to reset idle timer
        window.addEventListener('mousemove', resetTimer);
        window.addEventListener('keydown', resetTimer);
        window.addEventListener('click', resetTimer);

        resetTimer(); // Init

        return () => {
            window.removeEventListener('mousemove', resetTimer);
            window.removeEventListener('keydown', resetTimer);
            window.removeEventListener('click', resetTimer);
            clearTimeout(timeout);
        };
    }, [location.pathname]);

    if (!isVisible || !activeNudge) return null;

    return (
        <div className="fixed bottom-24 right-6 w-80 bg-white dark:bg-navy-800 rounded-xl shadow-2xl border border-amber-200 dark:border-amber-900/50 p-4 z-40 animate-in slide-in-from-right-10 fade-in duration-500">
            <button
                onClick={() => setIsVisible(false)}
                className="absolute top-2 right-2 text-slate-400 hover:text-slate-600"
            >
                <X size={14} />
            </button>

            <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                    <Lightbulb size={20} className="text-amber-500" />
                </div>
                <div>
                    <h4 className="font-bold text-navy-900 dark:text-white text-sm mb-1">
                        Utknąłeś?
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                        {activeNudge.message}
                    </p>
                    <button className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:gap-2 transition-all">
                        {activeNudge.actionLabel}
                        <ArrowRight size={12} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SmartNudge;
