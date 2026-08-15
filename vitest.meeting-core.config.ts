/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

/**
 * vitest.meeting-core.config.ts — konfiguracja WYŁĄCZNIE dla harnessu
 * testowego Meeting Core (tests/meeting-core/**).
 *
 * Celowo NIE importuje/rozszerza vitest.config.ts (root config): ten
 * pakiet nie potrzebuje pluginu React, jsdom ani dziesiątek aliasów
 * server/src — potrzebuje czystego środowiska Node z realnym `pg` i
 * child_process do sterowania Dockerem. Trzymanie configu osobno też
 * gwarantuje, że `tests/meeting-core/**` nigdy nie zostanie przypadkiem
 * wciągnięte przez `include` głównego configu (i odwrotnie).
 *
 * Uruchamianie:
 *   npx vitest run --config vitest.meeting-core.config.ts
 *
 * Same testy strażnika (bez Dockera):
 *   npx vitest run --config vitest.meeting-core.config.ts tests/meeting-core/pg/__tests__/scratchPg.guard.test.ts
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/meeting-core/**/*.test.ts'],
    exclude: ['node_modules/**'],

    // Testy PG stawiają/burzą kontenery Docker — 'forks' izoluje procesy
    // (żadnego współdzielenia natywnych uchwytów/gniazd między testami),
    // a wyłączenie fileParallelism trzyma testy kontenerowe sekwencyjnie:
    // deterministyczne, czytelne logi Dockera, brak przypadkowego
    // przeciążenia demona Dockera równoległymi `docker run`.
    pool: 'forks',
    fileParallelism: false,

    // Stawianie kontenera + pobranie obrazu przy pierwszym uruchomieniu
    // (postgres:16-alpine) może chwilę zająć — hookTimeout musi to pokryć.
    testTimeout: 30_000,
    hookTimeout: 90_000,
    teardownTimeout: 30_000,

    // ZERO retry: zgodnie z MEMORY (demo-entry-email-normalizacja-2026-08-01)
    // `retry: 1` w vitest maskowało kolizje fixture'ów w innym pakiecie tego
    // repo. Testy PG mają być albo zielone naprawdę, albo czerwone naprawdę.
    retry: 0,
    bail: 0,
  },
});
