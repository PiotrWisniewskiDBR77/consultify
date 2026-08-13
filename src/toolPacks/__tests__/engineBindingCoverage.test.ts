import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { TOOL_STEP_DEFINITIONS, type ToolType } from '@/store/useToolStore';
import { TOOL_PACKS, getToolPack } from '../registry';
import type { SignatureArchetype } from '../contract';

// --- Real question-bank modules, one static import per engine-backed tool ---
// Importing the REAL module (not re-declaring counts) is the whole point:
// if a bank grows/shrinks and nobody updates the pack, this test must fail —
// same doctrine as questionBankCoverage.test.ts (Dynamic SWOT), extended here
// to the other 18 engine-backed tools (STREAM G4, 2026-08-13).
import { DYNAMIC_SWOT_QUESTION_BANK } from '@/config/swot/dynamicSwotQuestionBank';
import { PORTER_QUESTION_BANK } from '@/config/porter/porterQuestionBank';
import { ANSOFF_QUESTION_BANK } from '@/config/ansoff/ansoffQuestionBank';
import { VALUE_CHAIN_ACTIVITIES } from '@/config/valuechain/valueChainQuestionBank';
import { PORTFOLIO_QUESTION_BANK } from '@/config/portfolio/portfolioQuestionBank';
import { RISK_ITEM_LADDER } from '@/config/riskuncertainty/riskQuestionBank';
import { CAPABILITY_QUESTION_BANK } from '@/config/capabilitymapper/capabilityQuestionBank';
import { AMBITION_QUESTION_BANK } from '@/config/ambitiondecomposer/ambitionQuestionBank';
import { FOCUS_OPTION_LADDER } from '@/config/focustradeoffs/focusQuestionBank';
import { NARRATIVE_PYRAMID_QUESTION_BANK } from '@/config/narrativeengine/pyramidQuestionBank';
import { A3_QUESTION_BANK } from '@/config/a3problemsolving/a3QuestionBank';
import { SOP_QUESTION_BANK } from '@/config/sopbuilder/sopBuilderQuestionBank';
import { SMED_QUESTION_BANK } from '@/config/smedplanner/smedQuestionBank';
import { DMS_QUESTION_BANK } from '@/config/dmsbuilder/dmsBuilderQuestionBank';
import { INVENTORY_QUESTION_BANK } from '@/config/inventoryautopilot/inventoryQuestionBank';
import { RPA_QUESTION_BANK } from '@/config/rpascanner/rpaQuestionBank';
import { AI_DISCOVERY_QUESTION_BANK } from '@/config/aidiscovery/aiDiscoveryQuestionBank';
import { PAIN_QUESTION_BANK } from '@/config/painexplorer/painExplorerQuestionBank';
import { AUTOMATION_QUESTION_BANK } from '@/config/processautomation/automationQuestionBank';

/** Flattens a Record<string, Node[]> bank into a single node count. */
const flat = (bank: Record<string, unknown[]>): number =>
  Object.values(bank).reduce((n, arr) => n + arr.length, 0);

/**
 * REAL node count per engine-backed tool, read from the actual bank module —
 * never hand-copied. Each tool's own comment documents WHICH structure the
 * bank uses (flat array vs. Record<track, Node[]> vs. a meta-list of ladders)
 * because the 19 banks are not structurally uniform (verified by reading
 * every module in src/config/<tool>/ during this stream).
 */
const REAL_NODE_COUNTS: Record<string, number> = {
  'dynamic-swot': flat(DYNAMIC_SWOT_QUESTION_BANK as unknown as Record<string, unknown[]>), // Record<quadrant, Node[]>
  'market-forces': flat(PORTER_QUESTION_BANK as unknown as Record<string, unknown[]>), // Record<force, Node[]> (5 forces x 4)
  'growth-paths': ANSOFF_QUESTION_BANK.length, // flat ladder
  'value-chain': VALUE_CHAIN_ACTIVITIES.length, // meta-list of 9 activities, each its OWN 4-rung ladder (template, not enumerated)
  'portfolio-priority': flat(PORTFOLIO_QUESTION_BANK as unknown as Record<string, unknown[]>), // Record<track, Node[]> (1 track)
  'risk-uncertainty': RISK_ITEM_LADDER.length, // flat ladder
  'capability-mapper': flat(CAPABILITY_QUESTION_BANK as unknown as Record<string, unknown[]>), // Record<track, Node[]> (1 track)
  'ambition-decomposer': AMBITION_QUESTION_BANK.length, // flat ladder
  'focus-tradeoff': FOCUS_OPTION_LADDER.length, // flat ladder
  'narrative-engine': flat(NARRATIVE_PYRAMID_QUESTION_BANK as unknown as Record<string, unknown[]>), // Record<pyramid category, Node[]>
  'a3-problem-solving': flat(A3_QUESTION_BANK as unknown as Record<string, unknown[]>), // Record<A3 step, Node[]>
  'sop-builder': SOP_QUESTION_BANK.length, // flat ladder
  'smed-planner': SMED_QUESTION_BANK.length, // flat ladder
  'dms-builder': DMS_QUESTION_BANK.length, // flat ladder
  'inventory-autopilot': INVENTORY_QUESTION_BANK.length, // flat ladder
  'rpa-scanner': RPA_QUESTION_BANK.length, // flat ladder
  'ai-discovery': AI_DISCOVERY_QUESTION_BANK.length, // flat ladder
  'pain-explorer': PAIN_QUESTION_BANK.length, // flat ladder
  'process-automation': AUTOMATION_QUESTION_BANK.length, // flat ladder
};

const ENGINE_BACKED_TOOL_TYPES = Object.keys(REAL_NODE_COUNTS);

const ALL_ARCHETYPES: SignatureArchetype[] = [
  'quadrant-strategic-field',
  'force-radial',
  'decision-matrix-portfolio',
  'flow-value-stream',
  'causal-problem-solving',
  'architecture-capability',
  'operating-model-standard',
  'discovery-candidate-funnel',
];

/**
 * Contract test extending questionBankCoverage.test.ts's pattern (which
 * covers Dynamic SWOT only) to ALL 19 engine-backed Tools. Must fail loudly
 * for any tool where the pack and the code have drifted:
 *  - engine.engineDir / engine.questionBankModule point at real files on disk
 *  - engine.expectedQuestionNodeCount matches the REAL bank (imported above)
 *  - pack.phases ids match the REAL TOOL_STEP_DEFINITIONS for that toolType
 *    (src/store/useToolStore.ts — now exported for exactly this reason)
 *  - every pack declares a signature archetype, and the 19 collectively
 *    cover all 8 archetypes at least once (STREAM G4 deliverable)
 */
describe('pokrycie wiązania z silnikiem — wszystkie 19 narzędzi z silnikiem', () => {
  it('lista 19 pokrywa się z packami PACK_COMPLETE w rejestrze', () => {
    const complete = TOOL_PACKS.filter((p) => p.contentStatus === 'PACK_COMPLETE').map((p) =>
      String(p.toolType)
    );
    expect(complete.sort()).toEqual([...ENGINE_BACKED_TOOL_TYPES].sort());
  });

  describe.each(ENGINE_BACKED_TOOL_TYPES)('%s', (toolType) => {
    it('ma pack zdefiniowany w rejestrze', () => {
      expect(getToolPack(toolType)).toBeDefined();
    });

    it('engine.engineDir istnieje na dysku', () => {
      const pack = getToolPack(toolType)!;
      const dir = pack.engine!.engineDir;
      expect(dir, `${toolType}: brak engine.engineDir`).toBeTruthy();
      const resolved = path.resolve(process.cwd(), dir);
      expect(fs.existsSync(resolved), `${toolType}: ${dir} nie istnieje na dysku`).toBe(true);
      expect(fs.statSync(resolved).isDirectory(), `${toolType}: ${dir} nie jest katalogiem`).toBe(
        true
      );
    });

    it('engine.questionBankModule istnieje na dysku', () => {
      const pack = getToolPack(toolType)!;
      const modulePath = pack.engine!.questionBankModule;
      expect(modulePath, `${toolType}: brak engine.questionBankModule`).toBeTruthy();
      const resolved = path.resolve(process.cwd(), modulePath);
      expect(fs.existsSync(resolved), `${toolType}: ${modulePath} nie istnieje na dysku`).toBe(
        true
      );
    });

    it('engine.expectedQuestionNodeCount zgadza się z REALNYM bankiem pytań', () => {
      const pack = getToolPack(toolType)!;
      const declared = pack.engine!.expectedQuestionNodeCount;
      const real = REAL_NODE_COUNTS[toolType];
      expect(
        declared,
        `${toolType}: pack deklaruje ${declared} węzłów, realny bank ma ${real}. ` +
          `Zaktualizuj engine.expectedQuestionNodeCount w src/toolPacks/packs/.`
      ).toBe(real);
    });

    it('fazy packa zgadzają się DOKŁADNIE z realnym TOOL_STEP_DEFINITIONS (kolejność + zbiór)', () => {
      const pack = getToolPack(toolType)!;
      const packPhaseIds = pack.phases.map((p) => p.id);
      const runtimeStepIds = (TOOL_STEP_DEFINITIONS[toolType as ToolType] || []).map((s) => s.id);
      expect(
        packPhaseIds,
        `${toolType}: fazy packa [${packPhaseIds.join(',')}] != kroki runtime [${runtimeStepIds.join(',')}]`
      ).toEqual(runtimeStepIds);
    });

    it('deklaruje archetyp geometrii sygnaturowej z kanonicznego zbioru 8', () => {
      const pack = getToolPack(toolType)!;
      expect(ALL_ARCHETYPES).toContain(pack.signatureArchetype);
    });

    it('bankBackedPhaseIds wskazują fazy, które faktycznie istnieją w packu', () => {
      const pack = getToolPack(toolType)!;
      const phaseIds = new Set(pack.phases.map((p) => p.id));
      (pack.engine!.bankBackedPhaseIds || []).forEach((id) => {
        expect(phaseIds.has(id), `${toolType}: bankBackedPhaseIds zawiera nieznaną fazę "${id}"`).toBe(
          true
        );
      });
    });
  });

  it('19 narzędzi z silnikiem pokrywa WSZYSTKIE 8 archetypów co najmniej raz', () => {
    const covered = new Set(
      ENGINE_BACKED_TOOL_TYPES.map((t) => getToolPack(t)!.signatureArchetype)
    );
    expect([...covered].sort()).toEqual([...ALL_ARCHETYPES].sort());
  });

  it('rozjazd wykrywalny: gdyby ktoś podmienił toolType w mapie liczników, test node-count złapie to (sanity check własnej mapy)', () => {
    // Każdy z 19 kluczy REAL_NODE_COUNTS musi mieć odpowiadający pack PACK_COMPLETE —
    // strzeże przed literówką w kluczu tej mapy testowej samej w sobie.
    ENGINE_BACKED_TOOL_TYPES.forEach((t) => {
      const pack = getToolPack(t);
      expect(pack, `klucz "${t}" w REAL_NODE_COUNTS nie odpowiada żadnemu packowi`).toBeDefined();
      expect(pack!.contentStatus).toBe('PACK_COMPLETE');
    });
  });
});
