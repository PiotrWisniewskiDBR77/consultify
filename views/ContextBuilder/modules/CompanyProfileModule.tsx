import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, Factory, Users, History, AlertTriangle, Sparkles, Check, Globe, Award, Clock, MapPin, Briefcase, FileText, Info, UploadCloud, Crown, Network, Layers, Heart, Database, BatteryWarning, Anchor, Lock, Truck, Code2, CloudOff, Cpu, Wallet, Shield, Hammer, TrendingUp } from 'lucide-react';
import { DynamicList, DynamicListItem } from '../shared/DynamicList';
import { useAppStore } from '../../../store/useAppStore';
import { useContextBuilderStore } from '../../../store/useContextBuilderStore';
import { AITextArea } from '../shared/AITextArea';
import { ContextDocUploader } from '../shared/ContextDocUploader';

export const CompanyProfileModule: React.FC = () => {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'snapshot' | 'operating' | 'org' | 'history' | 'constraints'>('snapshot');

    // Store State
    const {
        companyProfile,
        setCompanyProfile,
        updateCompanyList
    } = useContextBuilderStore();

    // Local UI State for AI Banner
    const [showContextBanner, setShowContextBanner] = useState(true);

    // AI Suggestions (Notifications)
    const { addNotification, currentUser } = useAppStore();

    useEffect(() => {
        const insightId = 'insight-industry-update-2024';
        const timer = setTimeout(() => {
            // Only add if not already present (simplified check)
            addNotification({
                id: insightId,
                userId: currentUser?.id || 'guest',
                type: 'ai_insight',
                title: 'AI Insight Available',
                message: 'Based on Annual Report 2024.pdf, I suggest updating Industry to Automotive Parts Manufacturing.',
                read: false,
                createdAt: new Date().toISOString(),
                data: {
                    priority: 'high',
                    category: 'ai',
                    actionLabel: 'Review Update',
                    link: '/context/profile'
                }
            });
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    // Handlers for Dynamic Lists
    const createHandler = (
        listName: 'processes' | 'stakeholders' | 'initiatives',
        currentItems: DynamicListItem[]
    ) => ({
        onAdd: (item: Omit<DynamicListItem, 'id'>) => {
            const newItem = { ...item, id: Math.random().toString(36).substr(2, 9) };
            updateCompanyList(listName, [...currentItems, newItem]);
        },
        onUpdate: (id: string, updates: Partial<DynamicListItem>) => {
            const newItems = currentItems.map(p => p.id === id ? { ...p, ...updates } : p);
            updateCompanyList(listName, newItems);
        },
        onDelete: (id: string) => {
            const newItems = currentItems.filter(p => p.id !== id);
            updateCompanyList(listName, newItems);
        }
    });

    const processHandlers = createHandler('processes', companyProfile.processes);
    const stakeholderHandlers = createHandler('stakeholders', companyProfile.stakeholders);
    const initiativeHandlers = createHandler('initiatives', companyProfile.initiatives);

    // TABS CONFIG
    const tabs = [
        { id: 'snapshot', label: 'Snapshot', icon: Building2 },
        { id: 'operating', label: 'Operating Model', icon: Factory },
        { id: 'org', label: 'Org & Roles', icon: Users },
        { id: 'history', label: 'Transformation History', icon: History },
        { id: 'constraints', label: 'Constraints', icon: AlertTriangle },
    ];

    // Helper Component for Selection Cards
    const SelectionGroup = ({ label, options, name, icon: Icon, value, onChange }: { label: string, options: string[], name: string, icon?: any, value: string, onChange: (val: string) => void }) => (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                {Icon && <Icon size={14} className="text-purple-500" />}
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {options.map((opt) => (
                    <label key={opt} className="relative flex items-center p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900 cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50/50 dark:hover:bg-purple-900/20 transition-all group">
                        <input
                            type="radio"
                            name={name}
                            className="peer sr-only"
                            checked={value === opt}
                            onChange={() => onChange(opt)}
                        />
                        <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-500 mr-3 peer-checked:border-purple-600 peer-checked:bg-purple-600 relative flex items-center justify-center transition-colors">
                            <div className="w-1.5 h-1.5 bg-white rounded-full opacity-0 peer-checked:opacity-100" />
                        </div>
                        <span className="text-sm text-slate-700 dark:text-slate-200 font-medium group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">{opt}</span>
                        <div className="absolute inset-0 rounded-xl ring-2 ring-transparent peer-checked:ring-purple-500/50 pointer-events-none transition-all" />
                    </label>
                ))}
            </div>
        </div>
    );

    const SelectField = ({ label, options, value, onChange }: { label: string, options: string[], value: string, onChange: (val: string) => void }) => (
        <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">{label}</label>
            <div className="relative">
                <select
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full appearance-none px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 text-sm font-medium text-navy-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-shadow"
                >
                    <option value="" disabled>Select...</option>
                    {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">

            {/* Sub-Module Tabs */}
            <div className="flex border-b border-slate-200 dark:border-white/10 space-x-6 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`
                            flex items-center gap-2 pb-3 text-sm font-medium transition-all border-b-2 whitespace-nowrap px-1
                            ${activeTab === tab.id
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-slate-500 hover:text-navy-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20'}
                        `}
                    >
                        <tab.icon size={16} className={activeTab === tab.id ? "animate-pulse-subtle" : ""} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* AI Context Banner - Placed BELOW tabs */}
            {showContextBanner && activeTab === 'snapshot' && (
                <div className="bg-gradient-to-r from-purple-50 to-white dark:from-purple-900/20 dark:to-navy-900 border border-purple-100 dark:border-purple-800/50 rounded-xl p-4 flex items-start gap-4 shadow-sm relative overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="absolute top-0 right-0 p-2 opacity-10"><Sparkles size={100} /></div>
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-lg text-purple-600 shrink-0">
                        <Sparkles size={20} />
                    </div>
                    <div className="flex-1 z-10 min-w-0">
                        <h4 className="text-sm font-bold text-navy-900 dark:text-white flex items-center gap-2 flex-wrap">
                            AI Insight
                            <span className="text-[10px] font-normal px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 rounded-full whitespace-nowrap">High Confidence</span>
                        </h4>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                            Based on analysis of <strong>Annual Report 2024.pdf</strong>, the Industry classification seems more specific.
                            <br />
                            Suggestion: Change <strong>Industry</strong> to <strong className="text-purple-600 dark:text-purple-400">Automotive Parts Manufacturing</strong>.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 z-10 shrink-0">
                        <button
                            onClick={() => {
                                setCompanyProfile({ industry: 'Manufacturing', subIndustry: 'Automotive Parts' });
                                setShowContextBanner(false);
                            }}
                            className="px-4 py-1.5 bg-purple-600 text-white text-xs font-semibold rounded-lg hover:bg-purple-700 shadow-sm transition-all shadow-purple-200 dark:shadow-none whitespace-nowrap"
                        >
                            Accept
                        </button>
                        <button
                            onClick={() => setShowContextBanner(false)}
                            className="px-4 py-1.5 bg-white dark:bg-navy-800 text-slate-500 border border-slate-200 dark:border-white/10 text-xs font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {/* Content Area */}
            <div className="min-h-[400px] animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* TAB 1: SNAPSHOT */}
                {activeTab === 'snapshot' && (
                    <div className="space-y-6">
                        <ContextDocUploader
                            tabName="Snapshot"
                            suggestions={['Annual Report', 'Corporate Strategy Deck', 'Investor Presentation', 'Market Research Report']}
                        />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Column 1: Firm Context */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-white/5">
                                    <Briefcase size={18} className="text-purple-500" />
                                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Firm Context</h3>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <SelectField
                                        label="Industry"
                                        options={['Manufacturing', 'Logistics', 'Retail', 'Energy', 'Healthcare']}
                                        value={companyProfile.industry}
                                        onChange={(val) => setCompanyProfile({ industry: val })}
                                    />
                                    <SelectField
                                        label="Sub-Industry"
                                        options={['Automotive', 'Electronics', 'FMCG', 'Pharma', 'Aerospace']}
                                        value={companyProfile.subIndustry}
                                        onChange={(val) => setCompanyProfile({ subIndustry: val })}
                                    />
                                </div>

                                <SelectionGroup
                                    label="Ownership Model"
                                    name="ownership"
                                    options={['Private / Family Owned', 'Public / Corporate', 'Private Equity / VC', 'State Owned']}
                                    icon={Building2}
                                    value={companyProfile.ownership}
                                    onChange={(val) => setCompanyProfile({ ownership: val })}
                                />

                                <SelectionGroup
                                    label="Growth Stage"
                                    name="growth"
                                    options={['Startup / Scaling', 'Established / Stable', 'Turnaround / Distressed']}
                                    icon={TrendingUp}
                                    value={companyProfile.growthStage}
                                    onChange={(val) => setCompanyProfile({ growthStage: val })}
                                />

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Globe size={14} className="text-purple-500" />
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Target Markets</label>
                                    </div>
                                    <div className="flex gap-3">
                                        {['Domestic Only', 'Regional (EU/NA)', 'Global'].map(m => (
                                            <label key={m} className="flex-1 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="market"
                                                    className="peer sr-only"
                                                    checked={companyProfile.targetMarkets.includes(m)}
                                                    onChange={() => setCompanyProfile({ targetMarkets: [m] })} // Doing simple radio for now
                                                />
                                                <div className="text-center py-2.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 text-sm font-medium text-slate-600 dark:text-slate-300 peer-checked:bg-purple-600 peer-checked:text-white peer-checked:border-purple-600 transition-all shadow-sm hover:shadow">
                                                    {m}
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Award size={14} className="text-purple-500" />
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Certifications</label>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {['ISO 9001', 'ISO 14001', 'IATF 16949', 'GMP', 'HACCP'].map(cert => (
                                            <label key={cert} className="cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="peer sr-only"
                                                    checked={companyProfile.certifications.includes(cert)}
                                                    onChange={(e) => {
                                                        const newCerts = e.target.checked
                                                            ? [...companyProfile.certifications, cert]
                                                            : companyProfile.certifications.filter(c => c !== cert);
                                                        setCompanyProfile({ certifications: newCerts });
                                                    }}
                                                />
                                                <div className="px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 text-xs font-medium text-slate-600 dark:text-slate-300 peer-checked:bg-purple-100 peer-checked:text-purple-700 peer-checked:border-purple-200 dark:peer-checked:bg-purple-900/30 dark:peer-checked:text-purple-300 dark:peer-checked:border-purple-500/50 transition-all select-none">
                                                    {cert}
                                                </div>
                                            </label>
                                        ))}
                                        <button className="px-3 py-1.5 rounded-full border border-dashed border-slate-300 text-xs font-medium text-slate-400 hover:text-purple-600 hover:border-purple-300 transition-colors">
                                            + Add Custom
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Column 2: Scale & Reach */}
                            <div className="space-y-6">
                                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100 dark:border-white/5">
                                    <MapPin size={18} className="text-purple-500" />
                                    <h3 className="text-lg font-semibold text-navy-900 dark:text-white">Scale & Reach</h3>
                                </div>

                                <div className="bg-slate-50 dark:bg-navy-800/50 rounded-xl p-5 border border-slate-100 dark:border-white/5 space-y-5">
                                    <SelectField
                                        label="Employees (FTE)"
                                        options={['1-50', '51-200', '201-500', '501-1000', '1000-5000', '5000+']}
                                        value={companyProfile.employees}
                                        onChange={(val) => setCompanyProfile({ employees: val })}
                                    />
                                    <SelectField
                                        label="Annual Revenue"
                                        options={['< $10M', '$10M - $50M', '$50M - $250M', '$250M - $1B', '> $1B']}
                                        value={companyProfile.revenue}
                                        onChange={(val) => setCompanyProfile({ revenue: val })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Operational Footprint</label>
                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                        {['Single Site', 'Multi-Site'].map(opt => (
                                            <label key={opt} className="cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="footprint"
                                                    className="peer sr-only"
                                                    checked={companyProfile.operationalFootprint === opt}
                                                    onChange={() => setCompanyProfile({ operationalFootprint: opt })}
                                                />
                                                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-900 peer-checked:ring-2 peer-checked:ring-purple-500 peer-checked:border-purple-500 transition-all text-center">
                                                    <div className="font-bold text-navy-900 dark:text-white mb-1">{opt}</div>
                                                    <div className="text-[10px] text-slate-500">{opt === 'Single Site' ? 'Centralized ops' : 'Distributed ops'}</div>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    <div className="relative group">
                                        <MapPin className="absolute top-3 left-3 text-slate-400 group-focus-within:text-purple-500 transition-colors z-10" size={16} />
                                        <AITextArea
                                            value={companyProfile.locations}
                                            onChange={(e) => setCompanyProfile({ locations: e.target.value })}
                                            rows={3}
                                            placeholder="List key locations (e.g. HQ London, Plant Warsaw, R&D Berlin)..."
                                            className="pl-10"
                                            aiContext="location"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1.5 px-1">Tip: Listing specific locations helps AI infer regional constraints.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: OPERATING MODEL */}
                {activeTab === 'operating' && (
                    <div className="space-y-8">
                        <ContextDocUploader
                            tabName="Operating Model"
                            suggestions={['SOPs (Standard Operating Procedures)', 'Value Stream Maps', 'Quality Manual', 'Supply Chain Diagram']}
                        />
                        {/* Production System Section */}
                        <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="p-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg text-purple-600"><Factory size={20} /></div>
                                <div>
                                    <h4 className="text-base font-bold text-navy-900 dark:text-white">Production System Archetype</h4>
                                    <p className="text-xs text-slate-500">Select the model that best describes your core operations.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { id: 'mto', label: 'High Mix, Low Volume', sub: 'Job Shop / MTO', icon: '🎨' },
                                    { id: 'mts', label: 'Low Mix, High Volume', sub: 'Mass Prod / MTS', icon: '🏭' },
                                    { id: 'batch', label: 'Batch Process', sub: 'Pharma / F&B', icon: '⚗️' },
                                    { id: 'eng', label: 'Project Based', sub: 'ETO / Construction', icon: '🏗️' }
                                ].map(model => (
                                    <label key={model.id} className="relative cursor-pointer group">
                                        <input
                                            type="radio"
                                            name="prodModel"
                                            className="peer sr-only"
                                            checked={companyProfile.productionSystem === model.id}
                                            onChange={() => setCompanyProfile({ productionSystem: model.id })}
                                        />
                                        <div className="h-full p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-navy-950/50 hover:bg-white dark:hover:bg-navy-800 hover:border-purple-300 transition-all flex flex-col items-center text-center peer-checked:bg-white dark:peer-checked:bg-navy-800 peer-checked:ring-2 peer-checked:ring-purple-500 peer-checked:border-transparent shadow-sm">
                                            <div className="text-2xl mb-2 grayscale group-hover:grayscale-0 peer-checked:grayscale-0 transition-all">{model.icon}</div>
                                            <div className="font-bold text-sm text-navy-900 dark:text-white mb-1">{model.label}</div>
                                            <div className="text-xs text-slate-500">{model.sub}</div>
                                        </div>
                                        <div className="absolute top-3 right-3 opacity-0 peer-checked:opacity-100 transition-opacity text-purple-600">
                                            <Check size={16} strokeWidth={3} />
                                        </div>
                                    </label>
                                ))}
                            </div>

                            <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/5">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Clock size={16} className="text-slate-400" />
                                            <label className="text-xs font-bold text-slate-500 uppercase">Shift Pattern</label>
                                        </div>
                                        <div className="flex gap-2">
                                            {['1 Shift', '2 Shifts', '3 Shifts', '4-Brigade (24/7)'].map(shift => (
                                                <label key={shift} className="flex-1 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="shifts"
                                                        className="peer sr-only"
                                                        checked={companyProfile.shiftPattern === shift}
                                                        onChange={() => setCompanyProfile({ shiftPattern: shift })}
                                                    />
                                                    <div className="py-2 px-1 text-center text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-navy-950 text-slate-600 dark:text-slate-300 peer-checked:bg-purple-100 dark:peer-checked:bg-purple-900/40 peer-checked:text-purple-700 dark:peer-checked:text-purple-300 peer-checked:border-purple-300 transition-all hover:bg-slate-50">
                                                        {shift}
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <Sparkles size={16} className="text-slate-400" />
                                            <label className="text-xs font-bold text-slate-500 uppercase">Automation Level ({companyProfile.automationLevel}%)</label>
                                        </div>
                                        <input
                                            type="range"
                                            className="w-full accent-purple-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                                            min="0"
                                            max="100"
                                            value={companyProfile.automationLevel}
                                            onChange={(e) => setCompanyProfile({ automationLevel: Number(e.target.value) })}
                                        />
                                        <div className="flex justify-between text-[10px] text-slate-400 font-medium uppercase px-1">
                                            <span>Manual</span>
                                            <span>Semi-Auto</span>
                                            <span>Highly Auto</span>
                                            <span>Lightst Out</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DynamicList
                            title="Key Value Streams / Processes"
                            description="List your critical operational processes that deliver value to the customer."
                            items={companyProfile.processes}
                            columns={[
                                { key: 'name', label: 'Process Name', width: 'w-1/3' },
                                { key: 'criticality', label: 'Criticality', type: 'select', options: [{ label: 'High', value: 'High' }, { label: 'Medium', value: 'Medium' }, { label: 'Low', value: 'Low' }], width: 'w-1/4' },
                                { key: 'notes', label: 'Bottlenecks / Pain Points', width: 'w-1/3' }
                            ]}
                            {...processHandlers}
                        />
                    </div>
                )}

                {/* TAB 3: ORG & ROLES */}
                {activeTab === 'org' && (
                    <div className="space-y-8">
                        <ContextDocUploader
                            tabName="Org & Roles"
                            suggestions={['Organizational Chart', 'RACI Matrix', 'Employee Handbook', 'Department Goals']}
                        />
                        {/* Org Structure & Decision Making */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 h-full">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-purple-50 dark:bg-purple-900/30 rounded text-purple-600"><Users size={16} /></div>
                                    <h4 className="font-bold text-navy-900 dark:text-white">Decision Making</h4>
                                </div>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {[
                                            { id: 'owner', label: 'Founder / Owner Led', sub: 'Fast, centralized, gut-feel', icon: <Crown size={18} /> },
                                            { id: 'site', label: 'Single-Site Board', sub: 'Professional local governance', icon: <Building2 size={18} /> },
                                            { id: 'central', label: 'Multi-Site Centralized', sub: 'Standard corporate top-down', icon: <Globe size={18} /> },
                                            { id: 'decentral', label: 'Multi-Site Decentralized', sub: 'Autonomous P&L units', icon: <Network size={18} /> },
                                            { id: 'matrix', label: 'Matrix Organization', sub: 'Complex / Dual reporting', icon: <Layers size={18} /> },
                                            { id: 'ngo', label: 'Non-Profit / NGO', sub: 'Mission-driven governance', icon: <Heart size={18} /> }
                                        ].map(opt => (
                                            <label key={opt.id} className="cursor-pointer group relative">
                                                <input
                                                    type="radio"
                                                    name="decision"
                                                    className="peer sr-only"
                                                    checked={companyProfile.decisionMaking === opt.id}
                                                    onChange={() => setCompanyProfile({ decisionMaking: opt.id })}
                                                />
                                                <div className="p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-900/50 hover:bg-slate-50 dark:hover:bg-white/5 peer-checked:bg-purple-50 dark:peer-checked:bg-purple-900/20 peer-checked:border-purple-500 peer-checked:ring-1 peer-checked:ring-purple-500/50 transition-all flex flex-col h-full">
                                                    <div className="flex items-center gap-2 mb-1.5 text-slate-500 peer-checked:text-purple-600 transition-colors">
                                                        {opt.icon}
                                                    </div>
                                                    <div className="font-bold text-sm text-navy-900 dark:text-white leading-tight mb-1">{opt.label}</div>
                                                    <div className="text-[10px] text-slate-500 leading-tight">{opt.sub}</div>
                                                </div>
                                                <div className="absolute top-3 right-3 opacity-0 peer-checked:opacity-100 transition-opacity text-purple-600">
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* New: Workforce Dynamics Section */}
                            <div className="bg-white dark:bg-navy-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 h-full">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded text-blue-600"><Users size={16} /></div>
                                    <h4 className="font-bold text-navy-900 dark:text-white">Workforce Dynamics</h4>
                                </div>

                                <div className="space-y-5">
                                    <SelectionGroup
                                        label="Demographics Profile"
                                        name="demo"
                                        options={['Aging / Tenured', 'Balanced Mix', 'Young / High Churn']}
                                        value={companyProfile.workforceDynamics.demographics}
                                        onChange={(val) => setCompanyProfile({ workforceDynamics: { ...companyProfile.workforceDynamics, demographics: val } })}
                                    />
                                    <SelectionGroup
                                        label="Talent Stability (Turnover)"
                                        name="turnover"
                                        options={['Stable (<5%)', 'Moderate (5-15%)', 'High Risk (>15%)']}
                                        value={companyProfile.workforceDynamics.turnover}
                                        onChange={(val) => setCompanyProfile({ workforceDynamics: { ...companyProfile.workforceDynamics, turnover: val } })}
                                    />
                                    <SelectionGroup
                                        label="Digital Readiness"
                                        name="digital"
                                        options={['Digital Natives', 'Mixed Proficiency', 'Low Digital Literacy']}
                                        value={companyProfile.workforceDynamics.digitalReadiness}
                                        onChange={(val) => setCompanyProfile({ workforceDynamics: { ...companyProfile.workforceDynamics, digitalReadiness: val } })}
                                    />
                                    <SelectionGroup
                                        label="Change Appetite"
                                        name="change"
                                        options={['Eager / Adaptive', 'Neutral / Cautious', 'Resistant / Fatigued']}
                                        value={companyProfile.workforceDynamics.changeAppetite}
                                        onChange={(val) => setCompanyProfile({ workforceDynamics: { ...companyProfile.workforceDynamics, changeAppetite: val } })}
                                    />
                                </div>
                            </div>
                        </div>

                        <DynamicList
                            title="Key Stakeholders"
                            description="Who holds the power and who executes? Identifying sponsors vs blockers."
                            items={companyProfile.stakeholders}
                            columns={[
                                { key: 'role', label: 'Role / Title', width: 'w-1/3' },
                                { key: 'owner', label: 'Person Name', width: 'w-1/3' },
                                { key: 'influence', label: 'Influence', type: 'select', options: [{ label: 'High', value: 'High' }, { label: 'Medium', value: 'Medium' }, { label: 'Low', value: 'Low' }], width: 'w-1/4' },
                            ]}
                            {...stakeholderHandlers}
                        />
                    </div>
                )}

                {/* TAB 4: TRANSFORMATION HISTORY */}
                {activeTab === 'history' && (
                    <div className="space-y-6">
                        <ContextDocUploader
                            tabName="History"
                            suggestions={['Project Logs / status reports', 'Risk Registers', 'Post-Mortem / Lessons Learned', 'Change Management Logs']}
                        />
                        <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl flex gap-3 text-amber-800 dark:text-amber-400">
                            <History size={20} className="shrink-0 mt-0.5" />
                            <div className="text-sm">
                                <p className="font-semibold mb-1">Why ask about history?</p>
                                <p className="opacity-90">Understanding past failures is critical to avoid repeating them. Be diligent about listing stalled or failed initiatives.</p>
                            </div>
                        </div>

                        <DynamicList
                            title="Transformation Initiatives History"
                            description="Track record of past changes."
                            items={companyProfile.initiatives}
                            columns={[
                                { key: 'name', label: 'Initiative Name', width: 'w-1/4' },
                                { key: 'area', label: 'Area', width: 'w-1/6' },
                                { key: 'result', label: 'Result', type: 'select', options: [{ label: 'Success', value: 'Success' }, { label: 'Failure', value: 'Failure' }, { label: 'Ongoing', value: 'Ongoing' }, { label: 'Delayed', value: 'Delayed' }], width: 'w-1/6' },
                                { key: 'why', label: 'Root Cause / Lessons Learned', width: 'w-1/3' },
                            ]}
                            {...initiativeHandlers}
                        />
                    </div>
                )}

                {/* TAB 5: CONSTRAINTS */}
                {activeTab === 'constraints' && (
                    <div className="space-y-6">
                        <ContextDocUploader
                            tabName="Constraints"
                            suggestions={['IT Architecture Diagram', 'Compliance/Audit Reports', 'Budget Guidelines', 'Union Contracts']}
                        />
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-navy-900 dark:text-white flex items-center gap-2">
                                    <AlertTriangle size={20} className="text-amber-500" />
                                    Hard Constraints
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">Select factors that might limit the transformation pace or scope.</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { id: 'it', label: 'Legacy IT Systems', hint: 'Old ERP, disconnected siloes, on-prem limitations', icon: <Cpu size={18} /> },
                                { id: 'data', label: 'Data Quality & Silos', hint: 'Fragmented data, poor accuracy, no single truth', icon: <Database size={18} /> },
                                { id: 'budget', label: 'Budget Limitations', hint: 'CAPEX freeze, low margin environment', icon: <Wallet size={18} /> },
                                { id: 'resource', label: 'Resource Bandwidth', hint: 'Teams at capacity, burnout risk, hiring freeze', icon: <BatteryWarning size={18} /> },
                                { id: 'skills', label: 'Skill Gaps', hint: 'Lack of digital natives, aging workforce', icon: <Users size={20} /> },
                                { id: 'culture', label: 'Cultural Resistance', hint: 'Inertia, "not invented here" syndrome, fear of change', icon: <Anchor size={18} /> },
                                { id: 'reg', label: 'Regulatory / Compliance', hint: 'FDA, GDPR, Safety, Environmental strictness', icon: <Shield size={18} /> },
                                { id: 'security', label: 'Cybersecurity Risks', hint: 'Vulnerabilities, data privacy concerns', icon: <Lock size={18} /> },
                                { id: 'labor', label: 'Labor / Union Issues', hint: 'Workforce resistance, rigid contracts', icon: <Hammer size={18} /> },
                                { id: 'supply', label: 'Supply Chain Instability', hint: 'Vendor reliability, geopolitical risks', icon: <Truck size={18} /> },
                                { id: 'techdebt', label: 'Technical Debt', hint: 'Accumulated workarounds hindering new dev', icon: <Code2 size={18} /> },
                                { id: 'infra', label: 'Infrastructure Limits', hint: 'Physical or digital scalability bottlenecks', icon: <CloudOff size={18} /> }
                            ].map(constraint => (
                                <label key={constraint.id} className="relative group cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={companyProfile.activeConstraints.includes(constraint.id)}
                                        onChange={(e) => {
                                            const newConstraints = e.target.checked
                                                ? [...companyProfile.activeConstraints, constraint.id]
                                                : companyProfile.activeConstraints.filter(c => c !== constraint.id);
                                            setCompanyProfile({ activeConstraints: newConstraints });
                                        }}
                                    />

                                    <div className="h-full p-5 rounded-2xl border border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900 hover:border-purple-300 dark:hover:border-purple-500/50 transition-all peer-checked:border-purple-500 peer-checked:ring-1 peer-checked:ring-purple-500/50 peer-checked:bg-purple-50/30 dark:peer-checked:bg-purple-900/10 shadow-sm">
                                        <div className="flex items-start gap-4">
                                            <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 peer-checked:bg-purple-100 peer-checked:text-purple-600 dark:peer-checked:bg-purple-500/20 dark:peer-checked:text-purple-300 transition-colors">
                                                {constraint.icon}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="font-bold text-navy-900 dark:text-white leading-tight">{constraint.label}</h4>
                                                    <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-500 flex items-center justify-center peer-checked:border-purple-600 peer-checked:bg-purple-600 transition-all">
                                                        <Check size={12} className="text-white opacity-0 peer-checked:opacity-100" strokeWidth={3} />
                                                    </div>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">{constraint.hint}</p>
                                            </div>
                                        </div>

                                        {/* Expandable Description Area */}
                                        <div className={`grid transition-all duration-300 ease-in-out ${companyProfile.activeConstraints.includes(constraint.id) ? 'grid-rows-[1fr] pt-4 mt-2 border-t border-slate-100 dark:border-white/5' : 'grid-rows-[0fr]'}`}>
                                            <div className="overflow-hidden">
                                                <AITextArea
                                                    value={companyProfile.constraintDetails[constraint.id] || ''}
                                                    onChange={(e) => setCompanyProfile({
                                                        constraintDetails: { ...companyProfile.constraintDetails, [constraint.id]: e.target.value }
                                                    })}
                                                    className="min-h-[80px] resize-none"
                                                    placeholder={`Describe specific ${constraint.label.toLowerCase()} restrictions...`}
                                                    onClick={(e) => e.stopPropagation()} // Prevent toggling when clicking input
                                                    aiContext="constraint"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
