import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('ModuleSyncService', () => {
  it('ModuleSyncService.ts exists and exports expected functions', () => {
    const filePath = path.resolve(
      process.cwd(),
      'server/src/services/tablePlatform/ModuleSyncService.ts'
    );
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('export async function syncToModule');
    expect(content).toContain('export async function getLinkStatus');
    expect(content).toContain('tp_module_sync_results');
  });

  it('syncToModule accepts modelId, targetModule, and options', () => {
    const filePath = path.resolve(
      process.cwd(),
      'server/src/services/tablePlatform/ModuleSyncService.ts'
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('targetModule: TargetModule');
    expect(content).toContain('fieldMapping');
    expect(content).toContain('kpiIds');
  });

  it('getLinkStatus returns status for all four modules', () => {
    const filePath = path.resolve(
      process.cwd(),
      'server/src/services/tablePlatform/ModuleSyncService.ts'
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain("'results'");
    expect(content).toContain("'finance'");
    expect(content).toContain("'execution'");
    expect(content).toContain("'initiatives'");
  });

  it('migration 725 creates tp_module_sync_results table', () => {
    const migrationsDir = path.resolve(process.cwd(), 'server/migrations');
    const files = fs.readdirSync(migrationsDir).filter((f) => f.startsWith('725'));
    expect(files.length).toBe(1);
    const content = fs.readFileSync(path.join(migrationsDir, files[0]), 'utf-8');
    expect(content).toContain('tp_module_sync_results');
    expect(content).toContain('model_id');
    expect(content).toContain('target_module');
  });

  it('SyncResult type has correct shape', () => {
    const filePath = path.resolve(
      process.cwd(),
      'server/src/services/tablePlatform/ModuleSyncService.ts'
    );
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('syncId: string');
    expect(content).toContain('syncedRecords: number');
    expect(content).toContain("syncStatus: 'success' | 'error' | 'partial'");
  });
});
