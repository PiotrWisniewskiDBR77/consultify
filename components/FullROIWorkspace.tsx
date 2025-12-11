import React, { useState } from 'react';
import { FullSession, FullInitiative, Language, EconomicsSummary } from '../types';
import { translations } from '../translations';
import {
    DollarSign, TrendingUp, PieChart, Layers, FileText,
    ArrowRight, Activity, Clock
} from 'lucide-react';
import { ROIPaybackChart } from './ROIPaybackChart';
// We might reuse components from FullStep4Workspace or just inline them for now to get the structure right.

interface FullROIWorkspaceProps {
    fullSession: FullSession;
    onUpdateInitiative: (initiative: FullInitiative) => void;
    onNextStep: () => void;
    language: Language;
}

type ROITab = 'initiatives' | 'portfolio' | 'cost' | 'scenarios' | 'summary';

export const FullROIWorkspace: React.FC<FullROIWorkspaceProps> = ({
    fullSession,
    onUpdateInitiative,
    onNextStep,
    language
}) => {
    const [activeTab, setActiveTab] = useState<ROITab>('portfolio'); // Default to Portfolio (Macro view)
    const t = translations.fullROI;
    const initiatives = fullSession.initiatives || [];
    const economics = {
        totalCost: fullSession.economics?.totalCost ?? 0,
        totalAnnualBenefit: fullSession.economics?.totalAnnualBenefit ?? 0,
        overallROI: fullSession.economics?.overallROI ?? 0,
        paybackPeriodYears: fullSession.economics?.paybackPeriodYears ?? 0
    };

    // --- Render Functions ---

    const renderInitiatives = () => (
        <div className="bg-navy-900 border border-white/10 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-navy-950 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <DollarSign className="text-blue-400" size={18} />
                    Initiative Economics
                </h3>
                <span className="text-xs text-slate-500">Detailed financial impact per project</span>
            </div>

            <table className="w-full text-left text-sm">
                <thead className="bg-navy-950 text-slate-400 text-xs uppercase">
                    <tr>
                        <th className="p-4">Initiative</th>
                        <th className="p-4">Est. Cost</th>
                        <th className="p-4">Est. Benefit (Annual)</th>
                        <th className="p-4 text-center">ROI</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {initiatives.map(init => {
                        const cost = init.estimatedCost || 0;
                        const benefit = init.estimatedAnnualBenefit || 0;
                        const roi = cost > 0 ? ((benefit / cost) * 100).toFixed(0) : '0';
                        return (
                            <tr key={init.id} className="hover:bg-white/5">
                                <td className="p-4 font-medium">{init.name}</td>
                                <td className="p-4 text-slate-300">${cost.toLocaleString()}</td>
                                <td className="p-4 text-green-400">${benefit.toLocaleString()}</td>
                                <td className="p-4 text-center">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${Number(roi) > 100 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
                                        {roi}%
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderPortfolio = () => (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-navy-950 p-4 rounded-xl border border-white/5">
                    <div className="text-slate-500 text-xs uppercase mb-1">Total Capex/Opex</div>
                    <div className="text-2xl font-bold text-white">${economics.totalCost.toLocaleString()}</div>
                </div>
                <div className="bg-navy-950 p-4 rounded-xl border border-white/5">
                    <div className="text-slate-500 text-xs uppercase mb-1">Annual Value</div>
                    <div className="text-2xl font-bold text-green-400">${economics.totalAnnualBenefit.toLocaleString()}</div>
                </div>
                <div className="bg-navy-950 p-4 rounded-xl border border-white/5">
                    <div className="text-slate-500 text-xs uppercase mb-1">Portfolio ROI</div>
                    <div className="text-2xl font-bold text-purple-400">{economics.overallROI.toFixed(0)}%</div>
                </div>
                <div className="bg-navy-950 p-4 rounded-xl border border-white/5">
                    <div className="text-slate-500 text-xs uppercase mb-1">Payback Period</div>
                    <div className="text-2xl font-bold text-blue-400">{economics.paybackPeriodYears.toFixed(1)} Years</div>
                </div>
            </div>

            {/* Chart */}
            <div className="bg-navy-950 border border-white/5 rounded-xl p-6 h-[400px]">
                <h3 className="text-sm font-bold text-slate-400 mb-4 uppercase">Investment vs Return Over Time</h3>
                <ROIPaybackChart economics={economics} language={language} />
            </div>
        </div>
    );

    const renderCostStructure = () => (
        <div className="p-10 text-center bg-navy-900 border border-white/10 rounded-xl">
            <Layers className="w-16 h-16 mx-auto text-pink-500 mb-4" />
            <h3 className="text-xl font-bold mb-2">Cost Structure Model</h3>
            <p className="text-slate-500 max-w-md mx-auto">
                Model breaking down Capex (One-off) vs Opex (Recurring) for each initiative.
                (Placeholder for Cost Modeling Tool)
            </p>
        </div>
    );

    const renderScenarios = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {['Conservative', 'Realistic', 'Aggressive'].map(scenario => (
                <div key={scenario} className={`p-6 rounded-xl border ${scenario === 'Realistic' ? 'bg-blue-900/20 border-blue-500' : 'bg-navy-950 border-white/10'}`}>
                    <h3 className={`text-lg font-bold mb-4 ${scenario === 'Realistic' ? 'text-blue-400' : 'text-slate-300'}`}>{scenario} Case</h3>
                    <div className="space-y-4 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-500">ROI</span>
                            <span className="font-mono">{scenario === 'Conservative' ? '120%' : scenario === 'Realistic' ? '250%' : '450%'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-500">Payback</span>
                            <span className="font-mono">{scenario === 'Conservative' ? '3.2 yrs' : scenario === 'Realistic' ? '1.8 yrs' : '0.9 yrs'}</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 text-xs text-slate-500 italic">
                            Based on adjusted risk probabilities.
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderSummary = () => (
        <div className="bg-white text-navy-900 p-8 rounded-xl shadow-2xl max-w-4xl mx-auto">
            <div className="flex justify-between items-start mb-8 border-b-2 border-navy-900 pb-4">
                <div>
                    <h1 className="text-3xl font-bold text-navy-900">Transformation Business Case</h1>
                    <p className="text-slate-500 mt-1">Executive Financial Summary</p>
                </div>
                <div className="text-right">
                    <div className="text-sm font-bold text-navy-900 uppercase">Status</div>
                    <div className="text-green-600 font-bold">Investment Ready</div>
                </div>
            </div>

            <div className="grid grid-cols-3 gap-8 mb-10">
                <div>
                    <h4 className="text-xs uppercase text-slate-500 font-bold mb-2">Total Investment</h4>
                    <p className="text-3xl font-bold text-navy-900">${economics.totalCost.toLocaleString()}</p>
                </div>
                <div>
                    <h4 className="text-xs uppercase text-slate-500 font-bold mb-2">Net Value (5yr)</h4>
                    <p className="text-3xl font-bold text-green-600">${(economics.totalAnnualBenefit * 5 - economics.totalCost).toLocaleString()}</p>
                </div>
                <div>
                    <h4 className="text-xs uppercase text-slate-500 font-bold mb-2">IRR</h4>
                    <p className="text-3xl font-bold text-purple-600">32.5%</p>
                </div>
            </div>

            <div className="space-y-4 mb-8">
                <h4 className="font-bold border-b border-slate-200 pb-2">Strategic Rationale</h4>
                <p className="text-slate-700 leading-relaxed">
                    The proposed transformation program delivers immediate operational efficiencies while positioning the organization for long-term growth.
                    With a payback period of <strong>{economics.paybackPeriodYears.toFixed(1)} years</strong>, the initiative is self-funding within the strategic horizon.
                    Key value drivers include process automation (40%), data monetization (30%), and legacy cost reduction (30%).
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-100 p-4 rounded-lg">
                    <h5 className="font-bold text-sm mb-2">Capex Requirements</h5>
                    <ul className="text-sm text-slate-600 space-y-1">
                        <li>• Tech Stack Upgrade: $400k</li>
                        <li>• Data Platform: $150k</li>
                    </ul>
                </div>
                <div className="bg-slate-100 p-4 rounded-lg">
                    <h5 className="font-bold text-sm mb-2">Risk Adjustments</h5>
                    <ul className="text-sm text-slate-600 space-y-1">
                        <li>• Adoption Risk: -15% buffer included</li>
                        <li>• Timeline Contingency: +20% cost buffer</li>
                    </ul>
                </div>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'initiatives': return renderInitiatives();
            case 'portfolio': return renderPortfolio();
            case 'cost': return renderCostStructure();
            case 'scenarios': return renderScenarios();
            case 'summary': return renderSummary();
            default: return null;
        }
    };

    return (
        <div className="flex flex-col h-full bg-navy-950 text-white">
            {/* Header */}
            <div className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-navy-900/50 backdrop-blur-sm sticky top-0 z-10">
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <TrendingUp className="text-green-500" size={24} />
                    Economics & ROI
                </h1>
                <button
                    onClick={onNextStep}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-lg"
                >
                    Next Module
                    <ArrowRight size={18} />
                </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-white/10 px-6 gap-6 mt-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10">
                {[
                    { id: 'initiatives', label: '6.1 Initiatives', icon: DollarSign },
                    { id: 'portfolio', label: '6.2 Portfolio ROI', icon: PieChart },
                    { id: 'cost', label: '6.3 Cost Model', icon: Layers },
                    { id: 'scenarios', label: '6.4 Scenarios', icon: Activity },
                    { id: 'summary', label: '6.5 Exec Summary', icon: FileText },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as ROITab)}
                        className={`pb-3 flex items-center gap-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-green-500 text-green-400' : 'border-transparent text-slate-400 hover:text-white'}`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-navy-950">
                <div className="max-w-6xl mx-auto">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};
