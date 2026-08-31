/**
 * Moduł 17 — KROK 2: weryfikacja BEZ MODELU (atrapa).
 *
 * Cel: udowodnić, PRZED wydaniem budżetu na realny model, że:
 *  (i)   HTTP POST /api/ai/chat/stream odpowiada 200,
 *  (ii)  SSE events są niepuste,
 *  (iii) wywołanie narzędzia search_knowledge_base (REALNA ścieżka
 *        produkcyjna: executeReadTool -> executeToolCall -> executeKBSearch ->
 *        KnowledgeService.getDocuments -> ragService.hybridSearch) realnie
 *        zwraca treść zawierającą rozstrzygający fakt osadzony w dokumencie.
 *
 * Atrapa dotyczy WYŁĄCZNIE modelu: `llmService.callStream` jest podmieniane
 * na stały obiekt, który i tak wywołuje PRAWDZIWY `context.executeReadTool`
 * (dokładnie ten sam callback, który ai.routes.ts okablowuje na realny
 * `executeToolCall` + realne zdarzenia SSE `tool_step`) z argumentami, jakich
 * spodziewamy się po modelu (vault_scope="project", vault_project_id=<NAZWA
 * projektu>, zgodnie z FIX-217 name-resolution). Nic w warstwie
 * dostępu/polityki nie jest omijane — atrapa stoi wyłącznie w miejscu
 * "co zdecydowałby model", nie w miejscu "co robi narzędzie".
 *
 * Uruchomienie:
 *   NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:6511/consultinity \
 *   npx tsx server/scripts/modul17-mock-verify.ts
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
import KnowledgeService from '../src/services/KnowledgeService.js';
import { llmService } from '../src/services/ai/llmService.js';

const OUTPUT = '/private/tmp/cx-m17final-artefakty/modul17-krok2-mock-verify.json';

// ★ Rozstrzygający fakt — WYŁĄCZNIE w treści dokumentu, NIGDY w prompcie.
const PILOT_CODE = `Marchewka-7-${randomUUID().slice(0, 4)}`;
const RETENTION_PCT = '63,4%';

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

async function main() {
  if (process.env.DB_TYPE !== 'postgres') throw new Error(`DB_TYPE=${process.env.DB_TYPE || '<absent>'}`);

  const databaseUrl = process.env.DATABASE_URL ?? '';
  const pool = new Pool({ connectionString: databaseUrl });

  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const projectName = `Pilotaż Retencji Klienci Premium ${randomUUID().slice(0, 6)}`;
  const docId = randomUUID();

  await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
    organizationId,
    'Modul17 KROK2 mock-verify org',
  ]);
  await pool.query(`UPDATE organizations SET onboarding_status='ORG_SETUP_COMPLETED' WHERE id=$1`, [
    organizationId,
  ]);
  await pool.query(
    `INSERT INTO users(id,organization_id,email,password,role,status,email_verified)
     VALUES($1,$2,$3,'unused','OWNER','active',1)`,
    [userId, organizationId, `modul17-k2-${userId}@test.invalid`]
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
    `INSERT INTO ai_policies(id,organization_id,name,policy_level,max_policy_level) VALUES($1,$2,'Modul17 K2 policy','ASSISTED','ASSISTED')`,
    [randomUUID(), organizationId]
  );

  // Dokument osadzony BEZPOŚREDNIO w Vault (scope='project') — 1:1 wzorzec
  // fix217.vaultProjectNameContract.pg.test.ts (KnowledgeService.addDocument
  // + processDocument), NIE przez document-studio/generate (ta ścieżka nigdy
  // nie produkuje scope='project' — inferKnowledgeScope zna tylko
  // 'user'/'organization').
  const docTitle = 'Raport z pilotażu programu retencji Q2';
  const docContent = `# Raport z pilotażu programu retencji\n\n## Kontekst\nPilotaż programu lojalnościowego objął grupę klientów segmentu premium w drugim kwartale. Celem było sprawdzenie, czy nowy model komunikacji utrzyma klientów dłużej niż w grupie kontrolnej.\n\n## Wyniki\nWskaźnik retencji w pilocie ${PILOT_CODE} wyniósł ${RETENTION_PCT} po dwunastu tygodniach obserwacji, wobec 51,2% w grupie kontrolnej.\n\n## Wnioski\nWynik uzasadnia rozszerzenie programu na kolejny kwartał.\n`;

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
  console.log(`MOCK_KB_SEED docId=${docId} chunkCount=${chunkCount} project=${projectName}`);

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
      email: `modul17-k2-${userId}@test.invalid`,
    },
    config.JWT_SECRET,
    { expiresIn: '30m' }
  );

  // Ten sam prompt co planowany dla KROK 3: wyłącznie NAZWA projektu, zero
  // znacznika, zero faktu z treści dokumentu.
  const prompt = `Jaki wynik osiągnął pilot opisany w materiałach projektu „${projectName}”? Sprawdź dostępne materiały projektowe i podaj konkretny wynik.`;

  (featureFlags as any).ENABLE_TERESA_TOOL_LOOP = true;

  let capturedToolResult: string | null = null;
  let capturedToolArgs: Record<string, unknown> | null = null;
  const originalCallStream = llmService.callStream.bind(llmService);
  (llmService as any).callStream = async (params: any) => {
    const executeReadTool = params?.context?.executeReadTool;
    if (typeof executeReadTool !== 'function') {
      throw new Error('ATRAPA: executeReadTool context missing — real tool-loop wiring not reached.');
    }
    // Argumenty, jakich spodziewamy się po modelu w KROK 3: zasięg PROJEKTU,
    // identyfikator projektu podany jako NAZWA (nie UUID) — dokładnie
    // ścieżka FIX-217 name-resolution.
    capturedToolArgs = {
      query: `wynik pilotu retencji w projekcie ${projectName}`,
      vault_scope: 'project',
      vault_project_id: projectName,
    };
    capturedToolResult = (await executeReadTool('search_knowledge_base', capturedToolArgs)) as string;
    return {
      stream: (async function* () {
        yield `[ATRAPA-KROK2] narzędzie zwróciło dane (długość ${String(capturedToolResult || '').length} znaków).`;
      })(),
      usagePromise: Promise.resolve({ promptTokens: 1, completionTokens: 1 }),
    };
  };

  let status = 0;
  let events: any[] = [];
  let httpError: string | null = null;
  try {
    const response = await request(app)
      .post('/api/ai/chat/stream')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: prompt, history: [], conversationId: `modul17-k2-${Date.now()}`, context: { projectId } });
    status = response.status;
    events = parseEvents(response.text);
  } catch (error: any) {
    httpError = String(error?.message || error);
  } finally {
    (llmService as any).callStream = originalCallStream;
  }

  const toolResultStr = String(capturedToolResult || '');
  const factPresent = toolResultStr.includes(PILOT_CODE) && toolResultStr.includes(RETENTION_PCT);

  console.log(`MOCK_HTTP status=${status} eventsCount=${events.length} httpError=${httpError || 'brak'}`);
  console.log(`MOCK_TOOL_ARGS ${JSON.stringify(capturedToolArgs)}`);
  console.log(`MOCK_TOOL_RESULT ${toolResultStr}`);
  console.log(`MOCK_FACT_PRESENT pilotCode=${toolResultStr.includes(PILOT_CODE)} retentionPct=${toolResultStr.includes(RETENTION_PCT)} overall=${factPresent}`);

  const pass = status === 200 && events.length > 0 && factPresent;
  console.log(`MOCK_VERDICT ${pass ? 'PASS' : 'FAIL'}`);

  await writeFile(
    OUTPUT,
    JSON.stringify(
      {
        fixture: { organizationId, userId, projectId, projectName, docId, docTitle, pilotCode: PILOT_CODE, retentionPct: RETENTION_PCT },
        prompt,
        http: { status, eventsCount: events.length, httpError, events },
        tool: { args: capturedToolArgs, result: capturedToolResult, factPresent },
        verdict: pass ? 'PASS' : 'FAIL',
      },
      null,
      2
    )
  );

  await pool.end();
  if (!pass) process.exitCode = 2;
}

main()
  .catch((error) => {
    console.error(`MOCK_STOP ${String(error?.message || error)}`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode || 0));
