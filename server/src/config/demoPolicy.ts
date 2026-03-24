const DEFAULT_DEMO_ORG_ID = 'demo-org';
const DEFAULT_DEMO_ORG_NAME = 'Demo Organization';

function normalize(value: unknown): string {
  return String(value || '').trim();
}

function normalizeLower(value: unknown): string {
  return normalize(value).toLowerCase();
}

function parseBool(value: unknown): boolean {
  const normalized = normalizeLower(value);
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

export type DemoPolicyState = {
  demoOrgId: string;
  demoOrgName: string;
  defaultDemoOrgId: string;
  defaultDemoOrgName: string;
  usesNonDefaultDemoOrgId: boolean;
  explicitApprovalEnabled: boolean;
  requiresExplicitApproval: boolean;
  approvedBy: string[];
  warnings: string[];
  errors: string[];
};

export function resolveDemoPolicy(env: NodeJS.ProcessEnv = process.env): DemoPolicyState {
  const demoOrgId = normalize(env.DEMO_ORG_ID) || DEFAULT_DEMO_ORG_ID;
  const demoOrgName = normalize(env.DEMO_ORG_NAME) || DEFAULT_DEMO_ORG_NAME;
  const usesNonDefaultDemoOrgId = normalizeLower(demoOrgId) !== DEFAULT_DEMO_ORG_ID;

  const approvalFlags = [
    'ALLOW_NONDEFAULT_DEMO_ORG',
    'ALLOW_BRANDED_DEMO_ORG',
    'ALLOW_ATELIER_AS_DEMO_ORG',
  ];
  const approvedBy = approvalFlags.filter((flag) => parseBool(env[flag]));
  const explicitApprovalEnabled = approvedBy.length > 0;
  const requiresExplicitApproval = usesNonDefaultDemoOrgId;

  const warnings: string[] = [];
  const errors: string[] = [];

  if (usesNonDefaultDemoOrgId && !explicitApprovalEnabled) {
    const message =
      `DEMO_ORG_ID=${demoOrgId} points to a branded/non-default demo tenant. ` +
      `Set one of ${approvalFlags.join(', ')} to an explicit truthy value to confirm this is intentional.`;
    const isStrictRuntime =
      normalizeLower(env.NODE_ENV) === 'production' ||
      normalizeLower(env.APP_ENV) === 'production' ||
      normalizeLower(env.APP_ENV) === 'staging' ||
      normalizeLower(env.RAILWAY_ENVIRONMENT_NAME) === 'production' ||
      normalizeLower(env.RAILWAY_ENVIRONMENT_NAME) === 'staging';
    if (isStrictRuntime) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  }

  if (!usesNonDefaultDemoOrgId && normalizeLower(demoOrgName) === 'atelier') {
    warnings.push(
      'DEMO_ORG_NAME is still branded as "Atelier" while DEMO_ORG_ID uses the neutral default demo tenant.'
    );
  }

  return {
    demoOrgId,
    demoOrgName,
    defaultDemoOrgId: DEFAULT_DEMO_ORG_ID,
    defaultDemoOrgName: DEFAULT_DEMO_ORG_NAME,
    usesNonDefaultDemoOrgId,
    explicitApprovalEnabled,
    requiresExplicitApproval,
    approvedBy,
    warnings,
    errors,
  };
}

export function validateDemoPolicy(env: NodeJS.ProcessEnv = process.env): {
  warnings: string[];
  errors: string[];
} {
  const policy = resolveDemoPolicy(env);
  return {
    warnings: [...policy.warnings],
    errors: [...policy.errors],
  };
}
