export interface IntegrationCatalogEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  auth_type: 'oauth' | 'api_key';
  status: 'available' | 'beta' | 'coming_soon';
}

const INTEGRATIONS_CATALOG: IntegrationCatalogEntry[] = [
  { id: 'slack', name: 'Slack', description: 'Team communication & notifications', category: 'Communication', icon: '\u{1F4AC}', auth_type: 'oauth', status: 'available' },
  { id: 'microsoft_teams', name: 'Microsoft Teams', description: 'Team collaboration & meetings', category: 'Communication', icon: '\u{1F465}', auth_type: 'oauth', status: 'available' },
  { id: 'jira', name: 'Jira', description: 'Project & issue tracking', category: 'Project Management', icon: '\u{1F4CB}', auth_type: 'oauth', status: 'available' },
  { id: 'asana', name: 'Asana', description: 'Work management platform', category: 'Project Management', icon: '\u2705', auth_type: 'oauth', status: 'available' },
  { id: 'google_calendar', name: 'Google Calendar', description: 'Calendar integration', category: 'Productivity', icon: '\u{1F4C5}', auth_type: 'oauth', status: 'available' },
  { id: 'salesforce', name: 'Salesforce', description: 'CRM integration', category: 'CRM', icon: '\u2601\uFE0F', auth_type: 'oauth', status: 'available' },
  { id: 'hubspot', name: 'HubSpot', description: 'Marketing & sales platform', category: 'CRM', icon: '\u{1F9F2}', auth_type: 'oauth', status: 'available' },
  { id: 'zapier', name: 'Zapier', description: 'Automation workflows', category: 'Automation', icon: '\u26A1', auth_type: 'api_key', status: 'available' },
  { id: 'power_automate', name: 'Power Automate', description: 'Microsoft automation', category: 'Automation', icon: '\u{1F504}', auth_type: 'oauth', status: 'beta' },
  { id: 'github', name: 'GitHub', description: 'Code repository', category: 'Development', icon: '\u{1F419}', auth_type: 'oauth', status: 'available' },
  { id: 'azure_devops', name: 'Azure DevOps', description: 'Development lifecycle', category: 'Development', icon: '\u{1F537}', auth_type: 'oauth', status: 'coming_soon' },
  { id: 'aws_s3', name: 'AWS S3', description: 'Cloud storage', category: 'Storage', icon: '\u{1F4E6}', auth_type: 'api_key', status: 'available' },
];

export function getIntegrationsCatalogSeed(): IntegrationCatalogEntry[] {
  return INTEGRATIONS_CATALOG;
}
