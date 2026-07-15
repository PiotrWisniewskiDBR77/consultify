/**
 * MaturityPathwaySection — "Ścieżka dojrzałości N→N+1"
 *
 * Renders, per assessed dimension that is BELOW its target, the concrete recipe
 * for moving from the current maturity level to the next one:
 *   K1 (co jest / current state) → K2 (co to znaczy / the gap) →
 *   K3 (co zrobić / actions) → K4 (jaki efekt / target evidence),
 * plus typical obstacles and any prerequisite note.
 *
 * The recipe itself is fully deterministic and comes from
 * `getMaturityPathway()` (assessmentKnowledge) — this component only presents it.
 * Works for DRD, SIRI and ADMA via the `framework` prop.
 *
 * Aesthetic: matches the report templates — clean slate/blue/teal, semantic
 * amber/emerald, NO crimson (`primary-*`) classes.
 */

import { ArrowRight, CheckCircle2, Compass, Flag, Lightbulb, TriangleAlert } from 'lucide-react';
import React, { useMemo } from 'react';

import i18n from '@/i18n';

import {
  getMaturityPathway,
  type MaturityPathwayFramework,
} from '../../../services/assessmentKnowledge';

/** One dimension row the section needs to plot a pathway for. */
export interface MaturityPathwayDimensionInput {
  /** Framework-native dimension id (DRD: "D1".."D8"; SIRI/ADMA: structure id). */
  dimensionId: string;
  /** Current achieved level (framework-native scale). */
  currentLevel: number;
  /** Target level — only dimensions BELOW target get a pathway card. */
  targetLevel: number;
}

interface MaturityPathwaySectionProps {
  framework: MaturityPathwayFramework;
  dimensions: MaturityPathwayDimensionInput[];
  language?: 'pl' | 'en';
  /** Cap the number of pathway cards (default 6 — the biggest gaps). */
  maxCards?: number;
}

export const MaturityPathwaySection: React.FC<MaturityPathwaySectionProps> = ({
  framework,
  dimensions,
  language = 'pl',
  maxCards = 6,
}) => {
  const label = (key: string, pl: string, en: string) =>
    i18n.t(`assessment.maturityPathway.${key}`, { lng: language, defaultValue: language === 'pl' ? pl : en });

  // Only dimensions genuinely below target, largest gap first, capped.
  const recommendations = useMemo(() => {
    return dimensions
      .filter((d) => Number(d.currentLevel) < Number(d.targetLevel))
      .map((d) => ({
        gap: Number(d.targetLevel) - Number(d.currentLevel),
        rec: getMaturityPathway({
          framework,
          dimensionId: d.dimensionId,
          currentLevel: Number(d.currentLevel),
          language,
        }),
      }))
      .sort((a, b) => b.gap - a.gap)
      .slice(0, Math.max(0, maxCards));
  }, [dimensions, framework, language, maxCards]);

  if (recommendations.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
        <Compass size={20} className="text-teal-600 dark:text-teal-400" />
        {label('heading', 'Ścieżka dojrzałości (N → N+1)', 'Maturity pathway (N → N+1)')}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        {label(
          'subheading',
          'Co konkretnie zrobić, aby przejść z obecnego poziomu na następny — dla wymiarów poniżej celu.',
          'What concretely to do to move from the current level to the next — for dimensions below target.'
        )}
      </p>

      <div className="space-y-4">
        {recommendations.map(({ rec }) => (
          <article
            key={`${rec.framework}-${rec.dimensionId}`}
            className="rounded-xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900/50 overflow-hidden"
          >
            {/* Header: dimension + level transition */}
            <div className="flex items-center justify-between gap-3 px-5 py-3 bg-slate-50 dark:bg-navy-800 border-b border-slate-200 dark:border-navy-700">
              <h3 className="font-semibold text-slate-900 dark:text-white truncate">
                {rec.dimensionName}
              </h3>
              <div className="flex items-center gap-2 shrink-0 text-sm">
                <span className="px-2 py-0.5 rounded-lg bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-200 font-medium">
                  {rec.fromLabel}
                </span>
                <ArrowRight size={14} className="text-slate-400 dark:text-slate-500" />
                <span className="px-2 py-0.5 rounded-lg bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-semibold">
                  {rec.toLabel}
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* K1 — co jest */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                  {label('currentState', 'Co jest', 'Current state')}
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                  {rec.currentState}
                </p>
              </div>

              {/* K2 — co to znaczy */}
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1">
                  {label('gapMeaning', 'Co to znaczy', 'What it means')}
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {rec.gapMeaning}
                </p>
              </div>

              {/* K3 — co zrobić */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-500/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                  <Lightbulb size={13} />
                  {label('actionsHeading', 'Co zrobić, by przejść wyżej', 'What to do to move up')}
                </div>
                <ul className="space-y-1.5">
                  {rec.actions.map((action, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200"
                    >
                      <CheckCircle2
                        size={15}
                        className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0"
                      />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* K4 — jaki efekt */}
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-500/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300 mb-1 flex items-center gap-1.5">
                  <Flag size={13} />
                  {label(
                    'evidenceHeading',
                    'Jaki efekt potwierdzi poziom',
                    'Evidence that confirms the level'
                  )}
                </div>
                <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
                  {rec.targetEvidence}
                </p>
              </div>

              {/* Prerequisite note (DRD only today) */}
              {rec.prerequisiteNote && (
                <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                  {rec.prerequisiteNote}
                </p>
              )}

              {/* Typical obstacles */}
              {rec.typicalObstacles.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                    <TriangleAlert size={13} />
                    {label('obstaclesHeading', 'Typowe przeszkody', 'Typical obstacles')}
                  </div>
                  <ul className="space-y-1">
                    {rec.typicalObstacles.map((obstacle, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                        <span>{obstacle}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default MaturityPathwaySection;
