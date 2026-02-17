export namespace LAYER_CONFIG {
  namespace session {
    let weight: number;
    let enabled: boolean;
    let ttlMinutes: number;
  }
  namespace project {
    let weight_1: number;
    export { weight_1 as weight };
    let enabled_1: boolean;
    export { enabled_1 as enabled };
  }
  namespace organization {
    let weight_2: number;
    export { weight_2 as weight };
    let enabled_2: boolean;
    export { enabled_2 as enabled };
  }
  namespace knowledge {
    let weight_3: number;
    export { weight_3 as weight };
    let enabled_3: boolean;
    export { enabled_3 as enabled };
  }
  namespace external {
    let weight_4: number;
    export { weight_4 as weight };
    let enabled_4: boolean;
    export { enabled_4 as enabled };
  }
}
export class SessionMemoryStore {
  constructor({ ttlMinutes }?: { ttlMinutes?: number });
  ttlMinutes: number;
  sessions: Map<any, any>;
  _getExpiry(): number;
  addMessage(userId: any, message: any): Promise<void>;
  getRecentContext(userId: any, limit?: number): Promise<any>;
  clearSession(userId: any): Promise<void>;
  cleanup(): void;
}
export class MemoryManager {
  sessionStore: SessionMemoryStore;
  projectStore: {
    getProjectContext(): Promise<{
      context: string;
    }>;
    addMemory(): Promise<{}>;
    recordDecision(): Promise<{}>;
    recordLearning(): Promise<{}>;
    getApplicableLearnings(): Promise<any[]>;
    getProjectMemory(): Promise<any[]>;
  };
  organizationStore: {
    searchPatterns(): Promise<any[]>;
    getRecentPatterns(): Promise<any[]>;
    extractPatternsFromProject(): Promise<{}>;
  };
  embeddingService: {
    search(): Promise<any[]>;
  };
  retrieve({
    userId,
    organizationId,
    projectId,
    queryText,
    includeExternal,
    maxTokens,
  }: {
    userId: any;
    organizationId: any;
    projectId: any;
    queryText: any;
    includeExternal?: boolean;
    maxTokens?: number;
  }): Promise<{
    query: any;
    chunks: any[];
    sources: {
      session: {
        count: number;
      };
      project: {
        count: number;
      };
      organization: {
        count: number;
      };
      knowledge: {
        count: number;
      };
      external: {
        count: number;
      };
    };
    totalTokens: any;
    latency: number;
  }>;
  recordIfSignificant({
    userId,
    organizationId,
    projectId,
    type,
    content,
    significance,
  }: {
    userId: any;
    organizationId: any;
    projectId: any;
    type: any;
    content: any;
    significance: any;
  }): Promise<
    | {
        recorded: boolean;
        reason: string;
      }
    | {
        recorded: boolean;
        reason?: undefined;
      }
  >;
  recordDecision(projectId: any, decision: any): Promise<void>;
  recordLearning(projectId: any, learning: any): Promise<void>;
  serializeForPrompt(result: any): string;
  getStats(
    organizationId: any,
    projectId: any
  ): Promise<{
    session: {
      available: boolean;
      ttlMinutes: number;
    };
    project: {
      available: boolean;
    };
    organization: {
      available: boolean;
    };
    knowledge: {
      available: boolean;
    };
    external: {
      available: boolean;
    };
  }>;
  _estimateTokens(chunks: any): any;
  _mergeAndRank(results: any, maxTokens: any): any[];
  _summarizeSources(results: any): {
    session: {
      count: number;
    };
    project: {
      count: number;
    };
    organization: {
      count: number;
    };
    knowledge: {
      count: number;
    };
    external: {
      count: number;
    };
  };
}
export default memoryManager;
declare const memoryManager: MemoryManager;
//# sourceMappingURL=memoryManager.d.ts.map
