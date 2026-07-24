/**
 * AgentPlanCanvas — przestawialny schemat klocków planu agenta (AGT-007).
 *
 * SSOT koncepcyjne: Harvard/wdrozenie-100/_SPEC_AGENT_VAULT_2026-07-22.md
 * §4 PARTIA 2 (generator procesu) + rejestr/1-OTWARTE/AGT-007. Doktryna
 * DEC-002: **v1 liniowy** — jeden ciąg klocków, bez rozgałęzień (DAG
 * `toolChainExecutor.ts` zostaje w rezerwie na później).
 *
 * Renderuje listę klocków (`PlanSchemaBlock`) jako edytowalny schemat:
 *  - **dodaj** klocek (przycisk na dole),
 *  - **usuń** klocek (X na wierszu),
 *  - **przestaw** klocek (strzałki góra/dół — wybrane zamiast drag&drop:
 *    prostsze, bez biblioteki DnD, w pełni klawiaturo-dostępne, brak
 *    ryzyka złego drop-state na urządzeniach dotykowych).
 *  - **nazwa + moduł/typ** widoczne na klocku (inline-edytowalna nazwa,
 *    typ przez natywny `<select>`).
 *
 * Ten komponent NIE zna się na wykonaniu planu — to czysta powierzchnia
 * edycji schematu (etap "user przestawia" z konceptu, PRZED odpaleniem).
 * Zapis do backendu: patrz komentarz w `AgentPlanPanel.tsx` przy miejscu
 * użycia — na dziś endpoint edycji kroków NIE istnieje (AGT-006 dokłada
 * generator, nie edycję po fakcie), więc wołający odpowiada za persystencję
 * (prop `onChange` + `onRunSchema`).
 *
 * Tokeny wyłącznie `c-*` (c-text/-muted, c-surface-raised, c-border-subtle,
 * c-danger), fokus `c-focus`, zero crimson w tym pliku — patrz
 * consultify-artefakty §Twarde zakazy.
 *
 * ★ AGT-008 (2026-07-24) — bogatszy model klocka + klocek "Vault-kontekst".
 * PROBLEM zastany: `PlanSchemaBlock` niósł tylko `id/kind/name/moduleType` —
 * nowo dodany klocek nie miał jak przenieść WYBRANEGO narzędzia, więc
 * `AgentPlanPanel.blocksToSteps` dawała mu sztywny, niewidoczny dla usera
 * fallback `search_knowledge_base` (patrz komentarz tamże). Naprawa: blok
 * dostaje opcjonalne `toolName`/`toolInput` — dla większości `kind` user
 * wybiera KONKRETNE narzędzie z `TOOL_CATALOG` (kurowane odbicie
 * `server/src/services/ai/toolDefinitions.ts` — ten sam rejestr, którego
 * używa czat Teresy i executor planu); dla `kind === 'vault-kontekst'`
 * wybiera zamiast tego POZIOM sejfu Vault (Mój sejf / Projekt / Organizacja,
 * z `GET /api/knowledge/vault-safes`, VLT-001..005) — toolName jest wtedy
 * zawsze `search_knowledge_base`, a wybrany poziom trafia do
 * `toolInput.vault_scope`/`vault_project_id` (egzekwowane server-side w
 * `executeKBSearch`, izolacja per sejf). Stare klocki bez tych pól nadal
 * działają — `blocksToSteps` ma bezpieczny fallback.
 */
import type { LucideIcon } from 'lucide-react';
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Lock,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewActionButton } from '@/components/shared/PreviewPane';
import { Api } from '@/services/api';

/** Typy klocków v1 zatwierdzone w SPEC §4 Partia 2. */
export type PlanBlockKind = 'etap-modul' | 'ai-teresa' | 'vault-kontekst' | 'brama-akceptu';

export interface PlanSchemaBlock {
  /** Stabilny lokalny id (nie myl z `AgentPlanStep.id` — to jest przed utworzeniem planu). */
  id: string;
  kind: PlanBlockKind;
  /** Nazwa klocka, edytowalna (np. "Diagnoza"). */
  name: string;
  /** Moduł/typ pokazywany pod nazwą (np. "Interview · Assessment"). Opcjonalny dla ai-teresa/brama. */
  moduleType?: string;
  /**
   * AGT-008 — konkretne narzędzie z rejestru `toolDefinitions.ts` niesione
   * przez ten klocek (np. `'search_knowledge_base'`, `'calculate_financial'`).
   * Dla `kind === 'vault-kontekst'` zawsze `'search_knowledge_base'` — dobór
   * idzie przez poziom sejfu w `toolInput`, nie przez to pole. Opcjonalne:
   * klocki sprzed AGT-008 (bez tego pola) zachowują się jak dotąd — patrz
   * fallback w `AgentPlanPanel.blocksToSteps`.
   */
  toolName?: string;
  /**
   * Argumenty narzędzia niesione przez klocek. Dla `vault-kontekst`:
   * `vault_scope` ('user'|'organization'|'project'), opcjonalnie
   * `vault_project_id` + `vault_safe_id`/`vault_safe_name` (do odtworzenia
   * wyboru w `<select>` po przeładowaniu — patrz `stepsToBlocks`). Dla
   * pozostałych `kind` zwykle puste — realny `toolInput` istniejącego kroku
   * jest i tak odzyskiwany po `id` w `blocksToSteps`.
   */
  toolInput?: Record<string, unknown>;
}

/** Jedna pozycja katalogu narzędzi do wyboru na klocku (kind !== 'vault-kontekst'). */
export interface ToolCatalogEntry {
  /** MUSI być identyczne z `toolName` w `server/src/services/ai/toolDefinitions.ts` (AI_TOOLS) — trafia 1:1 do `executeToolCall`. */
  name: string;
  label: string;
}

/**
 * AGT-008 — katalog narzędzi do wyboru na klocku. Kurowane odbicie
 * `AI_TOOLS` z `server/src/services/ai/toolDefinitions.ts` (ten sam rejestr,
 * którego używa czat Teresy i executor planu — frontend go nie importuje
 * bezpośrednio, inny target bundlowania/node-only importy). „(akcept)"
 * oznacza narzędzia z `SIDE_EFFECT_TOOLS`
 * (server/src/services/ai/sideEffectTools.ts) — plan zatrzyma się na
 * bramce, zanim je wykona.
 */
export const TOOL_CATALOG: ToolCatalogEntry[] = [
  { name: 'search_knowledge_base', label: 'Szukaj w wiedzy (Vault)' },
  { name: 'get_assessment_data', label: 'Dane oceny (Assessment)' },
  { name: 'calculate_financial', label: 'Kalkulacja finansowa (ROI/NPV)' },
  { name: 'run_monte_carlo', label: 'Symulacja Monte Carlo' },
  { name: 'get_initiative_status', label: 'Status inicjatyw' },
  { name: 'compare_benchmarks', label: 'Porównanie z benchmarkami' },
  { name: 'find_similar_decisions', label: 'Podobne decyzje' },
  { name: 'get_stakeholder_analysis', label: 'Analiza interesariuszy' },
  { name: 'generate_report_section', label: 'Sekcja raportu' },
  { name: 'create_initiative_draft', label: 'Szkic inicjatywy (akcept)' },
  { name: 'schedule_meeting', label: 'Propozycja spotkania (akcept)' },
  { name: 'create_notebook_entry', label: 'Wpis w Notatniku (akcept)' },
  { name: 'query_structured_data', label: 'Zapytanie do danych (akcept)' },
];

/** Bezpieczny, read-only domyślny wybór dla nowego klocka i dla `vault-kontekst`. */
export const DEFAULT_TOOL_NAME = 'search_knowledge_base';

/** Jeden sejf Vault (odbicie `VaultSafe` z `src/views/vault/VaultSafesTable.tsx`) do wyboru poziomu w klocku "Vault-kontekst". */
export interface VaultSafeOption {
  id: string;
  type: 'user' | 'organization' | 'project';
  projectId: string | null;
  name: string;
}

const BLOCK_ICON: Record<PlanBlockKind, LucideIcon> = {
  'etap-modul': Layers,
  'ai-teresa': Sparkles,
  'vault-kontekst': Lock,
  'brama-akceptu': ShieldCheck,
};

const BLOCK_KIND_LABEL_KEY: Record<PlanBlockKind, string> = {
  'etap-modul': 'agentPlan.canvas.kind.etapModul',
  'ai-teresa': 'agentPlan.canvas.kind.aiTeresa',
  'vault-kontekst': 'agentPlan.canvas.kind.vaultKontekst',
  'brama-akceptu': 'agentPlan.canvas.kind.bramaAkceptu',
};

const BLOCK_KIND_FALLBACK: Record<PlanBlockKind, string> = {
  'etap-modul': 'Etap-moduł',
  'ai-teresa': 'AI / Teresa',
  'vault-kontekst': 'Vault-kontekst',
  'brama-akceptu': 'Bramka akceptu',
};

const ALL_KINDS: PlanBlockKind[] = ['etap-modul', 'ai-teresa', 'vault-kontekst', 'brama-akceptu'];

let localIdCounter = 0;
/** Generator id lokalnych klocków — brak zależności od backendu (jeszcze nie istnieją jako kroki). */
export function makeBlockId(): string {
  localIdCounter += 1;
  return `block-local-${Date.now()}-${localIdCounter}`;
}

export interface AgentPlanCanvasProps {
  blocks: PlanSchemaBlock[];
  onChange: (blocks: PlanSchemaBlock[]) => void;
  /** Wywołane po kliknięciu "Uruchom" — wołający odpowiada za wysyłkę do backendu. */
  onRunSchema?: (blocks: PlanSchemaBlock[]) => void;
  /** Blokuje edycję (np. plan już wystartował) — canvas renderuje się wtedy tylko-do-odczytu. */
  readOnly?: boolean;
}

export const AgentPlanCanvas: React.FC<AgentPlanCanvasProps> = ({
  blocks,
  onChange,
  onRunSchema,
  readOnly = false,
}) => {
  const { t } = useTranslation();

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
      // Wchodząc w 'vault-kontekst' narzędzie jest zawsze search_knowledge_base
      // (dobór idzie przez poziom sejfu, nie przez katalog narzędzi) —
      // patrz nagłówek pliku i setBlockVaultSafe niżej.
      if (kind === 'vault-kontekst' && !patched.toolName) {
        patched.toolName = DEFAULT_TOOL_NAME;
      }
      next[index] = patched;
      onChange(next);
    },
    [blocks, onChange]
  );

  /** AGT-008 — wybór KONKRETNEGO narzędzia dla klocka (kind !== 'vault-kontekst'). */
  const setBlockTool = useCallback(
    (index: number, toolName: string) => {
      const next = blocks.slice();
      next[index] = { ...next[index], toolName };
      onChange(next);
    },
    [blocks, onChange]
  );

  /**
   * AGT-008 — wybór POZIOMU sejfu Vault dla klocka 'vault-kontekst'. Zapisuje
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
            }
          : {
              ...prevInput,
              vault_safe_id: undefined,
              vault_scope: undefined,
              vault_project_id: undefined,
              vault_safe_name: undefined,
            },
      };
      onChange(next);
    },
    [blocks, onChange]
  );

  const addBlock = useCallback(() => {
    onChange([
      ...blocks,
      {
        id: makeBlockId(),
        kind: 'etap-modul',
        name: t('agentPlan.canvas.newBlockName', 'Nowy etap'),
        // AGT-008: domyślny (bezpieczny, read-only) wybór — WIDOCZNY i
        // ZMIENIALNY w select "Narzędzie" niżej, nie ukryty fallback jak
        // dotąd (patrz nagłówek pliku i AgentPlanPanel.blocksToSteps).
        toolName: DEFAULT_TOOL_NAME,
      },
    ]);
  }, [blocks, onChange, t]);

  // AGT-008 — lista sejfów Vault (Mój/Organizacja/po jednym na projekt) do
  // wyboru poziomu na klocku 'vault-kontekst'. Ładowana raz, best-effort —
  // brak listy nie blokuje edycji reszty canvasu (np. offline dev-render bez
  // mocka tego endpointu), pokazuje się wtedy tylko pusty select + błąd.
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

  return (
    <div className="space-y-2" data-testid="agent-plan-canvas">
      {blocks.length === 0 ? (
        <p className="text-xs text-c-text-muted py-1.5">
          {t('agentPlan.canvas.empty', 'Pusty schemat — dodaj pierwszy klocek.')}
        </p>
      ) : (
        <ol className="space-y-1.5">
          {blocks.map((block, index) => {
            const Icon = BLOCK_ICON[block.kind];
            return (
              <li
                key={block.id}
                className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface-raised/40 p-2"
              >
                {!readOnly ? (
                  <div className="flex flex-col gap-0.5 pt-0.5 shrink-0">
                    <button
                      type="button"
                      aria-label={t('agentPlan.canvas.moveUp', 'Przesuń w górę')}
                      onClick={() => moveBlock(index, -1)}
                      disabled={index === 0}
                      className="rounded p-0.5 text-c-text-muted hover:text-c-text hover:bg-c-surface-raised disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <ChevronUp size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('agentPlan.canvas.moveDown', 'Przesuń w dół')}
                      onClick={() => moveBlock(index, 1)}
                      disabled={index === blocks.length - 1}
                      className="rounded p-0.5 text-c-text-muted hover:text-c-text hover:bg-c-surface-raised disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <ChevronDown size={12} />
                    </button>
                  </div>
                ) : (
                  <span className="mt-0.5 shrink-0 text-[10px] tabular-nums text-c-text-muted w-4 text-center">
                    {index + 1}
                  </span>
                )}

                <Icon size={14} className="shrink-0 mt-1 text-c-text-muted" />

                <div className="min-w-0 flex-1">
                  {readOnly ? (
                    <div className="text-xs font-medium text-c-text truncate">{block.name}</div>
                  ) : (
                    <input
                      value={block.name}
                      onChange={(e) => renameBlock(index, e.target.value)}
                      aria-label={t('agentPlan.canvas.blockName', 'Nazwa klocka')}
                      className="w-full bg-transparent text-xs font-medium text-c-text rounded px-1 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    />
                  )}
                  {readOnly ? (
                    <div className="text-[10px] text-c-text-muted">
                      {t(BLOCK_KIND_LABEL_KEY[block.kind], BLOCK_KIND_FALLBACK[block.kind])}
                      {block.moduleType ? ` · ${block.moduleType}` : ''}
                      {block.kind === 'vault-kontekst'
                        ? ` · ${
                            typeof block.toolInput?.vault_safe_name === 'string'
                              ? block.toolInput.vault_safe_name
                              : t('agentPlan.canvas.vaultLevelUnset', '— poziom nie wybrany —')
                          }`
                        : block.toolName
                          ? ` · ${TOOL_CATALOG.find((tc) => tc.name === block.toolName)?.label ?? block.toolName}`
                          : ''}
                    </div>
                  ) : (
                    <>
                      <select
                        value={block.kind}
                        onChange={(e) => setBlockKind(index, e.target.value as PlanBlockKind)}
                        aria-label={t('agentPlan.canvas.blockKind', 'Typ klocka')}
                        className="mt-0.5 bg-transparent text-[10px] text-c-text-muted rounded px-1 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                      >
                        {ALL_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {t(BLOCK_KIND_LABEL_KEY[kind], BLOCK_KIND_FALLBACK[kind])}
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
                            const safe = (vaultSafes ?? []).find((s) => s.id === e.target.value);
                            setBlockVaultSafe(index, safe);
                          }}
                          aria-label={t('agentPlan.canvas.vaultLevel', 'Poziom Vault')}
                          className="mt-0.5 bg-transparent text-[10px] text-c-text-muted rounded px-1 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
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
                      ) : (
                        <select
                          value={block.toolName ?? DEFAULT_TOOL_NAME}
                          onChange={(e) => setBlockTool(index, e.target.value)}
                          aria-label={t('agentPlan.canvas.blockTool', 'Narzędzie')}
                          className="mt-0.5 bg-transparent text-[10px] text-c-text-muted rounded px-1 -mx-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                        >
                          {TOOL_CATALOG.map((tool) => (
                            <option key={tool.name} value={tool.name}>
                              {tool.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {block.kind === 'vault-kontekst' && vaultSafesError ? (
                        <p className="text-[10px] text-c-danger mt-0.5">{vaultSafesError}</p>
                      ) : null}
                    </>
                  )}
                </div>

                {!readOnly ? (
                  <button
                    type="button"
                    aria-label={t('agentPlan.canvas.removeBlock', 'Usuń klocek')}
                    onClick={() => removeBlock(index)}
                    className="shrink-0 rounded p-1 text-c-text-muted hover:text-c-danger hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    <Trash2 size={13} />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}

      {!readOnly ? (
        <div className="space-y-1.5 pt-1">
          <PreviewActionButton
            variant="neutral"
            icon={Plus}
            label={t('agentPlan.canvas.addBlock', 'Dodaj klocek')}
            onClick={addBlock}
          />
          {onRunSchema ? (
            <PreviewActionButton
              variant="positive"
              label={t('agentPlan.canvas.run', 'Uruchom')}
              onClick={() => onRunSchema(blocks)}
              disabled={blocks.length === 0}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default AgentPlanCanvas;
