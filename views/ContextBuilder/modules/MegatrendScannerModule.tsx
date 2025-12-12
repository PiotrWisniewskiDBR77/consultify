import React, { useState } from 'react';
import { Globe, Radar, FileText, PlusCircle, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';
import { DynamicList, DynamicListItem } from '../shared/DynamicList';

export const MegatrendScannerModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'baseline' | 'radar' | 'detail' | 'custom'>('baseline');
    const [selectedTrendId, setSelectedTrendId] = useState<string | null>(null);

    // MOCK DATA for Radar
    // zones: 0-30 (Direct), 30-70 (Observe), 70-100 (Horizon)
    const trends = [
        { id: '1', label: 'AI Automation', zone: 'Direct Impact', distance: 15, angle: 45, impact: 'High' },
        { id: '2', label: 'Green Energy', zone: 'Need to Observe', distance: 50, angle: 120, impact: 'Medium' },
        { id: '3', label: 'Quantum Comp', zone: 'On the Horizon', distance: 85, angle: 280, impact: 'Low' },
        { id: '4', label: 'Labor Shortage', zone: 'Direct Impact', distance: 25, angle: 200, impact: 'Critical' },
        { id: '5', label: 'Supply Chain 4.0', zone: 'Need to Observe', distance: 60, angle: 330, impact: 'High' },
    ];

    // MOCK DATA for Custom Trends
    const [customTrends, setCustomTrends] = useState<DynamicListItem[]>([
        { id: '1', name: 'Local Competitor Pricing', reason: 'Aggressive undercutting in Q3' }
    ]);

    const createHandler = (setter: React.Dispatch<React.SetStateAction<DynamicListItem[]>>) => ({
        onAdd: (item: Omit<DynamicListItem, 'id'>) => setter(prev => [...prev, { ...item, id: Math.random().toString(36).substr(2, 9) }]),
        onUpdate: (id: string, updates: Partial<DynamicListItem>) => setter(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p)),
        onDelete: (id: string) => setter(prev => prev.filter(p => p.id !== id))
    });

    const customTrendHandlers = createHandler(setCustomTrends);

    // TABS CONFIG
    const tabs = [
        { id: 'baseline', label: 'Industry Baseline', icon: Globe },
        { id: 'radar', label: 'Trend Radar Map', icon: Radar },
        { id: 'detail', label: 'Trend Detail', icon: FileText },
        { id: 'custom', label: 'Custom Trends', icon: PlusCircle },
    ];

    return (
        <div className="space-y-6">
            <div className="flex border-b border-slate-200 dark:border-white/10 space-x-6 overflow-x-auto">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`
                            flex items-center gap-2 pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap
                            ${activeTab === tab.id
                                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                                : 'border-transparent text-slate-500 hover:text-navy-900 dark:hover:text-white'}
                        `}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[400px]">

                {/* TAB 1: INDUSTRY BASELINE */}
                {activeTab === 'baseline' && (
                    <div className="space-y-6">
                        <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg flex items-start gap-3 border border-blue-100 dark:border-white/5">
                            <Sparkles className="text-blue-600 mt-1" size={18} />
                            <div>
                                <h4 className="font-bold text-blue-900 dark:text-blue-300">Industry Standard Trends</h4>
                                <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                                    Below are the top megatrends affecting <strong>Manufacturing</strong> globally.
                                    AI has merged generic data with your <strong>Quarterly Report Q3.pdf</strong> to prioritize.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { title: 'Generative AI in Design', type: 'Technology', pressure: 'High' },
                                { title: 'Carbon Neutrality 2030', type: 'Regulatory', pressure: 'Critical' },
                                { title: 'Reshoring Supply Chains', type: 'Geopolitical', pressure: 'Medium' },
                                { title: 'Aging Workforce', type: 'Social', pressure: 'High' }
                            ].map((trend, i) => (
                                <div key={i} className="p-4 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-navy-800 hover:shadow-md transition-shadow relative overflow-hidden">
                                    {i === 1 && (
                                        <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
                                            Client Specific
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 text-[10px] uppercase font-bold px-2 py-1 rounded">{trend.type}</span>
                                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${trend.pressure === 'Critical' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                                            {trend.pressure} Pressure
                                        </span>
                                    </div>
                                    <h3 className="font-bold text-navy-900 dark:text-white text-lg">{trend.title}</h3>
                                    <div className="mt-4 flex items-center gap-2 text-xs text-purple-600 cursor-pointer hover:underline" onClick={() => setActiveTab('detail')}>
                                        See Impacts <ArrowRight size={12} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* TAB 2: TREND RADAR */}
                {activeTab === 'radar' && (
                    <div className="flex flex-col items-center justify-center py-8">
                        <div className="relative w-[300px] h-[300px] md:w-[400px] md:h-[400px] rounded-full bg-slate-50 dark:bg-navy-900 border border-slate-200 dark:border-white/10 shadow-inner flex items-center justify-center">

                            {/* Zone 3: One the Horizon */}
                            <div className="absolute inset-0 rounded-full border border-dashed border-slate-300 dark:border-slate-600"></div>
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 uppercase bg-white dark:bg-navy-900 px-1">Horizon</div>

                            {/* Zone 2: Observe */}
                            <div className="absolute w-[66%] h-[66%] rounded-full border border-dashed border-slate-300 dark:border-slate-600"></div>
                            <div className="absolute top-[17%] left-1/2 -translate-x-1/2 text-[10px] font-bold text-slate-400 uppercase bg-white dark:bg-navy-900 px-1">Observe</div>

                            {/* Zone 1: Direct Impact */}
                            <div className="absolute w-[33%] h-[33%] rounded-full border-2 border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10"></div>
                            <div className="absolute top-[34%] left-1/2 -translate-x-1/2 text-[10px] font-bold text-purple-600 uppercase bg-purple-50 dark:bg-navy-900 px-1">Act</div>

                            {/* Center Point */}
                            <div className="absolute w-2 h-2 bg-navy-900 dark:bg-white rounded-full z-10"></div>

                            {/* Dots */}
                            {trends.map(trend => {
                                // Convert visual distance/angle to x/y
                                // angle 0 = top (need to subtract 90deg or PI/2)
                                const rad = (trend.angle - 90) * (Math.PI / 180);
                                // distance is percent of radius (200px)
                                const r = (trend.distance / 100) * 200;

                                return (
                                    <div
                                        key={trend.id}
                                        className="absolute w-3 h-3 bg-purple-600 rounded-full hover:scale-150 transition-transform cursor-pointer shadow-lg group z-20"
                                        style={{
                                            transform: `translate(${r * Math.cos(rad)}px, ${r * Math.sin(rad)}px)` // center is 0,0 relative to flex center thanks to absolute
                                        }}
                                        onClick={() => { setSelectedTrendId(trend.id); setActiveTab('detail'); }}
                                        title={trend.label}
                                    >
                                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none z-50">
                                            {trend.label}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="mt-8 text-xs text-slate-500">Click on a trend node to view detailed impact analysis.</p>
                    </div>
                )}

                {/* TAB 3: TREND DETAIL */}
                {activeTab === 'detail' && (
                    <div className="space-y-6 max-w-4xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-navy-900 dark:text-white">
                                {selectedTrendId ? trends.find(t => t.id === selectedTrendId)?.label : 'Artificial Intelligence (Example)'}
                            </h3>
                            <span className="text-xs font-bold bg-purple-100 text-purple-600 px-2 py-1 rounded">High Impact</span>
                        </div>

                        {/* AI Suggested Edit */}
                        <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-purple-600" />
                                <span className="text-xs text-purple-800 dark:text-purple-200">
                                    <strong>AI Suggestion:</strong> Update impact to "Critical" based on competitors' recent moves.
                                </span>
                            </div>
                            <button className="text-xs font-bold text-purple-600 hover:text-purple-800">Accept</button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-navy-900 dark:text-white mb-2">Description</label>
                                <textarea
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-navy-800 text-sm"
                                    rows={3}
                                    defaultValue="The adoption of machine learning to automate complex decision-making processes."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-navy-900 dark:text-white mb-2">Impact on Business Model</label>
                                <textarea
                                    className="w-full px-4 py-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-navy-800 text-sm"
                                    rows={2}
                                    defaultValue="Potential to reduce overhead by 15%, but requires significant data infrastructure investment."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-navy-900 dark:text-white mb-2">Recommended Actions</label>
                                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-navy-800 p-4 rounded-lg border border-slate-200 dark:border-white/10">
                                    <li>Pilot predictive maintenance in Plant A.</li>
                                    <li>Hire Data Science lead.</li>
                                    <li>Audit current data quality.</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 4: CUSTOM TRENDS */}
                {activeTab === 'custom' && (
                    <div className="space-y-6">
                        <div className="bg-slate-50 dark:bg-navy-900 p-4 rounded-lg border border-slate-200 dark:border-white/10 flex items-start gap-3">
                            <AlertCircle className="text-slate-400 mt-1" size={18} />
                            <div>
                                <h4 className="font-bold text-sm text-navy-900 dark:text-white">AI Radar Watch</h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    I'm monitoring news sources for "Carbon Tax Legislation" as it seems relevant to your sector.
                                    <button className="text-purple-600 font-bold ml-1 hover:underline">Add to list?</button>
                                </p>
                            </div>
                        </div>

                        <DynamicList
                            title="My Custom Trends"
                            description="Add specific trends that are unique to your niche or local market."
                            items={customTrends}
                            columns={[
                                { key: 'name', label: 'Trend Name', width: 'w-1/3', placeholder: 'e.g. Local labor union strike' },
                                { key: 'reason', label: 'Why Relevant?', width: 'w-2/3', placeholder: 'e.g. Directly impacts Q4 production' },
                            ]}
                            {...customTrendHandlers}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};
