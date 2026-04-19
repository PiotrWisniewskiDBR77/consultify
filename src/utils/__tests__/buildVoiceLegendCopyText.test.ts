/**
 * Chat V9 / VOICE VM3.2 — tests for the `buildVoiceLegendCopyText`
 * clipboard-payload formatter.
 *
 * What we pin:
 *   - Header always renders as `<title>:` on its own line.
 *   - Two-mode layout emits `- <title> — <body>` per row.
 *   - Unavailable layout emits `<title>. <body>` (or preserves an
 *     existing terminal punctuation).
 *   - `unavailable` takes precedence over `modes`.
 *   - Rows / fields with empty strings are skipped cleanly without
 *     leaving dangling bullets.
 *   - Degenerate input yields a "No content recorded." stub so the
 *     clipboard never receives the bare header alone.
 */

import { describe, expect, it } from 'vitest';

import { buildVoiceLegendCopyText } from '../buildVoiceLegendCopyText';

describe('buildVoiceLegendCopyText', () => {
  it('renders the two-mode layout with a bullet per row', () => {
    const out = buildVoiceLegendCopyText({
      title: 'Voice modes',
      modes: [
        { title: 'Dictation', body: 'Speech fills the input field.' },
        { title: 'Conversation (live)', body: 'Continuous back-and-forth.' },
      ],
    });
    expect(out).toBe(
      [
        'Voice modes:',
        '',
        '- Dictation — Speech fills the input field.',
        '- Conversation (live) — Continuous back-and-forth.',
      ].join('\n')
    );
  });

  it('renders the unavailable layout with a joined sentence', () => {
    const out = buildVoiceLegendCopyText({
      title: 'Voice modes',
      unavailable: {
        title: 'Voice is unavailable in this browser',
        body: 'Try Chrome or Edge on desktop, or Safari on iOS 15+.',
      },
    });
    expect(out).toBe(
      [
        'Voice modes:',
        '',
        'Voice is unavailable in this browser. Try Chrome or Edge on desktop, or Safari on iOS 15+.',
      ].join('\n')
    );
  });

  it('respects an existing terminal punctuation on the unavailable title', () => {
    const out = buildVoiceLegendCopyText({
      title: 'Voice modes',
      unavailable: {
        title: 'Voice is unavailable!',
        body: 'Switch browsers.',
      },
    });
    expect(out).toBe(
      [
        'Voice modes:',
        '',
        'Voice is unavailable! Switch browsers.',
      ].join('\n')
    );
  });

  it('prefers unavailable over modes when both are provided', () => {
    const out = buildVoiceLegendCopyText({
      title: 'Voice modes',
      unavailable: { title: 'Unavailable', body: 'Try Chrome.' },
      modes: [{ title: 'Dictation', body: 'Should not render.' }],
    });
    expect(out).toContain('Unavailable. Try Chrome.');
    expect(out).not.toContain('Dictation');
  });

  it('skips modes where title is empty', () => {
    const out = buildVoiceLegendCopyText({
      title: 'Voice modes',
      modes: [
        { title: '', body: 'Only body' },
        { title: 'Dictation', body: 'Speech fills the input.' },
      ],
    });
    expect(out).toBe(
      ['Voice modes:', '', '- Dictation — Speech fills the input.'].join('\n')
    );
  });

  it('skips modes where body is empty', () => {
    const out = buildVoiceLegendCopyText({
      title: 'Voice modes',
      modes: [
        { title: 'Dictation', body: '  ' },
        { title: 'Conversation (live)', body: 'Back and forth.' },
      ],
    });
    expect(out).toBe(
      ['Voice modes:', '', '- Conversation (live) — Back and forth.'].join('\n')
    );
  });

  it('emits a "No content recorded." stub when every mode is filtered out', () => {
    const out = buildVoiceLegendCopyText({
      title: 'Voice modes',
      modes: [
        { title: '', body: '' },
        { title: 'Dictation', body: '' },
      ],
    });
    expect(out).toBe('Voice modes:\n\nNo content recorded.');
  });

  it('emits a "No content recorded." stub when modes is empty', () => {
    const out = buildVoiceLegendCopyText({ title: 'Voice modes', modes: [] });
    expect(out).toBe('Voice modes:\n\nNo content recorded.');
  });

  it('emits a "No content recorded." stub when unavailable has no title or body', () => {
    const out = buildVoiceLegendCopyText({
      title: 'Voice modes',
      unavailable: { title: '', body: '   ' },
    });
    expect(out).toBe('Voice modes:\n\nNo content recorded.');
  });

  it('falls back to "Voice modes:" header when payload title is empty', () => {
    const out = buildVoiceLegendCopyText({
      title: '   ',
      modes: [{ title: 'Dictation', body: 'Speech.' }],
    });
    expect(out.startsWith('Voice modes:')).toBe(true);
  });

  it('renders the unavailable-only layout even when `title` in unavailable has no body', () => {
    const out = buildVoiceLegendCopyText({
      title: 'Voice modes',
      unavailable: { title: 'Voice unavailable.', body: '' },
    });
    expect(out).toBe('Voice modes:\n\nVoice unavailable.');
  });

  it('renders the body-only layout when unavailable title is missing', () => {
    const out = buildVoiceLegendCopyText({
      title: 'Voice modes',
      unavailable: { title: '', body: 'Switch browsers.' },
    });
    expect(out).toBe('Voice modes:\n\nSwitch browsers.');
  });

  it('is deterministic across repeated calls (no hidden state)', () => {
    const payload = {
      title: 'Voice modes',
      modes: [{ title: 'Dictation', body: 'Speech.' }],
    };
    expect(buildVoiceLegendCopyText(payload)).toBe(
      buildVoiceLegendCopyText(payload)
    );
  });
});
