/**
 * Odbiór na żywo 05.09 (04-narzędzia, defekt 5) — dwie reguły, które hub
 * narzędzi wcześniej trzymał w sobie i obie kłamały:
 *
 * 1) Nieznany `tool_type` z serwera dostawał po cichu kod „SWT". U właściciela
 *    dawało to 29 wierszy `MYWORK` udających SWOT w kolumnie TYP.
 * 2) `MYWORK` nie jest narzędziem: serwer zapisuje taki wiersz `tool_sessions`
 *    jako ŚLAD POCHODZENIA przy konwersji pomysłu/notatki z Mojej Pracy
 *    (server/src/routes/my-work.routes.ts `createMyWorkToolSession`:
 *    tool_type='MYWORK', status='APPROVED', completion_percent=100,
 *    name="MyWork idea: …"). Brak warsztatu jest tu POPRAWNY — złe było
 *    tylko to, że hub spadał wtedy na angielski zrzut JSON-a.
 *
 * Reguły siedzą tutaj, żeby dało się je sprawdzić bez montowania całego huba.
 */
import type { ToolType } from '@/components/shared/ModuleHub/types';

/** Sesje-ślady z Mojej Pracy — nie mają i nie powinny mieć warsztatu. */
export const MYWORK_TRACE_TOOL_TYPE = 'MYWORK';

export function isMyWorkTraceToolType(rawToolType: unknown): boolean {
  return String(rawToolType ?? '').trim().toUpperCase() === MYWORK_TRACE_TOOL_TYPE;
}

/**
 * Kod typu dla sesji, której `tool_type` nie ma mapowania. Kolumna TYP renderuje
 * `TOOL_META[kod]?.shortName || kod`, więc nieznany kod pokazuje się dosłownie —
 * uczciwie, zamiast podszywać się pod cudze narzędzie.
 */
export function toolShortCodeFallback(rawToolType: unknown): ToolType {
  const code = String(rawToolType ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
  return (code || 'TOOL') as ToolType;
}
