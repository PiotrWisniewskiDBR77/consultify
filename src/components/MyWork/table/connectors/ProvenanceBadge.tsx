import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface ProvenanceBadgeProps {
  source?: string;
  syncedAt?: string;
  manuallyOverridden?: boolean;
  connectorName?: string;
  trusted?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  csv: 'CSV Import',
  csv_xlsx: 'CSV/XLSX',
  jira: 'Jira',
  google_sheets: 'Google Sheets',
  airtable: 'Airtable',
  postgres: 'PostgreSQL',
  postgresql: 'PostgreSQL',
  webhook: 'Webhook',
  manual: 'Manual',
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({
  source,
  syncedAt,
  manuallyOverridden,
  connectorName,
  trusted,
}) => {
  if (!source) return null;

  const label = connectorName || SOURCE_LABELS[source] || source;
  const timeAgo = syncedAt ? formatTimeAgo(new Date(syncedAt)) : '';

  const titleParts = [`Synced from ${label}`];
  if (timeAgo) titleParts.push(timeAgo);
  if (manuallyOverridden) titleParts.push('Manually overridden');
  if (trusted !== undefined) titleParts.push(trusted ? 'Trusted source' : 'Untrusted source');

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium"
      style={{
        backgroundColor: manuallyOverridden ? '#fef3c7' : '#e0f2fe',
        color: manuallyOverridden ? '#92400e' : '#0369a1',
      }}
      title={titleParts.join(' \u2022 ')}
    >
      {trusted !== undefined && (
        <ShieldCheck
          size={12}
          style={{ color: trusted ? '#16a34a' : '#d97706' }}
        />
      )}
      {manuallyOverridden && <span className="text-[10px]">&#9998;</span>}
      <span>{label}</span>
      {timeAgo && (
        <span className="opacity-60 text-[10px]">{timeAgo}</span>
      )}
    </span>
  );
};

export default ProvenanceBadge;
