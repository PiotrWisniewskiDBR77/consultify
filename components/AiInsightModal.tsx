import React from 'react';
import { X, CheckCircle, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { Button } from './Button';

interface AiInsightModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    type: 'validation' | 'explanation' | 'quarter-review' | 'generic';
    data: any; // Flexible data structure based on type
    onAction?: (action: string, payload?: any) => void;
}

export const AiInsightModal: React.FC<AiInsightModalProps> = ({ isOpen, onClose, title, type, data, onAction }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-navy-950">
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${type === 'validation' && data?.status === 'OK' ? 'bg-green-100 text-green-600' :
                                type === 'validation' && data?.status !== 'OK' ? 'bg-red-100 text-red-600' :
                                    'bg-blue-100 text-blue-600'
                            }`}>
                            {type === 'validation' && data?.status === 'OK' ? <CheckCircle size={20} /> :
                                type === 'validation' ? <AlertTriangle size={20} /> :
                                    <Info size={20} />}
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-navy-900 dark:text-white">{title}</h3>
                            {type === 'validation' && (
                                <p className={`text-xs font-bold uppercase ${data?.status === 'OK' ? 'text-green-600' : 'text-red-500'
                                    }`}>Status: {data?.status}</p>
                            )}
                        </div>
                    </div>
                    <Button variant="ghost" onClick={onClose}><X size={20} /></Button>
                </div>

                {/* Body */}
                <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">

                    {/* Narrative / Analysis */}
                    {data?.narrative && (
                        <div className="prose dark:prose-invert text-sm max-w-none">
                            <p>{data.narrative}</p>
                        </div>
                    )}

                    {data?.analysis && (
                        <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-lg border border-slate-100 dark:border-white/5">
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Analysis</h4>
                            <p className="text-sm text-navy-900 dark:text-slate-200">{data.analysis}</p>
                        </div>
                    )}

                    {/* Observations / Risks */}
                    {(data?.observations?.length > 0 || data?.keyRisks?.length > 0) && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 text-red-500 flex items-center gap-2">
                                <AlertTriangle size={14} /> Key Observations & Risks
                            </h4>
                            <div className="space-y-2">
                                {(data.observations || data.keyRisks).map((item: string, idx: number) => (
                                    <div key={idx} className="flex gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-500/10 hover:border-red-500/30 transition-colors">
                                        <span className="text-red-500">•</span>
                                        <span className="text-sm text-navy-900 dark:text-slate-200">{item}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Suggestions / Next Actions */}
                    {data?.suggestions?.length > 0 && (
                        <div>
                            <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 text-blue-500 flex items-center gap-2">
                                <ArrowRight size={14} /> Recommended Actions
                            </h4>
                            <div className="space-y-2">
                                {data.suggestions.map((s: string, idx: number) => (
                                    <div key={idx} className="flex gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-500/10">
                                        <span className="text-blue-500">→</span>
                                        <span className="text-sm text-navy-900 dark:text-slate-200">{s}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Optimization Reason */}
                    {data?.reasoning && (
                        <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-100 dark:border-green-500/10">
                            <h4 className="text-xs font-bold text-green-600 uppercase mb-2">Optimization Strategy</h4>
                            <p className="text-sm text-navy-900 dark:text-slate-200">{data.reasoning}</p>
                        </div>
                    )}

                </div>

                {/* Footer with Actions */}
                <div className="p-4 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-navy-950 flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    {data?.schedule && (
                        <Button variant="primary" onClick={() => onAction && onAction('apply_schedule', data.schedule)}>
                            Apply Proposed Schedule
                        </Button>
                    )}
                </div>

            </div>
        </div>
    );
};
