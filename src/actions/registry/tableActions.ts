/**
 * Akcje rejestru Idea Workspace — domena: table.
 *
 * Wydzielone z `src/actions/ideaActionRegistry.ts` (QG-01, 2026-08-10),
 * verbatim (identyczne id/label/scope/surfaces/handler/mutates/undo/teresa),
 * tylko fizycznie przeniesione. SSOT formatu i reguł: nagłówek
 * `src/actions/ideaActionRegistry.ts` + `docs/standards/idea-workspace/02_REJESTR_AKCJI.md`.
 */

import type { ActionDef } from './types';
import {
  RUNTIME_AI_TABLE_ASSISTANT,
  RUNTIME_AI_TABLE_CATEGORIZE,
  RUNTIME_AI_TABLE_FRAMEWORK,
  RUNTIME_TBL_COLUMN_DELETE,
  RUNTIME_TBL_COLUMN_HIDE,
  RUNTIME_TBL_COLUMN_RENAME,
  RUNTIME_TBL_COLUMN_SORT,
  RUNTIME_TBL_COPILOT,
  RUNTIME_TBL_COPY_CLIPBOARD,
  RUNTIME_TBL_CROSS_RELATIONS,
  RUNTIME_TBL_EXPORT_CSV,
  RUNTIME_TBL_EXPORT_PPTX,
  RUNTIME_TBL_HEATMAP,
  RUNTIME_TBL_PIPELINE,
  RUNTIME_TBL_ROW_DELETE,
  RUNTIME_TBL_ROW_DUPLICATE,
  RUNTIME_TBL_ROW_EDIT,
  RUNTIME_TBL_ROW_NOTE,
  RUNTIME_TBL_SCORING,
  RUNTIME_TBL_VIEW_DELETE_PLATFORM,
  RUNTIME_TBL_VIEW_RENAME_PLATFORM,
  RUNTIME_TBL_VOICE,
  runByTool,
  runTableAutomationDeleteCallback,
  runTableAutomationRunNowCallback,
  runTableCellClearCallback,
  runTableCellUiOnlyCallback,
  runTableChatToSchemaProposeCallback,
  runTableColumnDeleteCallback,
  runTableColumnHideCallback,
  runTableColumnRenameCallback,
  runTableColumnSortCallback,
  runTableDateDependencyRecalculateCallback,
  runTableDateDependencySaveCallback,
  runTableDistributionCreateCallback,
  runTableDistributionDeleteCallback,
  runTableDistributionExecuteCallback,
  runTableFormDeleteCallback,
  runTableFormIntakeSaveAllowListCallback,
  runTableFormShareModeChangeCallback,
  runTableInterfaceDeleteCallback,
  runTablePlatformSavedViewDeleteCallback,
  runTablePlatformSavedViewRenameCallback,
  runTableRecordTemplateDeleteCallback,
  runTableRecordTemplateSaveCallback,
  runTableRowDeleteCallback,
  runTableRowDuplicateCallback,
  runTableRowEditCallback,
  runTableRowNoteCallback,
  runTableSavedViewDeleteCallback,
  runTableSavedViewRenameCallback,
  runTableSavedViewUpdateCallback,
  runTableSharingInviteCallback,
  runTableSharingRemoveCollaboratorCallback,
  runTableSyncCreateCallback,
  runTableSyncDeleteCallback,
  runTableSyncRunNowCallback,
  runTableToolbarOrKeyboardCallback,
  runTableToolbarUiOnlyCallback,
  runTableWebhookRelayDeleteCallback,
  runToolbarBusAction,
} from './runtimeHelpers';

export const TABLE_ACTIONS: ActionDef[] = [
  {
    id: 'idea.ai.table_assistant',
    label: {
      pl: 'AI: asystent tabeli',
      en: 'AI: table assistant',
    },
    icon: 'Wand2',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['rail', 'panel'],
    handler: (ctx) => runByTool('idea.ai.table_assistant', RUNTIME_AI_TABLE_ASSISTANT, ctx),
    // Sama akcja tylko OTWIERA asystenta; zmiany danych robi się w jego wnętrzu
    // (i tam mają własny podgląd) — dlatego `mutates: false`, bez ściemy.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera asystenta AI Tabeli — pomaga uzupełniać i przekształcać dane w wierszach i kolumnach.',
    },
    runtime: RUNTIME_AI_TABLE_ASSISTANT,
    source: 'src/components/MyWork/table/useTableQuickActions.ts:81',
  },
  {
    id: 'idea.ai.table_categorize',
    label: {
      pl: 'AI: skategoryzuj',
      en: 'AI: categorize',
    },
    icon: 'GitMerge',
    scope: 'current_view',
    tools: ['table'],
    // N10 (2026-08-10) — `'toolbar'` dopisane: `TableToolbar.tsx`'s More-menu
    // (`props.onShowAICategorize`) i Mobile-menu wołają DOKŁADNIE ten sam
    // `setShowAICategorize` state-setter (`IdeaTableTool.tsx`), który
    // odbiornik `tbl_categorize` już woła — ZWERYFIKOWANE PRZED zmianą
    // (grep + odczyt obu callsite'ów), nie zgadywane. `runToolbarBusAction`
    // zamiast `runByTool` (bez zmiany zachowania — bus i tak dispatchowałby
    // to samo), żeby UI-klik nadal wołał `props.onShowAICategorize`
    // BEZPOŚREDNIO (kontrakt komponentu kontrolowanego, testowany przez
    // `TableToolbar.moreToolsAndAi.test.tsx`-owy wzorzec asercji na propsach).
    surfaces: ['rail', 'panel', 'toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.ai.table_categorize', RUNTIME_AI_TABLE_CATEGORIZE, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        // ★ GRANICA NEGATYWNA (2026-07-24): bez ostatniego zdania gpt-4o i
        // sonnet-4-6 wołały tę akcję na prośbę o KARTECZKI TABLICY i meldowały
        // „Otworzyłam kategoryzację AI dla Tablicy" — zmierzone w żywej rundzie.
        'Otwiera kategoryzację AI dla Tabeli — proponuje pogrupowanie WIERSZY tej Tabeli, każdą grupę zatwierdzasz osobno. Nie dotyczy karteczek Tablicy ani gałęzi Mapy myśli — jeśli użytkownik prosi o nie, powiedz wprost, że tej akcji nie ma w Tabeli.',
    },
    runtime: RUNTIME_AI_TABLE_CATEGORIZE,
    source:
      'src/components/MyWork/table/useTableQuickActions.ts:85 + TableToolbar.tsx More/Mobile menu "AI Categorize" (N10, 2026-08-10)',
  },
  {
    id: 'idea.ai.table_framework',
    label: {
      pl: 'AI: generator frameworka',
      en: 'AI: framework generator',
    },
    icon: 'Lightbulb',
    scope: 'current_view',
    tools: ['table'],
    // N10 (2026-08-10) — `'toolbar'` dopisane: TE SAME `setShowFrameworkGen`
    // (`IdeaTableTool.tsx`) między `TableToolbar.tsx`'s `props.onShowFrameworkGen`
    // (More/Mobile menu) i odbiornikiem `tbl_framework` — zweryfikowane grepem
    // PRZED zmianą.
    surfaces: ['rail', 'panel', 'toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.ai.table_framework', RUNTIME_AI_TABLE_FRAMEWORK, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera generator frameworka Tabeli — podpowiada gotową strukturę kolumn dla wybranej metody pracy.',
    },
    runtime: RUNTIME_AI_TABLE_FRAMEWORK,
    source:
      'src/components/MyWork/table/useTableQuickActions.ts:82 + TableToolbar.tsx More/Mobile menu "Framework Generator" (N10, 2026-08-10)',
  },
  {
    id: 'idea.view.saved_view_rename',
    label: { pl: 'Zmień nazwę', en: 'Rename' },
    icon: 'Pencil',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableSavedViewRenameCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: `updateSavedView` (`useTableViews.ts`) to goły `setSavedViews`, nigdy nie woła `nodesUndo.push` (który i tak śledzi wyłącznie `TableNode[]`, nie `SavedView[]`) — zmiana nazwy widoku NIE trafia dziś na stos Ctrl+Z, ani z menu prawego kliku, ani z inline-rename inputa (ta sama funkcja, dwóch wywołujących), ani z tej nowej ścieżki Teresy. `local_stack` zadeklarowany jako najbliższa istniejąca rodzina mechanizmu (Tabela MA stos Ctrl+Z — `nodesUndo` — po prostu nie objęty tym stanem), nie potwierdzone działanie.',
    },
    teresa: {
      description:
        'Zmienia nazwę zapisanego widoku Tabeli. Podaj `viewId` widoku i nową `name`. Nie działa na widoku domyślnym (nie da się go zmienić także z menu prawego kliku).',
      parameters: {
        type: 'object',
        properties: {
          viewId: { type: 'string', description: 'Id zapisanego widoku Tabeli.' },
          name: { type: 'string', description: 'Nowa nazwa widoku.' },
        },
        required: ['viewId', 'name'],
      },
    },
    source:
      'src/components/MyWork/IdeaTableTool.tsx viewContextMenu "saved_view_rename" (~L2335) + inline-rename input (~L2223-2243) → useTableViews.ts updateSavedView',
  },
  {
    id: 'idea.view.saved_view_update',
    label: { pl: 'Aktualizuj', en: 'Update' },
    icon: 'Save',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableSavedViewUpdateCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: jak `saved_view_rename` wyżej — `updateSavedView` nigdy nie woła `nodesUndo.push`. Nadpisanie sort/filters/groupBy/layout/columns zapisanego widoku bieżącym stanem tabeli NIE trafia dziś na stos Ctrl+Z (ani klik człowieka, ani ta ścieżka Teresy).',
    },
    teresa: {
      description:
        'Nadpisuje zapisany widok Tabeli BIEŻĄCYM stanem tabeli (sortowanie, filtry, grupowanie, układ, widoczność/szerokość kolumn) — dokładnie to, co widzisz teraz na ekranie. Podaj `viewId` widoku do zaktualizowania. Nie działa na widoku domyślnym.',
      parameters: {
        type: 'object',
        properties: {
          viewId: { type: 'string', description: 'Id zapisanego widoku Tabeli do zaktualizowania.' },
        },
        required: ['viewId'],
      },
    },
    source:
      'src/components/MyWork/IdeaTableTool.tsx viewContextMenu "saved_view_update" (~L2346) → useTableViews.ts updateSavedView',
  },
  {
    id: 'idea.view.saved_view_delete',
    label: { pl: 'Usuń', en: 'Delete' },
    icon: 'Trash2',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableSavedViewDeleteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: `deleteSavedView` (`useTableViews.ts`) to goły `setSavedViews` filter, nigdy nie woła `nodesUndo.push`. Usunięcie widoku jest natychmiastowe i trwałe (bez dialogu potwierdzenia po stronie UI — jedyna ochrona to `confirmBeforeRun` niżej, dodana TU dla Teresy; klik człowieka w menu nadal nie pyta) — jedyny sposób odzyskania to ręczne odtworzenie widoku ("Zapisz widok" od nowa).',
    },
    teresa: {
      description:
        'Usuwa zapisany widok Tabeli na trwałe (brak cofnięcia). Podaj `viewId` widoku do usunięcia. Nie działa na widoku domyślnym.',
      parameters: {
        type: 'object',
        properties: {
          viewId: { type: 'string', description: 'Id zapisanego widoku Tabeli do usunięcia.' },
        },
        required: ['viewId'],
      },
      confirmBeforeRun: true,
    },
    source:
      'src/components/MyWork/IdeaTableTool.tsx viewContextMenu "saved_view_delete" (~L2364) → useTableViews.ts deleteSavedView',
  },
  {
    id: 'idea.column.rename',
    label: { pl: 'Zmień nazwę', en: 'Rename' },
    icon: 'Pencil',
    scope: 'table_column',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableColumnRenameCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: `renameColumn` (`useTableSchema.ts` L111) to gołe `setColumns`, nigdy nie woła `nodesUndo.push`; jedyny stos Tabeli (`useUndoRedo<TableNode[]>`, `IdeaTableTool.tsx` L417) śledzi WIERSZE, nie `ColumnDef[]`. Zmiana nazwy kolumny NIE trafia na stos Ctrl+Z ani z inline-edytora nagłówka, ani z tej ścieżki Teresy. `local_stack` = najbliższa istniejąca rodzina mechanizmu (Tabela MA Ctrl+Z, po prostu nie obejmuje kolumn), NIE potwierdzone działanie.',
    },
    teresa: {
      description:
        'Zmienia nazwę (nagłówek) kolumny Tabeli. Podaj `colKey` kolumny i nową `name`. UWAGA: pozycja "Rename" w menu prawego kliku otwiera człowiekowi tylko edytor nagłówka — zatwierdzeniem jest dopiero wpisanie nazwy; ta ścieżka wykonuje od razu cały, dokończony gest (tę samą funkcję, którą zapisuje edytor). Dwutorowa (naprawione 2026-08-10): w trybie platformy tabel woła realną `platformIntegration.renameColumn`, tak samo jak klik człowieka po tej samej naprawie — wcześniej obie ścieżki trafiały w nieużywany stan legacy.',
      parameters: {
        type: 'object',
        properties: {
          colKey: { type: 'string', description: 'Klucz kolumny Tabeli (`ColumnDef.key`).' },
          name: { type: 'string', description: 'Nowa nazwa (nagłówek) kolumny.' },
        },
        required: ['colKey', 'name'],
      },
    },
    runtime: RUNTIME_TBL_COLUMN_RENAME,
    source:
      'src/components/MyWork/IdeaTableTool.tsx colContextMenu "table.column.rename" (~L3992, setEditingHeaderKey) + inline-rename input nagłówka (~L3745/L3750) → effectiveRenameColumn (naprawione 2026-08-10: usePlatform ? platformIntegration.renameColumn : useTableSchema.ts renameColumn)',
  },
  {
    id: 'idea.column.sort',
    label: { pl: 'Sortuj', en: 'Sort' },
    icon: 'ArrowDownUp',
    scope: 'table_column',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableColumnSortCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      reason: 'self_reversing',
      evidence:
        'Sortowanie to stan WIDOKU (`setSort`), nie zmiana danych — nie ma czego cofać poza ponownym przełączeniem. Kolejne wywołanie tej samej akcji cyklicznie wraca do stanu wyjściowego (asc→desc→brak sortowania), więc akcja jest własną odwrotnością.',
    },
    teresa: {
      description:
        'Przełącza sortowanie Tabeli po wskazanej kolumnie, CYKLICZNIE: rosnąco → malejąco → bez sortowania. Podaj `colKey`. Nie zmienia danych, tylko kolejność wyświetlania. Jako jedyna z akcji menu kolumny działa poprawnie także w trybie platformy tabel.',
      parameters: {
        type: 'object',
        properties: {
          colKey: { type: 'string', description: 'Klucz kolumny Tabeli (`ColumnDef.key`).' },
        },
        required: ['colKey'],
      },
    },
    runtime: RUNTIME_TBL_COLUMN_SORT,
    source:
      'src/components/MyWork/IdeaTableTool.tsx colContextMenu "table.column.sort" (~L3999) + klik w nagłówek kolumny (~L3760) → effectiveCycleSort (~L518, dwutorowe)',
  },
  {
    id: 'idea.column.hide',
    label: { pl: 'Ukryj kolumnę', en: 'Hide column' },
    icon: 'FoldVertical',
    scope: 'table_column',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableColumnHideCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: `toggleColumn` (`useTableSchema.ts` L99) to gołe `setColumns`, poza stosem Ctrl+Z Tabeli (ten śledzi `TableNode[]`, nie `ColumnDef[]`). Odwracalne w praktyce ręcznie — ponownym przełączeniem widoczności (menu "Kolumny" w pasku narzędzi), bo kolumna nie jest kasowana, tylko chowana.',
    },
    teresa: {
      description:
        'PRZEŁĄCZA widoczność kolumny Tabeli (nie tylko ukrywa): kolumnę widoczną chowa, a już ukrytą pokaże z powrotem. Pozycja w menu nazywa się "Ukryj kolumnę", bo prawy klik jest możliwy wyłącznie na nagłówku kolumny WIDOCZNEJ — przez `colKey` osiągalny jest też kierunek odwrotny. Podaj `colKey`. Dane wierszy zostają nienaruszone. Dwutorowa (naprawione 2026-08-10): w trybie platformy tabel przełącza realny `platformIntegration.toggleColumn`, tak samo jak klik człowieka po tej samej naprawie — wcześniej obie ścieżki przełączały nieużywany stan legacy, bez widocznego efektu.',
      parameters: {
        type: 'object',
        properties: {
          colKey: { type: 'string', description: 'Klucz kolumny Tabeli (`ColumnDef.key`).' },
        },
        required: ['colKey'],
      },
    },
    runtime: RUNTIME_TBL_COLUMN_HIDE,
    source:
      'src/components/MyWork/IdeaTableTool.tsx colContextMenu "table.column.hide" (~L4006) → effectiveToggleColumn (naprawione 2026-08-10: usePlatform ? platformIntegration.toggleColumn : useTableSchema.ts toggleColumn)',
  },
  {
    id: 'idea.column.delete',
    label: { pl: 'Usuń kolumnę', en: 'Delete column' },
    icon: 'Trash2',
    scope: 'table_column',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableColumnDeleteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'local_stack',
      evidence:
        'BRAK: legacy `deleteColumn` (`useTableSchema.ts` L130) to gołe `setColumns(prev.filter(...))`, a platformowe `platformIntegration.deleteColumn` (serwerowe `deleteField`) też nie ma żadnego lokalnego cofnięcia — ani jedno nie trafia na stos Ctrl+Z (ten śledzi `TableNode[]`, nie `ColumnDef[]`). Naprawione 2026-08-10: klik człowieka teraz pyta `window.confirm` przed usunięciem (wcześniej usuwał od razu, bez pytania) — `confirmBeforeRun` niżej pozostaje jedyną ochroną po stronie Teresy. Odzyskanie = ręczne odtworzenie kolumny ("Nowa kolumna"), przy czym definicja (typ/szerokość/opcje) przepada; w trybie platformy odzyskanie wymaga też ponownego utworzenia pola po stronie serwera.',
    },
    teresa: {
      description:
        'Usuwa kolumnę Tabeli wraz z jej definicją (typ, szerokość, opcje) — bez cofnięcia. Podaj `colKey`. Jeśli chodziło Ci tylko o schowanie kolumny z widoku, użyj zamiast tego akcji ukrycia kolumny. Dwutorowa (naprawione 2026-08-10): w trybie platformy tabel to REALNE, SERWEROWE kasowanie pola (`deleteField`) — TRWALSZE niż w trybie legacy (lokalna pamięć), nie kosmetyczny toast jak wcześniej. Klik człowieka po tej samej naprawie pyta o potwierdzenie (`window.confirm`) przed usunięciem w OBU trybach; ta ścieżka Teresy nie pyta sama — o to dba `confirmBeforeRun` niżej.',
      parameters: {
        type: 'object',
        properties: {
          colKey: { type: 'string', description: 'Klucz kolumny Tabeli (`ColumnDef.key`).' },
        },
        required: ['colKey'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_TBL_COLUMN_DELETE,
    source:
      'src/components/MyWork/IdeaTableTool.tsx colContextMenu "table.column.delete" (~L4013, now behind window.confirm) → effectiveDeleteColumn (naprawione 2026-08-10: usePlatform ? platformIntegration.deleteColumn (serwerowe deleteField) : useTableSchema.ts deleteColumn)',
  },
  {
    id: 'table.row.edit',
    label: { pl: 'Edytuj', en: 'Edit' },
    icon: 'Pencil',
    scope: 'table_row',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableRowEditCallback(ctx),
    // Otwiera panel edycji (RecordExpandModal w trybie platform, RowDetailPanel
    // w trybie legacy) — sama akcja NIE zmienia żadnych danych, edycja komórek
    // dzieje się wewnątrz panelu, poza tym wpisem.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel edycji wskazanego wiersza Tabeli (zakładka "Właściwości"). Podaj `rowId` wiersza.',
      parameters: {
        type: 'object',
        properties: {
          rowId: { type: 'string', description: 'Id wiersza Tabeli do otwarcia.' },
        },
        required: ['rowId'],
      },
    },
    runtime: RUNTIME_TBL_ROW_EDIT,
    source:
      'src/components/MyWork/IdeaTableTool.tsx openRowEditPanel (~L977, wołane z rowContextMenu "table.row.edit" ~L4081 i tbl_row_edit w useTableQuickActions.ts)',
  },
  {
    id: 'table.row.note',
    label: { pl: 'Dodaj notatkę', en: 'Add note' },
    icon: 'MessageSquare',
    scope: 'table_row',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableRowNoteCallback(ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        // Celowe: RecordExpandModal (cel "Edit" w trybie platform) nie ma wątku
        // komentarzy — ta akcja ZAWSZE otwiera RowDetailPanel, zakładkę
        // "Komentarze", nawet gdy Tabela jest w trybie platform (patrz
        // komentarz przy `openRowNotePanel` w IdeaTableTool.tsx). Nie zmieniaj
        // tego routingu bez porozumienia z właścicielem — to świadoma decyzja
        // istniejącego kodu, nie luka do naprawy.
        'Otwiera panel wskazanego wiersza Tabeli na zakładce "Komentarze" — ZAWSZE ten sam panel, niezależnie od trybu Tabeli (nawet w trybie platform, gdzie "Edytuj" otwiera inny, mniejszy modal bez komentarzy). Podaj `rowId` wiersza.',
      parameters: {
        type: 'object',
        properties: {
          rowId: { type: 'string', description: 'Id wiersza Tabeli do otwarcia.' },
        },
        required: ['rowId'],
      },
    },
    runtime: RUNTIME_TBL_ROW_NOTE,
    source:
      'src/components/MyWork/IdeaTableTool.tsx openRowNotePanel (~L982, wołane z rowContextMenu "table.row.note" ~L4034 i tbl_row_note w useTableQuickActions.ts)',
  },
  {
    id: 'table.row.duplicate',
    label: { pl: 'Duplikuj wiersz', en: 'Duplicate row' },
    icon: 'Copy',
    scope: 'table_row',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableRowDuplicateCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'CZĘŚCIOWE (odkryte przy tym wpisie, nie naprawiane tu): `effectiveHandleDuplicateRow` (IdeaTableTool.tsx:514-516) branchuje na `usePlatform`. Legacy: useTableRows.ts handleDuplicateRow:257-284 → nodesUndo.push() (realny stos Ctrl+Z). Platform (usePlatform=true, K1/Airtable parity): useTablePlatformIntegration.ts handleDuplicateRow:457-490 woła bridge.createRecord (serwer) i NIGDY nie trafia na nodesUndo ani żaden inny stos — duplikacja w trybie platform jest DZIŚ NIEODWRACALNA z UI (usuń ręcznie nowy wiersz). Ta sama luka istnieje już dla kliku człowieka (nie wprowadzona tym wpisem) — udokumentowana tu po raz pierwszy.',
    },
    teresa: {
      description:
        'Duplikuje wskazany wiersz Tabeli. Podaj `rowId` wiersza źródłowego. UWAGA: gdy Tabela jest zablokowana (locked), operacja po cichu nic nie zrobi — dokładnie tak samo jak klik człowieka na tej pozycji menu (przedistniejąca luka, niedotknięta tym wpisem). Sufiks "(copy)" w etykiecie pojawia się TYLKO w trybie legacy; w trybie platform pokazuje się na moment na wierszu tymczasowym, a po odpowiedzi serwera znika (`bridge.createRecord` dostaje surowe `source.data` bez sufiksu — useTablePlatformIntegration.ts:479) — przedistniejące zachowanie, nie wprowadzone tym wpisem. W trybie platform duplikat NIE trafia na stos cofania (patrz undo.evidence).',
      parameters: {
        type: 'object',
        properties: {
          rowId: { type: 'string', description: 'Id wiersza Tabeli do zduplikowania.' },
        },
        required: ['rowId'],
      },
    },
    runtime: RUNTIME_TBL_ROW_DUPLICATE,
    source:
      'src/components/MyWork/IdeaTableTool.tsx rowContextMenu "table.row.duplicate" (~L4038) → effectiveHandleDuplicateRow (~L514-516) → useTableRows.ts:257 (legacy) / useTablePlatformIntegration.ts:457 (platform)',
  },
  {
    id: 'table.row.delete',
    label: { pl: 'Usuń wiersz', en: 'Delete row' },
    icon: 'Trash2',
    scope: 'table_row',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableRowDeleteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'local_stack',
      evidence:
        'CZĘŚCIOWE (odkryte przy tym wpisie, nie naprawiane tu): `effectiveHandleDeleteRow` (IdeaTableTool.tsx:511-513) branchuje na `usePlatform`. Legacy: useTableRows.ts handleDeleteRow:236-253 → nodesUndo.push() (realny stos Ctrl+Z). Platform (usePlatform=true, K1/Airtable parity): useTablePlatformIntegration.ts handleDeleteRow:493-512 woła bridge.deleteRecord (serwer) i NIGDY nie trafia na nodesUndo ani żaden inny stos — usunięcie w trybie platform jest DZIŚ NIEODWRACALNE z UI. Ta sama luka istnieje już dla kliku człowieka (nie wprowadzona tym wpisem) — udokumentowana tu po raz pierwszy.',
    },
    teresa: {
      description:
        'Usuwa wskazany wiersz Tabeli. Podaj `rowId` wiersza. UWAGA: gdy Tabela jest zablokowana (locked), operacja po cichu nic nie zrobi — dokładnie tak samo jak klik człowieka na tej pozycji menu (przedistniejąca luka, niedotknięta tym wpisem). W trybie platform usunięcie jest NIEODWRACALNE (patrz undo.evidence) — w legacy trybie cofniesz przez Ctrl+Z w tej samej sesji.',
      parameters: {
        type: 'object',
        properties: {
          rowId: { type: 'string', description: 'Id wiersza Tabeli do usunięcia.' },
        },
        required: ['rowId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_TBL_ROW_DELETE,
    source:
      'src/components/MyWork/IdeaTableTool.tsx rowContextMenu "table.row.delete" (~L4046) → effectiveHandleDeleteRow (~L511-513) → useTableRows.ts:236 (legacy) / useTablePlatformIntegration.ts:493 (platform)',
  },
  {
    // NOWY wpis (2026-08-10, reconciliacja skrótów) — `useTableKeyboard.ts`'s
    // `onDelete` (Delete/Backspace, poza polem edycji) woła `_bulkDel`
    // (`effectiveHandleBulkDelete`/`handleBulkDelete`) — usuwa WSZYSTKIE DZIŚ
    // ZAZNACZONE wiersze, NIE jeden wiersz po `rowId` jak `table.row.delete`
    // wyżej (menu prawego kliku). ŚWIADOMIE osobny id, nie reużycie
    // `table.row.delete` — inny mechanizm (bulk vs single-row-by-id), tak jak
    // `idea.node.delete` (Tablica/Przepływ) ma odrębny scope od
    // `table_row`-scoped wpisów. `'toolbar'` dopisane (N10, 2026-08-10):
    // `TableToolbar.tsx`'s przycisk „Usuń" (bulk actions, ~L1249) woła
    // `handleBulkDelete` Z `useTableData()` = `integration.handleBulkDelete`
    // = `platformIntegration.handleBulkDelete` — TableToolbar.tsx renderuje
    // się WYŁĄCZNIE gdy `usePlatform` jest `true` (patrz `IdeaTableTool.tsx`
    // ~L2242), więc `_bulkDel` (`effectiveHandleBulkDelete`, ten sam warunek)
    // wskazuje na TĘ SAMĄ funkcję — ZWERYFIKOWANE (nie zgadywane, obie
    // referencje prześledzone do jednej instancji `platformIntegration`),
    // wcześniejsza obawa w tym komentarzu (przycisk „NIE robi tego samego co
    // klawiatura") była błędna dla trybu platform — jedynego, w którym ten
    // przycisk w ogóle się renderuje.
    id: 'table.rows.bulk_delete',
    label: { pl: 'Usuń zaznaczone wiersze', en: 'Delete selected rows' },
    icon: 'Trash2',
    scope: 'selected_items',
    tools: ['table'],
    surfaces: ['keyboard', 'toolbar'],
    shortcut: 'Del',
    handler: (ctx) => runTableToolbarOrKeyboardCallback('table.rows.bulk_delete', ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'local_stack',
      evidence:
        'CZĘŚCIOWE (ta sama luka co `table.row.delete` wyżej): legacy `handleBulkDelete` → nodesUndo.push() (stos Ctrl+Z); platform `effectiveHandleBulkDelete`/`ctx.handleBulkDelete` → bridge, BEZ stosu cofania.',
    },
    teresa: {
      description:
        'Usuwa WSZYSTKIE dziś zaznaczone wiersze Tabeli (nie pojedynczy `rowId` — patrz `table.row.delete` dla usunięcia jednego wiersza). Dziś dostępne WYŁĄCZNIE z klawiatury lub górnego paska narzędzi Tabeli — Teresa tego jeszcze nie wywoła (operuje na zaznaczeniu w przeglądarce, nie na jawnym parametrze).',
    },
    source:
      'src/components/MyWork/IdeaTableTool.tsx onDelete (~L1710, useTableKeyboard) → _bulkDel + TableToolbar.tsx bulk-actions "Usuń" (~L1249, N10 2026-08-10)',
  },
  {
    // NOWY wpis (2026-08-10, reconciliacja skrótów) — `useTableKeyboard.ts`'s
    // `onSave` (Ctrl/Cmd+S) woła `_save` (`effectiveHandleSave`/`handleSave`,
    // branchuje na `usePlatform`, ~L680). `'toolbar'` dopisane (N10,
    // 2026-08-10): `TableToolbar.tsx`'s przycisk „Zapisz" (~L1303) woła
    // `handleSave` z `useTableData()` = `integration.handleSave` =
    // `platformIntegration.handleSave` — ta sama funkcja co `_save`, bo
    // TableToolbar.tsx renderuje się wyłącznie gdy `usePlatform` jest
    // `true` (zweryfikowane jak przy `table.rows.bulk_delete` wyżej).
    id: 'idea.canvas.tbl_save',
    label: { pl: 'Zapisz', en: 'Save' },
    icon: 'Save',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['keyboard', 'toolbar'],
    shortcut: '⌘S',
    handler: (ctx) => runTableToolbarOrKeyboardCallback('idea.canvas.tbl_save', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Zapisuje bieżący stan Tabeli natychmiast (poza automatycznym zapisem w tle). Dziś dostępne WYŁĄCZNIE z klawiatury lub górnego paska narzędzi Tabeli — Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/IdeaTableTool.tsx onSave (~L1718, useTableKeyboard) → _save + TableToolbar.tsx przycisk "Zapisz" (N10, 2026-08-10)',
  },
  {
    // NOWY wpis (2026-08-10, reconciliacja skrótów) — `useTableKeyboard.ts`'s
    // `onAddRow` (Ctrl/Cmd+N) woła `_addRow` (`effectiveHandleAddRow`/
    // `handleAddRow`, branchuje na `usePlatform`, ~L674). ŚWIADOMIE osobny id
    // od `idea.element.add` (runtime `tbl_add_row` dla Tabeli) — SPRAWDZONE:
    // `idea.element.add`'s handler (`runByTool`) NIGDY nie sprawdza
    // `ctx.params.run` (zawsze dispatchuje na szynę), a odbiornik
    // `tbl_add_row` woła `handlers.handleAddRow` — bez pewności, że to TA SAMA
    // funkcja co platform-aware `_addRow` (nie zweryfikowano do końca w
    // czasie tej reconciliacji), więc reużycie byłoby ryzykiem zmiany
    // zachowania w trybie platform. `'toolbar'` dopisane (N10, 2026-08-10):
    // `TableToolbar.tsx`'s zwykły przycisk „Row" (~L1276, NIE chevron
    // "z szablonu" — patrz `idea.view.table_add_row_with_template` niżej dla
    // TEGO) woła `handleAddRow()` z `useTableData()` =
    // `integration.handleAddRow` = `platformIntegration.handleAddRow` — ta
    // sama funkcja co `_addRow` w trybie platform (jedynym, w którym
    // `TableToolbar.tsx` się renderuje).
    id: 'table.rows.add_row',
    label: { pl: 'Dodaj wiersz', en: 'Add row' },
    icon: 'Plus',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['keyboard', 'toolbar'],
    shortcut: '⌘N',
    handler: (ctx) => runTableToolbarOrKeyboardCallback('table.rows.add_row', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'CZĘŚCIOWE (ta sama luka co `table.row.delete`): legacy `handleAddRow` → nodesUndo.push(); platform `effectiveHandleAddRow`/`ctx.handleAddRow` → bridge, BEZ stosu cofania.',
    },
    teresa: {
      description:
        'Dodaje nowy, pusty wiersz do otwartej Tabeli. Dziś dostępne WYŁĄCZNIE z klawiatury lub górnego paska narzędzi Tabeli — Teresa tego jeszcze nie wywoła (dla Teresy istnieje `idea.element.add`, ale to OSOBNA ścieżka wykonania — patrz komentarz przy tym wpisie).',
    },
    source:
      'src/components/MyWork/IdeaTableTool.tsx onAddRow (~L1719, useTableKeyboard) → _addRow + TableToolbar.tsx przycisk "Row" (N10, 2026-08-10)',
  },
  {
    id: 'idea.cell.copy',
    label: { pl: 'Kopiuj wartość', en: 'Copy value' },
    icon: 'ClipboardCopy',
    scope: 'table_cell',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableCellUiOnlyCallback('idea.cell.copy', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        // TA SAMA klasa ograniczenia co Tablicy `idea.node.copy` (WB-CLIPBOARD-01):
        // kopiuje WARTOŚĆ komórki jako goły TEKST do schowka SYSTEMOWEGO
        // (obiekty przez JSON.stringify) — nie jest to kopia struktury komórki
        // (typ kolumny/formatowanie), a `idea.cell.paste` niżej czyta ten sam
        // schowek jako tekst, bez odtwarzania typu. Różnica od WB-CLIPBOARD-01:
        // etykieta menu TU już jest uczciwa ("Kopiuj wartość", nie "Kopiuj"
        // sugerujące pełny obiekt) — potwierdzone, nie po cichu zignorowane.
        'Kopiuje wartość wskazanej komórki Tabeli do schowka systemowego jako TEKST (obiekty jako JSON.stringify) — to nie jest kopia typu/formatowania komórki. Dostępne tylko z menu prawego kliku — schowek systemowy to API przeglądarki użytkownika, bez odpowiednika po stronie czatu.',
    },
    source:
      'src/components/MyWork/IdeaTableTool.tsx cellContextMenu "table.cell.copy" (~L4102-4113)',
  },
  {
    // N-inventory-b-medium (2026-08-10). Inventory flagged
    // `ChatToSchemaPanel.tsx:707` (`handleSubmit`) as a LOWER-CONFIDENCE
    // class-b judgment call ("worth an explicit decision by the epic owner"),
    // analogized (without verification) to `idea.ai.table_assistant`'s
    // open-panel precedent. Fail-closed re-analysis: `handleSubmit` is NOT a
    // free-form chat turn like AICopilotMode's `handleSend` (declined below,
    // see its own comment) — it calls `useSchemaProposal.ts`'s
    // `generateProposal`/`refineProposal` → `TablePlatformApi.
    // generateSchemaProposal`/`refineSchemaProposal`, a REAL server call that
    // creates a persisted, addressable schema-CHANGE PROPOSAL object (with
    // its own lifecycle: refine/execute/reject/undo/redo — `SchemaDiffPreview`
    // is a literal preview component). This is structurally the SAME shape as
    // the canon's own worked Z4 example (`02_REJESTR_AKCJI.md` §"Z4 w
    // praktyce": "Wypełnij puste komórki w kolumnie Koszt" →
    // `table.ai_fill`) — a discrete, addressable "ask AI to propose a change"
    // command, not incidental panel chrome. `mutates: false` here follows the
    // SAME established convention as `idea.ai.table_assistant`/
    // `idea.ai.table_categorize` above (the trigger opens/requests a
    // proposal; the proposal's OWN execute step is the real mutation, not
    // registered by this fix — separate, pre-existing gap, out of scope).
    // UI-only (not yet Teresa-reachable): `existingSchema`/`companyContext`
    // live as local component state with no bus/ActionContext carrier today
    // — making this genuinely Teresa-callable needs new plumbing, honestly
    // declined rather than faked.
    id: 'idea.ai.table_schema_propose',
    label: { pl: 'AI: zaproponuj schemat', en: 'AI: propose schema' },
    icon: 'Sparkles',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableChatToSchemaProposeCallback(ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Prosi AI o propozycję zmiany schematu Tabeli (kolumny) na podstawie opisu w języku naturalnym w panelu Chat-to-Schema — tworzy PROPOZYCJĘ (diff) do osobnego zatwierdzenia, nie zmienia schematu od razu. Dziś dostępne WYŁĄCZNIE z otwartego panelu Chat-to-Schema — Teresa tego jeszcze nie wywoła (brak nośnika dla `existingSchema`/kontekstu firmy poza lokalnym stanem panelu).',
    },
    source:
      'src/components/MyWork/table/ChatToSchemaPanel.tsx handleSubmit (~L396-420, Send button ~L707 + Enter-to-send ~L693) → useSchemaProposal.ts generateProposal/refineProposal → TablePlatformApi.generateSchemaProposal/refineSchemaProposal',
  },
  {
    id: 'idea.cell.paste',
    label: { pl: 'Wklej', en: 'Paste' },
    icon: 'Clipboard',
    scope: 'table_cell',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableCellUiOnlyCallback('idea.cell.paste', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'Ścieżka legacy (`usePlatform=false`, dzisiejszy klik człowieka gdy Tabela nie jest platformowa): `_fieldChange` → `handleFieldChange` (`useTableRows.ts:156-171`) → `nodesUndo.push(next)` — REALNE cofnięcie (Ctrl+Z). Ścieżka platform (`usePlatform=true`): `_fieldChange` → `platformIntegration.handleFieldChange` (`useTablePlatformIntegration.ts:392-412`) — async zapis na serwer, rewert TYLKO gdy zapis się nie powiedzie, nigdy na Ctrl+Z — BRAK stosu cofania. Ten sam dualizm co `idea.cell.clear` niżej i już udokumentowany w N8 dla widoków zapisanych.',
    },
    teresa: {
      description:
        'Wkleja zawartość schowka SYSTEMOWEGO do wskazanej komórki Tabeli jako TEKST (bez parsowania do typu kolumny). Dziś dostępne WYŁĄCZNIE z menu prawego kliku — `navigator.clipboard.readText()` czyta schowek przeglądarki UŻYTKOWNIKA, bez sensownego odpowiednika po stronie czatu.',
    },
    source:
      'src/components/MyWork/IdeaTableTool.tsx cellContextMenu "table.cell.paste" (~L4115-4134) → _fieldChange',
  },
  {
    id: 'idea.cell.expand',
    label: { pl: 'Rozwiń komórkę', en: 'Expand cell' },
    icon: 'Maximize',
    scope: 'table_cell',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableCellUiOnlyCallback('idea.cell.expand', ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera duży edytor wartości wskazanej komórki Tabeli (`CellExpandPopover`) — popover jest zakotwiczony w pozycji kliknięcia na ekranie (`DOMRect` przekazywany do `handleCellExpand`). Dziś dostępne WYŁĄCZNIE z menu prawego kliku — nie ma dziś sensownego miejsca na ekranie do zakotwiczenia popovera przy wywołaniu z czatu; wymyślanie sztywnej domyślnej pozycji byłoby zgadywaniem zdolności, nie realnym wejściem.',
    },
    source:
      'src/components/MyWork/IdeaTableTool.tsx cellContextMenu "table.cell.expand" (~L4136-4150) → handleCellExpand → CellExpandPopover (~L4264-4298)',
  },
  {
    id: 'idea.cell.clear',
    label: { pl: 'Wyczyść komórkę', en: 'Clear cell' },
    icon: 'Trash2',
    scope: 'table_cell',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTableCellClearCallback(ctx),
    mutates: true,
    requiresPreview: false,
    // Trwałe (w ramach sesji) wyczyszczenie wartości — ta sama logika co
    // `idea.edge.delete`: `destructive` osobno od `undo`/`mutates`, bo undo
    // ISTNIEJE (Ctrl+Z) na ścieżce legacy, ale wpis i tak trwale nadpisuje
    // dane widoczne na ekranie do czasu cofnięcia. Klik człowieka też nie
    // pyta o potwierdzenie (menu ma tylko `danger: true`, kolor, bez dialogu)
    // — stąd brak `confirmBeforeRun` niżej, zgodnie z tym samym precedensem.
    destructive: true,
    undo: {
      kind: 'local_stack',
      evidence:
        'Ścieżka legacy (`usePlatform=false`): `_fieldChange(rowId, colKey, \'\')` → `handleFieldChange` (`useTableRows.ts:156-171`) → `nodesUndo.push(next)` — REALNE cofnięcie (Ctrl+Z). Ścieżka platform (`usePlatform=true`): `_fieldChange` → `platformIntegration.handleFieldChange` (`useTablePlatformIntegration.ts:392-412`) — async zapis na serwer, rewert lokalny TYLKO przy błędzie zapisu, nigdy na Ctrl+Z — BRAK stosu cofania. Klik człowieka w obu trybach idzie przez ten sam `_fieldChange`, więc ta asymetria dotyczy DZIŚ już istniejącego kliku, nie tylko tej nowej ścieżki Teresy — udokumentowane, nie naprawiane tym wpisem (wielu wywołujących `platformIntegration.handleFieldChange`, ryzykowne do cichej zmiany).',
    },
    teresa: {
      description:
        'Czyści wartość wskazanej komórki Tabeli (ustawia puste pole). Podaj `rowId` wiersza i `colKey` kolumny. Nie działa na kolumnach pochodnych ("type", formuła) — te są tylko do odczytu, tak samo jak z menu prawego kliku (tam pozycja jest wtedy wyszarzona).',
      parameters: {
        type: 'object',
        properties: {
          rowId: { type: 'string', description: 'Id wiersza (rekordu) Tabeli.' },
          colKey: { type: 'string', description: 'Klucz kolumny komórki do wyczyszczenia.' },
        },
        required: ['rowId', 'colKey'],
      },
    },
    source:
      'src/components/MyWork/IdeaTableTool.tsx cellContextMenu "table.cell.clear" (~L4152-4172) → _fieldChange(rowId, colKey, \'\')',
  },
  {
    id: 'idea.view.table_apply_view',
    label: { pl: 'Przełącz widok', en: 'Switch view' },
    icon: 'Layers',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) => runTableToolbarUiOnlyCallback('idea.view.table_apply_view', ctx),
    // Przełącza WYŁĄCZNIE zaznaczenie zakładki (activeViewId) i lokalny stan
    // widoku (sort/filters/groupBy/layout z zapisanego widoku) — nie zmienia
    // ŻADNYCH danych wierszy/kolumn.
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Przełącza Tabelę na wskazany zapisany widok (zakładka nad tabelą) — zmienia sortowanie/filtry/grupowanie/układ na te zapisane w widoku, bez zmiany danych. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi Tabeli (widok platformowy) — Teresa tego jeszcze nie wywoła (odbiornik wymagałby dopisania, poza zakresem tej zmiany).',
    },
    source: 'src/components/MyWork/table/TableToolbar.tsx zakładka widoku onClick (~L429) → applyView(v)',
  },
  {
    id: 'idea.view.table_save_view',
    label: { pl: 'Zapisz nowy widok', en: 'Save new view' },
    icon: 'Save',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) => runTableToolbarUiOnlyCallback('idea.view.table_save_view', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Tworzy NOWY zapisany widok (`ctx.saveCurrentView` = `platformIntegration.saveCurrentView`, realny, asynchroniczny zapis serwerowy) — brak automatycznego cofnięcia; odzyskanie to ręczne usunięcie widoku (patrz `idea.view.table_platform_saved_view_delete`), dokładnie definicja `manual_delete`.',
    },
    teresa: {
      description:
        'Zapisuje BIEŻĄCY stan Tabeli (sortowanie/filtry/grupowanie/układ/kolumny) jako NOWY, nazwany widok. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi Tabeli — Teresa tego jeszcze nie wywoła (wymagałby migawki stanu, patrz `idea.view.table_platform_saved_view_update` niżej dla tej samej luki).',
    },
    source:
      'src/components/MyWork/table/TableToolbar.tsx przycisk "Zapisz widok" → dialog → handleSaveView (~L283-289, ~L492) → saveCurrentView',
  },
  {
    // Realny odbiornik Teresy — patrz `RUNTIME_TBL_VIEW_RENAME_PLATFORM` i
    // `runTablePlatformSavedViewRenameCallback` powyżej dla pełnego
    // uzasadnienia (INNY mechanizm niż `idea.view.saved_view_rename`, który
    // woła WYŁĄCZNIE legacy `useTableViews.ts`).
    id: 'idea.view.table_platform_saved_view_rename',
    label: { pl: 'Zmień nazwę', en: 'Rename' },
    icon: 'Pencil',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTablePlatformSavedViewRenameCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`ctx.updateSavedView` (`platformIntegration.updateSavedView`, `useTablePlatformViews.ts`) to realny, asynchroniczny zapis serwerowy bez historii wersji — NADPISUJE nazwę istniejącego widoku (nie tworzy nowego obiektu, więc `manual_delete` nie pasuje: nie ma czego skasować, poprzednia nazwa po prostu ginie). Brak cofnięcia, ani dla kliku człowieka, ani dla tej ścieżki Teresy — uczciwie przyznana luka.',
    },
    teresa: {
      description:
        'Zmienia nazwę zapisanego widoku Tabeli (widok platformowy). Podaj `viewId` widoku i nową `name`. Nie działa na widoku domyślnym.',
      parameters: {
        type: 'object',
        properties: {
          viewId: { type: 'string', description: 'Id zapisanego widoku Tabeli.' },
          name: { type: 'string', description: 'Nowa nazwa widoku.' },
        },
        required: ['viewId', 'name'],
      },
    },
    runtime: RUNTIME_TBL_VIEW_RENAME_PLATFORM,
    source:
      'src/components/MyWork/table/TableToolbar.tsx viewContextMenu "Rename" (~L510-522) → ctx.updateSavedView (platformIntegration.updateSavedView)',
  },
  {
    id: 'idea.view.table_platform_saved_view_update',
    label: { pl: 'Aktualizuj', en: 'Update' },
    icon: 'Save',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) => runTableToolbarUiOnlyCallback('idea.view.table_platform_saved_view_update', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`ctx.updateSavedView` (jak wyżej) nadpisuje sort/filters/groupBy/layout/columns ISTNIEJĄCEGO zapisanego widoku BIEŻĄCYM stanem platformy — realny, asynchroniczny zapis serwerowy, poprzednia konfiguracja widoku ginie bezpowrotnie, bez cofnięcia.',
    },
    teresa: {
      description:
        'Nadpisuje zapisany widok Tabeli (platformowy) bieżącym stanem tabeli. Dziś dostępne WYŁĄCZNIE z menu prawego kliku Tabeli — wymaga migawki bieżącego stanu widoku platformy (sort/filters/groupBy/layout/columns z `platformIntegration`), dziś nieprzekazanej do odbiornika Teresy — Teresa tego jeszcze nie wywoła.',
    },
    source:
      'src/components/MyWork/table/TableToolbar.tsx viewContextMenu "Update" (~L523-542) → ctx.updateSavedView (platformIntegration.updateSavedView)',
  },
  {
    id: 'idea.view.table_platform_saved_view_delete',
    label: { pl: 'Usuń', en: 'Delete' },
    icon: 'Trash2',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['context'],
    handler: (ctx) => runTablePlatformSavedViewDeleteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`ctx.deleteSavedView` (`platformIntegration.deleteSavedView`) to realne, nieodwracalne serwerowe usunięcie widoku — efektem jest ZNIKNIĘCIE obiektu, nie powstanie nowego (odwrotność `manual_delete`, więc ten kind nie pasuje). Brak cofnięcia, ani dla kliku człowieka, ani dla tej ścieżki Teresy.',
    },
    teresa: {
      description:
        'Usuwa zapisany widok Tabeli (widok platformowy) na trwałe. Podaj `viewId` widoku do usunięcia. Nie działa na widoku domyślnym.',
      parameters: {
        type: 'object',
        properties: {
          viewId: { type: 'string', description: 'Id zapisanego widoku Tabeli do usunięcia.' },
        },
        required: ['viewId'],
      },
      confirmBeforeRun: true,
    },
    runtime: RUNTIME_TBL_VIEW_DELETE_PLATFORM,
    source:
      'src/components/MyWork/table/TableToolbar.tsx viewContextMenu "Delete" (~L543-552) → ctx.deleteSavedView (platformIntegration.deleteSavedView)',
  },
  {
    // ★ ZNALEZISKO (2026-08-10, przy okazji tego zadania, NIE naprawiane tu —
    // dokładnie ta sama klasa co defekt kolumn naprawiony 2026-08-10 przed
    // Programem B: usePlatform ignorowany → mutacja martwego stanu + kłamliwy
    // toast sukcesu). `props.onBulkConvert` (`TableToolbar.tsx` bulk-actions
    // "Convert" menu, ~L1235) woła `handleBulkConvert` (`IdeaTableTool.tsx`
    // ~L1326-1364) BEZPOŚREDNIO — ta funkcja NIE branchuje na `usePlatform`
    // (brak `effective`/`_` odpowiednika, jedyna wersja w całym pliku), czyta
    // i pisze WYŁĄCZNIE legacy `nodes`/`nodesUndo`/`selectedRowIds`/
    // `setSelectedRowIds`. `TableToolbar.tsx` renderuje się WYŁĄCZNIE gdy
    // `usePlatform` jest `true` — więc dziś w trybie platform ten przycisk:
    // (a) czyta `selectedRowIds.size` z LEGACY Setu, prawie na pewno 0 lub
    // nieaktualne wobec realnie zaznaczonych wierszy platformy
    // (`platformIntegration.selectedRowIds`), (b) `nodesUndo.push(next)`
    // mutuje LEGACY `nodes` — niewidoczne na ekranie (platform renderuje
    // `platformIntegration.processedRows`), (c) `toast.success("Converted
    // {{count}} rows…")` melduje sukces policzony z (a) — KŁAMLIWY toast nad
    // martwym stanem. Ten wpis WIĄŻE przycisk z rejestrem 1:1 (zero zmiany
    // zachowania — `ctx.params.run` woła dokładnie `props.onBulkConvert`),
    // ale ŚWIADOMIE zostaje UI-only i NIE dostaje realnego odbiornika Teresy,
    // żeby nie rozszerzać tego samego zepsutego mechanizmu na czat. Naprawa
    // wymaga platform-aware odpowiednika `handleBulkConvert` — poza zakresem
    // tego zadania (wykracza poza `TableToolbar.tsx`).
    id: 'idea.workspace.table_bulk_convert',
    label: { pl: 'Konwertuj zaznaczone wiersze', en: 'Convert selected rows' },
    icon: 'ArrowRight',
    scope: 'selected_items',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) => runTableToolbarUiOnlyCallback('idea.workspace.table_bulk_convert', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'local_stack',
      evidence:
        'ZNALEZISKO (nie naprawiane tu, patrz komentarz powyżej): `handleBulkConvert` NIE branchuje na `usePlatform` — w trybie platform (jedynym, w którym ten przycisk się renderuje) mutuje LEGACY `nodes`/`nodesUndo`, martwy stan niewidoczny na ekranie; `nodesUndo.push` istnieje, ale na stosie, którego platform i tak nie odczytuje przy renderze.',
    },
    teresa: {
      description:
        'Oznacza dziś zaznaczone wiersze Tabeli jako przekształcone w inicjatywę/zadanie/decyzję. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi Tabeli — Teresa tego jeszcze nie wywoła (ZNANY defekt: w trybie platformowym ten mechanizm operuje na nieaktualnym zaznaczeniu i niewidocznym stanie — patrz kod źródłowy — świadomie nie dajemy Teresie dostępu do zepsutej ścieżki).',
    },
    source:
      'src/components/MyWork/table/TableToolbar.tsx bulk-actions "Convert" (~L1220-1248) → props.onBulkConvert → IdeaTableTool.tsx handleBulkConvert (~L1326-1364, NIE usePlatform-aware)',
  },
  {
    // ★ DRUGIE ZNALEZISKO tej samej klasy (2026-08-10). `props.onAddRowWithTemplate`
    // (`TableToolbar.tsx` chevron obok "Row", ~L1284) woła
    // `handleAddRowWithTemplate` (`useTableRows.ts:205-214`, LEGACY hook, BEZ
    // `usePlatform`-branchowanego odpowiednika) → otwiera `RowTemplatePicker`
    // → wybór szablonu woła `handleTemplateSelect` (`useTableRows.ts:216-224`,
    // TAKŻE legacy, `IdeaTableTool.tsx`'s `RowTemplatePicker onSelect` ~L4429
    // woła ją BEZPOŚREDNIO, bez `effective`/dual-path). W trybie platform
    // (jedynym, w którym ten przycisk w `TableToolbar.tsx` się renderuje)
    // wybranie szablonu robi `nodesUndo.push([...nodes, newNode])` na LEGACY
        // `nodes` — nowy wiersz NIE POJAWIA SIĘ na ekranie (platform renderuje
    // `platformIntegration.processedRows`), bez toastu błędu (cichy no-op z
    // perspektywy użytkownika, gorsze niż kłamliwy toast — brak JAKIEGOKOLWIEK
    // feedbacku). Ten wpis WIĄŻE przycisk-wyzwalacz (otwarcie pickera) z
    // rejestrem 1:1, bez zmiany zachowania; naprawa (platform-aware
    // `handleTemplateSelect`) wymaga zmian w `IdeaTableTool.tsx`/`useTableRows.ts`
    // poza zakresem tego zadania.
    id: 'idea.view.table_add_row_with_template',
    label: { pl: 'Dodaj wiersz z szablonu', en: 'Add row from template' },
    icon: 'LayoutTemplate',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) => runTableToolbarUiOnlyCallback('idea.view.table_add_row_with_template', ctx),
    // Sam ten wpis tylko OTWIERA picker (`ctx.params.run` = `props.onAddRowWithTemplate`);
    // realna mutacja (dodanie wiersza) dzieje się dopiero po wyborze szablonu
    // w `RowTemplatePicker`, poza tym wpisem — stąd `mutates: false` tutaj,
    // zgodnie z konwencją `idea.ai.table_assistant` (akcja otwiera narzędzie,
    // mutacja jest w jego wnętrzu).
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera wybór szablonu do dodania nowego wiersza Tabeli. Dziś dostępne WYŁĄCZNIE z górnego paska narzędzi Tabeli — Teresa tego jeszcze nie wywoła (ZNANY defekt: w trybie platformowym wybór szablonu dziś cicho nie dodaje wiersza na ekranie — patrz kod źródłowy — świadomie nie dajemy Teresie dostępu do zepsutej ścieżki).',
    },
    source:
      'src/components/MyWork/table/TableToolbar.tsx chevron "Add from template" (~L1283-1289) → props.onAddRowWithTemplate → IdeaTableTool.tsx handleAddRowWithTemplate (useTableRows.ts:205, NIE usePlatform-aware) → RowTemplatePicker onSelect → handleTemplateSelect (useTableRows.ts:216, NIE usePlatform-aware)',
  },
  {
    id: 'idea.view.table_scoring',
    label: { pl: 'Model scoringowy', en: 'Scoring model' },
    icon: 'Trophy',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    // ZWERYFIKOWANE PRZED wpisem: `props.onShowScoringModel` (More/Mobile
    // menu) i odbiornik `tbl_scoring` (dziś sierocy, zero nadawców) wołają
    // DOKŁADNIE ten sam `setShowScoringModel` (`IdeaTableTool.tsx`).
    handler: (ctx) => runToolbarBusAction('idea.view.table_scoring', RUNTIME_TBL_SCORING, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Otwiera model scoringowy Tabeli — ocena i rankowanie wierszy wg wag kryteriów.',
    },
    runtime: RUNTIME_TBL_SCORING,
    source:
      'src/components/MyWork/table/TableToolbar.tsx More/Mobile menu "Scoring Model" → props.onShowScoringModel + useTableQuickActions.ts tbl_scoring (sierocy przed tą zmianą)',
  },
  {
    id: 'idea.view.table_export_presentation',
    label: { pl: 'Eksportuj do prezentacji', en: 'Export to presentation' },
    icon: 'Presentation',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) =>
      runToolbarBusAction('idea.view.table_export_presentation', RUNTIME_TBL_EXPORT_PPTX, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Otwiera eksport zawartości Tabeli do prezentacji.',
    },
    runtime: RUNTIME_TBL_EXPORT_PPTX,
    source:
      'src/components/MyWork/table/TableToolbar.tsx More/Mobile menu "Export to Presentation" → props.onShowExportPresentation + useTableQuickActions.ts tbl_export_pptx (sierocy przed tą zmianą)',
  },
  {
    id: 'idea.view.table_pipeline',
    label: { pl: 'Pipeline pomysłu', en: 'Idea pipeline' },
    icon: 'Rocket',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.view.table_pipeline', RUNTIME_TBL_PIPELINE, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Otwiera widok pipeline\'u Tabeli (etapy/lejek pomysłów).',
    },
    runtime: RUNTIME_TBL_PIPELINE,
    source:
      'src/components/MyWork/table/TableToolbar.tsx More/Mobile menu "Idea Pipeline" → props.onShowPipeline + useTableQuickActions.ts tbl_pipeline (sierocy przed tą zmianą)',
  },
  {
    id: 'idea.ai.table_copilot',
    label: { pl: 'AI Copilot', en: 'AI Copilot' },
    icon: 'Brain',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.ai.table_copilot', RUNTIME_TBL_COPILOT, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Otwiera AI Copilota Tabeli — czat pomocniczy przy pracy na wierszach/kolumnach.',
    },
    runtime: RUNTIME_TBL_COPILOT,
    source:
      'src/components/MyWork/table/TableToolbar.tsx More/Mobile menu "AI Copilot" → props.onShowCopilot + useTableQuickActions.ts tbl_copilot (sierocy przed tą zmianą)',
  },
  {
    id: 'idea.view.table_voice_input',
    label: { pl: 'Głos / obraz', en: 'Voice / Image' },
    icon: 'Mic',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.view.table_voice_input', RUNTIME_TBL_VOICE, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Otwiera wprowadzanie danych do Tabeli głosem lub obrazem.',
    },
    runtime: RUNTIME_TBL_VOICE,
    source:
      'src/components/MyWork/table/TableToolbar.tsx More/Mobile menu "Voice / Image" → props.onShowVoiceInput + useTableQuickActions.ts tbl_voice (sierocy przed tą zmianą)',
  },
  {
    id: 'idea.view.table_cross_relations',
    label: { pl: 'Relacje międzytabelowe', en: 'Cross-table relations' },
    icon: 'Network',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) =>
      runToolbarBusAction('idea.view.table_cross_relations', RUNTIME_TBL_CROSS_RELATIONS, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description: 'Otwiera relacje między tą Tabelą a innymi tabelami.',
    },
    runtime: RUNTIME_TBL_CROSS_RELATIONS,
    source:
      'src/components/MyWork/table/TableToolbar.tsx More/Mobile menu "Cross-table Relations" → props.onShowCrossRelations + useTableQuickActions.ts tbl_cross_relations (sierocy przed tą zmianą)',
  },
  {
    // `tbl_heatmap` jest wyjątkiem w tej grupie: klik człowieka jest
    // PRZEŁĄCZNIKIEM (`props.onToggleHeatmap` = `() => setShowHeatmap((p) =>
    // !p)`), a odbiornik zawsze USTAWIA `true` (otwiera, nigdy nie zamyka).
    // `runToolbarBusAction` zachowuje to uczciwie: UI-klik woła oryginalny
    // toggle 1:1 (`ctx.params.run`), Teresa dostaje WYŁĄCZNIE „otwórz" —
    // udokumentowane w opisie niżej zamiast milczeć o asymetrii.
    id: 'idea.view.table_heatmap',
    label: { pl: 'Mapa cieplna', en: 'Heatmap' },
    icon: 'Flame',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.view.table_heatmap', RUNTIME_TBL_HEATMAP, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Otwiera panel mapy cieplnej Tabeli (podświetla wartości kolumn kolorem). Klik człowieka na tym przycisku PRZEŁĄCZA (otwiera/zamyka) — ta ścieżka Teresy WYŁĄCZNIE otwiera panel, nie potrafi go zamknąć.',
    },
    runtime: RUNTIME_TBL_HEATMAP,
    source:
      'src/components/MyWork/table/TableToolbar.tsx More/Mobile menu "Heatmap" → props.onToggleHeatmap + useTableQuickActions.ts tbl_heatmap (sierocy przed tą zmianą)',
  },
  {
    // Closure (2026-08-10) 04_ACTION_COVERAGE_INVENTORY.csv class-d:
    // IdeaTableTool.tsx:3372 (legacy `!guidedBar` inline toolbar button) —
    // trzecie niezależne miejsce wołające DOKŁADNIE `exportToCSV(_cols,
    // effectiveNodes)` + `downloadCSV(...)` (pozostałe dwa: data-menu
    // overflow item `export-csv` ~L2094 i `P15TableToolbar`'s `onExportCSV`
    // prop ~L2380 — poza zakresem tej zmiany, nie dotknięte). Realny,
    // file-producing eksport (docs/standards/idea-workspace/
    // 10_KONWERSJA_EKSPORT_IMPORT_SZABLONY.md §3/§8 `idea.export.table_csv`).
    // `tbl_export_csv` na szynie JUŻ ISTNIAŁ i działa (useTableQuickActions.ts
    // ~L285) — Teresie brakowało wyłącznie wpisu rejestru, nie mechanizmu.
    // ZASTRZEŻENIE (odkryte tu, nie naprawiane): `tbl_export_csv` czyta
    // `columns`/`nodes` z `UseTableQuickActionsOpts` — wersje LEGACY, NIE
    // `usePlatform`-świadome `_cols`/`effectiveNodes`, których używa klik
    // człowieka (patrz komentarz przy `QuickActionHandlers.fieldChange`
    // powyżej dla tego samego, wcześniej udokumentowanego rozjazdu). W trybie
    // platform Teresa eksportuje inny (legacy) zestaw danych niż to, co widzi
    // użytkownik na ekranie — PRAWDZIWA, PRZEDISTNIEJĄCA luka.
    id: 'idea.export.table_csv',
    label: { pl: 'Eksportuj CSV', en: 'Export CSV' },
    icon: 'Download',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) => runToolbarBusAction('idea.export.table_csv', RUNTIME_TBL_EXPORT_CSV, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Eksportuje bieżącą Tabelę do pliku CSV (widoczne kolumny/wiersze) — produkuje realny plik do pobrania. UWAGA: w trybie platformowym eksportuje legacy zestaw danych, nie zawsze identyczny z tym, co widać na ekranie (przedistniejąca luka, nie naprawiona tym wpisem).',
    },
    runtime: RUNTIME_TBL_EXPORT_CSV,
    source:
      'src/components/MyWork/IdeaTableTool.tsx:3372 (legacy inline toolbar button) + useTableQuickActions.ts tbl_export_csv (już istniał, sierocy przed tą zmianą)',
  },
  {
    // Closure (2026-08-10) 04_ACTION_COVERAGE_INVENTORY.csv class-d:
    // IdeaTableTool.tsx:3382 — analogiczny trzeci niezależny call site
    // `copyTableToClipboard(_cols, effectiveNodes)`. UCZCIWOŚĆ (rozdz. 10 §1
    // reguła rozstrzygająca): kopiowanie do schowka NIE tworzy pliku ani
    // trwałego rekordu poza Ideą — to NIE jest Eksport (mimo że UI umieszcza
    // ten przycisk zaraz obok „Export CSV" w tej samej grupie paska), więc
    // id świadomie NIE żyje w przestrzeni `idea.export.*`. `tbl_copy_clipboard`
    // to NOWE okablowanie (useTableQuickActions.ts, dodane razem z tym
    // wpisem) — mirror 1:1 mechanizmu `tbl_export_csv` powyżej, więc ten sam
    // zastrzeżony rozjazd legacy/platform dotyczy i tego wpisu.
    id: 'idea.table.copy_clipboard',
    label: { pl: 'Kopiuj tabelę do schowka', en: 'Copy table to clipboard' },
    icon: 'ClipboardCopy',
    scope: 'current_view',
    tools: ['table'],
    surfaces: ['toolbar'],
    handler: (ctx) =>
      runToolbarBusAction('idea.table.copy_clipboard', RUNTIME_TBL_COPY_CLIPBOARD, ctx),
    mutates: false,
    requiresPreview: false,
    teresa: {
      description:
        'Kopiuje bieżącą Tabelę (widoczne kolumny/wiersze) do schowka systemowego — nie tworzy pliku ani rekordu, tylko wypełnia schowek przeglądarki. UWAGA: ten sam legacy/platform rozjazd danych co `idea.export.table_csv` (nienaprawiony tu).',
    },
    runtime: RUNTIME_TBL_COPY_CLIPBOARD,
    source:
      'src/components/MyWork/IdeaTableTool.tsx:3382 (legacy inline toolbar button) + useTableQuickActions.ts tbl_copy_clipboard (NOWE okablowanie, 2026-08-10)',
  },
  {
    id: 'table.date_dependency.save',
    label: { pl: 'Zapisz zależności dat', en: 'Save date dependencies' },
    icon: 'Save',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableDateDependencySaveCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.putDependencyConfig` nadpisuje (upsert) JEDYNĄ konfigurację zależności dat tabeli — bez historii wersji, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description:
        'Zapisuje konfigurację zależności dat (Airtable-style) tabeli — pole daty startu/końca, opcjonalnie czas trwania/poprzednik, domyślny typ zależności, opóźnienie w dniach, pomijanie weekendów.',
      parameters: {
        type: 'object',
        properties: {
          tableId: { type: 'string', description: 'Id tabeli platformowej.' },
          startDateFieldId: { type: 'string', description: 'Id pola daty startu.' },
          endDateFieldId: { type: 'string', description: 'Id pola daty końca.' },
          durationFieldId: { type: 'string', description: 'Id pola czasu trwania (opcjonalne).' },
          predecessorFieldId: {
            type: 'string',
            description: 'Id pola powiązania z poprzednikiem (opcjonalne).',
          },
          defaultDependencyType: {
            type: 'string',
            description: 'FS|SS|FF|SF — domyślny typ zależności.',
          },
          defaultLagDays: { type: 'number', description: 'Domyślne opóźnienie w dniach.' },
          skipWeekends: { type: 'boolean', description: 'Czy pomijać weekendy przy przeliczaniu.' },
        },
        required: ['tableId', 'startDateFieldId', 'endDateFieldId'],
      },
    },
    source: 'src/components/MyWork/table/DateDependencyConfig.tsx:290 (handleSave)',
  },
  {
    id: 'table.date_dependency.recalculate',
    label: { pl: 'Przelicz zależności dat', en: 'Recalculate date dependencies' },
    icon: 'RefreshCw',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableDateDependencyRecalculateCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.recalculateDateDependencies` nadpisuje pola dat WIELU rekordów naraz zgodnie z konfiguracją zależności — bez historii wersji ani stosu cofania, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description:
        'Przelicza pola dat wszystkich rekordów tabeli wg zapisanej konfiguracji zależności (kaskadowo, jak w Ganttcie). Najpierw sprawdza cykl zależności — jeśli wykryty, przerywa i zwraca listę rekordów w cyklu zamiast przeliczać.',
      parameters: {
        type: 'object',
        properties: {
          tableId: { type: 'string', description: 'Id tabeli platformowej.' },
          startDateFieldId: { type: 'string', description: 'Id pola daty startu.' },
          endDateFieldId: { type: 'string', description: 'Id pola daty końca.' },
          durationFieldId: { type: 'string', description: 'Id pola czasu trwania (opcjonalne).' },
          predecessorFieldId: {
            type: 'string',
            description: 'Id pola powiązania z poprzednikiem (opcjonalne).',
          },
          defaultDependencyType: {
            type: 'string',
            description: 'FS|SS|FF|SF — domyślny typ zależności.',
          },
          defaultLagDays: { type: 'number', description: 'Domyślne opóźnienie w dniach.' },
          skipWeekends: { type: 'boolean', description: 'Czy pomijać weekendy przy przeliczaniu.' },
        },
        required: ['tableId', 'startDateFieldId', 'endDateFieldId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/DateDependencyConfig.tsx:299 (handleRecalculate)',
  },
  {
    id: 'table.distribution_builder.create',
    label: { pl: 'Utwórz dystrybucję (Distribute)', en: 'Create distribution (Distribute)' },
    icon: 'Plus',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableDistributionCreateCallback('table.distribution_builder.create', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Tworzy NOWY obiekt dystrybucji (`TablePlatformApi.createDistribution`) — cofnięcie = ręczne usunięcie przez `table.distribution_builder.delete`.',
    },
    teresa: {
      description:
        'Tworzy nową dystrybucję danych z tabeli (legacy panel „Distribute", zawsze dostępny — niezależny od trybu platformowego) — email/Slack/Teams/webhook, w formacie CSV/XLSX/JSON/PDF/PNG, opcjonalnie na harmonogramie cron.',
      parameters: {
        type: 'object',
        properties: {
          baseId: { type: 'string', description: 'Id bazy (Idei) tabeli.' },
          name: { type: 'string', description: 'Nazwa dystrybucji.' },
          sourceType: { type: 'string', description: '"table" albo "view".' },
          sourceId: { type: 'string', description: 'Id tabeli/widoku źródłowego.' },
          channel: { type: 'string', description: 'email|slack|teams|webhook.' },
          channelConfig: { type: 'object', description: 'Konfiguracja kanału (np. adresy email, webhookUrl).' },
          format: { type: 'string', description: 'csv|xlsx|pdf|png|json.' },
          schedule: { type: 'string', description: 'Wyrażenie cron (opcjonalne — puste = na żądanie).' },
        },
        required: ['baseId', 'name', 'channel'],
      },
    },
    source: 'src/components/MyWork/table/DistributionBuilder.tsx:367 (handleCreate)',
  },
  {
    id: 'table.distribution_builder.execute',
    label: { pl: 'Wyślij teraz (Distribute)', en: 'Send now (Distribute)' },
    icon: 'Play',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableDistributionExecuteCallback('table.distribution_builder.execute', ctx),
    mutates: true,
    requiresPreview: false,
    external: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.executeDistribution` faktycznie wysyła dane przez kanał (email/Slack/Teams/webhook) — nieodwoływalne po wysłaniu, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description:
        'Wysyła dystrybucję (legacy panel „Distribute") natychmiast, poza harmonogramem — realnie wysyła dane przez skonfigurowany kanał.',
      parameters: {
        type: 'object',
        properties: {
          distributionId: { type: 'string', description: 'Id dystrybucji do wysłania.' },
        },
        required: ['distributionId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/DistributionBuilder.tsx:439 (handleExecute)',
  },
  {
    id: 'table.distribution_builder.delete',
    label: { pl: 'Usuń dystrybucję (Distribute)', en: 'Delete distribution (Distribute)' },
    icon: 'Trash2',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableDistributionDeleteCallback('table.distribution_builder.delete', ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.deleteDistribution` to trwałe serwerowe usunięcie — bez historii, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Trwale usuwa dystrybucję (legacy panel „Distribute").',
      parameters: {
        type: 'object',
        properties: {
          distributionId: { type: 'string', description: 'Id dystrybucji do usunięcia.' },
        },
        required: ['distributionId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/DistributionBuilder.tsx:466 (handleDelete)',
  },
  {
    id: 'table.record_template.delete',
    label: { pl: 'Usuń szablon rekordu', en: 'Delete record template' },
    icon: 'Trash2',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableRecordTemplateDeleteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.deleteRecordTemplate` to trwałe serwerowe usunięcie — bez historii, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Trwale usuwa szablon rekordu (pre-wypełnione wartości pól do szybkiego dodawania wierszy).',
      parameters: {
        type: 'object',
        properties: {
          templateId: { type: 'string', description: 'Id szablonu do usunięcia.' },
        },
        required: ['templateId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/RecordTemplateManager.tsx:193 (handleDelete)',
  },
  {
    id: 'table.record_template.save',
    label: { pl: 'Zapisz szablon rekordu', en: 'Save record template' },
    icon: 'Save',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableRecordTemplateSaveCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        'Dla NOWEGO szablonu (brak `templateId`) skutkiem jest nowy obiekt — kasowalny ręcznie przez `table.record_template.delete` (czyli sam w sobie byłby `manual_delete`); dla EDYCJI istniejącego (`templateId` podany) `TablePlatformApi.updateRecordTemplate` nadpisuje `name`/`data` bez historii wersji — poprzednie wartości giną bezpowrotnie. Uczciwa, słabsza wspólna klasyfikacja dla jednej akcji obsługującej oba przypadki: `no_undo`.',
    },
    teresa: {
      description:
        'Tworzy nowy szablon rekordu (podaj `tableId`) albo nadpisuje istniejący (podaj `templateId`) — nazwa + mapa pól→wartości domyślne.',
      parameters: {
        type: 'object',
        properties: {
          tableId: { type: 'string', description: 'Id tabeli — wymagane przy tworzeniu NOWEGO szablonu.' },
          templateId: { type: 'string', description: 'Id istniejącego szablonu — wymagane przy edycji.' },
          name: { type: 'string', description: 'Nazwa szablonu.' },
          data: { type: 'object', description: 'Mapa id/nazwa pola → wartość domyślna.' },
        },
        required: ['name', 'data'],
      },
    },
    source: 'src/components/MyWork/table/RecordTemplateManager.tsx:407 (TemplateEditor handleSave)',
  },
  {
    id: 'table.automation.run_now',
    label: { pl: 'Uruchom teraz (automatyzacja)', en: 'Run now (automation)' },
    icon: 'Play',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableAutomationRunNowCallback(ctx),
    mutates: true,
    requiresPreview: false,
    external: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.runAutomationNow` realnie wykonuje akcje automatyzacji (mogą wysyłać webhooki/e-maile/zmieniać rekordy) — nieodwoływalne po uruchomieniu, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Uruchamia wskazaną automatyzację natychmiast, poza jej triggerem.',
      parameters: {
        type: 'object',
        properties: {
          automationId: { type: 'string', description: 'Id automatyzacji do uruchomienia.' },
        },
        required: ['automationId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/automations/AutomationsManager.tsx:499 (handleRunNow)',
  },
  {
    id: 'table.automation.delete',
    label: { pl: 'Usuń automatyzację', en: 'Delete automation' },
    icon: 'Trash2',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableAutomationDeleteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.deleteAutomation` to trwałe serwerowe usunięcie — bez historii, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Trwale usuwa automatyzację tabeli.',
      parameters: {
        type: 'object',
        properties: {
          automationId: { type: 'string', description: 'Id automatyzacji do usunięcia.' },
        },
        required: ['automationId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/automations/AutomationsManager.tsx:526 (handleDelete)',
  },
  {
    id: 'table.webhook_relay.delete',
    label: { pl: 'Usuń webhook relay', en: 'Delete webhook relay' },
    icon: 'Trash2',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableWebhookRelayDeleteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.deleteWebhookRelay` to trwałe serwerowe usunięcie — bez historii, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Trwale usuwa webhook relay (przekaźnik zdarzeń tabeli do Zapier/zewnętrznego URL).',
      parameters: {
        type: 'object',
        properties: {
          relayId: { type: 'string', description: 'Id webhook relay do usunięcia.' },
        },
        required: ['relayId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/connectors/WebhookRelayPanel.tsx:309 (handleDelete)',
  },
  {
    id: 'table.distribution.create',
    label: { pl: 'Utwórz dystrybucję (Distribution Manager)', en: 'Create distribution (Distribution Manager)' },
    icon: 'Plus',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableDistributionCreateCallback('table.distribution.create', ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Tworzy NOWY obiekt dystrybucji (`TablePlatformApi.createDistribution`) — cofnięcie = ręczne usunięcie przez `table.distribution.delete`.',
    },
    teresa: {
      description:
        'Tworzy nową dystrybucję danych z tabeli (platformowy panel „Distribution Manager", widoczny wyłącznie w trybie platformowym) — email/Slack/Teams/webhook, w formacie CSV/JSON/XLSX/PDF/link, opcjonalnie na harmonogramie cron. Ta sama operacja co `table.distribution_builder.create`, INNY punkt wejścia UI (osobny, platformowy panel z kreatorem krokowym).',
      parameters: {
        type: 'object',
        properties: {
          baseId: { type: 'string', description: 'Id bazy (Idei) tabeli.' },
          name: { type: 'string', description: 'Nazwa dystrybucji.' },
          sourceType: { type: 'string', description: '"table" albo "view".' },
          sourceId: { type: 'string', description: 'Id tabeli/widoku źródłowego.' },
          channel: { type: 'string', description: 'email|slack|teams|webhook.' },
          channelConfig: { type: 'object', description: 'Konfiguracja kanału (np. adresy email, webhookUrl).' },
          format: { type: 'string', description: 'csv|json|xlsx|pdf|link.' },
          schedule: { type: 'string', description: 'Wyrażenie cron (opcjonalne — puste = na żądanie).' },
        },
        required: ['baseId', 'name', 'channel'],
      },
    },
    source: 'src/components/MyWork/table/distribution/DistributionManager.tsx:567 (handleCreate)',
  },
  {
    id: 'table.distribution.execute',
    label: { pl: 'Wyślij teraz (Distribution Manager)', en: 'Send now (Distribution Manager)' },
    icon: 'Play',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableDistributionExecuteCallback('table.distribution.execute', ctx),
    mutates: true,
    requiresPreview: false,
    external: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.executeDistribution` faktycznie wysyła dane przez kanał (email/Slack/Teams/webhook) — nieodwoływalne po wysłaniu, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Wysyła dystrybucję (platformowy panel „Distribution Manager") natychmiast, poza harmonogramem.',
      parameters: {
        type: 'object',
        properties: {
          distributionId: { type: 'string', description: 'Id dystrybucji do wysłania.' },
        },
        required: ['distributionId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/distribution/DistributionManager.tsx:692 (handleExecute)',
  },
  {
    id: 'table.distribution.delete',
    label: { pl: 'Usuń dystrybucję (Distribution Manager)', en: 'Delete distribution (Distribution Manager)' },
    icon: 'Trash2',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableDistributionDeleteCallback('table.distribution.delete', ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.deleteDistribution` to trwałe serwerowe usunięcie — bez historii, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Trwale usuwa dystrybucję (platformowy panel „Distribution Manager").',
      parameters: {
        type: 'object',
        properties: {
          distributionId: { type: 'string', description: 'Id dystrybucji do usunięcia.' },
        },
        required: ['distributionId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/distribution/DistributionManager.tsx:719 (handleDelete)',
  },
  {
    id: 'table.form.share_mode_change',
    label: { pl: 'Zmień tryb udostępniania formularza', en: 'Change form share mode' },
    icon: 'Globe',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableFormShareModeChangeCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.updateForm` nadpisuje `is_published`/`config.requireAuth` formularza — poprzedni tryb udostępniania nie jest nigdzie zapisany, bez historii, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description:
        'Zmienia tryb udostępniania formularza — publiczny/tylko organizacja/wymaga uwierzytelnienia. Dla Teresy: najpierw pobiera bieżący rekord formularza (Teresa nie ma lokalnego stanu panelu), potem zapisuje nowy tryb — dokładnie ten sam kształt co klik człowieka.',
      parameters: {
        type: 'object',
        properties: {
          formId: { type: 'string', description: 'Id formularza.' },
          mode: { type: 'string', description: 'public|organization|authenticated.' },
        },
        required: ['formId', 'mode'],
      },
    },
    source: 'src/components/MyWork/table/forms/FormsIndex.tsx:354 (handleShareModeChange)',
  },
  {
    id: 'table.form.delete',
    label: { pl: 'Usuń formularz', en: 'Delete form' },
    icon: 'Trash2',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableFormDeleteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.deleteForm` to trwałe serwerowe usunięcie — bez historii, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Trwale usuwa formularz (i jego publiczny link).',
      parameters: {
        type: 'object',
        properties: {
          formId: { type: 'string', description: 'Id formularza do usunięcia.' },
        },
        required: ['formId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/forms/FormsIndex.tsx:409 (handleDelete)',
  },
  {
    id: 'table.form_intake.save_allow_list',
    label: { pl: 'Zapisz allow-listę formularza (JWT)', en: 'Save form intake allow-list (JWT)' },
    icon: 'Save',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableFormIntakeSaveAllowListCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.setFormIntakeAllowList` nadpisuje listę dozwolonych pól prywatnego linku JWT formularza — bez historii, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description:
        'Zapisuje allow-listę pól dla prywatnych linków formularza (Form Intake JWT, EPIC-T14) — pusta lista = brak filtra (wszystkie skonfigurowane pola).',
      parameters: {
        type: 'object',
        properties: {
          formId: { type: 'string', description: 'Id formularza.' },
          fieldIds: {
            type: 'array',
            description: 'Lista id pól dozwolonych w intake — pusta tablica usuwa filtr.',
          },
        },
        required: ['formId'],
      },
    },
    source: 'src/components/MyWork/table/forms/IntakeJwtPanel.tsx:340 (handleSaveAllowList)',
  },
  {
    id: 'table.interface.delete',
    label: { pl: 'Usuń interfejs', en: 'Delete interface' },
    icon: 'Trash2',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableInterfaceDeleteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.deleteView` (interfejsy są przechowywane jako widoki platformowe typu "interface") to trwałe serwerowe usunięcie — bez historii, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Trwale usuwa interfejs (dashboard/widok szczegółów rekordu zbudowany w Interface Designer).',
      parameters: {
        type: 'object',
        properties: {
          interfaceId: { type: 'string', description: 'Id interfejsu do usunięcia.' },
        },
        required: ['interfaceId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/interfaces/InterfacesIndex.tsx:413 (handleDelete)',
  },
  {
    id: 'table.sharing.invite',
    label: { pl: 'Zaproś współpracownika', en: 'Invite collaborator' },
    icon: 'UserPlus',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableSharingInviteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    external: true,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Tworzy NOWEGO współpracownika bazy (`TablePlatformApi.inviteCollaborator`, wysyła też zaproszenie e-mail) — cofnięcie = ręczne usunięcie dostępu przez `table.sharing.remove_collaborator`.',
    },
    teresa: {
      description: 'Zaprasza osobę (po e-mailu) do współpracy nad bazą tabeli, z rolą (owner/editor/commenter/viewer).',
      parameters: {
        type: 'object',
        properties: {
          baseId: { type: 'string', description: 'Id bazy (Idei) tabeli.' },
          email: { type: 'string', description: 'E-mail osoby zapraszanej.' },
          role: { type: 'string', description: 'owner|editor|commenter|viewer (domyślnie editor).' },
        },
        required: ['baseId', 'email'],
      },
    },
    source: 'src/components/MyWork/table/sharing/SharingManager.tsx:321 (handleInvite)',
  },
  {
    id: 'table.sharing.remove_collaborator',
    label: { pl: 'Usuń dostęp współpracownika', en: 'Remove collaborator access' },
    icon: 'Trash2',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableSharingRemoveCollaboratorCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.removeCollaborator` to trwałe serwerowe odebranie dostępu — bez historii, ani dla kliku człowieka, ani dla Teresy (ponowny dostęp wymaga NOWEGO zaproszenia przez `table.sharing.invite`).',
    },
    teresa: {
      description: 'Trwale usuwa dostęp współpracownika do bazy tabeli.',
      parameters: {
        type: 'object',
        properties: {
          baseId: { type: 'string', description: 'Id bazy (Idei) tabeli.' },
          userId: { type: 'string', description: 'Id współpracownika do usunięcia.' },
        },
        required: ['baseId', 'userId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/sharing/SharingManager.tsx:430 (handleRemoveCollaborator)',
  },
  {
    id: 'table.sync.create',
    label: { pl: 'Utwórz synchronizację', en: 'Create sync' },
    icon: 'Plus',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableSyncCreateCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'manual_delete',
      evidence:
        'Tworzy NOWĄ konfigurację synchronizacji (`TablePlatformApi.createTableSync`) — cofnięcie = ręczne usunięcie przez `table.sync.delete`. Sama konfiguracja nie synchronizuje jeszcze danych (to robi `table.sync.run_now`).',
    },
    teresa: {
      description: 'Tworzy konfigurację synchronizacji danych między dwiema tabelami (mapowanie pól, tryb jedno/dwukierunkowy).',
      parameters: {
        type: 'object',
        properties: {
          sourceTableId: { type: 'string', description: 'Id tabeli źródłowej.' },
          targetTableId: { type: 'string', description: 'Id tabeli docelowej.' },
          fieldMapping: {
            type: 'object',
            description: 'Mapa pól źródło→cel; domyślnie {"*":"*"} (wszystkie pola).',
          },
          syncMode: { type: 'string', description: 'one_way|two_way (domyślnie one_way).' },
        },
        required: ['sourceTableId', 'targetTableId'],
      },
    },
    source: 'src/components/MyWork/table/sync/SyncManager.tsx:449 (handleCreateSync)',
  },
  {
    id: 'table.sync.run_now',
    label: { pl: 'Synchronizuj teraz', en: 'Sync now' },
    icon: 'Play',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableSyncRunNowCallback(ctx),
    mutates: true,
    requiresPreview: false,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.executeTableSync` realnie tworzy/aktualizuje rekordy w tabeli docelowej — bez automatycznego cofnięcia, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Uruchamia wskazaną synchronizację natychmiast, poza jej harmonogramem.',
      parameters: {
        type: 'object',
        properties: {
          syncId: { type: 'string', description: 'Id synchronizacji do uruchomienia.' },
        },
        required: ['syncId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/sync/SyncManager.tsx:565 (handleSyncNow)',
  },
  {
    id: 'table.sync.delete',
    label: { pl: 'Usuń synchronizację', en: 'Delete sync' },
    icon: 'Trash2',
    scope: 'workspace',
    tools: ['table'],
    surfaces: ['panel'],
    handler: (ctx) => runTableSyncDeleteCallback(ctx),
    mutates: true,
    requiresPreview: false,
    destructive: true,
    undo: {
      kind: 'no_undo',
      reason: 'unrecoverable',
      evidence:
        '`TablePlatformApi.deleteTableSync` to trwałe serwerowe usunięcie konfiguracji — bez historii, ani dla kliku człowieka, ani dla Teresy.',
    },
    teresa: {
      description: 'Trwale usuwa konfigurację synchronizacji (nie cofa już zsynchronizowanych danych).',
      parameters: {
        type: 'object',
        properties: {
          syncId: { type: 'string', description: 'Id synchronizacji do usunięcia.' },
        },
        required: ['syncId'],
      },
      confirmBeforeRun: true,
    },
    source: 'src/components/MyWork/table/sync/SyncManager.tsx:577 (handleDelete)',
  },
];
