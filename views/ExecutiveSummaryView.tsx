import React, { useMemo } from 'react';
`import { FullSession } from '../types';`
`import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';`

interface ExecutiveSummaryViewProps {
    session: FullSession;
}

export const ExecutiveSummaryView: React.FC<ExecutiveSummaryViewProps> = ({ session }) => {
    // --- Data Aggregation ---
    const calculateOverallScore = () => {
        const completedIds = session.assessment.completedAxes || [];
        if (completedIds.length === 0) return 0;

        // Map ID to score, handle undefined
`const scores = completedIds.map(id => (session.assessment[id]?.score || 0));`
        const total = scores.reduce((sum, score) => sum + score, 0);

        return (total / completedIds.length).toFixed(1);
    };

    const financials = useMemo(() => {
        const inits = session.initiatives || [];
        const capex = inits.reduce((sum, i) => sum + (i.costCapex || 0), 0);
        const opex = inits.reduce((sum, i) => sum + (i.costOpex || 0), 0);
        // Weighted ROI
        const totalCost = capex + (opex * 3); // 3 year horizon
        const totalGain = inits.reduce((sum, i) => sum + ((i.costCapex || 0) * (i.expectedRoi || 0)), 0);
        const avgRoi = totalCost > 0 ? (totalGain / totalCost).toFixed(1) : 0;

        return { capex, opex, avgRoi, count: inits.length };
    }, [session.initiatives]);

    const topInitiatives = (session.initiatives || [])
        .sort((a, b) => {
            const valA = a.businessValue === 'High' ? 3 : a.businessValue === 'Medium' ? 2 : 1;
            const valB = b.businessValue === 'High' ? 3 : b.businessValue === 'Medium' ? 2 : 1;
            return valB - valA;
        })
        .slice(0, 5);

    const maturityData = (session.assessment.completedAxes || []).map(axisId => ({
        name: axisId.substring(0, 10), // Short name
`score: (session.assessment[axisId]?.score || 0)`
    }));

    return (
        <div id="executive-summary-content" className="w-[210mm] min-h-[297mm] bg-white text-slate-900 p-8 mx-auto shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="border-b-4 border-blue-900 pb-4 mb-8 flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-serif font-bold text-blue-900">Digital Transformation Strategy</h1>
                    <p className="text-slate-500 uppercase tracking-widest text-sm mt-1">Executive Summary • {new Date().toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                    <div className="text-4xl font-bold text-blue-600">{calculateOverallScore()}/5.0</div>
                    <div className="text-xs text-slate-400 uppercase font-bold">Maturity Score</div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Left: Financial Case */}
                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Business Case</h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600 text-sm">Total Investment (Capex)</span>
                            <span className="font-bold text-xl">${(financials.capex / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600 text-sm">Operating Cost (Opex/yr)</span>
                            <span className="font-bold text-slate-700">${(financials.opex / 1000000).toFixed(1)}M</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600 text-sm">Portfolio ROI</span>
                            <span className="font-bold text-green-600">{financials.avgRoi}x</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <p className="text-xs text-slate-500 italic">
                                "The portfolio consists of {financials.count} strategic initiatives targeting a {financials.avgRoi}x return over 3 years."
                            </p>
                        </div>
                    </div>
                </div>

                {/* Right: Maturity Visualization */}
                <div className="h-64">
                    <h3 className="text-lg font-bold text-slate-800 mb-2">Maturity Profile</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={maturityData} layout="vertical" margin={{ left: 40 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" domain={[0, 5]} hide />
                            <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                            <Bar dataKey="score" fill="#2563eb" radius={[0, 4, 4, 0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Strategic Initiatives Table */}
            <div className="mb-8">
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b border-slate-200 pb-2">Strategic Priority Initiatives</h3>
                <table className="w-full text-sm text-left">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-2 rounded-l">Initiative</th>
                            <th className="px-4 py-2">Axis</th>
                            <th className="px-4 py-2">Business Value</th>
                            <th className="px-4 py-2 text-right rounded-r">Cost</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {topInitiatives.map((init, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="px-4 py-3 font-medium text-slate-800">
                                    {init.name}
                                    <div className="text-xs text-slate-500 font-normal mt-0.5 line-clamp-1">{init.summary}</div>
                                </td>
                                <td className="px-4 py-3 text-slate-600 capitalize">{init.axis}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${init.businessValue === 'High' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'
                                        }`}>
                                        {init.businessValue}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-slate-600">${(init.costCapex || 0).toLocaleString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Footer / Disclaimers */}
            <div className="mt-auto border-t border-slate-200 pt-6 flex justify-between items-center text-xs text-slate-400">
                <p>Generated by Consultify Enterprise • Confidential</p>
                <div className="flex gap-4">
                    <span>consultify.io</span>
                    <span>Page 1 of 1</span>
                </div>
            </div>
        </div>
    );
};
