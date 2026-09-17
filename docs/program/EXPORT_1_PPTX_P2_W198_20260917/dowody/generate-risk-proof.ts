import fs from 'node:fs';

import { boardDeckExportService } from '../../../../server/src/services/export/BoardDeckExportService.ts';

const buffer = await boardDeckExportService.exportPresentationDeck({
  organizationName: 'Northwind Manufacturing Ltd.',
  deck: {
    title: 'Risk management proof',
    meta: { language: 'en', confidentiality: 'Internal' },
    lifecycle: { updatedAt: '2026-09-17T13:00:00.000Z' },
    cards: [
      {
        intent: 'cover',
        title: 'Risk management proof',
        key_message: 'Native table with preserved narrative',
        blocks: [],
      },
      {
        intent: 'risk_management',
        title: 'Risks and mitigations',
        key_message: 'Mitigate adoption and control risk before scaling.',
        blocks: [
          {
            type: 'heading',
            content: { text: 'Risk exposure remains manageable with named owners.' },
          },
          { type: 'callout', content: { text: 'Three controls protect the value case.' } },
          {
            type: 'table',
            content: {
              headers: ['Risk', 'Exposure', 'Mitigation', 'Owner'],
              rows: [
                ['Adoption', 'Open', 'Role-based enablement', 'Business owner'],
                ['Controls', 'Open', 'Human review and audit trail', 'Risk owner'],
                ['Value leakage', 'Open', 'Monthly benefit validation', 'Finance owner'],
              ],
            },
          },
        ],
      },
    ],
  },
});

const output = new URL('./risk-management-v2.pptx', import.meta.url);
fs.writeFileSync(output, buffer);
console.log(JSON.stringify({ path: output.pathname, bytes: buffer.length }));
