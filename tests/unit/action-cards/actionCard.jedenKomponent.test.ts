/** @vitest-environment node */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

describe('P9 action-card spine static gates', () => {
  it('rejestruje wspólny komponent jako ósmą kartę N', () => {
    const registry = readFileSync(resolve(root, 'src/components/standard/registry.ts'), 'utf8');
    expect(registry).toContain("| 'action'");
    expect(registry).toContain("komponent: 'src/components/standard/ActionCard.tsx'");
  });

  it('nie zapisuje canonical_inbox_items poza inboxService', () => {
    const result = spawnSync('rg', ['-n', 'INSERT INTO canonical_inbox_items', 'server/src', '-g', '!**/__tests__/**', '-g', '!**/inboxService.ts'], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe('');
  });

  it('migracja jest addytywna i zachowuje identyfikatory tekstowe SSOT', () => {
    const migration = readFileSync(resolve(root, 'server/migrations/20261105_action_cards_spine.sql'), 'utf8');
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(migration).toContain('organization_id TEXT NOT NULL');
    expect(migration).toContain('owner_user_id TEXT NOT NULL');
  });
});
