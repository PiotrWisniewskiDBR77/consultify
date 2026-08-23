import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  type LegacyCutoverDomainConfig,
  summarizeLegacyCutoverInventory,
} from '../legacyCutoverKernel.js';
import { FINANCE_CUTOVER, FINANCE_MODELING_CUTOVER } from '../registry.js';
import { ECONOMICS_CUTOVER } from '../registry/economics.js';
import { FINANCE_STATEMENTS_CUTOVER } from '../registry/financeStatements.js';

const CONFIGS: LegacyCutoverDomainConfig[] = [
  FINANCE_CUTOVER,
  FINANCE_MODELING_CUTOVER,
  ECONOMICS_CUTOVER,
  FINANCE_STATEMENTS_CUTOVER,
];

describe('FIN-MVP-CUTOVER exact mounted-route denominator', () => {
  it('separates actual legacy mutations from POST-shaped reads, refusals and canonical handoffs', () => {
    expect(summarizeLegacyCutoverInventory(CONFIGS)).toEqual({
      totalRules: 59,
      legacyMutationDoors: 51,
      canonicalMutationDoors: 2,
      nonMutationDoors: 6,
      retiredLegacyMutationDoors: 44,
      openLegacyMutationDoors: 7,
    });
  });

  it('requires every non-legacy classification to carry a literal reason that names its effect', () => {
    const classified = CONFIGS.flatMap((config) => config.writers).filter(
      (rule) => rule.effect && rule.effect !== 'legacy-write'
    );

    expect(classified.map((rule) => rule.writerId).sort()).toEqual([
      'ECO-W08',
      'ECO-W09',
      'ECO-W11',
      'ECO-W18',
      'ECO-W19',
      'ECO-W20',
      'ECO-W30',
      'FS-W14',
    ]);
    for (const rule of classified) {
      if (rule.effect === 'read-only') expect(rule.reason).toContain('NO database write');
      if (rule.effect === 'refusal') expect(rule.reason).toMatch(/410|501/);
      if (rule.effect === 'canonical-write') expect(rule.reason).toContain('canonical');
    }
  });

  it('routes every mounted valuation PPTX export caller through the canonical successor', () => {
    const files = [
      'src/components/Benefits/ValuationWorkspace.tsx',
      'src/components/Economics/FinancePreviewPanel.tsx',
      'src/components/Economics/hooks/useFinanceRowActions.ts',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(source).toContain('exportCanonicalLegacyValuationPptx');
      expect(source).not.toMatch(/Api\.post\([^\n]*\/api\/economics\/valuations\/.*export\/pptx/);
    }
  });

  it('routes the mounted valuation discard caller through the canonical successor', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Economics/hooks/useFinanceRowActions.ts'),
      'utf8'
    );
    expect(source).toContain('discardCanonicalLegacyValuation');
    expect(source).not.toMatch(/Api\.delete\([^\n]*\/api\/economics\/valuations/);
  });

  it('routes every mounted budget-create caller through one canonical registration command', () => {
    const files = [
      'src/services/conversionService.ts',
      'src/components/Benefits/BudgetWorkspace.tsx',
      'src/components/Economics/modals/CreateBudgetModal.tsx',
      'src/components/Economics/hooks/useFinanceRowActions.ts',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(source).toContain('V8FinanceApi.createBudget');
      expect(source).not.toMatch(/Api\.post\(['"`]\/api\/economics\/budgets['"`]/);
      expect(source).not.toMatch(
        /fetch\(`\$\{API_URL\}\/economics\/budgets`,\s*\{\s*method:\s*'POST'/
      );
    }
  });

  it('routes the mounted budget document import through multipart V8 without a legacy fallback', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Benefits/BudgetWorkspace.tsx'),
      'utf8'
    );
    expect(source).toContain('V8FinanceApi.importBudgetDocument');
    expect(source).not.toContain('/economics/budgets/${selected.id}/import-document');
    expect(source).not.toContain('docImportFile.text()');
  });

  it('routes the mounted budget initiative link through canonical CAS without a legacy fallback', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Benefits/BudgetWorkspace.tsx'),
      'utf8'
    );
    expect(source).toContain('V8FinanceApi.linkBudgetInitiative');
    expect(source).not.toMatch(
      /method:\s*'POST'[\s\S]{0,300}economics\/budgets\/\$\{selected\.id\}\/initiatives/
    );
  });

  it('routes the mounted budget initiative unlink through canonical CAS without a legacy fallback', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Benefits/BudgetWorkspace.tsx'),
      'utf8'
    );
    expect(source).toContain('V8FinanceApi.unlinkBudgetInitiative');
    expect(source).not.toMatch(
      /method:\s*'DELETE'[\s\S]{0,300}economics\/budgets\/\$\{selected\.id\}\/initiatives/
    );
  });

  it('routes every mounted budget-line mutation through the canonical CAS command', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Benefits/BudgetWorkspace.tsx'),
      'utf8'
    );
    expect(source).toContain('V8FinanceApi.updateBudgetLine');
    expect(source).not.toMatch(
      /fetch\(`\$\{API_URL\}\/economics\/budgets\/\$\{selected\.id\}\/lines\//
    );
  });

  it('routes every mounted budget projection through the canonical CAS command', () => {
    const files = [
      'src/components/Benefits/BudgetWorkspace.tsx',
      'src/components/Economics/FinancePreviewPanel.tsx',
      'src/components/Economics/hooks/useFinanceRowActions.ts',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(source).toContain('V8FinanceApi.projectBudgetScenario');
      expect(source).not.toMatch(
        /(?:Api\.post|fetch)\([^\n]*\/api\/economics\/budgets\/.*\/scenarios\/.*\/project/
      );
    }
  });

  it('routes every mounted budget approval through the canonical maker-checker command', () => {
    const files = [
      'src/components/Benefits/BudgetWorkspace.tsx',
      'src/components/Economics/FinancePreviewPanel.tsx',
      'src/components/Economics/hooks/useFinanceRowActions.ts',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(source).toContain('V8FinanceApi.approveBudget');
      expect(source).not.toMatch(
        /(?:Api\.post|fetch)\([^\n]*\/api\/economics\/budgets\/.*\/approve/
      );
    }
  });

  it('routes the mounted budget discard caller through the canonical successor', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Economics/hooks/useFinanceRowActions.ts'),
      'utf8'
    );
    expect(source).toContain('V8FinanceApi.discardBudget');
    expect(source).not.toMatch(/Api\.delete\([^\n]*\/api\/economics\/budgets/);
  });

  it('routes the mounted Finance settings caller through canonical CAS without a legacy fallback', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/settings/OrganizationSettings.tsx'),
      'utf8'
    );
    expect(source).toContain('V8FinanceApi.getSettings');
    expect(source).toContain('V8FinanceApi.updateSettings');
    expect(source).not.toContain("Api.put('/api/economics/finance-settings'");
  });

  it('retires irreversible digitization-analysis deletion behind the archive successor', () => {
    const writer = ECONOMICS_CUTOVER.writers.find((rule) => rule.writerId === 'ECO-W12');
    expect(writer).toMatchObject({
      state: 'disabled',
      successor: '/api/v8/finance/digitization-analyses/:analysisId/archive',
    });
    const client = fs.readFileSync(
      path.resolve(process.cwd(), 'src/services/api/v8/finance.ts'),
      'utf8'
    );
    expect(client).toContain('archiveDigitizationAnalysis');
    expect(client).toContain('/finance/digitization-analyses/${analysisId}/archive');
  });

  it('routes digitization analysis promotion through Candidate instead of direct Initiative creation', () => {
    const writer = ECONOMICS_CUTOVER.writers.find((rule) => rule.writerId === 'ECO-W10');
    expect(writer).toMatchObject({
      state: 'disabled',
      successor: '/api/finance/candidate-handoff/digitization-analysis/:analysisId/confirm',
    });
    const client = fs.readFileSync(path.resolve(process.cwd(), 'src/services/api.ts'), 'utf8');
    expect(client).toContain('confirmDigitizationAnalysisCandidateHandoff');
    expect(client).not.toContain('`${API_URL}/economics/analyses/${analysisId}/create-initiative`');
  });

  it('routes all mounted digitization-analysis creation callers through canonical registration', () => {
    for (const file of [
      'src/services/conversionService.ts',
      'src/components/Economics/InitiativeFinancialIntegration.tsx',
      'src/services/api.ts',
    ]) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(source).toContain('createDigitizationAnalysis');
      expect(source).not.toContain("Api.post('/economics/analyses'");
      expect(source).not.toContain('`${API_URL}/economics/analyses`,');
    }
    expect(ECONOMICS_CUTOVER.writers.find((rule) => rule.writerId === 'ECO-W01')).toMatchObject({
      state: 'disabled',
      successor: '/api/v8/finance/digitization-analyses',
    });
  });

  it('routes digitization-analysis updates through canonical optimistic CAS', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/services/api.ts'), 'utf8');
    expect(source).toContain('V8FinanceApi.updateDigitizationAnalysis');
    expect(source).not.toMatch(
      /fetchWithRetry\(`\$\{API_URL\}\/economics\/analyses\/\$\{id\}`,[\s\S]{0,120}method:\s*'PUT'/
    );
    expect(ECONOMICS_CUTOVER.writers.find((rule) => rule.writerId === 'ECO-W02')).toMatchObject({
      state: 'disabled',
      successor: '/api/v8/finance/digitization-analyses/:analysisId',
    });
  });

  it('routes digitization-analysis Initiative linking through one atomic canonical command', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'src/services/api.ts'), 'utf8');
    expect(source).toContain('V8FinanceApi.linkDigitizationAnalysisInitiative');
    expect(source).not.toContain('/link-initiative`');
    expect(ECONOMICS_CUTOVER.writers.find((rule) => rule.writerId === 'ECO-W03')).toMatchObject({
      state: 'disabled',
      successor: '/api/v8/finance/digitization-analyses/:analysisId/initiative-link',
    });
  });

  it('routes active digitization financials writes through one atomic canonical command', () => {
    for (const file of [
      'src/services/api.ts',
      'src/components/Economics/InitiativeFinancialIntegration.tsx',
    ]) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(source).toContain('updateAnalysisFinancials');
    }
    const api = fs.readFileSync(path.resolve(process.cwd(), 'src/services/api.ts'), 'utf8');
    expect(api).toContain('V8FinanceApi.persistDigitizationAnalysisFinancials');
    expect(api).not.toMatch(
      /economics\/analyses\/\$\{analysisId\}\/financials[\s\S]{0,120}method:\s*'PUT'/
    );
    expect(ECONOMICS_CUTOVER.writers.find((rule) => rule.writerId === 'ECO-W04')).toMatchObject({
      state: 'disabled',
      successor: '/api/v8/finance/digitization-analyses/:analysisId/financials',
    });
  });

  it('routes scenario authoring and activation through canonical CAS commands', () => {
    const api = fs.readFileSync(path.resolve(process.cwd(), 'src/services/api.ts'), 'utf8');
    expect(api).toContain('V8FinanceApi.upsertDigitizationAnalysisScenario');
    expect(api).toContain('V8FinanceApi.activateDigitizationAnalysisScenario');
    for (const id of ['ECO-W05', 'ECO-W06'])
      expect(ECONOMICS_CUTOVER.writers.find((rule) => rule.writerId === id)?.state).toBe(
        'disabled'
      );
  });

  it('routes benefit planning through Finance while refusing Results-owned Actual', () => {
    const api = fs.readFileSync(path.resolve(process.cwd(), 'src/services/api.ts'), 'utf8');
    expect(api).toContain('/v8/finance/digitization-analyses/${analysisId}/planned-benefits');
    expect(api).toContain('Actual benefits są własnością Results');
    expect(ECONOMICS_CUTOVER.writers.find((rule) => rule.writerId === 'ECO-W07')).toMatchObject({
      state: 'disabled',
      successor: '/api/v8/finance/digitization-analyses/:analysisId/planned-benefits',
    });
  });

  it('routes analysis duplication through the governed full-draft clone', () => {
    const api = fs.readFileSync(path.resolve(process.cwd(), 'src/services/api.ts'), 'utf8');
    expect(api).toContain('/v8/finance/digitization-analyses/${id}/duplicate');
    expect(api).not.toContain('`${API_URL}/economics/analyses/${id}/duplicate`');
    expect(ECONOMICS_CUTOVER.writers.find((rule) => rule.writerId === 'ECO-W13')).toMatchObject({
      state: 'disabled',
      successor: '/api/v8/finance/digitization-analyses/:analysisId/duplicate',
    });
  });

  it('routes statement upload-and-analyze only through the mounted V8 ingest owner', () => {
    const wizard = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Finance/FinancialStatementImportWizard.tsx'),
      'utf8'
    );
    expect(wizard).toContain('V8FinanceApi.uploadAndAnalyzeStatement');
    expect(wizard).not.toContain("'/api/finance-statements/upload-and-analyze'");
    expect(
      FINANCE_STATEMENTS_CUTOVER.writers.find((rule) => rule.writerId === 'FS-W02')
    ).toMatchObject({
      state: 'disabled',
      successor: '/api/v8/finance/statements/upload-and-analyze',
    });
  });

  it('routes the mounted statement editing flow exclusively through governed V8 writes', () => {
    const files = [
      'src/components/Finance/FinancialStatementImportWizard.tsx',
      'src/components/Finance/FinancialStatementWorkspace.tsx',
      'src/components/Economics/FinanceHub.tsx',
      'src/components/Economics/hooks/useFinanceRowActions.ts',
    ];
    for (const file of files) {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(
        /finance-statements\/\$\{[^}]+\}\/(detect|extract|map|values|validate|confirm)/
      );
    }
    for (const id of ['FS-W03', 'FS-W04', 'FS-W05', 'FS-W06', 'FS-W07', 'FS-W08']) {
      expect(FINANCE_STATEMENTS_CUTOVER.writers.find((rule) => rule.writerId === id)?.state).toBe(
        'disabled'
      );
    }
  });
});
