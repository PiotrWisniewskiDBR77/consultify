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
