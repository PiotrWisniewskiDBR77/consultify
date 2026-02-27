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

  const chatActions = read(path.join(root, 'src/types/domain/chatActions.ts'));
  const registry = read(path.join(root, 'src/services/chatActionRegistry.ts'));
  const handler = read(path.join(root, 'src/services/chatActionHandler.ts'));
  const capabilitiesHook = read(path.join(root, 'src/hooks/useChatActionCapabilities.ts'));
  const actionCard = read(path.join(root, 'src/components/Chat/ChatActionCard.tsx'));

  checks.push({
    name: 'B02 unified action catalog defines schema version and definitions',
    pass: includesAll(chatActions, ['ACTION_SCHEMA_VERSION', 'CHAT_ACTION_DEFINITIONS']),
  });

  checks.push({
    name: 'B02 registry validates payloads from central definitions',
    pass: includesAll(registry, [
      'DEFINITIONS_BY_TYPE',
      'validateActionPayload(',
      'getActionDefinition(action.type)',
      'Unknown action type:',
    ]),
  });

  checks.push({
    name: 'B02 capabilities derive from one registry',
    pass: includesAll(capabilitiesHook, ['getAvailableActions', 'checkCapability']),
  });

  checks.push({
    name: 'B02 handler uses payload validation and exhaustive switch',
    pass: includesAll(handler, [
      'const validation = validateActionPayload(action)',
      'const exhaustive: never = action.type',
      'Unhandled action type:',
    ]),
  });

  checks.push({
    name: 'B02 NAVIGATE target module is normalized to supported union',
    pass: includesAll(handler, ['normalizeTargetModule', 'TARGET_MODULES', "targetModule: normalizeTargetModule"]),
  });

  checks.push({
    name: 'B02 action card provides rendered/clicked/failed analytics',
    pass: includesAll(actionCard, [
      "trackFunnelEvent('chat_action_rendered'",
      "trackFunnelEvent('chat_action_clicked'",
      "trackFunnelEvent('chat_action_failed'",
    ]),
  });

  checks.push({
    name: 'B02 action card displays inline error state',
    pass: includesAll(actionCard, ['setError(msg)', 'role="alert"']),
  });

  const failed = checks.filter((check) => !check.pass);

  console.log('\n[smoke-b02-chat-actions] Summary:');
  for (const check of checks) {
    console.log(` - ${check.pass ? 'OK' : 'FAIL'} ${check.name}`);
  }

  if (failed.length > 0) {
    throw new Error(`Smoke failed: ${failed.map((item) => item.name).join(', ')}`);
  }

  console.log('\n[smoke-b02-chat-actions] Contract checks passed.');
}

try {
  main();
} catch (error) {
  console.error('[smoke-b02-chat-actions] Failed:', (error as Error)?.message || error);
  process.exit(1);
}

