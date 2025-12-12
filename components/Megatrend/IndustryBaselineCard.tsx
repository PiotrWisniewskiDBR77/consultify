// components/Megatrend/IndustryBaselineCard.tsx
// UI component for the "Industry Baseline" card of the Megatrend Scanner module
// ---------------------------------------------------------------
// This card allows the user to select an industry (e.g. automotive, FMCG, machinery, metal, plastics)
// and displays the default megatrends for that industry. Each megatrend shows:
//   • Type (Technology / Business / Societal) – colour‑coded badge with emoji
//   • Label
//   • Base impact score (1‑7)
//   • Initial ring (Now / Watch Closely / On the Horizon)
//   • AI‑generated short insight (placeholder for now)
// The component uses the existing fetch wrapper (if any) and TailwindCSS for styling.
// ---------------------------------------------------------------

import React, { useState, useEffect } from 'react';

// Types
interface Megatrend {
    id: string;
    industry: string;
    type: 'Technology' | 'Business' | 'Societal';
    label: string;
    description: string;
    baseImpactScore: number;
    initialRing: 'Now' | 'Watch Closely' | 'On the Horizon';
    aiInsight?: {
        suggestedRing: string;
        risks: string[];
        opportunities: string[];
        recommendedActions: string[];
    };
}

const industryOptions = [
    'automotive',
    'FMCG',
    'machinery',
    'metal',
    'plastics',
    'general', // fallback / all‑industry view
];

const typeBadge = (type: Megatrend['type']) => {
    const map: Record<Megatrend['type'], { color: string; emoji: string }> = {
        Technology: { color: 'bg-blue-100 text-blue-800', emoji: '🔵' },
        Business: { color: 'bg-purple-100 text-purple-800', emoji: '🟣' },
        Societal: { color: 'bg-orange-100 text-orange-800', emoji: '🟠' },
    };
    const { color, emoji } = map[type];
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
            {emoji} {type}
        </span>
    );
};

const ringBadge = (ring: Megatrend['initialRing']) => {
    const map: Record<Megatrend['initialRing'], { color: string }> = {
        Now: { color: 'bg-green-100 text-green-800' },
        'Watch Closely': { color: 'bg-yellow-100 text-yellow-800' },
        'On the Horizon': { color: 'bg-gray-100 text-gray-800' },
    };
    const { color } = map[ring];
    return (
        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>📍 {ring}</span>
    );
};

const IndustryBaselineCard: React.FC = () => {
    const [selectedIndustry, setSelectedIndustry] = useState<string>('automotive');
    const [megatrends, setMegatrends] = useState<Megatrend[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchBaseline = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/megatrends/baseline?industry=${encodeURIComponent(selectedIndustry)}`);
                if (!res.ok) throw new Error('Failed to load baseline megatrends');
                const data: Megatrend[] = await res.json();
                setMegatrends(data);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchBaseline();
    }, [selectedIndustry]);

    return (
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
            <h2 className="text-2xl font-semibold text-gray-800">Industry Baseline</h2>
            <div className="flex items-center space-x-3">
                <label htmlFor="industry" className="text-sm font-medium text-gray-700">
                    Select industry:
                </label>
                <select
                    id="industry"
                    value={selectedIndustry}
                    onChange={e => setSelectedIndustry(e.target.value)}
                    className="mt-1 block w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                    {industryOptions.map(ind => (
                        <option key={ind} value={ind}>
                            {ind.charAt(0).toUpperCase() + ind.slice(1)}
                        </option>
                    ))}
                </select>
            </div>

            {loading && <p className="text-gray-500">Loading megatrends…</p>}
            {error && <p className="text-red-600">Error: {error}</p>}

            <ul className="space-y-4">
                {megatrends.map(mt => (
                    <li key={mt.id} className="border border-gray-200 rounded-md p-4 hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                {typeBadge(mt.type)}
                                <span className="text-lg font-medium text-gray-900">{mt.label}</span>
                                {ringBadge(mt.initialRing)}
                            </div>
                            <div className="text-sm font-semibold text-indigo-600">
                                Impact: {mt.baseImpactScore}/7
                            </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">{mt.description}</p>
                        {/* Placeholder for AI insight – will be replaced by real AI output later */}
                        <p className="mt-2 text-xs text-gray-500 italic">AI insight: {mt.aiInsight?.suggestedRing ?? '—'}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default IndustryBaselineCard;
