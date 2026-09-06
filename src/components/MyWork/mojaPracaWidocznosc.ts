/**
 * [ODMROZENIE 07_MY_WORK_AGENT DEC-397]
 * DEC-406 (CTO, 2026-09-06) — JEDNO miejsce ukrycia powierzchni Mojej Pracy,
 * ktore nie wchodza do MVP.
 *
 * `warsztatInicjatywy` — stary „warsztat inicjatywy" (`Initiatives/
 * InitiativeFullView.tsx`, sam w sobie oznaczony `@deprecated`): stepper
 * ZRODLO — PRZEGLAD — PLANOWANIE — REALIZACJA — KORZYSCI, przyciski bramki
 * („Zatwierdz / Anuluj", „Oznacz jako ukonczona"), zakladki Przeglad · Zadania ·
 * Definicja · Ekonomika · Zespol · Historia. Otwieral sie WYLACZNIE z Mojej Pracy
 * (jedyny wolacz w repo: `MyWork/MyWorkHub.tsx`), rownolegle do zatwierdzonej
 * przez wlasciciela kanonicznej karty inicjatywy (`Initiatives/
 * InitiativeDocumentView.tsx`, trasa `/initiatives?...&open=<id>&mode=doc`).
 * Slowo wlasciciela 06.09: „nie wiem, co to za ekran — nie wiem, po co on jest".
 *
 * Ukrywamy WIDOK, nie kasujemy kodu — do Fali 2 (tam zapada decyzja, czy
 * bramki lifecycle wracaja jako sekcja kanonicznej karty, czy znikaja).
 * Zdjecie ukrycia = zmiana tej jednej stalej na `false`.
 */
export const UKRYTE_DEC406 = {
  /** do Fali 2 */
  warsztatInicjatywy: true,
} as const;
