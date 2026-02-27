/**
 * Test Data Factories
 *
 * Centralized, deterministic test data generation for all layers.
 * Every factory produces consistent data with overridable defaults.
 *
 * Usage:
 *   import { createUser, createOrganization, createInitiative } from '../../factories';
 *   const user = createUser({ role: 'admin' });
 */

let _seqCounter = 0;
function seq(): number {
  return ++_seqCounter;
}

export function resetFactorySequence(): void {
  _seqCounter = 0;
}

// ─── User ────────────────────────────────────────────────

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'consultant' | 'viewer';
  organizationId: string;
  mfaEnabled: boolean;
}

export function createUser(overrides: Partial<TestUser> = {}): TestUser {
  const n = seq();
  return {
    id: `user-${n}`,
    email: `user${n}@test.consultify.io`,
    name: `Test User ${n}`,
    role: 'consultant',
    organizationId: 'org-1',
    mfaEnabled: false,
    ...overrides,
  };
}

// ─── Organization ────────────────────────────────────────

export interface TestOrganization {
  id: string;
  name: string;
  plan: 'free' | 'professional' | 'enterprise';
  maxUsers: number;
}

export function createOrganization(overrides: Partial<TestOrganization> = {}): TestOrganization {
  const n = seq();
  return {
    id: `org-${n}`,
    name: `Test Organization ${n}`,
    plan: 'professional',
    maxUsers: 50,
    ...overrides,
  };
}

// ─── Initiative ──────────────────────────────────────────

export interface TestInitiative {
  id: string;
  title: string;
  description: string;
  status: 'draft' | 'active' | 'completed' | 'archived';
  organizationId: string;
  createdBy: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export function createInitiative(overrides: Partial<TestInitiative> = {}): TestInitiative {
  const n = seq();
  return {
    id: `init-${n}`,
    title: `Initiative ${n}`,
    description: `Test initiative ${n} for automated testing`,
    status: 'draft',
    organizationId: 'org-1',
    createdBy: 'user-1',
    priority: 'medium',
    ...overrides,
  };
}

// ─── Interview Session ───────────────────────────────────

export interface TestInterviewSession {
  id: string;
  title: string;
  organizationId: string;
  createdBy: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  questions: Array<{ id: string; text: string }>;
}

export function createInterviewSession(overrides: Partial<TestInterviewSession> = {}): TestInterviewSession {
  const n = seq();
  return {
    id: `interview-${n}`,
    title: `Interview Session ${n}`,
    organizationId: 'org-1',
    createdBy: 'user-1',
    status: 'scheduled',
    questions: [
      { id: `q-${n}-1`, text: 'What are the main challenges?' },
      { id: `q-${n}-2`, text: 'What is the expected timeline?' },
    ],
    ...overrides,
  };
}

// ─── Presentation ────────────────────────────────────────

export interface TestPresentation {
  id: string;
  title: string;
  organizationId: string;
  createdBy: string;
  status: 'draft' | 'generating' | 'ready' | 'failed';
  slideCount: number;
  visualsEnabled: boolean;
}

export function createPresentation(overrides: Partial<TestPresentation> = {}): TestPresentation {
  const n = seq();
  return {
    id: `pres-${n}`,
    title: `Presentation ${n}`,
    organizationId: 'org-1',
    createdBy: 'user-1',
    status: 'draft',
    slideCount: 10,
    visualsEnabled: false,
    ...overrides,
  };
}

// ─── Auth Tokens ─────────────────────────────────────────

export interface TestAuthContext {
  token: string;
  userId: string;
  organizationId: string;
  role: string;
  headers: Record<string, string>;
}

export function createAuthContext(overrides: Partial<TestAuthContext> = {}): TestAuthContext {
  const ctx: TestAuthContext = {
    token: `test-token-${seq()}`,
    userId: 'user-1',
    organizationId: 'org-1',
    role: 'consultant',
    headers: {},
    ...overrides,
  };
  ctx.headers = { Authorization: `Bearer ${ctx.token}`, 'Content-Type': 'application/json' };
  return ctx;
}

// ─── API Request Helpers ─────────────────────────────────

export function apiUrl(path: string): string {
  const base = process.env.E2E_API_URL || process.env.API_URL || 'http://127.0.0.1:3001';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

// ─── Billing ─────────────────────────────────────────────

export interface TestBillingEvent {
  id: string;
  type: 'payment_succeeded' | 'payment_failed' | 'subscription_created' | 'subscription_cancelled';
  organizationId: string;
  amount: number;
  currency: string;
}

export function createBillingEvent(overrides: Partial<TestBillingEvent> = {}): TestBillingEvent {
  const n = seq();
  return {
    id: `evt-${n}`,
    type: 'payment_succeeded',
    organizationId: 'org-1',
    amount: 9900,
    currency: 'usd',
    ...overrides,
  };
}
