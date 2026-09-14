/**
 * Uczciwość nawigacyjna Teresy (DEC-512, 2026-09-14).
 *
 * PRZYCZYNA (zgłoszenie testera `e44fd1e8`, staging 2026-09-14 06:28 UTC):
 * Teresa zaproponowała otwarcie assessmentu, użytkownik potwierdził — i nic się
 * nie stało. Zmierzone: kanał akcji nie istnieje na ŻADNYM końcu.
 *   - `server/src/types/ai.types.ts:280` — `AIPipelineResponse` nie ma pola
 *     `actions` / `toolCalls` / `navigation`.
 *   - `/chat/stream` (`routes/ai.routes.ts:1627`) nie emituje zdarzenia SSE
 *     `navigate` ani `actions` — cały słownik zdarzeń go nie zawiera.
 *   - `services/ai/toolDefinitions.ts:32` — wśród narzędzi modelu nie ma
 *     żadnego `navigate`/`open_*`/`go_to_*`.
 *   - `src/services/chatNavigator.ts:227` `executeChatNavigate` ISTNIEJE, ale
 *     karmią go wyłącznie zaszyte po stronie klienta podpowiedzi
 *     (`UnifiedChatPanel.tsx:2863`), nigdy odpowiedź modelu.
 * A mimo to prompt systemowy (`AIPipeline.buildBehavioralInstructions`,
 * instrukcje 14 i 15) wprost kazał modelowi „zaproponować nawigację
 * (akcja navigate)" i wyliczał 21 widoków. To była obietnica bez transportu.
 *
 * Do czasu, aż realny kanał akcji powstanie (wzorem `idea_action`:
 * `AIPipeline.ts:461` → SSE → klient), prompt ma mówić prawdę: Teresa opisuje
 * ŚCIEŻKĘ KLIKNIĘĆ, a nie deklaruje czynności, których nie potrafi wykonać.
 *
 * MUTACJA (test `navigationHonesty.test.ts`): wykreślenie z tego napisu zakazu
 * deklarowania akcji albo dopisanie z powrotem „akcja navigate" wywraca test.
 */

/** Widoki, do których wolno skierować użytkownika opisem ścieżki kliknięć. */
export const NAVIGABLE_VIEWS = [
  'chat',
  'my-work',
  'initiatives',
  'portfolio',
  'execution',
  'roadmap',
  'reports',
  'assessment',
  'interview',
  'discovery-tools',
  'implementation',
  'roi',
  'economics',
  'kpi-okr',
  'benefits',
  'studio',
  'admin',
  'settings',
  'project-intelligence',
  'context',
  'rollout',
] as const;

/**
 * Jedno miejsce, w którym opisujemy modelowi granicę jego sprawczości
 * nawigacyjnej. Wstrzykiwane przez `AIPipeline.buildBehavioralInstructions`,
 * więc nie wymaga poprawek w kilkudziesięciu wołaczach.
 */
export const NAVIGATION_HONESTY_INSTRUCTION =
  '15. NAWIGACJA — NIE DEKLARUJ AKCJI, KTÓRYCH NIE MOŻESZ WYKONAĆ. ' +
  'Nie masz narzędzia, które otwiera ekran, uruchamia moduł ani przełącza widok za użytkownika. ' +
  'NIGDY nie pisz „otwieram", „przechodzę do", „już to uruchamiam", „za chwilę pokażę" ' +
  'i NIGDY nie pytaj „czy mam otworzyć?" — bo po potwierdzeniu nic się nie wydarzy. ' +
  'Zamiast tego podaj ŚCIEŻKĘ KLIKNIĘĆ: nazwę modułu w menu bocznym i kolejne kroki, ' +
  'które użytkownik ma wykonać sam (np. „Menu → Assessment → wybierz sesję DRD → Kontynuuj"). ' +
  `Widoki, do których możesz skierować: ${NAVIGABLE_VIEWS.join(', ')}. ` +
  'Ta sama zasada obowiązuje dla każdej innej czynności w aplikacji: jeśli nie masz na nią ' +
  'narzędzia, opisz, jak zrobi to użytkownik — nie obiecuj, że zrobisz to Ty.';

/** Angielski wariant — persona odpowiada w EN, instrukcja nie może być jedynym polskim blokiem. */
export const NAVIGATION_HONESTY_INSTRUCTION_EN =
  '15. NAVIGATION — NEVER DECLARE AN ACTION YOU CANNOT PERFORM. ' +
  'You have no tool that opens a screen, launches a module or switches the view for the user. ' +
  'NEVER say "opening", "taking you to", "launching it now", and NEVER ask "shall I open it?" — ' +
  'nothing will happen after the user confirms. ' +
  'Instead give the CLICK PATH: the module in the side menu and the steps the user takes themselves ' +
  '(e.g. "Menu → Assessment → pick the DRD session → Continue"). ' +
  `Views you may point to: ${NAVIGABLE_VIEWS.join(', ')}. ` +
  'The same rule applies to any other in-app action: if you have no tool for it, describe how the ' +
  'user does it — do not promise that you will do it.';

export function buildNavigationHonestyInstruction(language?: string | null): string {
  const base = String(language || '')
    .split('-')[0]
    .toLowerCase();
  return base === 'pl' ? NAVIGATION_HONESTY_INSTRUCTION : NAVIGATION_HONESTY_INSTRUCTION_EN;
}
