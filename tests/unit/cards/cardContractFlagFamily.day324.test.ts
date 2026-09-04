// KONTRAKT DYŻURU 324 — wspólny opt-in ma obejmować całą rodzinę siedmiu kart.
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const callers = [
  'src/components/Initiatives/sections/initiativeCardContract.ts',
  'src/components/MyWork/TaskDetailView.tsx',
  'src/components/MyWork/DecisionDetailView.tsx',
  'src/components/MyWork/NotificationDetailView.tsx',
  'src/components/Interview/InsightViewer.tsx',
  'src/components/Interview/InterviewWorkspace.tsx',
  'src/components/DiscoveryTools/KnownToolDetailView.tsx',
] as const;

describe('Day 324 card-contract flag family', () => {
  it('each of the seven runtime callers reads the shared ff.cardContract key', () => {
    for (const relativePath of callers) {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
      expect(source, relativePath).toContain("localStorage.getItem('ff.cardContract')");
    }
  });
});
