import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  fs.readFileSync(path.resolve(process.cwd(), `src/components/Interview/${name}`), 'utf8');

describe('Interview canonical preview footers', () => {
  it.each([
    'InterviewAssignmentPreview.tsx',
    'InterviewSessionPreview.tsx',
    'InterviewTemplatePreview.tsx',
    'InterviewInitiativePreview.tsx',
  ])('%s renders direct actions through PreviewActionBar', (name) => {
    const source = read(name);
    expect(source).toContain('PreviewActionBar');
    expect(source).toMatch(/<PreviewActionBar[\s\S]*?\/>/);
  });

  it.each([
    'InterviewAssignmentPreview.tsx',
    'InterviewSessionPreview.tsx',
    'InterviewTemplatePreview.tsx',
    'InterviewInitiativePreview.tsx',
  ])('%s keeps canonical AI then relations ordering', (name) => {
    const source = read(name);
    expect(source.indexOf('<PreviewAIHintStrip')).toBeGreaterThan(-1);
    expect(source.indexOf('<PreviewRelations')).toBeGreaterThan(
      source.indexOf('<PreviewAIHintStrip')
    );
  });

  it('keeps generic Open out of the Template footer while preserving authorized Edit', () => {
    const source = read('InterviewTemplatePreview.tsx');
    const footer = source.slice(source.indexOf('export const InterviewTemplatePreviewFooter'));
    expect(footer).toContain("label: t('interview.templatePreview.edit')");
    expect(footer).not.toContain("label: t('interview.templatePreview.open')");
    expect(footer).toContain('...(canAssign');
  });

  it('keeps Insight footer free of a redundant generic Open action', () => {
    const source = read('InterviewInsightPreview.tsx');
    const footer = source.slice(source.indexOf('export const InterviewInsightPreviewFooter'));
    expect(footer).not.toContain('onOpenFull');
    expect(footer).toContain('<PreviewAIHintStrip');
    expect(footer).toContain('<ArtifactActionPanel');
  });
});
