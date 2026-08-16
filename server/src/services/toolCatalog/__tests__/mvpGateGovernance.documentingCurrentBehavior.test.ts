/** TLS-CATALOG-001 — production gate and owner-approved registry stay identical. */
import { describe, expect, it } from 'vitest';

import { ACTIVE_KNOWN_TOOL_TYPES } from '../../KnownToolsService.js';
import { APPROVED_MVP_TOOL_TYPES } from '../approvedMvpToolTypes.js';

describe('TLS-CATALOG-001 — real MVP gate, pinned by exact membership (ratchet)', () => {
  it('uses the exact owner-approved set as the production launch gate', () => {
    expect([...ACTIVE_KNOWN_TOOL_TYPES].sort()).toEqual([...APPROVED_MVP_TOOL_TYPES].sort());
  });

  it('contains exactly Dynamic SWOT and no unsupported tool', () => {
    expect([...APPROVED_MVP_TOOL_TYPES]).toEqual(['dynamic-swot']);
    expect([...ACTIVE_KNOWN_TOOL_TYPES]).toEqual(['dynamic-swot']);
  });
});
