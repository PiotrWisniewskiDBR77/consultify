import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

describe('MyTasksListContent completed-task readback contract', () => {
  it('requests terminal tasks so a successful CAS transition remains visible after cold reload', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/MyWork/MyTasksListContent.tsx'),
      'utf8'
    );

    expect(source).toContain('Api.getPersonalTasks({ includeDone: true })');
  });
});
