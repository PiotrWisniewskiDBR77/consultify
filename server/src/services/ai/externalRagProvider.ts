export interface ExternalRagDocument {
  docKey: string;
  title: string;
  organizationId?: string | null;
  projectId?: string | null;
  chunks: Array<{
    chunkIndex: number;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface ExternalRagProvider {
  providerId: string;
  supportsSync: boolean;
  upsertDocument(document: ExternalRagDocument): Promise<{ externalDocumentId?: string | null }>;
  deleteDocument(docKey: string): Promise<void>;
  search(
    query: string,
    options?: { organizationId?: string | null; projectId?: string | null; limit?: number }
  ): Promise<Array<{ docKey: string; chunkText: string; score: number; metadata?: Record<string, unknown> }>>;
}

class LocalOnlyRagProvider implements ExternalRagProvider {
  providerId = 'local_embedded';
  supportsSync = false;

  async upsertDocument(): Promise<{ externalDocumentId?: string | null }> {
    return { externalDocumentId: null };
  }

  async deleteDocument(): Promise<void> {
    return;
  }

  async search(): Promise<Array<{ docKey: string; chunkText: string; score: number }>> {
    return [];
  }
}

export const externalRagProvider: ExternalRagProvider = new LocalOnlyRagProvider();
