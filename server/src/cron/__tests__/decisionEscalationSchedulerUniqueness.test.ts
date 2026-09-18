import { readFileSync } from 'node:fs';
import { fileURLToPath, URL as NodeURL } from 'node:url';

import { describe, expect, it } from 'vitest';

describe('decision escalation scheduler authority', () => {
  it('registers only the canonical daily sweep', () => {
    const source = readFileSync(fileURLToPath(new NodeURL('../Scheduler.ts', import.meta.url)), 'utf8');

    const dailyRegistrations = source.match(
      /cron\.schedule\('10 0 \* \* \*', runDecisionEscalationSchedulerTick/g
    );

    expect(dailyRegistrations).toHaveLength(1);
    expect(source).toContain('runInitiativeStageSlaEscalationTick');
    expect(source).not.toContain('decisionEscalationChainService');
    expect(source).not.toContain('[Scheduler] Running Decision Auto-Escalation');
  });
});
