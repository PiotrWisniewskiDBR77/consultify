import { describe, expect, it } from 'vitest';

import {
  resolveWorkspaceArtifactKind,
  shouldOfferWorkspaceArtifactIntent,
} from '../../../src/components/AIChat/workspaceArtifactIntent';

const context = (type: string, artifactKind?: string) =>
  ({
    view: 'AI_CHAT',
    type,
    entityData: artifactKind === undefined ? undefined : { artifactKind },
    timestamp: new Date(),
  }) as any;

describe('workspaceArtifactIntent', () => {
  it.each([
    ['deck', 'presentation'],
    ['presentation', 'presentation'],
    ['doc', 'document'],
    ['document', 'document'],
    ['report', 'document'],
    ['sheet', 'sheet'],
    ['spreadsheet', 'sheet'],
    ['workbook', 'sheet'],
    ['table', 'sheet'],
    ['xlsx', 'sheet'],
  ])('maps explicit artifactKind %s to %s', (artifactKind, expected) => {
    expect(resolveWorkspaceArtifactKind(context('general', artifactKind))).toBe(expected);
  });

  it('gives explicit artifactKind precedence over a misleading context type', () => {
    expect(resolveWorkspaceArtifactKind(context('spreadsheet', 'deck'))).toBe('presentation');
  });

  it('falls back to a recognized context type when artifactKind is absent', () => {
    expect(resolveWorkspaceArtifactKind(context('document'))).toBe('document');
  });

  it('does not infer an artifact when an explicit artifactKind is unknown', () => {
    expect(resolveWorkspaceArtifactKind(context('presentation', 'unknown-kind'))).toBeNull();
    expect(shouldOfferWorkspaceArtifactIntent(context('general', 'unknown-kind'))).toBe(false);
  });

  it('preserves the attachment flow even in a recognized artifact context', () => {
    expect(shouldOfferWorkspaceArtifactIntent(context('general', 'workbook'), [{}])).toBe(false);
    expect(shouldOfferWorkspaceArtifactIntent(context('general', 'workbook'), [])).toBe(true);
  });
});
