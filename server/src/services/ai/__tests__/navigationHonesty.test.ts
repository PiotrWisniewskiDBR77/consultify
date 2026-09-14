/**
 * DEC-512 — Teresa nie deklaruje akcji, ktorych nie potrafi wykonac.
 *
 * PRZYCZYNA (zgloszenie testera `e44fd1e8`, staging 2026-09-14 06:28 UTC):
 * Teresa zaproponowala otwarcie assessmentu, uzytkownik potwierdzil, nic sie nie
 * stalo. Kanal akcji nie istnieje: brak pola `actions` w `AIPipelineResponse`,
 * brak zdarzenia SSE `navigate`, brak narzedzia `navigate` w `toolDefinitions`.
 * Prompt systemowy mimo to kazal modelowi „zaproponowac nawigacje (akcja navigate)".
 *
 * Ten test pilnuje dwoch rzeczy naraz:
 *   1. instrukcja mowi prawde (zakaz deklarowania + nakaz sciezki klikniec),
 *   2. prompt produkcyjny nie odrasta do starej obietnicy (skan zrodla AIPipeline).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  NAVIGABLE_VIEWS,
  NAVIGATION_HONESTY_INSTRUCTION,
  NAVIGATION_HONESTY_INSTRUCTION_EN,
  buildNavigationHonestyInstruction,
} from '../navigationHonesty.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pipelineSource = readFileSync(path.join(here, '..', 'AIPipeline.ts'), 'utf8');

describe('navigationHonesty — DEC-512', () => {
  it('instrukcja PL zabrania deklarowania nawigacji i pytania o zgode na nia', () => {
    // MUTACJA: skrocenie napisu do samego „mozesz zaproponowac nawigacje" wywraca ten test.
    expect(NAVIGATION_HONESTY_INSTRUCTION).toContain('NIE DEKLARUJ AKCJI');
    expect(NAVIGATION_HONESTY_INSTRUCTION).toContain('otwieram');
    expect(NAVIGATION_HONESTY_INSTRUCTION).toContain('czy mam otworzyć?');
    expect(NAVIGATION_HONESTY_INSTRUCTION).toContain('ŚCIEŻKĘ KLIKNIĘĆ');
  });

  it('instrukcja EN niesie ten sam kontrakt', () => {
    expect(NAVIGATION_HONESTY_INSTRUCTION_EN).toContain('NEVER DECLARE AN ACTION');
    expect(NAVIGATION_HONESTY_INSTRUCTION_EN).toContain('shall I open it?');
    expect(NAVIGATION_HONESTY_INSTRUCTION_EN).toContain('CLICK PATH');
  });

  it('assessment jest wsrod widokow, do ktorych wolno skierowac opisem', () => {
    expect(NAVIGABLE_VIEWS).toContain('assessment');
    expect(NAVIGATION_HONESTY_INSTRUCTION).toContain('assessment');
  });

  it('wariant jezykowy idzie za jezykiem rozmowy, domyslnie EN', () => {
    expect(buildNavigationHonestyInstruction('pl')).toBe(NAVIGATION_HONESTY_INSTRUCTION);
    expect(buildNavigationHonestyInstruction('pl-PL')).toBe(NAVIGATION_HONESTY_INSTRUCTION);
    expect(buildNavigationHonestyInstruction('en')).toBe(NAVIGATION_HONESTY_INSTRUCTION_EN);
    expect(buildNavigationHonestyInstruction(null)).toBe(NAVIGATION_HONESTY_INSTRUCTION_EN);
  });

  it('AIPipeline nie obiecuje juz akcji navigate w prompcie systemowym', () => {
    // MUTACJA: przywrocenie starej instrukcji 15 albo ogona instrukcji 14 wywraca ten test.
    expect(pipelineSource).not.toContain('akcja navigate');
    expect(pipelineSource).not.toContain('zaproponuj nawigację');
    expect(pipelineSource).toContain('buildNavigationHonestyInstruction(');
  });

  it('nie ma narzedzia nawigacyjnego, ktore czynilo by obietnice prawdziwa', () => {
    // Gdy kanal akcji powstanie (wzorem `idea_action`), ten test trzeba swiadomie
    // zmienic razem z instrukcja — inaczej prompt znow rozjedzie sie z kodem.
    const tools = readFileSync(path.join(here, '..', 'toolDefinitions.ts'), 'utf8');
    expect(tools).not.toMatch(/name:\s*'(navigate|open_screen|go_to_\w+)'/);
  });
});
