/**
 * Kontrakt powierzchni tabelowej T01–T45 — punkt wejścia.
 *
 * Pakiet R00 z `REPAIR_MASTER_PLAN.md` (Fala 0). Zawiera WYŁĄCZNIE kontrakty,
 * fixtures i walidatory. Nie renderuje niczego i nie zmienia żadnego ekranu —
 * R00 zamraża kontrakty PRZED zmianami wizualnymi, a R01–R04 dostrajają do
 * nich komponenty wspólne.
 *
 * Kolejność czytania dla wykonawcy R01–R04:
 *   1. `canon.ts`           — liczby i kolejności z kontraktu normatywnego;
 *   2. `types.ts`           — deskryptor capability i preset rejestru;
 *   3. właściwy model       — `rowActionModel` (R01), `menuContract` (R02),
 *                             `previewSchema` (R03);
 *   4. `surfaceRegister.ts` — co Twój pakiet ma dowieźć dla której powierzchni;
 *   5. `fixtures.ts`        — referencyjne buildery: tak wygląda „zgodne";
 *   6. `validators.ts`      — czym to zostanie zmierzone na odbiorze.
 *
 * @module contracts/tableSurface
 */

export * from './canon';
export * from './fixtures';
export * from './legacyBaseline';
export * from './menuContract';
export * from './previewSchema';
export * from './rowActionModel';
export * from './surfaceRegister';
export * from './types';
export * from './validators';
