/** @vitest-environment node */
//
// FIX-1 (ODBIOR_231, P0) — dowód mutacyjny: `source_type` musi opisywać FAKT
// wykonania gałęzi wiedzy (`groundedOutlineUsed` w
// presentationGeneratorService.ts), a nie samą wartość flagi
// `isDeckFromKnowledgeEnabled()`. Cztery producenccy wołacze `generateOutline`
// (presentationStudioOrchestrationService.ts:723,
// notebookConversionService.ts:469, v8/artifactRegistryService.ts:4322,
// deliverablesGenerationService.ts:214) wywołują funkcję BEZ trzeciego
// argumentu `actor` — przed FIX-1, przy fladze ON, taki deck i tak dostawał
// stempel 'org_knowledge_outline', mimo że konspekt powstał z szablonu/
// domyślnej ścieżki, nie z wiedzy organizacji.
//
// Mockujemy WYŁĄCZNIE granicę `generateKnowledgeOutline` (analogicznie do
// R5b audytora, który podmienił wyłącznie `llmService.callStream`) — cała
// reszta `generateOutline` (planowanie, INSERT) leci przez prawdziwy Postgres.

import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const groundedOutline = {
  outline: [
    {
      tytul: 'Wynik pilotażu',
      teza: 'Retencja osiągnęła 63,4% wobec 51,2% w grupie kontrolnej.',
      archetyp: 'performance_overview',
      zrodla: [{ typ: 'knowledge_doc', id: 'raport-pilotazu', etykieta: 'Raport pilotażu' }],
    },
  ],
  provider: 'mock',
  model: 'mock',
};

const generateKnowledgeOutlineMock = vi.fn(async () => groundedOutline);

vi.mock('../presentationKnowledgeOutlineService.js', () => ({
  generateKnowledgeOutline: (...args: unknown[]) => generateKnowledgeOutlineMock(...args),
}));

describe('Day231 FIX-1 — source_type reflects the FACT of the knowledge branch, not the flag', { retry: 0 }, () => {
  const organizationId = randomUUID();
  const deckIds: string[] = [];
  let pool: Pool;
  let originalFlag: string | undefined;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_DB).toBe('false');
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(
      `INSERT INTO organizations(id,name,plan,status) VALUES($1,$2,'enterprise','active')`,
      [organizationId, 'Day231 FIX-1 provenance org']
    );
    originalFlag = process.env.ENABLE_DECK_FROM_KNOWLEDGE;
  }, 30_000);

  afterAll(async () => {
    if (originalFlag === undefined) delete process.env.ENABLE_DECK_FROM_KNOWLEDGE;
    else process.env.ENABLE_DECK_FROM_KNOWLEDGE = originalFlag;
    if (pool) {
      for (const id of deckIds) await pool.query('DELETE FROM presentation_decks WHERE id=$1', [id]);
      await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
      await pool.end();
    }
  });

  function baseSetup() {
    return {
      title: 'Day231 FIX-1',
      audience: 'executive' as const,
      goal: 'decide' as const,
      language: 'pl' as const,
      theme: 'corporate' as const,
      confidentiality: 'internal' as const,
      sourceArtifacts: [],
    };
  }

  it('GRANTED: flag ON + actor.userId present -> knowledge branch runs -> stamped org_knowledge_outline', async () => {
    process.env.ENABLE_DECK_FROM_KNOWLEDGE = 'true';
    generateKnowledgeOutlineMock.mockClear();
    const { generateOutline } = await import('../presentationGeneratorService.js');
    const userId = randomUUID();
    const result = await generateOutline(baseSetup(), organizationId, { userId });
    deckIds.push(result.deckId);

    expect(generateKnowledgeOutlineMock).toHaveBeenCalledTimes(1);
    const stored = await pool.query<{ source_type: string; source_id: string | null }>(
      `SELECT source_type, source_id FROM presentation_decks WHERE id=$1`,
      [result.deckId]
    );
    expect(stored.rows[0].source_type).toBe('org_knowledge_outline');
  }, 30_000);

  it('DENIED: flag ON but NO actor (4 producer callers) -> knowledge branch NEVER runs -> deck NOT stamped', async () => {
    process.env.ENABLE_DECK_FROM_KNOWLEDGE = 'true';
    generateKnowledgeOutlineMock.mockClear();
    const { generateOutline } = await import('../presentationGeneratorService.js');
    // Exact call shape of presentationStudioOrchestrationService.ts:723 /
    // notebookConversionService.ts:469 / v8/artifactRegistryService.ts:4322 /
    // deliverablesGenerationService.ts:214 — no third argument at all.
    const result = await generateOutline(baseSetup(), organizationId);
    deckIds.push(result.deckId);

    expect(generateKnowledgeOutlineMock).not.toHaveBeenCalled();
    const stored = await pool.query<{ source_type: string; source_id: string | null }>(
      `SELECT source_type, source_id FROM presentation_decks WHERE id=$1`,
      [result.deckId]
    );
    expect(stored.rows[0].source_type).not.toBe('org_knowledge_outline');
    expect(stored.rows[0].source_type).toBe('manual');
  }, 30_000);
});
