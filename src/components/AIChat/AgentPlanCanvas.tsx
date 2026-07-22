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
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { PreviewActionButton } from '@/components/shared/PreviewPane';

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
      next[index] = { ...next[index], kind };
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
      },
    ]);
  }, [blocks, onChange, t]);

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
                    </div>
                  ) : (
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
