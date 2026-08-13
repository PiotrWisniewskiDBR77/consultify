/**
 * MANIFEST NARZĘDZI TERESY generowany Z REJESTRU AKCJI (Z4).
 *
 * SSOT: `docs/standards/idea-workspace/02_REJESTR_AKCJI.md` — „Rejestr jest
 * JEDNOCZEŚNIE listą narzędzi Teresy". Kryterium odbioru: manifest ma być
 * GENEROWANY, nie utrzymywany ręcznie.
 *
 * ── STAN ZASTANY (zweryfikowany w kodzie, nie z dokumentacji) ────────────────
 * Teresa ma DZIŚ dwa różne mechanizmy i żaden z nich nie zna akcji canvasu:
 *
 *  1. Serwerowy rejestr narzędzi LLM (function calling):
 *     `server/src/services/ai/toolDefinitions.ts:17` (interfejs `ToolDefinition`,
 *     `AI_TOOLS` od linii 30) oraz `server/src/services/ai/mcpServer.ts:415`
 *     (`getToolDefinitions()`), podawany modelowi w
 *     `server/src/services/ai/llmService.ts:864/969`. Te narzędzia dotyczą
 *     danych organizacji (zadania, decyzje, KB, inicjatywy) — ANI JEDNO nie
 *     operuje na otwartej reprezentacji Idei.
 *
 *  2. Front-endowy most „czat → canvas": REGEXOWE detektory intencji
 *     `src/components/AIChat/mindmapIntentDetector.ts`,
 *     `processFlowIntentDetector.ts`, `whiteboardIntentDetector.ts`, wołane w
 *     `src/components/AIChat/UnifiedChatPanel.tsx:3243/3277/3372`, które
 *     wysyłają gołe stringi (`mm_*`/`pf_*`/`wb_*`) na szynę
 *     `idea-workspace-quick-action`. Utrzymywane ręcznie, bez parametrów,
 *     bez potwierdzeń, a dla Tabeli takiego detektora NIE MA w ogóle
 *     (`tableIntentDetector.ts` otwiera kreator tabel, nie steruje otwartą).
 *
 * Ten plik podpina się pod OBA, zamiast tworzyć trzeci:
 *   • `buildTeresaToolManifest()` zwraca dokładnie kształt `ToolDefinition`
 *     z `toolDefinitions.ts` (type: 'function' + function.name/description/parameters),
 *     więc wynik można wprost dołożyć do listy narzędzi modelu
 *     (`llmService` przyjmuje `tools` per wywołanie),
 *   • `resolveTeresaTool()` + `executeTeresaTool()` zastępują regexowe
 *     detektory: nazwa narzędzia → akcja z rejestru → ten sam handler,
 *     którego używa UI (Z4: Teresa nie ma nic, czego nie ma w interfejsie).
 *
 * TRANSPORT (fala „Teresa steruje Ideą przez rejestr", aktywowany kanonicznie
 * 2026-08-02; jawne `false` pozostaje kill-switchem):
 *   ↑ w górę: `UnifiedChatPanel` woła `buildTeresaToolManifest({ tool })` (patrz
 *     niżej — filtr po OTWARTYM narzędziu) i wkłada wynik do `context.
 *     ideaActionManifest` zapytania `/chat/stream`. Pole `context` jest
 *     przepuszczalne przez walidator (z.record), więc NIE trzeba zmieniać
 *     schematu. Gate frontu: `VITE_ENABLE_TERESA_IDEA_ACTIONS`.
 *   ↓ do modelu: route (`server/src/routes/ai.routes.ts`, gate
 *     `featureFlags.ENABLE_TERESA_IDEA_ACTIONS`) przekazuje manifest jako
 *     `clientTools` do `llmService.callStream`. Model widzi je obok narzędzi
 *     deliverable.
 *   ↺ powrót: `execute` narzędzia klienckiego NIE działa na serwerze (serwer nie
 *     ma dostępu do płótna) — emituje SSE `idea_action { toolName, args }`.
 *     `useAIStream` routuje je do `onIdeaAction`, a `UnifiedChatPanel` wykonuje
 *     je przez `executeTeresaTool()` — TĄ SAMĄ ścieżką, co klik człowieka
 *     (runIdeaAction → handler → szyna 'idea-workspace-quick-action').
 *   Bezpieczeństwo (confirmBeforeRun, „akcja nie istnieje w tej reprezentacji")
 *   egzekwuje sam rejestr w `runIdeaAction`, po stronie frontu.
 *
 * Obie flagi są domyślnie ON. Gdy frontendowa flaga jest jawnie OFF, lokalne
 * detektory regexowe są rollbackiem. Przy ON nie przechwytują promptu, więc
 * istnieje dokładnie jedna aktywna ścieżka wykonawcza: registry.
 */

import type { TeresaCapabilityId } from '@/method-core/contracts';
import { TERESA_CAPABILITIES } from '@/method-core/contracts';
import { isKnownTeresaCapability, TERESA_CAPABILITY_REGISTRY } from '@/method-core/teresa';

import type { ActionContext, ActionDef, ActionResult, Tool } from './ideaActionRegistry';
import { IDEA_ACTION_REGISTRY, isActionAvailableInTool, runIdeaAction } from './ideaActionRegistry';

/**
 * Kształt 1:1 z `server/src/services/ai/toolDefinitions.ts:17`.
 * Front nie może zaimportować kodu serwera, więc typ jest tu powtórzony —
 * rozjazd wyłapie strażnik `scripts/check-actions.sh` (sprawdza obecność
 * pól name/description/parameters w generatorze).
 */
export interface TeresaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/** 'idea.element.add' → 'idea_element_add' (nazwy narzędzi LLM bez kropek). */
export function toolNameForAction(actionId: string): string {
  return actionId.replace(/\./g, '_');
}

function toolsLabel(def: ActionDef): string {
  if (def.tools === 'all') return 'wszystkie cztery reprezentacje';
  const names: Record<Tool, string> = {
    mindmap: 'Mapa myśli',
    whiteboard: 'Tablica',
    process_flow: 'Przepływ',
    table: 'Tabela',
  };
  return def.tools.map((t) => names[t]).join(', ');
}

/**
 * Manifest narzędzi asystentki — generowany z rejestru przy każdym wywołaniu,
 * więc nowa akcja w rejestrze = nowe narzędzie Teresy bez żadnego dopisywania.
 */
export function buildTeresaToolManifest(options?: { tool?: Tool }): TeresaToolDefinition[] {
  return IDEA_ACTION_REGISTRY.filter(
    (def) => !options?.tool || isActionAvailableInTool(def, options.tool)
  ).map((def) => {
    const params = def.teresa.parameters;
    // Do opisu dokładamy fakty, których model sam nie zgadnie: gdzie akcja
    // istnieje i czy wymaga potwierdzenia — inaczej Teresa obiecuje rzeczy,
    // których nie da się zrobić w otwartej reprezentacji.
    const suffix = [
      `Działa w: ${toolsLabel(def)}.`,
      def.requiresPreview ? 'Wynik pokazuję do akceptacji przed zapisem.' : '',
      def.teresa.confirmBeforeRun ? 'Wymaga potwierdzenia użytkownika.' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return {
      type: 'function' as const,
      function: {
        name: toolNameForAction(def.id),
        description: `${def.teresa.description} ${suffix}`.trim(),
        parameters: {
          type: 'object' as const,
          properties: (params?.properties || {}) as Record<string, unknown>,
          ...(params?.required?.length ? { required: params.required } : {}),
        },
      },
    };
  });
}

/**
 * Legacy regex intent detectors are a rollback path, not a second executor.
 * Once the governed registry transport is enabled, the prompt must reach the
 * model/tool manifest instead of being intercepted locally first.
 */
export function shouldUseLegacyIdeaIntentFallback(registryTransportEnabled: boolean): boolean {
  return !registryTransportEnabled;
}

/** Shape consumed by the server's `ideaTools.defs` bridge. */
export function toServerIdeaActionManifest(
  tools: TeresaToolDefinition[]
): TeresaToolDefinition['function'][] {
  return tools.map((tool) => tool.function);
}

/** Nazwa narzędzia z manifestu → definicja akcji (albo undefined, gdy modelowi się przywidziało). */
export function resolveTeresaTool(toolName: string): ActionDef | undefined {
  return IDEA_ACTION_REGISTRY.find((def) => toolNameForAction(def.id) === toolName);
}

/**
 * Wykonanie narzędzia Teresy = wykonanie TEJ SAMEJ akcji, którą klika człowiek.
 * Brak drugiej ścieżki wykonania to cała istota Z4.
 */
export async function executeTeresaTool(
  toolName: string,
  ctx: Omit<ActionContext, 'source' | 'surface'> & Partial<Pick<ActionContext, 'surface'>>
): Promise<ActionResult> {
  const def = resolveTeresaTool(toolName);
  if (!def) {
    return {
      ok: false,
      actionId: toolName,
      // Z4: Teresa ma umieć powiedzieć, czego NIE potrafi — zamiast udawać.
      message: `Nie mam takiego narzędzia. Umiem tylko to, co jest w interfejsie tej Idei.`,
    };
  }
  return runIdeaAction(def.id, {
    ...ctx,
    surface: ctx.surface || 'panel',
    source: 'teresa',
  });
}

// ─────────────────────────────────────────────────────────────────────────
// ASSESSMENT (Method Kernel / Shared Teresa) — S4, 2026-08-13.
//
// Before this section, `grep -c assessment teresaActionManifest.ts` was 0:
// Teresa's tool manifest only ever knew about the Idea Workspace canvas
// (mindmap/whiteboard/process_flow/table above). Assessment (DRD/SIRI) is a
// SEPARATE domain with its own closed capability set
// (`TERESA_CAPABILITIES` in `src/method-core/contracts/teresa.ts`, 23
// entries) and its own Intent → Preview → Commit cycle
// (`src/method-core/api/methodCoreApi.ts` `teresaPreview`/`teresaCommit`) —
// it is NOT another `Tool` variant of `ideaActionRegistry.ts` (that registry
// is physically shaped around canvas concepts: `ideaId`, `CanvasToolType`,
// `IdeaWorkspaceSelection` — none of which exist for an assessment session).
// This block is therefore a SIBLING manifest, not a graft onto
// `IDEA_ACTION_REGISTRY`, generated the same way (`buildTeresaToolManifest`
// above): one entry per registry item, so a new capability in
// `TERESA_CAPABILITY_REGISTRY` (`src/method-core/teresa/capabilities.ts`)
// becomes a new Teresa tool without editing this file.
//
// What this DOES give Teresa: a discoverable, closed list of assessment
// tools with real descriptions/parameters, and a resolver proving a forbidden
// name (`assessment_approve_score` etc.) never resolves to anything — the
// negative tests in `src/method-core/teresa/__tests__/` exercise exactly
// this resolver.
//
// What this deliberately does NOT do: execute the capability. Unlike
// `executeTeresaTool` above (whose canvas actions are pure mutations dispatched
// on a client-side event bus), an assessment capability's `statements`/
// `proposedChanges` are the substantive output of the LLM turn itself — Teresa
// is not allowed to invent them a second time client-side (that would be
// exactly the "fabricated evidence" the playbook's §5 boundary forbids). The
// caller that owns the chat turn (server `ai/llmService`) builds the
// `TeresaPreviewRequest` from what the model actually said and calls
// `teresaPreview()`; this module only proves WHICH tool names are legitimate
// and what their parameters must look like.
// ─────────────────────────────────────────────────────────────────────────

/** Every assessment tool name is prefixed so it can never collide with an
 * Idea Workspace tool name (`toolNameForAction` above strips dots but keeps
 * the `idea_`-style prefix implicit in the action id; this prefix makes the
 * two manifests trivially distinguishable in a combined tool list). */
export const ASSESSMENT_TOOL_PREFIX = 'assessment_';

export function assessmentToolName(capabilityId: TeresaCapabilityId): string {
  return `${ASSESSMENT_TOOL_PREFIX}${capabilityId}`;
}

/**
 * Manifest narzędzi Teresy dla Assessmentu — generowany z
 * `TERESA_CAPABILITY_REGISTRY` (`src/method-core/teresa/capabilities.ts`),
 * dokładnie jeden wpis na capability z zamkniętego zbioru
 * `TERESA_CAPABILITIES`. Nowa capability w rejestrze = nowe narzędzie Teresy
 * bez dopisywania tutaj (ta sama zasada co `buildTeresaToolManifest` wyżej).
 */
export function buildTeresaAssessmentToolManifest(): TeresaToolDefinition[] {
  return TERESA_CAPABILITIES.map((id) => {
    const def = TERESA_CAPABILITY_REGISTRY[id];
    const suffix = def.producesProposal
      ? 'Wynik pokazuję jako podgląd (preview) do akceptacji — nic nie zapisuje się bez Twojej decyzji.'
      : 'Odpowiedź informacyjna — nic nie zapisuje ani nie zmienia.';
    return {
      type: 'function' as const,
      function: {
        name: assessmentToolName(id),
        description: `${def.description} ${suffix}`.trim(),
        parameters: def.parameters,
      },
    };
  });
}

/**
 * Nazwa narzędzia z manifestu Assessmentu → capability (albo `undefined`).
 * Dowód „ścieżka nie istnieje” dla zabronionych efektów
 * (`TERESA_FORBIDDEN_EFFECTS`): żaden z nich nie jest w
 * `TERESA_CAPABILITIES`, więc `assessment_approve_score` itd. NIGDY nie
 * rozwiąże się do capability — nie dlatego, że coś to blokuje w runtime, ale
 * dlatego, że taki wpis nigdy nie powstał w rejestrze (patrz
 * `capabilities.test.ts` „closed set” + `manifest.test.ts` pięć testów
 * negatywnych).
 */
export function resolveTeresaAssessmentCapability(toolName: string): TeresaCapabilityId | undefined {
  if (!toolName.startsWith(ASSESSMENT_TOOL_PREFIX)) return undefined;
  const capabilityId = toolName.slice(ASSESSMENT_TOOL_PREFIX.length);
  return isKnownTeresaCapability(capabilityId) ? capabilityId : undefined;
}
