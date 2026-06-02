import { describe, expect, it } from 'vitest';

import {
  buildMentionToken,
  detectMentionTrigger,
  detectSlashTrigger,
  fuzzyIncludes,
  insertAtCaret,
} from '../composer/composerMentions';
import { filterSlashCommands } from '../composer/slashCommands';

describe('detectSlashTrigger', () => {
  it('matches a slash at the start of the input', () => {
    expect(detectSlashTrigger('/')).toEqual({ start: 0, query: '' });
    expect(detectSlashTrigger('/res')).toEqual({ start: 0, query: 'res' });
  });

  it('matches a slash at the start of a new line', () => {
    const text = 'hello\n/sum';
    const match = detectSlashTrigger(text);
    expect(match).not.toBeNull();
    expect(match?.query).toBe('sum');
    // start points at the '/' char
    expect(text[match!.start]).toBe('/');
  });

  it('does NOT match a slash mid-line (e.g. a URL or path)', () => {
    expect(detectSlashTrigger('see https:/')).toBeNull();
    expect(detectSlashTrigger('hello /foo')).toBeNull();
  });

  it('does NOT match once the query contains whitespace', () => {
    expect(detectSlashTrigger('/foo bar')).toBeNull();
  });
});

describe('detectMentionTrigger', () => {
  it('matches an @ at the start or after whitespace', () => {
    expect(detectMentionTrigger('@')).toEqual({ start: 0, query: '' });
    const m = detectMentionTrigger('ask @doc');
    expect(m?.query).toBe('doc');
    expect(m?.start).toBe(4);
  });

  it('does NOT match an @ embedded in a word (e.g. email)', () => {
    expect(detectMentionTrigger('user@domain')).toBeNull();
  });

  it('does NOT match once the query contains whitespace', () => {
    expect(detectMentionTrigger('@doc title')).toBeNull();
  });
});

describe('insertAtCaret', () => {
  it('replaces the [from, to) slice and returns the new caret', () => {
    // value "/res" — replace the whole slash token with template text
    const res = insertAtCaret('/res', 0, 4, 'Summarize: ');
    expect(res.value).toBe('Summarize: ');
    expect(res.caret).toBe('Summarize: '.length);
  });

  it('preserves surrounding text', () => {
    const res = insertAtCaret('hi @do there', 3, 6, '@Doc Title ');
    expect(res.value).toBe('hi @Doc Title  there');
    expect(res.caret).toBe(3 + '@Doc Title '.length);
  });

  it('clamps out-of-range indices', () => {
    const res = insertAtCaret('abc', -5, 99, 'X');
    expect(res.value).toBe('X');
  });
});

describe('buildMentionToken', () => {
  it('builds a trailing-space token from the label', () => {
    expect(buildMentionToken({ type: 'document', id: 'x', label: 'Q3  Strategy' })).toBe(
      '@Q3 Strategy '
    );
  });
});

describe('fuzzyIncludes', () => {
  it('is case-insensitive and matches empty query', () => {
    expect(fuzzyIncludes('Deep Research', 'research')).toBe(true);
    expect(fuzzyIncludes('anything', '')).toBe(true);
    expect(fuzzyIncludes('abc', 'z')).toBe(false);
  });
});

describe('filterSlashCommands', () => {
  it('returns all commands for an empty query', () => {
    expect(filterSlashCommands('').length).toBeGreaterThan(0);
  });

  it('filters by command token', () => {
    const res = filterSlashCommands('research');
    expect(res.some((c) => c.id === 'research')).toBe(true);
    expect(res.some((c) => c.id === 'image')).toBe(false);
  });
});
