# Consulting Tools Standard Rollout V1

> Status: rollout map  
> Depends on: `docs/product/CONSULTING_TOOLS_STANDARD_V1.md`

---

## 1. Purpose

This rollout plan defines the migration order for applying the new consulting tools standard across the tool portfolio.

The goal is to avoid rebuilding every tool at once and instead move in waves based on structural similarity to `Dynamic SWOT`.

---

## 2. Reference Files

### Frontend

- `src/components/DiscoveryTools/KnownToolDetailView.tsx`
- `src/components/DiscoveryTools/ToolDocumentView.tsx`
- `src/components/DiscoveryTools/ToolCanvas.tsx`
- `src/components/shared/NModeLayout/NModeShell.tsx`
- `src/components/shared/ToolWizard/defaultToolConfigs.ts`
- `src/config/consultingToolsStandard.ts`

### Runtime / AI

- `src/store/useToolStore.ts`
- `src/hooks/discovery/useToolAI.ts`
- `src/services/outputsScaffolding.ts`

### Backend / Content

- `server/src/services/KnownToolsService.ts`
- `server/src/services/KnowledgeBaseService.ts`
- `docs/product/TOOL_BUILD_CHECKLIST_V1.md`

---

## 3. Rollout Waves

### Wave 1: Strategic Tools Closest To SWOT

These tools should adopt the standard first because they already fit a similar consulting pattern:

- `market-forces`
- `growth-paths`
- `portfolio-priority`
- `risk-uncertainty`

Required migration focus:

- align runtime stages to `entry -> conversation -> context -> analysis -> applied conclusions -> final summary -> outputs`
- align session shell to the `N`-mode session contract
- align AI to the mentor / consultant / challenger contract
- expose the four standard outputs
- make `final source summary` the canonical downstream artifact
- align KB article with the same stage language

### Wave 2: Remaining Strategic Synthesis Tools

- `value-chain`
- `ambition-decomposer`
- `focus-tradeoff`
- `capability-mapper`
- `narrative-engine`

Required migration focus:

- replace any legacy step naming with the standard consulting flow
- add the applied-conclusions layer before outputs
- keep tool-specific analysis logic, but normalize review/output behavior
- ensure library preview and KB use the same runtime wording

### Wave 3: Operational And Automation Tools

- `sop-builder`
- `a3-problem-solving`
- `smed-planner`
- `dms-builder`
- `inventory-autopilot`
- `vsm-builder`
- `constraint-control`
- `decision-engine`
- `control-tower`
- `automation-pipeline`
- `robotics-feasibility`
- `logistics-automation`
- `rpa-scanner`
- `ai-discovery`
- `integration-diagnostic`
- `digital-value-pool`
- `legacy-analyzer`
- `data-inventory`
- `pain-to-solution`
- `pain-explorer`
- `process-automation`

Required migration focus:

- adapt standard flow to table/hybrid/automation surfaces
- preserve the same AI mentor behavior even if the work surface is more operational
- keep the same review/finalize/output contract
- preserve the canonical output and KB linkage model

---

## 4. Wave Exit Criteria

Each wave is complete only when every tool in the wave:

- has complete Known Tools preview content,
- has one deterministic KB article,
- uses the canonical session shell,
- uses the AI mentor contract,
- exposes applied conclusions and final source summary,
- exposes the standard outputs contract,
- passes smoke path `Library -> Session -> Outputs`.

---

## 5. Execution Rule

No new consulting tool should skip the current standard and invent a bespoke runtime.

Every new build or rebuild must start from:

1. `docs/product/CONSULTING_TOOLS_STANDARD_V1.md`
2. `docs/product/TOOL_BUILD_CHECKLIST_V1.md`
3. `src/config/consultingToolsStandard.ts`
