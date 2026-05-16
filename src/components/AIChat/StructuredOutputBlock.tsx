import React from 'react';

export interface StructuredOutputBlockProps {
  envelope?: unknown;
  [key: string]: unknown;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

export const StructuredOutputBlock: React.FC<StructuredOutputBlockProps> = ({ envelope }) => {
  const data = asRecord(envelope);
  const type = String(data.type || data.kind || '').toLowerCase();
  const payload = asRecord(data.payload || data.data || data);
  const title = String(data.title || payload.title || 'Structured output');

  if (!envelope || Object.keys(data).length === 0) return null;

  if (type.includes('comparison') || Array.isArray(payload.options)) {
    const options = Array.isArray(payload.options) ? payload.options : [];
    const risks = Array.isArray(payload.risks) ? payload.risks : [];
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 dark:border-navy-700 dark:bg-navy-900/40 dark:text-slate-200">
        <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
        {options.length > 0 && (
          <div className="mt-2 grid gap-2">
            {options.slice(0, 4).map((option: any, index: number) => (
              <div
                key={option?.id || index}
                className="rounded-lg bg-slate-50 p-2 dark:bg-navy-950/50"
              >
                <div className="font-medium">
                  {String(option?.name || option?.title || `Option ${index + 1}`)}
                </div>
                {option?.summary && (
                  <div className="mt-1 text-slate-500">{String(option.summary)}</div>
                )}
              </div>
            ))}
          </div>
        )}
        {risks.length > 0 && (
          <div className="mt-2">
            <div className="font-medium">Risks</div>
            <ul className="mt-1 list-disc pl-4">
              {risks.slice(0, 5).map((risk: any, index: number) => (
                <li key={index}>{String(risk?.label || risk?.title || risk)}</li>
              ))}
            </ul>
          </div>
        )}
        {payload.recommendation && (
          <div className="mt-2 rounded-lg bg-emerald-50 p-2 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
            <span className="font-medium">Recommendation: </span>
            {String(payload.recommendation)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 dark:border-navy-700 dark:bg-navy-900/40 dark:text-slate-200">
      <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
      {payload.summary && <div className="mt-1">{String(payload.summary)}</div>}
    </div>
  );
};

export default StructuredOutputBlock;
