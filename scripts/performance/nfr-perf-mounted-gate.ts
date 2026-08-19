#!/usr/bin/env npx tsx
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

import { NFR_PERF_AUTHORITY, evaluateWorkloadGate, jsonPointer, renderTemplate, sha256Json, validateProfile, validateWebVitals, type MountedProfile, type RequestSpec, type WebVitalSample } from './nfrPerfGate.js';

const profilePath = process.env.NFR_PERF_PROFILE || '';
const tokensPath = process.env.NFR_PERF_TOKENS || '';
const vitalsPath = process.env.NFR_PERF_WEB_VITALS || '';
const outputDir = process.env.NFR_PERF_EVIDENCE_DIR || '';
const release = process.env.NFR_PERF_RELEASE_GATE === '1';
const durationMs = Number(process.env.NFR_PERF_DURATION_MS || NFR_PERF_AUTHORITY.durationMs);
const users = Number(process.env.NFR_PERF_USERS || NFR_PERF_AUTHORITY.authenticatedUsers);
const intervalMs = Number(process.env.NFR_PERF_REQUEST_INTERVAL_MS || 1000);

function requiredPath(label: string, value: string): string {
  if (!value || !fs.existsSync(value)) throw new Error(`${label} existing file required`);
  return value;
}
function atomicJson(file: string, value: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function loadJson<T>(file: string): T { return JSON.parse(fs.readFileSync(file, 'utf8')) as T; }
function jwtUserId(token: string): string {
  try {
    const body = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64url').toString('utf8')) as { id?: string; sub?: string };
    const id = String(body.id || body.sub || '').trim();
    if (!id) throw new Error('missing id');
    return id;
  } catch { throw new Error('each primary JWT must expose an id or sub claim'); }
}

async function main() {
  if (release && (durationMs < NFR_PERF_AUTHORITY.durationMs || users < NFR_PERF_AUTHORITY.authenticatedUsers)) throw new Error('release gate refuses <30min or <50 authenticated users');
  if (!Number.isFinite(durationMs) || !Number.isFinite(users) || !Number.isFinite(intervalMs) || durationMs <= 0 || users <= 0 || intervalMs <= 0) throw new Error('positive finite run configuration required');
  const profile = loadJson<MountedProfile>(requiredPath('NFR_PERF_PROFILE', profilePath));
  validateProfile(profile);
  const tokenData = loadJson<{ primary: string[]; foreign: string }>(requiredPath('NFR_PERF_TOKENS', tokensPath));
  const selectedTokens = tokenData.primary.slice(0, users);
  if (selectedTokens.length < users || selectedTokens.some((token) => !token) || new Set(selectedTokens).size !== users || !tokenData.foreign || selectedTokens.includes(tokenData.foreign)) throw new Error(`distinct tokens for ${users} primary users plus one foreign user required`);
  const webVitals = loadJson<WebVitalSample[]>(requiredPath('NFR_PERF_WEB_VITALS', vitalsPath));
  if (!outputDir) throw new Error('NFR_PERF_EVIDENCE_DIR required');
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, 'nfr-perf-report.json');
  const startedAt = Date.now();
  const endAt = startedAt + durationMs;
  const reads: number[] = [], writes: number[] = [];
  const expectedIds = new Set<string>(), reconciledIds = new Set<string>(), duplicateIds = new Set<string>();
  const errorSamples: Array<{ module: string; phase: string; detail: string }> = [];
  const recordError = (module: string, phase: string, detail: unknown) => {
    if (errorSamples.length < 100) errorSamples.push({ module, phase, detail: detail instanceof Error ? detail.message : String(detail) });
  };
  const perModule = Object.fromEntries(profile.modules.map((m) => [m.name, { reads: 0, writes: 0, errors: 0, negativeAttempts: 0, falseSuccesses: 0 }]));
  let requests = 0, errors = 0, tenantFalseSuccesses = 0;
  const call = async (token: string, spec: RequestSpec, vars: Record<string, string>) => {
    const rendered = renderTemplate(spec, vars);
    if (/\{\{[A-Z_]+\}\}/.test(JSON.stringify({ path: rendered.path, body: rendered.body }))) throw new Error(`unresolved profile variable in ${rendered.method} ${rendered.path}`);
    const began = performance.now();
    const response = await fetch(new URL(rendered.path, profile.baseUrl), { method: rendered.method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-nfr-perf-run': path.basename(outputDir) }, body: rendered.body === undefined ? undefined : JSON.stringify(rendered.body), redirect: 'manual' });
    const latency = performance.now() - began;
    let body: unknown = undefined;
    const text = await response.text();
    if (text) { try { body = JSON.parse(text); } catch { body = text; } }
    return { response, body, latency, expectedStatus: rendered.expectedStatus };
  };
  const shaProbe = await call(selectedTokens[0], profile.shaProbe, profile.variables || {});
  const mountedSha = profile.shaProbe.shaHeader
    ? shaProbe.response.headers.get(profile.shaProbe.shaHeader)
    : String(jsonPointer(shaProbe.body, profile.shaProbe.shaJsonPointer || '') ?? '');
  if (shaProbe.response.status !== shaProbe.expectedStatus || mountedSha !== profile.productSha) {
    throw new Error(`mounted candidate SHA mismatch: expected ${profile.productSha}, received ${mountedSha || 'MISSING'}`);
  }
  const worker = async (index: number) => {
    let op = 0;
    while (Date.now() < endAt) {
      const loop = Date.now();
      const module = profile.modules[(index + op) % profile.modules.length];
      const stats = perModule[module.name];
      const write = op % 10 === 9;
      const requestId = `${module.name}-${index}-${op}-${randomUUID()}`;
      const variables = { ...(profile.variables || {}), REQUEST_ID: requestId, USER_INDEX: String(index), AUTH_USER_ID: jwtUserId(tokenData.primary[index]) };
      try {
        if (write) {
          const result = await call(tokenData.primary[index], module.write, variables);
          requests++; stats.writes++; writes.push(result.latency);
          if (result.response.status !== result.expectedStatus) { errors++; stats.errors++; recordError(module.name, 'write', `expected ${result.expectedStatus}, got ${result.response.status}: ${JSON.stringify(result.body).slice(0, 500)}`); }
          else {
            const id = module.write.idJsonPointer
              ? String(jsonPointer(result.body, module.write.idJsonPointer) ?? '')
              : String(variables[module.write.fixedIdVariable || ''] ?? '');
            const commandId = module.write.commandIdJsonPointer
              ? String(jsonPointer(result.body, module.write.commandIdJsonPointer) ?? '')
              : id;
            if (!id || !commandId) { errors++; stats.errors++; recordError(module.name, 'write_identity', JSON.stringify(result.body).slice(0, 500)); }
            else {
              expectedIds.add(requestId);
              // Replay the exact command before readback. A second entity for one
              // command identity is a duplicate even when both rows are readable.
              const replay = await call(tokenData.primary[index], module.write, variables);
              requests++; writes.push(replay.latency);
              const replayAllowed = (module.write.expectedReplayStatuses || [replay.expectedStatus]).includes(replay.response.status);
              const replayId = replayAllowed
                ? (module.write.commandIdJsonPointer
                  ? String(jsonPointer(replay.body, module.write.commandIdJsonPointer) ?? '')
                  : module.write.idJsonPointer ? String(jsonPointer(replay.body, module.write.idJsonPointer) ?? '') : id)
                : '';
              if (!replayId || replayId !== commandId) {
                duplicateIds.add(requestId);
                errors++; stats.errors++;
                recordError(module.name, 'replay', `original ${commandId}, replay ${replayId || 'MISSING'}, status ${replay.response.status}`);
              }
              const check = await call(tokenData.primary[index], module.write.reconcile, { ...variables, ID: id });
              requests++; reads.push(check.latency);
              const identityMatches = module.write.reconcile.idJsonPointer
                ? String(jsonPointer(check.body, module.write.reconcile.idJsonPointer) ?? '') === id
                : true;
              const valueMatches = module.write.reconcile.valueJsonPointer
                ? String(jsonPointer(check.body, module.write.reconcile.valueJsonPointer) ?? '') === String(variables[module.write.reconcile.expectedValueVariable || ''] ?? '')
                : true;
              if (check.response.status === check.expectedStatus && identityMatches && valueMatches) reconciledIds.add(requestId); else { errors++; stats.errors++; recordError(module.name, 'reconcile', `status ${check.response.status}, identity=${identityMatches}, value=${valueMatches}: ${JSON.stringify(check.body).slice(0, 500)}`); }
            }
          }
        } else {
          const result = await call(tokenData.primary[index], module.read, variables);
          requests++; stats.reads++; reads.push(result.latency);
          if (result.response.status !== result.expectedStatus) { errors++; stats.errors++; recordError(module.name, 'read', `expected ${result.expectedStatus}, got ${result.response.status}: ${JSON.stringify(result.body).slice(0, 500)}`); }
        }
        if (op % 25 === 0) {
          const negative = await call(tokenData.foreign, module.crossTenantRead, variables);
          requests++; stats.negativeAttempts++;
          const targetExposed = negative.response.status === negative.expectedStatus && (
            module.crossTenantRead.targetValueJsonPointer
              ? String(jsonPointer(negative.body, module.crossTenantRead.targetValueJsonPointer) ?? '') === String(variables[module.crossTenantRead.expectedTargetVariable || ''] ?? '')
              : true
          );
          if (targetExposed) { tenantFalseSuccesses++; stats.falseSuccesses++; }
        }
      } catch (error) { requests++; errors++; stats.errors++; recordError(module.name, write ? 'write_exception' : 'read_exception', error); }
      op++;
      await sleep(Math.max(0, intervalMs - (Date.now() - loop)));
    }
  };
  atomicJson(reportPath, { status: 'RUNNING', productSha: profile.productSha, mountedSha, startedAt: new Date(startedAt).toISOString(), durationMs, users });
  const checkpoint = setInterval(() => atomicJson(reportPath, { status: 'RUNNING', productSha: profile.productSha, mountedSha, startedAt: new Date(startedAt).toISOString(), checkpointAt: new Date().toISOString(), durationMs, users, requests, errors, readSamples: reads.length, writeSamples: writes.length, expectedWriteIds: expectedIds.size, reconciledWriteIds: reconciledIds.size, duplicateWriteIds: duplicateIds.size, tenantFalseSuccesses, perModule }), 10_000);
  try {
    await Promise.all(Array.from({ length: users }, (_, index) => worker(index)));
  } finally {
    clearInterval(checkpoint);
  }
  const missingIds = [...expectedIds].filter((id) => !reconciledIds.has(id));
  const errorRatePct = requests ? (errors / requests) * 100 : 100;
  const webVitalsGate = validateWebVitals(webVitals, profile.productSha);
  const workloadGate = evaluateWorkloadGate({ readsMs: reads, writesMs: writes, requests, errors, writeLoss: missingIds.length, writeDuplicate: duplicateIds.size, tenantFalseSuccess: tenantFalseSuccesses });
  const failures = [...workloadGate.failures];
  if (!webVitalsGate.pass) failures.push('web_vitals');
  const report = { status: failures.length ? 'FAIL' : 'PASS', gateKind: release ? 'RELEASE_30M_50U' : 'QUALIFICATION_ONLY', productSha: profile.productSha, mountedSha, startedAt: new Date(startedAt).toISOString(), finishedAt: new Date().toISOString(), durationMsRequested: durationMs, durationMsActual: Date.now() - startedAt, authenticatedUsers: users, requests, errors, errorRatePct, errorSamples, read: { count: reads.length, p95Ms: workloadGate.readP95Ms }, write: { count: writes.length, p95Ms: workloadGate.writeP95Ms, expected: expectedIds.size, reconciled: reconciledIds.size, loss: missingIds.length, duplicate: duplicateIds.size }, tenantFalseSuccesses, perModule, webVitals: webVitalsGate, failures };
  atomicJson(reportPath, report);
  atomicJson(path.join(outputDir, 'manifest.json'), { productSha: profile.productSha, report: path.basename(reportPath), reportSha256: sha256Json(report), profileSha256: sha256Json(profile), webVitalsInputSha256: sha256Json(webVitals), credentialsPersisted: false });
  if (failures.length) process.exitCode = 1;
}

main().catch((error) => { console.error('[NFR-PERF-001]', error instanceof Error ? error.message : error); process.exit(1); });
