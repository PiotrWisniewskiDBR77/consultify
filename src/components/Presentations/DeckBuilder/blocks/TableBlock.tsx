import React from 'react';

import type { CardBlock, CuratedColorSet } from '../../wizard/types';

interface Props {
  block: CardBlock;
  theme: CuratedColorSet;
}

export const TableBlock: React.FC<Props> = ({ block, theme }) => {
  const headers = (block.content.headers as string[]) || ['Column A', 'Column B', 'Column C'];
  const rows = (block.content.rows as string[][]) || [
    ['Data 1', 'Data 2', 'Data 3'],
    ['Data 4', 'Data 5', 'Data 6'],
  ];

  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: theme.colors.primary + '20' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ backgroundColor: theme.colors.primary + '10' }}>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 text-left font-semibold"
                style={{ color: theme.colors.heading }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="border-t"
              style={{ borderColor: theme.colors.primary + '10' }}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="px-3 py-2"
                  style={{ color: theme.colors.textPrimary }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
