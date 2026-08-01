/**
 * Uspójnienie F4.6 — kanoniczny deep-link inicjatywy.
 * USPOJNIENIE D1 (2026-06-26): param ujednolicony na `open` (faktyczna konwencja
 * produktu; wcześniej builder emitował `initiativeId`, którego nikt nie czytał).
 */
import { describe, expect, it } from 'vitest';

import {
  buildInitiativeDeepLink,
  readInitiativeDeepLinkId,
  INITIATIVE_DEEP_LINK_PARAM,
} from '../../../src/utils/initiativeDeepLink';

describe('initiativeDeepLink', () => {
  it('builds an initiatives link by default', () => {
    expect(buildInitiativeDeepLink('i1')).toBe('/initiatives?open=i1');
  });

  it('builds module-specific links with tab', () => {
    expect(buildInitiativeDeepLink('i2', { module: 'execution' })).toBe('/execution?open=i2');
    expect(buildInitiativeDeepLink('i3', { module: 'economics', tab: 'models' })).toBe(
      '/finance?tab=models&open=i3'
    );
  });

  it('round-trips: build → read returns the same id', () => {
    const link = buildInitiativeDeepLink('abc-123', { module: 'execution' });
    const search = link.slice(link.indexOf('?'));
    expect(readInitiativeDeepLinkId(search)).toBe('abc-123');
  });

  it('reads id from a raw search string (canonical `open` param)', () => {
    expect(readInitiativeDeepLinkId('?tab=x&open=z9')).toBe('z9');
  });

  it('returns null when absent or empty', () => {
    expect(readInitiativeDeepLinkId('?tab=x')).toBeNull();
    expect(readInitiativeDeepLinkId('?open=')).toBeNull();
  });

  it('exposes the canonical param name (`open` — matches all hub readers)', () => {
    expect(INITIATIVE_DEEP_LINK_PARAM).toBe('open');
  });
});
