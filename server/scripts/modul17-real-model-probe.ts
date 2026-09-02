/**
 * Moduł 17 — KROK 3: JEDEN przebieg realnego modelu (dokładnie jeden,
 * budżet zatwierdzony przez CTO). Standalone tsx probe — nigdy pod Vitest
 * (tests/setup.ts podmienia global.fetch). Dokładnie dwie tury: READ ON i
 * READ OFF, tak jak day217-real-model-probe.ts.
 *
 * Różnica względem day217-real-model-probe.ts (naprawa kryterium (b) z
 * docs/program/funkcje/MODUL17_DOWOD_REALNYM_MODELEM.md):
 *
 * 1. Znacznik NIE jest w tytule dokumentu. Dokument jest seedowany
 *    BEZPOŚREDNIO do Vault jako scope='project' (KnowledgeService.addDocument
 *    + processDocument — 1:1 wzorzec fix217.vaultProjectNameContract.pg.test.ts),
 *    a rozstrzygający FAKT (nazwa własna + liczba, których model nie może
 *    znać ani zgadnąć) siedzi WYŁĄCZNIE w treści dokumentu.
 * 2. Prompt zawiera WYŁĄCZNIE nazwę projektu (nigdy tytuł dokumentu, nigdy
 *    fakt) i celowo prowadzi do zasięgu PROJEKTU: "materiały projektu „X"".
 * 3. Kryterium (b) to obecność faktu (nazwa własna + liczba) w ODPOWIEDZI
 *    modelu — parafraza dozwolona, dosłowny cytat NIE jest wymagany.
 *
 * Uruchomienie:
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:6511/consultinity \
 *   OPENROUTER_API_KEY=... \
 *   npx tsx server/scripts/modul17-real-model-probe.ts
 */
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.RUN_DB_TESTS = '1';
process.env.MOCK_DB = 'false';
process.env.INTERNAL_TOOLS_ENABLED = 'true';
process.env.INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS = 'test.invalid';

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
import KnowledgeService from '../src/services/KnowledgeService.js';
import { get as dbGet } from '../src/utils/DbPromise.js';

const OUTPUT = '/private/tmp/cx-m17final-artefakty/modul17-krok3-real-model.json';

function parseEvents(text: string): any[] {
  return String(text || '')
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => {
      const payload = line.slice(6);
      if (payload === '[DONE]') return null;
      try {
        return JSON.parse(payload);
      } catch {
        return { type: 'raw', payload };
      }
    })
    .filter(Boolean);
}

function eventText(events: any[]): string {
  return events
    .map((event) =>
      [event.content, event.text, event.delta, event.message].filter((value) => typeof value === 'string').join(' ')
    )
    .join(' ');
}

function factPresentIn(text: string, pilotCode: string): boolean {
  const normalized = String(text || '');
  const hasCode = normalized.toLowerCase().includes(pilotCode.toLowerCase());
  const hasNumber = /63[.,]4/.test(normalized);
  return hasCode && hasNumber;
}

async function main() {
  if (process.env.DB_TYPE !== 'postgres') throw new Error(`DB_TYPE=${process.env.DB_TYPE || '<absent>'}`);
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY absent; modelu nie wolalem.');

  const databaseUrl = process.env.DATABASE_URL ?? '';
  const pool = new Pool({ connectionString: databaseUrl });

  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const projectName = `Pilotaż Retencji Klienci Premium ${randomUUID().slice(0, 6)}`;
  const docId = randomUUID();
  const pilotCode = `Marchewka-7-${randomUUID().slice(0, 4)}`;
  const retentionPct = '63,4%';

  await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
    organizationId,
    'Modul17 KROK3 real-model probe org',
  ]);
  await pool.query(`UPDATE organizations SET onboarding_status='ORG_SETUP_COMPLETED' WHERE id=$1`, [organizationId]);
  await pool.query(
    `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
     VALUES($1,$2,$3,'unused','OWNER','active',1)`,
    [userId, organizationId, `modul17-k3-${userId}@test.invalid`]
  );
  await pool.query(
    `INSERT INTO organization_members(id,organization_id,user_id,role,status)
     VALUES($1,$2,$3,'OWNER','ACTIVE')`,
    [randomUUID(), organizationId, userId]
  );
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS governance_settings TEXT DEFAULT '{}'`);
  await pool.query(`INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,$3,'active',$4)`, [
    projectId,
    organizationId,
    projectName,
    userId,
  ]);
  await pool.query(`INSERT INTO project_ai_settings(project_id,ai_role) VALUES($1,'OPERATOR')`, [projectId]);
  await pool.query(
    `INSERT INTO ai_policies(id,organization_id,name,policy_level,max_policy_level) VALUES($1,$2,'Modul17 K3 policy','ASSISTED','ASSISTED')`,
    [randomUUID(), organizationId]
  );

  await llmConfigService.initialize();
  const provider = await dbGet<any>(
    `SELECT provider, CASE WHEN COALESCE(api_key,'')<>'' THEN 'TAK' ELSE 'NIE' END has_key FROM llm_providers WHERE provider='openrouter' AND is_default=true AND is_active=true LIMIT 1`
  ).catch(() => null);
  console.log(`K3_PROVIDER database=${provider?.provider || 'brak wiersza'} key=${provider?.has_key || 'NIE'} env=TAK`);

  // Dokument osadzony BEZPOŚREDNIO w Vault jako scope='project' — rozstrzygający
  // fakt (nazwa własna + liczba) WYŁĄCZNIE w treści, nigdy w tytule/prompt.
  const docTitle = 'Raport z pilotażu programu retencji Q2';
  const docContent = `# Raport z pilotażu programu retencji\n\n## Kontekst\nPilotaż programu lojalnościowego objął grupę klientów segmentu premium w drugim kwartale. Celem było sprawdzenie, czy nowy model komunikacji utrzyma klientów dłużej niż w grupie kontrolnej.\n\n## Wyniki\nWskaźnik retencji w pilocie ${pilotCode} wyniósł ${retentionPct} po dwunastu tygodniach obserwacji, wobec 51,2% w grupie kontrolnej.\n\n## Wnioski\nWynik uzasadnia rozszerzenie programu na kolejny kwartał.\n`;

  await KnowledgeService.addDocument(
    `${docTitle}.md`,
    `vault://project/${projectId}/${docId}.md`,
    organizationId,
    projectId,
    Buffer.byteLength(docContent, 'utf8'),
    'report',
    ['pilot', 'retencja'],
    docId,
    userId,
    'project'
  );
  const chunkCount = await KnowledgeService.processDocument(docId, docContent, organizationId);
  console.log(`K3_KB_SEED docId=${docId} chunkCount=${chunkCount} project=${projectName} pilotCode=${pilotCode}`);

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  ApiGateway.getInstance().initializeRoutes(app);
  const token = jwt.sign(
    {
      id: userId,
      userId,
      organizationId,
      organization_id: organizationId,
      role: 'OWNER',
      email: `modul17-k3-${userId}@test.invalid`,
    },
    config.JWT_SECRET,
    { expiresIn: '30m' }
  );

  // Prompt: WYŁĄCZNIE nazwa projektu. Zero znacznika, zero faktu, zero
  // tytułu dokumentu. Naturalnie prowadzi do zasięgu PROJEKTU (nie
  // organizacji) przez sformułowanie "materiały projektu".
  const prompt = `Jaki wynik osiągnął pilot opisany w materiałach projektu „${projectName}”? Sprawdź dostępne materiały projektowe i podaj konkretny wynik.`;

  const turn = async (enabled: boolean, conversationId: string) => {
    (featureFlags as any).ENABLE_TERESA_TOOL_LOOP = enabled;
    const started = Date.now();
    const response = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: prompt, history: [], conversationId, context: { projectId } });
    const events = parseEvents(response.text);
    const text = eventText(events);
    const toolSteps = events.filter((event) => event.type === 'tool_step');
    const factPresent = factPresentIn(text, pilotCode);
    console.log(
      `K3_REAL_TURN read=${enabled ? 'ON' : 'OFF'} status=${response.status} durationMs=${Date.now() - started} toolSteps=${toolSteps.length} factPresent=${factPresent ? 'TAK' : 'NIE'}`
    );
    console.log(`K3_REAL_TOOL_STEPS ${JSON.stringify(toolSteps)}`);
    console.log(`K3_REAL_ANSWER ${JSON.stringify(text)}`);
    return { enabled, status: response.status, durationMs: Date.now() - started, toolSteps, text, factPresent, events };
  };

  const on = await turn(true, `modul17-k3-on-${Date.now()}`);
  const off = await turn(false, `modul17-k3-off-${Date.now()}`);
  const result = {
    modelBudget: { runs: 2, ceilingRounds: 5 },
    model: 'platform-selected OpenRouter tool-capable route',
    fixture: { organizationId, userId, projectId, projectName, docId, docTitle, pilotCode, retentionPct },
    prompt,
    on,
    off,
    gate: {
      a_modelCalledToolItself: on.toolSteps.length > 0,
      b_factFromContentInAnswer: on.factPresent,
      c_flagOffZeroSteps: off.toolSteps.length === 0,
    },
  };
  await writeFile(OUTPUT, JSON.stringify(result, null, 2));
  await pool.end();
  if (!(on.status === 200 && on.toolSteps.length > 0 && on.factPresent && off.status === 200 && off.toolSteps.length === 0)) {
    process.exitCode = 2;
  }
}

main()
  .catch((error) => {
    console.error(`K3_REAL_STOP ${String(error?.message || error)}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode || 0));
