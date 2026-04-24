import type {
  ConnectorsCatalogDetailResponse,
  ConnectorsCatalogItem,
  ConnectorsCatalogResponse,
  ConnectorsCatalogSummary,
  ConnectorsConnectorAuthStrategy,
  ConnectorsConnectorAvailability,
  ConnectorsConnectorCapabilityFlag,
  ConnectorsConnectorCategory,
  ConnectorsConnectorKind,
  ConnectorsConnectorWave,
} from '../../../types/v10/connectors-runtime.js';

type RegistryEntry = Omit<ConnectorsCatalogItem, 'recommended'>;

type ListCatalogOptions = {
  persona?: string | null;
  includePlanned?: boolean;
};

function normalizeKey(value: string | null | undefined): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function entry(args: {
  id: string;
  kind: ConnectorsConnectorKind;
  availability: ConnectorsConnectorAvailability;
  wave: ConnectorsConnectorWave;
  name: string;
  description: string;
  category: ConnectorsConnectorCategory;
  authStrategy: ConnectorsConnectorAuthStrategy;
  capabilities: ConnectorsConnectorCapabilityFlag[];
  readScopes?: string[];
  writeScopes?: string[];
  aliases?: string[];
  recommendedPersonas?: string[];
  entrySurfaces?: string[];
  enabledByDefault?: boolean;
}): RegistryEntry {
  return {
    ...args,
    readScopes: args.readScopes || [],
    writeScopes: args.writeScopes || [],
    aliases: args.aliases || [],
    recommendedPersonas: args.recommendedPersonas || [],
    entrySurfaces: args.entrySurfaces || ['admin_console', 'artifact_seed', 'chat'],
    enabledByDefault: args.enabledByDefault ?? args.availability === 'available',
  };
}

const CONNECTOR_REGISTRY: readonly RegistryEntry[] = [
  entry({
    id: 'google_drive',
    kind: 'external',
    availability: 'available',
    wave: 'wave_a',
    name: 'Google Drive',
    description: 'Read-only file and document access for real customer evidence.',
    category: 'storage',
    authStrategy: 'oauth2_pkce',
    capabilities: ['search', 'read_doc', 'list_recent', 'sync_delta', 'acl_probe'],
    readScopes: ['drive.readonly', 'drive.metadata.readonly'],
    aliases: ['drive', 'knowledge_base'],
    recommendedPersonas: ['CEO', 'Partner', 'Transformation Officer'],
  }),
  entry({
    id: 'slack',
    kind: 'external',
    availability: 'available',
    wave: 'wave_a',
    name: 'Slack',
    description: 'Workspace conversations, channels, and evidence snippets.',
    category: 'communication',
    authStrategy: 'oauth2_pkce',
    capabilities: [
      'search',
      'read_doc',
      'list_recent',
      'sync_delta',
      'acl_probe',
      'webhook_ingest',
    ],
    readScopes: ['channels:history', 'groups:history', 'users:read'],
    writeScopes: ['chat:write'],
    aliases: ['team_chat', 'communication_hub'],
    recommendedPersonas: ['COO', 'Transformation Officer', 'CISO'],
  }),
  entry({
    id: 'notion',
    kind: 'external',
    availability: 'available',
    wave: 'wave_a',
    name: 'Notion',
    description: 'Pages, docs, and knowledge base retrieval for artifact generation.',
    category: 'knowledge_base',
    authStrategy: 'oauth2_pkce',
    capabilities: ['search', 'read_doc', 'list_recent', 'sync_delta', 'acl_probe', 'write_doc'],
    readScopes: ['read:content'],
    writeScopes: ['write:content'],
    aliases: ['wiki', 'workspace_docs'],
    recommendedPersonas: ['CEO', 'Transformation Officer', 'Partner'],
  }),
  entry({
    id: 'gmail',
    kind: 'external',
    availability: 'available',
    wave: 'wave_a',
    name: 'Gmail',
    description: 'Read-only email connector for customer communication trails.',
    category: 'communication',
    authStrategy: 'oauth2_pkce',
    capabilities: ['search', 'read_doc', 'list_recent', 'sync_delta', 'send_email'],
    readScopes: ['gmail.readonly'],
    writeScopes: ['gmail.send'],
    aliases: ['email', 'mailbox'],
    recommendedPersonas: ['Partner', 'CEO'],
  }),
  entry({
    id: 'google_calendar',
    kind: 'external',
    availability: 'available',
    wave: 'wave_a',
    name: 'Google Calendar',
    description: 'Read-only calendar signals for meeting-aware reasoning and research.',
    category: 'productivity',
    authStrategy: 'oauth2_pkce',
    capabilities: ['list_recent', 'sync_delta', 'calendar_read'],
    readScopes: ['calendar.readonly'],
    aliases: ['calendar'],
    recommendedPersonas: ['COO', 'CEO'],
  }),
  entry({
    id: 'crm',
    kind: 'virtual',
    availability: 'planned',
    wave: 'wave_b',
    name: 'CRM Hub',
    description: 'Abstract CRM surface for Salesforce, HubSpot, and related revenue systems.',
    category: 'finance',
    authStrategy: 'oauth2_pkce',
    capabilities: ['search', 'read_doc', 'list_recent', 'sync_delta'],
    aliases: ['salesforce', 'hubspot', 'pipeline'],
    recommendedPersonas: ['Partner', 'CEO'],
  }),
  entry({
    id: 'erp',
    kind: 'virtual',
    availability: 'planned',
    wave: 'wave_b',
    name: 'ERP Stack',
    description: 'Finance and ERP connectors such as SAP, Oracle, and Dynamics.',
    category: 'finance',
    authStrategy: 'oauth2_pkce',
    capabilities: ['search', 'read_doc', 'sync_delta'],
    aliases: ['sap', 'oracle', 'dynamics'],
    recommendedPersonas: ['CFO'],
  }),
  entry({
    id: 'project_hub',
    kind: 'virtual',
    availability: 'planned',
    wave: 'wave_b',
    name: 'Project Hub',
    description: 'Project management surface for Jira, Linear, Monday, and similar tools.',
    category: 'productivity',
    authStrategy: 'oauth2_pkce',
    capabilities: ['search', 'read_doc', 'list_recent', 'sync_delta', 'create_ticket'],
    aliases: ['jira', 'linear', 'monday'],
    recommendedPersonas: ['COO', 'Transformation Officer'],
  }),
  entry({
    id: 'security_stack',
    kind: 'virtual',
    availability: 'planned',
    wave: 'wave_b',
    name: 'Security Stack',
    description: 'Security evidence surface for SIEM, IAM, and policy systems.',
    category: 'security',
    authStrategy: 'service_account',
    capabilities: ['search', 'read_doc', 'list_recent', 'sync_delta', 'acl_probe'],
    aliases: ['siem', 'iam', 'policy'],
    recommendedPersonas: ['CISO'],
    entrySurfaces: ['admin_console', 'chat'],
  }),
  entry({
    id: 'upload',
    kind: 'manual',
    availability: 'available',
    wave: 'wave_a',
    name: 'Manual Upload',
    description:
      'Fallback ingestion path for files and evidence when no live connector is attached.',
    category: 'manual_input',
    authStrategy: 'manual_upload',
    capabilities: ['read_doc'],
    aliases: ['manual', 'file_upload'],
    recommendedPersonas: ['Partner', 'CFO', 'CEO', 'COO', 'CISO', 'Transformation Officer'],
    entrySurfaces: ['artifact_seed', 'admin_console', 'chat'],
  }),
];

function byPersonaMatch(persona: string | null | undefined, connector: RegistryEntry): number {
  const normalized = normalizeKey(persona);
  if (!normalized) return 0;
  return connector.recommendedPersonas.some((item) => normalizeKey(item) === normalized) ? 1 : 0;
}

function buildSummary(connectors: readonly ConnectorsCatalogItem[]): ConnectorsCatalogSummary {
  return {
    total: connectors.length,
    available: connectors.filter((item) => item.availability === 'available').length,
    planned: connectors.filter((item) => item.availability === 'planned').length,
    external: connectors.filter((item) => item.kind === 'external').length,
    manual: connectors.filter((item) => item.kind === 'manual').length,
    virtual: connectors.filter((item) => item.kind === 'virtual').length,
  };
}

export class ConnectorsRegistryNotFoundError extends Error {
  readonly code = 'CONNECTORS_RUNTIME_CONNECTOR_NOT_FOUND';
  readonly status = 404;

  constructor(connectorId: string) {
    super(`Unknown connector: ${connectorId}`);
    this.name = 'ConnectorsRegistryNotFoundError';
  }
}

export class ConnectorsRegistryService {
  listCatalog(options: ListCatalogOptions = {}): ConnectorsCatalogResponse {
    const persona = options.persona?.trim() || null;
    const includePlanned = options.includePlanned ?? true;
    const connectors = CONNECTOR_REGISTRY.filter(
      (item) => includePlanned || item.availability === 'available'
    )
      .map<ConnectorsCatalogItem>((item) => ({
        ...item,
        recommended: byPersonaMatch(persona, item) === 1,
      }))
      .sort((left, right) => {
        const recommendationDelta = Number(right.recommended) - Number(left.recommended);
        if (recommendationDelta !== 0) return recommendationDelta;
        const availabilityDelta =
          Number(left.availability === 'planned') - Number(right.availability === 'planned');
        if (availabilityDelta !== 0) return availabilityDelta;
        return left.name.localeCompare(right.name);
      });

    return {
      generatedAt: new Date().toISOString(),
      persona,
      connectors,
      summary: buildSummary(connectors),
    };
  }

  getConnector(connectorId: string): ConnectorsCatalogDetailResponse {
    const normalized = normalizeKey(connectorId);
    const connector = CONNECTOR_REGISTRY.find(
      (item) =>
        normalizeKey(item.id) === normalized ||
        item.aliases.some((alias) => normalizeKey(alias) === normalized)
    );
    if (!connector) {
      throw new ConnectorsRegistryNotFoundError(connectorId);
    }

    return {
      generatedAt: new Date().toISOString(),
      connector: {
        ...connector,
        recommended: false,
      },
    };
  }
}

export const connectorsRegistryService = new ConnectorsRegistryService();
