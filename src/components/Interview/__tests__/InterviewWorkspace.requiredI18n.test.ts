import { describe, expect, it } from 'vitest';

import en from '../../../../public/locales/en/translation.json';
import pl from '../../../../public/locales/pl/translation.json';

describe('INTERVIEW-SHELL U05-1 required respondent actions', () => {
  it.each([
    ['en', en],
    ['pl', pl],
  ])('%s resolves every primary respondent label', (_language, catalog) => {
    const workspace = (catalog as any).interview?.workspace;

    expect(workspace?.submitForReview).toBeTruthy();
    expect(workspace?.save).toBeTruthy();
    expect(workspace?.run).toBeTruthy();
    expect(workspace.submitForReview).not.toBe('interview.workspace.submitForReview');
  });
});
