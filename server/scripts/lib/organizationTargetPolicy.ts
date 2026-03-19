const DEFAULT_DEMO_ORG_ID = 'demo-org';
const DEFAULT_DEMO_ORG_NAME = 'Atelier';

function env(name: string): string | undefined {
  const value = String(process.env[name] || '').trim();
  return value || undefined;
}

function normalize(value: string | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function resolveDemoOrgId(): string {
  return env('DEMO_ORG_ID') || DEFAULT_DEMO_ORG_ID;
}

export function resolveDemoOrgName(): string {
  return env('DEMO_ORG_NAME') || DEFAULT_DEMO_ORG_NAME;
}

export function isDemoOrgId(orgId: string | undefined): boolean {
  const normalized = normalize(orgId);
  return normalized === normalize(resolveDemoOrgId()) || normalized === 'demo-org';
}

export function describeOrganizationTargetPolicy(): string {
  return [
    `DEMO_ORG_ID="${resolveDemoOrgId()}"`,
    `DEMO_ORG_NAME="${resolveDemoOrgName()}"`,
  ].join(', ');
}
