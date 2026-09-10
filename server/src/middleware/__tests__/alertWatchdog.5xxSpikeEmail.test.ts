/** @vitest-environment node */

/**
 * P3 — Obserwowalność i limiter AI (MVP koszyk 2, S2.5).
 *
 * Zlecenie: "wywołaj sztuczny błąd 5xx i pokaż, że alert dotarł" — bez dostępu
 * do skrzynki pocztowej/Slacka nazwanej osoby z tego stanowiska, dowód
 * ograniczony do REALNEJ ścieżki kodu: czy `alertWatchdog.middleware.ts`
 * faktycznie próbuje wysłać e-mail po przekroczeniu progu 5xx (domyślnie
 * 10 błędów w oknie), i NA JAKI adres.
 *
 * ZNALEZISKO (naprawione w tym kroku): `notifyAlert()` czytał WYŁĄCZNIE
 * `ALERT_EMAIL`/`ADMIN_EMAIL` — inną parę zmiennych niż `ALERT_EMAIL_RECIPIENTS`,
 * której używają `AlertEmailService.ts` i `HealthCheckJob.ts`. Pomiar na stagingu
 * (2026-09-10, `railway variables --environment staging`): `ALERT_EMAIL_RECIPIENTS`
 * JEST ustawiona, `ALERT_EMAIL` NIE JEST — więc spike 5xx na stagingu DZIŚ (przed
 * tą poprawką) wysyłał e-mail donikąd (`alertEmail === ''`), mimo że healthcheck-down
 * na ten sam adres działał poprawnie. Ten test dowodzi zachowania PO poprawce.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSendEmail, mockSendSystemAlert } = vi.hoisted(() => ({
  mockSendEmail: vi.fn().mockResolvedValue(true),
  mockSendSystemAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/emailService.js', () => ({
  default: { sendEmail: mockSendEmail },
  sendEmail: mockSendEmail,
}));

vi.mock('../../services/systemAlertNotifier.js', () => ({
  sendSystemAlert: mockSendSystemAlert,
  default: { sendSystemAlert: mockSendSystemAlert },
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import alertWatchdog from '../alertWatchdog.middleware.js';

function fireRequest(statusCode: number): void {
  const req: any = { path: '/api/ai/chat', method: 'POST' };
  const res: any = {
    statusCode,
    end() {
      /* patched by the middleware */
    },
  };
  alertWatchdog(req, res, () => undefined);
  res.end();
}

async function flushAsyncAlertChain(): Promise<void> {
  // checkThresholds runs in a setImmediate off res.end(); notifyAlert inside it
  // is fire-and-forget (`void notifyAlert(...)`) with its own dynamic imports +
  // async email send. A few macrotask turns give the whole chain time to settle.
  for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe('alertWatchdog — sztuczny spike 5xx dociera na maila po naprawie zmiennej', () => {
  const savedEnv = {
    ALERT_EMAIL_RECIPIENTS: process.env.ALERT_EMAIL_RECIPIENTS,
    ALERT_EMAIL: process.env.ALERT_EMAIL,
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete (process.env as any)[key];
      else (process.env as any)[key] = value;
    }
  });

  it('konfiguracja stagingu (ALERT_EMAIL_RECIPIENTS ustawiona, ALERT_EMAIL brak): 10x 500 -> e-mail na piotr.wisniewski@dbr77.com', async () => {
    process.env.ALERT_EMAIL_RECIPIENTS = 'piotr.wisniewski@dbr77.com';
    delete process.env.ALERT_EMAIL;
    delete process.env.ADMIN_EMAIL;

    for (let i = 0; i < 10; i++) fireRequest(500);
    await flushAsyncAlertChain();

    expect(mockSendEmail).toHaveBeenCalled();
    const [to, subject] = mockSendEmail.mock.calls[0];
    expect(to).toBe('piotr.wisniewski@dbr77.com');
    expect(String(subject)).toMatch(/Consultify Alert/);
  });

  it('konfiguracja demo (brak ALERT_EMAIL_RECIPIENTS/ALERT_EMAIL/ADMIN_EMAIL): 10x 500 -> e-mail NIE jest wysyłany (cichy brak adresata)', async () => {
    delete process.env.ALERT_EMAIL_RECIPIENTS;
    delete process.env.ALERT_EMAIL;
    delete process.env.ADMIN_EMAIL;

    for (let i = 0; i < 10; i++) fireRequest(500);
    await flushAsyncAlertChain();

    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
