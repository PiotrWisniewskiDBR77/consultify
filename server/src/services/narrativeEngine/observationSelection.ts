/**
 * Narrative Engine — Layer 2: Observation Selection
 *
 * Deterministic analysis of extracted facts to identify noteworthy observations.
 * Detects deviations, overdue items, pending decisions, risks, achievements, and anomalies.
 * Ranks by severity and relevance to the report goal.
 * No LLM calls.
 */

import type { FactSet, NarrativeEngineInput, Observation } from './types.js';

function generateObservationId(index: number): string {
  return `obs_${Date.now().toString(36)}_${index}`;
}

function detectDeviations(facts: FactSet[]): Observation[] {
  const observations: Observation[] = [];
  let idx = 0;

  const pairs = new Map<string, { planned?: FactSet; actual?: FactSet }>();

  for (const fact of facts) {
    const lower = fact.label.toLowerCase();
    const isTarget =
      lower.includes('target') || lower.includes('planned') || lower.includes('budget');
    const isActual =
      lower.includes('actual') || lower.includes('current') || lower.includes('completed');

    const baseLabel = fact.label
      .replace(/\b(target|planned|budget|actual|current|completed)\b/gi, '')
      .trim()
      .toLowerCase();

    if (!baseLabel) continue;

    if (!pairs.has(baseLabel)) pairs.set(baseLabel, {});
    const entry = pairs.get(baseLabel)!;

    if (isTarget) entry.planned = fact;
    else if (isActual) entry.actual = fact;
  }

  for (const [label, { planned, actual }] of pairs) {
    if (!planned || !actual) continue;
    const pVal =
      typeof planned.value === 'number' ? planned.value : parseFloat(String(planned.value));
    const aVal = typeof actual.value === 'number' ? actual.value : parseFloat(String(actual.value));
    if (isNaN(pVal) || isNaN(aVal) || pVal === 0) continue;

    const deviation = ((aVal - pVal) / Math.abs(pVal)) * 100;
    if (Math.abs(deviation) < 5) continue;

    const severity: Observation['severity'] =
      Math.abs(deviation) > 25 ? 'high' : Math.abs(deviation) > 10 ? 'medium' : 'low';

    const direction = deviation > 0 ? 'above' : 'below';

    observations.push({
      observation_id: generateObservationId(idx++),
      type: 'deviation',
      severity,
      related_facts: [planned.fact_id, actual.fact_id],
      narrative_hint: `${label} is ${Math.abs(deviation).toFixed(1)}% ${direction} plan (actual: ${aVal}, planned: ${pVal})`,
    });
  }

  return observations;
}

function detectOverdueItems(facts: FactSet[]): Observation[] {
  const observations: Observation[] = [];
  const now = new Date();
  let idx = 0;

  for (const fact of facts) {
    if (!fact.timestamp) continue;
    const d = new Date(fact.timestamp);
    if (isNaN(d.getTime())) continue;

    const lower = fact.label.toLowerCase();
    const isDueDate =
      lower.includes('due') || lower.includes('deadline') || lower.includes('target_date');

    if (isDueDate && d < now) {
      const daysOverdue = Math.ceil((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
      const severity: Observation['severity'] =
        daysOverdue > 30 ? 'high' : daysOverdue > 7 ? 'medium' : 'low';

      observations.push({
        observation_id: generateObservationId(1000 + idx++),
        type: 'overdue',
        severity,
        related_facts: [fact.fact_id],
        narrative_hint: `"${fact.label}" is ${daysOverdue} day(s) overdue (due: ${d.toISOString().slice(0, 10)})`,
      });
    }
  }

  const overdueFactIdx = facts.findIndex(
    (f) => f.label.toLowerCase() === 'overdue' && typeof f.value === 'number' && f.value > 0
  );
  if (overdueFactIdx >= 0) {
    const f = facts[overdueFactIdx];
    observations.push({
      observation_id: generateObservationId(1100 + idx++),
      type: 'overdue',
      severity: (f.value as number) > 5 ? 'high' : (f.value as number) > 2 ? 'medium' : 'low',
      related_facts: [f.fact_id],
      narrative_hint: `${f.value} overdue item(s) detected in execution tracking`,
    });
  }

  return observations;
}

function detectRisks(facts: FactSet[]): Observation[] {
  const observations: Observation[] = [];
  let idx = 0;

  for (const fact of facts) {
    if (fact.category !== 'risk') continue;
    const valStr = String(fact.value).toLowerCase();
    const severity: Observation['severity'] =
      valStr.includes('critical') || valStr.includes('high')
        ? 'high'
        : valStr.includes('medium')
          ? 'medium'
          : 'low';

    observations.push({
      observation_id: generateObservationId(2000 + idx++),
      type: 'risk',
      severity,
      related_facts: [fact.fact_id],
      narrative_hint: `Risk "${fact.label}": ${fact.value}`,
    });
  }

  return observations;
}

function detectPendingDecisions(facts: FactSet[]): Observation[] {
  const observations: Observation[] = [];
  let idx = 0;

  for (const fact of facts) {
    const lower = String(fact.value).toLowerCase();
    if (
      lower.includes('pending') ||
      lower.includes('awaiting') ||
      lower.includes('blocked') ||
      lower.includes('decision needed')
    ) {
      observations.push({
        observation_id: generateObservationId(3000 + idx++),
        type: 'pending_decision',
        severity: 'medium',
        related_facts: [fact.fact_id],
        narrative_hint: `"${fact.label}" requires a decision or action (status: ${fact.value})`,
      });
    }
  }

  return observations;
}

function detectAchievements(facts: FactSet[]): Observation[] {
  const observations: Observation[] = [];
  let idx = 0;

  for (const fact of facts) {
    const lower = String(fact.value).toLowerCase();
    if (
      lower.includes('completed') ||
      lower.includes('achieved') ||
      lower.includes('exceeded') ||
      lower.includes('done')
    ) {
      observations.push({
        observation_id: generateObservationId(4000 + idx++),
        type: 'achievement',
        severity: 'low',
        related_facts: [fact.fact_id],
        narrative_hint: `"${fact.label}" has been accomplished (${fact.value})`,
      });
    }
  }

  return observations;
}

function detectAnomalies(facts: FactSet[]): Observation[] {
  const observations: Observation[] = [];
  const numericFacts = facts.filter((f) => typeof f.value === 'number');
  let idx = 0;

  const byCat = new Map<string, number[]>();
  const byCatFacts = new Map<string, FactSet[]>();

  for (const f of numericFacts) {
    if (!byCat.has(f.category)) {
      byCat.set(f.category, []);
      byCatFacts.set(f.category, []);
    }
    byCat.get(f.category)!.push(f.value as number);
    byCatFacts.get(f.category)!.push(f);
  }

  for (const [cat, values] of byCat) {
    if (values.length < 3) continue;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    if (stdDev === 0) continue;

    const catFacts = byCatFacts.get(cat)!;
    for (let i = 0; i < values.length; i++) {
      const zScore = Math.abs((values[i] - mean) / stdDev);
      if (zScore > 2) {
        observations.push({
          observation_id: generateObservationId(5000 + idx++),
          type: 'anomaly',
          severity: zScore > 3 ? 'high' : 'medium',
          related_facts: [catFacts[i].fact_id],
          narrative_hint: `"${catFacts[i].label}" (${catFacts[i].value}) is a statistical outlier within ${cat} (z-score: ${zScore.toFixed(1)})`,
        });
      }
    }
  }

  return observations;
}

const SEVERITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };
const GOAL_TYPE_BONUS: Record<string, string[]> = {
  status_update: ['deviation', 'overdue', 'achievement'],
  strategic_review: ['trend_change', 'risk', 'pending_decision'],
  investor_report: ['deviation', 'achievement', 'anomaly'],
  risk_review: ['risk', 'deviation', 'overdue'],
  progress_report: ['overdue', 'achievement', 'deviation'],
};

function rankAndFilter(
  observations: Observation[],
  goalV3: string,
  sectionKey: string
): Observation[] {
  const goalBonusTypes = GOAL_TYPE_BONUS[goalV3] ?? [];

  const scored = observations.map((obs) => {
    let score = SEVERITY_WEIGHT[obs.severity] ?? 1;
    if (goalBonusTypes.includes(obs.type)) score += 2;
    if (obs.section_key && obs.section_key === sectionKey) score += 1;
    return { obs, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.obs);
}

/**
 * Analyse extracted facts and produce ranked observations.
 */
export function selectObservations(facts: FactSet[], config: NarrativeEngineInput): Observation[] {
  const all: Observation[] = [
    ...detectDeviations(facts),
    ...detectOverdueItems(facts),
    ...detectRisks(facts),
    ...detectPendingDecisions(facts),
    ...detectAchievements(facts),
    ...detectAnomalies(facts),
  ];

  for (const obs of all) {
    obs.section_key = config.section_key;
  }

  return rankAndFilter(all, config.report_config.goal_v3, config.section_key);
}
