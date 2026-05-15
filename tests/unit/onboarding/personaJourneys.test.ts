import { describe, expect, it } from 'vitest';

import {
  PERSONA_JOURNEYS,
  personaToRouteSlug,
  resolveFirstOnboardingSurface,
  resolvePersonaJourney,
  routeSlugToPersona,
} from '@/services/onboarding/personaJourneys';

describe('personaJourneys', () => {
  it('covers all six personas with distinct primary artifacts', () => {
    expect(Object.keys(PERSONA_JOURNEYS)).toHaveLength(6);
    const artifacts = new Set(Object.values(PERSONA_JOURNEYS).map((journey) => journey.primaryArtifactType));
    expect(artifacts.size).toBeGreaterThanOrEqual(5);
  });

  it('routes CISO to admin-first surface', () => {
    expect(resolveFirstOnboardingSurface('CISO')).toBe('admin_console');
    expect(resolveFirstOnboardingSurface('CFO')).toBe('artifact_seed');
  });

  it('returns the mapped review gate language for CFO', () => {
    expect(resolvePersonaJourney('CFO').reviewGateLanguage).toBe('Audit-ready?');
  });

  it('maps personas to route slugs and back', () => {
    expect(personaToRouteSlug('Transformation Officer')).toBe('transformation-officer');
    expect(routeSlugToPersona('ciso')).toBe('CISO');
  });
});
