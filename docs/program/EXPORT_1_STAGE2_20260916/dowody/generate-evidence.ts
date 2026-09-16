import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { boardDeckExportService } from '../../../../server/src/services/export/BoardDeckExportService.js';

const outputPath = fileURLToPath(new URL('./deck-builder-export.pptx', import.meta.url));
const buffer = await boardDeckExportService.exportPresentationDeck({
  organizationName: 'Atelier Toys',
  deck: {
    title: 'Atelier Forward — Board Readout',
    organization_id: 'ateliertoys-demo-session-1bd9863714-mtx5ce5c',
    meta: { language: 'en', confidentiality: 'Internal' },
    lifecycle: { updatedAt: '2026-09-16T21:45:00.000Z' },
    cards: [
      {
        intent: 'cover',
        title: 'Atelier Forward — Board Readout',
        key_message: 'A focused decision brief for the next operating cycle',
        blocks: [],
      },
      {
        intent: 'key_messages',
        title: 'What changed',
        key_message: 'The operating model is ready for a controlled next step.',
        blocks: [
          {
            type: 'bullet_list',
            content: {
              bullets: [
                'Demand is concentrated in two priority segments.',
                'Delivery reliability improved while quality held.',
                'The next gate requires an accountable owner.',
              ],
              table: {
                headers: ['Measure', 'Current'],
                rows: [
                  ['Delivery reliability', '92%'],
                  ['Priority segments', '2'],
                ],
              },
              id: 'c-77',
              enabled: true,
              count: 12,
            },
          },
        ],
        source_refs: [{ artifact_name: 'Operating review' }],
      },
      {
        intent: 'decision',
        title: 'Decision required',
        key_message: 'Approve the controlled rollout and name the accountable owner.',
        blocks: [
          {
            type: 'callout',
            content: { body: 'Start with the two priority segments and review after 30 days.' },
          },
        ],
        source_refs: [{ artifact_name: 'Steering note' }],
      },
    ],
  },
});

fs.writeFileSync(outputPath, buffer);
console.log(`${outputPath} ${buffer.length} bytes`);
