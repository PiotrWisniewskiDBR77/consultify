import { createHash } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { v4 as uuidv4 } from 'uuid';

import { queryOne, withPgTransaction } from '../../utils/queryHelpers.js';
import { exportsDir } from '../../utils/storagePaths.js';
import { renderDocumentSchemaToDocxBuffer } from '../documentStudio/documentDocxRenderer.js';
import {
  DEFAULT_CONSULTING_FORMATTING_SCHEMA,
  type DocumentSchema,
} from '../documentStudio/documentStudioTypes.js';
import {
  createNativeDeck,
  createNativeDeckVersion,
  withPresentationOwnerClient,
} from '../presentationGeneratorService.js';
import {
  deckDocumentToRenderableUnifiedJson,
  normalizeDeckDocument,
} from '../presentationDeckDocumentService.js';
import {
  createNativeReport,
  createVersion as createNativeReportVersion,
  type NativeReportSectionInput,
  withReportBuilderClient,
} from '../reportBuilderService.js';
import { PptxPipelineService } from '../report/pptx/PptxPipelineService.js';
import type { UnifiedReportJSON } from '../report/pptx/types.js';
import { withArtifactRegistryClient } from './artifactRegistryService.js';
import { TransformationCaseOperationError } from './transformationCaseService.js';
import { dispatchAgentAdapter } from './agentAdapterOrchestratorService.js';
import { loadTransformationAgentExecutionContext } from './transformationAgentExecutionContextService.js';
import {
  assertProposalExecutable,
  registerGovernedProposal,
  withProposalGovernanceClient,
} from './agentProposalGovernanceService.js';

interface FactsRow {
  transformation_case_id: string;
  organization_id: string;
  mandate: string;
  lifecycle_stage: string;
  version: number;
  lineage_id: string;
  active_plan_id: string | null;
  initiative_name: string | null;
  initiative_status: string | null;
  task_total: number;
  task_completed: number;
  milestone_total: number;
  milestone_completed: number;
  benefit_total: number;
  benefit_verified: number;
  verified_measurements: number;
  measurement_window_days: number | null;
  audit_events: number;
  finance_payload_json: unknown;
  financial_status: string | null;
  benefit_actual_annual: number | null;
  kpi_name: string | null;
  kpi_unit: string | null;
  kpi_baseline: number | null;
  kpi_target: number | null;
  kpi_actual: number | null;
  kpi_direction: string | null;
  open_recovery_count: number;
  unresolved_experiment_count: number;
  idea_facts_json: unknown;
  interview_facts_json: unknown;
  drd_fact_json: unknown;
  decision_fact_json: unknown;
}

export interface TransformationFinalOutputFacts {
  outputContractVersion: 'consultify-transformation-final-v3';
  transformationCaseId: string;
  caseVersion: number;
  lineageId: string;
  mandate: string;
  lifecycleStage: 'final_outputs';
  ideas: Array<{ title: string; body: string }>;
  interviewInsights: Array<{ title: string; content: string }>;
  drd: { name: string; status: string; completionPercent: number; acceptedSnapshot: unknown };
  portfolioDecision: { selectedOption: 'go' | 'no_go'; rationale: string };
  initiative: { name: string; status: string };
  execution: {
    tasks: { completed: number; total: number };
    milestones: { completed: number; total: number };
  };
  benefits: {
    total: number;
    verified: number;
    verifiedMeasurements: number;
    measurementWindowDays: number;
  };
  finance: {
    status: string;
    currency: string;
    capex: number;
    opexAnnual: number;
    forecastBenefitAnnual: number;
    actualBenefitAnnual: number;
    actualVsForecastPct: number;
  };
  kpi: {
    name: string;
    unit: string;
    baseline: number;
    target: number;
    actual: number;
    direction: string;
    status: 'on_target' | 'off_target';
  };
  recovery: { status: 'resolved' | 'unresolved'; openCards: number; unresolvedExperiments: number };
  evidence: { auditEvents: number; activePlanId: string };
}

/**
 * U02-A — the native owner artifacts are the canonical, editable truth; DOCX and
 * PPTX are exports of them. The manifest therefore carries the owner IDs, their
 * immutable version IDs and the artifact-registry receipts alongside the file
 * hashes, so "the report" can always be opened in Report Builder rather than
 * only downloaded.
 */
export interface TransformationFinalOutputNativeArtifacts {
  reportId: string;
  reportVersionId: string;
  reportVersionNumber: number;
  reportRegistryArtifactId: string;
  deckId: string;
  deckVersionId: string;
  deckVersionNumber: number;
  deckRegistryArtifactId: string;
}

export interface TransformationFinalOutputRun {
  runId: string;
  transformationCaseId: string;
  caseVersion: number;
  factsDigest: string;
  docxPath: string;
  docxSha256: string;
  pptxPath: string;
  pptxSha256: string;
  generatedAt: string;
  idempotentReplay: boolean;
  /** Null only for manifests written before the U02 migration. */
  native: TransformationFinalOutputNativeArtifacts | null;
}

export interface FinalOutputPublicationProposal {
  publicationMappingId: string;
  proposalVersionId: string;
  transformationCaseId: string;
  caseVersion: number;
  factsDigest: string;
  scopeKey: 'final_outputs.publish';
  status: string;
}

/**
 * The accountable human is the actor; the agent identity is fixed and never
 * stands in for a human approval.
 */
const AGENT_IDENTITY = 'consultify:teresa:transformation-agent';

const digest = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');

const finalOutputContextDigest = (caseId: string, snapshotId: string | null): string =>
  digest(JSON.stringify({ snapshotId, transformationCaseId: caseId }));

export function stableFactsJson(facts: TransformationFinalOutputFacts): string {
  return JSON.stringify(facts);
}

async function loadFacts(
  caseId: string,
  organizationId: string
): Promise<TransformationFinalOutputFacts> {
  const row = await queryOne<FactsRow>(
    `SELECT c.transformation_case_id,c.organization_id,c.mandate,c.lifecycle_stage,c.version,c.lineage_id,c.active_plan_id,
            i.name initiative_name,i.status initiative_status,
            COUNT(DISTINCT t.id)::int task_total,
            COUNT(DISTINCT t.id) FILTER (WHERE UPPER(t.status) IN ('DONE','COMPLETED'))::int task_completed,
            COUNT(DISTINCT m.id)::int milestone_total,
            COUNT(DISTINCT m.id) FILTER (WHERE UPPER(m.status)='COMPLETED')::int milestone_completed,
            COUNT(DISTINCT b.id)::int benefit_total,
            COUNT(DISTINCT b.id) FILTER (WHERE LOWER(b.status) IN ('achieved','exceeded'))::int benefit_verified,
            COUNT(DISTINCT bm.id) FILTER (WHERE bm.is_verified=TRUE)::int verified_measurements,
            (MAX(bm.measured_at) FILTER (WHERE bm.is_verified=TRUE)-MIN(bm.measured_at) FILTER (WHERE bm.is_verified=TRUE))::int measurement_window_days,
            (SELECT COUNT(*)::int FROM transformation_case_audit_events ae WHERE ae.transformation_case_id=c.transformation_case_id AND ae.organization_id=c.organization_id AND ae.event_type<>'transformation_final_outputs.generated') audit_events,
            (SELECT sp.payload_json FROM transformation_stage_proposals sp WHERE sp.transformation_case_id=c.transformation_case_id AND sp.organization_id=c.organization_id AND sp.proposal_type='create_finance_kpi_pack' ORDER BY sp.created_at DESC LIMIT 1) finance_payload_json,
            (SELECT fa.status FROM transformation_case_artifact_links lf JOIN financial_analyses fa ON fa.id=lf.artifact_id AND fa.organization_id=lf.organization_id WHERE lf.transformation_case_id=c.transformation_case_id AND lf.organization_id=c.organization_id AND lf.artifact_type='financial_analysis' LIMIT 1) financial_status,
            MAX(b.actual_annual_value)::float benefit_actual_annual,
            (SELECT k.name FROM transformation_case_artifact_links lk JOIN initiative_kpis k ON k.id=lk.artifact_id AND k.organization_id=lk.organization_id WHERE lk.transformation_case_id=c.transformation_case_id AND lk.organization_id=c.organization_id AND lk.artifact_type='initiative_kpi' LIMIT 1) kpi_name,
            (SELECT k.unit FROM transformation_case_artifact_links lk JOIN initiative_kpis k ON k.id=lk.artifact_id AND k.organization_id=lk.organization_id WHERE lk.transformation_case_id=c.transformation_case_id AND lk.organization_id=c.organization_id AND lk.artifact_type='initiative_kpi' LIMIT 1) kpi_unit,
            (SELECT k.baseline_value FROM transformation_case_artifact_links lk JOIN initiative_kpis k ON k.id=lk.artifact_id AND k.organization_id=lk.organization_id WHERE lk.transformation_case_id=c.transformation_case_id AND lk.organization_id=c.organization_id AND lk.artifact_type='initiative_kpi' LIMIT 1) kpi_baseline,
            (SELECT k.target_value FROM transformation_case_artifact_links lk JOIN initiative_kpis k ON k.id=lk.artifact_id AND k.organization_id=lk.organization_id WHERE lk.transformation_case_id=c.transformation_case_id AND lk.organization_id=c.organization_id AND lk.artifact_type='initiative_kpi' LIMIT 1) kpi_target,
            (SELECT k.current_value FROM transformation_case_artifact_links lk JOIN initiative_kpis k ON k.id=lk.artifact_id AND k.organization_id=lk.organization_id WHERE lk.transformation_case_id=c.transformation_case_id AND lk.organization_id=c.organization_id AND lk.artifact_type='initiative_kpi' LIMIT 1) kpi_actual,
            (SELECT k.direction FROM transformation_case_artifact_links lk JOIN initiative_kpis k ON k.id=lk.artifact_id AND k.organization_id=lk.organization_id WHERE lk.transformation_case_id=c.transformation_case_id AND lk.organization_id=c.organization_id AND lk.artifact_type='initiative_kpi' LIMIT 1) kpi_direction,
            (SELECT COUNT(DISTINCT rc.id)::int FROM transformation_case_artifact_links lk JOIN kpi_recovery_cards rc ON rc.kpi_id=lk.artifact_id AND rc.organization_id=lk.organization_id WHERE lk.transformation_case_id=c.transformation_case_id AND lk.organization_id=c.organization_id AND lk.artifact_type='initiative_kpi' AND rc.lifecycle_status<>'CLOSED') open_recovery_count,
            (SELECT COUNT(DISTINCT ex.id)::int FROM transformation_case_artifact_links lk JOIN kpi_recovery_cards rc ON rc.kpi_id=lk.artifact_id AND rc.organization_id=lk.organization_id JOIN kpi_recovery_experiments ex ON ex.recovery_card_id=rc.id AND ex.organization_id=rc.organization_id WHERE lk.transformation_case_id=c.transformation_case_id AND lk.organization_id=c.organization_id AND lk.artifact_type='initiative_kpi' AND ex.verdict IS NULL) unresolved_experiment_count
            ,(SELECT COALESCE(jsonb_agg(jsonb_build_object('title',mi.title,'body',COALESCE(mi.body,'')) ORDER BY mi.title),'[]'::jsonb) FROM transformation_case_artifact_links l JOIN my_ideas mi ON mi.id=l.artifact_id AND mi.organization_id=l.organization_id WHERE l.transformation_case_id=c.transformation_case_id AND l.organization_id=c.organization_id AND l.artifact_type='my_idea') idea_facts_json
            ,(SELECT COALESCE(jsonb_agg(jsonb_build_object('title',ii.title,'content',COALESCE(ii.content,'')) ORDER BY ii.title),'[]'::jsonb) FROM transformation_case_artifact_links l JOIN interview_insights ii ON ii.id=l.artifact_id AND ii.organization_id=l.organization_id WHERE l.transformation_case_id=c.transformation_case_id AND l.organization_id=c.organization_id AND l.artifact_type='interview_insight') interview_facts_json
            ,(SELECT jsonb_build_object('name',a.name,'status',COALESCE(a.status,'UNKNOWN'),'completionPercent',COALESCE(a.completion_percent,0),'acceptedSnapshot',s.snapshot_json) FROM transformation_case_artifact_links l JOIN assessments a ON a.id=l.artifact_id AND a.organization_id=l.organization_id LEFT JOIN assessment_accepted_snapshots s ON s.assessment_id=a.id AND s.organization_id=a.organization_id AND s.is_current=TRUE WHERE l.transformation_case_id=c.transformation_case_id AND l.organization_id=c.organization_id AND l.artifact_type='drd_assessment' LIMIT 1) drd_fact_json
            ,(SELECT jsonb_build_object('selectedOption',r.selected_option,'rationale',r.rationale) FROM transformation_portfolio_decision_receipts r WHERE r.transformation_case_id=c.transformation_case_id AND r.organization_id=c.organization_id ORDER BY r.created_at DESC LIMIT 1) decision_fact_json
       FROM transformation_cases c
       LEFT JOIN transformation_case_artifact_links li ON li.transformation_case_id=c.transformation_case_id AND li.organization_id=c.organization_id AND li.artifact_type='initiative'
       LEFT JOIN initiatives i ON i.id=li.artifact_id AND i.organization_id=li.organization_id
       LEFT JOIN tasks t ON t.initiative_id=i.id
       LEFT JOIN initiative_milestones m ON m.initiative_id=i.id
       LEFT JOIN transformation_case_artifact_links lb ON lb.transformation_case_id=c.transformation_case_id AND lb.organization_id=c.organization_id AND lb.artifact_type='initiative_benefit'
       LEFT JOIN initiative_benefits b ON b.id=lb.artifact_id AND b.organization_id=lb.organization_id
       LEFT JOIN benefit_measurements bm ON bm.benefit_id=b.id
      WHERE c.transformation_case_id=? AND c.organization_id=?
      GROUP BY c.transformation_case_id,c.organization_id,c.mandate,c.lifecycle_stage,c.version,c.lineage_id,c.active_plan_id,i.name,i.status`,
    [caseId, organizationId]
  );
  if (!row)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_CASE_NOT_FOUND',
      404,
      'Transformation Case not found'
    );
  if (row.lifecycle_stage !== 'final_outputs')
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_FINAL_OUTPUTS_NOT_READY',
      409,
      'Sustained value must be accepted before final outputs'
    );
  const hasOpenRecovery = Number(row.open_recovery_count ?? 0) > 0;
  const ideas = Array.isArray(row.idea_facts_json) ? row.idea_facts_json : [];
  const interviewInsights = Array.isArray(row.interview_facts_json)
    ? row.interview_facts_json
    : [];
  const drd = row.drd_fact_json as Record<string, unknown> | null;
  const portfolioDecision = row.decision_fact_json as Record<string, unknown> | null;
  if (
    !row.active_plan_id ||
    !row.initiative_name ||
    ideas.length < 1 ||
    interviewInsights.length < 1 ||
    !drd ||
    !portfolioDecision ||
    Number(row.benefit_total) < 1 ||
    (!hasOpenRecovery &&
      (Number(row.verified_measurements) < 2 || Number(row.measurement_window_days ?? 0) < 30))
  )
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_FINAL_OUTPUTS_EVIDENCE_INCOMPLETE',
      409,
      'Final outputs require an approved plan, linked initiative and sustained benefit evidence'
    );
  const financePayload =
    typeof row.finance_payload_json === 'string'
      ? JSON.parse(row.finance_payload_json)
      : (row.finance_payload_json as any);
  const forecastBenefitAnnual = Number(financePayload?.economics?.benefitAnnual ?? 0);
  const actualBenefitAnnual = Number(row.benefit_actual_annual ?? 0);
  const kpiActual = Number(row.kpi_actual ?? 0);
  const kpiTarget = Number(row.kpi_target ?? 0);
  const kpiDirection = row.kpi_direction ?? 'HIGHER_IS_BETTER';
  const kpiOnTarget =
    kpiDirection === 'LOWER_IS_BETTER' ? kpiActual <= kpiTarget : kpiActual >= kpiTarget;
  return {
    outputContractVersion: 'consultify-transformation-final-v3',
    transformationCaseId: row.transformation_case_id,
    caseVersion: Number(row.version),
    lineageId: row.lineage_id,
    mandate: row.mandate,
    lifecycleStage: 'final_outputs',
    ideas: ideas.map((idea: any) => ({ title: String(idea.title), body: String(idea.body) })),
    interviewInsights: interviewInsights.map((insight: any) => ({
      title: String(insight.title),
      content: String(insight.content),
    })),
    drd: {
      name: String(drd!.name),
      status: String(drd!.status),
      completionPercent: Number(drd!.completionPercent),
      acceptedSnapshot: drd!.acceptedSnapshot,
    },
    portfolioDecision: {
      selectedOption: String(portfolioDecision!.selectedOption) as 'go' | 'no_go',
      rationale: String(portfolioDecision!.rationale),
    },
    initiative: { name: row.initiative_name, status: row.initiative_status ?? 'UNKNOWN' },
    execution: {
      tasks: { completed: Number(row.task_completed), total: Number(row.task_total) },
      milestones: {
        completed: Number(row.milestone_completed),
        total: Number(row.milestone_total),
      },
    },
    benefits: {
      total: Number(row.benefit_total),
      verified: Number(row.benefit_verified),
      verifiedMeasurements: Number(row.verified_measurements),
      measurementWindowDays: Number(row.measurement_window_days ?? 0),
    },
    finance: {
      status: row.financial_status ?? 'UNKNOWN',
      currency: String(financePayload?.economics?.currency ?? 'PLN'),
      capex: Number(financePayload?.economics?.capex ?? 0),
      opexAnnual: Number(financePayload?.economics?.opexAnnual ?? 0),
      forecastBenefitAnnual,
      actualBenefitAnnual,
      actualVsForecastPct:
        forecastBenefitAnnual > 0
          ? Math.round((actualBenefitAnnual / forecastBenefitAnnual) * 1000) / 10
          : 0,
    },
    kpi: {
      name: row.kpi_name ?? 'KPI',
      unit: row.kpi_unit ?? '',
      baseline: Number(row.kpi_baseline ?? 0),
      target: kpiTarget,
      actual: kpiActual,
      direction: kpiDirection,
      status: kpiOnTarget ? 'on_target' : 'off_target',
    },
    recovery: {
      status: hasOpenRecovery ? 'unresolved' : 'resolved',
      openCards: Number(row.open_recovery_count ?? 0),
      unresolvedExperiments: Number(row.unresolved_experiment_count ?? 0),
    },
    evidence: { auditEvents: Number(row.audit_events), activePlanId: row.active_plan_id },
  };
}

export function buildFinalDocument(
  facts: TransformationFinalOutputFacts,
  factsDigest: string,
  now: string
): DocumentSchema {
  const initiativeStatusPl =
    facts.initiative.status === 'DONE' ? 'ZAKOŃCZONA' : facts.initiative.status;
  const financeStatusPl =
    facts.finance.status.toUpperCase() === 'APPROVED' ? 'ZATWIERDZONA' : facts.finance.status;
  const drdStatusPl =
    facts.drd.status.toUpperCase() === 'APPROVED' ? 'ZATWIERDZONE' : facts.drd.status;
  const kpiDirectionPl =
    facts.kpi.direction === 'LOWER_IS_BETTER'
      ? 'MNIEJ ZNACZY LEPIEJ'
      : facts.kpi.direction === 'HIGHER_IS_BETTER'
        ? 'WIĘCEJ ZNACZY LEPIEJ'
        : facts.kpi.direction;
  const kpiUnitPl = facts.kpi.unit === 'days' ? 'dni' : facts.kpi.unit;
  const sourceRef = {
    sourceType: 'transformation_case',
    sourceId: facts.transformationCaseId,
    sourceVersion: factsDigest,
  };
  const section = (title: string, paragraphs: string[], orderIndex: number) => ({
    sectionId: `section-${orderIndex + 1}`,
    orderIndex,
    level: 1 as const,
    title,
    blocks: paragraphs.map((text, index) => ({
      blockId: `s${orderIndex + 1}-b${index + 1}`,
      type: 'paragraph' as const,
      content: { text },
      sourceRef,
    })),
    sourceRefs: [sourceRef],
  });
  return {
    documentId: `doc-${factsDigest.slice(0, 16)}`,
    artifactId: `artifact-${factsDigest.slice(0, 16)}`,
    title: `Raport końcowy transformacji — ${facts.transformationCaseId}`,
    documentType: 'steering_committee_report',
    language: 'pl',
    audience: ['steering_committee'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'detailed',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: DEFAULT_CONSULTING_FORMATTING_SCHEMA,
    sections: [
      section(
        'Podsumowanie zarządcze',
        [facts.mandate, `Inicjatywa: ${facts.initiative.name} (${initiativeStatusPl}).`],
        0
      ),
      section(
        'Idee',
        facts.ideas.map((idea) => `${idea.title}: ${idea.body || 'UNKNOWN'}.`),
        1
      ),
      section(
        'Ustalenia Interview',
        facts.interviewInsights.map(
          (insight) => `${insight.title}: ${insight.content || 'UNKNOWN'}.`
        ),
        2
      ),
      section(
        'DRD — zatwierdzony wynik',
        [
          `${facts.drd.name}: status ${drdStatusPl}; kompletność ${facts.drd.completionPercent}%.`,
          `Zatwierdzony snapshot: ${JSON.stringify(facts.drd.acceptedSnapshot)}.`,
        ],
        3
      ),
      section(
        'Decyzja portfelowa',
        [
          `Autoryzowana decyzja: ${facts.portfolioDecision.selectedOption.toUpperCase()}.`,
          `Uzasadnienie: ${facts.portfolioDecision.rationale}.`,
        ],
        4
      ),
      section(
        'Realizacja',
        [
          `Zadania: ${facts.execution.tasks.completed}/${facts.execution.tasks.total}.`,
          `Kamienie milowe: ${facts.execution.milestones.completed}/${facts.execution.milestones.total}.`,
        ],
        5
      ),
      section(
        'Korzyści i trwałość',
        [
          `Potwierdzone korzyści: ${facts.benefits.verified}/${facts.benefits.total}.`,
          `Zweryfikowane pomiary: ${facts.benefits.verifiedMeasurements}; okno: ${facts.benefits.measurementWindowDays} dni.`,
        ],
        6
      ),
      section(
        'Analiza finansowa',
        [
          `Status analizy: ${financeStatusPl}. CAPEX: ${facts.finance.capex.toLocaleString('pl-PL')} ${facts.finance.currency}; roczny OPEX: ${facts.finance.opexAnnual.toLocaleString('pl-PL')} ${facts.finance.currency}.`,
          `Roczna korzyść: plan ${facts.finance.forecastBenefitAnnual.toLocaleString('pl-PL')} ${facts.finance.currency}; wynik ${facts.finance.actualBenefitAnnual.toLocaleString('pl-PL')} ${facts.finance.currency}, czyli ${facts.finance.actualVsForecastPct}% planu.`,
        ],
        7
      ),
      section(
        'Karta KPI',
        [
          `${facts.kpi.name}: wartość bazowa ${facts.kpi.baseline} ${kpiUnitPl}; cel ${facts.kpi.target} ${kpiUnitPl}; wynik ${facts.kpi.actual} ${kpiUnitPl}.`,
          `Kierunek: ${kpiDirectionPl}; ocena: ${facts.kpi.status === 'on_target' ? 'cel osiągnięty' : 'cel nieosiągnięty'}.`,
        ],
        8
      ),
      section(
        'Otwarte działania naprawcze',
        [
          facts.recovery.status === 'unresolved'
            ? `Wynik nie jest potwierdzonym sukcesem: ${facts.recovery.openCards} aktywnych Recovery Card i ${facts.recovery.unresolvedExperiments} nierozstrzygniętych eksperymentów pozostaje otwartych.`
            : 'Brak otwartych Recovery Card.',
        ],
        9
      ),
      section(
        'Lineage i dowody',
        [
          `Lineage: ${facts.lineageId}.`,
          `Zdarzenia audytowe: ${facts.evidence.auditEvents}. Digest faktów: ${factsDigest}.`,
        ],
        10
      ),
    ],
    sourceRefs: [sourceRef],
    createdAt: now,
    updatedAt: now,
    documentStatus: 'approved',
  };
}

export function buildFinalDeck(
  facts: TransformationFinalOutputFacts,
  factsDigest: string,
  now: string
): UnifiedReportJSON {
  const financeStatusPl =
    facts.finance.status.toUpperCase() === 'APPROVED' ? 'ZATWIERDZONA' : facts.finance.status;
  const drdStatusPl =
    facts.drd.status.toUpperCase() === 'APPROVED' ? 'ZATWIERDZONE' : facts.drd.status;
  const kpiDirectionPl =
    facts.kpi.direction === 'LOWER_IS_BETTER'
      ? 'MNIEJ ZNACZY LEPIEJ'
      : facts.kpi.direction === 'HIGHER_IS_BETTER'
        ? 'WIĘCEJ ZNACZY LEPIEJ'
        : facts.kpi.direction;
  const kpiStatusPl = facts.kpi.status === 'on_target' ? 'cel osiągnięty' : 'poza celem';
  const kpiUnitPl = facts.kpi.unit === 'days' ? 'dni' : facts.kpi.unit;
  return {
    meta: {
      client: 'Consultify client',
      project: `Transformacja ${facts.transformationCaseId}`,
      date: now.slice(0, 10),
      author: 'Teresa + Consultify Agent',
      confidentiality: 'confidential',
      language: 'pl',
      sourceType: 'Transformation Case',
    },
    slides: [
      {
        intent: 'cover',
        key_message:
          facts.recovery.status === 'unresolved'
            ? 'Realizacja zakończona z jawnym otwartym recovery'
            : 'Od mandatu do trwałej wartości',
        content: {
          type: 'cover',
          title:
            facts.recovery.status === 'unresolved'
              ? 'Transformacja — recovery w toku'
              : 'Transformacja zakończona',
          subtitle: facts.mandate,
          organization: 'Consultify',
          date: now.slice(0, 10),
          confidentiality: 'Poufne',
        },
      },
      {
        intent: 'executive_summary',
        key_message: 'Agent dowiózł proces, nie tylko dokument',
        content: {
          type: 'executive_summary',
          headline: facts.initiative.name,
          key_findings: [
            `Zadania ${facts.execution.tasks.completed}/${facts.execution.tasks.total}`,
            `Kamienie milowe ${facts.execution.milestones.completed}/${facts.execution.milestones.total}`,
            `Korzyści ${facts.benefits.verified}/${facts.benefits.total}`,
          ],
          recommendation:
            facts.recovery.status === 'unresolved'
              ? `Nie deklarować sukcesu; domknąć ${facts.recovery.openCards} Recovery Card.`
              : 'Utrzymać monitoring korzyści.',
        },
      },
      {
        intent: 'executive_summary',
        key_message: 'Idee zostały zapisane w kanonicznym module Ideas',
        content: {
          type: 'executive_summary',
          headline: 'Idee transformacyjne',
          key_findings: facts.ideas.map((idea) => `${idea.title}: ${idea.body || 'UNKNOWN'}`),
          recommendation: 'Utrzymać lineage idei do Case i zaakceptowanej inicjatywy.',
        },
      },
      {
        intent: 'executive_summary',
        key_message: 'Ustalenia Interview wróciły do tego samego Case',
        content: {
          type: 'executive_summary',
          headline: 'Zweryfikowane ustalenia Interview',
          key_findings: facts.interviewInsights.map(
            (insight) => `${insight.title}: ${insight.content || 'UNKNOWN'}`
          ),
          recommendation: 'Traktować wyłącznie zatwierdzone insighty jako podstawę DRD.',
        },
      },
      {
        intent: 'comparison',
        key_message: `DRD zatwierdzone z kompletnością ${facts.drd.completionPercent}%`,
        content: {
          type: 'comparison',
          left_label: 'DRD',
          right_label: 'Decyzja portfelowa',
          left_items: [
            facts.drd.name,
            `Status: ${drdStatusPl}`,
            `Kompletność: ${facts.drd.completionPercent}%`,
          ],
          right_items: [
            `Wynik: ${facts.portfolioDecision.selectedOption.toUpperCase()}`,
            facts.portfolioDecision.rationale,
          ],
          verdict: 'Decyzja opiera się na zatwierdzonym pakiecie dowodowym.',
        },
      },
      {
        intent: 'roadmap',
        key_message: 'Jeden Case zachował ciągłość od odkrycia do trwałej wartości',
        content: {
          type: 'roadmap',
          phases: [
            {
              label: 'Odkrywanie',
              timeframe: 'Etapy 1–4',
              items: ['Mandat', 'Pomysły', 'Wywiady', 'DRD'],
              status: 'completed',
            },
            {
              label: 'Decyzja',
              timeframe: 'Etapy 5–8',
              items: ['Synteza', 'Inicjatywa', 'Finanse/KPI', 'GO'],
              status: 'completed',
            },
            {
              label: 'Dostarczenie',
              timeframe: 'Etapy 9–14',
              items: ['Mobilizacja', 'Wykonanie', 'Korzyści', 'Trwałość'],
              status: 'completed',
            },
          ],
        },
      },
      {
        intent: 'performance_overview',
        key_message:
          facts.recovery.status === 'unresolved'
            ? 'Inicjatywa zakończona, wynik pozostaje nierozstrzygnięty'
            : 'Realizacja została zakończona i odebrana',
        content: {
          type: 'performance_overview',
          kpis: [
            {
              name: 'Zadania',
              value: `${facts.execution.tasks.completed}/${facts.execution.tasks.total}`,
              status: facts.recovery.status === 'unresolved' ? 'warning' : 'good',
            },
            {
              name: 'Kamienie milowe',
              value: `${facts.execution.milestones.completed}/${facts.execution.milestones.total}`,
              status: 'good',
            },
            {
              name: 'Korzyści',
              value: `${facts.benefits.verified}/${facts.benefits.total}`,
              status: 'good',
            },
          ],
          period: 'Stan końcowy',
          context: facts.initiative.name,
        },
      },
      {
        intent: 'comparison',
        key_message: `Korzyść roczna osiągnęła ${facts.finance.actualVsForecastPct}% prognozy`,
        content: {
          type: 'comparison',
          left_label: 'Plan finansowy',
          right_label: 'Wynik zweryfikowany',
          left_items: [
            `CAPEX: ${facts.finance.capex.toLocaleString('pl-PL')} ${facts.finance.currency}`,
            `OPEX roczny: ${facts.finance.opexAnnual.toLocaleString('pl-PL')} ${facts.finance.currency}`,
            `Korzyść roczna: ${facts.finance.forecastBenefitAnnual.toLocaleString('pl-PL')} ${facts.finance.currency}`,
          ],
          right_items: [
            `Wynik rzeczywisty: ${facts.finance.actualBenefitAnnual.toLocaleString('pl-PL')} ${facts.finance.currency}`,
            `Realizacja planu: ${facts.finance.actualVsForecastPct}%`,
            `Status analizy: ${financeStatusPl}`,
          ],
          verdict:
            'Wartość została oparta na wyniku rzeczywistym, nie tylko na statusie zakończenia.',
        },
      },
      {
        intent: 'comparison',
        key_message:
          facts.recovery.status === 'unresolved'
            ? `${facts.kpi.name}: wynik wymaga dalszego recovery`
            : `${facts.kpi.name} osiągnął cel i utrzymał wynik przez ${facts.benefits.measurementWindowDays} dni`,
        content: {
          type: 'comparison',
          left_label: 'Definicja KPI',
          right_label: 'Wynik',
          left_items: [
            `Baza: ${facts.kpi.baseline} ${kpiUnitPl}`,
            `Cel: ${facts.kpi.target} ${kpiUnitPl}`,
            kpiDirectionPl.charAt(0) + kpiDirectionPl.slice(1).toLowerCase(),
          ],
          right_items: [
            `${facts.kpi.actual} ${kpiUnitPl}`,
            kpiStatusPl.charAt(0).toUpperCase() + kpiStatusPl.slice(1),
            `${facts.benefits.verifiedMeasurements} zweryfikowane pomiary`,
          ],
          verdict:
            facts.recovery.status === 'unresolved'
              ? `Niepotwierdzona trwałość: ${facts.recovery.openCards} aktywnych Recovery Card.`
              : `Trwałość potwierdzona w niezależnym oknie ${facts.benefits.measurementWindowDays} dni.`,
        },
      },
      {
        intent: 'appendix',
        key_message: 'Każdy wynik ma wspólną podstawę faktów',
        content: {
          type: 'appendix',
          title: 'Manifest dowodowy',
          body: `Case v${facts.caseVersion}; plan ${facts.evidence.activePlanId}; facts SHA-256 ${factsDigest}.`,
        },
      },
    ],
  };
}

function mapNative(row: Record<string, unknown>): TransformationFinalOutputNativeArtifacts | null {
  if (!row.native_report_id || !row.native_deck_id) return null;
  return {
    reportId: String(row.native_report_id),
    reportVersionId: String(row.native_report_version_id),
    reportVersionNumber: Number(row.native_report_version_number),
    reportRegistryArtifactId: String(row.report_registry_artifact_id),
    deckId: String(row.native_deck_id),
    deckVersionId: String(row.native_deck_version_id),
    deckVersionNumber: Number(row.native_deck_version_number),
    deckRegistryArtifactId: String(row.deck_registry_artifact_id),
  };
}

function mapRun(row: Record<string, unknown>, replay: boolean): TransformationFinalOutputRun {
  return {
    runId: String(row.run_id),
    transformationCaseId: String(row.transformation_case_id),
    caseVersion: Number(row.case_version),
    factsDigest: String(row.facts_digest),
    docxPath: String(row.docx_path),
    docxSha256: String(row.docx_sha256),
    pptxPath: String(row.pptx_path),
    pptxSha256: String(row.pptx_sha256),
    generatedAt: String(row.generated_at),
    idempotentReplay: replay,
    native: mapNative(row),
  };
}

// ==========================================
// U02 — NATIVE OWNER PROJECTIONS
// ==========================================

/**
 * Project the deterministic final document into Report Builder sections.
 *
 * Each DocumentSchema section becomes one `report_builder_sections` row whose
 * `generated_content` is markdown. Paragraphs are joined by a blank line, and
 * only line breaks and tabs inside a paragraph are flattened, so the round trip
 * (sections → markdown → sections) can never re-split a paragraph wrongly.
 *
 * The flattening deliberately does NOT touch other whitespace: Polish number
 * formatting (`toLocaleString('pl-PL')`) uses NON-BREAKING spaces as thousands
 * separators, and collapsing `\s+` silently rewrote every figure in the report.
 */
export function nativeReportSectionsFromDocument(
  document: DocumentSchema
): NativeReportSectionInput[] {
  return document.sections.map((section, index) => ({
    sectionKey: String(section.sectionId ?? `section-${index + 1}`),
    sectionType: index === 0 ? ('summary' as const) : ('custom' as const),
    title: String(section.title ?? ''),
    orderIndex: index,
    required: true,
    renderKind: 'markdown',
    content: (section.blocks ?? [])
      .map((block) =>
        String((block.content as { text?: unknown } | undefined)?.text ?? '')
          .replace(/[\r\n\t]+/g, ' ')
          .trim()
      )
      .filter((text) => text.length > 0)
      .join('\n\n'),
  }));
}

/**
 * Rebuild the DOCX render model from the PERSISTED native report rows.
 *
 * This is what makes DOCX an export rather than a parallel truth: the bytes
 * come from what Report Builder actually stores, so a consultant editing a
 * section changes the next export — while the facts snapshot, its digest and
 * the deck stay untouched.
 */
export function documentSchemaFromNativeReport(params: {
  title: string;
  factsDigest: string;
  transformationCaseId: string;
  createdAt: string;
  updatedAt: string;
  sections: Array<{ section_key: string; title: string; generated_content: string | null }>;
}): DocumentSchema {
  const sourceRef = {
    sourceType: 'transformation_case',
    sourceId: params.transformationCaseId,
    sourceVersion: params.factsDigest,
  };
  return {
    documentId: `doc-${params.factsDigest.slice(0, 16)}`,
    artifactId: `artifact-${params.factsDigest.slice(0, 16)}`,
    title: params.title,
    documentType: 'steering_committee_report',
    language: 'pl',
    audience: ['steering_committee'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'detailed',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    formattingSchema: DEFAULT_CONSULTING_FORMATTING_SCHEMA,
    sections: params.sections.map((row, orderIndex) => ({
      sectionId: row.section_key,
      orderIndex,
      level: 1 as const,
      title: row.title,
      blocks: String(row.generated_content ?? '')
        .split('\n\n')
        .map((text) => text.trim())
        .filter((text) => text.length > 0)
        .map((text, index) => ({
          blockId: `s${orderIndex + 1}-b${index + 1}`,
          type: 'paragraph' as const,
          content: { text },
          sourceRef,
        })),
      sourceRefs: [sourceRef],
    })),
    sourceRefs: [sourceRef],
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    documentStatus: 'approved',
  };
}

export async function prepareFinalOutputPublication(params: {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<FinalOutputPublicationProposal> {
  const facts = await loadFacts(params.transformationCaseId, params.organizationId);
  const factsDigest = digest(stableFactsJson(facts));
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<{
        version: number;
        active_plan_id: string;
        context_snapshot_id: string | null;
        execution_run_id: string | null;
        initiated_by_user_id: string;
      }>(
        `SELECT version,active_plan_id,context_snapshot_id,execution_run_id,initiated_by_user_id
           FROM transformation_cases
          WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!current)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_NOT_FOUND',
        404,
        'Transformation Case not found'
      );
    if (Number(current.version) !== facts.caseVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_CASE_VERSION_CONFLICT',
        409,
        'Transformation Case changed while final output facts were prepared'
      );
    const existing = (
      await client.query<Record<string, unknown>>(
        `SELECT * FROM transformation_final_output_governance
          WHERE transformation_case_id=? AND organization_id=? AND facts_digest=?`,
        [params.transformationCaseId, params.organizationId, factsDigest]
      )
    ).rows[0];
    if (existing)
      return {
        publicationMappingId: String(existing.publication_mapping_id),
        proposalVersionId: String(existing.governed_proposal_version_id),
        transformationCaseId: params.transformationCaseId,
        caseVersion: Number(existing.source_case_version),
        factsDigest,
        scopeKey: 'final_outputs.publish',
        status: String(existing.status),
      };
    const plan = (
      await client.query<{ version: number }>(
        `SELECT version FROM transformation_plans
          WHERE plan_id=? AND transformation_case_id=? AND organization_id=?`,
        [current.active_plan_id, params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    if (!plan) throw new Error('final_output_active_plan_not_found');
    const governed = await withProposalGovernanceClient(client, () =>
      registerGovernedProposal({
        proposalId: `final-output:${params.transformationCaseId}:${factsDigest}`,
        organizationId: params.organizationId,
        canonicalRunId:
          current.execution_run_id ?? `transformation-case:${params.transformationCaseId}`,
        planVersion: Number(plan.version),
        contextDigest: finalOutputContextDigest(
          params.transformationCaseId,
          current.context_snapshot_id
        ),
        before: { published: false, caseVersion: facts.caseVersion },
        after: { published: true, factsDigest, outputContractVersion: facts.outputContractVersion },
        approvalScopes: ['final_outputs.publish'],
        reviewerAuthorityByScope: {
          'final_outputs.publish': [current.initiated_by_user_id],
        },
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        actorUserId: params.actorUserId,
        changeReason: 'Final output publication approval',
      })
    );
    const publicationMappingId = uuidv4();
    await client.query(
      `INSERT INTO transformation_final_output_governance
       (publication_mapping_id,transformation_case_id,organization_id,source_case_version,facts_digest,governed_proposal_version_id,status)
       VALUES (?,?,?,?,?,?,'pending')`,
      [
        publicationMappingId,
        params.transformationCaseId,
        params.organizationId,
        facts.caseVersion,
        factsDigest,
        governed.proposalVersionId,
      ]
    );
    return {
      publicationMappingId,
      proposalVersionId: governed.proposalVersionId,
      transformationCaseId: params.transformationCaseId,
      caseVersion: facts.caseVersion,
      factsDigest,
      scopeKey: 'final_outputs.publish',
      status: 'pending',
    };
  });
}

async function generateFinalOutputsInner(params: {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
}): Promise<TransformationFinalOutputRun> {
  const facts = await loadFacts(params.transformationCaseId, params.organizationId);
  const factsJson = stableFactsJson(facts);
  const factsDigest = digest(factsJson);
  return withPgTransaction(async (client) => {
    const current = (
      await client.query<{
        version: number;
        active_plan_id: string;
        context_snapshot_id: string | null;
        execution_run_id: string | null;
      }>(
        // Tenant and canonical-run scope come from the Case row itself, never
        // from anything the caller supplied beyond the tenant it is already
        // authorized for.
        `SELECT version,active_plan_id,context_snapshot_id,execution_run_id FROM transformation_cases
          WHERE transformation_case_id=? AND organization_id=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    const canonicalRunId = current?.execution_run_id ?? null;
    const mapping = (
      await client.query<Record<string, unknown>>(
        `SELECT * FROM transformation_final_output_governance
          WHERE transformation_case_id=? AND organization_id=? AND facts_digest=? FOR UPDATE`,
        [params.transformationCaseId, params.organizationId, factsDigest]
      )
    ).rows[0];
    if (!current || !mapping)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_FINAL_OUTPUT_PUBLICATION_NOT_APPROVED',
        409,
        'Prepare and approve this exact final-output facts digest before publication'
      );
    const plan = (
      await client.query<{ version: number }>(
        `SELECT version FROM transformation_plans
          WHERE plan_id=? AND transformation_case_id=? AND organization_id=?`,
        [current.active_plan_id, params.transformationCaseId, params.organizationId]
      )
    ).rows[0];
    const executable = await withProposalGovernanceClient(client, () =>
      assertProposalExecutable({
        proposalVersionId: String(mapping.governed_proposal_version_id),
        organizationId: params.organizationId,
        planVersion: Number(plan?.version ?? 0),
        contextDigest: finalOutputContextDigest(
          params.transformationCaseId,
          current.context_snapshot_id
        ),
      })
    );
    if (!executable.executable || Number(mapping.source_case_version) !== facts.caseVersion)
      throw new TransformationCaseOperationError(
        'TRANSFORMATION_FINAL_OUTPUT_PUBLICATION_NOT_APPROVED',
        409,
        `Final-output publication is blocked: ${executable.reason ?? 'case_version_changed'}`
      );
    const existing = (
      await client.query<Record<string, unknown>>(
        `SELECT * FROM transformation_final_output_runs WHERE transformation_case_id=? AND organization_id=? AND facts_digest=?`,
        [params.transformationCaseId, params.organizationId, factsDigest]
      )
    ).rows[0];
    if (existing) return mapRun(existing, true);
    const now = new Date().toISOString();

    // ── U02-A: owner modules first ────────────────────────────────────────
    // The approved facts create native, versioned artifacts through their
    // owning services. All three owner modules are pinned to THIS transaction,
    // so the report, its sections, its immutable version, the deck, the deck
    // version and both registry receipts either commit together with the
    // manifest or disappear together on rollback. There is no owner-side
    // compensation to get wrong, and no window where an owner row exists that
    // the manifest never acknowledged.
    const native = await withReportBuilderClient(client, () =>
      withPresentationOwnerClient(client, () =>
        withArtifactRegistryClient(client, async () => {
          const document = buildFinalDocument(facts, factsDigest, now);
          const unified = buildFinalDeck(facts, factsDigest, now);
          const lineage = {
            transformationCaseId: params.transformationCaseId,
            caseVersion: facts.caseVersion,
            lineageId: facts.lineageId,
            factsDigest,
            planId: facts.evidence.activePlanId,
            planVersion: Number(plan?.version ?? 0),
            contextSnapshotId: current.context_snapshot_id,
            canonicalRunId: canonicalRunId ?? null,
            outputContractVersion: facts.outputContractVersion,
            agentId: AGENT_IDENTITY,
            actorUserId: params.actorUserId,
          };

          const report = await createNativeReport({
            organizationId: params.organizationId,
            sourceType: 'TRANSFORMATION_CASE',
            sourceId: params.transformationCaseId,
            sourceName: facts.initiative.name,
            title: document.title,
            description: facts.mandate,
            reportType: 'TRANSFORMATION_FINAL_REPORT',
            status: 'APPROVED',
            createdBy: params.actorUserId,
            createdAt: now,
            config: lineage,
            sourceRefs: [
              {
                artifact_id: params.transformationCaseId,
                artifact_type: 'transformation_case',
                artifact_name: facts.initiative.name,
              },
            ],
            sections: nativeReportSectionsFromDocument(document),
            contextSnapshotId: current.context_snapshot_id,
            executionRunId: canonicalRunId ?? null,
            originSummary: lineage,
          });
          const reportVersion = await createNativeReportVersion(
            report.reportId,
            params.organizationId,
            params.actorUserId,
            {
              changeType: 'manual',
              changeSummary: `Transformation final outputs — facts ${factsDigest}`,
              newStatus: 'APPROVED',
            }
          );

          const deck = await createNativeDeck({
            organizationId: params.organizationId,
            title: document.title,
            unifiedJson: unified,
            sourceType: 'transformation_case',
            sourceId: params.transformationCaseId,
            createdBy: params.actorUserId,
            createdAt: now,
            status: 'ready',
            contextSnapshotId: current.context_snapshot_id,
            executionRunId: canonicalRunId ?? null,
            originSummary: lineage,
          });
          const deckVersion = await createNativeDeckVersion({
            deckId: deck.deckId,
            organizationId: params.organizationId,
            version: 1,
            deck: deck.deck,
            slideCount: deck.slideCount,
            createdBy: params.actorUserId,
            createdAt: now,
          });

          if (!report.registryArtifactId || !deck.registryArtifactId)
            throw new Error('final_output_registry_receipt_missing');

          return {
            reportId: report.reportId,
            reportVersionId: String(reportVersion.id),
            reportVersionNumber: Number(reportVersion.versionNumber),
            reportRegistryArtifactId: report.registryArtifactId,
            deckId: deck.deckId,
            deckVersionId: deckVersion.versionId,
            deckVersionNumber: deckVersion.version,
            deckRegistryArtifactId: deck.registryArtifactId,
          } satisfies TransformationFinalOutputNativeArtifacts;
        })
      )
    );

    // ── U02-A: exports are rendered FROM the persisted native models ──────
    // Both renders read the owner rows back rather than re-deriving from
    // `facts`, which is what keeps the files honest exports of the canonical
    // artifacts instead of a second, parallel truth.
    const reportRow = (
      await client.query<{ title: string; created_at: string; updated_at: string }>(
        `SELECT title,created_at,updated_at FROM report_builder_reports WHERE id=? AND organization_id=?`,
        [native.reportId, params.organizationId]
      )
    ).rows[0];
    const sectionRows = (
      await client.query<{ section_key: string; title: string; generated_content: string | null }>(
        `SELECT section_key,title,generated_content FROM report_builder_sections
          WHERE report_id=? ORDER BY order_index ASC`,
        [native.reportId]
      )
    ).rows;
    if (!reportRow || !sectionRows.length) throw new Error('final_output_native_report_unreadable');
    const docx = await renderDocumentSchemaToDocxBuffer(
      documentSchemaFromNativeReport({
        title: reportRow.title,
        factsDigest,
        transformationCaseId: params.transformationCaseId,
        createdAt: String(reportRow.created_at),
        updatedAt: String(reportRow.updated_at),
        sections: sectionRows,
      })
    );

    const deckRow = (
      await client.query<Record<string, unknown>>(
        `SELECT * FROM presentation_decks WHERE id=? AND organization_id=?`,
        [native.deckId, params.organizationId]
      )
    ).rows[0];
    // `normalizeDeckDocument` consumes the ROW (it falls back to unified_json,
    // outline_json and the row's identity columns), not a pre-parsed deck body.
    const nativeDeckDocument = deckRow ? normalizeDeckDocument(deckRow) : null;
    if (!nativeDeckDocument) throw new Error('final_output_native_deck_unreadable');
    const pptxResult = await new PptxPipelineService().generateFromUnifiedJson(
      deckDocumentToRenderableUnifiedJson(
        nativeDeckDocument,
        deckRow?.unified_json
          ? (JSON.parse(String(deckRow.unified_json as string)) as UnifiedReportJSON)
          : null
      ),
      { language: 'pl', confidentiality: 'confidential' }
    );
    const pptx = pptxResult.buffer;
    const runId = uuidv4();
    const outputDir = exportsDir(
      'transformation-cases',
      params.organizationId,
      params.transformationCaseId,
      runId
    );
    const docxPath = path.join(outputDir, 'transformation-final-report.docx');
    const pptxPath = path.join(outputDir, 'transformation-steering-deck.pptx');
    try {
      await Promise.all([writeFile(docxPath, docx), writeFile(pptxPath, pptx)]);
      const inserted = await client.query<Record<string, unknown>>(
        `INSERT INTO transformation_final_output_runs (run_id,transformation_case_id,organization_id,case_version,facts_json,facts_digest,docx_path,docx_sha256,pptx_path,pptx_sha256,native_report_id,native_report_version_id,native_report_version_number,report_registry_artifact_id,native_deck_id,native_deck_version_id,native_deck_version_number,deck_registry_artifact_id,generated_by_user_id,generated_at) VALUES (?,?,?,?,?::jsonb,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`,
        [
          runId,
          params.transformationCaseId,
          params.organizationId,
          facts.caseVersion,
          factsJson,
          factsDigest,
          docxPath,
          digest(docx),
          pptxPath,
          digest(pptx),
          native.reportId,
          native.reportVersionId,
          native.reportVersionNumber,
          native.reportRegistryArtifactId,
          native.deckId,
          native.deckVersionId,
          native.deckVersionNumber,
          native.deckRegistryArtifactId,
          params.actorUserId,
          now,
        ]
      );
      for (const [artifactType, artifactId] of [
        ['final_output_run', runId],
        // The native owner artifacts are the lineage-bearing outputs; the file
        // hashes stay linked too so an exported byte stream remains traceable.
        ['final_report', native.reportId],
        ['final_report_version', native.reportVersionId],
        ['final_steering_deck', native.deckId],
        ['final_steering_deck_version', native.deckVersionId],
        ['final_report_docx', digest(docx)],
        ['final_steering_deck_pptx', digest(pptx)],
      ]) {
        await client.query(
          `INSERT INTO transformation_case_artifact_links (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,artifact_id,lineage_role,created_by_user_id,created_at) VALUES (?,?,?,'final_outputs',?,?,'output',?,?) ON CONFLICT DO NOTHING`,
          [
            uuidv4(),
            params.transformationCaseId,
            params.organizationId,
            artifactType,
            artifactId,
            params.actorUserId,
            now,
          ]
        );
      }
      const detail = {
        runId,
        factsDigest,
        docxSha256: digest(docx),
        pptxSha256: digest(pptx),
        native,
        agentId: AGENT_IDENTITY,
      };
      await client.query(
        `INSERT INTO transformation_case_audit_events (audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,actor_user_id,correlation_id,payload_digest,detail_json,created_at) VALUES (?,?,?,?,?,'transformation_final_outputs.generated',?,?,?,?::jsonb,?)`,
        [
          uuidv4(),
          params.transformationCaseId,
          params.organizationId,
          facts.evidence.activePlanId,
          facts.caseVersion,
          params.actorUserId,
          params.correlationId ?? null,
          digest(JSON.stringify(detail)),
          JSON.stringify(detail),
          now,
        ]
      );
      await client.query(
        `UPDATE transformation_final_output_governance
          SET status='published',final_output_run_id=?,updated_at=?
        WHERE publication_mapping_id=? AND organization_id=?`,
        [runId, now, mapping.publication_mapping_id, params.organizationId]
      );
      return mapRun(inserted.rows[0], false);
    } catch (error) {
      await Promise.all([
        rm(docxPath, { force: true }).catch(() => undefined),
        rm(pptxPath, { force: true }).catch(() => undefined),
      ]);
      throw error;
    }
  });
}

async function assertExactFinalOutputPublicationApproved(params: {
  transformationCaseId: string;
  organizationId: string;
  facts: TransformationFinalOutputFacts;
  factsDigest: string;
}) {
  const authority = await queryOne<{
    active_plan_id: string | null;
    context_snapshot_id: string | null;
    source_case_version: number;
    governed_proposal_version_id: string;
  }>(
    `SELECT c.active_plan_id,c.context_snapshot_id,g.source_case_version,g.governed_proposal_version_id
       FROM transformation_cases c
       JOIN transformation_final_output_governance g
         ON g.transformation_case_id=c.transformation_case_id AND g.organization_id=c.organization_id
      WHERE c.transformation_case_id=? AND c.organization_id=? AND g.facts_digest=?`,
    [params.transformationCaseId, params.organizationId, params.factsDigest]
  );
  if (!authority || Number(authority.source_case_version) !== params.facts.caseVersion)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_FINAL_OUTPUT_PUBLICATION_NOT_APPROVED',
      409,
      'Prepare and approve this exact final-output facts digest before publication'
    );
  const plan = await queryOne<{ version: number }>(
    `SELECT version FROM transformation_plans
      WHERE plan_id=? AND transformation_case_id=? AND organization_id=?`,
    [authority.active_plan_id, params.transformationCaseId, params.organizationId]
  );
  const executable = await assertProposalExecutable({
    proposalVersionId: authority.governed_proposal_version_id,
    organizationId: params.organizationId,
    planVersion: Number(plan?.version ?? 0),
    contextDigest: finalOutputContextDigest(
      params.transformationCaseId,
      authority.context_snapshot_id
    ),
  });
  if (!executable.executable)
    throw new TransformationCaseOperationError(
      'TRANSFORMATION_FINAL_OUTPUT_PUBLICATION_NOT_APPROVED',
      409,
      `Final-output publication is blocked: ${executable.reason}`
    );
}

export async function generateFinalOutputs(params: {
  transformationCaseId: string;
  organizationId: string;
  actorUserId: string;
  correlationId?: string | null;
}): Promise<TransformationFinalOutputRun> {
  const facts = await loadFacts(params.transformationCaseId, params.organizationId);
  const factsDigest = digest(stableFactsJson(facts));
  await assertExactFinalOutputPublicationApproved({ ...params, facts, factsDigest });
  const context = await loadTransformationAgentExecutionContext({
    transformationCaseId: params.transformationCaseId,
    organizationId: params.organizationId,
    actorUserId: params.actorUserId,
  });
  const dispatched = await dispatchAgentAdapter({
    canonicalRunId: context.canonicalRunId,
    organizationId: context.organizationId,
    transformationCaseId: context.transformationCaseId,
    actorUserId: context.actorUserId,
    agentId: context.agentId,
    projectId: context.projectId,
    toolName: 'transformation.final_outputs.publish',
    idempotencyKey: `publish:final_outputs:case-v${facts.caseVersion}:facts-${factsDigest}`,
    payload: {
      transformationCaseId: params.transformationCaseId,
      organizationId: params.organizationId,
      caseVersion: facts.caseVersion,
      planId: facts.evidence.activePlanId,
      factsDigest,
      contextDigest: finalOutputContextDigest(
        params.transformationCaseId,
        await queryOne<{ context_snapshot_id: string | null }>(
          `SELECT context_snapshot_id FROM transformation_cases
            WHERE transformation_case_id=? AND organization_id=?`,
          [params.transformationCaseId, params.organizationId]
        ).then((row) => row?.context_snapshot_id ?? null)
      ),
    },
    adapter: {
      key: 'transformation.final_outputs.publish',
      compensationPolicy: 'delete_created',
      execute: async () => {
        const run = await generateFinalOutputsInner(params);
        return {
          artifactType: 'transformation_final_output_manifest',
          artifactId: run.runId,
          module: 'transformation_final_outputs',
          operation: 'publish',
          data: { run },
        };
      },
      readback: async (runId) => {
        const manifest = await queryOne<Record<string, unknown>>(
          `SELECT r.*,g.status publication_status,g.final_output_run_id
             FROM transformation_final_output_runs r
             JOIN transformation_final_output_governance g
               ON g.transformation_case_id=r.transformation_case_id
              AND g.organization_id=r.organization_id AND g.facts_digest=r.facts_digest
            WHERE r.run_id=? AND r.transformation_case_id=? AND r.organization_id=?
              AND r.case_version=? AND r.facts_digest=?`,
          [
            runId,
            params.transformationCaseId,
            params.organizationId,
            facts.caseVersion,
            factsDigest,
          ]
        );
        if (
          !manifest ||
          manifest.publication_status !== 'published' ||
          manifest.final_output_run_id !== runId
        )
          return null;
        // U02-A: a generated file is never sufficient evidence of completion.
        // The readback must find the native owner rows, their immutable
        // versions and both registry receipts — all tenant-scoped, all bound to
        // the same facts digest — before the adapter may settle.
        const nativeIds = mapNative(manifest);
        if (!nativeIds) return null;
        const owners = await queryOne<{
          report_count: number;
          report_version_count: number;
          deck_count: number;
          deck_version_count: number;
          registry_count: number;
          origin_link_count: number;
        }>(
          `SELECT
             (SELECT COUNT(*)::int FROM report_builder_reports rb
               WHERE rb.id=? AND rb.organization_id=? AND rb.source_type='TRANSFORMATION_CASE' AND rb.source_id=?) report_count,
             (SELECT COUNT(*)::int FROM report_builder_versions rv
               WHERE rv.id=? AND rv.report_id=?) report_version_count,
             (SELECT COUNT(*)::int FROM presentation_decks pd
               WHERE pd.id=? AND pd.organization_id=?) deck_count,
             (SELECT COUNT(*)::int FROM presentation_deck_versions pdv
               WHERE pdv.id=? AND pdv.deck_id=?) deck_version_count,
             (SELECT COUNT(*)::int FROM v8_output_artifacts oa
               WHERE oa.artifact_id IN (?,?) AND oa.organization_id=?) registry_count,
             (SELECT COUNT(*)::int FROM v8_artifact_origin_links ol
               WHERE ol.organization_id=? AND ol.origin_record_id IN (?,?)) origin_link_count`,
          [
            nativeIds.reportId,
            params.organizationId,
            params.transformationCaseId,
            nativeIds.reportVersionId,
            nativeIds.reportId,
            nativeIds.deckId,
            params.organizationId,
            nativeIds.deckVersionId,
            nativeIds.deckId,
            nativeIds.reportRegistryArtifactId,
            nativeIds.deckRegistryArtifactId,
            params.organizationId,
            params.organizationId,
            nativeIds.reportId,
            nativeIds.deckId,
          ]
        );
        if (
          !owners ||
          Number(owners.report_count) !== 1 ||
          Number(owners.report_version_count) !== 1 ||
          Number(owners.deck_count) !== 1 ||
          Number(owners.deck_version_count) !== 1 ||
          Number(owners.registry_count) !== 2 ||
          Number(owners.origin_link_count) !== 2
        )
          return null;
        try {
          const [docx, pptx] = await Promise.all([
            readFile(String(manifest.docx_path)),
            readFile(String(manifest.pptx_path)),
          ]);
          if (
            digest(docx) !== String(manifest.docx_sha256) ||
            digest(pptx) !== String(manifest.pptx_sha256)
          )
            return null;
        } catch {
          return null;
        }
        return {
          runId: String(manifest.run_id),
          transformationCaseId: String(manifest.transformation_case_id),
          organizationId: String(manifest.organization_id),
          caseVersion: Number(manifest.case_version),
          factsDigest: String(manifest.facts_digest),
          docxPath: String(manifest.docx_path),
          docxSha256: String(manifest.docx_sha256),
          pptxPath: String(manifest.pptx_path),
          pptxSha256: String(manifest.pptx_sha256),
          generatedAt: String(manifest.generated_at),
          publicationStatus: String(manifest.publication_status),
          native: nativeIds,
        };
      },
    },
  });
  return {
    ...(dispatched.normalizedResult.data.run as unknown as TransformationFinalOutputRun),
    idempotentReplay: dispatched.idempotentReplay,
  };
}

export async function getLatestFinalOutputRun(
  caseId: string,
  organizationId: string
): Promise<TransformationFinalOutputRun | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM transformation_final_output_runs WHERE transformation_case_id=? AND organization_id=? ORDER BY generated_at DESC LIMIT 1`,
    [caseId, organizationId]
  );
  return row ? mapRun(row, true) : null;
}
