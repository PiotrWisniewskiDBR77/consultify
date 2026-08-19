import { CheckCircle2, Link2, ShieldAlert } from 'lucide-react';
import React from 'react';

export const UNIVERSAL_SYNTHESIS_SECTION_IDS = [
  'executive-answer',
  'key-findings',
  'key-insights',
  'business-implications',
  'conclusions',
  'decision-options',
  'consultant-recommendation',
  'risks-assumptions-uncertainties',
  'management-questions',
] as const;

export type UniversalSynthesisSectionId = (typeof UNIVERSAL_SYNTHESIS_SECTION_IDS)[number];

export interface UniversalSynthesisSection {
  id: UniversalSynthesisSectionId;
  title: string;
  content: string[];
  evidenceRefs?: string[];
  status?: 'draft' | 'validated' | 'needs-evidence';
}

const TITLES: Record<UniversalSynthesisSectionId, { en: string; pl: string }> = {
  'executive-answer': { en: 'Executive Answer', pl: 'Odpowiedź zarządcza' },
  'key-findings': { en: 'Key Findings', pl: 'Kluczowe ustalenia' },
  'key-insights': { en: 'Key Insights', pl: 'Kluczowe insighty' },
  'business-implications': { en: 'Business Implications', pl: 'Implikacje biznesowe' },
  conclusions: { en: 'Conclusions', pl: 'Wnioski' },
  'decision-options': { en: 'Decision Options', pl: 'Opcje decyzyjne' },
  'consultant-recommendation': { en: 'Consultant Recommendation', pl: 'Rekomendacja konsultanta' },
  'risks-assumptions-uncertainties': {
    en: 'Risks, Assumptions & Uncertainties',
    pl: 'Ryzyka, założenia i niepewności',
  },
  'management-questions': {
    en: 'Questions Requiring Management Decision',
    pl: 'Pytania wymagające decyzji zarządu',
  },
};

export function normalizeUniversalSynthesis(
  values: Partial<Record<UniversalSynthesisSectionId, string[] | string>>,
  isPolish: boolean,
  evidenceBySection: Partial<Record<UniversalSynthesisSectionId, string[]>> = {}
): UniversalSynthesisSection[] {
  return UNIVERSAL_SYNTHESIS_SECTION_IDS.map((id) => {
    const raw = values[id];
    const content = (Array.isArray(raw) ? raw : raw ? [raw] : []).map(String).filter(Boolean);
    return {
      id,
      title: isPolish ? TITLES[id].pl : TITLES[id].en,
      content,
      evidenceRefs: (evidenceBySection[id] || []).filter(Boolean),
      // Presence is not validation. Until the source carries explicit evidence
      // and a consultant decision, every derived section remains draft.
      status: content.length ? 'draft' : 'needs-evidence',
    };
  });
}

export function ToolSynthesisSections({
  sections,
  isPolish = false,
}: {
  sections: UniversalSynthesisSection[];
  isPolish?: boolean;
}) {
  return (
    <div className="space-y-3" data-testid="universal-synthesis">
      {sections.map((section, index) => (
        <section
          key={section.id}
          data-synthesis-section={section.id}
          className="rounded-2xl border border-c-border bg-c-surface p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-c-text-muted">
                {index + 1}/9
              </div>
              <h3 className="mt-1 text-sm font-semibold text-c-text">{section.title}</h3>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${section.status === 'validated' ? 'bg-c-success/10 text-c-success' : 'bg-c-warning/10 text-c-warning'}`}
            >
              {section.status === 'validated' ? (
                <CheckCircle2 size={12} />
              ) : (
                <ShieldAlert size={12} />
              )}
              {section.status === 'validated'
                ? isPolish
                  ? 'Zweryfikowano'
                  : 'Validated'
                : section.status === 'draft'
                  ? isPolish
                    ? 'Wymaga walidacji'
                    : 'Needs validation'
                  : isPolish
                    ? 'Brak dowodów'
                    : 'Needs evidence'}
            </span>
          </div>
          {section.content.length ? (
            <ul className="mt-3 space-y-2 text-sm text-c-text-secondary">
              {section.content.map((item, itemIndex) => (
                <li key={`${section.id}-${itemIndex}`}>• {item}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-c-text-muted">—</p>
          )}
          {(section.evidenceRefs?.length || 0) > 0 && (
            <div className="mt-3 text-xs text-c-text-muted">
              <div className="flex items-center gap-1 font-medium">
                <Link2 size={12} />
                {isPolish ? 'Referencje dowodowe' : 'Evidence references'}
              </div>
              <ul
                className="mt-1 flex flex-wrap gap-1"
                aria-label={isPolish ? 'Identyfikatory dowodów' : 'Evidence identifiers'}
              >
                {section.evidenceRefs!.map((reference) => (
                  <li
                    key={reference}
                    className="rounded-md bg-c-surface-raised px-1.5 py-0.5 font-mono"
                  >
                    {reference}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
