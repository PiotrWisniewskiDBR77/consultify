import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ActionProposalList, ActionProposal } from '../components/ai/ActionProposalList';
import { ActionProposalDetail } from '../components/ai/ActionProposalDetail';
import { ActionDecisionDialog } from '../components/ai/ActionDecisionDialog';
import { ActionAuditTrail, AuditRecord } from '../components/ai/ActionAuditTrail';
import { Sparkles, History, Brain, Zap, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Api } from '../services/api';

export const ActionProposalView: React.FC = () => {
    const { currentUser } = useAppStore();
    const [proposals, setProposals] = useState<ActionProposal[]>([]);
    const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
    const [selectedProposal, setSelectedProposal] = useState<ActionProposal | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'PENDING' | 'AUDIT'>('PENDING');

    // Dialog state
    const [decisionType, setDecisionType] = useState<'APPROVE' | 'REJECT' | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [propRes, auditRes] = await Promise.all([
                Api.getAIActionProposals(),
                Api.getAIActionAudit()
            ]);

            setProposals(propRes || []);
            setAuditRecords(auditRes || []);

            // Auto-select first proposal if none selected
            if (propRes && propRes.length > 0 && !selectedProposal) {
                setSelectedProposal(propRes[0]);
            }
        } catch (error) {
            console.error('[ActionProposalView] Error loading data:', error);
            toast.error('Failed to load AI Action Proposals');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDecisionClick = (type: 'APPROVE' | 'REJECT') => {
        setDecisionType(type);
        setIsDialogOpen(true);
    };

    const handleConfirmDecision = async (reason: string) => {
        if (!selectedProposal || !decisionType) return;

        setIsDialogOpen(false);
        const loadingToast = toast.loading(`${decisionType === 'APPROVE' ? 'Executing' : 'Rejecting'} proposal...`);

        try {
            await Api.recordAIActionDecision({
                proposal_id: selectedProposal.proposal_id,
                decision: decisionType === 'APPROVE' ? 'APPROVED' : 'REJECTED',
                reason
            });

            toast.dismiss(loadingToast);
            toast.success(`Proposal ${decisionType === 'APPROVE' ? 'approved and executed' : 'rejected'} successfully.`);

            // Refresh data
            loadData();
            setSelectedProposal(null);
        } catch (error: any) {
            toast.dismiss(loadingToast);
            toast.error(error.message || 'Failed to process decision');
            console.error(error);
        }
    };

    const handleExport = async (format: 'json' | 'csv') => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/ai/actions/audit/export?format=${format}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) throw new Error('Export failed');

            if (format === 'csv') {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'audit_decisions.csv';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            } else {
                const data = await response.json();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'audit_decisions.json';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            }

            toast.success(`Exported audit log as ${format.toUpperCase()}`);
        } catch (error) {
            console.error('[ActionProposalView] Export error:', error);
            toast.error('Failed to export audit log');
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-navy-950 overflow-hidden">
            {/* Top Stats/Header Strip */}
            <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-white/5 py-8 px-8 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 rotate-3">
                        <Brain size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-navy-900 dark:text-white tracking-tight">AI Advisor Action Center</h1>
                        <p className="text-slate-500 text-sm font-medium">Algorithmic intelligence governing organizational friction.</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="px-5 py-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-500/20 rounded-2xl">
                        <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-0.5">Pending Proposals</div>
                        <div className="text-2xl font-black text-indigo-700 dark:text-indigo-400">{proposals.length}</div>
                    </div>
                </div>
            </div>

            {/* Main Tabs Selection */}
            <div className="px-8 pt-4 shrink-0">
                <div className="flex gap-1 p-1 bg-slate-200/50 dark:bg-navy-900/50 rounded-xl w-fit border border-slate-200 dark:border-white/5">
                    <button
                        onClick={() => setActiveTab('PENDING')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'PENDING' ? 'bg-white dark:bg-navy-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                            }`}
                    >
                        <Zap size={16} />
                        Pending Approvals
                    </button>
                    <button
                        onClick={() => setActiveTab('AUDIT')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'AUDIT' ? 'bg-white dark:bg-navy-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-navy-900 dark:hover:text-white'
                            }`}
                    >
                        <History size={16} />
                        Audit Trail
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex gap-8 p-8 overflow-hidden min-h-0">
                {activeTab === 'PENDING' ? (
                    <>
                        {/* List Sidebar */}
                        <div className="w-1/3 flex flex-col min-h-0">
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                                AI Proposals Queue
                                <span className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full text-[10px]">{proposals.length}</span>
                            </h3>
                            <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
                                <ActionProposalList
                                    proposals={proposals}
                                    onSelect={setSelectedProposal}
                                    selectedId={selectedProposal?.proposal_id}
                                />
                            </div>
                        </div>

                        {/* Detail View */}
                        <div className="flex-1 flex flex-col min-h-0">
                            <ActionProposalDetail
                                proposal={selectedProposal}
                                onApprove={() => handleDecisionClick('APPROVE')}
                                onReject={() => handleDecisionClick('REJECT')}
                            />
                        </div>
                    </>
                ) : (
                    <div className="w-full flex flex-col min-h-0 max-w-4xl mx-auto">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-navy-900 dark:text-white">Immutable Action Audit</h3>
                                <p className="text-sm text-slate-500">Every AI intervention is logged with human accountability.</p>
                            </div>
                            <div className="p-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/5 rounded-2xl flex items-center gap-3">
                                <ShieldCheck className="text-emerald-500" size={20} />
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Governed Environment</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin">
                            <ActionAuditTrail records={auditRecords} loading={isLoading} onExport={handleExport} />
                        </div>
                    </div>
                )}
            </div>

            <ActionDecisionDialog
                isOpen={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                onConfirm={handleConfirmDecision}
                type={decisionType || 'APPROVE'}
                title={selectedProposal?.title || ''}
            />
        </div>
    );
};
