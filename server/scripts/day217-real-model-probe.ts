/**
 * Day217 R3 — standalone tsx probe. Never run under Vitest: tests/setup.ts
 * replaces global.fetch. Exactly two chat turns are made: READ ON and READ OFF.
 *
 * FIX-217-3-cont (dyżur kontynuacji, 31.08.2026): pierwsza wersja tego skryptu
 * czytała organizationId/userId z artefaktu `day217-chain.json` zapisanego
 * przez `tests/integration/day217-gf-agt-02.realdb.test.ts`. Ten test w
 * `afterAll` NIE kasuje organizacji/usera/membershipu (tylko usuwa własny
 * wiersz `llm_providers`), więc dane fixture SĄ nadal w bazie — ale każde
 * kolejne uruchomienie testu (np. do zweryfikowania FIX-217-1/2) nadpisuje
 * `day217-chain.json` NOWYM organizationId, a stary wiersz-fixture zostaje z
 * poprzedniego przebiegu. To NIE był powód 403 (zmierzone: właściwy wiersz
 * `organization_members` status=ACTIVE istniał i pasował do aktualnego pliku).
 * Prawdziwa przyczyna 403 `ORG_MEMBERSHIP_REVOKED`: `server/src/database/
 * Database.ts:79-85` — gdy `NODE_ENV=test` i `RUN_DB_TESTS !== '1'` (a ten
 * skrypt, uruchamiany bezpośrednio przez tsx, nigdy nie ustawiał tej
 * zmiennej — ustawiał ją tylko vitest test), `getDatabaseInstance()` cicho
 * przełącza się na MOCK bazy (dokładnie pułapka (a) opisana w
 * `tests/integration/_helpers/assertRealPostgres.ts`). Zmierzone bezpośrednio:
 * surowy `pg.Pool` na tym samym DATABASE_URL widział wiersz membership,
 * `DbPromise.get()` (którego używa `requireActiveChatMembership`,
 * `ai.routes.ts:125-151`) zwracał `null` — czyli trafiał w atrapę, nie w
 * realny Postgres. `requireActiveChatMembership` i `accessPolicyService` NIE
 * zostały ruszone; naprawiona jest wyłącznie zmienna środowiskowa sondy.
 *
 * Ta wersja jest w pełni SAMODZIELNA: zamiast czytać cudzy fixture, zakłada
 * WŁASNĄ organizację/usera/membership/projekt/politykę (1:1 wzorzec
 * `day217-gf-agt-02.realdb.test.ts:66-96`) i sama tworzy dokument w bazie
 * wiedzy z unikalnym znacznikiem (realną drogą: POST
 * /api/document-studio/generate, jak w teście), żeby bramka (b) miała czego
 * szukać. `requireActiveChatMembership` i `accessPolicyService` — bez zmian.
 */
process.env.RUN_DB_TESTS = '1';
process.env.MOCK_DB = 'false';
process.env.INTERNAL_TOOLS_ENABLED = 'true';
process.env.INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS = 'test.invalid';
// Without this the document-studio/generate call never indexes into
// knowledge_docs/ai_knowledge_embeddings (FeatureFlags.ts:279 reads
// process.env fresh at index-time) — the same flag the day217 chain test
// sets at its own module top.
process.env.ENABLE_ARTIFACT_KNOWLEDGE_INDEX = 'true';

import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

import express from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';

import { ApiGateway } from '../src/Gateway.js';
import config from '../src/config/Config.js';
import { featureFlags } from '../src/config/FeatureFlags.js';
import llmConfigService from '../src/services/ai/llmConfigService.js';
import { get as dbGet } from '../src/utils/DbPromise.js';

const OUTPUT = '/private/tmp/cx-day217-gf-agt-02-artefakty/day217-real-model.json';

function parseEvents(text: string): any[] {
  return String(text || '').split('\n').filter((line) => line.startsWith('data: ')).map((line) => {
    const payload = line.slice(6);
    if (payload === '[DONE]') return null;
    try { return JSON.parse(payload); } catch { return { type: 'raw', payload }; }
  }).filter(Boolean);
}

function eventText(events: any[]): string {
  return events.map((event) => [event.content, event.text, event.delta, event.message].filter((value) => typeof value === 'string').join(' ')).join(' ');
}

async function main() {
  if (process.env.DB_TYPE !== 'postgres') throw new Error(`DB_TYPE=${process.env.DB_TYPE || '<absent>'}`);
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY absent; modelu nie wolalem.');

  const databaseUrl = process.env.DATABASE_URL ?? '';
  const pool = new Pool({ connectionString: databaseUrl });

  // Self-contained fixture — 1:1 wzorzec day217-gf-agt-02.realdb.test.ts beforeAll.
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const marker = `ZNACZNIK-DAY217-R3-${randomUUID().slice(0, 8)}`;

  await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [organizationId, 'Day217 R3 probe org']);
  // Ta sama poprawka co FIX-217-3 w teście: bez tego TRIAL grace (3 wywołania
  // AI, accessPolicyService.ts:398-416) blokuje sondę kodem
  // TRIAL_PROFILE_INCOMPLETE. Uzupełnienie fixture, nie osłabienie bramki.
  await pool.query(`UPDATE organizations SET onboarding_status='ORG_SETUP_COMPLETED' WHERE id=$1`, [organizationId]);
  await pool.query(
    `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
     VALUES($1,$2,$3,'unused','OWNER','active',1)`,
    [userId, organizationId, `day217-r3-${userId}@test.invalid`]
  );
  await pool.query(
    `INSERT INTO organization_members(id,organization_id,user_id,role,status)
     VALUES($1,$2,$3,'OWNER','ACTIVE')`,
    [randomUUID(), organizationId, userId]
  );
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS governance_settings TEXT DEFAULT '{}'`);
  await pool.query(`INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,'Day217 R3 project','active',$3)`, [projectId, organizationId, userId]);
  await pool.query(`INSERT INTO project_ai_settings(project_id,ai_role) VALUES($1,'OPERATOR')`, [projectId]);
  await pool.query(`INSERT INTO ai_policies(id,organization_id,name,policy_level,max_policy_level) VALUES($1,$2,'Day217 R3 policy','ASSISTED','ASSISTED')`, [randomUUID(), organizationId]);

  await llmConfigService.initialize();
  const provider = await dbGet<any>(`SELECT provider, CASE WHEN COALESCE(api_key,'')<>'' THEN 'TAK' ELSE 'NIE' END has_key FROM llm_providers WHERE provider='openrouter' AND is_default=true AND is_active=true LIMIT 1`).catch(() => null);
  console.log(`DAY217_PROVIDER database=${provider?.provider || 'brak wiersza'} key=${provider?.has_key || 'NIE'} env=TAK`);

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  ApiGateway.getInstance().initializeRoutes(app);
  const token = jwt.sign({ id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER', email: `day217-r3-${userId}@test.invalid` }, config.JWT_SECRET, { expiresIn: '30m' });

  // Seed the knowledge document a real conversation would need to cite —
  // real HTTP route, same as the R1-R3 chain test (useLlm:false: no model
  // call here, this only exercises the document/knowledge-index pipeline).
  const docTitle = `Day217 R3 probe topic ${marker}`;
  const generated = await request(app).post('/api/document-studio/generate').set('Authorization', `Bearer ${token}`).send({
    intake: { title: docTitle, description: `Poufny materiał ${marker}`, documentType: 'executive_memo', confidentiality: 'internal' },
    useLlm: false,
  });
  if (generated.status !== 200) throw new Error(`document-studio/generate failed: ${generated.status} ${JSON.stringify(generated.body)}`);
  const artifactId = String(generated.body.artifactId);
  const knowledgeId = `generated-document-${artifactId}`;
  let indexed = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    const row = await pool.query(`SELECT id FROM knowledge_docs WHERE id=$1`, [knowledgeId]);
    if (row.rows[0]) { indexed = true; break; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!indexed) throw new Error(`knowledge_docs row for ${knowledgeId} never appeared — cannot prove (b) without it.`);
  console.log(`DAY217_KB_SEED knowledgeId=${knowledgeId} marker=${marker}`);

  const prompt = `Co wiadomo o dokumencie zatytułowanym „${docTitle}”? Sprawdź dostępne materiały i podaj najważniejszy szczegół.`;

  const turn = async (enabled: boolean, conversationId: string) => {
    (featureFlags as any).ENABLE_TERESA_TOOL_LOOP = enabled;
    const started = Date.now();
    const response = await request(app).post('/api/ai/chat/stream').set('Authorization', `Bearer ${token}`).send({ message: prompt, history: [], conversationId, context: { projectId } });
    const events = parseEvents(response.text);
    const text = eventText(events);
    const toolSteps = events.filter((event) => event.type === 'tool_step');
    console.log(`DAY217_REAL_TURN read=${enabled ? 'ON' : 'OFF'} status=${response.status} durationMs=${Date.now() - started} toolSteps=${toolSteps.length} marker=${text.includes(marker) ? 'TAK' : 'NIE'}`);
    console.log(`DAY217_REAL_TOOL_STEPS ${JSON.stringify(toolSteps)}`);
    console.log(`DAY217_REAL_ANSWER ${JSON.stringify(text)}`);
    return { enabled, status: response.status, durationMs: Date.now() - started, toolSteps, text, markerPresent: text.includes(marker), events };
  };

  const on = await turn(true, `day217-r3-on-${Date.now()}`);
  const off = await turn(false, `day217-r3-off-${Date.now()}`);
  const result = { modelBudget: { runs: 2, ceilingRounds: 5 }, model: 'platform-selected OpenRouter tool-capable route', fixture: { organizationId, userId, projectId, knowledgeId, docTitle }, marker, prompt, on, off };
  await writeFile(OUTPUT, JSON.stringify(result, null, 2));
  await pool.end();
  if (!(on.status === 200 && on.toolSteps.length > 0 && on.markerPresent && off.status === 200 && off.toolSteps.length === 0 && !off.markerPresent)) process.exitCode = 2;
}

main().catch((error) => { console.error(`DAY217_REAL_STOP ${String(error?.message || error)}`); process.exitCode = 1; }).finally(() => process.exit(process.exitCode || 0));
