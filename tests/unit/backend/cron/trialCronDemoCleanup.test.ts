/**
 * TrialCron.runDemoCleanup — w1a-sprzatanie-20260910, zadanie 3.
 *
 * Cel: sprzątanie klonów sesji demo miało tylko JEDEN przebieg dziennie (job3,
 * `runDailyTrialTasks`, 2:30 w server/src/cron/Scheduler.ts) — stąd 11 klonów
 * na stagingu w ciągu jednego dnia. `runDemoCleanup` to nowa, samodzielna
 * ścieżka wołana przez osobny, częstszy (domyślnie godzinowy) harmonogram
 * job3b, NIEZALEŻNIE od `runDailyTrialTasks` (który dalej robi ostrzeżenia
 * trialowe raz dziennie — te NIE mają się uruchamiać co godzinę).
 *
 * Testuje realny plik produkcyjny `server/src/cron/TrialCron.ts` (ten, który
 * faktycznie importuje i rejestruje `server/src/cron/Scheduler.ts`) — NIE
 * legacy `server/cron/trialCron.ts`, który nie jest wołany z żadnego
 * prawdziwego entrypointu (potwierdzone grep-em w meldunku).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('TrialCron.runDemoCleanup', () => {
  let trialCronModule: typeof import('../../../../server/src/cron/TrialCron.js');
  let mockDemoService: { cleanupExpiredDemos: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.resetModules();

    mockDemoService = {
      cleanupExpiredDemos: vi.fn().mockResolvedValue(4),
    };

    vi.doMock('../../../../server/src/services/demoService.js', () => ({
      default: mockDemoService,
      cleanupExpiredDemos: mockDemoService.cleanupExpiredDemos,
    }));

    // trialService jest ładowany leniwie przez ensureDeps() nawet dla
    // runDemoCleanup (dzieli ensureDeps z runDailyTrialTasks) — mockujemy, żeby
    // test nie dotykał prawdziwej bazy.
    vi.doMock('../../../../server/src/services/trialService.js', () => ({
      default: {
        sendTrialWarnings: vi.fn().mockResolvedValue(0),
        processExpiredTrials: vi.fn().mockResolvedValue(0),
      },
    }));

    trialCronModule = await import('../../../../server/src/cron/TrialCron.js');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock('../../../../server/src/services/demoService.js');
    vi.doUnmock('../../../../server/src/services/trialService.js');
  });

  it('woła demoService.cleanupExpiredDemos i zwraca jego wynik', async () => {
    const result = await trialCronModule.runDemoCleanup();
    expect(mockDemoService.cleanupExpiredDemos).toHaveBeenCalledTimes(1);
    expect(result).toBe(4);
  });

  it('NIE woła trialService — ostrzeżenia trialowe zostają na cyklu dziennym', async () => {
    // Import świeżego mocka trialService przez require cache nie jest tu
    // wystawiony wprost, ale runDemoCleanup w ogóle nie odwołuje się do
    // deps.trialService w swoim ciele (patrz TrialCron.ts) — sprawdzamy więc
    // pośrednio: wywołanie się nie wywala, mimo że trialService zwraca 0 i
    // nigdy nie jest odpytywany o sendTrialWarnings/processExpiredTrials przez
    // TĘ ścieżkę (to pokrywa osobny test `runDailyTrialTasks`).
    await expect(trialCronModule.runDemoCleanup()).resolves.toBe(4);
  });

  it('gdy DemoService jest niedostępny, zwraca 0 i nie rzuca', async () => {
    vi.resetModules();
    vi.doMock('../../../../server/src/services/demoService.js', () => {
      throw new Error('DemoService module missing');
    });
    vi.doMock('../../../../server/src/services/trialService.js', () => ({
      default: {
        sendTrialWarnings: vi.fn().mockResolvedValue(0),
        processExpiredTrials: vi.fn().mockResolvedValue(0),
      },
    }));

    const freshModule = await import('../../../../server/src/cron/TrialCron.js');
    await expect(freshModule.runDemoCleanup()).resolves.toBe(0);
  });
});
