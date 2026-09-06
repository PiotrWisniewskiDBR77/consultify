import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// [ODMROZENIE 13_CHAT DEC-397] MVP 1.1-E (06.09): właściciel zgłosił że nie ma
// jak ponownie zaprosić Teresę do przeanalizowania krótkiej odpowiedzi — bo
// "Ponów odpowiedź" siedziało wyłącznie w rzędzie ukrywanym za
// `showCompactActions` (domyślnie false), więc krótkie odpowiedzi Teresy
// pokazywały tylko 3 ikony (kopiuj / głośnik / rozwiń).
//
// Ten test broni GEOMETRII: przycisk regeneracji musi leżeć w ZAWSZE
// widocznej części rzędu akcji (`message-response-actions`), przed znacznikiem
// rozwijanego `fieldset` (`message-response-actions-expanded`) — nie wewnątrz
// niego. Usunięcie przycisku z widocznej części (cofnięcie do starego miejsca
// w fieldsecie) musi ten test wywalić na czerwono.
const source = fs.readFileSync(path.resolve(__dirname, '../MessageRenderer.tsx'), 'utf8');

describe('MessageRenderer — Ponów odpowiedź zawsze widoczny (MVP 1.1-E)', () => {
  it('renders exactly one regenerate control for AI messages', () => {
    const matches = source.match(/data-testid="message-action-regenerate"/g) || [];
    expect(matches).toHaveLength(1);
  });

  it('places the regenerate control BEFORE the collapsible fieldset, not inside it', () => {
    const regenerateIdx = source.indexOf('data-testid="message-action-regenerate"');
    const expandedFieldsetIdx = source.indexOf('data-testid="message-response-actions-expanded"');
    expect(regenerateIdx).toBeGreaterThan(-1);
    expect(expandedFieldsetIdx).toBeGreaterThan(-1);
    // The whole point of the fix: regenerate must appear in the markup BEFORE
    // (i.e. outside/above) the fieldset that is `hidden` until the user
    // expands `showCompactActions`. If someone moves it back inside the
    // fieldset, this index comparison flips and the test goes RED.
    expect(regenerateIdx).toBeLessThan(expandedFieldsetIdx);
  });

  it('regenerate control is disabled honestly, never depends on showCompactActions', () => {
    const startIdx = source.indexOf('data-testid="message-action-regenerate"');
    const surrounding = source.slice(Math.max(0, startIdx - 400), startIdx + 200);
    expect(surrounding).toContain('disabled={isDisabled || msg.isStreaming || !canRegenerate}');
    expect(surrounding).not.toContain('showCompactActions');
  });

  it('carries a Polish "Ponów odpowiedź" label wired through i18n (pl+en present)', () => {
    const startIdx = source.indexOf('data-testid="message-action-regenerate"');
    const surrounding = source.slice(Math.max(0, startIdx - 400), startIdx + 400);
    expect(surrounding).toContain("t('chat.actions.regenerate', 'Ponów odpowiedź')");

    const plPath = path.resolve(__dirname, '../../../../public/locales/pl/translation.json');
    const enPath = path.resolve(__dirname, '../../../../public/locales/en/translation.json');
    const pl = JSON.parse(fs.readFileSync(plPath, 'utf8'));
    const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    expect(pl.chat.actions.regenerate).toBe('Ponów odpowiedź');
    expect(typeof en.chat.actions.regenerate).toBe('string');
    expect(en.chat.actions.regenerate.length).toBeGreaterThan(0);
  });
});
