import React from 'react';
import type { ConnectorType } from './useConnectors';

interface IconProps {
  size?: number;
  className?: string;
}

export const CsvIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
    <line x1="12" y1="9" x2="12" y2="21" />
  </svg>
);

export const GoogleSheetsIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    <rect x="3" y="2" width="18" height="20" rx="2" stroke="#34A853" strokeWidth={1.8} />
    <line x1="3" y1="8" x2="21" y2="8" stroke="#34A853" strokeWidth={1.5} />
    <line x1="3" y1="13" x2="21" y2="13" stroke="#34A853" strokeWidth={1.5} />
    <line x1="3" y1="18" x2="21" y2="18" stroke="#34A853" strokeWidth={1.5} />
    <line x1="9" y1="2" x2="9" y2="22" stroke="#34A853" strokeWidth={1.5} />
    <line x1="15" y1="2" x2="15" y2="22" stroke="#34A853" strokeWidth={1.5} />
  </svg>
);

export const AirtableIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    <rect x="2" y="3" width="20" height="18" rx="3" stroke="#2D7FF9" strokeWidth={1.8} />
    <rect x="5" y="7" width="6" height="4" rx="1" fill="#2D7FF9" opacity={0.3} />
    <rect x="13" y="7" width="6" height="4" rx="1" fill="#2D7FF9" opacity={0.3} />
    <rect x="5" y="13" width="6" height="4" rx="1" fill="#2D7FF9" opacity={0.15} />
    <rect x="13" y="13" width="6" height="4" rx="1" fill="#2D7FF9" opacity={0.15} />
    <line x1="12" y1="3" x2="12" y2="21" stroke="#2D7FF9" strokeWidth={1.2} />
    <line x1="2" y1="11.5" x2="22" y2="11.5" stroke="#2D7FF9" strokeWidth={1.2} />
  </svg>
);

export const PostgresIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    <ellipse cx="12" cy="6" rx="8" ry="3" stroke="#336791" strokeWidth={1.8} />
    <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6" stroke="#336791" strokeWidth={1.8} />
    <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6" stroke="#336791" strokeWidth={1.8} />
    <ellipse cx="12" cy="12" rx="8" ry="3" stroke="#336791" strokeWidth={1.2} opacity={0.4} />
    <path
      d="M16 4c1.5 0 2.5-1 2.5-2"
      stroke="#336791"
      strokeWidth={1.4}
      strokeLinecap="round"
      opacity={0.6}
    />
  </svg>
);

export const JiraIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    <path
      d="M11.53 2c0 4.97 4.03 9 9 9h1.47v1.47c0 4.97-4.03 9-9 9H2v-1.47c0-4.97 4.03-9 9-9h.53V2z"
      fill="#2684FF"
    />
  </svg>
);

export const WebhookIcon: React.FC<IconProps> = ({ size = 20, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={className}
  >
    <circle cx="12" cy="5" r="3" stroke="#6366f1" strokeWidth={2} />
    <circle cx="5" cy="19" r="3" stroke="#6366f1" strokeWidth={2} />
    <circle cx="19" cy="19" r="3" stroke="#6366f1" strokeWidth={2} />
    <path d="M12 8v4l-5.5 5M12 12l5.5 5" stroke="#6366f1" strokeWidth={2} />
  </svg>
);

const iconMap: Record<ConnectorType, React.FC<IconProps>> = {
  csv: CsvIcon,
  google_sheets: GoogleSheetsIcon,
  airtable: AirtableIcon,
  postgresql: PostgresIcon,
  jira: JiraIcon,
  webhook: WebhookIcon,
};

export const ConnectorIcon: React.FC<IconProps & { type: ConnectorType }> = ({
  type,
  ...props
}) => {
  const Icon = iconMap[type] ?? CsvIcon;
  return <Icon {...props} />;
};

export const connectorMeta: Record<ConnectorType, { labelEn: string; labelPl: string; descEn: string; descPl: string }> = {
  csv: {
    labelEn: 'CSV / XLSX',
    labelPl: 'CSV / XLSX',
    descEn: 'Import data from spreadsheet files',
    descPl: 'Importuj dane z plików arkuszy',
  },
  google_sheets: {
    labelEn: 'Google Sheets',
    labelPl: 'Google Sheets',
    descEn: 'Connect to a Google Spreadsheet',
    descPl: 'Połącz z arkuszem Google',
  },
  airtable: {
    labelEn: 'Airtable',
    labelPl: 'Airtable',
    descEn: 'Sync data from an Airtable base',
    descPl: 'Synchronizuj dane z bazy Airtable',
  },
  postgresql: {
    labelEn: 'PostgreSQL',
    labelPl: 'PostgreSQL',
    descEn: 'Query a PostgreSQL database',
    descPl: 'Pobierz dane z bazy PostgreSQL',
  },
  jira: {
    labelEn: 'Jira',
    labelPl: 'Jira',
    descEn: 'Sync issues from Jira Cloud',
    descPl: 'Synchronizuj zadania z Jira Cloud',
  },
  webhook: {
    labelEn: 'Webhook',
    labelPl: 'Webhook',
    descEn: 'Receive data via incoming webhooks',
    descPl: 'Odbieraj dane przez webhooki',
  },
};
