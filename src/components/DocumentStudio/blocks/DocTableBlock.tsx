/**
 * Document Studio — DocTableBlock (R3).
 *
 * Pure renderer for `{columns, rows}` table content (consumes
 * {@link NarrowedTableContent} from `narrowTableContent`).
 *
 * §2 / §3 graphic parameters:
 *  - header: bold + highlighted background,
 *  - zebra striping (banded rows),
 *  - 1px borders, ~12px cell padding,
 *  - `riskSemantics`: colour Likelihood / Impact cells (+ keep the text label).
 */

import React from 'react';

import type { NarrowedTableContent } from './docBlockContent';

export interface DocTableBlockProps {
  content: NarrowedTableContent;
}

const BORDER = '1px solid #e2e8f0';
const CELL_PADDING = '8px 12px';

/** Risk level → background/foreground. Keeps the textual label (never replaces). */
function riskCellStyle(value: string): React.CSSProperties | undefined {
  const v = value.toLowerCase().trim();
  if (/^(high|critical|severe|wysoki|wysoka|krytyczny|krytyczna)$/.test(v) || v === '5' || v === '4') {
    return { background: '#fde8ea', color: '#9b1c2e', fontWeight: 600 };
  }
  if (/^(medium|moderate|średni|sredni|średnia|srednia)$/.test(v) || v === '3') {
    return { background: '#fff4e0', color: '#9a5b00', fontWeight: 600 };
  }
  if (/^(low|minor|niski|niska)$/.test(v) || v === '1' || v === '2') {
    return { background: '#e6f4ea', color: '#1e6b32', fontWeight: 600 };
  }
  return undefined;
}

export const DocTableBlock: React.FC<DocTableBlockProps> = ({ content }) => {
  const { columns, rows, riskSemantics, caption } = content;

  // Which columns get risk-colouring (Likelihood / Impact / Risk / Severity).
  const riskColIndexes = new Set<number>();
  if (riskSemantics) {
    columns.forEach((c, i) => {
      if (/(likelihood|probab|impact|severity|risk|prawdopod|wpływ|wplyw|ryzyko|istotno)/i.test(c)) {
        riskColIndexes.add(i);
      }
    });
  }

  if (columns.length === 0 && rows.length === 0) {
    return (
      <div
        className="doc-table-block__empty"
        style={{ padding: '16px 0', color: '#64748b', fontSize: 13 }}
      >
        No table data available
      </div>
    );
  }

  return (
    <figure className="doc-table-block" style={{ margin: 0, width: '100%', overflowX: 'auto' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          fontSize: 14,
          border: BORDER,
        }}
      >
        {columns.length > 0 && (
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  scope="col"
                  style={{
                    textAlign: 'left',
                    fontWeight: 700,
                    background: '#f1f5f9',
                    color: '#1e293b',
                    border: BORDER,
                    padding: CELL_PADDING,
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, rIdx) => (
            <tr
              key={rIdx}
              style={{ background: rIdx % 2 === 1 ? '#f8fafc' : '#ffffff' }}
            >
              {(columns.length > 0 ? columns : row).map((_, cIdx) => {
                const value = row[cIdx] ?? '';
                const risk = riskColIndexes.has(cIdx) ? riskCellStyle(value) : undefined;
                return (
                  <td
                    key={cIdx}
                    style={{
                      border: BORDER,
                      padding: CELL_PADDING,
                      color: '#334155',
                      ...risk,
                    }}
                  >
                    {value}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {caption && (
        <figcaption
          className="doc-table-block__caption"
          style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}
        >
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

export default DocTableBlock;
