export type KnowledgeDocAccessFilterInput = {
  columns: Set<string>;
  dialect: 'postgres' | 'question';
  firstParamIndex?: number;
  documentAlias: string;
  embeddingAlias?: string;
  userId?: string | null;
  projectIds?: string[];
};

export function buildKnowledgeDocAccessFilter({
  columns,
  dialect,
  firstParamIndex = 1,
  documentAlias,
  embeddingAlias,
  userId,
  projectIds = [],
}: KnowledgeDocAccessFilterInput): { sql: string; params: string[] } {
  const parentlessOnly = `NOT EXISTS (SELECT 1 FROM knowledge_docs ${documentAlias} WHERE ${documentAlias}.id = ${embeddingAlias}.document_id)`;
  if (!columns.has('scope')) {
    return { sql: embeddingAlias ? parentlessOnly : '1 = 0', params: [] };
  }

  const params: string[] = [];
  const placeholder = (value: string): string => {
    params.push(value);
    return dialect === 'postgres' ? `$${firstParamIndex + params.length - 1}` : '?';
  };
  const scopeAllowed = [
    `${documentAlias}.scope IS NULL`,
    `${documentAlias}.scope = 'organization'`,
  ];
  if (userId && columns.has('owner_id')) {
    scopeAllowed.push(`(${documentAlias}.scope = 'user' AND ${documentAlias}.owner_id = ${placeholder(userId)})`);
  }
  const allowed = `(${scopeAllowed.join(' OR ')})`;
  if (!embeddingAlias) return { sql: `(${allowed})`, params };
  return {
    sql: `NOT EXISTS (SELECT 1 FROM knowledge_docs ${documentAlias} WHERE ${documentAlias}.id = ${embeddingAlias}.document_id AND NOT (${allowed}))`,
    params,
  };
}
