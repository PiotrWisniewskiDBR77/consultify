/**
 * MVP audit 05/06.09.2026 (evidence/audyt-mvp-20260906/B2/RAPORT_B2.md,
 * WAŻNY #9 / defekt 5): the Organization module's flagship screen
 * ("Kraj siedziby" field, src/components/Organization/redesign/
 * OrganizationIdentityOperatingScreen.tsx:737) showed "PL · Silesia" — an
 * English region name in an otherwise fully Polish demo org profile.
 * Traced to `organization_context.location` seeded in
 * server/scripts/seed-interview-demo.ts:337, which flows through
 * `resolvedContext.profile.location` (server/src/routes/organization/
 * organization-profiles.routes.ts:268-269) straight into
 * `headquarters_country`, rendered verbatim with no translation layer.
 *
 * Fix: seed the Polish region name "Śląskie" instead of "Silesia".
 *
 * Mutation check: reverting the literal back to 'PL · Silesia' makes this
 * test fail.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
  path.join(process.cwd(), 'server/scripts/seed-interview-demo.ts'),
  'utf8'
);

describe('seed-interview-demo.ts — organization_context.location is fully Polish', () => {
  it('does not seed the English region name "Silesia"', () => {
    expect(SOURCE).not.toMatch(/\bSilesia\b/);
  });

  it('seeds the Polish region name "Śląskie" for the demo org location', () => {
    expect(SOURCE).toMatch(/location:\s*'PL · Śląskie'/);
  });
});
