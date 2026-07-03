/**
 * M13 flow redesign — canonical initiative document deep link + post-handoff
 * landing decision (creation must land the user IN the document).
 */
import { describe, expect, it } from 'vitest';

import {
  getHandoffLandingPath,
  initiativeDocumentPath,
} from '@/utils/initiativeLinks';

describe('initiativeDocumentPath', () => {
  it('builds the canonical /initiatives?open=<id>&mode=doc deep link', () => {
    expect(initiativeDocumentPath('init-123')).toBe('/initiatives?open=init-123&mode=doc');
  });

  it('URL-encodes the initiative id', () => {
    expect(initiativeDocumentPath('id with space')).toBe(
      '/initiatives?open=id+with+space&mode=doc'
    );
  });

  it('preserves extra params but never lets them clobber open/mode', () => {
    const path = initiativeDocumentPath('init-1', {
      params: { source: 'interview', open: 'evil', mode: 'drawer', empty: '' },
    });
    const search = new URLSearchParams(path.split('?')[1]);
    expect(search.get('open')).toBe('init-1');
    expect(search.get('mode')).toBe('doc');
    expect(search.get('source')).toBe('interview');
    expect(search.has('empty')).toBe(false);
  });
});

describe('getHandoffLandingPath', () => {
  it('lands in the document when a NEW initiative is created', () => {
    expect(getHandoffLandingPath({ mode: 'create', initiativeId: 'init-9' })).toBe(
      '/initiatives?open=init-9&mode=doc'
    );
  });

  it('respects server resultType=created even when caller mode is link', () => {
    expect(
      getHandoffLandingPath({ mode: 'link', initiativeId: 'init-9', resultType: 'created' })
    ).toBe('/initiatives?open=init-9&mode=doc');
  });

  it('does NOT navigate away when linking to an existing initiative', () => {
    expect(
      getHandoffLandingPath({ mode: 'link', initiativeId: 'init-9', resultType: 'linked' })
    ).toBeNull();
  });

  it('does not navigate without an initiative id', () => {
    expect(getHandoffLandingPath({ mode: 'create', initiativeId: '' })).toBeNull();
    expect(getHandoffLandingPath({ mode: 'create', initiativeId: null })).toBeNull();
  });
});
