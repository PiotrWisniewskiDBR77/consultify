/**
 * [ODMROZENIE 13_CHAT DEC-397] Kontrakt: użytkownik NIGDY nie widzi surowej
 * odpowiedzi serwera w ścieżce generacji z czatu.
 *
 * Zgłoszenie właściciela 06.09 (1.1-D): karta w czacie kończyła się napisem
 * „❌ Generacja nie powiodła się: Not found". Zmierzona przyczyna: front ma
 * `VITE_ENABLE_DELIVERABLES_LIGHT=true`, a serwer nie ma `ENABLE_DELIVERABLES_LIGHT`,
 * więc `deliverablesGenerations.routes.ts:68` odpowiada 404 `{"error":"Not found"}`
 * PRZED uwierzytelnieniem (w logu stagingu `userId: null`) — i czat pokazywał ten
 * napis dosłownie.
 *
 * Dowód mutacyjny (ręcznie zweryfikowany): przywrócenie w `opisBleduGeneracji`
 * przepuszczania `err.message` czerwieni pierwszy blok tego pliku.
 */
import { describe, expect, it, beforeEach } from 'vitest';

import {
  isDeliverablesLightEnabled,
  isDeliverablesSurfaceMissing,
  markDeliverablesSurfaceUnavailable,
  opisBleduGeneracji,
  resetDeliverablesSurfaceProbe,
} from '../deliverablesGeneration';

/** Kształt błędu, który realnie przylatuje z `Api.post` (klasa ApiError). */
const bladApi = (message: string, status?: number): Error => {
  const err = new Error(message);
  (err as Error & { status?: number }).status = status;
  return err;
};

beforeEach(() => {
  resetDeliverablesSurfaceProbe();
});

describe('opisBleduGeneracji — powód zawsze po polsku', () => {
  it('404 „Not found" z serwera nie wycieka do użytkownika', () => {
    const powod = opisBleduGeneracji(bladApi('Not found', 404));
    expect(powod).not.toMatch(/not found/i);
    expect(powod).toBe('generator dokumentów jest wyłączony na tym środowisku');
  });

  it.each([
    [bladApi('Permission denied', 403), 'brak uprawnień do tworzenia artefaktów'],
    [bladApi('Too many requests', 429), 'limit zapytań do AI został wyczerpany'],
    [bladApi('Internal server error', 500), 'serwer zgłosił błąd generacji'],
    [bladApi('Generation plan failed'), 'generacja nie doszła do skutku'],
  ])('mapuje błąd na polskie zdanie', (err, oczekiwane) => {
    expect(opisBleduGeneracji(err)).toBe(oczekiwane);
  });

  it('żaden mapowany powód nie zawiera angielskiego napisu serwera', () => {
    const surowe = ['Not found', 'Permission denied', 'Internal server error'];
    for (const napis of surowe) {
      expect(opisBleduGeneracji(bladApi(napis, 500))).not.toContain(napis);
    }
  });
});

describe('isDeliverablesSurfaceMissing — brak powierzchni vs zwykła awaria', () => {
  it('404 na kontrakcie = brak powierzchni', () => {
    expect(isDeliverablesSurfaceMissing(bladApi('Not found', 404))).toBe(true);
  });

  it('rozpoznaje też po samym napisie, gdy status nie dojechał', () => {
    expect(isDeliverablesSurfaceMissing(bladApi('Not found'))).toBe(true);
  });

  it('awaria generacji to NIE brak powierzchni', () => {
    expect(isDeliverablesSurfaceMissing(bladApi('Generation failed', 500))).toBe(false);
    expect(isDeliverablesSurfaceMissing(bladApi('Deck not found in organization', 404))).toBe(true);
  });
});

describe('flaga frontu nie kłamie po dowodzie braku powierzchni', () => {
  it('po 404 czat przestaje wchodzić w tryb generacji', () => {
    markDeliverablesSurfaceUnavailable();
    expect(isDeliverablesLightEnabled()).toBe(false);
  });
});
