import React, { useState } from 'react';
import { Api } from '../services/api';
import { Check, X, Sliders } from 'lucide-react';

interface RebalanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply: (option: any) => void;
    initiatives: any[];
}

export const RebalanceModal: React.FC<RebalanceModalProps> = ({ isOpen, onClose, onApply, initiatives }) => {
    const [options, setOptions] = useState<any[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

    React.useEffect(() => {
        if (isOpen && !options) {
            setLoading(true);
            Api.post('/ai/rebalance-roadmap', { initiatives })
                .then(res => {
                    setOptions(res.options);
                    // Default select "Balanced"
                    const balIdx = res.options.findIndex((o: any) => o.type === 'Balanced');
                    if (balIdx >= 0) setSelectedIdx(balIdx);
                })
                .catch(err => {
                    console.error("Failed to fetch rebalance options", err);
                    setOptions([]); // Error state
                })
                .finally(() => setLoading(false));
        }
    }, [isOpen, initiatives, options]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (selectedIdx !== null && options) {
            onApply(options[selectedIdx]);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-navy-900 w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-navy-950">
                    <div>
                        <h2 className="text-xl font-bold text-navy-900 dark:text-white flex items-center gap-2">
                            <Sliders size={20} className="text-blue-500" />
                            Rebalance Roadmap
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">AI has analyzed your roadmap and proposes these adjustments.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-navy-900 dark:hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4">
                            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-slate-500 font-medium animate-pulse">Analyzing workload distribution...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {options?.map((benefit, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedIdx(idx)}
                                    className={`p-5 rounded-xl border-2 transition-all cursor-pointer relative ${selectedIdx === idx
                                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 shadow-md ring-2 ring-blue-500/20'
                                        : 'border-slate-200 dark:border-white/10 hover:border-blue-300 dark:hover:border-blue-700 bg-white dark:bg-navy-800'
                                        }`}
                                >
                                    {selectedIdx === idx && (
                                        <div className="absolute top-3 right-3 bg-blue-500 text-white p-1 rounded-full shadow-sm">
                                            <Check size={12} strokeWidth={3} />
                                        </div>
                                    )}
                                    <h3 className="font-bold text-lg text-navy-900 dark:text-white mb-2">{benefit.type}</h3>
                                    <p className="text-sm text-slate-500 dark:text-slate-300 mb-4 leading-relaxed">
                                        {benefit.description}
                                    </p>

                                    {/* Mini Visualization Placeholder */}
                                    <div className="space-y-1 mt-auto pt-4 border-t border-slate-100 dark:border-white/5">
                                        <div className="flex justify-between text-[10px] text-slate-400 font-semibold uppercase">
                                            <span>Load Variance</span>
                                            <span className={idx === 0 ? 'text-green-500' : 'text-slate-500'}>{idx === 0 ? 'Low' : idx === 1 ? 'Med' : 'High'}</span>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                                            {/* Dummy bar sizes for visual diff */}
                                            <div className={`h-full rounded-full ${idx === 0 ? 'w-full bg-green-500' : idx === 1 ? 'w-2/3 bg-blue-500' : 'w-full bg-amber-500'}`}></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-navy-950 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-lg text-sm font-semibold text-slate-500 hover:text-navy-900 border border-transparent hover:bg-slate-200/50 dark:hover:text-white transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={loading || selectedIdx === null}
                        className="px-6 py-2.5 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        Apply New Schedule
                    </button>
                </div>
            </div>
        </div>
    );
};
