import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { getInterviewActionDefinition, INTERVIEW_ACTION_MATRIX } from '../interviewActionMatrix';

const readJson = (relativePath: string) =>
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8'));

const valueAt = (root: Record<string, unknown>, dotted: string) =>
  dotted.split('.').reduce<unknown>((value, key) => {
    if (!value || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[key];
  }, root);

describe('Interview action matrix contract', () => {
  it('declares every Interview object type from the owner decision', () => {
    expect(Object.keys(INTERVIEW_ACTION_MATRIX).sort()).toEqual([
      'assignment',
      'inbox',
      'initiative',
      'insight',
      'session',
      'template',
    ]);
  });

  it('keeps every supported business action discoverable in row and preview', () => {
    for (const [type, actions] of Object.entries(INTERVIEW_ACTION_MATRIX)) {
      expect(actions.length, type).toBeGreaterThan(0);
      for (const action of actions) {
        expect(action.operation, `${type}.${action.id}`).toBeTruthy();
        if (action.omittedReason) {
          expect(action.omittedReason, `${type}.${action.id}`).toMatch(/Preview|Brak|§7\.3/);
        } else {
          expect(action.surfaces, `${type}.${action.id}`).toEqual(['row', 'preview']);
        }
        expect(
          getInterviewActionDefinition(type as keyof typeof INTERVIEW_ACTION_MATRIX, action.id)
        ).toBe(action);
      }
    }
  });

  it('has real, translated PL and EN labels for every action key', () => {
    const pl = readJson('public/locales/pl/translation.json');
    const en = readJson('public/locales/en/translation.json');
    for (const [type, actions] of Object.entries(INTERVIEW_ACTION_MATRIX)) {
      for (const action of actions) {
        const plValue = valueAt(pl, action.i18nKey);
        const enValue = valueAt(en, action.i18nKey);
        expect(typeof plValue, `PL ${type}.${action.id}: ${action.i18nKey}`).toBe('string');
        expect(typeof enValue, `EN ${type}.${action.id}: ${action.i18nKey}`).toBe('string');
        expect(String(plValue).trim(), `PL ${type}.${action.id}`).not.toBe('');
        expect(String(enValue).trim(), `EN ${type}.${action.id}`).not.toBe('');
        expect(plValue, `${type}.${action.id} must not render its key`).not.toBe(action.i18nKey);
        expect(enValue, `${type}.${action.id} must not render its key`).not.toBe(action.i18nKey);
      }
    }
  });

  it('is consumed by the row-menu host and every dedicated preview action component', () => {
    const files = [
      'src/components/Interview/InterviewHub.tsx',
      'src/components/Interview/InterviewAssignmentPreview.tsx',
      'src/components/Interview/InterviewSessionPreview.tsx',
      'src/components/Interview/InterviewTemplatePreview.tsx',
      'src/components/Interview/InterviewInitiativePreview.tsx',
    ];
    for (const file of files) {
      expect(fs.readFileSync(path.resolve(process.cwd(), file), 'utf8'), file).toContain(
        'interviewActionMeta'
      );
    }
  });
});
