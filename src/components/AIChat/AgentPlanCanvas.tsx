/**
 * AgentPlanCanvas — ŚRODKOWA kolumna warsztatu agenta: schemat blokowy procesu.
 *
 * SSOT koncepcyjne: Harvard/wdrozenie-100/_SPEC_AGENT_VAULT_2026-07-22.md
 * §4 PARTIA 2 (generator procesu). Doktryna DEC-002: **v1 liniowy** — jeden
 * ciąg klocków, bez rozgałęzień (DAG `toolChainExecutor.ts` w rezerwie; w
 * palecie „Warunek"/„Pętla" są dlatego oznaczone „Wkrótce", nie ukryte).
 *
 * ★ WARSZTAT (2026-07-24) — poprzednia wersja rysowała klocki jako wąską listę
 * `<ol>` wciśniętą w prawy panel; reszta ekranu po otwarciu procesu była pusta.
 * Teraz to jest CENTRUM warsztatu i wygląda jak schemat: karty klocków w
 * pionowym przepływie, WIDOCZNE połączenia między krokami (linia + strzałka),
 * znaczniki START/KONIEC, oraz stan wykonania na każdej karcie.
 *
 * Co dokładnie doszło:
 *  - **drag&drop z palety** — strefy zrzutu MIĘDZY klockami (i na końcach)
 *    przyjmują pozycję palety (`PALETTE_DND_MIME`) i wstawiają klocek DOKŁADNIE
 *    w to miejsce (`onInsertEntry`). Bez biblioteki DnD — natywne HTML5 DnD.
 *  - **przeciąganie istniejącego klocka** (`BLOCK_DND_MIME`) = zmiana kolejności.
 *    Strzałki ▲▼ ZOSTAJĄ: natywne DnD nie ma obsługi klawiatury, więc byłyby
 *    jedyną drogą dla klawiatury — nie usuwamy dostępnej ścieżki.
 *  - **stan wykonania** (`execution`) — każda karta dostaje status kroku, a
 *    krok aktualnie wykonywany jest wyróżniony obwódką `c-info` + plakietką
 *    „TERAZ". To jest sedno warsztatu: jednym rzutem oka widać, gdzie agent stoi.
 *  - **czytelne nazwy** — na karcie nigdy nie świeci snake_case rejestru;
 *    nazwa narzędzia idzie przez `toolLabel()` z `agentWorkshopCatalog.ts`.
 *
 * Model klocka (`PlanSchemaBlock`) niesie `toolName`/`toolInput` od AGT-008 —
 * dla większości `kind` user wybiera narzędzie z `TOOL_CATALOG` (kurowane
 * odbicie `AI_TOOLS` z server/src/services/ai/toolDefinitions.ts), a dla
 * `kind === 'vault-kontekst'` zamiast tego POZIOM sejfu Vault
 * (`GET /api/knowledge/vault-safes`, VLT-001..005) — wybór ląduje w
 * `toolInput.vault_scope`/`vault_project_id` i jest egzekwowany server-side w
 * `executeKBSearch`. Klocki sprzed AGT-008 (bez tych pól) nadal działają —
 * `blocksToSteps` ma bezpieczny fallback.
 *
 * Tokeny wyłącznie `c-*`, fokus `c-focus`, czerwień tylko dla akcji
 * destrukcyjnej (usuń) i statusu błędu — patrz consultify-artefakty §Twarde zakazy.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Boxes,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Clock,
  Flag,
  GitBranch,
  GripVertical,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EntityStatusChip } from '@/components/ui/primitives/chips/EntityStatusChip';
import { Api } from '@/services/api';

import {
  ALL_BLOCK_KINDS,
  BLOCK_KIND_FALLBACK_LABEL,
  BLOCK_KIND_LABEL_KEY,
  DEFAULT_TOOL_NAME,
  isAnnotationKind,
  type PlanBlockKind,
  TOOL_CATALOG,
  type ToolCatalogEntry,
  toolLabel,
} from './agentWorkshopCatalog';
import { PALETTE_DND_MIME } from './AgentWorkshopPalette';

export type { PlanBlockKind, ToolCatalogEntry };
export { DEFAULT_TOOL_NAME, TOOL_CATALOG };

/**
 * Etykieta modułu pod nazwą klocka (`block.moduleType`, patrz
 * `agentWorkshopCatalog.ts` → pole `module`) — WYŁĄCZNIE dla WYŚWIETLENIA na
 * schemacie. Odbiór 2026-08-30 (przegląd całości): tag pod klockiem był
 * gołym angielskim słowem z katalogu ("Assessment", "Finance", "My Work"…)
 * niezależnie od języka konta — to jest chrom interfejsu (czytelnik widzi
 * słowo na karcie), NIE zapis biznesowy kroku planu (to różni się od
 * `toolLabel()`/`TOOL_LABEL_BY_NAME`, które celowo zostają angielskie, bo są
 * migawką danych zapisywaną z krokiem — patrz komentarz w
 * `agentWorkshopCatalog.ts`). Katalog i `block.moduleType` NIE są tu
 * zmieniane — tylko to, co się pokazuje.
 * `Teresa` i `Vault→Sejf`: `Teresa` to nazwa własna asystenta, zostaje;
 * `Vault` tłumaczone na `Sejf` zgodnie z resztą aplikacji (`sidebar.clientVault`
 * = „Sejf klienta", zakładki modułu Vault = „Sejfy/Foldery").
 */
const MODULE_TAG_TRANSLATIONS: Record<string, { key: string; fallback: string }> = {
  Assessment: { key: 'agentPlan.canvas.moduleTag.assessment', fallback: 'Ocena' },
  Control: { key: 'agentPlan.canvas.moduleTag.control', fallback: 'Kontrola' },
  Execution: { key: 'agentPlan.canvas.moduleTag.execution', fallback: 'Realizacja' },
  Finance: { key: 'agentPlan.canvas.moduleTag.finance', fallback: 'Finanse' },
  Initiatives: { key: 'agentPlan.canvas.moduleTag.initiatives', fallback: 'Inicjatywy' },
  Integrations: { key: 'agentPlan.canvas.moduleTag.integrations', fallback: 'Integracje' },
  Interview: { key: 'agentPlan.canvas.moduleTag.interview', fallback: 'Wywiad' },
  Materials: { key: 'agentPlan.canvas.moduleTag.materials', fallback: 'Materiały' },
  Meeting: { key: 'agentPlan.canvas.moduleTag.meeting', fallback: 'Spotkania' },
  'My Work · Decisions': {
    key: 'agentPlan.canvas.moduleTag.myWorkDecisions',
    fallback: 'Moja Praca · Decyzje',
  },
  'My Work': { key: 'agentPlan.canvas.moduleTag.myWork', fallback: 'Moja Praca' },
  Notebook: { key: 'agentPlan.canvas.moduleTag.notebook', fallback: 'Notatnik' },
  Results: { key: 'agentPlan.canvas.moduleTag.results', fallback: 'Resultaty' },
  Tables: { key: 'agentPlan.canvas.moduleTag.tables', fallback: 'Tabele' },
  Vault: { key: 'agentPlan.canvas.moduleTag.vault', fallback: 'Sejf' },
};

function moduleTagLabel(
  raw: string | undefined,
  t: (key: string, fallback: string) => string
): string | undefined {
  if (!raw) return raw;
  const entry = MODULE_TAG_TRANSLATIONS[raw];
  return entry ? t(entry.key, entry.fallback) : raw;
}

/** Typ MIME przeciąganego KLOCKA schematu (zmiana kolejności wewnątrz canvasu). */
export const BLOCK_DND_MIME = 'application/x-consultify-agent-block-move';

export interface PlanSchemaBlock {
  /** Stabilny lokalny id (nie myl z `AgentPlanStep.id` — to jest przed utworzeniem planu). */
  id: string;
  kind: PlanBlockKind;
  /** Nazwa klocka, edytowalna (np. "Diagnoza"). */
  name: string;
  /** Moduł/typ pokazywany pod nazwą (np. "Interview · Assessment"). */
  moduleType?: string;
  /**
   * Narzędzie z rejestru `toolDefinitions.ts` niesione przez ten klocek.
   * Dla `kind === 'vault-kontekst'` zawsze `'search_knowledge_base'` — dobór
   * idzie przez poziom sejfu w `toolInput`. Dla `kind === 'informacja'` puste
   * (notatka nie jest krokiem wykonania).
   */
  toolName?: string;
  /**
   * Argumenty narzędzia niesione przez klocek. Dla `vault-kontekst`:
   * `vault_scope`/`vault_project_id`/`vault_safe_id`/`vault_safe_name` (poziom
   * sejfu) + opcjonalnie `vault_folder_id`/`vault_folder_name` (★ VLT-FOLDERS —
   * DRUGI select, folder WEWNĄTRZ tego sejfu; egzekwowane server-side
   * autorytatywnie z rekordu folderu, patrz `executeKBSearch`).
   */
  toolInput?: Record<string, unknown>;
}

/** Jeden sejf Vault (odbicie `VaultSafe` z widoku Vault) do wyboru poziomu w klocku "Vault-kontekst". */
export interface VaultSafeOption {
  id: string;
  type: 'user' | 'organization' | 'project';
  projectId: string | null;
  name: string;
}

/**
 * ★ VLT-FOLDERS — jeden folder WEWNĄTRZ wybranego sejfu, do DRUGIEGO selecta
 * klocka "Vault-kontekst" (`Api.getVaultFolders`, ta sama widoczność co
 * `server/src/services/KnowledgeService.ts` `getFolders`).
 */
export interface VaultFolderOption {
  id: string;
  name: string;
}

/** Status kroku planu — kształt 1:1 z `AgentPlanStep['status']` (agentPlan.api.ts). */
export type CanvasStepStatus =
  | 'pending'
  | 'awaiting_approval'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface CanvasExecutionState {
  /** Status per id klocka (= id kroku planu, gdy klocek pochodzi z backendu). */
  statusById: Record<string, CanvasStepStatus>;
  /** Klocek aktualnie wykonywany — dostaje obwódkę i plakietkę „TERAZ". */
  currentBlockId?: string;
}

const BLOCK_ICON: Record<PlanBlockKind, LucideIcon> = {
  'etap-modul': Boxes,
  'ai-teresa': Sparkles,
  'vault-kontekst': Lock,
  'brama-akceptu': ShieldCheck,
  automat: Wand2,
  informacja: GitBranch,
  pauza: Clock,
};

/** Domyślna pauza dla nowo wstawionego klocka 'pauza', zanim user ją zmieni. */
const DEFAULT_WAIT_HOURS = 24;

/**
 * Status kroku → (raw status dla `EntityStatusChip`, etykieta PL). Mapowanie na
 * statusy, które kanoniczna tabela tonów w EntityStatusChip już zna — nie
 * dokładamy własnych kolorów, korzystamy z istniejących tonów.
 */
const STATUS_CHIP: Record<CanvasStepStatus, { raw: string; label: string }> = {
  pending: { raw: 'not_started', label: 'Oczekuje' },
  awaiting_approval: { raw: 'awaiting_approval', label: 'Czeka na zgodę' },
  running: { raw: 'executing', label: 'W toku' },
  completed: { raw: 'completed', label: 'Gotowe' },
  failed: { raw: 'failed', label: 'Błąd' },
  skipped: { raw: 'archived', label: 'Pominięty' },
};

let localIdCounter = 0;
/** Generator id lokalnych klocków — brak zależności od backendu (jeszcze nie istnieją jako kroki). */
export function makeBlockId(): string {
  localIdCounter += 1;
  return `block-local-${Date.now()}-${localIdCounter}`;
}

export interface AgentPlanCanvasProps {
  blocks: PlanSchemaBlock[];
  onChange: (blocks: PlanSchemaBlock[]) => void;
  /** Blokuje edycję (plan wystartował) — canvas renderuje się tylko-do-odczytu. */
  readOnly?: boolean;
  /** Zrzut pozycji palety na strefę między klockami: (id pozycji, indeks docelowy). */
  onInsertEntry?: (paletteEntryId: string, index: number) => void;
  /** Stan wykonania planu — statusy kroków + wskazanie aktualnego. */
  execution?: CanvasExecutionState;
}

/**
 * Strefa zrzutu między klockami. Pełni dwie role naraz: przyjmuje pozycję z
 * palety (wstaw nowy klocek) ORAZ przeciągany klocek schematu (przestaw).
 * Widoczna dopiero w trakcie przeciągania — poza tym jest cienką przerwą, żeby
 * schemat nie zamienił się w drabinę przycisków (doktryna gęstości).
 */
const DropZone: React.FC<{
  index: number;
  active: boolean;
  onDropPalette: (entryId: string, index: number) => void;
  onDropBlock: (blockId: string, index: number) => void;
}> = ({ index, active, onDropPalette, onDropBlock }) => {
  const [over, setOver] = useState(false);

  if (!active) return <div className="h-1" aria-hidden="true" />;

  return (
    <div
      data-testid={`canvas-dropzone-${index}`}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const entryId = e.dataTransfer.getData(PALETTE_DND_MIME);
        if (entryId) {
          onDropPalette(entryId, index);
          return;
        }
        const blockId = e.dataTransfer.getData(BLOCK_DND_MIME);
        if (blockId) onDropBlock(blockId, index);
      }}
      className={`my-1 flex h-7 items-center justify-center rounded-lg border-2 border-dashed text-[10px] transition-colors ${
        over
          ? 'border-c-info bg-[color-mix(in_srgb,var(--c-info)_10%,transparent)] text-c-info'
          : 'border-c-border-subtle text-c-text-muted'
      }`}
    >
      {over ? 'Upuść tutaj' : '—'}
    </div>
  );
};

/** Pionowe połączenie między kartami: linia + strzałka. To jest „krawędź" schematu. */
const Connector: React.FC = () => (
  <div className="flex flex-col items-center" aria-hidden="true">
    <span className="h-3 w-px bg-c-border-subtle" />
    <ChevronDown size={12} className="-my-0.5 text-c-border-subtle" />
    <span className="h-3 w-px bg-c-border-subtle" />
  </div>
);

const EndCap: React.FC<{ label: string; icon: LucideIcon }> = ({ label, icon: Icon }) => (
  <div className="flex items-center gap-1.5 rounded-full border border-c-border-subtle bg-c-surface-raised/50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
    <Icon size={13} />
    {label}
  </div>
);

export const AgentPlanCanvas: React.FC<AgentPlanCanvasProps> = ({
  blocks,
  onChange,
  readOnly = false,
  onInsertEntry,
  execution,
}) => {
  const { t } = useTranslation();
  const [dragging, setDragging] = useState(false);

  const moveBlock = useCallback(
    (index: number, direction: -1 | 1) => {
      const target = index + direction;
      if (target < 0 || target >= blocks.length) return;
      const next = blocks.slice();
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      onChange(next);
    },
    [blocks, onChange]
  );

  /** Przeniesienie klocka na pozycję strefy zrzutu (indeks LICZONY PRZED wyjęciem). */
  const moveBlockTo = useCallback(
    (blockId: string, targetIndex: number) => {
      const from = blocks.findIndex((b) => b.id === blockId);
      if (from < 0) return;
      const next = blocks.slice();
      const [moved] = next.splice(from, 1);
      // Po wyjęciu elementu indeksy za nim przesuwają się o 1 — korygujemy,
      // inaczej „przeciągnij o jedno w dół" nie robiłoby nic.
      const insertAt = targetIndex > from ? targetIndex - 1 : targetIndex;
      next.splice(insertAt, 0, moved);
      onChange(next);
    },
    [blocks, onChange]
  );

  const removeBlock = useCallback(
    (index: number) => {
      onChange(blocks.filter((_, i) => i !== index));
    },
    [blocks, onChange]
  );

  const renameBlock = useCallback(
    (index: number, name: string) => {
      const next = blocks.slice();
      next[index] = { ...next[index], name };
      onChange(next);
    },
    [blocks, onChange]
  );

  const setBlockKind = useCallback(
    (index: number, kind: PlanBlockKind) => {
      const next = blocks.slice();
      const patched: PlanSchemaBlock = { ...next[index], kind };
      // 'vault-kontekst' → narzędzie zawsze search_knowledge_base (dobór idzie
      // przez poziom sejfu). 'pauza' → zawsze wait_until (dobór idzie przez
      // liczbę godzin). 'informacja' → notatka, więc żadnego narzędzia.
      if (kind === 'vault-kontekst' && !patched.toolName) patched.toolName = DEFAULT_TOOL_NAME;
      if (kind === 'pauza') {
        patched.toolName = 'wait_until';
        if (typeof patched.toolInput?.waitHours !== 'number') {
          patched.toolInput = { ...patched.toolInput, waitHours: DEFAULT_WAIT_HOURS };
        }
      }
      if (isAnnotationKind(kind)) patched.toolName = undefined;
      else if (!patched.toolName) patched.toolName = DEFAULT_TOOL_NAME;
      next[index] = patched;
      onChange(next);
    },
    [blocks, onChange]
  );

  const setBlockTool = useCallback(
    (index: number, toolName: string) => {
      const next = blocks.slice();
      next[index] = { ...next[index], toolName };
      onChange(next);
    },
    [blocks, onChange]
  );

  /**
   * Wybór POZIOMU sejfu Vault dla klocka 'vault-kontekst'. Zapisuje
   * `vault_safe_id`/`vault_scope`/`vault_project_id`/`vault_safe_name` w
   * `toolInput` (czytane server-side w `executeKBSearch` do ograniczenia
   * retrievalu do TEGO JEDNEGO sejfu — izolacja per poziom, VLT-001..005).
   */
  const setBlockVaultSafe = useCallback(
    (index: number, safe: VaultSafeOption | undefined) => {
      const next = blocks.slice();
      const prevInput = next[index].toolInput ?? {};
      next[index] = {
        ...next[index],
        toolName: DEFAULT_TOOL_NAME,
        toolInput: safe
          ? {
              ...prevInput,
              vault_safe_id: safe.id,
              vault_scope: safe.type,
              vault_project_id: safe.projectId,
              vault_safe_name: safe.name,
              // ★ VLT-FOLDERS — zmiana sejfu unieważnia poprzedni wybór folderu
              // (folder żył WEWNĄTRZ poprzedniego sejfu, może nie istnieć w nowym).
              vault_folder_id: undefined,
              vault_folder_name: undefined,
            }
          : {
              ...prevInput,
              vault_safe_id: undefined,
              vault_scope: undefined,
              vault_project_id: undefined,
              vault_safe_name: undefined,
              vault_folder_id: undefined,
              vault_folder_name: undefined,
            },
      };
      onChange(next);
    },
    [blocks, onChange]
  );

  /**
   * ★ VLT-FOLDERS — DRUGI select klocka 'vault-kontekst': folder WEWNĄTRZ już
   * wybranego sejfu. Zapisuje `vault_folder_id`/`vault_folder_name` w
   * `toolInput` — server-side (`executeKBSearch`) wyprowadza poziom/projekt
   * AUTORYTATYWNIE z samego folderu (nie ufa temu polu do rozszerzenia
   * dostępu), więc to tylko wygoda UI + etykieta na karcie.
   */
  const setBlockVaultFolder = useCallback(
    (index: number, folder: VaultFolderOption | undefined) => {
      const next = blocks.slice();
      const prevInput = next[index].toolInput ?? {};
      next[index] = {
        ...next[index],
        toolInput: {
          ...prevInput,
          vault_folder_id: folder?.id,
          vault_folder_name: folder?.name,
        },
      };
      onChange(next);
    },
    [blocks, onChange]
  );

  /**
   * Liczba godzin pauzy dla klocka 'pauza'. Zapisana w `toolInput.waitHours`
   * (szablon — moment rzeczywistego wznowienia, `resumeAt`, backend liczy
   * DOPIERO gdy proces realnie dotrze do tego kroku, nie teraz przy edycji
   * schematu — patrz `agentPlannerService.executePlan`).
   */
  const setBlockWaitHours = useCallback(
    (index: number, hours: number) => {
      const next = blocks.slice();
      const clamped = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_WAIT_HOURS;
      next[index] = {
        ...next[index],
        toolName: 'wait_until',
        toolInput: { ...next[index].toolInput, waitHours: clamped },
      };
      onChange(next);
    },
    [blocks, onChange]
  );

  // Lista sejfów Vault do wyboru poziomu na klocku 'vault-kontekst'. Ładowana
  // raz, best-effort — brak listy nie blokuje edycji reszty canvasu.
  const [vaultSafes, setVaultSafes] = useState<VaultSafeOption[] | null>(null);
  const [vaultSafesError, setVaultSafesError] = useState<string | null>(null);

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    Api.getVaultSafes()
      .then((safes) => {
        if (!cancelled) setVaultSafes(safes);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setVaultSafesError(err instanceof Error ? err.message : 'Failed to load vault safes');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  // ★ VLT-FOLDERS — foldery WEWNĄTRZ każdego sejfu, do DRUGIEGO selecta klocka
  // 'vault-kontekst'. Wiele bloków mogą wskazywać różne sejfy naraz, więc to
  // cache per "scope:projectId" (klucz sejfu), doładowywany EFEKTEM za każdym
  // razem, gdy zbiór faktycznie wybranych sejfów się zmienia (nie ładujemy
  // wszystkich sejfów z góry — tylko te, które jakiś blok już ma ustawione).
  const safeCacheKey = useCallback(
    (scope: string, projectId: string | null | undefined) => `${scope}:${projectId || ''}`,
    []
  );

  const neededSafeKeys = useMemo(() => {
    const keys = new Map<
      string,
      { scope: 'user' | 'organization' | 'project'; projectId: string | null }
    >();
    for (const block of blocks) {
      if (block.kind !== 'vault-kontekst') continue;
      const scope = block.toolInput?.vault_scope;
      if (scope !== 'user' && scope !== 'organization' && scope !== 'project') continue;
      const projectId =
        typeof block.toolInput?.vault_project_id === 'string'
          ? block.toolInput.vault_project_id
          : null;
      keys.set(safeCacheKey(scope, projectId), { scope, projectId });
    }
    return keys;
  }, [blocks, safeCacheKey]);

  const [vaultFoldersBySafe, setVaultFoldersBySafe] = useState<
    Record<string, VaultFolderOption[] | 'loading' | 'error'>
  >({});

  useEffect(() => {
    if (readOnly) return;
    for (const [key, { scope, projectId }] of neededSafeKeys) {
      if (vaultFoldersBySafe[key] !== undefined) continue;
      setVaultFoldersBySafe((prev) =>
        prev[key] !== undefined ? prev : { ...prev, [key]: 'loading' }
      );
      Api.getVaultFolders({ scope, projectId: projectId || undefined })
        .then((list) => {
          setVaultFoldersBySafe((cur) => ({
            ...cur,
            [key]: list.map((f) => ({ id: f.id, name: f.name })),
          }));
        })
        .catch(() => {
          setVaultFoldersBySafe((cur) => ({ ...cur, [key]: 'error' }));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neededSafeKeys, readOnly]);

  const handleDropPalette = useCallback(
    (entryId: string, index: number) => {
      setDragging(false);
      onInsertEntry?.(entryId, index);
    },
    [onInsertEntry]
  );

  const handleDropBlock = useCallback(
    (blockId: string, index: number) => {
      setDragging(false);
      moveBlockTo(blockId, index);
    },
    [moveBlockTo]
  );

  const editable = !readOnly;
  const dropActive = editable && dragging;

  return (
    <div
      className="flex h-full w-full flex-col items-center overflow-y-auto px-6 py-6"
      data-testid="agent-plan-canvas"
      onDragOver={(e) => {
        // Bez tego strefy zrzutu pojawiłyby się dopiero po wejściu kursora
        // dokładnie na 7-pikselową przerwę — czyli praktycznie nigdy.
        if (!editable) return;
        if (
          e.dataTransfer.types.includes(PALETTE_DND_MIME) ||
          e.dataTransfer.types.includes(BLOCK_DND_MIME)
        ) {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={() => setDragging(false)}
    >
      <div className="w-full max-w-[560px]">
        <div className="flex justify-center">
          <EndCap label={t('agentPlan.canvas.start', 'Start')} icon={CircleDot} />
        </div>

        {blocks.length === 0 ? (
          <>
            <div className="flex justify-center">
              <Connector />
            </div>
            <div
              data-testid="canvas-empty"
              onDragOver={(e) => {
                if (!editable) return;
                e.preventDefault();
              }}
              onDrop={(e) => {
                if (!editable) return;
                e.preventDefault();
                const entryId = e.dataTransfer.getData(PALETTE_DND_MIME);
                if (entryId) handleDropPalette(entryId, 0);
              }}
              className="rounded-xl border-2 border-dashed border-c-border-subtle px-6 py-8 text-center"
            >
              <Plus size={18} className="mx-auto mb-2 text-c-text-muted" />
              <p className="text-xs font-medium text-c-text">
                {t('agentPlan.canvas.empty', 'Pusty schemat')}
              </p>
              <p className="mt-1 text-xs text-c-text-muted">
                {t(
                  'agentPlan.canvas.emptyHint',
                  'Przeciągnij klocek z palety po prawej albo kliknij go, żeby dodać pierwszy krok.'
                )}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <Connector />
            </div>
            <DropZone
              index={0}
              active={dropActive}
              onDropPalette={handleDropPalette}
              onDropBlock={handleDropBlock}
            />
            {blocks.map((block, index) => {
              const Icon = BLOCK_ICON[block.kind] ?? Boxes;
              const status = execution?.statusById[block.id];
              const isCurrent = execution?.currentBlockId === block.id;
              const annotation = isAnnotationKind(block.kind);
              const chip = status ? STATUS_CHIP[status] : undefined;

              return (
                <React.Fragment key={block.id}>
                  {index > 0 ? (
                    <>
                      <div className="flex justify-center">
                        <Connector />
                      </div>
                      <DropZone
                        index={index}
                        active={dropActive}
                        onDropPalette={handleDropPalette}
                        onDropBlock={handleDropBlock}
                      />
                    </>
                  ) : null}

                  <article
                    data-testid={`canvas-block-${index}`}
                    data-current={isCurrent ? 'true' : undefined}
                    draggable={editable}
                    onDragStart={(e) => {
                      if (!editable) return;
                      e.dataTransfer.setData(BLOCK_DND_MIME, block.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDragging(true);
                    }}
                    onDragEnd={() => setDragging(false)}
                    className={`rounded-xl border bg-c-surface px-4 py-3 transition-shadow ${
                      isCurrent
                        ? 'border-c-info ring-2 ring-c-info/40 shadow-sm'
                        : 'border-c-border-subtle'
                    } ${annotation ? 'border-dashed bg-c-surface-raised/30' : ''}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-c-border-subtle text-[11px] font-semibold tabular-nums text-c-text-muted">
                        {index + 1}
                      </span>
                      <Icon size={17} className="mt-0.5 shrink-0 text-c-text-muted" />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {editable ? (
                            <input
                              value={block.name}
                              onChange={(e) => renameBlock(index, e.target.value)}
                              aria-label={t('agentPlan.canvas.blockName', 'Nazwa klocka')}
                              title={block.name}
                              className="-mx-1 min-w-0 flex-1 truncate rounded bg-transparent px-1 text-sm font-semibold text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                            />
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-c-text">
                              {block.name}
                            </span>
                          )}
                          {isCurrent ? (
                            <span
                              data-testid="canvas-current-badge"
                              className="shrink-0 rounded-full border border-c-info px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-c-info"
                            >
                              {t('agentPlan.canvas.now', 'Teraz')}
                            </span>
                          ) : null}
                          {chip ? (
                            <EntityStatusChip
                              status={chip.raw}
                              label={chip.label}
                              size="sm"
                              className="shrink-0"
                            />
                          ) : null}
                        </div>

                        <p className="mt-1 text-xs text-c-text-muted">
                          {t(
                            BLOCK_KIND_LABEL_KEY[block.kind],
                            BLOCK_KIND_FALLBACK_LABEL[block.kind]
                          )}
                          {block.moduleType ? ` · ${moduleTagLabel(block.moduleType, t)}` : ''}
                          {block.kind === 'vault-kontekst'
                            ? ` · ${
                                typeof block.toolInput?.vault_safe_name === 'string'
                                  ? block.toolInput.vault_safe_name
                                  : t('agentPlan.canvas.vaultLevelUnset', '— poziom nie wybrany —')
                              }${
                                typeof block.toolInput?.vault_folder_name === 'string'
                                  ? ` / ${block.toolInput.vault_folder_name}`
                                  : ''
                              }`
                            : block.kind === 'pauza'
                              ? ` · ${t('agentPlan.canvas.waitHours', '{{h}} godz.', {
                                  h:
                                    typeof block.toolInput?.waitHours === 'number'
                                      ? block.toolInput.waitHours
                                      : DEFAULT_WAIT_HOURS,
                                })}`
                              : !annotation && block.toolName
                                ? ` · ${toolLabel(block.toolName)}`
                                : ''}
                        </p>

                        {annotation ? (
                          <p className="mt-1 text-[11px] italic text-c-text-muted">
                            {t(
                              'agentPlan.canvas.noteHint',
                              'Notatka na schemacie — agent jej nie wykonuje.'
                            )}
                          </p>
                        ) : null}

                        {editable ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <select
                              value={block.kind}
                              onChange={(e) => setBlockKind(index, e.target.value as PlanBlockKind)}
                              aria-label={t('agentPlan.canvas.blockKind', 'Typ klocka')}
                              className="h-8 rounded-lg border border-c-border-subtle bg-c-surface-raised/40 px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                            >
                              {ALL_BLOCK_KINDS.map((kind) => (
                                <option key={kind} value={kind}>
                                  {t(BLOCK_KIND_LABEL_KEY[kind], BLOCK_KIND_FALLBACK_LABEL[kind])}
                                </option>
                              ))}
                            </select>

                            {block.kind === 'vault-kontekst' ? (
                              <select
                                value={
                                  typeof block.toolInput?.vault_safe_id === 'string'
                                    ? block.toolInput.vault_safe_id
                                    : ''
                                }
                                onChange={(e) => {
                                  const safe = (vaultSafes ?? []).find(
                                    (s) => s.id === e.target.value
                                  );
                                  setBlockVaultSafe(index, safe);
                                }}
                                aria-label={t('agentPlan.canvas.vaultLevel', 'Poziom Vault')}
                                className="h-8 rounded-lg border border-c-border-subtle bg-c-surface-raised/40 px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                              >
                                <option value="">
                                  {t('agentPlan.canvas.vaultLevelPlaceholder', '— wybierz sejf —')}
                                </option>
                                {(vaultSafes ?? []).map((safe) => (
                                  <option key={safe.id} value={safe.id}>
                                    {safe.name}
                                  </option>
                                ))}
                              </select>
                            ) : null}

                            {/* ★ VLT-FOLDERS — DRUGI select: folder WEWNĄTRZ już wybranego sejfu.
                                Widoczny dopiero, gdy blok ma sejf ustawiony — folder bez sejfu
                                nie ma sensu (nie wiadomo, w KTÓRYM sejfie szukać). */}
                            {block.kind === 'vault-kontekst' &&
                            (block.toolInput?.vault_scope === 'user' ||
                              block.toolInput?.vault_scope === 'organization' ||
                              block.toolInput?.vault_scope === 'project')
                              ? (() => {
                                  const scope = block.toolInput.vault_scope as
                                    | 'user'
                                    | 'organization'
                                    | 'project';
                                  const projectId =
                                    typeof block.toolInput?.vault_project_id === 'string'
                                      ? block.toolInput.vault_project_id
                                      : null;
                                  const key = safeCacheKey(scope, projectId);
                                  const entry = vaultFoldersBySafe[key];
                                  const folderOptions = Array.isArray(entry) ? entry : [];
                                  return (
                                    <select
                                      value={
                                        typeof block.toolInput?.vault_folder_id === 'string'
                                          ? block.toolInput.vault_folder_id
                                          : ''
                                      }
                                      onChange={(e) => {
                                        const folder = folderOptions.find(
                                          (f) => f.id === e.target.value
                                        );
                                        setBlockVaultFolder(index, folder);
                                      }}
                                      disabled={entry === 'loading'}
                                      aria-label={t('agentPlan.canvas.vaultFolder', 'Folder Vault')}
                                      className="h-8 rounded-lg border border-c-border-subtle bg-c-surface-raised/40 px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50"
                                    >
                                      <option value="">
                                        {t(
                                          'agentPlan.canvas.vaultFolderPlaceholder',
                                          entry === 'loading'
                                            ? '— ładowanie folderów —'
                                            : '— cały sejf (bez folderu) —'
                                        )}
                                      </option>
                                      {folderOptions.map((folder) => (
                                        <option key={folder.id} value={folder.id}>
                                          {folder.name}
                                        </option>
                                      ))}
                                    </select>
                                  );
                                })()
                              : null}

                            {block.kind === 'pauza' ? (
                              <label className="flex items-center gap-1.5 text-xs text-c-text-muted">
                                <input
                                  type="number"
                                  min={1}
                                  step={1}
                                  value={
                                    typeof block.toolInput?.waitHours === 'number'
                                      ? block.toolInput.waitHours
                                      : DEFAULT_WAIT_HOURS
                                  }
                                  onChange={(e) => setBlockWaitHours(index, Number(e.target.value))}
                                  aria-label={t(
                                    'agentPlan.canvas.waitHoursInput',
                                    'Liczba godzin pauzy'
                                  )}
                                  className="h-8 w-16 rounded-lg border border-c-border-subtle bg-c-surface-raised/40 px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                                />
                                {t('agentPlan.canvas.waitHoursSuffix', 'godz.')}
                              </label>
                            ) : annotation || block.kind === 'vault-kontekst' ? null : (
                              <select
                                value={block.toolName ?? DEFAULT_TOOL_NAME}
                                onChange={(e) => setBlockTool(index, e.target.value)}
                                aria-label={t('agentPlan.canvas.blockTool', 'Narzędzie')}
                                className="h-8 rounded-lg border border-c-border-subtle bg-c-surface-raised/40 px-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                              >
                                {TOOL_CATALOG.map((tool) => (
                                  <option key={tool.name} value={tool.name}>
                                    {tool.label}
                                  </option>
                                ))}
                              </select>
                            )}
                            {block.kind === 'vault-kontekst' && vaultSafesError ? (
                              <span className="text-[11px] text-c-danger">{vaultSafesError}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      {editable ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <GripVertical
                            size={15}
                            className="cursor-grab text-c-text-muted"
                            aria-hidden="true"
                          />
                          <button
                            type="button"
                            aria-label={t('agentPlan.canvas.moveUp', 'Przesuń w górę')}
                            onClick={() => moveBlock(index, -1)}
                            disabled={index === 0}
                            className="rounded p-1 text-c-text-muted hover:bg-c-surface-raised hover:text-c-text disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            <ChevronUp size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={t('agentPlan.canvas.moveDown', 'Przesuń w dół')}
                            onClick={() => moveBlock(index, 1)}
                            disabled={index === blocks.length - 1}
                            className="rounded p-1 text-c-text-muted hover:bg-c-surface-raised hover:text-c-text disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            <ChevronDown size={15} />
                          </button>
                          <button
                            type="button"
                            aria-label={t('agentPlan.canvas.removeBlock', 'Usuń klocek')}
                            onClick={() => removeBlock(index)}
                            className="rounded p-1 text-c-text-muted hover:bg-c-surface-raised hover:text-c-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </article>
                </React.Fragment>
              );
            })}
            <DropZone
              index={blocks.length}
              active={dropActive}
              onDropPalette={handleDropPalette}
              onDropBlock={handleDropBlock}
            />
          </>
        )}

        <div className="flex justify-center">
          <Connector />
        </div>
        <div className="flex justify-center">
          <EndCap label={t('agentPlan.canvas.end', 'Koniec')} icon={Flag} />
        </div>
      </div>
    </div>
  );
};

export default AgentPlanCanvas;
