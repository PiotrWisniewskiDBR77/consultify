import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../ToolSessionPreviewV3.tsx'), 'utf8');
const documentSource = fs.readFileSync(path.resolve(__dirname, '../ToolDocumentView.tsx'), 'utf8');

describe('Tool session completion owner contract', () => {
  it('keeps lifecycle actions but does not create downstream initiatives inside a session', () => {
    expect(source).toContain("t('preview.requestReview', 'Request review')");
    expect(source).toContain("t('preview.approve', 'Approve')");
    expect(source).toContain("t('preview.sendBack', 'Send back')");
    expect(source).not.toContain("t('preview.generateInitiatives', 'Generate initiatives')");
    expect(source).not.toContain('onClick: onOpenGenerateModal');
    expect(documentSource).not.toContain('<GenerateInitiativesModal');
    expect(documentSource).not.toContain('setShowGenerateModal(true)');
    expect(documentSource).not.toContain(
      "t('discoveryToolsMain.toolDocumentView.generateInitiatives')"
    );
  });
});
