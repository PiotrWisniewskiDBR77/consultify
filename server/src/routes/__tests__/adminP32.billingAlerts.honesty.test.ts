/**
 * M15-H02 — progi budżetowe muszą być fail-closed.
 *
 * Regresja, którą te testy pilnują: na demo tabela `billing_alerts` NIE ISTNIEJE,
 * a `DbPromise` ma `fallback = true` DOMYŚLNIE również dla `run()`. Skutek: `INSERT`
 * połykał `42P01`, handler odpowiadał `{ success: true }`, UI pokazywał zielony
 * toast, a po ponownym otwarciu te same sfabrykowane wartości domyślne.
 *
 * Dublet `DbPromise` poniżej odtwarza DOKŁADNIE tę semantykę (zweryfikowaną
 * w `server/src/utils/DbPromise.ts`):
 *   - `fallback` domyślnie `true`,
 *   - przy `fallback: true` błąd bazy jest połykany (`get` → null,
 *     `run` → `{ success: false }`),
 *   - przy `fallback: false` błąd jest RZUCANY.
 * Dzięki temu test bez prawdziwego Postgresa nadal rozstrzyga to, co zawiodło
 * na produkcji: czy kod prosi o brak fallbacku i czy ufa read-backowi.
 *
 * Prawdziwy PostgreSQL nie był tu możliwy: lokalna instancja nie ma ról
 * (`role "consultinity" does not exist`), a baza demo jest w tej sesji
 * read-only z mocy zlecenia (zakaz DDL/DML).
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import adminP32Routes from '../adminP32.routes.js';

/** Czy tabela `billing_alerts` „istnieje" w tym scenariuszu. */
let billingAlertsTableExists = true;
/** Wiersz trzymany w pamięci (jeden na organizację — tak jak UNIQUE w schemacie). */
let billingAlertsRow: Record<string, unknown> | null = null;
/** Wymuszenie: zapis „przechodzi", ale nic nie utrwala (0 rows affected). */
let swallowWrites = false;

const logAction = vi.fn();
const getLogs = vi.fn();
const runCalls: Array<{ sql: string; options: any }> = [];
const getCalls: Array<{ sql: string; options: any }> = [];

class MissingTableError extends Error {
  constructor() {
    super('relation "billing_alerts" does not exist');
  }
}

function isBillingAlertsSql(sql: string) {
  return /billing_alerts/i.test(sql);
}

/** Wierna imitacja `DbPromise.get` — fallback domyślnie true. */
async function fakeGet(sql: string, _params?: unknown[], options?: any) {
  const fallback = options?.fallback ?? true;
  if (isBillingAlertsSql(sql)) {
    getCalls.push({ sql, options });
    if (!billingAlertsTableExists) {
      if (fallback) return null;
      throw new MissingTableError();
    }
    return billingAlertsRow;
  }
  // Członkostwo aktora — bez niego `getAdminActor` odcina żądanie na 403,
  // a testowalibyśmy bramkę uprawnień zamiast uczciwości zapisu.
  if (/FROM organization_members/i.test(sql)) return { role: 'ADMIN' };
  return null;
}

/** Wierna imitacja `DbPromise.run` — fallback domyślnie true. */
async function fakeRun(sql: string, params?: unknown[], options?: any) {
  const fallback = options?.fallback ?? true;
  if (isBillingAlertsSql(sql)) {
    runCalls.push({ sql, options });
    if (!billingAlertsTableExists) {
      if (fallback) return { success: false, error: 'relation does not exist' };
      throw new MissingTableError();
    }
    if (swallowWrites) return { success: true, changes: 0 };
    const p = (params || []) as any[];
    billingAlertsRow = {
      id: billingAlertsRow?.id ?? p[0],
      organization_id: p[1],
      token_threshold_80: p[2] ?? 1,
      token_threshold_90: 1,
      token_threshold_100: 1,
      cost_cap_monthly: p[3] ?? null,
      email_notifications: 1,
    };
    return { success: true, changes: 1 };
  }
  return { success: true, changes: 0 };
}

vi.mock('../../utils/DbPromise.js', () => ({
  all: async () => [],
  get: (...args: any[]) => (fakeGet as any)(...args),
  run: (...args: any[]) => (fakeRun as any)(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', organizationId: 'org-1', role: 'admin', isSuperAdmin: false };
    req.userRole = 'admin';
    next();
  },
}));

vi.mock('../../services/adminAuditService.js', () => ({
  default: {
    logAction: (...args: any[]) => logAction(...args),
    getLogs: (...args: any[]) => getLogs(...args),
  },
}));

vi.mock('../../services/accessPolicyService.js', () => ({
  default: { buildPolicySnapshot: async () => null },
}));

function buildApp(): Express {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminP32Routes);
  return app;
}

describe('M15-H02 — progi budżetowe są fail-closed', () => {
  beforeEach(() => {
    billingAlertsTableExists = true;
    billingAlertsRow = null;
    swallowWrites = false;
    runCalls.length = 0;
    getCalls.length = 0;
    logAction.mockReset();
    getLogs.mockReset();
    getLogs.mockResolvedValue([]);
  });

  describe('gdy magazyn progów nie istnieje (stan demo)', () => {
    beforeEach(() => {
      billingAlertsTableExists = false;
    });

    it('PUT nie melduje sukcesu — odpowiada 503 z kodem niedostępności', async () => {
      const res = await request(buildApp())
        .put('/api/admin/billing/alerts')
        .send({ alerts: [{ type: 'tokens', threshold: 80 }, { type: 'spend', threshold: 75 }] });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('BILLING_ALERTS_STORAGE_UNAVAILABLE');
    });

    it('PUT nie zapisuje wpisu audytowego o zmianie, która się nie wydarzyła', async () => {
      await request(buildApp())
        .put('/api/admin/billing/alerts')
        .send({ alerts: [{ type: 'tokens', threshold: 80 }] });

      expect(logAction).not.toHaveBeenCalled();
    });

    it('zapis jawnie wyłącza fallback, więc błąd bazy nie może zostać połknięty', async () => {
      await request(buildApp())
        .put('/api/admin/billing/alerts')
        .send({ alerts: [{ type: 'tokens', threshold: 80 }] });

      expect(runCalls.length).toBeGreaterThan(0);
      for (const call of runCalls) {
        expect(call.options?.fallback).toBe(false);
      }
    });

    it('GET degraduje się uczciwie: available=false i ZERO sfabrykowanych progów', async () => {
      const res = await request(buildApp()).get('/api/admin/billing/alerts');

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(false);
      expect(res.body.unavailableReason).toBe('BILLING_ALERTS_STORAGE_UNAVAILABLE');
      expect(res.body.alerts).toEqual([]);
    });
  });

  describe('gdy magazyn działa', () => {
    it('PUT zwraca sukces oraz stan potwierdzony read-backiem', async () => {
      const res = await request(buildApp())
        .put('/api/admin/billing/alerts')
        .send({ alerts: [{ type: 'tokens', threshold: 80 }, { type: 'spend', threshold: 75 }] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.alerts)).toBe(true);
      expect(res.body.alerts).toHaveLength(2);
      expect(billingAlertsRow?.cost_cap_monthly).toBe(75);
    });

    it('PUT zapisuje wpis audytowy dopiero po potwierdzonym zapisie', async () => {
      await request(buildApp())
        .put('/api/admin/billing/alerts')
        .send({ alerts: [{ type: 'tokens', threshold: 80 }] });

      expect(logAction).toHaveBeenCalledTimes(1);
      expect(logAction.mock.calls[0][0]).toMatchObject({ actionType: 'update_billing_alerts' });
    });

    it('GET zwraca available=true i progi zbudowane z realnego wiersza', async () => {
      const res = await request(buildApp()).get('/api/admin/billing/alerts');

      expect(res.status).toBe(200);
      expect(res.body.available).toBe(true);
      expect(res.body.alerts).toHaveLength(2);
      expect(res.body.alerts[0].id).toBeTruthy();
    });
  });

  describe('gdy zapis „przechodzi", ale nic nie utrwala', () => {
    it('brak zmiany w read-backu jest traktowany jako porażka, nie sukces', async () => {
      swallowWrites = true;

      const res = await request(buildApp())
        .put('/api/admin/billing/alerts')
        .send({ alerts: [{ type: 'tokens', threshold: 80 }, { type: 'spend', threshold: 75 }] });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(logAction).not.toHaveBeenCalled();
    });
  });
});
