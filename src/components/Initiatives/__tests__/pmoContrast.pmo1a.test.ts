import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('PMO-1a W119 contrast receipt', () => {
  it('uses semantic colors only on icons or thin borders in PMO-1a UI', () => {
    const panel = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/Initiatives/PmoStageTransitionPanel.tsx'),
      'utf8'
    );
    const inbox = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MyWork/InboxContent.tsx'),
      'utf8'
    );
    const marker = inbox.indexOf('data-testid="my-work-pmo-queues"');
    const source = `${panel}\n${inbox.slice(marker - 300, marker + 2_500)}`;
    expect(source).not.toMatch(/bg-c-(?:success|warning|danger|info|accent)/);
  });

  it('mounts the existing global notification dropdown exactly once', () => {
    const shell = fs.readFileSync(
      path.resolve(process.cwd(), 'src/layouts/MainLayout.tsx'),
      'utf8'
    );
    expect(shell.match(/<NotificationDropdown\s*\/>/g)).toHaveLength(1);
  });

  it('stores PMO copy in the root initiatives namespace in EN and PL', () => {
    const en = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/locales/en/translation.json'), 'utf8')
    );
    const pl = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/locales/pl/translation.json'), 'utf8')
    );
    expect(en.initiatives.pmo.stageTransition).toBe('Stage transition');
    expect(pl.initiatives.pmo.stageTransition).toBe('Przejście etapu');
    expect(en.initiatives.pmo.inbox.acceptance).toBe('Acceptance decision');
    expect(pl.initiatives.pmo.inbox.acceptance).toBe('Decyzja odbiorowa');
  });
});
