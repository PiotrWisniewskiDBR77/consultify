/**
 * Document Studio — Teresa creation intent tests (Epic E4, Slice 4.4).
 *
 * Covers detectTeresaCreationIntent: the classifier that turns a free
 * Teresa chat message into a create-document request, optionally tagged
 * with a `with_pack` source signal when the user says "from these
 * sources / na podstawie tych źródeł". Pure heuristic, PL + EN.
 */

import { describe, expect, it } from 'vitest';

import { detectTeresaCreationIntent } from '../documentTeresaIntent.js';

describe('detectTeresaCreationIntent — English', () => {
  it('returns null for an editor-style request', () => {
    expect(detectTeresaCreationIntent('rewrite this paragraph in plain English')).toBeNull();
    expect(detectTeresaCreationIntent('cite the latest sources here')).toBeNull();
    expect(detectTeresaCreationIntent('')).toBeNull();
  });

  it('classifies "create a memo" as create_document with unspecified source signal', () => {
    const intent = detectTeresaCreationIntent('Teresa, please create a memo for the CEO');
    expect(intent).not.toBeNull();
    expect(intent!.kind).toBe('create_document');
    expect(intent!.sourceSignal).toBe('unspecified');
    expect(intent!.matchedPhrase).toBe('create a memo');
  });

  it('flips sourceSignal to with_pack when the message references attached sources', () => {
    const intent = detectTeresaCreationIntent(
      'Teresa, generate a report from these sources I attached'
    );
    expect(intent).not.toBeNull();
    expect(intent!.sourceSignal).toBe('with_pack');
    expect(intent!.matchedPhrase).toBe('generate a report');
    expect(intent!.sourceMatchedPhrase).toBe('from these sources');
  });

  it('classifies "draft a memo with the attached" as create + with_pack', () => {
    const intent = detectTeresaCreationIntent('Draft a memo with the attached transcript');
    expect(intent).not.toBeNull();
    expect(intent!.sourceSignal).toBe('with_pack');
    expect(intent!.matchedPhrase).toBe('draft a memo');
  });
});

describe('detectTeresaCreationIntent — Polish', () => {
  it('classifies "stwórz raport" as create_document', () => {
    const intent = detectTeresaCreationIntent('Tereso, stwórz raport dla zarządu na poniedziałek');
    expect(intent).not.toBeNull();
    expect(intent!.matchedPhrase).toBe('stworz raport');
    expect(intent!.sourceSignal).toBe('unspecified');
  });

  it('flips sourceSignal to with_pack on "na podstawie tych źródeł"', () => {
    const intent = detectTeresaCreationIntent(
      'Stwórz dokument na podstawie tych źródeł, które wkleiłem powyżej'
    );
    expect(intent).not.toBeNull();
    expect(intent!.sourceSignal).toBe('with_pack');
    expect(intent!.sourceMatchedPhrase).toBe('na podstawie tych zrodel');
  });

  it('classifies "zrób mi raport z tych linków" as create + with_pack', () => {
    const intent = detectTeresaCreationIntent('Zrób mi raport z tych linków');
    expect(intent).not.toBeNull();
    expect(intent!.matchedPhrase).toBe('zrob mi raport');
    expect(intent!.sourceSignal).toBe('with_pack');
    expect(intent!.sourceMatchedPhrase).toBe('z tych linkow');
  });

  it('classifies "wygeneruj memo" as create_document', () => {
    const intent = detectTeresaCreationIntent('Wygeneruj memo na temat ryzyk projektu');
    expect(intent).not.toBeNull();
    expect(intent!.matchedPhrase).toBe('wygeneruj memo');
  });
});

describe('detectTeresaCreationIntent — Polish ł normalization', () => {
  it('matches "stwórz" (with the Polish ł character variant) reliably', () => {
    const intent = detectTeresaCreationIntent('Stwórz raport, oprzyj się na tych źródłach');
    expect(intent).not.toBeNull();
    expect(intent!.sourceSignal).toBe('with_pack');
  });
});
