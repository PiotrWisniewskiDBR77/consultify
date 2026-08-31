/**
 * Day217 R5 — standalone tsx probe. Never run under Vitest: tests/setup.ts
 * replaces global.fetch. Exactly two chat turns are made: READ ON and READ OFF.
 */
import { readFile, writeFile } from 'node:fs/promises';

import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { ApiGateway } from '../src/Gateway.js';
import config from '../src/config/Config.js';
import { featureFlags } from '../src/config/FeatureFlags.js';
import llmConfigService from '../src/services/ai/llmConfigService.js';
import { get as dbGet } from '../src/utils/DbPromise.js';

const INPUT = '/private/tmp/cx-day217-gf-agt-02-artefakty/day217-chain.json';
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
  const proof = JSON.parse(await readFile(INPUT, 'utf8'));
  const fixture = proof.fixture;
  const subject = proof.runs[proof.runs.length - 1];
  if (!fixture?.organizationId || !fixture?.userId || !subject?.marker) throw new Error('Day217 fixture evidence missing.');

  await llmConfigService.initialize();
  const provider = await dbGet<any>(`SELECT provider, CASE WHEN COALESCE(api_key,'')<>'' THEN 'TAK' ELSE 'NIE' END has_key FROM llm_providers WHERE provider='openrouter' LIMIT 1`).catch(() => null);
  console.log(`DAY217_PROVIDER database=${provider?.provider || 'brak wiersza'} key=${provider?.has_key || 'NIE'} env=TAK`);

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  ApiGateway.getInstance().initializeRoutes(app);
  const token = jwt.sign({ id: fixture.userId, userId: fixture.userId, organizationId: fixture.organizationId, organization_id: fixture.organizationId, role: 'OWNER' }, config.JWT_SECRET, { expiresIn: '30m' });
  const prompt = 'Co wiadomo o dokumencie zatytułowanym „Day217 knowledge topic run 3”? Sprawdź dostępne materiały i podaj najważniejszy szczegół.';

  const turn = async (enabled: boolean, conversationId: string) => {
    (featureFlags as any).ENABLE_TERESA_TOOL_LOOP = enabled;
    const started = Date.now();
    const response = await request(app).post('/api/ai/chat/stream').set('Authorization', `Bearer ${token}`).send({ message: prompt, history: [], conversationId, context: { projectId: fixture.projectId } });
    const events = parseEvents(response.text);
    const text = eventText(events);
    const toolSteps = events.filter((event) => event.type === 'tool_step');
    console.log(`DAY217_REAL_TURN read=${enabled ? 'ON' : 'OFF'} status=${response.status} durationMs=${Date.now() - started} toolSteps=${toolSteps.length} marker=${text.includes(subject.marker) ? 'TAK' : 'NIE'}`);
    console.log(`DAY217_REAL_TOOL_STEPS ${JSON.stringify(toolSteps)}`);
    console.log(`DAY217_REAL_ANSWER ${JSON.stringify(text)}`);
    return { enabled, status: response.status, durationMs: Date.now() - started, toolSteps, text, markerPresent: text.includes(subject.marker), events };
  };

  const on = await turn(true, `day217-real-on-${Date.now()}`);
  const off = await turn(false, `day217-real-off-${Date.now()}`);
  const result = { modelBudget: { runs: 2, ceilingRounds: 5 }, model: 'platform-selected OpenRouter tool-capable route', marker: subject.marker, prompt, on, off };
  await writeFile(OUTPUT, JSON.stringify(result, null, 2));
  if (!(on.status === 200 && on.toolSteps.length > 0 && on.markerPresent && off.status === 200 && off.toolSteps.length === 0 && !off.markerPresent)) process.exitCode = 2;
}

main().catch((error) => { console.error(`DAY217_REAL_STOP ${String(error?.message || error)}`); process.exitCode = 1; });
