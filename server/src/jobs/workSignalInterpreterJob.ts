import { runInterpretationForOrganization } from '../services/signals/signalInterpreter.js';
import { queryAll } from '../utils/queryHelpers.js';

const db = { query: queryAll };

export async function runInterpretationTick() {
  const organizations = await queryAll<{ id: string }>(
    `SELECT id FROM organizations WHERE lower(coalesce(status,'active'))='active'
      AND coalesce(is_active::text,'1') IN ('1','true') ORDER BY id`
  );
  const results = [];
  for (const organization of organizations) {
    results.push(await runInterpretationForOrganization({ organizationId: organization.id, db }));
  }
  return results;
}
