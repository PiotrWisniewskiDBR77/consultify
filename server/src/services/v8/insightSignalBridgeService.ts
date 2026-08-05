/**
 * Insight Signal Bridge Service
 *
 * L5.3 — Radar consumes insight signals
 * L7.3 — Published insights indexed in Knowledge Base
 * L7.1 — Survey linkage validation
 *
 * When an interview insight is published, this service:
 * 1. Emits radar triage signals for each finding (insight_finding signal type)
 * 2. Indexes the insight and its findings into the knowledge base
 * 3. Provides survey linkage validation for evidence pointers
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../../utils/Logger.js';
import * as queryHelpers from '../../utils/queryHelpers.js';
import type { Insight } from '../InterviewInsightService.js';
import { evaluateSourceCoverage } from './interviewConfidenceEvaluator.js';
import type { P10Finding } from './interviewInsightFindingsService.js';
import { listFindings } from './interviewInsightFindingsService.js';
import {
  createTriageSignal,
  type PrimaryDriver,
  type RadarBands,
  type RadarCategory,
  type TimeWindow,
} from './radarTriageService.js';

const LOG_PREFIX = '[InsightSignalBridge]';

// ==========================================
// L5.3 — Radar signal emission
// ==========================================

function confidenceToPriority(level: string): { bands: RadarBands; driver: PrimaryDriver } {
  const upper = String(level).toLowerCase();
  if (upper === 'high') {
    return {
      bands: { impact: 3, urgency: 2, scope: 2, confidence: 3, freshness: 3, actionability: 2 },
      driver: 'opportunity' as PrimaryDriver,
    };
  }
  if (upper === 'medium') {
    return {
      bands: { impact: 2, urgency: 1, scope: 2, confidence: 2, freshness: 3, actionability: 1 },
      driver: 'opportunity' as PrimaryDriver,
    };
  }
  return {
    bands: { impact: 1, urgency: 1, scope: 1, confidence: 1, freshness: 2, actionability: 0 },
    driver: 'opportunity' as PrimaryDriver,
  };
}

export async function emitRadarSignalsForInsight(
  insight: Insight,
  organizationId: string
): Promise<{ signalIds: string[]; errors: string[] }> {
  const signalIds: string[] = [];
  const errors: string[] = [];

  const findings = await listFindings(insight.id);
  if (findings.length === 0) {
    logger.info(`${LOG_PREFIX} No findings for insight ${insight.id}, skipping radar emission`);
    return { signalIds, errors };
  }

  for (const finding of findings) {
    try {
      const { bands, driver } = confidenceToPriority(finding.confidence_level);

      const signal = await createTriageSignal({
        organizationId,
        category: 'decision_alignment' as RadarCategory,
        bands,
        whyNow: {
          rationaleText: `Insight finding published: ${finding.finding_statement}`,
          timeWindow: 'this_week' as TimeWindow,
          primaryDriver: driver,
        },
        evidence: {
          evidencePointers: [
            { type: 'insight_finding', ref: `insight:${insight.id}` },
            { type: 'finding', ref: `finding:${finding.id}` },
            ...finding.evidence_pointers
              .filter((p) => !p.isTombstone)
              .map((p) => ({ type: p.type, ref: p.sourceRef })),
          ],
          lastObservedAt: finding.updated_at || new Date().toISOString(),
          // M03R-012: `complete` wynika z reguły `high` (rozrzut po źródłach lub
          // triangulacja), NIGDY z samej długości tablicy pointerów — poprzednie
          // `length >= 3` było trzecim, niezgodnym progiem w tym kontrakcie.
          // `clearTriangulation` celowo NIE jest przekazywane: `P10Finding` nie
          // niesie takiej flagi, a podstawienie tu `confidence_level === 'high'`
          // zamknęłoby pętlę (poziom uzasadniałby pokrycie, które go uzasadnia).
          // Pokrycie ocenia więc sam materiał dowodowy; zapisany poziom może je
          // tylko obniżyć przez sprzeczność.
          sourceCoverage: evaluateSourceCoverage({
            pointers: finding.evidence_pointers,
            unresolvedMaterialContradiction: finding.confidence_level === 'contradicted',
          }),
        },
        uncertaintyBoundary: {
          missingInputs: finding.limits ? [finding.limits] : [],
          conflicts: [],
          whatWouldChangeRanking: [],
        },
        handoffPayload: {
          signal_type: 'insight_finding',
          title: finding.finding_statement,
          confidence: finding.confidence_level,
          source: `insight:${insight.id}`,
          finding_id: finding.id,
          insight_title: insight.title,
          next_action: finding.next_action,
        },
      });

      signalIds.push(signal.signalId);
      logger.info(
        `${LOG_PREFIX} Emitted radar signal ${signal.signalId} for finding ${finding.id} (P=${signal.priorityLevel})`
      );
    } catch (err) {
      const msg = `Failed to emit radar signal for finding ${finding.id}: ${(err as Error).message}`;
      logger.warn(`${LOG_PREFIX} ${msg}`);
      errors.push(msg);
    }
  }

  return { signalIds, errors };
}

// ==========================================
// L7.3 — Knowledge Base indexing
// ==========================================

export async function indexInsightInKnowledgeBase(
  insight: Insight,
  organizationId: string
): Promise<{ docId: string | null; chunkCount: number; error?: string }> {
  try {
    const findings = await listFindings(insight.id);

    const contentParts: string[] = [
      `# Published Insight: ${insight.title}`,
      '',
      `**Type:** ${insight.promptType}`,
      `**Status:** ${insight.status}`,
      `**Published:** ${insight.publishedAt || new Date().toISOString()}`,
      `**Sessions analyzed:** ${insight.sourceSessionCount}`,
      '',
    ];

    if (insight.executiveSummary) {
      contentParts.push('## Executive Summary', '', insight.executiveSummary, '');
    }

    if (findings.length > 0) {
      contentParts.push('## Findings', '');
      for (const finding of findings) {
        contentParts.push(
          `### Finding: ${finding.finding_statement}`,
          '',
          `**Confidence:** ${finding.confidence_level}`,
          `**Limits:** ${finding.limits}`,
          `**Next action:** ${finding.next_action}`,
          `**Evidence pointers:** ${finding.evidence_pointers.filter((p) => !p.isTombstone).length}`,
          ''
        );
      }
    }

    if (insight.themes && insight.themes.length > 0) {
      contentParts.push('## Themes', '');
      for (const theme of insight.themes) {
        contentParts.push(`- **${theme.title}** (${theme.strength}): ${theme.description}`);
      }
      contentParts.push('');
    }

    if (insight.issues && insight.issues.length > 0) {
      contentParts.push('## Issues', '');
      for (const issue of insight.issues) {
        contentParts.push(`- **${issue.title}** (${issue.severity}): ${issue.description}`);
      }
      contentParts.push('');
    }

    if (insight.opportunities && insight.opportunities.length > 0) {
      contentParts.push('## Opportunities', '');
      for (const opp of insight.opportunities) {
        contentParts.push(`- **${opp.title}** (${opp.impact}): ${opp.description}`);
      }
      contentParts.push('');
    }

    const fullContent = contentParts.join('\n');
    const docId = `insight-${insight.id}`;
    const now = new Date().toISOString();

    await queryHelpers.run(
      `INSERT INTO knowledge_docs (id, filename, filepath, source_type, organization_id, chunk_count, metadata, indexed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         filename = excluded.filename,
         chunk_count = excluded.chunk_count,
         metadata = excluded.metadata,
         updated_at = excluded.updated_at`,
      [
        docId,
        `insight-${insight.id}.md`,
        `insights/${insight.id}`,
        'published_insight',
        organizationId,
        1,
        JSON.stringify({
          type: 'published_insight',
          source_kind: 'interview_insight',
          insight_id: insight.id,
          prompt_type: insight.promptType,
          finding_count: findings.length,
          session_count: insight.sourceSessionCount,
          weight: 0.9,
        }),
        now,
        now,
      ]
    );

    const chunkId = `${docId}-chunk-0`;
    await queryHelpers.run(
      `INSERT INTO knowledge_chunks (id, doc_id, chunk_index, content, embedding, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         content = excluded.content,
         metadata = excluded.metadata`,
      [
        chunkId,
        docId,
        0,
        fullContent.slice(0, 12000),
        null,
        JSON.stringify({
          type: 'published_insight',
          insight_id: insight.id,
          finding_count: findings.length,
          prompt_type: insight.promptType,
          organization_id: organizationId,
        }),
        now,
      ]
    );

    logger.info(
      `${LOG_PREFIX} Indexed insight ${insight.id} in KB as doc ${docId} (${fullContent.length} chars)`
    );

    return { docId, chunkCount: 1 };
  } catch (err) {
    const msg = `KB indexing failed for insight ${insight.id}: ${(err as Error).message}`;
    logger.warn(`${LOG_PREFIX} ${msg}`);
    return { docId: null, chunkCount: 0, error: msg };
  }
}

// ==========================================
// L7.1 — Survey linkage validation
// ==========================================

export async function validateSurveyLinkage(
  sourceRef: string
): Promise<{ valid: boolean; reason?: string }> {
  if (!sourceRef || typeof sourceRef !== 'string' || sourceRef.trim().length === 0) {
    return { valid: false, reason: 'sourceRef is required for survey_linkage' };
  }

  try {
    const survey = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM interview_sessions WHERE id = ? AND status IN ('completed', 'in_progress')`,
      [sourceRef]
    );

    if (survey) {
      return { valid: true };
    }

    const template = await queryHelpers.queryOne<{ id: string }>(
      `SELECT id FROM interview_library_templates WHERE id = ?`,
      [sourceRef]
    );

    if (template) {
      return { valid: true };
    }

    return {
      valid: false,
      reason: `Survey reference '${sourceRef}' not found in sessions or templates`,
    };
  } catch (err) {
    logger.warn(`${LOG_PREFIX} Survey linkage validation error: ${(err as Error).message}`);
    return { valid: true, reason: 'Validation skipped due to DB error (optimistic)' };
  }
}

// ==========================================
// Combined publish hook
// ==========================================

export async function onInsightPublished(
  insight: Insight,
  organizationId: string
): Promise<{
  radar: { signalIds: string[]; errors: string[] };
  kb: { docId: string | null; chunkCount: number; error?: string };
}> {
  logger.info(`${LOG_PREFIX} Processing publish hook for insight ${insight.id}`);

  const [radar, kb] = await Promise.all([
    emitRadarSignalsForInsight(insight, organizationId),
    indexInsightInKnowledgeBase(insight, organizationId),
  ]);

  logger.info(
    `${LOG_PREFIX} Publish hook complete for ${insight.id}: ` +
      `radar=${radar.signalIds.length} signals, kb=${kb.docId ? 'indexed' : 'skipped'}`
  );

  return { radar, kb };
}
