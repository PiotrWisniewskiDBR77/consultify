import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(resolve(process.cwd(), 'src/routes/AppRoutes.tsx'), 'utf8');

describe('AppRoutes — Assessment module identity', () => {
  it('mounts the Assessment route with an Assessment breadcrumb and gate label', () => {
    const start = source.indexOf('{/* Assessment Module - New Hub */}');
    const end = source.indexOf('{/* Transformation Modules', start);
    const routeBlock = source.slice(start, end);

    expect(routeBlock).toContain("breadcrumbs={breadcrumbs || ['Assessment']}");
    expect(routeBlock).toContain('moduleName="Assessment"');
    expect(routeBlock).not.toContain("['Tools', 'Licensed']");
  });
});
