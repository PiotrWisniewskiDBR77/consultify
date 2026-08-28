#!/usr/bin/env tsx
/**
 * Harvard module smoke / contract tests (Krok 8)
 *
 * One runnable suite covering ALL Harvard modules (M01–M27 + A1). For each
 * module it probes the primary backend endpoint(s) and asserts the contract:
 *
 *   - WITHOUT auth  → 401/403 expected (router mounted AND auth-gated).
 *                     404 = NOT MOUNTED (regression, e.g. the 2026-06-08 v8 404s).
 *                     200 = mounted but UNGATED (security warning).
 *                     503 = degraded/stub (recorded, not a failure — e.g. A1).
 *   - WITH auth (SMOKE_TOKEN set) → expect non-404 (200/400/403) = reachable.
 *
 * Runs against a live backend (default http://127.0.0.1:3001). No DB writes.
 *
 * Usage:
 *   SMOKE_BASE=http://127.0.0.1:3001 tsx server/scripts/harvard-module-smoke.ts
 *   SMOKE_TOKEN=<jwt> SMOKE_ORG=dbr77 tsx server/scripts/harvard-module-smoke.ts
 *   ... --json    machine-readable output
 *
 * Exit code: 0 if every module passes its mount+gate contract, else 1.
 */

export type Access = 'open' | 'beta' | 'internal' | 'role' | 'stub';

export interface ModuleSpec {
  id: string;
  name: string;
  feRoute: string;
  access: Access;
  endpoints: string[]; // backend GET paths; first is primary
  note?: string;
}

// Endpoint bases verified against Gateway.ts mounts + v8/index.ts.
export const MODULES: ModuleSpec[] = [
  { id: 'M01', name: 'Czat', feRoute: '/chat', access: 'open', endpoints: ['/api/conversations', '/api/chat-projects', '/api/v8/chat/conversations'] },
  { id: 'M02', name: 'Canvas', feRoute: 'panel + /public/artifacts/:token', access: 'beta', endpoints: ['/api/artifacts', '/api/artifact-runs'] },
  { id: 'M03', name: 'Moja Praca — organizer', feRoute: '/my-work/*', access: 'open', endpoints: ['/api/my-work/inbox', '/api/v8/my-work/inbox'] },
  { id: 'M04', name: 'Notatnik', feRoute: '/my-work/notebook', access: 'open', endpoints: ['/api/notebook', '/api/v8/notebook'] },
  { id: 'M05', name: 'Ideas — Zarządzanie', feRoute: '/my-work/ideas', access: 'beta', endpoints: ['/api/my-work/idea-maps'] },
  { id: 'M06', name: 'Ideas — Mind Map', feRoute: '…/workspace/mindmap', access: 'beta', endpoints: ['/api/v8/mindmap/health'] },
  { id: 'M07', name: 'Ideas — Process Flow', feRoute: '…/workspace/process_flow', access: 'beta', endpoints: ['/api/my-work/my-ideas/:id/map'] },
  { id: 'M08', name: 'Ideas — Table', feRoute: '…/workspace/table', access: 'beta', endpoints: ['/api/table-platform/bases'] },
  { id: 'M09', name: 'Ideas — Whiteboard', feRoute: '…/workspace/whiteboard', access: 'beta', endpoints: ['/api/v8/multiplayer/health', '/api/my-work/idea-maps'] },
  { id: 'M10', name: 'Wywiad', feRoute: '/discovery', access: 'open', endpoints: ['/api/interview', '/api/v8/interview/templates'] },
  { id: 'M11', name: 'Narzędzia / Assessment', feRoute: '/discovery-tools, /assessment', access: 'beta', endpoints: ['/api/assessment', '/api/assessments-v4'] },
  { id: 'M12', name: 'Audyty', feRoute: '/audit-programs', access: 'beta', endpoints: ['/api/audit/programs', '/api/audit'], note: 'router mounted at /api/audit (Gateway.ts)' },
  { id: 'M13', name: 'Inicjatywy', feRoute: '/initiatives', access: 'open', endpoints: ['/api/initiatives'] },
  { id: 'M14', name: 'Wdrożenie', feRoute: '/implementation', access: 'open', endpoints: ['/api/execution', '/api/execution-control'] },
  { id: 'M15', name: 'Rezultaty', feRoute: '/benefits', access: 'beta', endpoints: ['/api/benefits', '/api/v8/results/dashboard'] },
  { id: 'M16', name: 'Finanse', feRoute: '/finance', access: 'beta', endpoints: ['/api/finance-statements', '/api/v8/finance/lane'] },
  { id: 'M17', name: 'Outputs', feRoute: '/presentations', access: 'beta', endpoints: ['/api/presentations'] },
  { id: 'M18', name: 'Dokumenty', feRoute: '/document-studio', access: 'beta', endpoints: ['/api/document-studio', '/api/documents'] },
  { id: 'M19', name: 'Prezentacje', feRoute: '/prezentacje', access: 'beta', endpoints: ['/api/presentation-studio', '/api/presentations-v4'] },
  { id: 'M20', name: 'Tabele Studio', feRoute: '/tabele', access: 'beta', endpoints: ['/api/table-platform'] },
  { id: 'M21', name: 'Meeting', feRoute: '/meeting', access: 'beta', endpoints: ['/api/meeting'] },
  { id: 'M22', name: 'AI OS / Internal Tools', feRoute: '/ai/*', access: 'internal', endpoints: ['/api/ai-prompts', '/api/agents'] },
  { id: 'M23', name: 'Organizacja', feRoute: '/organization/*', access: 'open', endpoints: ['/api/organization', '/api/organizations'] },
  { id: 'M24', name: 'Panel Administratora', feRoute: '/admin/*', access: 'role', endpoints: ['/api/admin'] },
  { id: 'M25', name: 'Ustawienia', feRoute: '/settings/*', access: 'open', endpoints: ['/api/settings'] },
  { id: 'M26', name: 'Portal Partnerski', feRoute: '/partner/*', access: 'open', endpoints: ['/api/partners', '/api/v8/partner'] },
  { id: 'M27', name: 'SuperAdmin', feRoute: '/superadmin/*', access: 'role', endpoints: ['/api/superadmin'] },
  { id: 'A1', name: 'Affiliate/Ecosystem (świadomy stub)', feRoute: '/affiliate→/chat', access: 'stub', endpoints: ['/api/referrals'] },
];

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3001';
const TOKEN = process.env.SMOKE_TOKEN || '';
const ORG = process.env.SMOKE_ORG || 'dbr77';
const asJson = process.argv.includes('--json');

type Verdict = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';

interface Probe {
  endpoint: string;
  noAuthStatus: number | 'ERR';
  authStatus?: number | 'ERR';
}

interface ModuleResult {
  id: string;
  name: string;
  access: Access;
  verdict: Verdict;
  reason: string;
  probes: Probe[];
}

async function statusOf(path: string, withAuth: boolean): Promise<number | 'ERR'> {
  const headers: Record<string, string> = {};
  if (withAuth && TOKEN) {
    headers['Authorization'] = `Bearer ${TOKEN}`;
    headers['x-organization-id'] = ORG;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(`${BASE}${path}`, { headers, signal: ctrl.signal });
    clearTimeout(t);
    return r.status;
  } catch {
    return 'ERR';
  }
}

function classify(spec: ModuleSpec, probes: Probe[]): { verdict: Verdict; reason: string } {
  // Primary endpoint drives the verdict; mounted+gated is the core contract.
  const primary = probes[0];
  const s = primary.noAuthStatus;

  if (spec.access === 'stub') {
    // A1: a 503/404/501 degraded stub is the intended state — not a failure.
    if (s === 503 || s === 404 || s === 501) return { verdict: 'PASS', reason: `intended stub (no-auth ${s})` };
    if (s === 401 || s === 403) return { verdict: 'PASS', reason: `gated stub (no-auth ${s})` };
    return { verdict: 'WARN', reason: `unexpected stub status ${s}` };
  }

  if (s === 'ERR') return { verdict: 'FAIL', reason: 'backend unreachable / timeout' };
  if (s === 401 || s === 403) {
    // Mounted + gated. If a token was supplied, the auth probe should be non-404.
    if (TOKEN) {
      const a = primary.authStatus;
      if (a === 404) return { verdict: 'FAIL', reason: `auth probe 404 (path drift) — gate ok but endpoint moved` };
    }
    return { verdict: 'PASS', reason: `mounted + gated (no-auth ${s})` };
  }
  if (s === 404) {
    // Maybe a secondary endpoint is the mounted one.
    const alt = probes.find((p) => p.noAuthStatus === 401 || p.noAuthStatus === 403);
    if (alt) return { verdict: 'PASS', reason: `primary 404 but ${alt.endpoint} gated` };
    return { verdict: 'FAIL', reason: `NOT MOUNTED (no-auth 404 on all probes) — router regression` };
  }
  if (s === 200) return { verdict: 'WARN', reason: `mounted but UNGATED (no-auth 200) — security review` };
  if (s === 503) return { verdict: 'WARN', reason: `degraded (no-auth 503)` };
  return { verdict: 'WARN', reason: `unexpected no-auth status ${s}` };
}

async function main() {
  const results: ModuleResult[] = [];
  for (const spec of MODULES) {
    const probes: Probe[] = [];
    for (const ep of spec.endpoints) {
      const noAuth = await statusOf(ep, false);
      const auth = TOKEN ? await statusOf(ep, true) : undefined;
      probes.push({ endpoint: ep, noAuthStatus: noAuth, authStatus: auth });
    }
    const { verdict, reason } = classify(spec, probes);
    results.push({ id: spec.id, name: spec.name, access: spec.access, verdict, reason, probes });
  }

  const pass = results.filter((r) => r.verdict === 'PASS').length;
  const warn = results.filter((r) => r.verdict === 'WARN').length;
  const fail = results.filter((r) => r.verdict === 'FAIL').length;

  if (asJson) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ base: BASE, authProbed: !!TOKEN, summary: { pass, warn, fail }, results }, null, 2));
  } else {
    // eslint-disable-next-line no-console
    console.log(`Harvard module smoke — ${BASE}  (auth probe: ${TOKEN ? 'on' : 'off'})\n`);
    for (const r of results) {
      const icon = r.verdict === 'PASS' ? '✅' : r.verdict === 'WARN' ? '🟡' : r.verdict === 'FAIL' ? '❌' : '⚪';
      const primary = r.probes[0];
      const authPart = TOKEN && primary.authStatus !== undefined ? ` auth=${primary.authStatus}` : '';
      // eslint-disable-next-line no-console
      console.log(`${icon} ${r.id.padEnd(3)} ${r.name.padEnd(28)} no-auth=${String(primary.noAuthStatus).padEnd(4)}${authPart}  ${r.reason}`);
    }
    // eslint-disable-next-line no-console
    console.log(`\n${pass} PASS · ${warn} WARN · ${fail} FAIL  (of ${results.length} modules)`);
  }
  process.exit(fail > 0 ? 1 : 0);
}

import { pathToFileURL } from 'url';

const isMain = import.meta.url === pathToFileURL(process.argv[1] || '').href;
if (isMain) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error('harvard-module-smoke failed:', e?.message || e);
    process.exit(2);
  });
}
