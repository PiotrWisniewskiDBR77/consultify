import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Gate A / WP-A04 follow-up: the three FIN-06 candidate-handoff mounts
// (investment-case, statement-pack, valuation-recommendation) were mounted
// in Gateway.ts without gatewayVerifyToken, unlike every sibling finance
// mount (e.g. /api/financial-modeling). Each router's requireUser() throws
// on a missing req.user, so this was "broken for everyone" rather than an
// open hole, but it diverged from the documented convention in the route
// files' own header comments ("whichever verifyToken-equivalent already
// runs ahead of this router populates req.user") without anything actually
// running ahead. This test pins the mount wiring statically so a future
// edit cannot silently drop the guard again.
describe('finance candidate-handoff mounts require gatewayVerifyToken', () => {
  const gatewaySrc = readFileSync(
    path.resolve(__dirname, '../../Gateway.ts'),
    'utf8'
  );

  const mounts = [
    "'/api/finance/candidate-handoff/investment-case'",
    "'/api/finance/candidate-handoff/statement-pack'",
    "'/api/finance/candidate-handoff/valuation-recommendation'",
  ];

  it.each(mounts)('%s mount includes gatewayVerifyToken', (mountPath) => {
    const idx = gatewaySrc.indexOf(mountPath);
    expect(idx).toBeGreaterThan(-1);
    const mountBlock = gatewaySrc.slice(idx, idx + 200);
    expect(mountBlock).toContain('gatewayVerifyToken');
  });
});
