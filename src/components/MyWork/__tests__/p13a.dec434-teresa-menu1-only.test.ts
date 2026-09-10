import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../../..', file), 'utf8');

describe('P13-A DEC-434 — Teresa wyłącznie w Menu 1', () => {
  it('warsztat pomysłu nie podaje zakładki ani przycisku Teresy', () => {
    const source = read('src/components/MyWork/IdeaMapWorkspace.tsx');
    expect(source).not.toMatch(/<IdeaElementInspector[\s\S]{0,250}teresaContent=/);
    expect(source).not.toMatch(/<IdeaRightPanel[\s\S]{0,1800}(?:teresaContent|onDiscussWithTeresa)=/);
  });

  it('powiadomienie nie używa znaku Teresy', () => {
    expect(read('src/components/MyWork/NotificationDetailView.tsx')).not.toContain('TeresaMark');
  });

  it('wzorzec wywiadu ma neutralny komunikat AI', () => {
    const source = read('src/components/Interview/TemplateBuilder.tsx');
    expect(source).not.toContain('TeresaMark');
    expect(source).not.toContain('teresaReviewedYourTemplate');
    expect(source).toContain('aiReviewedYourTemplate');
  });
});
