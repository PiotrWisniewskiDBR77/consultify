import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workspaceSource = fs.readFileSync(
  path.resolve(__dirname, '../InterviewWorkspace.tsx'),
  'utf8'
);
const runtimeSource = fs.readFileSync(
  path.resolve(__dirname, '../InterviewSingleQuestionRuntime.tsx'),
  'utf8'
);

describe('Interview owner question-workspace contract', () => {
  it('routes single-question interviews to the dedicated workspace, not N-mode cards', () => {
    expect(workspaceSource).toContain(
      "return runtimeMode === 'single_question' ? 'dedicated_question_workspace' : 'n_mode_shell'"
    );
    expect(workspaceSource).toContain('data-testid="interview-dedicated-question-workspace"');
    expect(workspaceSource).toContain('<InterviewSingleQuestionRuntime');
    expect(workspaceSource).toContain('immersive');
  });

  it('preserves a readable left question list and broad focused answer canvas', () => {
    expect(runtimeSource).toContain('w-72 shrink-0');
    expect(runtimeSource).toContain(
      "aria-label={t('interview.singleQuestionRuntime.questionNavigation')}"
    );
    expect(runtimeSource).toContain("immersive ? 'max-w-4xl' : 'max-w-3xl'");
    expect(runtimeSource).toContain("immersive ? 'max-w-2xl mx-auto space-y-5'");
  });

  it('keeps stable Save, Previous and Next/Review controls outside the scrolling canvas', () => {
    expect(runtimeSource).toContain('{/* Bottom action row */}');
    expect(runtimeSource).toContain("aria-label={t('interview.singleQuestionRuntime.saveAnswer')}");
    expect(runtimeSource).toContain(
      "aria-label={t('interview.singleQuestionRuntime.previousQuestion')}"
    );
    expect(runtimeSource).toContain(
      "aria-label={t('interview.singleQuestionRuntime.nextQuestion')}"
    );
    expect(runtimeSource).toContain(
      "aria-label={t('interview.singleQuestionRuntime.reviewAndSubmit')}"
    );
  });
});
