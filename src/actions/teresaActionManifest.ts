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
 * CZEGO TU NIE MA (jawnie): transportu manifestu na serwer. Dziś żaden
 * front-endowy caller nie przekazuje własnych `tools` do `/chat/stream`, więc
 * podłączenie tego manifestu do modelu wymaga jednej zmiany po stronie czatu —
 * to następna fala, nie ta.
 */

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
