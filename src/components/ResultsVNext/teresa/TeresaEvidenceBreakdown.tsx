/**
 * RN-G4 lane `teresa` (FALA 2, 2026-08-11) — renders the
 * `evidence_breakdown` shape every KPI-E006/ROI-E008/OKR-E008 advisor
 * payload carries (`facts`/`inference`/`missing_evidence`/`recommendation`,
 * `teresaCopilotCanon.ts` L152-157/226-231/302-307). Three visually
 * distinct lists — never merged — because P08_CITATION_POSTURE
 * (`teresaCopilotCanon.ts` L797-810) requires "opinion vs fact must be
 * marked": a fact and an inference are not interchangeable evidence, and a
 * gap in `missing_evidence` is itself information the human approver needs
 * before deciding.
 */
import { AlertTriangle, CheckCircle2, HelpCircle, Lightbulb } from 'lucide-react';
import React from 'react';

export interface TeresaEvidenceBreakdownValue {
  facts: string[];
  inference: string[];
  missing_evidence: string[];
  recommendation: string;
}

export interface TeresaEvidenceBreakdownProps {
  value: TeresaEvidenceBreakdownValue;
  evidencePointers?: string[];
  isPolish: boolean;
}

function Section({
  icon: Icon,
  label,
  items,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  items: string[];
  tone: 'fact' | 'inference' | 'missing';
}) {
  if (items.length === 0) return null;
  const toneClass =
    tone === 'fact'
      ? 'text-c-success'
      : tone === 'inference'
        ? 'text-c-text-secondary'
        : 'text-c-warning';
  return (
    <div className="space-y-1">
      <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${toneClass}`}>
        <Icon size={12} />
        <span>{label}</span>
      </div>
      <ul className="space-y-1 pl-[18px] text-[12px] text-c-text-secondary list-disc marker:text-c-text-muted">
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

/** Renders the standard KPI/ROI/OKR advisor `evidence_breakdown` object —
 * this is the "dowód/źródło" half of the D13 pipeline
 * (`propose→...→podgląd konsekwencji`), always shown BEFORE any
 * accept/reject control. */
export const TeresaEvidenceBreakdown: React.FC<TeresaEvidenceBreakdownProps> = ({
  value,
  evidencePointers = [],
  isPolish,
}) => {
  return (
    <div
      className="space-y-3 rounded-lg border border-c-border bg-c-surface-raised p-3"
      data-testid="teresa-evidence-breakdown"
    >
      <Section
        icon={CheckCircle2}
        label={isPolish ? 'Fakty' : 'Facts'}
        items={value.facts}
        tone="fact"
      />
      <Section
        icon={Lightbulb}
        label={isPolish ? 'Wnioskowanie' : 'Inference'}
        items={value.inference}
        tone="inference"
      />
      <Section
        icon={AlertTriangle}
        label={isPolish ? 'Brakujące dowody' : 'Missing evidence'}
        items={value.missing_evidence}
        tone="missing"
      />
      {value.facts.length === 0 && value.inference.length === 0 && value.missing_evidence.length === 0 ? (
        <div className="flex items-center gap-1.5 text-[12px] text-c-text-muted">
          <HelpCircle size={12} />
          <span>{isPolish ? 'Teresa nie przywołała żadnych dowodów.' : 'Teresa cited no evidence.'}</span>
        </div>
      ) : null}
      <div className="border-t border-c-border pt-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          {isPolish ? 'Rekomendacja Teresy' : "Teresa's recommendation"}
        </div>
        <p className="mt-1 text-[12px] text-c-text">{value.recommendation || '—'}</p>
      </div>
      {evidencePointers.length > 0 ? (
        <div className="border-t border-c-border pt-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
            {isPolish ? 'Odwołania (evidence_pointers)' : 'Citations (evidence_pointers)'}
          </div>
          <ul className="mt-1 space-y-0.5 text-[11px] font-mono text-c-text-muted">
            {evidencePointers.map((ref, idx) => (
              <li key={idx}>{ref}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
};

export default TeresaEvidenceBreakdown;
