/**
 * Unit tests for FormIntakeService (Block D · Sprint D-S2).
 *
 * Coverage:
 *   - Cross-tenant defenses on every admin-side method.
 *   - JWT issue + verify happy path.
 *   - JWT verify rejects malformed / expired / wrong-secret tokens.
 *   - Allow-list filter on submission payload.
 *   - submitFromPublic happy path (delegates to FormService.submitForm,
 *     writes audit row).
 *   - submitFromPublic captures rate-limit refusal.
 *   - submitFromPublic captures FormService errors as `rejected`.
 *   - setFieldAllowList validates entries and persists null reset.
 *   - hashClientIp produces deterministic hashes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQuery, mockLoggerWarn } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockLoggerWarn: vi.fn(),
}));

vi.mock('../../../database/Database.js', () => ({
  getDatabase: () => ({ query: mockQuery }),
}));
vi.mock('../../../utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import formIntakeService, {
  __setFormServiceForTesting,
  __setRateLimiterForTesting,
  FormIntakeError,
  hashClientIp,
} from '../FormIntakeService.js';

const FORM_ID = 'aaaaaaaa-1111-2222-3333-444444444444';
const TABLE_ID = '11111111-1111-1111-1111-111111111111';
const EMBED_TABLE_ID = '99999999-9999-9999-9999-999999999999';
const ORG = 'org-A';
const ORG_OTHER = 'org-B';

interface FormRowMock {
  id: string;
  table_id: string;
  embed_target_table_id: string | null;
  slug: string;
  is_published: boolean;
  config: any;
  field_allow_list: any;
  public_jwt_secret: string | null;
  public_link_expires_at: string | null;
}

interface MockState {
  form: FormRowMock | null;
  tableTenantOrg: string | null;
  insertedAuditRows: any[];
  jwtSecretUpdates: Array<{ formId: string; secret: string }>;
  allowListUpdates: Array<{ formId: string; allowList: any }>;
}

const state: MockState = {
  form: null,
  tableTenantOrg: ORG,
  insertedAuditRows: [],
  jwtSecretUpdates: [],
  allowListUpdates: [],
};

function configureRouter() {
  let auditCount = 0;
  mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    const s = String(sql);

    if (s.includes('FROM tp_forms') && s.includes('WHERE id = $1')) {
      return { rows: state.form ? [state.form] : [] };
    }
    if (s.includes('FROM tp_forms') && s.includes('slug = $1')) {
      return { rows: state.form && state.form.is_published ? [state.form] : [] };
    }
    if (s.includes('FROM tp_tables t') && s.includes('JOIN tp_bases')) {
      return state.tableTenantOrg
        ? { rows: [{ organization_id: state.tableTenantOrg }] }
        : { rows: [] };
    }
    if (s.includes('UPDATE tp_forms') && s.includes('public_jwt_secret = $2')) {
      const formId = String(params?.[0]);
      const secret = String(params?.[1]);
      state.jwtSecretUpdates.push({ formId, secret });
      if (state.form && state.form.id === formId) state.form.public_jwt_secret = secret;
      return { rows: [] };
    }
    if (s.includes('UPDATE tp_forms') && s.includes('field_allow_list = $2')) {
      const formId = String(params?.[0]);
      const allowList = params?.[1] == null ? null : params?.[1];
      state.allowListUpdates.push({ formId, allowList });
      if (state.form && state.form.id === formId) {
        state.form.field_allow_list = allowList == null ? null : JSON.parse(String(allowList));
      }
      return { rows: [] };
    }
    if (s.includes('INSERT INTO tp_form_submissions')) {
      auditCount += 1;
      const id = `submission-${auditCount}`;
      state.insertedAuditRows.push({
        id,
        form_id: params?.[0],
        table_id: params?.[1],
        record_id: params?.[2],
        intake_kind: params?.[3],
        jwt_subject: params?.[4],
        client_ip_hash: params?.[5],
        status: params?.[6],
        failure_reason: params?.[7],
      });
      return { rows: [{ id }] };
    }

    return { rows: [] };
  });
}

beforeEach(() => {
  state.form = {
    id: FORM_ID,
    table_id: TABLE_ID,
    embed_target_table_id: null,
    slug: 'public-slug',
    is_published: true,
    config: { fields: [{ fieldId: 'f1' }, { fieldId: 'f2' }] },
    field_allow_list: null,
    public_jwt_secret: null,
    public_link_expires_at: null,
  };
  state.tableTenantOrg = ORG;
  state.insertedAuditRows = [];
  state.jwtSecretUpdates = [];
  state.allowListUpdates = [];

  mockQuery.mockReset();
  mockLoggerWarn.mockReset();
  configureRouter();

  __setRateLimiterForTesting(null);
  __setFormServiceForTesting(null);
});

afterEach(() => {
  __setRateLimiterForTesting(null);
  __setFormServiceForTesting(null);
});

describe('FormIntakeService.getFormForAdmin', () => {
  it('rejects empty inputs', async () => {
    await expect(formIntakeService.getFormForAdmin('', ORG)).rejects.toBeInstanceOf(
      FormIntakeError
    );
    await expect(formIntakeService.getFormForAdmin(FORM_ID, '')).rejects.toBeInstanceOf(
      FormIntakeError
    );
  });

  it('returns 404 when the form is missing', async () => {
    state.form = null;
    await expect(formIntakeService.getFormForAdmin(FORM_ID, ORG)).rejects.toMatchObject({
      code: 'FORM_NOT_FOUND',
      status: 404,
    });
  });

  it('returns 404 for malformed form ids before querying the database', async () => {
    await expect(formIntakeService.getFormForAdmin('not-a-form-id', ORG)).rejects.toMatchObject({
      code: 'FORM_NOT_FOUND',
      status: 404,
    });
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('refuses cross-tenant forms', async () => {
    state.tableTenantOrg = ORG_OTHER;
    await expect(formIntakeService.getFormForAdmin(FORM_ID, ORG)).rejects.toMatchObject({
      code: 'TENANT_VIOLATION',
      status: 403,
    });
  });

  it('returns intake context including embed_target_table_id when set', async () => {
    state.form!.embed_target_table_id = EMBED_TABLE_ID;
    const ctx = await formIntakeService.getFormForAdmin(FORM_ID, ORG);
    expect(ctx.formId).toBe(FORM_ID);
    expect(ctx.targetTableId).toBe(EMBED_TABLE_ID);
    expect(ctx.fieldAllowList).toBeNull();
  });
});

describe('FormIntakeService.issueJwtLink + verifyJwt', () => {
  it('rejects empty subject / formId / org', async () => {
    await expect(
      formIntakeService.issueJwtLink({ formId: '', organizationId: ORG, subject: 's' })
    ).rejects.toMatchObject({ code: 'FORM_ID_REQUIRED' });

    await expect(
      formIntakeService.issueJwtLink({ formId: FORM_ID, organizationId: '', subject: 's' })
    ).rejects.toMatchObject({ code: 'ORG_ID_REQUIRED' });

    await expect(
      formIntakeService.issueJwtLink({ formId: FORM_ID, organizationId: ORG, subject: '' })
    ).rejects.toMatchObject({ code: 'SUBJECT_REQUIRED' });
  });

  it('issues a token and verifies it round-trip', async () => {
    const issued = await formIntakeService.issueJwtLink({
      formId: FORM_ID,
      organizationId: ORG,
      subject: 'recipient@example.com',
    });
    expect(issued.token).toMatch(/^ey/);
    expect(state.jwtSecretUpdates.length).toBeGreaterThan(0);

    const result = await formIntakeService.verifyJwt({ token: issued.token });
    expect(result.formId).toBe(FORM_ID);
    expect(result.jwtSubject).toBe('recipient@example.com');
  });

  it('refuses tokens whose JWT decoding fails', async () => {
    await expect(formIntakeService.verifyJwt({ token: 'not-a-jwt' })).rejects.toMatchObject({
      code: 'TOKEN_INVALID',
    });
  });

  it('refuses tokens for unpublished forms', async () => {
    const issued = await formIntakeService.issueJwtLink({
      formId: FORM_ID,
      organizationId: ORG,
      subject: 's',
    });
    state.form!.is_published = false;
    await expect(formIntakeService.verifyJwt({ token: issued.token })).rejects.toMatchObject({
      code: 'FORM_NOT_PUBLISHED',
    });
  });

  it('refuses tokens whose form has no JWT secret', async () => {
    // Issue, then wipe the persisted secret to simulate tampering.
    const issued = await formIntakeService.issueJwtLink({
      formId: FORM_ID,
      organizationId: ORG,
      subject: 's',
    });
    state.form!.public_jwt_secret = null;
    await expect(formIntakeService.verifyJwt({ token: issued.token })).rejects.toMatchObject({
      code: 'JWT_NOT_ENABLED',
    });
  });

  it('refuses tokens once the form public_link_expires_at has passed', async () => {
    const issued = await formIntakeService.issueJwtLink({
      formId: FORM_ID,
      organizationId: ORG,
      subject: 's',
    });
    state.form!.public_link_expires_at = new Date(Date.now() - 60_000).toISOString();
    await expect(formIntakeService.verifyJwt({ token: issued.token })).rejects.toMatchObject({
      code: 'TOKEN_EXPIRED',
    });
  });
});

describe('FormIntakeService.submitFromPublic', () => {
  it('rejects empty inputs', async () => {
    await expect(
      formIntakeService.submitFromPublic({
        intakeKind: 'jwt',
        formId: '',
        data: {},
      })
    ).rejects.toMatchObject({ code: 'FORM_ID_REQUIRED' });

    await expect(
      formIntakeService.submitFromPublic({
        intakeKind: 'jwt',
        formId: FORM_ID,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: null as any,
      })
    ).rejects.toMatchObject({ code: 'INVALID_DATA' });
  });

  it('captures rate-limit refusal as an audit row with status="rate_limited"', async () => {
    __setRateLimiterForTesting({
      check: () => ({ allowed: false, resetAt: Date.now() + 60_000 }),
    });
    const result = await formIntakeService.submitFromPublic({
      intakeKind: 'jwt',
      formId: FORM_ID,
      data: { f1: 'v' },
      clientIpHash: 'iphash',
    });
    expect(result.status).toBe('rate_limited');
    expect(result.recordId).toBeNull();
    expect(state.insertedAuditRows).toHaveLength(1);
    expect(state.insertedAuditRows[0].status).toBe('rate_limited');
  });

  it('applies the field allow-list before delegating to FormService', async () => {
    state.form!.field_allow_list = ['f1'];
    const submitMock = vi.fn().mockResolvedValue({ recordId: 'rec-1' });
    __setFormServiceForTesting({ submitForm: submitMock });

    const result = await formIntakeService.submitFromPublic({
      intakeKind: 'jwt',
      formId: FORM_ID,
      data: { f1: 'value', f2: 'should-be-dropped' },
      clientIpHash: 'iphash',
      jwtSubject: 'recipient@example.com',
    });
    expect(result.status).toBe('accepted');
    expect(result.recordId).toBe('rec-1');
    expect(submitMock).toHaveBeenCalledWith(FORM_ID, { f1: 'value' });
    expect(state.insertedAuditRows).toHaveLength(1);
    expect(state.insertedAuditRows[0].status).toBe('accepted');
    expect(state.insertedAuditRows[0].jwt_subject).toBe('recipient@example.com');
  });

  it('captures FormService errors as rejected with failure_reason', async () => {
    __setFormServiceForTesting({
      submitForm: vi.fn().mockRejectedValue(new Error('schema validation failed')),
    });
    const result = await formIntakeService.submitFromPublic({
      intakeKind: 'slug',
      formId: FORM_ID,
      data: { f1: 'v' },
      clientIpHash: 'iphash',
    });
    expect(result.status).toBe('rejected');
    expect(result.failureReason).toContain('schema validation failed');
    expect(state.insertedAuditRows).toHaveLength(1);
    expect(state.insertedAuditRows[0].status).toBe('rejected');
    expect(state.insertedAuditRows[0].intake_kind).toBe('slug');
  });

  it('returns 403 when the form is not published', async () => {
    state.form!.is_published = false;
    await expect(
      formIntakeService.submitFromPublic({
        intakeKind: 'slug',
        formId: FORM_ID,
        data: { f1: 'v' },
      })
    ).rejects.toMatchObject({ code: 'FORM_NOT_PUBLISHED', status: 403 });
  });
});

describe('FormIntakeService.setFieldAllowList', () => {
  it('rejects non-array values that are not null', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formIntakeService.setFieldAllowList(FORM_ID, ORG, 'oops' as any)
    ).rejects.toMatchObject({ code: 'INVALID_ALLOW_LIST' });
  });

  it('rejects allow lists with empty entries', async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formIntakeService.setFieldAllowList(FORM_ID, ORG, ['f1', '' as any])
    ).rejects.toMatchObject({ code: 'INVALID_ALLOW_LIST_ENTRY' });
  });

  it('persists null to fall back to form.config.fields', async () => {
    const ctx = await formIntakeService.setFieldAllowList(FORM_ID, ORG, null);
    expect(ctx.fieldAllowList).toBeNull();
    expect(state.allowListUpdates.at(-1)?.allowList).toBeNull();
  });

  it('persists a deduplicated allow list', async () => {
    state.form!.field_allow_list = ['f1', 'f2'];
    const ctx = await formIntakeService.setFieldAllowList(FORM_ID, ORG, ['f1', 'f1', 'f3']);
    expect(ctx.fieldAllowList).toEqual(['f1', 'f3']);
  });

  it('refuses cross-tenant updates', async () => {
    state.tableTenantOrg = ORG_OTHER;
    await expect(formIntakeService.setFieldAllowList(FORM_ID, ORG, ['f1'])).rejects.toMatchObject({
      code: 'TENANT_VIOLATION',
    });
  });
});

describe('hashClientIp', () => {
  it('is deterministic and varies with input', () => {
    const a = hashClientIp('1.2.3.4');
    const b = hashClientIp('1.2.3.4');
    const c = hashClientIp('5.6.7.8');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toHaveLength(64);
  });
});
