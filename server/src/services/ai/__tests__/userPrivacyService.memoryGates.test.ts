import { describe, expect, it } from 'vitest';

import { canReadMemory, canWriteMemory } from '../userPrivacyService.js';

describe('userPrivacyService memory gates', () => {
  it('canReadMemory blocks private mode and disabled memory', () => {
    expect(
      canReadMemory(
        {
          memoryEnabled: false,
          memoryWriteEnabled: true,
          privateModeDefault: false,
          retentionMode: 'session',
        },
        false
      )
    ).toBe(false);
    expect(
      canReadMemory(
        {
          memoryEnabled: true,
          memoryWriteEnabled: true,
          privateModeDefault: false,
          retentionMode: 'session',
        },
        true
      )
    ).toBe(false);
    expect(
      canReadMemory(
        {
          memoryEnabled: true,
          memoryWriteEnabled: true,
          privateModeDefault: false,
          retentionMode: 'session',
        },
        false
      )
    ).toBe(true);
  });

  it('canWriteMemory enforces retention and write gates', () => {
    expect(
      canWriteMemory(
        {
          memoryEnabled: true,
          memoryWriteEnabled: true,
          privateModeDefault: false,
          retentionMode: 'none',
        },
        false
      )
    ).toBe(false);
    expect(
      canWriteMemory(
        {
          memoryEnabled: true,
          memoryWriteEnabled: false,
          privateModeDefault: false,
          retentionMode: 'session',
        },
        false
      )
    ).toBe(false);
    expect(
      canWriteMemory(
        {
          memoryEnabled: false,
          memoryWriteEnabled: true,
          privateModeDefault: false,
          retentionMode: 'session',
        },
        false
      )
    ).toBe(false);
    expect(
      canWriteMemory(
        {
          memoryEnabled: true,
          memoryWriteEnabled: true,
          privateModeDefault: false,
          retentionMode: 'session',
        },
        false
      )
    ).toBe(true);
  });
});
