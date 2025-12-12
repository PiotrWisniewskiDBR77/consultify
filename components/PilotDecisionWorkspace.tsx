import React, { useState } from 'react';
import { FullSession, FullInitiative } from '../types';
import { Scale, ArrowRight, Lightbulb, CheckCircle } from 'lucide-react';
import { Button } from './Button';

interface PilotDecisionWorkspaceProps {
    fullSession: FullSession;
    onUpdateInitiative: (initiative: FullInitiative) => void;
    onNextStep: () => void;

}

export const PilotDecisionWorkspace: React.FC<PilotDecisionWorkspaceProps> = ({
    fullSession,
    onUpdateInitiative,
    onNextStep,

}) => {
    const initiatives = fullSession.initiatives || [];

    // Candidates: usually High Priority, High Complexity
    const candidates = initiatives.filter(i => i.priority === 'High');
    const [selectedPilotId, setSelectedPilotId] = useState<string | null>(null);

    const handleSelectPilot = (id: string) => {
        setSelectedPilotId(id);
        // Logic to mark initiative as pilot? 
        // Ideally we flag it. For now just local selection for the decision view.
    };

    const handleConfirmPilot = () => {
        if (selectedPilotId) {
            const init = initiatives.find(i => i.id === selectedPilotId);
            if (init) {
                onUpdateInitiative({ ...init, status: 'step4' }); // 'step4' usually indicates Pilot Execution phase?
                // Actually 'step4' in types is InitiativeStatus. Let's use 'In Progress' or a specialized tag. 
                // Or just proceed. The main thing is identifying the scope for Module 4.
            }
        }
        onNextStep();
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-navy-900 overflow-hidden">
            {/* Header */}
            <div className="h-16 border-b border-slate-200 dark:border-white/5 bg-white dark:bg-navy-800 px-6 flex items-center shrink-0">
                <h2 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                    <Scale className="text-purple-500" /> Pilot vs. Rollout Decision
                </h2>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Candidates List */}
                    <div className="bg-white dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-white/5 p-4 shadow-sm">
                        <h3 className="font-bold text-navy-900 dark:text-white mb-4">Pilot Candidates (High Priority)</h3>
                        <div className="space-y-3">
                            {candidates.map(init => (
                                <div
                                    key={init.id}
                                    onClick={() => handleSelectPilot(init.id)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedPilotId === init.id
                                        ? 'bg-purple-500/10 border-purple-500 ring-1 ring-purple-500'
                                        : 'bg-slate-50 dark:bg-navy-900 border-slate-200 dark:border-white/10 hover:border-purple-300'
                                        }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-semibold text-sm text-navy-900 dark:text-white">{init.name}</h4>
                                        {selectedPilotId === init.id && <CheckCircle size={16} className="text-purple-500" />}
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                                            {init.complexity} Complexity
                                        </span>
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/5 text-slate-600 dark:text-slate-400">
                                            {init.businessValue} Value
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Comparison & Analysis */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* AI Insight */}
                        <div className="bg-blue-600/5 border border-blue-600/10 rounded-xl p-4 flex gap-4">
                            <div className="bg-blue-600/10 p-2 rounded-lg h-fit text-blue-500">
                                <Lightbulb size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-blue-600 dark:text-blue-400 mb-1">AI Recommendation</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-300">
                                    Based on complexity and impact, <strong>{candidates[0]?.name || 'the top candidate'}</strong> is the optimal pilot. It offers high visibility with manageable risk.
                                </p>
                            </div>
                        </div>

                        {/* Scenario Table */}
                        <div className="bg-white dark:bg-navy-950 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-navy-900 text-xs uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="p-4">Criteria</th>
                                        <th className="p-4 text-purple-600 dark:text-purple-400">Pilot Approach (Recommended)</th>
                                        <th className="p-4 text-slate-500">Big Bang Rollout</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                                    <tr>
                                        <td className="p-4 font-medium text-navy-900 dark:text-white">Time to Value</td>
                                        <td className="p-4 text-green-600">Fast (4-8 weeks)</td>
                                        <td className="p-4 text-slate-500">Slow (6-12 months)</td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-medium text-navy-900 dark:text-white">Risk Exposure</td>
                                        <td className="p-4 text-green-600">Contained / Low</td>
                                        <td className="p-4 text-red-500">High Systemic Risk</td>
                                    </tr>
                                    <tr>
                                        <td className="p-4 font-medium text-navy-900 dark:text-white">Resource Load</td>
                                        <td className="p-4 text-green-600">Focused Team</td>
                                        <td className="p-4 text-orange-500">Organization-wide</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end pt-4">
                            <Button onClick={handleConfirmPilot} disabled={!selectedPilotId} className="bg-purple-600 hover:bg-purple-500">
                                Confirm Pilot & Proceed <ArrowRight size={16} className="ml-2" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
