import React, { useState } from 'react';
import { X, MessageSquare, AlertCircle, ShieldCheck } from 'lucide-react';

interface ActionDecisionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    type: 'APPROVE' | 'REJECT';
    title: string;
}

export const ActionDecisionDialog: React.FC<ActionDecisionDialogProps> = ({ isOpen, onClose, onConfirm, type, title }) => {
    const [reason, setReason] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose} />

            <div className="bg-white dark:bg-navy-900 w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl relative z-10 animate-in zoom-in-95 slide-in-from-bottom-5 duration-300">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${type === 'APPROVE' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
                                {type === 'APPROVE' ? <ShieldCheck size={20} /> : <AlertCircle size={20} />}
                            </div>
                            <h3 className="text-xl font-bold text-navy-900 dark:text-white">
                                {type === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
                            </h3>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    <div className="mb-6">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">You are {type === 'APPROVE' ? 'approving' : 'rejecting'} the following action:</p>
                        <div className="p-3 bg-slate-50 dark:bg-navy-950 rounded-lg border border-slate-200 dark:border-white/5 text-sm font-semibold text-navy-900 dark:text-white">
                            {title}
                        </div>
                    </div>

                    <div className="space-y-2 mb-8">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare size={14} /> Reason for decision
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder={type === 'APPROVE' ? "Explain why this action is being approved (optional)..." : "Please provide a reason for rejecting this proposal..."}
                            className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-sm dark:text-white"
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 px-4 rounded-xl bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-200 dark:hover:bg-navy-700 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => onConfirm(reason)}
                            disabled={type === 'REJECT' && !reason.trim()}
                            className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${type === 'APPROVE' ? 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20'
                                }`}
                        >
                            {type === 'APPROVE' ? 'Confirm & Execute' : 'Confirm Rejection'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
