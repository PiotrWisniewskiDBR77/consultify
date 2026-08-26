import { randomUUID } from 'node:crypto';

import { aiInputHash } from '../../domain/initiatives-execution/aiEvidenceGovernance.js';
import aiBudgetService from '../aiBudgetService.js';
import { llmConfigService } from '../ai/llmConfigService.js';
import { llmService } from '../ai/llmService.js';
import type { SignalQuery } from '../../types/workSignals.js';

export interface InterpreterInputSignal {
  signalId: string;
  type: string;
  severity: string;
  subjectType: string;
  subjectId: string;
  observedValue: unknown;
  firstObservedAt: string;
}

export interface InterpretedProposal {
  dedupeKey: string;
  severity: 'info' | 'warning' | 'critical' | 'blocker';
  titleKey: string;
  bodyKey: string;
  subjectType: 'task' | 'decision' | 'initiative' | 'project' | 'program';
  subjectId: string;
  evidenceRefs: string[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  inputHash: string;
  model: { provider: string; model: string; version: string };
  prompt: { promptId: string; version: string };
  template: { templateId: string; version: string };
  action: { kind: string; route: string; params: Record<string, unknown>; permission: string };
}

export interface InterpreterDependencies {
  db: SignalQuery;
  providerAvailable(): Promise<boolean>;
  budgetAllowed(organizationId: string): Promise<boolean>;
  generate(input: InterpreterInputSignal[]): Promise<InterpretedProposal[]>;
}

export function isSignalInterpreterEnabled(): boolean {
  return process.env.ENABLE_SIGNAL_INTERPRETER === 'true';
}

export async function validateInterpretedProvenance(params: {
  db: SignalQuery;
  organizationId: string;
  input: InterpreterInputSignal[];
  proposal: InterpretedProposal;
}): Promise<void> {
  const proposal = params.proposal;
  if (
    proposal.evidenceRefs.length < 2 ||
    !proposal.inputHash ||
    proposal.inputHash !== aiInputHash(params.input) ||
    !proposal.model.provider ||
    !proposal.model.model ||
    !proposal.model.version ||
    !proposal.prompt.promptId ||
    !proposal.prompt.version ||
    !proposal.template.templateId ||
    !proposal.template.version ||
    proposal.confidence === 'UNKNOWN'
  ) {
    throw new Error('Complete interpreted signal provenance is required');
  }
  const placeholders = proposal.evidenceRefs.map(() => '?').join(',');
  const rows = await params.db.query<{ signal_id: string }>(
    `SELECT signal_id::text AS signal_id FROM work_signals
      WHERE organization_id = ? AND status = 'OPEN' AND origin = 'DETERMINISTIC'
        AND signal_id::text IN (${placeholders})`,
    [params.organizationId, ...proposal.evidenceRefs]
  );
  if (new Set(rows.map((row) => row.signal_id)).size !== new Set(proposal.evidenceRefs).size) {
    throw new Error('Interpreted evidence must reference open deterministic signals in one tenant');
  }
}

const defaultDependencies = (db: SignalQuery): InterpreterDependencies => ({
  db,
  providerAvailable: async () => Boolean(await llmConfigService.getDefaultProvider()),
  budgetAllowed: async (organizationId) =>
    Boolean(
      (
        await aiBudgetService.checkBudget(organizationId, 'signal-interpreter', {
          tokens: 2000,
          cost: 0.01,
        })
      ).allowed
    ),
  generate: async (input) => {
    const output = await llmService.generateResponse({
      model: 'gemini-2.0-flash',
      temperature: 0.1,
      maxTokens: 1800,
      systemPrompt:
        'Synthesize at most three patterns. Use only supplied deterministic signals and return JSON.',
      prompt: JSON.stringify({ input, inputHash: aiInputHash(input) }),
    });
    return (Array.isArray(output.proposals) ? output.proposals : []) as InterpretedProposal[];
  },
});

export async function runInterpretationForOrganization(params: {
  organizationId: string;
  db: SignalQuery;
  trigger?: 'CRON' | 'ON_DEMAND' | 'BACKFILL';
  dependencies?: InterpreterDependencies;
}) {
  const deps = params.dependencies ?? defaultDependencies(params.db);
  const runId = randomUUID();
  const started = Date.now();
  const finish = async (
    status: string,
    opened = 0,
    errors: unknown[] = [],
    aiRunId: string | null = null
  ) => {
    await deps.db.query(
      `INSERT INTO work_signal_runs(run_id,organization_id,kind,trigger,started_at,finished_at,status,
        rules_evaluated,signals_opened,errors,ai_run_id,duration_ms)
       VALUES (?,?,'INTERPRETED',?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,?,1,?,?::jsonb,?,?)`,
      [
        runId,
        params.organizationId,
        params.trigger ?? 'CRON',
        status,
        opened,
        JSON.stringify(errors),
        aiRunId,
        Math.max(1, Date.now() - started),
      ]
    );
    return { runId, status, signalsOpened: opened, errors };
  };
  if (!isSignalInterpreterEnabled()) return finish('SKIPPED_DISABLED');
  if (!(await deps.providerAvailable())) return finish('SKIPPED_NO_PROVIDER');
  const rows = await deps.db.query<Record<string, unknown>>(
    `SELECT signal_id::text, signal_type, severity, subject_type, subject_id,
            evidence, first_observed_at
       FROM work_signals WHERE organization_id = ? AND status='OPEN' AND origin='DETERMINISTIC'
       ORDER BY severity DESC, first_observed_at ASC`,
    [params.organizationId]
  );
  if (rows.length < 5) return finish('OK');
  if (!(await deps.budgetAllowed(params.organizationId))) {
    return finish('PARTIAL', 0, [
      {
        ruleId: 'INTERPRETER_BUDGET',
        message: 'AI budget exhausted',
        at: new Date().toISOString(),
      },
    ]);
  }
  const input: InterpreterInputSignal[] = rows.map((row) => ({
    signalId: String(row.signal_id),
    type: String(row.signal_type),
    severity: String(row.severity),
    subjectType: String(row.subject_type),
    subjectId: String(row.subject_id),
    observedValue: Array.isArray(row.evidence) ? row.evidence[0]?.observedValue : undefined,
    firstObservedAt: new Date(String(row.first_observed_at)).toISOString(),
  }));
  const proposals = (await deps.generate(input)).slice(0, 3);
  let opened = 0;
  const errors: Array<{ ruleId: string; message: string; at: string }> = [];
  for (const proposal of proposals) {
    try {
      await validateInterpretedProvenance({
        db: deps.db,
        organizationId: params.organizationId,
        input,
        proposal,
      });
      const existing = await deps.db.query<{ signal_id: string }>(
        `SELECT signal_id::text FROM work_signals WHERE organization_id=? AND dedupe_key=? AND status='OPEN'`,
        [params.organizationId, proposal.dedupeKey]
      );
      if (existing.length) continue;
      await deps.db.query(
        `INSERT INTO work_signals(signal_id,organization_id,dedupe_key,domain,signal_type,origin,severity,
          subject_type,subject_id,title_key,body_key,evidence,action,rule_id,rule_version,provenance,
          source_signal_ids,status,expires_at,run_id)
         VALUES (?,?,?,'GOVERNANCE','interpreted_pattern','INTERPRETED',?,?,?,?,?,?::jsonb,?::jsonb,
          'ai.interpreted.pattern',1,?::jsonb,?::jsonb,'OPEN',CURRENT_TIMESTAMP + INTERVAL '24 hours',?)`,
        [
          randomUUID(),
          params.organizationId,
          proposal.dedupeKey,
          proposal.severity,
          proposal.subjectType,
          proposal.subjectId,
          proposal.titleKey,
          proposal.bodyKey,
          JSON.stringify(
            proposal.evidenceRefs.map((ref) => ({
              ref,
              refType: proposal.subjectType,
              version: null,
              observedValue: 'SOURCE_SIGNAL',
              observedAt: new Date().toISOString(),
            }))
          ),
          JSON.stringify(proposal.action),
          JSON.stringify(proposal),
          JSON.stringify(proposal.evidenceRefs),
          runId,
        ]
      );
      opened += 1;
    } catch (error) {
      errors.push({
        ruleId: 'ai.interpreted.pattern',
        message: error instanceof Error ? error.message : String(error),
        at: new Date().toISOString(),
      });
    }
  }
  await deps.db.query(
    `UPDATE work_signals w SET status='SUPERSEDED', resolved_reason='SUPERSEDED', resolved_at=CURRENT_TIMESTAMP
      WHERE w.organization_id=? AND w.origin='INTERPRETED' AND w.status='OPEN'
        AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(w.source_signal_ids) source(id)
                     WHERE NOT EXISTS (SELECT 1 FROM work_signals d WHERE d.organization_id=w.organization_id
                       AND d.signal_id::text=source.id AND d.status='OPEN' AND d.origin='DETERMINISTIC'))`,
    [params.organizationId]
  );
  return finish(errors.length ? 'PARTIAL' : 'OK', opened, errors, randomUUID());
}
