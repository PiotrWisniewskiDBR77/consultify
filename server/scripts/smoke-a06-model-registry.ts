#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

type Check = { name: string; pass: boolean };

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function includesAll(content: string, needles: string[]): boolean {
  return needles.every((needle) => content.includes(needle));
}

function main(): void {
  const root = process.cwd();
  const checks: Check[] = [];

  const llmRoutes = read(path.join(root, 'server/src/routes/llm.routes.ts'));
  const modelRegistryService = read(path.join(root, 'server/src/services/ai/modelRegistryService.ts'));
  const backendTypes = read(path.join(root, 'server/src/types/modelRegistry.ts'));
  const uiTypes = read(path.join(root, 'src/components/SuperAdmin/ModelRegistry/types.ts'));
  const uiAuditLog = read(path.join(root, 'src/components/SuperAdmin/ModelRegistry/ModelAuditLog.tsx'));

  checks.push({
    name: 'A06 audit endpoint exists: GET /api/llm/audit-log',
    pass: includesAll(llmRoutes, ["router.get(", "'/audit-log'", 'model_audit_log']),
  });

  checks.push({
    name: 'A06 legacy routes write audit entries',
    pass: includesAll(llmRoutes, [
      'logModelAuditEntry({',
      "action: 'assignment_changed'",
      "action: 'deleted'",
      "entityType: 'policy'",
    ]),
  });

  checks.push({
    name: 'A06 fallback path writes fallback_used audit event',
    pass: includesAll(modelRegistryService, [
      "action: 'fallback_used'",
      "changedBy: 'system:model-router'",
      'selectedModelRegistryId',
      'fallbackReason',
    ]),
  });

  checks.push({
    name: 'A06 backend audit type supports fallback_used',
    pass: backendTypes.includes("'fallback_used'"),
  });

  checks.push({
    name: 'A06 frontend audit type supports fallback_used',
    pass: uiTypes.includes("'fallback_used'"),
  });

  checks.push({
    name: 'A06 frontend audit UI exposes fallback_used',
    pass: includesAll(uiAuditLog, [
      'fallback_used',
      'AlertTriangle',
      '<option value="fallback_used">Fallback Used</option>',
    ]),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-a06-model-registry] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-a06-model-registry] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-a06-model-registry] Failed:', (error as Error)?.message || error);
  process.exit(1);
}

