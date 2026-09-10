import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../..', file), 'utf8');

describe('P13-A DEC-432 — kontrakt jest jedynym źródłem sekcji', () => {
  const files = [
    'src/components/MyWork/TaskDetailView.tsx',
    'src/components/MyWork/DecisionDetailView.tsx',
    'src/components/MyWork/NotificationDetailView.tsx',
    'src/components/Interview/InsightViewer.tsx',
    'src/components/Interview/InterviewWorkspace.tsx',
    'src/components/Initiatives/InitiativeDocumentView.tsx',
    'src/components/Initiatives/sections/initiativeCardContract.ts',
  ];

  it('usuwa wszystkie flagi VITE_VF1_*_CARD_CONTRACT', () => {
    for (const file of files) expect(read(file), file).not.toMatch(/VITE_VF1_[A-Z_]+_CARD_CONTRACT/);
  });

  it('usuwa równoległe tablice sekcji wskazane przez DEC-432', () => {
    const source = files.map(read).join('\n');
    for (const name of ['taskNSections', 'notionSections', 'nModeSections', 'INSIGHT_SECTIONS', 'initiativeNSections']) {
      expect(source, name).not.toMatch(new RegExp(`(?:const|let|var)\\s+${name}\\b`));
    }
  });

  it('mutacja: dopisanie sekcji poza kontraktem jest odrzucana', () => {
    const source = read('src/components/standard/contractSections.ts');
    expect(source).toContain('katalog: readonly KanonicznaKarta[]');
    expect(source).not.toContain('dodatkoweSekcje');
  });
});
