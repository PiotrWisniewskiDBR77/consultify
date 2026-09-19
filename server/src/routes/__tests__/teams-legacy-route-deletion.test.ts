import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = resolve(here, '..');
const gatewayPath = resolve(routesDir, '..', 'Gateway.ts');

describe('D-15 canonical teams route', () => {
  it('keeps the email-leaking legacy teams router deleted and mounts the organization router', () => {
    expect(existsSync(resolve(routesDir, 'teams.routes.ts'))).toBe(false);

    const gatewaySource = readFileSync(gatewayPath, 'utf8');
    expect(gatewaySource).toContain("./routes/organization/teams.routes.js");
    expect(gatewaySource).not.toContain("./routes/teams.routes.js");
  });
});
