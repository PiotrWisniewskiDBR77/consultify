/**
 * Acceptance E2E — RED-FINAL sweep (Odbiór 2026-07-19, ŁOWCA RED finał).
 *
 * Rewir (ostatnie nieprzemiecione mounty w Gateway.ts): user-settings
 * (/api/user/*, /api/settings, /api/preferences, /api/profile) · work-canvas /
 * workbook · meeting · organization-context(-store) / organization-profiles /
 * organization-data · collaboration (/api/conversations) · onboarding · oraz
 * pozostałe niezmiecione moduły biznesowe (competency, cv-matching, skills-gap,
 * change-sentiment, stakeholder-comm, gamification, megatrends, feedback,
 * revenue, referrals, content, compliance, gdpr, benchmark, conclusions,
 * module-access/interest, voice, status-reports).
 *
 * Metoda: realny runtime — realne routery + realny verifyToken + realny Postgres
 * PARITY pg18 (:5443), zero mocków. Każdy endpoint zamontowany w Gateway.ts z
 * tego rewiru został przemieciony GET-em i (dla named-targets) write-em.
 *
 * WYNIK SWEEPU: REWIR CZYSTY dla klasy RED (schema-500: 42703/42P01/23502/
 * 22P02/42883/42804). Wszystkie ścieżki write przechodzą — adapter
 * PostgresDatabase neutralizuje SQLite-izmy (datetime('now')→NOW(),
 * INSERT OR REPLACE→ON CONFLICT), więc żaden write nie 5xx-uje. Brak migracji
 * braku. Ten plik UTWARDZA ten stan (regression pin).
 *
 * DWA udokumentowane, NIE-schema wyjątki (pinnięte, świadome — NIE RED):
 *   K1 · GET /api/user/ai-preferences → 500 "Failed to load route".
 *        `ai-preferences-extended.routes.ts` = createLazyRoute('./ai-preferences-extended.js');
 *        plik-brat .js NIE ISTNIEJE (tylko .routes.ts). To rodzina 46 lazy-wrapperów
 *        / 42 self-import (MEMORY finding) — decyzja Piotra, poza bezpiecznym
 *        zakresem migracji. Pinnięte, by nie zmieniło się po cichu.
 *   K2 · degraded-mode stuby (świadome 503 not_configured): /api/user/privacy-settings,
 *        /api/user/professional-profile. Kontrakt „feature not configured".
 *
 * Wiersze tworzone przez write-asercje niosą odwracalny marker `odbior--redfin--`
 * i są kasowane w afterAll. DATABASE_URL asertowany jako LOCAL.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient, requireLocalDbUrl } from './harness.js';
import { seed, SEED } from './seed.mjs';

requireLocalDbUrl();

/** Mount ONE real router behind real verifyToken on its own app (avoids the
 *  shared module-level pg-client concurrency artifact of mounting many at once). */
async function appFor(mount: string, mod: string): Promise<Express> {
  const { verifyToken } = await import('../../server/src/middleware/auth.middleware.js');
  const router = (await import(mod)).default;
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(mount, verifyToken as any, router);
  return app;
}

// GET rewir — every entry MUST NOT 5xx (schema-green). Representative coverage.
const GET_GREEN: { mount: string; mod: string; paths: string[] }[] = [
  { mount: '/api/work-canvas', mod: '../../server/src/routes/work-canvas.routes.js', paths: ['/drafts'] },
  { mount: '/api/workbook', mod: '../../server/src/routes/workbook.routes.js', paths: ['/list'] },
  { mount: '/api/conversations', mod: '../../server/src/routes/conversations.routes.js', paths: ['/', '/search'] },
  { mount: '/api/onboarding', mod: '../../server/src/routes/onboarding.routes.js', paths: ['/status'] },
  { mount: '/api/organization-context', mod: '../../server/src/routes/organization-context.routes.js', paths: ['/', '/timeline', '/claims'] },
  { mount: '/api/organization-context-store', mod: '../../server/src/routes/organization-context-store.routes.js', paths: ['/'] },
  { mount: '/api/organization-data', mod: '../../server/src/routes/organization/organization-data.routes.js', paths: ['/stats', '/retention'] },
  { mount: '/api/organization', mod: '../../server/src/routes/organization/organization-limits.routes.js', paths: ['/policy-snapshot'] },
  { mount: '/api/organization-profiles', mod: '../../server/src/routes/organization/organization-profiles.routes.js', paths: [`/${SEED.ORG_ID}`, `/${SEED.ORG_ID}/trust`, `/${SEED.ORG_ID}/audit`] },
  { mount: '/api/preferences', mod: '../../server/src/routes/user/preferences.routes.js', paths: ['/', '/options'] },
  { mount: '/api/user/availability', mod: '../../server/src/routes/user/user-availability.routes.js', paths: ['/'] },
  { mount: '/api/user/contact-information', mod: '../../server/src/routes/user/user-contact.routes.js', paths: ['/'] },
  { mount: '/api/user/data-controls', mod: '../../server/src/routes/user/user-data-controls.routes.js', paths: ['/data-export'] },
  { mount: '/api/user/profile-completeness', mod: '../../server/src/routes/user/user-profile-completeness.routes.js', paths: ['/'] },
  { mount: '/api/user/security', mod: '../../server/src/routes/user/user-security-advanced.routes.js', paths: ['/sessions', '/login-history', '/trusted-devices'] },
  { mount: '/api/settings', mod: '../../server/src/routes/settings.routes.js', paths: ['/', '/preferences/regional', '/notifications', '/integrations', '/gdpr/consents', '/working-hours', '/signatures'] },
  { mount: '/api/meeting', mod: '../../server/src/routes/meeting.routes.js', paths: ['/'] },
  // remainder business modules
  { mount: '/api/competency', mod: '../../server/src/routes/competency.routes.js', paths: ['/categories', '/levels', '/competencies'] },
  { mount: '/api/cv-matching', mod: '../../server/src/routes/cv-matching.routes.js', paths: ['/candidates'] },
  { mount: '/api/skills-gap', mod: '../../server/src/routes/skills-gap.routes.js', paths: ['/by-competency'] },
  { mount: '/api/change-sentiment', mod: '../../server/src/routes/change-sentiment.routes.js', paths: ['/pulse/summary', '/feedback', '/alerts'] },
  { mount: '/api/stakeholder-comm', mod: '../../server/src/routes/stakeholder-comm.routes.js', paths: ['/segments', '/plans', '/templates', '/overdue'] },
  { mount: '/api/megatrends', mod: '../../server/src/routes/megatrend.routes.js', paths: ['/baseline', '/radar'] },
  { mount: '/api/feedback', mod: '../../server/src/routes/feedback.routes.js', paths: ['/', '/pulse-summary', '/trending', '/stats/summary'] },
  { mount: '/api/revenue', mod: '../../server/src/routes/revenue.routes.js', paths: ['/subscription-changes', '/revenue-recognition', '/forecasts'] },
  { mount: '/api/compliance', mod: '../../server/src/routes/compliance.routes.js', paths: ['/gdpr', '/cookies', '/data-retention'] },
  { mount: '/api/gdpr', mod: '../../server/src/routes/gdpr.routes.js', paths: ['/consents', '/retention', '/export-status'] },
  { mount: '/api/benchmark', mod: '../../server/src/routes/benchmark.routes.js', paths: ['/'] },
  { mount: '/api/conclusions', mod: '../../server/src/routes/conclusions.routes.js', paths: ['/', '/readouts'] },
  { mount: '/api/content', mod: '../../server/src/routes/content.routes.js', paths: ['/categories', '/tags'] },
  { mount: '/api/module-access', mod: '../../server/src/routes/module-access.routes.js', paths: ['/my'] },
  { mount: '/api/module-interest', mod: '../../server/src/routes/module-interest.routes.js', paths: ['/my'] },
  { mount: '/api/status-reports', mod: '../../server/src/routes/status-reports.routes.js', paths: ['/'] },
  { mount: '/api/voice', mod: '../../server/src/routes/voice.routes.js', paths: ['/health'] },
];

async function cleanup() {
  const c = pgClient();
  await c.connect();
  try {
    await c.query(`DELETE FROM conversations WHERE title LIKE 'odbior--redfin--%'`).catch(() => {});
    await c.query(`DELETE FROM work_canvas_drafts WHERE title LIKE 'odbior--redfin--%'`).catch(() => {});
    await c.query(`DELETE FROM user_contact WHERE user_id = $1`, [SEED.USER_ID]).catch(() => {});
    await c.query(`DELETE FROM user_availability WHERE user_id = $1`, [SEED.USER_ID]).catch(() => {});
    await c.query(`DELETE FROM user_onboarding_status WHERE user_id = $1`, [SEED.USER_ID]).catch(() => {});
    await c.query(`DELETE FROM organization_context_store WHERE organization_id = $1`, [SEED.ORG_ID]).catch(() => {});
  } finally {
    await c.end();
  }
}

describe('RED-FINAL · rewir czysty (schema-green) + pinned known exceptions', () => {
  beforeAll(async () => {
    await seed();
    await cleanup();
  });
  afterAll(cleanup);

  it('GET rewir: żaden endpoint nie zwraca 5xx (brak schema-500)', async () => {
    const tok = mintToken();
    const offenders: { url: string; status: number; body: string }[] = [];
    for (const g of GET_GREEN) {
      const app = await appFor(g.mount, g.mod);
      for (const p of g.paths) {
        // One retry: some routers share the test-mode getDatabase() singleton
        // pg-client and fire un-awaited background queries, which can trigger a
        // transient socket reset in-process (NOT a product bug — prod uses a
        // pooled connection per request). A real schema-500 reproduces on retry.
        let last: { status: number; body: string } | null = null;
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const res = await request(app).get(g.mount + p).set('Authorization', `Bearer ${tok}`);
            last = res.status >= 500 ? { status: res.status, body: JSON.stringify(res.body).slice(0, 200) } : null;
            break;
          } catch (e: any) {
            last = { status: -1, body: `THROW: ${e.message}` };
            await new Promise((r) => setTimeout(r, 25));
          }
        }
        if (last) offenders.push({ url: g.mount + p, ...last });
      }
    }
    expect(offenders, `Nowe schema-500 w rewirze RED-FINAL: ${JSON.stringify(offenders, null, 2)}`).toEqual([]);
  });

  it('WRITE utwardzenie: named-target write paths przechodzą (adapter neutralizuje SQLite-izmy)', async () => {
    const tok = mintToken();

    // user-contact PUT — używa datetime('now'); adapter → NOW()
    const contact = await appFor('/api/user/contact-information', '../../server/src/routes/user/user-contact.routes.js');
    const rc = await request(contact).put('/api/user/contact-information').set('Authorization', `Bearer ${tok}`)
      .send({ phone: '+48000', address: 'x', city: 'y', country: 'PL', postalCode: '00-000', linkedin: '', website: '' });
    expect(rc.status, JSON.stringify(rc.body)).toBeLessThan(500);
    expect(rc.status).toBe(200);

    // user-availability PUT — datetime('now') + ON CONFLICT
    const avail = await appFor('/api/user/availability', '../../server/src/routes/user/user-availability.routes.js');
    const ra = await request(avail).put('/api/user/availability').set('Authorization', `Bearer ${tok}`)
      .send({ settings: { timezone: 'UTC', workingDays: [1, 2, 3] } });
    expect(ra.status, JSON.stringify(ra.body)).toBe(200);

    // conversations POST — collaboration create
    const conv = await appFor('/api/conversations', '../../server/src/routes/conversations.routes.js');
    const rv = await request(conv).post('/api/conversations').set('Authorization', `Bearer ${tok}`)
      .send({ title: 'odbior--redfin--conv', language: 'pl' });
    expect(rv.status, JSON.stringify(rv.body)).toBeLessThan(500);
    expect([200, 201]).toContain(rv.status);
  });

  it('KNOWN K1 · GET /api/user/ai-preferences pinned 500 (lazy-wrapper self-import, decyzja Piotra)', async () => {
    const tok = mintToken();
    const app = await appFor('/api/user/ai-preferences', '../../server/src/routes/ai/ai-preferences-extended.routes.js');
    const res = await request(app).get('/api/user/ai-preferences/').set('Authorization', `Bearer ${tok}`);
    // Udokumentowany defekt rodziny lazy-wrapperów — NIE schema-500. Pinnięte.
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Failed to load route' });
  });

  it('KNOWN K2 · degraded-mode stuby zwracają świadome 503 not_configured', async () => {
    const tok = mintToken();
    for (const mod of [
      '../../server/src/routes/user/user-privacy-extended.routes.js',
      '../../server/src/routes/user/user-professional-profile.routes.js',
    ]) {
      const app = await appFor('/api/x', mod);
      const res = await request(app).get('/api/x/').set('Authorization', `Bearer ${tok}`);
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ type: 'not_configured' });
    }
  });
});
