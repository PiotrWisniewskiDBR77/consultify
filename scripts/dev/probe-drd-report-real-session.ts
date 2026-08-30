#!/usr/bin/env npx tsx
/**
 * POMIAR: jak wygląda raport z oceny, gdy findingi powstają tak, jak powstają
 * w produkcie (EventDerivedOutputBridge), a nie tak, jak zostały RĘCZNIE
 * NAPISANE w scripts/demo-seed/metalpolDrdDataset.ts.
 *
 * Skrypt NIE pisze żadnej prozy. Bierze wyłącznie strukturę (unitId, poziomy)
 * z bazy, buduje z niej strumień zdarzeń w kształcie, którego oczekuje
 * `deriveFindingsFromEvents`, i wpisuje do bazy WYPRODUKOWANE PRZEZ SILNIK
 * pola narracyjne. Potem renderuje raport tym samym łańcuchem co trasa.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from 'pg';

const ORG = 'demo-metalpol-org';
const SESSION = 'demo-metalpol-session';

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const { rows } = await pg.query<{
    unit_id: string;
    current_level: string;
    target_level: string;
  }>(
    `SELECT f.unit_id, f.current_level, f.target_level
       FROM method_findings f JOIN method_outputs o ON o.id = f.output_id
      WHERE o.session_id = $1 ORDER BY f.unit_id`,
    [SESSION]
  );

  const { deriveFindingsFromEvents } = await import(
    '../../server/src/method-core/outputs/EventDerivedOutputBridge.js'
  );

  const events: any[] = [];
  let n = 0;
  for (const row of rows) {
    n += 1;
    events.push({
      id: `probe-ans-${n}`,
      type: 'ANSWER_CONFIRMED',
      unitId: row.unit_id,
      level: Number(row.current_level),
      payload: {},
    });
    events.push({
      id: `probe-ev-${n}`,
      type: 'EVIDENCE_ATTACHED',
      unitId: row.unit_id,
      payload: { evidenceId: `probe-ev-${n}`, evidenceType: 'document', strength: 'E2' },
    });
    events.push({
      id: `probe-dec-${n}`,
      type: 'DECISION_APPROVED',
      unitId: row.unit_id,
      level: Number(row.target_level),
      payload: { subject: 'target_level' },
    });
  }

  const derived = deriveFindingsFromEvents(events);
  console.log(`silnik wyprodukował findingi: ${derived.findings.length}`);

  for (const f of derived.findings) {
    await pg.query(
      `UPDATE method_findings SET business_meaning = $1, recommendation = $2,
              expected_outcome = $3, risk_or_opportunity = $4, root_cause_hypothesis = $5,
              prerequisite = $6, priority_rationale = $7, confidence = $8
        WHERE unit_id = $9 AND organization_id = $10`,
      [
        f.businessMeaning,
        f.recommendation,
        f.expectedOutcome,
        f.riskOrOpportunity,
        f.rootCauseHypothesis,
        f.prerequisite,
        f.priorityRationale,
        f.confidence,
        f.unitId,
        ORG,
      ]
    );
  }
  await pg.end();

  const { assessmentReportContractService } = await import(
    '../../server/src/services/assessment/assessmentReportContractService.js'
  );
  const { buildAssessmentDrdReportSchema } = await import(
    '../../server/src/services/assessment/assessmentDrdReportSchemaService.js'
  );
  const { renderDocumentSchemaToDocxBuffer } = await import(
    '../../server/src/services/documentStudio/documentDocxRenderer.js'
  );

  const contract = await assessmentReportContractService.build(ORG, SESSION);
  const schema = buildAssessmentDrdReportSchema(contract);
  const buffer = await renderDocumentSchemaToDocxBuffer(schema);

  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(here, '..', '..', 'evidence', 'raport-oceny');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, 'raport-oceny-drd-sesja-produktowa.docx'), buffer);
  console.log(`DOCX: ${buffer.length} bajtów`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
