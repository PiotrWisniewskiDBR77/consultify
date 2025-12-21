import React from 'react';
import { AlertCircle, ShieldAlert, Cpu } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export const AIFreezeBanner: React.FC = () => {
    const { aiFreezeStatus } = useAppStore();

    if (!aiFreezeStatus.isFrozen) return null;

    return (
        <div className="bg-amber-600 dark:bg-amber-900/40 text-white px-4 py-2 flex items-center justify-between shadow-lg z-[70] border-b border-amber-500/30 backdrop-blur-md animate-in slide-in-from-top duration-300">
            <div className="flex items-center gap-3">
                <div className="bg-amber-500/30 p-1.5 rounded-full">
                    <ShieldAlert size={18} className="text-white animate-pulse" />
                </div>
                <div>
                    <span className="font-bold text-sm tracking-wide">AI FREEZE ACTIVE:</span>
                    <span className="text-sm ml-2 text-amber-50 opacity-90">
                        Budget hard limit reached ({aiFreezeStatus.scope || 'Global'}). AI functionality is temporarily restricted.
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 bg-black/20 px-3 py-1 rounded-full border border-white/10">
                    <Cpu size={14} className="text-amber-200" />
                    <span className="text-[11px] font-medium uppercase tracking-tighter">Budget Control Protocol</span>
                </div>
                <button
                    onClick={() => window.location.href = '/settings/billing'}
                    className="bg-white text-amber-700 hover:bg-amber-50 px-4 py-1 rounded-lg text-xs font-bold transition-all shadow-sm border border-transparent active:scale-95"
                >
                    Increase Budget
                </button>
            </div>
        </div>
    );
};
