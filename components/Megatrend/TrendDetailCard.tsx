// components/Megatrend/TrendDetailCard.tsx
// UI component for the detailed view of a single megatrend (Card 3)
// ---------------------------------------------------------------
// This card presents a full strategic analysis of a megatrend, ready for
// conversation with the user. It follows the specification:
//   • What is it – short description, no buzzwords
//   • Trend Type – classification and strategic role
//   • Why it matters for the industry – production impact mechanism
//   • Why it matters for YOUR company – personalised context
//   • Impact Scoring – economics, likelihood (3‑5 yr), unavoidability, competitive pressure
//   • AI Insight – suggested ring, risks, opportunities, recommended actions
//   • Documents & Evidence – list of attached files/links, AI can re‑score after upload
// ---------------------------------------------------------------

import React, { useEffect, useState } from "react";

// Expected shape of a megatrend – matches backend model
interface MegatrendDetail {
    id: string;
    label: string;
    shortDescription: string; // 2‑3 sentences, no buzzwords
    type: "Technology" | "Business" | "Societal";
    industryImpact: string; // why it matters for the industry
    companyImpact: string; // personalised for the user's company
    impactScore: number; // 1‑7 economic impact
    likelihood: string; // e.g. "High (3‑5 yr)"
    unavoidability: string; // e.g. "Medium"
    competitivePressure: string; // e.g. "Low"
    aiSuggestion?: {
        ring: "Now" | "Watch Closely" | "On the Horizon";
        risks: string[];
        opportunities: string[];
        actions: string[];
    };
    documents?: { title: string; url: string }[];
}

// Props – either the whole object is passed or an id is provided and we fetch it.
interface TrendDetailCardProps {
    trendId?: string;
    trend?: MegatrendDetail;
}

export const TrendDetailCard: React.FC<TrendDetailCardProps> = ({ trendId, trend: propTrend }) => {
    const [trend, setTrend] = useState<MegatrendDetail | null>(propTrend ?? null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // If only an id is supplied, fetch the full detail from the backend.
    useEffect(() => {
        if (propTrend) return; // already have data
        if (!trendId) return;
        const fetchDetail = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`/api/megatrends/${encodeURIComponent(trendId)}`);
                if (!res.ok) throw new Error("Failed to load trend detail");
                const json: MegatrendDetail = await res.json();
                setTrend(json);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchDetail();
    }, [trendId, propTrend]);

    if (loading) {
        return (
            <div className="flex items-center space-x-2 text-gray-600 dark:text-gray-300">
                <svg className="animate-spin h-5 w-5 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                <span>Loading trend details…</span>
            </div>
        );
    }

    if (error) {
        return <p className="text-red-600 dark:text-red-400">Error: {error}</p>;
    }

    if (!trend) {
        return <p className="text-gray-500 dark:text-gray-400">No trend selected.</p>;
    }

    const { label, shortDescription, type, industryImpact, companyImpact, impactScore, likelihood, unavoidability, competitivePressure, aiSuggestion, documents } = trend;

    const typeEmoji = {
        Technology: "🔵",
        Business: "🟣",
        Societal: "🟠",
    }[type];

    // Helper to render a heading with an icon
    const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-700 dark:text-gray-300">
            {icon}
            <span>{title}</span>
        </h3>
    );

    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-50" role="dialog" aria-modal="true">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
                {/* Close button */}
                <button
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
                    onClick={() => window.history.back()}
                    aria-label="Close"
                >
                    ✕
                </button>

                {/* Header */}
                <div className="flex items-center gap-3">
                    <span className="text-3xl">{typeEmoji}</span>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{label}</h2>
                </div>

                {/* What is it */}
                <section>
                    <SectionHeader icon={<span>📄</span>} title="What is it" />
                    <p className="mt-1 text-gray-600 dark:text-gray-200">{shortDescription}</p>
                </section>

                {/* Trend Type */}
                <section>
                    <SectionHeader icon={<span>🧭</span>} title="Trend Type" />
                    <p className="mt-1 text-gray-600 dark:text-gray-200">
                        {type} – {typeEmoji} – shapes strategic opportunities, competitive pressure, or non‑negotiable standards.
                    </p>
                </section>

                {/* Why it matters for the industry */}
                <section>
                    <SectionHeader icon={<span>🏭</span>} title="Why it matters for the industry" />
                    <p className="mt-1 text-gray-600 dark:text-gray-200">{industryImpact}</p>
                </section>

                {/* Why it matters for YOUR company */}
                <section>
                    <SectionHeader icon={<span>👤</span>} title="Why it matters for YOUR company" />
                    <p className="mt-1 text-gray-600 dark:text-gray-200">{companyImpact}</p>
                </section>

                {/* Impact Scoring */}
                <section>
                    <SectionHeader icon={<span>📊</span>} title="Impact Scoring" />
                    <div className="grid grid-cols-2 gap-4 mt-2 text-gray-600 dark:text-gray-200">
                        <div><span className="font-medium">Economic impact:</span> {impactScore}/7</div>
                        <div><span className="font-medium">Likelihood (3‑5 yr):</span> {likelihood}</div>
                        <div><span className="font-medium">Unavoidability:</span> {unavoidability}</div>
                        <div><span className="font-medium">Competitive pressure:</span> {competitivePressure}</div>
                    </div>
                </section>

                {/* AI Insight */}
                {aiSuggestion && (
                    <section>
                        <SectionHeader icon={<span>🤖</span>} title="AI Insight" />
                        <div className="mt-2 space-y-2 text-gray-600 dark:text-gray-200">
                            <p><span className="font-medium">Suggested ring:</span> {aiSuggestion.ring}</p>
                            <div><span className="font-medium">Risks:</span>
                                <ul className="list-disc list-inside ml-4">
                                    {aiSuggestion.risks.map((r, i) => (<li key={i}>{r}</li>))}
                                </ul>
                            </div>
                            <div><span className="font-medium">Opportunities:</span>
                                <ul className="list-disc list-inside ml-4">
                                    {aiSuggestion.opportunities.map((o, i) => (<li key={i}>{o}</li>))}
                                </ul>
                            </div>
                            <div><span className="font-medium">Recommended actions:</span>
                                <ul className="list-disc list-inside ml-4">
                                    {aiSuggestion.actions.map((a, i) => (<li key={i}>{a}</li>))}
                                </ul>
                            </div>
                        </div>
                    </section>
                )}

                {/* Documents & Evidence */}
                {documents && documents.length > 0 && (
                    <section>
                        <SectionHeader icon={<span>📁</span>} title="Documents & Evidence" />
                        <ul className="mt-2 list-disc list-inside space-y-1 text-gray-600 dark:text-gray-200">
                            {documents.map((doc, i) => (
                                <li key={i}>
                                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-600 dark:hover:text-indigo-400">
                                        {doc.title}
                                    </a>
                                </li>
                            ))}
                        </ul>
                        <button
                            className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                            onClick={() => {
                                console.log('Download all documents / trigger AI re‑score');
                            }}
                        >
                            Download all & re‑score
                        </button>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            AI will re‑evaluate the scoring when new documents are added.
                        </p>
                    </section>
                )}
            </div>
        </div>
    );
};

export default TrendDetailCard;
