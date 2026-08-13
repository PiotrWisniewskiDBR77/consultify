/**
 * Bezpiecznik przeciw cichemu pominięciu suit bazodanowych.
 *
 * DLACZEGO:
 * Wszystkie testy integracyjne kernela używają `describe.skipIf(!REAL_DB)`.
 * To jest właściwe zachowanie na maszynie bez PostgreSQL-a — ale ma cenę:
 * uruchomienie suity bez `RUN_DB_TESTS=1`/`DATABASE_URL` daje **zieloną
 * odpowiedź przy 104 pominiętych testach**. Zieleń wygląda identycznie, czy
 * łańcuch freeze→Output→Report faktycznie przeszedł, czy nikt go nie tknął.
 *
 * To repo ma udokumentowaną historię dokładnie tej pomyłki („zielone CI nic nie
 * dowodzi — trzy joby mierzyły atrapę"). Ten plik daje sposób, żeby powiedzieć
 * „ten przebieg MA sprawdzić bazę" i dostać błąd zamiast fałszywej zieleni.
 *
 * Użycie w bramce weryfikacyjnej:
 *   REQUIRE_DB_TESTS=1 RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=... npx vitest run ...
 *
 * Bez `REQUIRE_DB_TESTS=1` ten test jest no-opem — nie utrudnia pracy lokalnej
 * ani przebiegów czysto jednostkowych.
 */
import { describe, expect, it } from 'vitest';

const REQUIRE_DB = process.env.REQUIRE_DB_TESTS === '1';

describe('bezpiecznik: suity bazodanowe nie mogą zniknąć po cichu', () => {
  it.skipIf(!REQUIRE_DB)(
    'REQUIRE_DB_TESTS=1 wymusza realną bazę — inaczej przebieg jest nieważny',
    () => {
      // Każdy z tych warunków osobno, żeby komunikat wskazywał, czego brakuje,
      // zamiast ogólnego „coś nie tak z konfiguracją".
      expect(
        process.env.RUN_DB_TESTS,
        'REQUIRE_DB_TESTS=1, ale RUN_DB_TESTS nie jest ustawione na 1 — suity ' +
          'integracyjne pominęłyby się po cichu i przebieg pokazałby zieleń bez ' +
          'sprawdzenia bazy.',
      ).toBe('1');

      expect(
        process.env.MOCK_DB,
        'REQUIRE_DB_TESTS=1, ale MOCK_DB nie jest "false" — warstwa bazy ' +
          'zostałaby zamockowana i testy „przeszłyby" nie dotykając PostgreSQL-a.',
      ).toBe('false');

      expect(
        process.env.DATABASE_URL,
        'REQUIRE_DB_TESTS=1, ale DATABASE_URL jest pusty — nie ma do czego się ' +
          'połączyć.',
      ).toBeTruthy();
    },
  );

  it('bez REQUIRE_DB_TESTS bezpiecznik nie przeszkadza w pracy lokalnej', () => {
    // Sam fakt, że ten plik daje się uruchomić bez żadnej konfiguracji bazy,
    // jest tu asercją: bezpiecznik jest opt-in, nie kolejną barierą wejścia.
    expect(REQUIRE_DB || true).toBe(true);
  });
});
