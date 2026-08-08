import React from 'react';

export interface PreviewStructuredListItem {
  id: string;
  label: React.ReactNode;
  status?: React.ReactNode;
  note?: React.ReactNode;
}

export interface PreviewStructuredListProps {
  title: React.ReactNode;
  items: PreviewStructuredListItem[];
  emptyLabel?: React.ReactNode;
  ordered?: boolean;
}

/** Shared preview primitive for ordered steps, gates and other non-prose lists. */
export const PreviewStructuredList: React.FC<PreviewStructuredListProps> = ({
  title,
  items,
  emptyLabel = '—',
  ordered = false,
}) => (
  <div>
    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
      {title}
    </div>
    {items.length > 0 ? (
      <ol className="space-y-1 text-xs text-c-text-secondary">
        {items.map((item, index) => (
          <li key={item.id} className="flex items-start gap-1.5">
            {ordered ? <span className="tabular-nums text-c-text-muted">{index + 1}.</span> : null}
            <span className="min-w-0 flex-1">
              {item.label}
              {item.note ? (
                <span className="ml-1.5 text-[10px] text-c-warning">{item.note}</span>
              ) : null}
            </span>
            {item.status ? <span className="shrink-0 text-c-text-muted">{item.status}</span> : null}
          </li>
        ))}
      </ol>
    ) : (
      <div className="text-xs italic text-c-text-muted">{emptyLabel}</div>
    )}
  </div>
);

export default PreviewStructuredList;
