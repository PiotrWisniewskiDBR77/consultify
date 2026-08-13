/**
 * Akcje rejestru Idea Workspace — domena: shared.
 *
 * Wydzielone z `src/actions/ideaActionRegistry.ts` (QG-01, 2026-08-10),
 * verbatim (identyczne id/label/scope/surfaces/handler/mutates/undo/teresa),
 * tylko fizycznie przeniesione. SSOT formatu i reguł: nagłówek
 * `src/actions/ideaActionRegistry.ts` + `docs/standards/idea-workspace/02_REJESTR_AKCJI.md`.
 */

import type { ActionDef } from './types';
import {
  RUNTIME_ADD_ELEMENT,
  RUNTIME_AUTO_LAYOUT,
  RUNTIME_CURSOR_SELECT,
  RUNTIME_NODE_DELETE,
  RUNTIME_NODE_DUPLICATE,
  RUNTIME_REDO,
  RUNTIME_UNDO,
  dispatchMindmapPaneAction,
  dispatchQuickAction,
  runByTool,
  runEdgeParamCallback,
  runPanelUiOnlyCallback,
  runToolbarBusAction,
} from './runtimeHelpers';
import { Api } from '@/services/api';
import { findIdeaTemplate } from '@/components/MyWork/IdeaTemplateGallery';

export const SHARED_ACTIONS: ActionDef[] = [
  {
    id: 'idea.element.add',
    label: {
      pl: 'Dodaj element',
      en: 'Add element',
    },
    icon: 'Plus',
    scope: 'current_view',
    tools: 'all',
    surfaces: ['menu3', 'context'],
    shortcut: 'Tab',
    // Krok B: `ctx.params` (dziś: `label` od Teresy/formularza) idzie na szynę
    // jako `extra` w CustomEvent.detail — cztery odbiorniki (`mm_add_child`
    // itd.) czytają `detail.label` i używają jej jako treści nowego elementu
    // zamiast pustej edycji (patrz use*QuickActions.ts, każdy z komentarzem
    // „Krok B").
    handler: (ctx) => runByTool('idea.element.add', RUNTIME_ADD_ELEMENT, ctx, ctx.params),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence: 'stos undo narzędzia (mm/wb/pf/tbl_undo w use*QuickActions.ts)',
    },
    teresa: {
      description:
        'Dodaje nowy element do otwartej reprezentacji: gałąź w Mapie myśli, karteczkę na Tablicy, krok w Przepływie albo wiersz w Tabeli.',
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Treść nowego elementu (opcjonalna).' },
        },
      },
    },
    runtime: RUNTIME_ADD_ELEMENT,
    source:
      'src/components/MyWork/IdeaMapWorkspace.tsx MENU3_ADD_ACTION_PER_TOOL (commit f5d0271992)',
  },
  {
    id: 'idea.view.auto_layout',
    label: {
      pl: 'Auto-układ',
      en: 'Auto layout',
    },
    icon: 'LayoutGrid',
    scope: 'current_view',
    tools: ['mindmap', 'process_flow'],
    // `toolbar` dopisane 2026-08-10 (N6.4): `ProcessFlowToolbar.tsx` menu
    // „Więcej" → „Auto-rozmieść" woła prop `handleAutoLayout`, który w
    // `IdeaProcessFlowTool.tsx:2868+` jest DOKŁADNIE tą samą funkcją
    // `handleAutoLayout` co menu węzła/tła i co odbiornik `pf_auto_layout`
    // (`autoLayout: handleAutoLayout` w opts hooka) — czysty reuse, zero
    // nowego kodu, zmienia się TYLKO lista powierzchni.
    surfaces: ['menu3', 'context', 'toolbar'],
    // Skrót (2026-08-10, reconciliacja): `useIdeasToolKeyboard.ts`'s
    // `onAutoLayout` (Ctrl/Cmd+L, Przepływ WYŁĄCZNIE — `useCanvasKeyboard`
    // Mapy myśli nie istnieje, ten hook jest współdzielony tylko z Tablicą)
    // woła DOKŁADNIE `handleAutoLayout` — ta sama funkcja co pasek/menu wyżej.
    shortcut: '⌘L',
    handler: async (ctx) => {
      // Mapa myśli słucha szyny WĘZŁOWEJ, Przepływ ma własny silnik układu.
      // Dokładnie ten rozjazd był przyczyną martwego „Auto-układu" poza Mapą.
      if (ctx.tool === 'mindmap') {
        dispatchMindmapPaneAction('pane_auto_layout');
        return {
          ok: true,
          actionId: 'idea.view.auto_layout',
          data: { runtime: 'pane_auto_layout' },
        };
      }
      return runByTool('idea.view.auto_layout', RUNTIME_AUTO_LAYOUT, ctx);
    },
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'IdeaProcessFlowTool.handleAutoLayout (autoLayout + undo + broadcast); Mapa: mm-undo-state',
    },
    teresa: {
      description:
        'Układa elementy automatycznie — porządkuje gałęzie Mapy myśli albo kroki Przepływu. Nie zmienia treści, tylko rozmieszczenie.',
    },
    runtime: RUNTIME_AUTO_LAYOUT,
    source:
      'src/components/MyWork/processflow/useProcessFlowQuickActions.ts:149 (pf_auto_layout) + IdeaMapWorkspace.tsx onAutoLayout (commit f5d0271992) · REUSED (2026-08-09, N6 kontynuacja) by ProcessFlowContextMenu.tsx getNodeContextActions "auto-layout" item (onAutoLayout → handleAutoLayout(), IdeaProcessFlowTool.tsx ~linia 3797) — genuine same action despite living in the NODE menu: handleAutoLayout() rearranges the WHOLE current view, not just the clicked node, identical to the canvas/pane menu\'s own "Auto-layout" item that already owns this id. `surfaces` already includes \'context\' (added for Mind Map\'s pane menu, E02-N5-PANE) — no field changes needed for this second, honest reuse.',
  },
  {
    id: 'idea.canvas.cursor_select',
    label: {
      pl: 'Tryb zaznaczania',
      en: 'Select mode',
    },
    icon: 'MousePointer2',
    scope: 'current_view',
    // Tier A rail wiring (2026-08-10): CanvasLeftToolbar.tsx's `pointer_toggle`
    // slot (SHARED_TOP, ~linia 144-159) jest ŻYWY w Mapie myśli/Tablicy/
    // Przepływie (`liveIn`), NIE tylko w Mapie — rozszerzone z `['mindmap']`
    // na wszystkie trzy, zgodnie z realnym stanem raila (sprawdzonym w
    // useWhiteboardQuickActions.ts/useProcessFlowQuickActions.ts przed zmianą,
    // patrz RUNTIME_CURSOR_SELECT wyżej). Tabela zostaje jedyną wyłączoną —
    // patrz `disabledReason` niżej.
    tools: ['mindmap', 'whiteboard', 'process_flow'],
    surfaces: ['rail'],
    // Handler ZMIENIONY z `runByTool` na `runToolbarBusAction` (2026-08-10,
    // tier A): ten wpis nie miał DOTĄD żadnego realnego wywołującego (rail nie
    // był podłączony do rejestru), więc `runByTool`'s zawsze-dispatch-na-szynę
    // był martwy w praktyce. Prawdziwy klik w `CanvasLeftToolbar.tsx`'s
    // `handlePointerToggle` (~linia 859) woła `onAction(...)`, co w
    // `IdeaMapWorkspace.tsx`'s `handleQuickAction` (Mapa myśli) ROBI DWIE
    // RZECZY naraz: `handleMindMapInteractionModeChange(...)` (lokalny stan
    // React używany przez sam rail do wyboru ikony) ORAZ dispatch tej samej
    // szyny `idea-workspace-quick-action` (którą odbierają
    // use{Whiteboard,ProcessFlow}QuickActions.ts). Gdyby handler dispatchował
    // WYŁĄCZNIE przez szynę (jak `runByTool`), Mapa myśli zgubiłaby pierwszy z
    // tych dwóch efektów dla kliku UI — `runToolbarBusAction` (ten sam dual-path
    // co `idea.canvas.undo`/`.redo`) zachowuje klik BEZ ZMIAN (`ctx.params.run`
    // = dokładnie `() => onAction(...)`), i dopiero dla Teresy (brak
    // `ctx.params.run`) dispatchuje samą szynę — uczciwe wobec braku lokalnego
    // stanu Mapy myśli po stronie Teresy (analogiczna asymetria jak przy innych
    // wpisach tego rejestru, NIE naprawiana tutaj, bo poza zakresem tej zmiany).
    handler: (ctx) => runToolbarBusAction('idea.canvas.cursor_select', RUNTIME_CURSOR_SELECT, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Przełącza kursor w tryb zaznaczania na otwartym płótnie (Mapa myśli/Tablica/Przepływ) — alternatywa dla trybu przesuwania widoku (rączka).',
    },
    // Rail jest wspólny dla czterech reprezentacji, więc slot POKAZUJE się wszędzie
    // — poza trzema płótnami wyszarzony z podanym powodem (konwencja f5d0271992/e2ad0cc85b).
    showsDisabled: true,
    // Tekst 1:1 z rail's own `powodWylaczenia()`/`offReasonPl`
    // (CanvasLeftToolbar.tsx ~linia 157) — ta sama informacja, nie
    // sparafrazowana ponownie.
    disabledReason: (ctx) =>
      ctx.tool === 'mindmap' || ctx.tool === 'whiteboard' || ctx.tool === 'process_flow'
        ? null
        : 'tryb kursora dotyczy płótna — Tabela to siatka danych, nie płótno',
    runtime: RUNTIME_CURSOR_SELECT,
    source:
      'src/components/MyWork/mindmap/CanvasLeftToolbar.tsx:859 (handlePointerToggle) + IdeaMapWorkspace.tsx:1090-1091 (mm_select_mode/mm_pan_mode) + useWhiteboardQuickActions.ts:147 + useProcessFlowQuickActions.ts:216 · rail wiring 2026-08-10 (tier A)',
  },
  {
    // „Szablony" — otwiera galerię szablonów widoku (`IdeaTemplateGallery`),
    // filtrowaną po aktywnym narzędziu. Wspólna dla wszystkich 4 reprezentacji
    // (Menu 3, lewy slot). NIE mutuje grafu — tylko otwiera modal; sama
    // aplikacja szablonu ma własny podgląd w środku galerii.
    id: 'idea.templates.open',
    label: {
      pl: 'Szablony',
      en: 'Templates',
    },
    icon: 'LayoutTemplate',
    scope: 'current_view',
    tools: 'all',
    surfaces: ['menu3'],
    handler: async (ctx) => {
      // Otwarcie modala żyje w stanie React hosta, więc rejestr sięga do niego
      // przez tę samą szynę co reszta akcji — string `open_template_gallery`
      // ma odbiornik w IdeaMapWorkspace.handleQuickAction (setTemplateGalleryOpen).
      dispatchQuickAction('open_template_gallery', ctx);
      return {
        ok: true,
        actionId: 'idea.templates.open',
        data: { runtime: 'open_template_gallery' },
      };
    },
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera galerię gotowych szablonów dla otwartej reprezentacji — szybki start z gotowej struktury zamiast pustego płótna/tabeli.',
    },
    source:
      'src/components/MyWork/IdeaMapWorkspace.tsx setTemplateGalleryOpen (Menu 3 „Szablony", buildIdeaMenu3Actions) + IdeaTemplateGallery.tsx',
  },
  {
    // „Eksport" — otwiera `IdeaExportMenu` z pełnym grafem + rozszerzeniami.
    // Document-level action: one canonical entry in Menu 1 overflow. Keeping it
    // out of Menu 3 prevents the same outcome from competing with view actions.
    id: 'idea.export.open',
    label: {
      pl: 'Eksport',
      en: 'Export',
    },
    icon: 'Download',
    scope: 'workspace',
    tools: 'all',
    surfaces: ['menu1'],
    handler: async (ctx) => {
      // `open_export_menu` ma gotowy odbiornik w IdeaMapWorkspace.handleQuickAction
      // (setExportMenuOpen) i w routerze zdarzeń szyny (lista dozwolonych akcji).
      dispatchQuickAction('open_export_menu', ctx);
      return { ok: true, actionId: 'idea.export.open', data: { runtime: 'open_export_menu' } };
    },
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera okno eksportu otwartej reprezentacji do pliku (obraz/PDF/pakiet — zależnie od narzędzia).',
    },
    source:
      'src/components/MyWork/IdeaMapWorkspace.tsx setExportMenuOpen (Menu 3 „Eksport" + kebab Menu 1) + IdeaExportMenu.tsx',
  },
  {
    // Closure (2026-08-10) 04_ACTION_COVERAGE_INVENTORY.csv class-d:
    // IdeaTemplateGallery.tsx `handleApply` (wołane z L2206 bez AI-fill i
    // L2217 z `withAIFill=true` — JEDNA funkcja, drugi parametr, więc JEDEN
    // wpis rejestru z `withAIFill` jako parametr Teresy, nie dwa id). Realna,
    // destrukcyjna mutacja — `applyIdeaTemplate` woła `Api.syncMyIdeaMap`,
    // które ZASTĘPUJE nodes/edges całej Idei (rozdz. 10 §5/§8 `idea.template.apply`).
    // UI: `ctx.params.run` = oryginalny `handleApply` (zachowuje istniejące
    // okno potwierdzenia „Zastąpić istniejące elementy?" 1:1 — rozdz. 10 §5
    // wymóg confirm-before-overwrite, już spełniony, nie regresowany).
    // Teresa: `confirmBeforeRun: true` (framework `runIdeaAction` wymusza
    // potwierdzenie PRZED wywołaniem handlera — rozdz. 10 §5 „bez wyjątków",
    // więc Teresa potwierdza ZAWSZE, nawet gdy graf jest pusty — ściślej niż
    // UI, nigdy luźniej) → rozwiązuje `templateId` przez `findIdeaTemplate`
    // (walidacja, ten sam katalog `ALL_TEMPLATES` co galeria) i dispatchuje
    // NOWY string szyny `apply_idea_template`, którego odbiornik
    // (IdeaMapWorkspace.tsx handleQuickAction, dodane 2026-08-10) woła
    // ISTNIEJĄCY `handleApplyTemplate` — ŚWIADOMIE NIE woła `applyIdeaTemplate`
    // bezpośrednio stąd: `handleApplyTemplate` niesie poprawny `baseVersion`
    // (`graphRuntime.graph.version`) i `handleTemplateApplied()` (refresh +
    // bump `mapRefreshToken`), którego brak historycznie gubił treść w
    // Przepływie/Mapie po zastosowaniu szablonu (komentarz przy
    // `handleTemplateApplied`, IdeaMapWorkspace.tsx ~L1258) — wołanie
    // `applyIdeaTemplate` wprost z rejestru odtworzyłoby TEN SAM, już
    // naprawiony defekt.
    id: 'idea.template.apply',
    label: { pl: 'Zastosuj szablon', en: 'Apply template' },
    icon: 'LayoutTemplate',
    scope: 'workspace',
    tools: 'all',
    surfaces: ['panel'],
    handler: async (ctx) => {
      const actionId = 'idea.template.apply';
      const run = ctx.params?.run;
      if (ctx.source === 'ui' && typeof run === 'function') {
        await (run as () => void | Promise<void>)();
        return { ok: true, actionId };
      }
      const templateId =
        typeof ctx.params?.templateId === 'string' ? ctx.params.templateId : undefined;
      if (!templateId) {
        return {
          ok: false,
          actionId,
          message: 'Nie wiem, który szablon zastosować — podaj `templateId`.',
        };
      }
      const template = findIdeaTemplate(templateId);
      if (!template) {
        return { ok: false, actionId, message: `Nie znam szablonu „${templateId}".` };
      }
      const withAIFill = ctx.params?.withAIFill === true;
      dispatchQuickAction('apply_idea_template', ctx, { templateId });
      if (withAIFill && template.nodes.length > 0) {
        try {
          const { generateAIProposal } = await import('@/services/ideaAIGenerator');
          const batch = await generateAIProposal({
            ideaId: ctx.ideaId,
            generatorType: 'mindmap_expand',
            tool: ctx.tool,
            context: {
              seedText: `Fill the ${template.namePl} template with company-specific data`,
              title: template.namePl,
              existingNodes: template.nodes,
              existingEdges: template.edges,
              language: ctx.language || 'pl',
            },
          });
          if (batch?.proposals?.length) {
            window.dispatchEvent(
              new CustomEvent('idea-workspace-ai-proposal', { detail: { batch } })
            );
          }
        } catch {
          // AI-fill jest best-effort — szablon jest już zastosowany nawet gdy to zawiedzie
          // (dokładnie ten sam kontrakt co IdeaTemplateGallery.tsx handleApply).
        }
      }
      return { ok: true, actionId, data: { runtime: 'apply_idea_template', templateId } };
    },
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      evidence:
        'Api.syncMyIdeaMap zastępuje nodes/edges bez tworzenia snapshotu PRZED zmianą — rozdz. 10 §5 wymaga confirm-before-overwrite (spełnione), ale nie wymaga jeszcze snapshotu/cofnięcia (§4.1 ma ten wymóg dla Import, nie dla Szablonu). Prawdziwa luka: żaden mechanizm nie przywraca poprzedniego grafu po zastosowaniu szablonu poza ręcznym Ctrl+Z, jeśli sesja przeglądarki jeszcze żyje.',
      reason: 'unrecoverable',
    },
    teresa: {
      description:
        'Stosuje gotowy szablon (strukturę węzłów/krawędzi) na całej Idei — ZASTĘPUJE bieżącą treść. Zawsze wymaga potwierdzenia. Opcjonalnie od razu generuje propozycję AI wypełnienia szablonu danymi (do ręcznej akceptacji, nie automatyczna).',
      confirmBeforeRun: true,
      parameters: {
        type: 'object',
        properties: {
          templateId: { type: 'string', description: 'Id szablonu z galerii (np. "swot").' },
          withAIFill: {
            type: 'boolean',
            description: 'Czy od razu wygenerować propozycję AI wypełnienia szablonu danymi.',
          },
        },
        required: ['templateId'],
      },
    },
    source:
      'src/components/MyWork/IdeaTemplateGallery.tsx:2206 (handleApply(template)) + :2217 (handleApply(template, true)) → applyIdeaTemplate (export, ~L1900) + findIdeaTemplate (export, ~L1896).',
  },
  {
    // Closure (2026-08-10) 04_ACTION_COVERAGE_INVENTORY.csv class-d:
    // `idea.export.open` (bezpośrednio nad tym wpisem) otwiera WYŁĄCZNIE
    // modal — sam per-format klik (`handleExport`, IdeaExportMenu.tsx:838;
    // + JSON-fallback button ~L1045, sama funkcja `exportJSON` wywołana
    // wprost) nie miał żadnego id. Wszystkie 8 formatów (PNG/SVG/PDF/
    // Markdown/JSON/pakiet diagramu/raport mapowania/manifest share) realnie
    // produkują plik przez `downloadBlob` — rozdz. 10 §3/§8 `idea.export.file`.
    // NOWE okablowanie (2026-08-10): `IdeaExportMenu.tsx` dostał listener
    // `run_export_format` na tej samej szynie — działa NIEZALEŻNIE od tego,
    // czy modal jest wizualnie otwarty (`canvasContainerRef`/`graphNodes`/
    // `graphEdges` to trwałe referencje/propy warsztatu, nie stan modala).
    id: 'idea.export.file',
    label: {
      pl: 'Eksportuj plik',
      en: 'Export file',
    },
    icon: 'Download',
    scope: 'workspace',
    tools: 'all',
    surfaces: ['panel'],
    handler: async (ctx) => {
      const format = typeof ctx.params?.format === 'string' ? ctx.params.format : undefined;
      if (!format) {
        return {
          ok: false,
          actionId: 'idea.export.file',
          message: 'Nie wiem, do jakiego formatu eksportować — podaj `format`.',
        };
      }
      dispatchQuickAction('run_export_format', ctx, { format });
      return {
        ok: true,
        actionId: 'idea.export.file',
        data: { runtime: 'run_export_format', format },
      };
    },
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Eksportuje otwartą reprezentację Idei do realnego pliku do pobrania — PNG/SVG/PDF (obraz bieżącego płótna), Markdown (outline), JSON/pakiet diagramu (surowe dane), raport mapowania fidelity, manifest share/embed. Nie mutuje Idei.',
      parameters: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: [
              'png',
              'svg',
              'pdf',
              'markdown',
              'json',
              'package',
              'mapping_report',
              'share_manifest',
            ],
            description: 'Format pliku do wyeksportowania.',
          },
        },
        required: ['format'],
      },
    },
    source:
      'src/components/MyWork/IdeaExportMenu.tsx:838 (handleExport, per-format przyciski) + :1045 (exportJSON fallback button) → NOWY listener `run_export_format` na szynie `idea-workspace-quick-action` (2026-08-10).',
  },
  {
    id: 'idea.workspace.convert',
    label: {
      pl: 'Konwertuj',
      en: 'Convert',
    },
    icon: 'Workflow',
    scope: 'workspace',
    tools: 'all',
    // Konwersja CAŁEJ Idei to zakres `workspace` → jej miejsce to Menu 1
    // (primary „Konwertuj ▾", `IdeaConvertMenu`) i prawy panel, NIGDY Menu 3.
    // Menu 3 renderuje się teraz z rejestru (filtr surfaces⊇menu3), więc
    // pozostawienie 'menu3' tutaj wstawiłoby do drugiej listwy przycisk bez
    // dropdownu (handler wymaga `target`+potwierdzenia → klik bez efektu) —
    // dokładnie martwy klik, którego pilnuje strażnik. Zgodne z rozdz. 05 §2
    // (workspace = Menu 1) i §4.1/D6 (skrót „Utwórz z mapy" ZAKAZANY w Menu 3).
    surfaces: ['menu1', 'panel'],
    handler: async (ctx) => {
      const target = String(ctx.params?.target || '');
      const allowed = ['initiative', 'task_set', 'decision', 'report', 'presentation'];
      if (!allowed.includes(target)) {
        return {
          ok: false,
          actionId: 'idea.workspace.convert',
          message: `Podaj, w co przekształcić Ideę: ${allowed.join(', ')}.`,
        };
      }
      if (!ctx.confirmed) {
        return {
          ok: false,
          actionId: 'idea.workspace.convert',
          message: 'Konwersja tworzy nowy, trwały obiekt — potrzebuję potwierdzenia.',
        };
      }
      const data = await Api.convertMyIdea(ctx.ideaId, {
        target: target as 'initiative' | 'task_set' | 'decision' | 'report' | 'presentation',
      });
      return { ok: true, actionId: 'idea.workspace.convert', data };
    },
    mutates: true,
    // E11 UPDATE (2026-08-10) — checked before writing this: unlike the
    // `idea.node.mm_convert_*` entries below, this `handler` has no
    // `ctx.params.run` UI shortcut, so the HUMAN Menu 1/panel click path
    // never reaches it at all — those call `IdeaMapWorkspace`'s own
    // `handleConvert` prop directly, which now DOES show a mandatory
    // preview (`ConversionPreviewDialog`) before calling `Api.convertMyIdea`.
    // THIS handler is reached only by Teresa/command-palette callers, whose
    // gate is `confirmBeforeRun: true` below (a conversational confirm, not
    // a visual preview) — that path calls `Api.convertMyIdea` directly with
    // NO preview. `requiresPreview: false` stays honest for what THIS
    // dispatch path (registry handler) actually does; it does not describe
    // the separate, now-previewed human UI path.
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'brak cofnięcia — powstaje nowy rekord (Initiative/Decision/Task/Report/Presentation), usuwa się go ręcznie (audyt 04 §0 pkt 4)',
    },
    teresa: {
      description:
        'Przekształca Ideę w gotowy obiekt pracy: inicjatywę, zestaw zadań, decyzję, raport albo prezentację. Tworzy nowy, trwały rekord. UWAGA: ta ścieżka (Teresa) NIE pokazuje wizualnego podglądu przed wykonaniem — tylko potwierdzenie konwersacyjne (`confirmBeforeRun`). Ludzki klik w Menu 1/panelu POKAZUJE podgląd (inny mechanizm, ten sam efekt końcowy).',
      parameters: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'initiative | task_set | decision | report | presentation',
          },
        },
        required: ['target'],
      },
      confirmBeforeRun: true,
    },
    source:
      'src/services/api.ts:5138 (convertMyIdea) + IdeaMapWorkspace.tsx handleConvert (audyt 02 §A m1_convert)',
  },
  {
    id: 'idea.workspace.duplicate',
    label: {
      pl: 'Duplikuj Ideę',
      en: 'Duplicate idea',
    },
    icon: 'Copy',
    scope: 'workspace',
    tools: 'all',
    surfaces: ['menu1'],
    handler: async (ctx) => {
      const data = await Api.duplicateMyIdea(ctx.ideaId, { language: ctx.language || 'pl' });
      return { ok: true, actionId: 'idea.workspace.duplicate', data };
    },
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence: 'klon jest osobną Ideą — cofnięcie = usunięcie kopii (DELETE /my-ideas/:id)',
    },
    teresa: {
      description:
        'Robi kopię całej Idei razem z jej mapą — do eksperymentów bez ruszania oryginału.',
      confirmBeforeRun: true,
    },
    source: 'src/services/api.ts:4619 (duplicateMyIdea) + IdeaMapWorkspace.tsx kebab „Duplikuj"',
  },
  {
    // Program D / epic E08 (2026-08-10) — Przegląd → „Karta biznesowa"
    // (`IdeaBusinessCaseSection.tsx`, za flagą `ff_ideaBusinessCase`, default
    // OFF). Zapis JEDNEJ sekcji schematu §6.2 (problem/baseline, cele,
    // interesariusze, alternatywy, rekomendacja, korzyści, koszty, wpływ
    // operacyjny, ryzyka, kamienie milowe, KPI, pewność, decyzja) — sekcja
    // „Dowody i założenia" NIE idzie tą ścieżką, bo czyta/pisze wprost do
    // ISTNIEJĄCEGO Evidence Envelope (`idea.node.find_evidence` używa tego
    // samego magazynu inną drogą — panel osadza `EvidencePanelSection`
    // bezpośrednio, bez przechodzenia przez rejestr).
    id: 'idea.workspace.business_case_save',
    label: { pl: 'Zapisz sekcję karty biznesowej', en: 'Save business case section' },
    icon: 'Save',
    scope: 'workspace',
    tools: 'all',
    surfaces: ['panel'],
    handler: (ctx) => runPanelUiOnlyCallback('idea.workspace.business_case_save', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        'Brak stosu cofania dla karty biznesowej (PUT /api/idea-business-case/:ideaId nadpisuje sekcję bezpośrednio, bez historii wersji) — uczciwie zgłoszony brak, nie ukryty. Zakładka Historia panelu dziś NIE nagrywa zmian karty biznesowej; przywrócenie poprzedniej treści wymaga ręcznego cofnięcia edycji przez użytkownika.',
    },
    teresa: {
      description:
        'Zapisuje jedną sekcję karty biznesowej Idei (np. problem i punkt odniesienia, alternatywy, ryzyka, KPI). Dziś dostępne WYŁĄCZNIE z prawego panelu — Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/panel/IdeaBusinessCaseSection.tsx (przycisk „Zapisz sekcję") + useIdeaBusinessCase.ts saveSection + server/src/routes/ideaBusinessCase.routes.ts PUT',
  },
  {
    // R10 debt closure (2026-08-10, zapowiedziane w RESUME_HANDOFF.md jako
    // "pierwsze zadanie następnej sesji") — `IdeaBusinessCaseSection.tsx`'s
    // `NodeRefPicker` (współdzielony widget, używany przez KAŻDĄ z sekcji
    // karty biznesowej — problemBaseline/strategicObjective/
    // stakeholdersProcesses/recommendation/... poprzez `LineageEditor`,
    // patrz `patchSection(key, ...)` na każdym wywołaniu). Klik "Powiąż"
    // dopisuje jeden `BusinessCaseSourceRef` do LOKALNEGO draftu bieżącej
    // sekcji (`patchSection`, `useState`) — nic nie trafia na serwer, dopóki
    // człowiek nie kliknie osobno "Zapisz sekcję" (`idea.workspace.business_case_save`
    // wyżej). Sekcja docelowa NIE jest tu znana rejestrowi (widget jest
    // per-sekcja generyczny) — stąd `ctx.params.run` jest JEDYNĄ ścieżką,
    // nie tylko dla UI: bez niej rejestr musiałby zgadywać, którego z 13
    // `patchSection` wywołań dotyczy klik.
    id: 'idea.workspace.business_case_lineage_add',
    label: { pl: 'Powiąż element Idei', en: 'Link idea element' },
    icon: 'Link2',
    scope: 'workspace',
    tools: 'all',
    surfaces: ['panel'],
    handler: (ctx) => runPanelUiOnlyCallback('idea.workspace.business_case_lineage_add', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      reason: 'ephemeral_local',
      evidence:
        'Mutacja WYŁĄCZNIE lokalnego draftu (`useState` w `IdeaBusinessCaseSection.tsx`, NIE zapisana na serwer) — cofnięcie dziś to ręczne usunięcie chipa (patrz `idea.workspace.business_case_lineage_remove` niżej) albo odświeżenie panelu przed zapisem sekcji. Nic trwałego nie ginie, dopóki sekcja nie zostanie zapisana.',
    },
    teresa: {
      description:
        'Dopisuje powiązanie z elementem Idei (węzłem grafu) do draftu bieżącej sekcji karty biznesowej — WYŁĄCZNIE lokalnie, dopóki człowiek nie zapisze sekcji osobno. Dziś dostępne WYŁĄCZNIE z prawego panelu (widget jest współdzielony przez 13 sekcji bez jednego, jawnego identyfikatora sekcji po stronie rejestru) — Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/panel/IdeaBusinessCaseSection.tsx NodeRefPicker onClick "Powiąż" (~L163-176) → onAdd → patchSection(key, …)',
  },
  {
    // Bliźniaczy wpis do `idea.workspace.business_case_lineage_add` wyżej —
    // `LineageChips`'s przycisk "×" na chipie (usuwa JEDNO powiązanie po
    // indeksie z LOKALNEGO draftu tej samej sekcji, ten sam brak zapisu do
    // czasu "Zapisz sekcję").
    id: 'idea.workspace.business_case_lineage_remove',
    label: { pl: 'Usuń powiązanie', en: 'Remove link' },
    icon: 'X',
    scope: 'workspace',
    tools: 'all',
    surfaces: ['panel'],
    handler: (ctx) => runPanelUiOnlyCallback('idea.workspace.business_case_lineage_remove', ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'ephemeral_local',
      evidence:
        'Mutacja WYŁĄCZNIE lokalnego draftu (jak wyżej) — usunięcie chipa NIE trafia na serwer, dopóki sekcja nie zostanie zapisana; cofnięcie dziś to ręczne dodanie powiązania ponownie (`idea.workspace.business_case_lineage_add`) przed zapisem. Nic trwałego nie ginie, dopóki sekcja nie zostanie zapisana.',
    },
    teresa: {
      description:
        'Usuwa jedno powiązanie z elementem Idei z draftu bieżącej sekcji karty biznesowej — WYŁĄCZNIE lokalnie. Dziś dostępne WYŁĄCZNIE z prawego panelu — Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/panel/IdeaBusinessCaseSection.tsx LineageChips onClick "×" (~L205-212) → onRemove(idx) → patchSection(key, …)',
  },
  {
    id: 'idea.edge.edit_label',
    label: { pl: 'Dodaj / edytuj etykietę', en: 'Add / edit label' },
    icon: 'Type',
    scope: 'edge',
    tools: ['whiteboard', 'mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.edit_label', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: IdeaWhiteboardTool.tsx handleEdgeEditLabel:3158 → pushUndoSnapshot() przed setEdges. Mapa myśli: useMindMapQuickActions.ts mm_edge_edit_label → handlers.pushUndo() przed setEdges — DOPISANE 2026-08-09 razem z tym wpisem (poprzednio, w IdeaRecommendationMap.tsx handleEdgeContextAction/edge_add_label, etykiety krawędzi nie dało się cofnąć Ctrl+Z; ta luka jest teraz zamknięta na obu narzędziach).',
    },
    teresa: {
      description:
        'Ustawia etykietę wskazanego połączenia (Tablica lub Mapa myśli). Podaj `edgeId` połączenia (z menu prawego kliku działa bez tego parametru — tam etykietę pyta okno tekstowe).',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi).' },
          label: { type: 'string', description: 'Nowa etykieta połączenia.' },
        },
        required: ['edgeId', 'label'],
      },
    },
    source:
      'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeEditLabel:3158 (Tablica) · src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_edit_label (Mapa myśli)',
  },
  {
    id: 'idea.edge.reverse',
    label: { pl: 'Odwróć kierunek', en: 'Reverse direction' },
    icon: 'ArrowLeftRight',
    scope: 'edge',
    tools: ['whiteboard', 'mindmap', 'process_flow'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.reverse', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: IdeaWhiteboardTool.tsx handleEdgeReverse:3223 → pushUndoSnapshot() przed zamianą source/target. Mapa myśli: useMindMapQuickActions.ts mm_edge_reverse → handlers.pushUndo() przed zamianą source/target (ta sama logika, przeniesiona z IdeaRecommendationMap.tsx handleEdgeContextAction, które też już wołało pushUndo()). Przepływ (2026-08-09, `ProcessFlowContextMenu.tsx` edge-reverse): IdeaProcessFlowTool.tsx handleEdgeReverse:1012 → pushUndo():1015 przed zamianą source/target+handles — już obecne, nic nie dopisywano.',
    },
    teresa: {
      description:
        'Zamienia miejscami początek i koniec wskazanego połączenia (Tablica, Mapa myśli lub Przepływ). Na Mapie myśli działa TYLKO na krawędziach relacji — na strukturalnych krawędziach hierarchii po cichu nic się nie stanie (tak jak dziś w menu prawego kliku). Na Przepływie działa na KAŻDYM połączeniu (Przepływ ma jeden typ krawędzi, bez rozróżnienia strukturalna/relacja). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi).' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeReverse:3223 (Tablica) · src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_reverse (Mapa myśli) · src/components/MyWork/IdeaProcessFlowTool.tsx handleEdgeReverse:1012 + processflow/useProcessFlowQuickActions.ts pf_edge_reverse (Przepływ, 2026-08-09)',
  },
  {
    id: 'idea.edge.cycle_arrow',
    label: { pl: 'Kierunek strzałki', en: 'Arrow direction' },
    icon: 'ArrowRight',
    scope: 'edge',
    tools: ['whiteboard', 'mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.cycle_arrow', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: IdeaWhiteboardTool.tsx handleEdgeCycleArrow:3200 → pushUndoSnapshot() przed zmianą data.arrowDirection (Ctrl+Z). Mapa myśli: useMindMapQuickActions.ts mm_edge_arrow (już istniejący odbiornik z 2026-07-28, PONOWNIE UŻYTY tu, nie duplikowany) NIE woła pushUndo — Ctrl+Z NIE cofa zmiany kierunku strzałki na tym narzędziu. Uczciwa luka pre-existing, świadomie NIENAPRAWIANA w tym wpisie: mm_edge_arrow obsługuje też masowe ustawienie strzałki na całej gałęzi z FloatingNodeToolbar.tsx (poza zakresem tego zadania), więc dopisanie pushUndo tam wymaga osobnej weryfikacji tamtej ścieżki.',
    },
    teresa: {
      description:
        'Przełącza strzałkę kierunku wskazanego połączenia (Tablica lub Mapa myśli), cykl: brak → koniec → oba → początek. Podaj `edgeId` połączenia — jeden klik cyklu, więc żeby dojść do konkretnego kierunku, może być potrzebne kilka wywołań. Na Mapie myśli ta akcja NIE wspiera Ctrl+Z (patrz `undo.evidence`).',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi).' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeCycleArrow:3200 (Tablica) · src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_arrow (Mapa myśli, od 2026-07-28)',
  },
  {
    id: 'idea.edge.cycle_style',
    label: { pl: 'Zmień styl linii', en: 'Change line style' },
    icon: 'Paintbrush',
    scope: 'edge',
    tools: ['whiteboard', 'mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.cycle_style', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: IdeaWhiteboardTool.tsx handleEdgeCycleStyle:3178 → pushUndoSnapshot() przed zmianą data.edgeStyle. Mapa myśli: useMindMapQuickActions.ts mm_edge_cycle_style → handlers.pushUndo() przed zmianą data.edgeStyle — DOPISANE 2026-08-09 (poprzednio brak Ctrl+Z, tak jak edit_label wyżej). NAPRAWIONE 2026-08-10 (E02-N5-EDGE): Mapa myśli pisała style.strokeDasharray, ale jej renderer (`mindmap/LabeledEdge.tsx`) liczył strokeDasharray WYŁĄCZNIE z `data.edgeStyle` — toast mówił „Style: dashed", linia wizualnie się nie zmieniała. Kanoniczna reprezentacja dla OBU narzędzi to teraz `data.edgeStyle` (Tablica już tak robiła). Mapa myśli cykluje 3 stany (solid/dashed/dotted), Tablica 4 (+wavy). Mind-mapowy renderer nadal akceptuje starą kształtkę `style.strokeDasharray` jako fallback tylko do odczytu (już zapisane mapy sprzed naprawy), żeby nie cofnąć ich wyglądu do „solid" — nowe zapisy zawsze idą przez `data.edgeStyle`.',
    },
    teresa: {
      description:
        'Przełącza styl linii wskazanego połączenia (Tablica lub Mapa myśli), cykl: Tablica ciągła→kreskowana→kropkowana→falista, Mapa myśli ciągła→kreskowana→kropkowana. Podaj `edgeId` połączenia — jeden klik cyklu, może być potrzebne kilka wywołań.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi).' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeCycleStyle:3178 (Tablica) · src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_cycle_style (Mapa myśli)',
  },
  {
    id: 'idea.edge.delete',
    label: { pl: 'Usuń połączenie', en: 'Delete connection' },
    icon: 'Trash2',
    scope: 'edge',
    tools: ['whiteboard', 'mindmap'],
    surfaces: ['context'],
    handler: (ctx) => runEdgeParamCallback('idea.edge.delete', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: IdeaWhiteboardTool.tsx handleEdgeDelete:3245 → onEdgesChange:1144 → pushUndoSnapshot() przed applyEdgeChanges. Mapa myśli: useMindMapQuickActions.ts mm_edge_delete → handlers.pushUndo() przed setEdges filter (ta sama logika, przeniesiona z IdeaRecommendationMap.tsx handleEdgeContextAction, które też już wołało pushUndo()).',
    },
    // Trwałe usunięcie krawędzi z grafu — pierwsze użycie `destructive` w
    // rejestrze (pole zadeklarowane, dotąd nieużywane przez żaden z 16
    // wcześniejszych wpisów). Undo jest lokalny (Ctrl+Z), stąd `mutates`+`undo`
    // osobno od `destructive`, zgodnie z opisem pola w interfejsie ActionDef.
    destructive: true,
    teresa: {
      description:
        'Usuwa wskazane połączenie na trwałe (cofnięcie tylko przez Ctrl+Z w tej samej sesji przeglądarki). Na Mapie myśli działa TYLKO na krawędziach relacji utworzonych ręcznie — na strukturalnych i automatycznych po cichu nic się nie stanie (tak jak dziś w menu prawego kliku, gdzie ta pozycja jest wtedy wyszarzona). Podaj `edgeId` połączenia.',
      parameters: {
        type: 'object',
        properties: {
          edgeId: { type: 'string', description: 'Id połączenia (krawędzi).' },
        },
        required: ['edgeId'],
      },
    },
    source:
      'src/components/MyWork/IdeaWhiteboardTool.tsx handleEdgeDelete:3245 (Tablica) · src/components/MyWork/mindmap/useMindMapQuickActions.ts mm_edge_delete (Mapa myśli)',
  },
  {
    id: 'idea.canvas.undo',
    label: { pl: 'Cofnij', en: 'Undo' },
    icon: 'Undo2',
    // Sam mechanizm cofania NIE ma własnego wpisu na stosie undo (byłby
    // nieskończony regres) — `mutates: false`, tak jak `idea.canvas.cursor_select`
    // (tryb, nie treść). Cofa realne mutacje, ale samo wywołanie nie jest
    // jedną z nich.
    scope: 'current_view',
    tools: 'all',
    // Tier A rail wiring (2026-08-10): CanvasLeftToolbar.tsx's getUndoRedoSlots
    // (~linia 405) renderuje TEN SAM przycisk (action: `${prefix}_undo`, gdzie
    // prefix = mm/wb/pf/tbl — dokładnie RUNTIME_UNDO powyżej) na wszystkich
    // czterech reprezentacjach. `surfaces` rozszerzone o 'rail' — id/handler/
    // runtime NIETKNIĘTE (ten sam `runToolbarBusAction`, ten sam dual-path co
    // już miał dla 'toolbar').
    surfaces: ['toolbar', 'rail'],
    // Skrót (2026-08-10, reconciliacja): `useIdeasToolKeyboard.ts` (Tablica,
    // Przepływ) i `useTableKeyboard.ts` (Tabela) wołają Ctrl/Cmd+Z → funkcję
    // undo narzędzia wprost — genuine cross-tool reuse, ta sama semantyka co
    // `RUNTIME_UNDO` już obsługuje. Mapa myśli ma DZIŚ WŁASNY, osobny listener
    // (poza trzema hookami tej reconciliacji) — nietknięty tym wpisem.
    shortcut: '⌘Z',
    handler: (ctx) => runToolbarBusAction('idea.canvas.undo', RUNTIME_UNDO, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Cofa ostatnią zmianę w otwartej reprezentacji (Ctrl/Cmd+Z).',
    },
    runtime: RUNTIME_UNDO,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:273-279 (undo) — wspólne dla 4 narzędzi · REUSED (2026-08-10, rail tier A) by CanvasLeftToolbar.tsx getUndoRedoSlots (~linia 405-423)',
  },
  {
    id: 'idea.canvas.redo',
    label: { pl: 'Ponów', en: 'Redo' },
    icon: 'Redo2',
    scope: 'current_view',
    tools: 'all',
    // Tier A rail wiring (2026-08-10) — patrz komentarz przy `idea.canvas.undo`
    // wyżej, ten sam rozumowanie (getUndoRedoSlots' 'redo' slot).
    surfaces: ['toolbar', 'rail'],
    // Skrót (2026-08-10, reconciliacja) — patrz komentarz przy `idea.canvas.undo`.
    shortcut: '⌘⇧Z',
    handler: (ctx) => runToolbarBusAction('idea.canvas.redo', RUNTIME_REDO, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Ponawia cofniętą zmianę w otwartej reprezentacji (Ctrl/Cmd+Shift+Z).',
    },
    runtime: RUNTIME_REDO,
    source:
      'src/components/MyWork/whiteboard/WhiteboardToolbar.tsx:280-286 (redo) — wspólne dla 4 narzędzi · REUSED (2026-08-10, rail tier A) by CanvasLeftToolbar.tsx getUndoRedoSlots (~linia 405-423)',
  },
  {
    id: 'idea.node.duplicate',
    label: { pl: 'Duplikuj', en: 'Duplicate' },
    icon: 'Copy',
    scope: 'selected_items',
    // Rozszerzone o `process_flow` (2026-08-09, N6 kontynuacja — patrz
    // komentarz przy `RUNTIME_NODE_DUPLICATE` wyżej dla pełnego uzasadnienia):
    // `duplicateSelected()` w `useProcessFlowNodes.ts` operuje na PŁASKIM
    // zaznaczeniu płótna, identycznie jak Tablicy wersja — genuine reuse, nie
    // nowe id. `surfaces` dostaje `floating`, bo `ProcessFlowFloatingToolbar.tsx`
    // ma przycisk „Duplikuj" wołający TĘ SAMĄ funkcję (`onDuplicate=
    // {duplicateSelected}`) — Tablica dziś nie ma zarejestrowanej powierzchni
    // `floating` dla tej akcji (ma `WhiteboardSelectionBar` używającą tej samej
    // funkcji, ale niepodłączoną do rejestru — poza zakresem tego wpisu).
    tools: ['whiteboard', 'process_flow'],
    // `toolbar` dopisane 2026-08-10 (N6.4): menu „Więcej" paska Przepływu ma
    // „Duplikuj (Ctrl+D)" wołające prop `duplicateSelected` — tę SAMĄ funkcję
    // (`useProcessFlowNodes.duplicateSelected`), którą już reużywa menu węzła i
    // pływający pasek. Powierzchnia `toolbar` jest dziś czytana także przez
    // `WhiteboardToolbar.tsx` (`getActionsForSurface('toolbar', {tool:'whiteboard'})`),
    // ale tamten komponent podnosi WYŁĄCZNIE id, które sam wywołuje — dopisanie
    // powierzchni nie zmienia niczego po stronie Tablicy (sprawdzone).
    surfaces: ['context', 'floating', 'toolbar'],
    // Skrót (2026-08-10, reconciliacja): `useIdeasToolKeyboard.ts`'s `onDuplicate`
    // (Ctrl/Cmd+D) na OBU narzędziach woła DOKŁADNIE `duplicateSelected` — ta
    // sama funkcja co pasek/menu wyżej.
    shortcut: '⌘D',
    handler: (ctx) => runToolbarBusAction('idea.node.duplicate', RUNTIME_NODE_DUPLICATE, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: useWhiteboardNodes.ts duplicateSelected:131-161 → pushSnapshot() (stos Ctrl+Z). Przepływ (2026-08-09): useProcessFlowNodes.ts duplicateSelected:227 → pushUndo():231 (stos Ctrl+Z, już obecne, nic nie dopisywano).',
    },
    teresa: {
      description:
        'Duplikuje zaznaczone elementy (Tablica lub Przepływ). UWAGA: działa na to, co jest DZIŚ zaznaczone na płótnie w przeglądarce użytkownika (ta sama funkcja co przycisk "Duplikuj") — nie przyjmuje `nodeId`, więc bez wcześniejszego zaznaczenia przez użytkownika nie ma czego duplikować. Na Przepływie menu prawego kliku na węzeł NIE zaznacza go (celowe zachowanie, patrz `idea.node.pf_edit`) — jeśli klikniesz prawym na węzeł, który nie był wcześniej zaznaczony lewym kliknięciem, ta pozycja menu po cichu nic nie zrobi (przedistniejąca luka, niedotknięta tym wpisem).',
    },
    runtime: RUNTIME_NODE_DUPLICATE,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx BASE_NODE_ACTIONS kind=duplicate + useWhiteboardNodes.ts:131 (Tablica) · src/components/MyWork/IdeaProcessFlowTool.tsx onDuplicate → duplicateSelected() (~linia 3786, menu węzła) + ProcessFlowFloatingToolbar.tsx onDuplicate prop (~linia 3486) + useProcessFlowNodes.ts:227 (Przepływ, 2026-08-09)',
  },
  {
    id: 'idea.node.delete',
    label: { pl: 'Usuń', en: 'Delete' },
    icon: 'Trash2',
    scope: 'selected_items',
    // Rozszerzone o `process_flow` (2026-08-09, N6 kontynuacja) — patrz
    // uzasadnienie przy `idea.node.duplicate` wyżej i przy
    // `RUNTIME_NODE_DELETE`: `deleteSelected()` w `useProcessFlowNodes.ts`
    // usuwa CZYMKOLWIEK jest dziś zaznaczone (węzły LUB krawędzie), tak samo
    // ogólnie jak Tablicy wersja ("zaznaczone elementy", nie "węzły") —
    // genuine reuse. `floating`: `ProcessFlowFloatingToolbar.tsx` ma przycisk
    // „Usuń" wołający TĘ SAMĄ funkcję (`onDelete={deleteSelected}`).
    tools: ['whiteboard', 'process_flow'],
    // `toolbar` dopisane 2026-08-10 (N6.4): menu „Więcej" paska Przepływu ma
    // „Usuń zaznaczone" wołające prop `deleteSelected` — ta sama funkcja co
    // menu węzła / pływający pasek / `idea.edge.pf_delete`. Uwaga o Tablicy
    // jak przy `idea.node.duplicate` wyżej.
    surfaces: ['context', 'floating', 'toolbar'],
    // Skrót (2026-08-10, reconciliacja): `useIdeasToolKeyboard.ts`'s
    // `onDeleteSelected` (Delete/Backspace) na OBU narzędziach woła DOKŁADNIE
    // `deleteSelected` — ta sama funkcja co pasek/menu wyżej.
    shortcut: 'Del',
    handler: (ctx) => runToolbarBusAction('idea.node.delete', RUNTIME_NODE_DELETE, ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Tablica: useWhiteboardNodes.ts deleteSelected:107-129 → pushSnapshot() (stos Ctrl+Z). Przepływ: useProcessFlowNodes.ts deleteSelected:70 → pushUndo():83 (stos Ctrl+Z, już obecne — ta sama funkcja już reużyta przez `idea.edge.pf_delete`, edge-menu wpis 2026-08-09).',
    },
    destructive: true,
    teresa: {
      description:
        'Usuwa zaznaczone elementy (Tablica lub Przepływ; cofnięcie przez Ctrl+Z w tej samej sesji). UWAGA: działa na to, co jest DZIŚ zaznaczone na płótnie w przeglądarce użytkownika — nie przyjmuje `nodeId`, więc bez wcześniejszego zaznaczenia przez użytkownika nie ma czego usunąć. Na Przepływie menu prawego kliku na węzeł NIE zaznacza go — jeśli klikniesz prawym na niezaznaczony węzeł, ta pozycja menu po cichu nic nie zrobi (przedistniejąca luka, ta sama co przy `idea.node.duplicate`, niedotknięta tym wpisem; krawędzie NIE mają tego problemu, bo prawy klik na krawędzi ZAZNACZA ją jawnie przed otwarciem menu — patrz `idea.edge.pf_delete`).',
    },
    runtime: RUNTIME_NODE_DELETE,
    source:
      'src/components/MyWork/IdeaCanvasContextMenu.tsx DESTRUCTIVE_NODE_ACTIONS kind=delete + useWhiteboardNodes.ts:107 (Tablica) · src/components/MyWork/IdeaProcessFlowTool.tsx onDelete → deleteSelected() (~linia 3793, menu węzła) + ProcessFlowFloatingToolbar.tsx onDelete prop (~linia 3487) + useProcessFlowNodes.ts:70 (Przepływ, 2026-08-09)',
  },
];
