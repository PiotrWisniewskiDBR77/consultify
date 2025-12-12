// components/Megatrend/CustomTrendCard.tsx
// Card 4: Custom / Company-Specific Trends
// Allows adding local pressures (e.g., competitor pricing, regulations).
// ----------------------------------------------------------------------

import React, { useState } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

interface CustomTrend {
    id: string;
    label: string;
    description: string;
    type: 'Technology' | 'Business' | 'Societal';
    ring: 'Now' | 'Watch Closely' | 'On the Horizon';
}

interface CustomTrendCardProps {
    trends: CustomTrend[];
    onAdd: (trend: Omit<CustomTrend, 'id'>) => void;
    onDelete: (id: string) => void;
}

export const CustomTrendCard: React.FC<CustomTrendCardProps> = ({ trends, onAdd, onDelete }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [newTrend, setNewTrend] = useState<Omit<CustomTrend, 'id'>>({
        label: '',
        description: '',
        type: 'Business',
        ring: 'Now'
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAdd(newTrend);
        setNewTrend({ label: '', description: '', type: 'Business', ring: 'Now' });
        setIsAdding(false);
    };

    return (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Custom Trends</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Add specific pressures unique to your market or niche.
                    </p>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                        <Plus size={16} /> Add Custom Trend
                    </button>
                )}
            </div>

            {/* AI Suggestion Banner */}
            <div className="bg-slate-50 dark:bg-navy-800 p-4 rounded-lg border border-slate-200 dark:border-white/10 flex items-start gap-3">
                <AlertCircle className="text-slate-400 mt-1" size={18} />
                <div>
                    <h4 className="font-bold text-sm text-navy-900 dark:text-white">AI Radar Watch</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        I'm monitoring news sources for "Carbon Tax Legislation" as it seems relevant to your sector.
                        <button className="text-purple-600 dark:text-purple-400 font-bold ml-1 hover:underline">Add to list?</button>
                    </p>
                </div>
            </div>

            {/* List */}
            <div className="space-y-3">
                {trends.length === 0 && !isAdding && (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-500 italic">
                        No custom trends added yet.
                    </div>
                )}

                {trends.map(trend => (
                    <div key={trend.id} className="flex justify-between items-start p-4 bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-white/10 rounded-lg">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-bold text-navy-900 dark:text-white">{trend.label}</h4>
                                <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase
                                    ${trend.type === 'Technology' ? 'bg-blue-100 text-blue-700' :
                                        trend.type === 'Business' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {trend.type}
                                </span>
                                <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded font-medium">
                                    {trend.ring}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300">{trend.description}</p>
                        </div>
                        <button
                            onClick={() => onDelete(trend.id)}
                            className="text-gray-400 hover:text-red-500 transition p-1"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}
            </div>

            {/* Add Form */}
            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-slate-50 dark:bg-navy-800 p-4 rounded-lg border border-purple-200 dark:border-purple-800 animate-in fade-in slide-in-from-top-2">
                    <h3 className="font-bold text-gray-900 dark:text-white mb-4">New Custom Trend</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Trend Name</label>
                            <input
                                type="text"
                                required
                                value={newTrend.label}
                                onChange={e => setNewTrend({ ...newTrend, label: e.target.value })}
                                placeholder="e.g. Local Competitor Price War"
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-navy-900 text-sm"
                            />
                        </div>
                        <div className="col-span-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description / Why Relevant?</label>
                            <textarea
                                required
                                value={newTrend.description}
                                onChange={e => setNewTrend({ ...newTrend, description: e.target.value })}
                                placeholder="Impact on our Q3 sales..."
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-navy-900 text-sm"
                                rows={2}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Type</label>
                            <select
                                value={newTrend.type}
                                onChange={e => setNewTrend({ ...newTrend, type: e.target.value as CustomTrend['type'] })}
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-navy-900 text-sm"
                            >
                                <option value="Technology">Technology</option>
                                <option value="Business">Business</option>
                                <option value="Societal">Societal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Horizon (Ring)</label>
                            <select
                                value={newTrend.ring}
                                onChange={e => setNewTrend({ ...newTrend, ring: e.target.value as CustomTrend['ring'] })}
                                className="w-full px-3 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-navy-900 text-sm"
                            >
                                <option value="Now">Impact Now</option>
                                <option value="Watch Closely">Watch Closely</option>
                                <option value="On the Horizon">On the Horizon</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                        >
                            Save Trend
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};
