import { describe, expect, it } from 'vitest';

import {
  appendComment,
  buildProcessFlowComment,
  extractMentions,
  removeComment,
} from '../../../src/components/MyWork/processflow/nodeComments';

describe('extractMentions', () => {
  it('extracts one mention', () => {
    expect(extractMentions('hey @piotr check this')).toEqual(['piotr']);
  });
  it('extracts multiple mentions', () => {
    expect(extractMentions('@alice and @bob please review')).toEqual(['alice', 'bob']);
  });
  it('returns empty array when no mentions', () => {
    expect(extractMentions('no mentions here')).toEqual([]);
  });
});

describe('buildProcessFlowComment', () => {
  it('trims text and stamps author/createdAt', () => {
    const c = buildProcessFlowComment('Piotr', '  hello world  ');
    expect(c.author).toBe('Piotr');
    expect(c.text).toBe('hello world');
    expect(typeof c.createdAt).toBe('string');
    expect(new Date(c.createdAt).toString()).not.toBe('Invalid Date');
  });
  it('extracts mentions from the built comment', () => {
    const c = buildProcessFlowComment('Piotr', 'ping @teresa');
    expect(c.mentions).toEqual(['teresa']);
  });
  it('generates unique ids for consecutive comments', () => {
    const a = buildProcessFlowComment('P', 'a');
    const b = buildProcessFlowComment('P', 'b');
    expect(a.id).not.toBe(b.id);
  });
});

describe('appendComment', () => {
  it('appends to an existing list without mutating it', () => {
    const existing = [buildProcessFlowComment('A', 'first')];
    const comment = buildProcessFlowComment('B', 'second');
    const next = appendComment(existing, comment);
    expect(next).toHaveLength(2);
    expect(existing).toHaveLength(1); // original untouched
    expect(next[1]).toBe(comment);
  });
  it('handles undefined existing list', () => {
    const comment = buildProcessFlowComment('A', 'first');
    expect(appendComment(undefined, comment)).toEqual([comment]);
  });
});

describe('removeComment', () => {
  it('removes the matching comment by id', () => {
    const a = buildProcessFlowComment('A', 'first');
    const b = buildProcessFlowComment('B', 'second');
    const next = removeComment([a, b], a.id);
    expect(next).toEqual([b]);
  });
  it('is a no-op when id is not found', () => {
    const a = buildProcessFlowComment('A', 'first');
    expect(removeComment([a], 'missing-id')).toEqual([a]);
  });
  it('handles undefined existing list', () => {
    expect(removeComment(undefined, 'anything')).toEqual([]);
  });
});
