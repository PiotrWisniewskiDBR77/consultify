import { createHash } from 'node:crypto';

export const NFR_PERF_AUTHORITY = Object.freeze({
  durationMs: 30 * 60_000,
  authenticatedUsers: 50,
  readP95Ms: 1500,
  writeP95Ms: 2500,
  maxErrorRatePctExclusive: 1,
  webVitals: { desktopLcpMs: 2500, mobileLcpMs: 4000, cls: 0.1, inpMs: 200 },
});

export type ModuleName = 'case' | 'my-work' | 'settings' | 'initiative' | 'finance';
export type DeviceClass = 'desktop' | 'mobile';

export interface RequestSpec {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  path: string;
  body?: unknown;
  expectedStatus: number;
}

export interface ModuleProfile {
  name: ModuleName;
  read: RequestSpec;
  write: RequestSpec & {
    idJsonPointer?: string;
    commandIdJsonPointer?: string;
    fixedIdVariable?: string;
    expectedReplayStatuses?: number[];
    reconcile: RequestSpec & { idJsonPointer?: string; valueJsonPointer?: string; expectedValueVariable?: string };
  };
  crossTenantRead: RequestSpec & { targetValueJsonPointer?: string; expectedTargetVariable?: string };
}

export interface MountedProfile {
  schemaVersion: 1;
  productSha: string;
  baseUrl: string;
  variables?: Record<string, string>;
  shaProbe: RequestSpec & { shaJsonPointer?: string; shaHeader?: string };
  modules: ModuleProfile[];
}

export interface WebVitalSample {
  productSha: string;
  device: DeviceClass;
  cold: true;
  LCP: number;
  CLS: number;
  INP: number;
}

export function percentile(values: number[], p: number): number {
  if (!values.length) return Number.POSITIVE_INFINITY;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)];
}

export function jsonPointer(value: unknown, pointer: string): unknown {
  if (!pointer.startsWith('/')) throw new Error(`invalid JSON pointer: ${pointer}`);
  return pointer.slice(1).split('/').reduce<unknown>((node, part) => {
    if (node === null || typeof node !== 'object') return undefined;
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    return (node as Record<string, unknown>)[key];
  }, value);
}

export function renderTemplate<T>(input: T, variables: Record<string, string>): T {
  const render = (value: unknown): unknown => {
    if (typeof value === 'string') return value.replace(/\{\{([A-Z_]+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
    if (Array.isArray(value)) return value.map(render);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, render(v)]));
    return value;
  };
  return render(input) as T;
}

function templateVariables(value: unknown): Set<string> {
  const found = new Set<string>();
  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      for (const match of node.matchAll(/\{\{([A-Z_]+)\}\}/g)) found.add(match[1]);
      return;
    }
    if (Array.isArray(node)) node.forEach(visit);
    else if (node && typeof node === 'object') Object.values(node).forEach(visit);
  };
  visit(value);
  return found;
}

export function validateProfile(profile: MountedProfile): void {
  if (profile.schemaVersion !== 1 || !/^[0-9a-f]{40}$/.test(profile.productSha)) throw new Error('exact 40-hex productSha required');
  if (!/^https?:\/\//.test(profile.baseUrl)) throw new Error('absolute baseUrl required');
  if (!profile.shaProbe || (!profile.shaProbe.shaJsonPointer && !profile.shaProbe.shaHeader)) throw new Error('mounted candidate SHA probe required');
  if (profile.variables && Object.values(profile.variables).some((value) => typeof value !== 'string' || !value)) throw new Error('profile variables must be non-empty strings');
  const availableVariables = new Set([
    ...Object.keys(profile.variables || {}),
    'REQUEST_ID',
    'USER_INDEX',
    'AUTH_USER_ID',
    'ID',
  ]);
  const unresolvedVariables = [...templateVariables({ shaProbe: profile.shaProbe, modules: profile.modules })]
    .filter((name) => !availableVariables.has(name))
    .sort();
  if (unresolvedVariables.length) {
    throw new Error(`profile template variables missing: ${unresolvedVariables.join(', ')}`);
  }
  const names = profile.modules.map((entry) => entry.name);
  const required: ModuleName[] = ['case', 'my-work', 'settings', 'initiative', 'finance'];
  if (names.length !== required.length || required.some((name) => names.filter((item) => item === name).length !== 1)) {
    throw new Error('exactly one representative profile for all five modules required');
  }
  for (const module of profile.modules) {
    if (Boolean(module.write.idJsonPointer) === Boolean(module.write.fixedIdVariable)) throw new Error(`${module.name} write requires exactly one response pointer or fixed identity variable`);
    const reconcile = module.write.reconcile;
    if (!reconcile.idJsonPointer && !(reconcile.valueJsonPointer && reconcile.expectedValueVariable)) throw new Error(`${module.name} exact readback identity or value assertion required`);
    if (Boolean(module.crossTenantRead.targetValueJsonPointer) !== Boolean(module.crossTenantRead.expectedTargetVariable)) throw new Error(`${module.name} cross-tenant target assertion must be complete`);
  }
}

export function validateWebVitals(samples: WebVitalSample[], productSha: string) {
  const failures: string[] = [];
  const result: Record<string, unknown> = {};
  for (const device of ['desktop', 'mobile'] as const) {
    const group = samples.filter((sample) => sample.productSha === productSha && sample.device === device && sample.cold === true);
    if (!group.length) { failures.push(`${device}_cold_missing`); continue; }
    if (group.some((sample) => !Number.isFinite(sample.LCP) || sample.LCP <= 0 || !Number.isFinite(sample.CLS) || sample.CLS < 0 || !Number.isFinite(sample.INP) || sample.INP <= 0)) failures.push(`${device}_metric_missing`);
    const p75 = { LCP: percentile(group.map((s) => s.LCP), 75), CLS: percentile(group.map((s) => s.CLS), 75), INP: percentile(group.map((s) => s.INP), 75) };
    result[device] = { count: group.length, p75 };
    if (p75.LCP > (device === 'desktop' ? NFR_PERF_AUTHORITY.webVitals.desktopLcpMs : NFR_PERF_AUTHORITY.webVitals.mobileLcpMs)) failures.push(`${device}_lcp`);
    if (p75.CLS > NFR_PERF_AUTHORITY.webVitals.cls) failures.push(`${device}_cls`);
    if (p75.INP > NFR_PERF_AUTHORITY.webVitals.inpMs) failures.push(`${device}_inp`);
  }
  if (samples.some((sample) => sample.productSha !== productSha)) failures.push('mixed_product_sha');
  return { pass: failures.length === 0, provisionalOwnerAcceptanceRequired: true, failures, devices: result };
}

export interface WorkloadEvidence {
  readsMs: number[];
  writesMs: number[];
  requests: number;
  errors: number;
  writeLoss: number;
  writeDuplicate: number;
  tenantFalseSuccess: number;
}

export function evaluateWorkloadGate(input: WorkloadEvidence) {
  const readP95Ms = percentile(input.readsMs, 95);
  const writeP95Ms = percentile(input.writesMs, 95);
  const errorRatePct = input.requests ? (input.errors / input.requests) * 100 : 100;
  const failures: string[] = [];
  if (readP95Ms > NFR_PERF_AUTHORITY.readP95Ms) failures.push('read_p95');
  if (writeP95Ms > NFR_PERF_AUTHORITY.writeP95Ms) failures.push('write_p95');
  if (errorRatePct >= NFR_PERF_AUTHORITY.maxErrorRatePctExclusive) failures.push('error_rate');
  if (input.writeLoss !== 0) failures.push('write_loss');
  if (input.writeDuplicate !== 0) failures.push('write_duplicate');
  if (input.tenantFalseSuccess !== 0) failures.push('tenant_false_success');
  return { pass: failures.length === 0, readP95Ms, writeP95Ms, errorRatePct, failures };
}

export function sha256Json(value: unknown): string {
  return createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex');
}
