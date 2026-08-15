/**
 * Regression: H2.17 — PATCH member role accepts BOTH the membership `id` and
 * the `user_id` as the {memberId} path param.
 *
 * The Members & Roles FE surfaces both `id` (organization_members.id) and
 * `user_id` on each row. The controller previously resolved the target only by
 * `user_id`, so a request keyed by the membership `id` returned 404
 * MEMBER_NOT_FOUND even though the member exists. Both identifiers must now
 * resolve to the same member, and the downstream service call must always
 * receive the canonical `user_id`.
 */
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getMembers = vi.fn();
const updateMemberRole = vi.fn();
const normalizeOrganizationRole = (r?: string) => String(r || '').toUpperCase();

vi.mock('../../../server/src/services/organizationService.js', () => ({
  getMembers: (...a: any[]) => getMembers(...a),
  updateMemberRole: (...a: any[]) => updateMemberRole(...a),
  normalizeOrganizationRole: (...a: any[]) => normalizeOrganizationRole(a[0]),
}));

vi.mock('../../../server/src/services/adminAuditService.js', () => ({
  default: { logAction: vi.fn(async () => undefined) },
}));

vi.mock('../../../server/src/services/orgPeopleIamService.js', () => ({
  changeOrganizationMemberRoleViaIam: vi.fn(async () => ({ denied: false })),
  addOrganizationMemberViaIam: vi.fn(),
  removeOrganizationMemberViaIam: vi.fn(),
}));

// The controller pulls in the shared Database module transitively; stub it so
// importing the controller never touches a real connection.
vi.mock('../../../server/src/database/Database.js', () => ({
  getDatabase: () => ({}),
}));

const ORG = 'org-1';
const ACTOR_USER = 'actor-owner';
const TARGET_USER = 'target-user';
const TARGET_MEMBERSHIP = 'membership-abc';

async function makeApp() {
  const { default: OrganizationController } = (await import(
    '../../../server/src/controllers/OrganizationController.ts'
  )) as any;

  const app = express();
  app.use(express.json());
  // Authenticated actor is an OWNER so admin gates pass.
  app.use((req, _res, next) => {
    (req as any).user = { id: ACTOR_USER, role: 'OWNER' };
    next();
  });
  app.patch('/orgs/:orgId/members/:memberId/role', OrganizationController.updateMemberRole);
  return app;
}

describe('OrganizationController.updateMemberRole — id/user_id resolution (H2.17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMembers.mockResolvedValue([
      { id: 'membership-owner', user_id: ACTOR_USER, role: 'OWNER' },
      { id: TARGET_MEMBERSHIP, user_id: TARGET_USER, role: 'MEMBER' },
    ]);
    updateMemberRole.mockResolvedValue({ success: true });
  });

  it('resolves the target by user_id and updates by canonical user_id', async () => {
    const app = await makeApp();
    const res = await request(app)
      .patch(`/orgs/${ORG}/members/${TARGET_USER}/role`)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(200);
    expect(updateMemberRole).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: TARGET_USER,
      role: 'ADMIN',
    });
  });

  it('resolves the target by membership id and still updates by canonical user_id', async () => {
    const app = await makeApp();
    const res = await request(app)
      .patch(`/orgs/${ORG}/members/${TARGET_MEMBERSHIP}/role`)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(200);
    // Contract preserved: service is called with user_id, never the membership id.
    expect(updateMemberRole).toHaveBeenCalledWith({
      organizationId: ORG,
      userId: TARGET_USER,
      role: 'ADMIN',
    });
  });

  it('still 404s MEMBER_NOT_FOUND for an identifier that matches neither id nor user_id', async () => {
    const app = await makeApp();
    const res = await request(app)
      .patch(`/orgs/${ORG}/members/does-not-exist/role`)
      .send({ role: 'ADMIN' });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('MEMBER_NOT_FOUND');
    expect(updateMemberRole).not.toHaveBeenCalled();
  });
});
