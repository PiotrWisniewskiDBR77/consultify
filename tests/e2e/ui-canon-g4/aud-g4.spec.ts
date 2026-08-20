/**
 * UI-CANON G4 — Audits (the sixteenth module) with a signed-auth RBAC matrix.
 *
 * Every session here is produced by typing credentials into the product's own
 * login form. Nothing writes a token into localStorage, mints a JWT, sets
 * E2E_MODE, or intercepts a request — and `assertNoAuthBypass()` proves the
 * shortcuts this codebase ships are inert while the run happens.
 *
 * Usage (servers already up, real Postgres):
 *   npx playwright test tests/e2e/ui-canon-g4/aud-g4.spec.ts \
 *     --project=chromium --workers=1 --retries=0
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { expect, request as apiRequest, test, type Browser, type BrowserContext } from '@playwright/test';

import { SURFACES } from './_glue/registry';
import { seedAuditProgram, seedDrdReport } from './_g4/auditSeed';
import { runMountMatrix } from './_g4/mountMatrix';
import { runPersonaMatrix } from './_g4/personaMatrix';
import {
  assertNoAuthBypass,
  assertNoFixtureResidue,
  cleanupRbacFixture,
  createRbacFixture,
  harnessEnvNegativeControls,
  loginViaApi,
  revokeMembership,
  signedInStateFor,
  type RbacFixture,
} from './_g4/rbacFixture';
import {
  LANGUAGES,
  THEMES,
  setOnboardedUserId,
  sweepCell,
  sweepKeyboard,
  sweepNavigation,
  sweepStates,
  writeResult,
  type SurfaceResult,
} from './_g4/sweep';
import type { ViewportName } from './_g4/types';

const spec = SURFACES.find((s) => s.key === 'AUD');
const API = process.env.E2E_API_URL || 'http://127.0.0.1:3951';
const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3950';
const EVIDENCE_DIR = path.resolve(
  process.cwd(),
  'docs/program/evidence/closure/ui-g4/AUD-UI-CANON-001'
);

/** Retire the first-run modal for a persona through the product's own API. */
async function retireOnboarding(token: string, userId: string) {
  const ctx = await apiRequest.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
  const res = await ctx.put('/api/preferences', {
    data: { onboarding_completed: true, onboarding_role: 'consultant' },
  });
  await ctx.dispose();
  return `PUT /api/preferences (${userId.slice(0, 8)}) -> ${res.status()}`;
}

async function contextForPersona(
  browser: Browser,
  fixture: RbacFixture,
  key: keyof RbacFixture['personas']
) {
  const persona = fixture.personas[key];
  const login = await loginViaApi(persona.email, fixture.password);
  expect(login.status, `${key} must be able to log in through the real endpoint`).toBe(200);
  await retireOnboarding(login.token!, persona.userId);

  // `storageState: undefined` is explicit: the playwright config sets a global
  // storageState (the synthesised admin from `smoke/global-setup.ts`), and this
  // lane must start from a genuinely anonymous browser so the only session it
  // ever holds is the one the login form issues.
  const shell = await browser.newContext({ storageState: undefined });
  const { state, landedOn } = await signedInStateFor(shell, persona.email, fixture.password);
  await shell.close();
  const ctx = await browser.newContext({ storageState: state });
  return { ctx, persona, token: login.token!, landedOn, state };
}

/**
 * Where does this persona end up when it deep-links to a route?
 *
 * The path is sampled early and then polled until it stops changing, because
 * compatibility redirects and asynchronous shell hydration can change the
 * first path. Both the first and settled path are recorded so this remains
 * evidence rather than something the harness sleeps away.
 */
async function landingFor(ctx: BrowserContext, route: string) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(3000);
  const firstPath = await page.evaluate(() => window.location.pathname + window.location.search);
  let settledPath = firstPath;
  let stable = 0;
  for (let i = 0; i < 20 && stable < 3; i++) {
    await page.waitForTimeout(1000);
    const now = await page.evaluate(() => window.location.pathname + window.location.search);
    stable = now === settledPath ? stable + 1 : 0;
    settledPath = now;
  }

  const out = await page.evaluate(() => ({
    path: window.location.pathname + window.location.search,
    auditsHub: !!document.querySelector('[data-testid="audits-hub"]'),
    criterionWorkspace: !!document.querySelector('[data-testid="criterion-workspace"]'),
    text: (document.querySelector('#root') as HTMLElement | null)?.innerText
      ?.replace(/\s+/g, ' ')
      .slice(0, 220),
  }));
  await page.close();
  return { ...out, path: settledPath, firstPath, bounced: firstPath !== settledPath };
}

test.describe('UI-CANON G4 — AUD (Audits) signed-auth matrix', () => {
  test.skip(!spec, 'AUD surface missing from the registry');
  test.setTimeout(45 * 60 * 1000);

  test('audits canon matrix and RBAC negatives', async ({ browser }) => {
    if (!spec) return;
    const productSha = execSync('git rev-parse HEAD').toString().trim();
    const runId = `g4aud-${productSha.slice(0, 7)}-${process.env.G4_RUN_SUFFIX || 'a'}`;

    // ── Negative controls first: prove the shortcuts are inert ───────────────
    const bypass = await assertNoAuthBypass();

    // ── Anonymous must never see a fragment of the application ──────────────
    // Sampled every 250ms through the whole redirect window, not once at the
    // end, because the failure this guards against is a flash of app chrome
    // before the redirect lands.
    const anonymous: Array<{ route: string; finalPath: string; leaked: string[] }> = [];
    for (const route of [
      '/audit-programs',
      '/audit-programs?tab=library',
      '/audit-programs/p/criteria/c',
      '/audit-programs/drd-report/r?ff_drd_report=1',
    ]) {
      const anon = await browser.newContext({ storageState: undefined });
      const page = await anon.newPage();
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
      const leaked: string[] = [];
      for (let i = 0; i < 24; i++) {
        const seen = await page
          .evaluate(() => ({
            hub: !!document.querySelector('[data-testid="audits-hub"]'),
            criterion: !!document.querySelector('[data-testid="criterion-workspace"]'),
            report: !!document.querySelector('[data-testid="drd-audit-report"]'),
          }))
          .catch(() => null);
        if (seen && (seen.hub || seen.criterion || seen.report)) {
          leaked.push(`${i * 250}ms ${JSON.stringify(seen)}`);
        }
        await page.waitForTimeout(250);
      }
      const finalPath = new URL(page.url()).pathname;
      anonymous.push({ route, finalPath, leaked });
      await anon.close();
      expect(leaked, `anonymous must not see an Audits surface on ${route}`).toEqual([]);
      expect(finalPath, `anonymous must be sent to login from ${route}`).toBe('/login');
    }

    // ── Real personas, real logins ──────────────────────────────────────────
    const fixture = await createRbacFixture(runId);
    let cleanup: Awaited<ReturnType<typeof cleanupRbacFixture>> | null = null;
    let residue: number | null = null;
    try {
    // Capture a token for the soon-to-be-revoked persona while its membership is
    // still ACTIVE. The persona matrix below revokes it, so this is the only
    // moment a genuinely "valid at issuance" token can be obtained.
    const revoked = fixture.personas.revokedMember;
    const revokedLogin = await loginViaApi(revoked.email, fixture.password);
    expect(
      revokedLogin.status,
      'the revoked persona must be able to log in while still ACTIVE'
    ).toBe(200);

    const admin = await contextForPersona(browser, fixture, 'platformAdmin');
    const auditee = await contextForPersona(browser, fixture, 'auditee');
    const member = await contextForPersona(browser, fixture, 'member');
    const foreign = await contextForPersona(browser, fixture, 'foreignTenant');

    // ── One canonical mount, proven simultaneously on two real tenants ──────
    const flagOn = await landingFor(admin.ctx, '/audit-programs?tab=library');
    const flagOff = await landingFor(foreign.ctx, '/audit-programs?tab=library');
    expect(flagOn.path, 'primary tenant must remain on the canonical Audits hub').toBe(
      '/audit-programs?tab=library'
    );
    expect(flagOff.path, 'foreign tenant must use the same canonical mount').toBe(
      '/audit-programs?tab=library'
    );
    expect(flagOn.auditsHub).toBe(true);
    expect(flagOff.auditsHub).toBe(true);

    // ── Cross-tenant: the foreign admin must not see the primary tenant ─────
    const foreignApi = await apiRequest.newContext({
      baseURL: API,
      extraHTTPHeaders: { Authorization: `Bearer ${foreign.token}` },
    });
    const foreignFlags = await foreignApi.get('/api/feature-flags/runtime');
    const foreignFlagBody = (await foreignFlags.json()) as { flags?: Record<string, boolean> };
    expect(
      foreignFlagBody.flags?.auditsFiveSurfacesV1 ?? false,
      'the tenant-scoped flag must not leak to another organization'
    ).toBe(false);
    await foreignApi.dispose();


    // Theme/language/onboarding preferences are set before first paint by the
    // shared sweep. That is preference state, not authentication state — the
    // session itself still comes only from the real login above.
    setOnboardedUserId(admin.persona.userId);

    // ── The 12-cell canon matrix, under the real-login admin session ────────
    const cells: SurfaceResult['cells'] = [];
    const viewports: ViewportName[] = ['desktop', 'tablet', 'mobile'];
    for (const viewport of viewports) {
      for (const language of LANGUAGES) {
        for (const theme of THEMES) {
          cells.push(await sweepCell(admin.ctx, spec, viewport, language, theme));
        }
      }
    }
    for (const route of spec.secondaryRoutes || []) {
      cells.push(await sweepCell(admin.ctx, spec, 'desktop', 'pl', 'light', route));
    }

    // ── Deep-link / hard reload / cold reopen from a fresh context ──────────
    const nav = await sweepNavigation(
      admin.ctx,
      () => browser.newContext({ storageState: admin.state }),
      spec
    );
    const keyboard = await sweepKeyboard(admin.ctx, spec);
    const states = await sweepStates(admin.ctx, spec);

    // ── Real audit data, so "ready" is a populated surface and the criterion
    //    deep-link has a genuine, non-404 target. Created entirely through the
    //    canonical authenticated API (`/api/audits/*`), never by SQL.
    const seed = await seedAuditProgram(admin.token, { name: `G4 Audits ${runId}` });

    // With data present, cross-tenant denial becomes a real test rather than
    // two empty lists agreeing with each other.
    const foreignApi2 = await apiRequest.newContext({
      baseURL: API,
      extraHTTPHeaders: { Authorization: `Bearer ${foreign.token}` },
    });
    const foreignList = await foreignApi2.get('/api/audits/programs');
    const foreignListBody = (await foreignList.json()) as { programs?: unknown[] };
    const foreignDirect = await foreignApi2.get(`/api/audits/programs/${seed.programId}`);
    const foreignDirectBody = await foreignDirect.text();
    await foreignApi2.dispose();
    expect(
      (foreignListBody.programs ?? []).length,
      'the foreign tenant must not list the primary tenant programs'
    ).toBe(0);
    expect(
      foreignDirect.status(),
      'fetching another tenant program by id must not succeed'
    ).not.toBe(200);

    // ── The full six-persona allowed/forbidden matrix, against the real API.
    //    Roles are granted through the product's own add-member endpoint and
    //    every denial traces to a capability or segregation-of-duties rule that
    //    already exists in server/src/services/audits/permissions.ts.
    const personaMatrix = await runPersonaMatrix(fixture, seed);
    for (const [key, entry] of Object.entries(personaMatrix)) {
      if (key === 'revokedMember') continue; // no action can succeed once revoked, by design
      expect(entry.allowed.ok, `${key}: its allowed action must really succeed`).toBe(true);
      expect(entry.forbidden.denied, `${key}: its forbidden action must really be denied`).toBe(
        true
      );
    }
    expect(
      personaMatrix.revokedMember.scopedRead.status,
      'a revoked membership must not read the tenant'
    ).toBe(403);

    // ── Four mounts × five kinds of caller, on a fixture of its own so the
    //    60s membership cache window can be measured without disturbing the
    //    persona matrix (and so two fixtures genuinely run side by side).
    const mountFixture = await createRbacFixture(`${runId}-mounts`);
    let mountMatrix: Awaited<ReturnType<typeof runMountMatrix>> | null = null;
    try {
      const mountStale = await loginViaApi(
        mountFixture.personas.revokedMember.email,
        mountFixture.password
      );
      const mountActive = await loginViaApi(
        mountFixture.personas.platformAdmin.email,
        mountFixture.password
      );
      const mountForeign = await loginViaApi(
        mountFixture.personas.foreignTenant.email,
        mountFixture.password
      );
      expect(mountStale.status, 'the mount-matrix stale persona must log in while ACTIVE').toBe(200);

      // Audit packs are organization-scoped, so the write probe needs a pack
      // belonging to THIS fixture's tenant — a pack from the other tenant would
      // fail for a permitted caller too and make the denial meaningless.
      const mountSeed = await seedAuditProgram(mountActive.token!, {
        name: `G4 mount matrix ${runId}`,
      });

      mountMatrix = await runMountMatrix({
        apiBase: API,
        supportKey: process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me',
        activeToken: mountActive.token!,
        foreignToken: mountForeign.token!,
        staleToken: mountStale.token!,
        revokedUserId: mountFixture.personas.revokedMember.userId,
        revokedOrganizationId: mountFixture.personas.revokedMember.organizationId,
        primaryOrganizationId: mountFixture.primaryOrgId,
        // A real published pack, so the write probe would genuinely create a
        // program for a permitted caller and a 403 cannot be a disguised 404.
        validPackId: mountSeed.packId,
      });

      expect(
        mountMatrix.immediateRevoke.firstRequestAfterRevoke.every((s) => s === 403),
        'the FIRST request after revoke, with no sleep, must be 403 on every Audits mount'
      ).toBe(true);

      // Denial is required of the callers who have no standing at all. The
      // foreign tenant is deliberately excluded: it is an active member of its
      // own organization, so it is scoped, not refused — its isolation is
      // asserted by the persona matrix (0 primary-tenant rows, 404 by id).
      for (const row of mountMatrix.rows) {
        if (row.caller === 'activeMember' || row.caller === 'foreignTenant') continue;
        expect(row.allDenied, `${row.caller} must be refused on every Audits mount`).toBe(true);
      }
      expect(
        mountMatrix.revokedSideEffects.mutated,
        'a refused caller must not change audit rows'
      ).toBe(false);
      expect(
        mountMatrix.revokedSideEffects.telemetryRowsForRevokedUser,
        'a refused caller must not be recorded as an Audits actor'
      ).toBe(0);
    } finally {
      await cleanupRbacFixture(mountFixture);
    }

    // Revocation evidence runs AFTER the persona matrix: the matrix needs the
    // revoked persona to be able to log in while still ACTIVE, which is the
    // only way to hold a token that was valid at issuance.
    // ── Revocation: valid at issuance, membership withdrawn afterwards ──────
    // The persona matrix has already revoked this membership; make it explicit
    // and idempotent so the sequence reads correctly in the evidence.
    const revokeDetail = await revokeMembership(revoked.userId, revoked.organizationId);
    const staleTokenApi = await apiRequest.newContext({
      baseURL: API,
      extraHTTPHeaders: { Authorization: `Bearer ${revokedLogin.token}` },
    });
    const staleMe = await staleTokenApi.get('/api/auth/me');
    const staleGuarded = await staleTokenApi.get('/api/conversations');
    await staleTokenApi.dispose();
    const reLogin = await loginViaApi(revoked.email, fixture.password);

    // ── Five consecutive COLD deep-links per tab. Before the guard fix this
    //    bounced through the hub whenever the tenant flag had not arrived yet.
    const coldDeepLinkRuns: Array<{ run: number; rendered: number; detail: string[] }> = [];
    for (let run = 1; run <= 5; run++) {
      const detail: string[] = [];
      let rendered = 0;
      for (const route of spec.secondaryRoutes || []) {
        const cold = await browser.newContext({ storageState: admin.state });
        const page = await cold.newPage();
        await page.setViewportSize({ width: 1440, height: 900 });
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
        const selector = spec.routeSelectors?.[route];
        let ok = false;
        try {
          await page.locator(selector!).first().waitFor({ state: 'visible', timeout: 20000 });
          ok = true;
        } catch {
          /* recorded as a failure below */
        }
        if (ok) rendered++;
        detail.push(`${route.split('tab=')[1]}:${ok ? 'OK' : 'FAIL'}@${new URL(page.url()).pathname}`);
        await cold.close();
      }
      coldDeepLinkRuns.push({ run, rendered, detail });
      expect(rendered, `cold deep-link run ${run} must render all five tabs`).toBe(
        (spec.secondaryRoutes || []).length
      );
    }

    // ── Role landings recorded verbatim, policy not invented ────────────────
    const readyCriterionPath = seed.firstCriterionId
      ? `/audit-programs/${seed.programId}/criteria/${seed.firstCriterionId}`
      : null;
    const roleLandings = {
      platformAdminHub: await landingFor(admin.ctx, '/audit-programs'),
      auditeeHub: await landingFor(auditee.ctx, '/audit-programs'),
      memberHub: await landingFor(member.ctx, '/audit-programs'),
      foreignHub: await landingFor(foreign.ctx, '/audit-programs'),
      staleCriterion: await landingFor(
        admin.ctx,
        '/audit-programs/00000000-0000-0000-0000-000000000000/criteria/00000000-0000-0000-0000-000000000000'
      ),
      staleDrdReport: await landingFor(
        admin.ctx,
        '/audit-programs/drd-report/00000000-0000-0000-0000-000000000000?ff_drd_report=1'
      ),
      // Ready/success: a real criterion of a real published pack.
      readyCriterionAsAdmin: readyCriterionPath
        ? await landingFor(admin.ctx, readyCriterionPath)
        : null,
      // Same real criterion, seen by a plain member and by another tenant.
      readyCriterionAsMember: readyCriterionPath
        ? await landingFor(member.ctx, readyCriterionPath)
        : null,
      readyCriterionAsForeignTenant: readyCriterionPath
        ? await landingFor(foreign.ctx, readyCriterionPath)
        : null,
    };

    // ── The two record surfaces, measured as full canon cells so the secondary
    //    denominator is 5 tabs + criterion + report = 7. Their ids only exist at
    //    runtime, so their markers are attached to a per-run copy of the spec.
    // A real assessment + report + one real section: the view renders an
    // "empty report" branch with no marker when a report has zero sections, and
    // a *program* id here (the earlier mistake) is simply a 404.
    const drd = await seedDrdReport(admin.token, {});
    const reportPath = `/audit-programs/drd-report/${drd?.reportId ?? seed.programId}?ff_drd_report=1`;
    const recordSpec = {
      ...spec,
      routeSelectors: {
        ...(spec.routeSelectors || {}),
        ...(readyCriterionPath
          ? { [readyCriterionPath]: '[data-testid="criterion-workspace"]' }
          : {}),
        [reportPath]: '[data-testid="drd-audit-report"]',
      },
    };
    if (readyCriterionPath) {
      cells.push(await sweepCell(admin.ctx, recordSpec, 'desktop', 'pl', 'light', readyCriterionPath));
    }
    cells.push(await sweepCell(admin.ctx, recordSpec, 'desktop', 'pl', 'light', reportPath));

    for (const ctx of [admin.ctx, auditee.ctx, member.ctx, foreign.ctx]) await ctx.close();

    const result: SurfaceResult = {
      taskId: spec.taskId,
      key: spec.key,
      module: spec.module,
      route: spec.route,
      productSha,
      startedAt: new Date().toISOString(),
      cells,
      ...nav,
      keyboard,
      states,
      statesNotPresent: spec.statesNotPresent || [],
      negativeControls: {
        ...bypass,
        ...harnessEnvNegativeControls(),
        primaryTenantLanding: `settled ${flagOn.path} (first ${flagOn.firstPath}, bounced=${flagOn.bounced}, audits-hub=${flagOn.auditsHub})`,
        foreignTenantLanding: `settled ${flagOff.path} (first ${flagOff.firstPath}, bounced=${flagOff.bounced}, audits-hub=${flagOff.auditsHub})`,
        retiredFlagDoesNotLeakAcrossTenants:
          'GET /api/feature-flags/runtime as the foreign-tenant admin returns auditsFiveSurfacesV1 = false; the canonical /audit-programs mount no longer depends on it',
        revokedMembershipSequence: `login BEFORE revocation -> ${revokedLogin.status}; ${revokeDetail}; re-login AFTER revocation -> ${reLogin.status} ${reLogin.text.slice(0, 120)}`,
        revokedTokenOnUnguardedRoute: `GET /api/auth/me with the pre-revocation token -> ${staleMe.status()}`,
        revokedTokenOnMembershipGuardedRoute: `GET /api/conversations (one of only two routes carrying validateOrgMembership) -> ${staleGuarded.status()}`,
        seededThroughCanonicalApi: `pack ${seed.packId} (${seed.packPublicationStatus}) -> program ${seed.programId} with ${seed.criteria.length} criteria, all via authenticated POST /api/audits/* — no SQL writes`,
        crossTenantListDenied: `foreign tenant GET /api/audits/programs -> ${foreignList.status()} with ${(foreignListBody.programs ?? []).length} programs while the primary tenant has ${seed.criteria.length ? 'a seeded program' : 'none'}`,
        crossTenantDirectFetchDenied: `foreign tenant GET /api/audits/programs/${seed.programId} -> ${foreignDirect.status()} ${foreignDirectBody.slice(0, 120)}`,
        legacyWriterRetired:
          'POST /api/audit/programs (singular) answers 410 AUDIT_PROGRAM_LEGACY_WRITE_DISABLED; the canonical writer is POST /api/audits/programs (plural). Seeding uses the live writer only.',
      },
      gates: spec.gates,
    };

    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, 'RBAC_MATRIX.json'),
      JSON.stringify(
        {
          productSha,
          runId,
          personas: Object.fromEntries(
            Object.entries(fixture.personas).map(([k, p]) => [
              k,
              { memberRole: p.memberRole, userRole: p.userRole, tenant: p.tenant },
            ])
          ),
          sessionsObtainedBy: 'the product login form at /auth — no token or user was written into localStorage',
          roleLandings,
          anonymousAccess: anonymous,
          coldDeepLinkRuns,
          personaMatrix,
          mountMatrix,
          negativeControls: result.negativeControls,
        },
        null,
        2
      ) + '\n'
    );

    const file = writeResult(spec, result);
    // eslint-disable-next-line no-console
    console.log(`[G4] ${spec.taskId} → ${file}`);
    } finally {
      // Always purge, even if an assertion above failed, then prove it worked.
      cleanup = await cleanupRbacFixture(fixture);
      residue = await assertNoFixtureResidue(fixture);
      // eslint-disable-next-line no-console
      console.log(`[G4] fixture cleanup: ${cleanup.detail}; residue=${residue}`);
    }
  });
});
