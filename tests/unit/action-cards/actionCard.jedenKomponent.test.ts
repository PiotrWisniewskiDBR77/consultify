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

  it('utrzymuje rejestr action zgodny z pięcioma produkcyjnymi wołaczami', () => {
    const registry = readFileSync(resolve(root, 'src/components/standard/registry.ts'), 'utf8');
    const callers = spawnSync('rg', ['-l', '<ActionCard', 'src/components/ResultsVNext', 'src/components/Execution', 'src/components/Audit', 'src/components/Finance', 'src/components/MyWork', '-g', '!**/__tests__/**', '-g', '!src/components/standard/**'], { cwd: root, encoding: 'utf8' });
    expect(callers.status).toBe(0);
    const directories = new Set(callers.stdout.trim().split('\n').map((file) => file.split('/')[2]));
    expect([...directories].sort()).toEqual(['Audit', 'Execution', 'Finance', 'MyWork', 'ResultsVNext']);
    expect(registry).toContain("statusMigracji: 'zmigrowana'");
  });

  it('usuwa trzy historyczne implementacje karty działania', () => {
    const result = spawnSync('rg', ['-n', '-e', 'ChatActionCard', '-e', 'DefinitionRemediationQueue', '-e', 'ActionItemsPanel', 'src', '-g', '!**/__tests__/**'], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(1);
  });

  it('nie pozwala powierzchniom budować własnego markup karty działania', () => {
    const result = spawnSync('rg', ['-n', '<article[^>]*data-action-card', 'src', '-g', '!**/__tests__/**', '-g', '!src/components/standard/**'], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(1);
  });

  it('nie zapisuje canonical_inbox_items poza inboxService', () => {
    const result = spawnSync('rg', ['-n', 'INSERT INTO canonical_inbox_items', 'server/src', '-g', '!**/__tests__/**', '-g', '!**/inboxService.ts'], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout.trim()).toBe('');
  });

  it('renderuje klikalny InitiativeSourceLink we wszystkich miejscach rodowodu', () => {
    const links = spawnSync('rg', ['-n', '<InitiativeSourceLink', 'src', '-g', '!**/__tests__/**'], { cwd: root, encoding: 'utf8' });
    expect(links.status).toBe(0);
    expect(links.stdout.trim().split('\n').length).toBe(10);
    const labels = spawnSync('rg', ['-n', 'getSourceDisplayLabel', 'src', '-g', '!**/__tests__/**', '-g', '!**/InitiativeSourceLink.tsx'], { cwd: root, encoding: 'utf8' });
    expect(labels.status).toBe(1);
  });

  it('łączy K1 i K2 z kanonicznymi wołaczami oraz blokuje drugi klik K1', () => {
    const meeting = readFileSync(resolve(root, 'src/components/Meeting/MeetingObjectPage.tsx'), 'utf8');
    expect(meeting).toContain('/action-items/${actionIndex}/task');
    expect(meeting).toContain('if (actionItemTasks[key]) return');
    expect(meeting).toContain('disabled={Boolean(taskState)}');
    const initiative = readFileSync(resolve(root, 'src/components/Initiatives/InitiativeDocumentView.tsx'), 'utf8');
    expect(initiative).toContain('requestHandoffAcceptance(initiativeId');
    expect(initiative).toContain("id: 'request-handoff-acceptance'");
    const inbox = readFileSync(resolve(root, 'src/components/MyWork/InboxContent.tsx'), 'utf8');
    expect(inbox).toContain('<HandoffAcceptanceQueue />');
  });

  it('migracja jest addytywna i zachowuje identyfikatory tekstowe SSOT', () => {
    const migration = readFileSync(resolve(root, 'server/migrations/20261105_action_cards_spine.sql'), 'utf8');
    expect(migration).not.toMatch(/\bDROP\b/i);
    expect(migration).not.toMatch(/\bALTER\s+TABLE\b/i);
    expect(migration).toContain('organization_id TEXT NOT NULL');
    expect(migration).toContain('owner_user_id TEXT NOT NULL');
  });
});
