/**
 * Confidence Calibration Service (Enterprise)
 *
 * Tracks AI's stated confidence levels and their accuracy over time.
 * Enables:
 * - Extract confidence scores from AI responses
 * - Track calibration (was AI right when 70% confident?)
 * - Report over/under confidence trends
 */

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface ConfidenceScore {
  section: string;
  confidence: number; // 0-100
  text: string; // Original text where confidence was found
}

export interface CalibrationRecord {
  organizationId: string;
  sessionId: string;
  section: string;
  statedConfidence: number;
  wasCorrect: boolean | null; // null = not yet evaluated
  evaluatedAt?: string | null;
}

export interface CalibrationStats {
  organizationId: string;
  period: string;
  totalPredictions: number;
  evaluatedPredictions: number;
  calibrationError: number; // Mean absolute error
  overconfident: boolean; // Avg stated > avg actual
  byConfidenceBucket: Array<{
    bucket: string; // "0-20", "20-40", etc.
    count: number;
    statedAvg: number;
    actualAccuracy: number;
  }>;
}

// ==========================================
// SERVICE
// ==========================================

/**
 * Extract confidence scores from AI response text
 */
export function extractConfidenceScores(text: string): ConfidenceScore[] {
  const scores: ConfidenceScore[] = [];
  const t = String(text || '');

  // Pattern: "X% confident", "confidence: X%", "pewność: X%", etc.
  const patterns = [
    // English patterns
    /(\d{1,3})\s*%\s*confiden/gi,
    /confidence[:\s]+(\d{1,3})\s*%/gi,
    /(\d{1,3})\s*%\s*certain/gi,
    /certainty[:\s]+(\d{1,3})\s*%/gi,
    /(\d{1,3})\s*%\s*sure/gi,
    // Polish patterns
    /(\d{1,3})\s*%\s*pewn/gi,
    /pewność[:\s]+(\d{1,3})\s*%/gi,
    /(\d{1,3})\s*%\s*prawdopodob/gi,
  ];

  // Find section context for each match
  const sections = [
    { name: 'executive_summary', needles: ['executive summary', 'podsumowanie'] },
    { name: 'problem_framing', needles: ['problem framing', 'ramy problemu'] },
    { name: 'options', needles: ['options', 'opcje'] },
    { name: 'recommendation', needles: ['recommendation', 'rekomendacja'] },
    { name: 'risks', needles: ['risks', 'ryzyka'] },
    { name: 'general', needles: [] },
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(t)) !== null) {
      const confidence = parseInt(match[1], 10);
      if (confidence < 0 || confidence > 100) continue;

      // Find surrounding context (100 chars before match)
      const start = Math.max(0, match.index - 100);
      const context = t.slice(start, match.index + match[0].length).toLowerCase();

      // Determine which section this belongs to
      let section = 'general';
      for (const sec of sections) {
        if (sec.needles.some((n) => context.includes(n))) {
          section = sec.name;
          break;
        }
      }

      scores.push({
        section,
        confidence,
        text: match[0],
      });
    }
  }

  // Deduplicate by section (keep highest confidence per section)
  const bySection = new Map<string, ConfidenceScore>();
  for (const score of scores) {
    const existing = bySection.get(score.section);
    if (!existing || score.confidence > existing.confidence) {
      bySection.set(score.section, score);
    }
  }

  return Array.from(bySection.values());
}

/**
 * Record a confidence calibration data point
 */
export async function recordCalibration(args: {
  organizationId: string;
  sessionId: string;
  section: string;
  statedConfidence: number;
  wasCorrect?: boolean | null;
}): Promise<void> {
  const { organizationId, sessionId, section, statedConfidence, wasCorrect } = args;

  try {
    // Store in deep thinking metrics with special event type
    await dbRun(
      `INSERT INTO ai_deep_thinking_metrics (
        organization_id, user_id, session_id, event_type, payload_json, created_at
      ) VALUES (?, 'system', ?, 'confidence_calibration', ?, CURRENT_TIMESTAMP)`,
      [
        organizationId,
        sessionId,
        JSON.stringify({
          section,
          statedConfidence,
          wasCorrect: wasCorrect ?? null,
          evaluatedAt:
            wasCorrect !== null && wasCorrect !== undefined ? new Date().toISOString() : null,
        }),
      ]
    );
  } catch (err: any) {
    logger.error('[ConfidenceCalibration] Failed to record:', err?.message || err);
  }
}

/**
 * Update calibration record with actual outcome
 */
export async function evaluateCalibration(args: {
  sessionId: string;
  section: string;
  wasCorrect: boolean;
}): Promise<void> {
  // Find and update the calibration record
  const rows = (await dbAll(
    `SELECT id, payload_json FROM ai_deep_thinking_metrics
     WHERE session_id = ? AND event_type = 'confidence_calibration'`,
    [args.sessionId]
  )) as any[];

  for (const row of rows) {
    const payload = row.payload_json ? JSON.parse(row.payload_json) : {};
    if (payload.section === args.section && payload.wasCorrect === null) {
      payload.wasCorrect = args.wasCorrect;
      payload.evaluatedAt = new Date().toISOString();

      await dbRun(`UPDATE ai_deep_thinking_metrics SET payload_json = ? WHERE id = ?`, [
        JSON.stringify(payload),
        row.id,
      ]);
      break;
    }
  }
}

/**
 * Get calibration statistics for an organization
 */
export async function getCalibrationStats(args: {
  organizationId: string;
  period?: '7d' | '30d' | '90d';
}): Promise<CalibrationStats> {
  const { organizationId, period = '30d' } = args;

  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const rows = (await dbAll(
    `SELECT payload_json FROM ai_deep_thinking_metrics
     WHERE organization_id = ?
       AND event_type = 'confidence_calibration'
       AND created_at >= ?`,
    [organizationId, cutoff.toISOString()]
  )) as any[];

  const records: Array<{ stated: number; wasCorrect: boolean | null }> = rows.map((r) => {
    const p = r.payload_json ? JSON.parse(r.payload_json) : {};
    return { stated: p.statedConfidence || 50, wasCorrect: p.wasCorrect };
  });

  const total = records.length;
  const evaluated = records.filter((r) => r.wasCorrect !== null);

  // Calculate calibration error (mean absolute error)
  let sumError = 0;
  let sumStated = 0;
  let sumActual = 0;

  for (const r of evaluated) {
    const actual = r.wasCorrect ? 100 : 0;
    sumError += Math.abs(r.stated - actual);
    sumStated += r.stated;
    sumActual += actual;
  }

  const calibrationError = evaluated.length > 0 ? sumError / evaluated.length : 0;
  const avgStated = evaluated.length > 0 ? sumStated / evaluated.length : 50;
  const avgActual = evaluated.length > 0 ? sumActual / evaluated.length : 50;

  // Calculate by bucket
  const buckets = ['0-20', '20-40', '40-60', '60-80', '80-100'];
  const byBucket: CalibrationStats['byConfidenceBucket'] = buckets.map((bucket) => {
    const [min, max] = bucket.split('-').map(Number);
    const inBucket = evaluated.filter(
      (r) => r.stated >= min && r.stated < (max === 100 ? 101 : max)
    );
    const count = inBucket.length;
    const statedAvg = count > 0 ? inBucket.reduce((s, r) => s + r.stated, 0) / count : 0;
    const actualAccuracy =
      count > 0 ? (inBucket.filter((r) => r.wasCorrect).length / count) * 100 : 0;

    return { bucket, count, statedAvg, actualAccuracy };
  });

  return {
    organizationId,
    period,
    totalPredictions: total,
    evaluatedPredictions: evaluated.length,
    calibrationError,
    overconfident: avgStated > avgActual,
    byConfidenceBucket: byBucket,
  };
}

/**
 * Inject confidence calibration instruction into prompt
 */
export function buildConfidencePromptAddon(language?: string): string {
  const isPolish = (language || 'en').startsWith('pl');

  if (isPolish) {
    return `
## Instrukcje dotyczące pewności
Dla każdej kluczowej rekomendacji lub prognozy, podaj swój poziom pewności jako procent (0-100%).
Przykład: "Jestem 75% pewny, że opcja A jest najlepsza."
Bądź szczerze skalibrowany - nie zawyżaj ani nie zaniżaj swojej pewności.
`;
  }

  return `
## Confidence Instructions
For each key recommendation or prediction, state your confidence level as a percentage (0-100%).
Example: "I am 75% confident that Option A is the best choice."
Be honestly calibrated - do not overstate or understate your confidence.
`;
}
