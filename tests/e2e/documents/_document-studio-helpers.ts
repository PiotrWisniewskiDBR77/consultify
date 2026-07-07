/**
 * Document Studio (M18) — shared E2E helpers.
 *
 * Auth pattern: mirrors tests/e2e/smoke/work-canvas-helpers.ts (`loginAsOwner`
 * + `suppressOnboarding`), NOT the storageState/SPA-login path (see repo
 * memory: storageState is origin/port-fragile — seeding localStorage directly
 * via `page.request` + `addInitScript` is the proven pattern for write-access
 * E2E across M07/M09/Work Canvas). `loginAsOwner` returns a bearer token that
 * we reuse for direct `/api/document-studio/*` seed calls (Playwright's
 * `page.request` shares cookies/origin but NOT auth headers, so the token is
 * passed explicitly on every seed call).
 *
 * E2E_BASE_URL → frontend (Vite, :3000). E2E_API_URL → backend (:3001).
 */
import path from 'node:path';

import { type APIRequestContext, type Page, expect } from '@playwright/test';

import { loginAsOwner, suppressOnboarding } from '../smoke/work-canvas-helpers';

export const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';
export const DOC_STUDIO_BASE = `${API_BASE_URL}/api/document-studio`;
export const SHOTS_DIR = path.resolve('tests/e2e/documents/screens');

export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

/** Standard entry: suppress onboarding overlays, then seed an ADMIN session. */
export async function setupDocumentStudioSession(page: Page): Promise<string> {
  await suppressOnboarding(page);
  return loginAsOwner(page);
}

export interface SeedIntakeOverrides {
  title?: string;
  description?: string;
  documentType?: string;
  language?: 'pl' | 'en';
  density?: string;
  goal?: string;
  audience?: string[];
}

export function buildIntake(overrides: SeedIntakeOverrides = {}) {
  return {
    title: overrides.title ?? `E2E Document ${Date.now()}`,
    description:
      overrides.description ??
      'Prepare an executive interview summary report: scope, key findings, risks, and recommendations for the steering committee.',
    documentType: overrides.documentType ?? 'interview_summary_report',
    language: overrides.language ?? 'en',
    density: overrides.density ?? 'standard',
    goal: overrides.goal ?? 'inform',
    audience: overrides.audience ?? ['Steering Committee'],
  };
}

/**
 * Seed a full Document Studio artifact via the backend API (Mode 1 path:
 * plan → generate), bypassing the UI. Used by specs that need an EXISTING
 * artifact to open directly (export/QA/comments), so the intake→outline UI
 * flow itself stays the sole responsibility of mode1-intake-to-document.spec.ts.
 */
export async function seedDocumentArtifact(
  request: APIRequestContext,
  token: string,
  overrides: SeedIntakeOverrides = {}
): Promise<{ artifactId: string; schema: any }> {
  const intake = buildIntake(overrides);

  const planRes = await request.post(`${DOC_STUDIO_BASE}/plan`, {
    headers: authHeaders(token),
    data: { intake, useLlm: false },
    timeout: 40000,
  });
  if (!planRes.ok()) {
    throw new Error(`seedDocumentArtifact: plan failed ${planRes.status()} ${await planRes.text()}`);
  }
  const { outline } = (await planRes.json()) as { outline: unknown };

  const genRes = await request.post(`${DOC_STUDIO_BASE}/generate`, {
    headers: authHeaders(token),
    data: { intake, outline, useLlm: false },
    timeout: 60000,
  });
  if (!genRes.ok()) {
    throw new Error(
      `seedDocumentArtifact: generate failed ${genRes.status()} ${await genRes.text()}`
    );
  }
  const body = (await genRes.json()) as { artifactId: string; schema: unknown };
  return { artifactId: body.artifactId, schema: body.schema };
}

/**
 * Seed an APPROVED template (Mode 2 output) directly via the backend, so
 * Mode 3 specs don't have to drive the full Template Architect authoring UI
 * to get a usable fixture. `requiredInputs` is left empty so Mode 3
 * generation never hits the "missing required source" preflight.
 */
export async function seedApprovedTemplate(
  request: APIRequestContext,
  token: string,
  overrides: Partial<{ name: string; documentType: string; purpose: string }> = {}
): Promise<{ templateId: string }> {
  const input = {
    name: overrides.name ?? `E2E Approved Template ${Date.now()}`,
    documentType: overrides.documentType ?? 'project_status_report',
    purpose: overrides.purpose ?? 'Recurring steering committee status update.',
    audience: ['Steering Committee'],
    language: 'en' as const,
    density: 'standard' as const,
    requiredInputs: [] as string[],
  };

  const planRes = await request.post(`${DOC_STUDIO_BASE}/templates/plan`, {
    headers: authHeaders(token),
    data: { input, useLlm: false },
    timeout: 40000,
  });
  if (!planRes.ok()) {
    throw new Error(
      `seedApprovedTemplate: plan failed ${planRes.status()} ${await planRes.text()}`
    );
  }
  const { template } = (await planRes.json()) as { template: { templateId: string } };

  const approveRes = await request.post(
    `${DOC_STUDIO_BASE}/templates/${encodeURIComponent(template.templateId)}/approve`,
    {
      headers: authHeaders(token),
      data: { notes: 'E2E seed — auto-approved for Mode 3 coverage.' },
      timeout: 40000,
    }
  );
  if (!approveRes.ok()) {
    throw new Error(
      `seedApprovedTemplate: approve failed ${approveRes.status()} ${await approveRes.text()}`
    );
  }
  return { templateId: template.templateId };
}

/**
 * Fetch the current server-side schema for an artifact via the backend API
 * (the same GET the FE uses to hydrate/resume). Used by API-level specs
 * (autosave optimistic-lock, approve-persist) that assert on the DURABLE
 * server state after a mutation + re-read — the whole point of the
 * persistence fixes (34144d52ce autosave, f6dd2ccc59 approve-persist) is
 * that the change survives a fresh read, so these specs re-GET instead of
 * trusting the mutation's own echoed response.
 */
export async function fetchArtifactSchema(
  request: APIRequestContext,
  token: string,
  artifactId: string
): Promise<any> {
  const res = await request.get(`${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}`, {
    headers: authHeaders(token),
    timeout: 40000,
  });
  if (!res.ok()) {
    throw new Error(`fetchArtifactSchema: GET failed ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { schema: any };
  return body.schema;
}

/**
 * Create a deterministic section-scope AI edit proposal via the backend
 * (useLlm omitted → no LLM, fully deterministic). On APPROVAL the service
 * applies each block via `applyInstructionToBlock` → `applyInstruction`,
 * which appends the marker `[Edited with instruction: <instruction>]` to the
 * block text (NOT the proposal's preview marker `[Section-scope edit applied
 * at approval: …]`, which is only the diff-preview string). `expectedMarker`
 * is therefore the APPLIED marker — what the persisted schema must contain
 * after approve + re-read, so the approve-persist spec asserts on the durable
 * server state, exercising the f6dd2ccc59 write-through fix.
 */
export async function seedSectionProposal(
  request: APIRequestContext,
  token: string,
  artifactId: string,
  sectionId: string,
  instruction: string
): Promise<{ proposalId: string; expectedMarker: string }> {
  const res = await request.post(
    `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/editor/proposals/section`,
    {
      headers: authHeaders(token),
      data: { sectionId, instruction },
      timeout: 40000,
    }
  );
  if (!res.ok()) {
    throw new Error(`seedSectionProposal: POST failed ${res.status()} ${await res.text()}`);
  }
  const body = (await res.json()) as { proposal: { proposalId: string } };
  return {
    proposalId: body.proposal.proposalId,
    expectedMarker: `[Edited with instruction: ${instruction.trim()}]`,
  };
}

/**
 * Approve a proposal via the backend. Returns the approve endpoint's echoed
 * result ({ proposal, schema }) — specs should NOT trust this echo for the
 * persistence assertion; re-GET via fetchArtifactSchema instead.
 */
export async function approveProposal(
  request: APIRequestContext,
  token: string,
  artifactId: string,
  proposalId: string
): Promise<{ proposal: any; schema: any }> {
  const res = await request.post(
    `${DOC_STUDIO_BASE}/${encodeURIComponent(artifactId)}/editor/proposals/${encodeURIComponent(
      proposalId
    )}/approve`,
    { headers: authHeaders(token), timeout: 40000 }
  );
  if (!res.ok()) {
    throw new Error(`approveProposal: POST failed ${res.status()} ${await res.text()}`);
  }
  return (await res.json()) as { proposal: any; schema: any };
}

/**
 * Flatten every block's editable text across all sections into one string —
 * lets a spec assert "the applied edit marker is present SOMEWHERE in the
 * document" without depending on which section/block index the deterministic
 * fixture happened to land the target in.
 */
export function collectSchemaText(schema: any): string {
  const sections = Array.isArray(schema?.sections) ? schema.sections : [];
  const parts: string[] = [];
  for (const section of sections) {
    const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
    for (const block of blocks) {
      const content = block?.content;
      if (content && typeof content === 'object') {
        if (typeof content.text === 'string') parts.push(content.text);
        else if (Array.isArray(content.items)) parts.push(content.items.map(String).join('\n'));
      }
    }
  }
  return parts.join('\n\n');
}

/** Navigate straight to an existing artifact and wait for the document shell. */
export async function openArtifact(page: Page, artifactId: string): Promise<void> {
  await page.goto(`/document-studio/${encodeURIComponent(artifactId)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await expect(page.getByTestId('document-studio-mels-shell')).toBeVisible({ timeout: 30000 });
}

/** True when VITE_ENABLE_DELIVERABLES_LIGHT / ENABLE_DELIVERABLES_PREMIUM are on in this run. */
export function premiumFlagsEnabled(): boolean {
  return (
    process.env.VITE_ENABLE_DELIVERABLES_LIGHT === 'true' ||
    process.env.ENABLE_DELIVERABLES_PREMIUM === 'true'
  );
}
