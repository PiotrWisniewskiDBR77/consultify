import { createLegacyCutoverGuard, rollbackDecision } from './legacyCutover/legacyCutoverKernel.js';
import { PARTNERS_CUTOVER } from './legacyCutover/registry.js';

type ProtectedLegacyWriter = {
  method: string;
  path: RegExp;
  successor: string;
};

export const PARTNER_LEGACY_WRITER_ROLLBACK_ENV = PARTNERS_CUTOVER.rollbackEnv;
export const PARTNER_LEGACY_ROLLBACK_WRITERS_ENV = PARTNERS_CUTOVER.rollbackWritersEnv;

export const PROTECTED_PARTNER_LEGACY_WRITERS: ProtectedLegacyWriter[] = [
  { method: 'POST', path: /^\/connect\/?$/, successor: '/api/v8/partner/connect' },
  { method: 'POST', path: /^\/payouts\/request\/?$/, successor: '/api/v8/partner/payouts/request' },
  { method: 'POST', path: /^\/campaign-links\/?$/, successor: '/api/v8/partner/campaign-links' },
  {
    method: 'DELETE',
    path: /^\/campaign-links\/[^/]+\/?$/,
    successor: '/api/v8/partner/campaign-links/:linkId',
  },
  { method: 'PUT', path: /^\/organization\/?$/, successor: '/api/v8/partner/organization' },
  {
    method: 'PUT',
    path: /^\/organization\/specializations\/?$/,
    successor: '/api/v8/partner/organization/specializations',
  },
  {
    method: 'PUT',
    path: /^\/organization\/regions\/?$/,
    successor: '/api/v8/partner/organization/regions',
  },
  {
    method: 'PUT',
    path: /^\/organization\/listing\/?$/,
    successor: '/api/v8/partner/organization/listing',
  },
  {
    method: 'PUT',
    path: /^\/payout-settings\/?$/,
    successor: '/api/v8/partner/payout-settings',
  },
  {
    method: 'POST',
    path: /^\/certifications\/[^/]+\/modules\/[^/]+\/progress\/?$/,
    successor: '/api/v8/partner/certifications/:certId/modules/:moduleId/progress',
  },
  {
    method: 'POST',
    path: /^\/certifications\/[^/]+\/exam\/start\/?$/,
    successor: '/api/v8/partner/certifications/:certId/exam/start',
  },
  {
    method: 'POST',
    path: /^\/certifications\/[^/]+\/exam\/submit\/?$/,
    successor: '/api/v8/partner/certifications/:certId/exam/submit',
  },
  { method: 'POST', path: /^\/clients\/?$/, successor: '/api/v8/partner/clients' },
  { method: 'POST', path: /^\/employees\/?$/, successor: '/api/v8/partner/employees' },
  { method: 'POST', path: /^\/access-links\/?$/, successor: '/api/v8/partner/access-links' },
  {
    method: 'POST',
    path: /^\/licenses\/order\/?$/,
    successor: '/api/v8/partner/licenses/order',
  },
];

export function partnerLegacyRollbackEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return PARTNERS_CUTOVER.writers.some(
    (writer) => rollbackDecision(PARTNERS_CUTOVER, writer.writerId, env).enabled
  );
}

export function findProtectedPartnerLegacyWriter(
  method: string,
  path: string
): ProtectedLegacyWriter | null {
  const normalizedMethod = String(method || '').toUpperCase();
  const normalizedPath = String(path || '').split('?')[0] || '/';
  return (
    PROTECTED_PARTNER_LEGACY_WRITERS.find(
      (entry) => entry.method === normalizedMethod && entry.path.test(normalizedPath)
    ) || null
  );
}

/**
 * Compatibility export for tests and older imports.  The actual legacy router
 * mounts the same generic guard directly; no separate Partner decision or
 * telemetry engine remains.
 */
export const partnerLegacyCutoverGuard = createLegacyCutoverGuard(PARTNERS_CUTOVER);
