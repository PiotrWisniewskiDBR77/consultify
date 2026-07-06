// components/Megatrend/TrendDetailCard.tsx
// UI component for the detailed view of a single megatrend (Card 3)
// ---------------------------------------------------------------
// This card presents a full strategic analysis of a megatrend, ready for
// conversation with the user. It follows the specification:
//   • What is it – short description, no buzzwords
//   • Trend Type – classification and strategic role
//   • Why it matters for the industry – production impact mechanism
//   • Why it matters for YOUR company – personalised context
//   • Impact Scoring - economics, likelihood (3-5 yr), unavoidability, competitive pressure
//   • AI Insight – suggested ring, risks, opportunities, recommended actions
//   • Documents & Evidence – list of attached files/links, AI can re‑score after upload
// ---------------------------------------------------------------

import React, { useEffect, useState } from 'react';

// Expected shape of a megatrend – matches backend model
export interface MegatrendDetail {
  id: string;
  label: string;
  shortDescription: string; // 2‑3 sentences, no buzzwords
  type: 'Technology' | 'Business' | 'Societal';
  industryImpact: string; // why it matters for the industry
  companyImpact: string; // personalised for the user's company
  impactScore: number; // 1‑7 economic impact
  likelihood: string; // e.g. "High (3-5 yr)"
  unavoidability: string; // e.g. "Medium"
  competitivePressure: string; // e.g. "Low"
  aiSuggestion?: {
    ring: 'Now' | 'Watch Closely' | 'On the Horizon';
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
  onClose?: () => void;
}

export const TrendDetailCard: React.FC<TrendDetailCardProps> = ({
  trendId,
  trend: propTrend,
  onClose,
}) => {
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
        if (!res.ok) throw new Error('Failed to load trend detail');
        const json: MegatrendDetail = await res.json();
        setTrend(json);
      } catch (e: unknown) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [trendId, propTrend]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-c-text-secondary">
        <div className="flex items-center space-x-2">
          <svg
            className="animate-spin h-5 w-5 text-c-accent"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
          </svg>
          <span>Loading trend details…</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-danger-600 dark:text-danger-400">
        <p>Error: {error}</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-c-surface-raised rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!trend) {
    return <p className="text-c-text-muted">No trend selected.</p>;
  }

  const {
    label,
    shortDescription,
    type,
    industryImpact,
    companyImpact,
    impactScore,
    likelihood,
    unavoidability,
    competitivePressure,
    aiSuggestion,
    documents,
  } = trend;

  const typeEmoji = {
    Technology: '🔵',
    Business: '🟣',
    Societal: '🟠',
  }[type];

  // Helper to render a heading with an icon
  const SectionHeader = ({ icon, title }: { icon: React.ReactNode; title: string }) => (
    <h3 className="flex items-center gap-2 text-lg font-semibold text-c-text-secondary">
      {icon}
      <span>{title}</span>
    </h3>
  );

  return (
    <div className="bg-c-surface rounded-xl shadow-lg w-full overflow-hidden border border-slate-200/60 dark:border-white/[0.03] relative">
      {/* Close button */}
      <button
        className="absolute top-4 right-4 p-2 rounded-full hover:bg-c-surface-raised dark:hover:bg-c-surface-raised text-c-text-muted hover:text-c-text dark:hover:text-c-text-muted transition-colors"
        onClick={onClose}
        aria-label="Close"
      >
        ✕
      </button>

      <div className="p-6 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-c-border-subtle pb-6">
          <span className="text-4xl shadow-sm rounded-full bg-c-surface-raised p-2">
            {typeEmoji}
          </span>
          <div>
            <div className="text-sm font-medium text-c-text-muted uppercase tracking-wider mb-1">
              {type} Trend
            </div>
            <h2 className="text-3xl font-bold text-c-text">{label}</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-8">
            {/* What is it */}
            <section className="bg-c-surface-raised p-6 rounded-lg">
              <SectionHeader icon={<span>📄</span>} title="What is it" />
              <p className="mt-2 text-c-text-secondary leading-relaxed text-lg text-justify">
                {shortDescription}
              </p>
            </section>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Why it matters for the industry */}
              <section>
                <SectionHeader icon={<span>🏭</span>} title="Industry Impact" />
                <p className="mt-2 text-c-text-secondary text-justify">
                  {industryImpact}
                </p>
              </section>

              {/* Why it matters for YOUR company */}
              <section>
                <SectionHeader icon={<span>👤</span>} title="Company Impact" />
                <p className="mt-2 text-c-text-secondary text-justify">
                  {companyImpact}
                </p>
              </section>
            </div>

            {/* AI Insight */}
            {aiSuggestion && (
              <section className="bg-[color-mix(in_srgb,var(--c-info)_8%,transparent)] border-l-2 border-c-info rounded-xl p-6">
                <SectionHeader icon={<span>🤖</span>} title="AI Insight" />
                <div className="mt-4 space-y-4 text-c-text-secondary">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="font-semibold text-c-info">
                      Suggested Ring:
                    </span>
                    <span className="px-3 py-1 bg-c-info text-white rounded-full text-sm font-medium">
                      {aiSuggestion.ring}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="font-semibold text-danger-600/80 dark:text-danger-400 block mb-2">
                        Risks
                      </span>
                      <ul className="list-disc list-inside space-y-1">
                        {aiSuggestion.risks.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-c-success block mb-2">
                        Opportunities
                      </span>
                      <ul className="list-disc list-inside space-y-1">
                        {aiSuggestion.opportunities.map((o, i) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-semibold text-c-info block mb-2">
                        Actions
                      </span>
                      <ul className="list-disc list-inside space-y-1">
                        {aiSuggestion.actions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-6">
            {/* Impact Scoring */}
            <section className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-4 shadow-sm">
              <SectionHeader icon={<span>📊</span>} title="Impact Scoring" />
              <div className="space-y-4 mt-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-c-text-muted">Economic Impact</span>
                    <span className="font-bold">{impactScore}/7</span>
                  </div>
                  <div className="h-2 bg-c-surface-raised rounded-full overflow-hidden">
                    <div
                      className="h-full bg-c-tag-1"
                      style={{ width: `${(impactScore / 7) * 100}%` }}
                    ></div>
                  </div>
                </div>
                <div className="pt-2 border-t border-c-border-subtle space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-c-text-muted">Likelihood (3-5yr)</span>
                    <span className="font-medium">{likelihood}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-c-text-muted">Unavoidability</span>
                    <span className="font-medium">{unavoidability}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-c-text-muted">Competitive Pressure</span>
                    <span className="font-medium">{competitivePressure}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Documents & Evidence */}
            {documents && documents.length > 0 && (
              <section className="bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] p-4 shadow-sm">
                <SectionHeader icon={<span>📁</span>} title="Evidence" />
                <ul className="mt-4 space-y-3">
                  {documents.map((doc, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-c-text-secondary dark:text-c-text-muted mt-0.5">•</span>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-c-accent hover:underline leading-tight"
                      >
                        {doc.title}
                      </a>
                    </li>
                  ))}
                </ul>
                <button
                  className="mt-4 w-full px-4 py-2 bg-c-surface-raised text-c-text-secondary text-sm font-medium rounded-lg hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition"
                  onClick={() => {
                    console.log('Download all documents / trigger AI re‑score');
                  }}
                >
                  Download all & re‑score
                </button>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendDetailCard;
