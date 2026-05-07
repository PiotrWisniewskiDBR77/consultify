/**
 * Seed: Presentation Artifact Demo Dataset
 *
 * Inserts five deterministic demo decks with mixed confidentiality (1 public,
 * 2 internal, 2 confidential) plus accompanying runtime telemetry events and
 * matching agent edit operations. Used by manual UI tests, benchmarks, and
 * demo walkthroughs.
 *
 * Usage:
 *   npx tsx server/scripts/seed-presentation-artifact-demo.ts \
 *     --organization-id <id> \
 *     [--user-id <id>] \
 *     [--reset] \
 *     [--dry-run] \
 *     [--report-file out/seed-<date>.json]
 */

import * as fs from 'fs';
import * as path from 'path';

import { get as dbGet, run as dbRun } from '../src/utils/DbPromise.js';
import logger from '../src/utils/Logger.js';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface CliArgs {
  organizationId: string;
  userId: string;
  reset: boolean;
  dryRun: boolean;
  reportFile: string | null;
}

function parseArgs(argv: string[]): { ok: true; args: CliArgs } | { ok: false; error: string } {
  let organizationId: string | null = null;
  let userId: string | null = null;
  let reset = false;
  let dryRun = false;
  let reportFile: string | null = null;

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    const [flag, inlineValue] = raw.includes('=') ? raw.split('=', 2) : [raw, undefined];
    const valueOrNext = (): string | undefined => {
      if (inlineValue !== undefined) return inlineValue;
      const nxt = argv[i + 1];
      if (!nxt || nxt.startsWith('--')) return undefined;
      i += 1;
      return nxt;
    };

    switch (flag) {
      case '--organization-id': {
        const v = valueOrNext();
        if (!v) return { ok: false, error: 'Missing value for --organization-id' };
        organizationId = v;
        break;
      }
      case '--user-id': {
        const v = valueOrNext();
        if (!v) return { ok: false, error: 'Missing value for --user-id' };
        userId = v;
        break;
      }
      case '--reset':
        reset = inlineValue ? inlineValue === 'true' : true;
        break;
      case '--dry-run':
        dryRun = inlineValue ? inlineValue === 'true' : true;
        break;
      case '--report-file': {
        const v = valueOrNext();
        if (!v) return { ok: false, error: 'Missing value for --report-file' };
        reportFile = v;
        break;
      }
      default:
        if (flag.startsWith('--')) {
          return { ok: false, error: `Unknown flag: ${flag}` };
        }
    }
  }

  if (!organizationId) {
    return { ok: false, error: '--organization-id is required' };
  }

  return {
    ok: true,
    args: { organizationId, userId: userId || 'demo-seed-user', reset, dryRun, reportFile },
  };
}

// ---------------------------------------------------------------------------
// Demo dataset
// ---------------------------------------------------------------------------

interface DemoDeckSeed {
  id: string;
  title: string;
  confidentiality: 'public' | 'internal' | 'confidential';
  slideCount: number;
  cards: Array<Record<string, unknown>>;
  events: Array<{ type: string; daysAgo: number; scope?: string }>;
}

const DEMO_DECKS: DemoDeckSeed[] = [
  {
    id: 'demo-deck-strategy-readout',
    title: 'Strategy Readout — Q2 Growth',
    confidentiality: 'public',
    slideCount: 8,
    cards: [
      { kind: 'title', title: 'Strategy Readout — Q2 Growth' },
      {
        kind: 'executive_summary',
        title: 'Executive summary',
        bullets: [
          'Q2 momentum vs plan',
          'Three battlegrounds: pricing, retention, expansion',
          'Decisions requested: investment, talent, focus',
        ],
      },
      {
        kind: 'kpi',
        title: 'KPI snapshot',
        bullets: ['ARR +18% QoQ', 'Logo retention 96%', 'Win rate 27%'],
      },
      {
        kind: 'decision',
        title: 'Decision: pricing experiment',
        bullets: ['Pilot in 2 segments', 'Guardrails on churn', 'Owner: CRO'],
      },
      {
        kind: 'risks',
        title: 'Top risks',
        bullets: ['SMB churn pressure', 'Hiring lag in CS', 'Pricing complexity'],
      },
      { kind: 'roadmap', title: 'Roadmap H2', bullets: ['Pricing v2', 'CS automation', 'PLG motion'] },
      { kind: 'next_steps', title: 'Next steps', bullets: ['Lock pricing PoC', 'Approve hires'] },
      { kind: 'appendix', title: 'Appendix', bullets: ['Cohort tables', 'Sources', 'Methodology'] },
    ],
    events: [
      { type: 'agent_edit_proposal_created', daysAgo: 6, scope: 'global' },
      { type: 'agent_edit_applied', daysAgo: 5, scope: 'global' },
      { type: 'agent_edit_proposal_created', daysAgo: 1, scope: 'slide' },
    ],
  },
  {
    id: 'demo-deck-board-update',
    title: 'Board Update — May Cycle',
    confidentiality: 'internal',
    slideCount: 12,
    cards: [
      { kind: 'title', title: 'Board Update — May Cycle' },
      {
        kind: 'executive_summary',
        title: 'Executive summary',
        bullets: ['Plan vs actuals', 'Material decisions', 'Risks & mitigations'],
      },
      {
        kind: 'kpi',
        title: 'P&L highlights',
        bullets: ['Revenue +12%', 'Gross margin 71%', 'Cash runway 26 mo'],
      },
      {
        kind: 'decision',
        title: 'Decision: capital allocation',
        bullets: ['$2M to expansion', '$0.5M to platform', 'Decision required'],
      },
      {
        kind: 'risks',
        title: 'Risks',
        bullets: ['EU compliance', 'Vendor lock-in', 'Hiring market'],
      },
      { kind: 'people', title: 'People', bullets: ['New VP Engineering', 'Open roles'] },
      { kind: 'product', title: 'Product', bullets: ['Roadmap delta', 'Customer feedback'] },
      { kind: 'gtm', title: 'GTM', bullets: ['ICP refresh', 'Channel mix'] },
      {
        kind: 'finance',
        title: 'Finance',
        bullets: ['Burn rate', 'Cash forecast', 'Sensitivity'],
      },
      { kind: 'roadmap', title: 'H2 outlook', bullets: ['Three bets', 'KPIs', 'Risks'] },
      { kind: 'next_steps', title: 'Next steps', bullets: ['Approve allocation', 'Hire VP Sales'] },
      { kind: 'appendix', title: 'Appendix', bullets: ['Detail tables'] },
    ],
    events: [
      { type: 'agent_edit_proposal_created', daysAgo: 9, scope: 'global' },
      { type: 'agent_edit_rejected', daysAgo: 9, scope: 'global' },
      { type: 'agent_edit_proposal_created', daysAgo: 3, scope: 'section' },
      { type: 'agent_edit_applied', daysAgo: 3, scope: 'section' },
    ],
  },
  {
    id: 'demo-deck-ks-followup',
    title: 'KS Follow-up — Transformation Steering',
    confidentiality: 'internal',
    slideCount: 10,
    cards: [
      { kind: 'title', title: 'KS Follow-up — Transformation Steering' },
      {
        kind: 'status',
        title: 'Project status',
        bullets: ['Ahead on workstreams 1, 2', 'At risk: workstream 3'],
      },
      {
        kind: 'decision',
        title: 'Decisions required',
        bullets: ['Resequence WS3', 'Approve change request CR-12', 'Confirm go-live'],
      },
      {
        kind: 'risks',
        title: 'Risks & mitigations',
        bullets: ['Vendor delay', 'Test coverage gap', 'Adoption signal'],
      },
      { kind: 'timeline', title: 'Timeline', bullets: ['Wave 1: done', 'Wave 2: in flight'] },
      {
        kind: 'dependencies',
        title: 'Dependencies',
        bullets: ['Data platform', 'Auth migration', 'Vendor X SLA'],
      },
      { kind: 'kpi', title: 'KPIs', bullets: ['Adoption 41%', 'NPS +12', 'Defects -22%'] },
      { kind: 'budget', title: 'Budget', bullets: ['CapEx vs plan', 'OpEx run rate'] },
      { kind: 'next_steps', title: 'Next steps', bullets: ['Resequence', 'Approve CR-12'] },
      { kind: 'appendix', title: 'Appendix', bullets: ['Source artifacts'] },
    ],
    events: [
      { type: 'agent_edit_proposal_created', daysAgo: 12, scope: 'global' },
      { type: 'agent_edit_applied', daysAgo: 12, scope: 'global' },
      { type: 'agent_edit_proposal_created', daysAgo: 2, scope: 'methodological' },
    ],
  },
  {
    id: 'demo-deck-internal-status',
    title: 'Internal Status — Platform Reliability',
    confidentiality: 'confidential',
    slideCount: 6,
    cards: [
      { kind: 'title', title: 'Internal Status — Platform Reliability' },
      {
        kind: 'status',
        title: 'Reliability summary',
        bullets: ['SLOs met', 'Top 3 incidents', 'Recovery posture'],
      },
      {
        kind: 'decision',
        title: 'Decisions',
        bullets: ['Increase on-call rotation', 'Approve runbook investment'],
      },
      {
        kind: 'risks',
        title: 'Risk register',
        bullets: ['Aging dependency', 'Capacity ceiling', 'Single-tenant load'],
      },
      { kind: 'next_steps', title: 'Next steps', bullets: ['Pilot DR drills', 'Adopt auto-failover'] },
      { kind: 'appendix', title: 'Appendix', bullets: ['Incident logs'] },
    ],
    events: [
      { type: 'agent_edit_proposal_created', daysAgo: 4, scope: 'global' },
      { type: 'export_blocked', daysAgo: 4, scope: 'global' },
    ],
  },
  {
    id: 'demo-deck-customer-pitch',
    title: 'Customer Pitch — Tier 1 Account',
    confidentiality: 'confidential',
    slideCount: 14,
    cards: [
      { kind: 'title', title: 'Customer Pitch — Tier 1 Account' },
      {
        kind: 'discovery',
        title: 'What we heard',
        bullets: ['CFO priorities', 'CTO priorities', 'Operational pain'],
      },
      {
        kind: 'decision',
        title: 'Recommendation',
        bullets: ['Phase 1: stabilize', 'Phase 2: scale', 'Decision: pilot'],
      },
      {
        kind: 'risks',
        title: 'Risks for the customer',
        bullets: ['Change fatigue', 'Vendor dependency'],
      },
      { kind: 'roadmap', title: 'Roadmap', bullets: ['90/180/365 days'] },
      { kind: 'value', title: 'Value case', bullets: ['ROI', 'TCO', 'Time-to-value'] },
      { kind: 'proof', title: 'Proof', bullets: ['Case studies', 'References'] },
      { kind: 'team', title: 'Team', bullets: ['Pod model', 'Senior coverage'] },
      { kind: 'governance', title: 'Governance', bullets: ['Cadence', 'Escalation'] },
      { kind: 'commercials', title: 'Commercials', bullets: ['Tiering', 'Discounts'] },
      { kind: 'next_steps', title: 'Next steps', bullets: ['Sign pilot', 'Schedule kickoff'] },
      { kind: 'security', title: 'Security', bullets: ['SOC2', 'ISO27001'] },
      { kind: 'compliance', title: 'Compliance', bullets: ['GDPR', 'NIS2'] },
      { kind: 'appendix', title: 'Appendix', bullets: ['Detail packs'] },
    ],
    events: [
      { type: 'agent_edit_proposal_created', daysAgo: 7, scope: 'global' },
      { type: 'agent_edit_applied', daysAgo: 7, scope: 'global' },
      { type: 'export_blocked', daysAgo: 6, scope: 'global' },
      { type: 'agent_edit_proposal_created', daysAgo: 1, scope: 'section' },
    ],
  },
];

// ---------------------------------------------------------------------------
// DB helpers (with schema-tolerance)
// ---------------------------------------------------------------------------

function isSchemaMissing(error: unknown): boolean {
  const message = String((error as { message?: unknown })?.message || '');
  return /no such table|does not exist|relation .* does not exist|Database not initialized/i.test(
    message
  );
}

async function tableExists(table: string): Promise<boolean> {
  try {
    await dbGet(`SELECT 1 FROM ${table} LIMIT 1`, []);
    return true;
  } catch (err) {
    if (isSchemaMissing(err)) return false;
    return true;
  }
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

interface ResetSummary {
  warnings: string[];
}

async function resetDemoData(orgId: string, dryRun: boolean): Promise<ResetSummary> {
  const warnings: string[] = [];
  const guard = "WHERE deck_id LIKE 'demo-deck-%' AND organization_id = ?";

  if (await tableExists('presentation_runtime_events')) {
    if (!dryRun) {
      try {
        await dbRun(`DELETE FROM presentation_runtime_events ${guard}`, [orgId]);
      } catch (err) {
        if (!isSchemaMissing(err)) throw err;
        warnings.push('schema_missing_runtime_events_reset');
      }
    }
  } else {
    warnings.push('schema_missing_runtime_events_reset');
  }

  if (await tableExists('presentation_ai_operations')) {
    if (!dryRun) {
      try {
        await dbRun(`DELETE FROM presentation_ai_operations ${guard}`, [orgId]);
      } catch (err) {
        if (!isSchemaMissing(err)) throw err;
        warnings.push('schema_missing_ai_operations_reset');
      }
    }
  } else {
    warnings.push('schema_missing_ai_operations_reset');
  }

  if (await tableExists('presentation_deck_versions')) {
    if (!dryRun) {
      try {
        await dbRun(`DELETE FROM presentation_deck_versions ${guard}`, [orgId]);
      } catch (err) {
        if (!isSchemaMissing(err)) throw err;
        warnings.push('schema_missing_deck_versions_reset');
      }
    }
  } else {
    warnings.push('schema_missing_deck_versions_reset');
  }

  if (await tableExists('presentation_decks')) {
    if (!dryRun) {
      try {
        await dbRun(
          `DELETE FROM presentation_decks WHERE id LIKE 'demo-deck-%' AND organization_id = ?`,
          [orgId]
        );
      } catch (err) {
        if (!isSchemaMissing(err)) throw err;
        warnings.push('schema_missing_decks_reset');
      }
    }
  } else {
    warnings.push('schema_missing_decks_reset');
  }

  return { warnings };
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

interface SeedReportEntry {
  id: string;
  title: string;
  confidentiality: string;
  slideCount: number;
  events: number;
  operations: number;
}

interface SeedRunResult {
  decks: SeedReportEntry[];
  totals: { decks: number; events: number; operations: number };
  warnings: string[];
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86400_000).toISOString();
}

async function seedDeck(
  deck: DemoDeckSeed,
  orgId: string,
  userId: string,
  dryRun: boolean,
  warnings: string[]
): Promise<SeedReportEntry> {
  if (!deck.id.startsWith('demo-deck-')) {
    throw new Error(`Refusing to seed non-demo deck id: ${deck.id}`);
  }

  const deckJson = {
    deck_id: deck.id,
    title: deck.title,
    confidentiality: deck.confidentiality,
    cards: deck.cards,
    theme: { palette: 'executive', logo: 'dbr77' },
    ai: { reviewState: 'clean' },
    template: { id: 'tpl-strategy-readout', version: 'v1' },
    sources: [
      { id: 'src-1', kind: 'document', title: 'Source pack' },
      { id: 'src-2', kind: 'interview', title: 'Stakeholder interviews' },
    ],
    meta: { confidentiality: deck.confidentiality, demoSeed: true },
    updated_at: new Date().toISOString(),
  };

  if (!dryRun && (await tableExists('presentation_decks'))) {
    try {
      await dbRun(
        `INSERT INTO presentation_decks (id, organization_id, title, deck_json, version, slide_count, confidentiality, created_at, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [deck.id, orgId, deck.title, JSON.stringify(deckJson), deck.slideCount, deck.confidentiality]
      );
    } catch (err) {
      if (isSchemaMissing(err)) {
        warnings.push('schema_missing_decks');
      } else {
        // Some schemas don't have `confidentiality` column — try fallback.
        try {
          await dbRun(
            `INSERT INTO presentation_decks (id, organization_id, title, deck_json, version, slide_count, created_at, updated_at)
             VALUES (?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [deck.id, orgId, deck.title, JSON.stringify(deckJson), deck.slideCount]
          );
        } catch (fallbackErr) {
          logger.error('Failed to insert demo deck', {
            deckId: deck.id,
            err: String((fallbackErr as { message?: unknown })?.message || fallbackErr),
          });
          throw fallbackErr;
        }
      }
    }
  } else if (dryRun) {
    // skip
  } else {
    warnings.push('schema_missing_decks');
  }

  let eventsInserted = 0;
  let operationsInserted = 0;

  const eventsTablePresent = await tableExists('presentation_runtime_events');
  const opsTablePresent = await tableExists('presentation_ai_operations');

  if (!eventsTablePresent) {
    warnings.push('schema_missing_runtime_events');
  }
  if (!opsTablePresent) {
    warnings.push('schema_missing_ai_operations');
  }

  for (const ev of deck.events) {
    const operationId = `${deck.id}-${ev.type}-${ev.daysAgo}`;
    const ts = isoDaysAgo(ev.daysAgo);

    if (eventsTablePresent && !dryRun) {
      try {
        await dbRun(
          `INSERT INTO presentation_runtime_events (id, organization_id, deck_id, user_id, event_type, status, scope, metadata, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `${operationId}-evt`,
            orgId,
            deck.id,
            userId,
            ev.type,
            ev.type.includes('rejected')
              ? 'rejected'
              : ev.type.includes('applied')
                ? 'applied'
                : ev.type.includes('blocked')
                  ? 'blocked'
                  : 'proposal',
            ev.scope || 'global',
            JSON.stringify({ operationId, demoSeed: true }),
            ts,
          ]
        );
        eventsInserted += 1;
      } catch (err) {
        if (!isSchemaMissing(err)) {
          logger.warn('Failed to insert demo runtime event', {
            deckId: deck.id,
            eventType: ev.type,
            err: String((err as { message?: unknown })?.message || err),
          });
        }
      }
    }

    if (
      opsTablePresent &&
      !dryRun &&
      ev.type === 'agent_edit_applied'
    ) {
      try {
        await dbRun(
          `INSERT INTO presentation_ai_operations (id, deck_id, organization_id, user_id, operation_type, status, prompt, reply, actions_json, diff_json, original_deck_json, proposed_deck_json, version_before, created_at)
           VALUES (?, ?, ?, ?, 'agent_edit', 'applied', ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            operationId,
            deck.id,
            orgId,
            userId,
            'Make this slide more executive',
            'Tightened copy and added decision callout.',
            JSON.stringify(['shorten copy', 'add decision callout']),
            JSON.stringify({
              cardsBefore: deck.slideCount,
              cardsAfter: deck.slideCount,
              cardsAdded: 0,
              cardsRemoved: 0,
              changedCards: 1,
              editPlan: { scope: ev.scope || 'global' },
            }),
            JSON.stringify(deckJson),
            JSON.stringify(deckJson),
            1,
            ts,
          ]
        );
        operationsInserted += 1;
      } catch (err) {
        if (!isSchemaMissing(err)) {
          logger.warn('Failed to insert demo ai operation', {
            deckId: deck.id,
            err: String((err as { message?: unknown })?.message || err),
          });
        }
      }
    }
  }

  return {
    id: deck.id,
    title: deck.title,
    confidentiality: deck.confidentiality,
    slideCount: deck.slideCount,
    events: eventsInserted,
    operations: operationsInserted,
  };
}

async function seedAll(args: CliArgs): Promise<SeedRunResult> {
  const decks: SeedReportEntry[] = [];
  const warnings: string[] = [];

  if (args.reset) {
    const reset = await resetDemoData(args.organizationId, args.dryRun);
    warnings.push(...reset.warnings);
  }

  for (const deck of DEMO_DECKS) {
    const entry = await seedDeck(
      deck,
      args.organizationId,
      args.userId,
      args.dryRun,
      warnings
    );
    decks.push(entry);
  }

  return {
    decks,
    totals: {
      decks: decks.length,
      events: decks.reduce((acc, d) => acc + d.events, 0),
      operations: decks.reduce((acc, d) => acc + d.operations, 0),
    },
    warnings: Array.from(new Set(warnings)),
  };
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

function writeReport(reportFile: string, payload: Record<string, unknown>): void {
  const dir = path.dirname(reportFile);
  if (dir) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(payload, null, 2));
}

async function main(): Promise<number> {
  const argvParse = parseArgs(process.argv.slice(2));
  if (!argvParse.ok) {
    process.stderr.write(`Argument error: ${argvParse.error}\n`);
    return 2;
  }
  const args = argvParse.args;
  const startedAt = new Date().toISOString();

  let runResult: SeedRunResult;
  try {
    runResult = await seedAll(args);
  } catch (err) {
    const message = String((err as { message?: unknown })?.message || err);
    process.stderr.write(`Runtime error: ${message}\n`);
    if (args.reportFile) {
      writeReport(args.reportFile, {
        startedAt,
        completedAt: new Date().toISOString(),
        organizationId: args.organizationId,
        userId: args.userId,
        dryRun: args.dryRun,
        reset: args.reset,
        decks: [],
        totals: { decks: 0, events: 0, operations: 0 },
        warnings: ['runtime_error'],
        error: message,
      });
    }
    return 1;
  }

  const completedAt = new Date().toISOString();
  const report = {
    startedAt,
    completedAt,
    organizationId: args.organizationId,
    userId: args.userId,
    dryRun: args.dryRun,
    reset: args.reset,
    decks: runResult.decks,
    totals: runResult.totals,
    warnings: runResult.warnings,
  };

  if (args.reportFile) writeReport(args.reportFile, report);

  const lines: string[] = [];
  lines.push('Presentation Artifact Demo Seed');
  lines.push(`- Organization: ${args.organizationId}`);
  lines.push(`- User: ${args.userId}`);
  lines.push(`- Mode: ${args.dryRun ? 'DRY-RUN' : 'APPLY'}${args.reset ? ' + RESET' : ''}`);
  for (const deck of runResult.decks) {
    lines.push(
      `- ${deck.title} [${deck.confidentiality}, ${deck.slideCount} slides] events=${deck.events} ops=${deck.operations}`
    );
  }
  lines.push(`- Totals: decks=${runResult.totals.decks} events=${runResult.totals.events} ops=${runResult.totals.operations}`);
  if (runResult.warnings.length > 0) {
    lines.push(`- Warnings: ${runResult.warnings.join(', ')}`);
  }
  process.stdout.write(lines.join('\n') + '\n');

  return 0;
}

main()
  .then((code) => {
    process.stdout.write(`Exit code: ${code}\n`);
    process.exit(code);
  })
  .catch((err) => {
    process.stderr.write(`Unhandled error: ${String((err as { message?: unknown })?.message || err)}\n`);
    process.stdout.write('Exit code: 1\n');
    process.exit(1);
  });
