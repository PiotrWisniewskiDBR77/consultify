/**
 * ProposedCardsPanel — surfaces AI-proposed initiative cards in the create flow.
 *
 * Renders two groups for a given proposal (see `useProposeCards`):
 *   - `core`     → READ-ONLY badges, labelled "rdzeń" (always included).
 *   - `proposed` → toggle chips; clicking calls `onToggle(key)`; the chip
 *                  reflects whether the key is in `selected`.
 *
 * Labels for the raw componentKeys are resolved best-effort:
 *   1. a small local PL/EN map (the common initiative section keys), then
 *   2. a humanized fallback (camelCase → "Camel Case").
 *
 * Additive + self-contained. Matches the Wizard's tailwind/dark-mode idiom.
 */
import { Check, Lock, Plus } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

export interface ProposedCardsPanelProps {
  core: string[];
  proposed: string[];
  selected: string[];
  onToggle: (key: string) => void;
  loading?: boolean;
}

/**
 * Common initiative section componentKey → human label (PL primary / EN).
 * Covers CORE_SECTION_KEYS + OPTIONAL_LIBRARY_KEYS from the generator brain.
 * Anything not listed falls back to a humanized key (see `humanize`).
 */
const KEY_LABELS: Record<string, { pl: string; en: string }> = {
  // Core
  problemDefinition: { pl: 'Problem', en: 'Problem' },
  targetState: { pl: 'Teza / stan docelowy', en: 'Thesis / target state' },
  kpis: { pl: 'KPI', en: 'KPIs' },
  scope: { pl: 'Zakres', en: 'Scope' },
  control: { pl: 'Właściciel / kontrola', en: 'Owner / control' },
  financialImpact: { pl: 'Business case', en: 'Business case' },
  // Optional library
  overview: { pl: 'Przegląd', en: 'Overview' },
  tasks: { pl: 'Zadania', en: 'Tasks' },
  decisions: { pl: 'Decyzje', en: 'Decisions' },
  raid: { pl: 'RAID', en: 'RAID' },
  gates: { pl: 'Gotowość bramek', en: 'Gate readiness' },
  financialAnalysis: { pl: 'Analiza finansowa', en: 'Financial analysis' },
  competencyRequirements: { pl: 'Wymagane kompetencje', en: 'Competency requirements' },
  skillsGap: { pl: 'Luka kompetencyjna', en: 'Skills gap' },
  pilot: { pl: 'Pilotaż', en: 'Pilot' },
  team: { pl: 'Zespół', en: 'Team' },
  timeline: { pl: 'Oś czasu', en: 'Timeline' },
  resources: { pl: 'Zasoby', en: 'Resources' },
  stakeholders: { pl: 'Interesariusze', en: 'Stakeholders' },
  dependencies: { pl: 'Zależności', en: 'Dependencies' },
};

/** camelCase / snake_case componentKey → "Title Cased" words. */
function humanize(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) return key;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function useCardLabel() {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  return (key: string): string => {
    const entry = KEY_LABELS[key];
    if (entry) return isPolish ? entry.pl : entry.en;
    return humanize(key);
  };
}

export const ProposedCardsPanel: React.FC<ProposedCardsPanelProps> = ({
  core,
  proposed,
  selected,
  onToggle,
  loading = false,
}) => {
  const { t } = useTranslation();
  const label = useCardLabel();
  const selectedSet = new Set(selected);

  const coreLabel = t('initiatives.proposedCards.core', 'rdzeń');
  const coreHeading = t('initiatives.proposedCards.coreHeading', 'Karty rdzenia (zawsze)');
  const proposedHeading = t(
    'initiatives.proposedCards.proposedHeading',
    'Proponowane karty (AI)'
  );

  return (
    <div
      data-testid="proposed-cards-panel"
      data-loading={loading ? 'true' : 'false'}
      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-navy-700/60 dark:bg-navy-950/30"
    >
      {/* Core cards — read-only */}
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {coreHeading}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {core.map((key) => (
          <span
            key={key}
            data-core-card={key}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-navy-700/60 dark:bg-navy-800/40 dark:text-slate-300"
          >
            <Lock size={11} className="shrink-0 text-slate-400" />
            <span>{label(key)}</span>
            <span className="ml-0.5 rounded bg-slate-200/70 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-navy-800 dark:text-slate-400">
              {coreLabel}
            </span>
          </span>
        ))}
      </div>

      {/* Proposed cards — toggle chips */}
      {proposed.length > 0 && (
        <>
          <div className="mb-1.5 mt-3.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            {proposedHeading}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {proposed.map((key) => {
              const isSelected = selectedSet.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  data-proposed-card={key}
                  data-selected={isSelected ? 'true' : 'false'}
                  aria-pressed={isSelected}
                  disabled={loading}
                  onClick={() => onToggle(key)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? 'border-[var(--c-info)] bg-slate-100 text-[var(--c-info)] dark:bg-white/[0.08] dark:text-[var(--c-info)]'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-c-info/40 dark:border-navy-700/60 dark:bg-navy-800/40 dark:text-slate-300'
                  }`}
                >
                  {isSelected ? (
                    <Check size={12} className="shrink-0" />
                  ) : (
                    <Plus size={12} className="shrink-0 text-slate-400" />
                  )}
                  <span>{label(key)}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default ProposedCardsPanel;
