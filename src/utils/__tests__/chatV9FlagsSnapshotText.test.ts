/**
 * Chat V9 / ADMIN AG1 v1.2 — tests for the snapshot text builder
 * and clipboard writer.
 *
 * Coverage:
 *   - `buildChatV9FlagSnapshotText` — header format, summary count,
 *     one row per registered flag, deterministic ordering, Markdown
 *     table columns.
 *   - `copyTextToClipboard` — async path happy / denied, execCommand
 *     fallback happy / failed, no-op when neither is available.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CHAT_V9_FLAGS } from '../chatV9FeatureFlags';
import { buildChatV9FlagSnapshotText, copyTextToClipboard } from '../chatV9FlagsSnapshotText';

describe('buildChatV9FlagSnapshotText', () => {
  it('starts with a header line containing the timestamp and default label', () => {
    const fixed = new Date('2026-04-18T12:00:00.000Z');
    const text = buildChatV9FlagSnapshotText({ now: fixed });
    const firstLine = text.split('\n')[0];
    expect(firstLine).toBe('Chat V9 flags snapshot · 2026-04-18T12:00:00.000Z');
  });

  it('honours a custom label', () => {
    const fixed = new Date('2026-04-18T12:00:00.000Z');
    const text = buildChatV9FlagSnapshotText({ now: fixed, label: 'tenant-acme' });
    const firstLine = text.split('\n')[0];
    expect(firstLine).toBe('Chat V9 flags snapshot · tenant-acme · 2026-04-18T12:00:00.000Z');
  });

  it('includes a Markdown table with the documented columns', () => {
    const text = buildChatV9FlagSnapshotText();
    expect(text).toContain(
      '| Ticket | ID | Block | State | Override | Default | Matches default | Storage key |'
    );
    expect(text).toContain('|---|---|---|---|---|---|---|---|');
  });

  it('emits exactly one row per registered flag, in registry order', () => {
    const text = buildChatV9FlagSnapshotText();
    const rowLines = text
      .split('\n')
      .filter((line) => line.startsWith('| ') && !line.startsWith('| Ticket | '))
      .filter((line) => !line.startsWith('|---'));

    expect(rowLines.length).toBe(CHAT_V9_FLAGS.length);

    CHAT_V9_FLAGS.forEach((flag, idx) => {
      expect(rowLines[idx]).toContain(`\`${flag.id}\``);
      expect(rowLines[idx]).toContain(flag.ticket);
      expect(rowLines[idx]).toContain(flag.block);
      expect(rowLines[idx]).toContain(`\`${flag.keys.localStorage}\``);
    });
  });

  it('summary line reflects total flag count and override count', () => {
    const text = buildChatV9FlagSnapshotText();
    expect(text).toContain(`${CHAT_V9_FLAGS.length} flag`);
    expect(text).toContain('override');
  });
});

describe('copyTextToClipboard', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const originalExecCommand = document.execCommand;

  beforeEach(() => {
    // Reset document.execCommand each run so fallback tests can
    // install their own mocks without leaking across cases.
    (document as unknown as { execCommand?: unknown }).execCommand = undefined;
  });

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, 'clipboard', originalClipboard);
    } else {
      // Best effort cleanup when the original descriptor is absent.
      delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    }
    (document as unknown as { execCommand?: unknown }).execCommand = originalExecCommand;
    vi.restoreAllMocks();
  });

  it('uses the async Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    const result = await copyTextToClipboard('hello');
    expect(result).toEqual({ ok: true, via: 'async' });
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when the async API rejects with NotAllowedError', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    (document as unknown as { execCommand: (cmd: string) => boolean }).execCommand = vi
      .fn()
      .mockReturnValue(true);

    const result = await copyTextToClipboard('hello');
    expect(result).toEqual({ ok: true, via: 'execCommand' });
  });

  it('returns denied when both async and execCommand paths fail', async () => {
    const writeText = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    (document as unknown as { execCommand: (cmd: string) => boolean }).execCommand = vi
      .fn()
      .mockReturnValue(false);

    const result = await copyTextToClipboard('hello');
    expect(result).toEqual({ ok: false, reason: 'denied' });
  });

  it('returns unavailable when there is no clipboard API and no execCommand', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    // execCommand already cleared in beforeEach.

    const result = await copyTextToClipboard('hello');
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('uses the execCommand path directly when the async API is absent', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    (document as unknown as { execCommand: (cmd: string) => boolean }).execCommand = vi
      .fn()
      .mockReturnValue(true);

    const result = await copyTextToClipboard('hello');
    expect(result).toEqual({ ok: true, via: 'execCommand' });
  });
});
