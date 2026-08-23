import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const taskSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/MyWork/TaskDetailView.tsx'),
  'utf8'
);

describe('Task owner-feedback contracts', () => {
  it('uses the owner-approved concise Analyze label without advertising AI', () => {
    expect(taskSource).toContain("t('myWork.taskDetail.title13', 'Analyze')");
    expect(taskSource).toContain("t('myWork.taskDetail.analyzeRisks', 'Analyze')");
    expect(taskSource).not.toContain("t('myWork.taskDetail.title13', 'Analyze risks with AI')");
    expect(taskSource).toContain(
      'setRisks((currentRisks) => [...currentRisks, ...aiRisks])'
    );
  });

  it('renders Task history through the compact chronological list variant', () => {
    expect(taskSource).toContain('variant="compact-list"');
    expect(taskSource).toContain('[...activityLog]');
    expect(taskSource).toContain('.sort((a, b) => {');
  });

  it('does not expose card acceptance without a persisted acceptance contract', () => {
    expect(taskSource).not.toMatch(/onAccept=\{\(\) => setCard\(cKey, 'done'\)\}/);
    expect(taskSource).toContain('onRegenerate={() => generateCard(cKey)}');
    expect(taskSource).toContain("onEdit={() => setCard(cKey, 'edited')}");
    expect(taskSource).toContain('persistenceNotice={');
    expect(taskSource).toContain('myWork.taskDetail.generatedSectionSaveNotice');
    expect(taskSource).toContain('myWork.taskDetail.generatedSectionReady');
    expect(taskSource).toContain('myWork.taskDetail.generatedSectionLocalOnlyNotice');
    expect(taskSource).toContain('myWork.taskDetail.generatedSectionReferenceOnlyNotice');
  });
});
