import KnowledgeService from '../KnowledgeService.js';

export type ArtifactKnowledgeScope = 'user' | 'organization';

type ArtifactKnowledgeInput = {
  artifactId: string;
  organizationId: string;
  ownerId: string;
  projectId?: string | null;
  title: string;
  contentMd: string;
  confidentiality?: string | null;
};

export function inferKnowledgeScope(confidentiality?: string | null): ArtifactKnowledgeScope {
  const normalized = String(confidentiality || 'internal').trim().toLowerCase();
  return normalized === 'confidential' || normalized === 'restricted'
    ? 'user'
    : 'organization';
}

function knowledgeDocumentId(kind: 'document' | 'deck', artifactId: string): string {
  return `generated-${kind}-${artifactId}`;
}

async function indexArtifactForKnowledge(
  kind: 'document' | 'deck',
  input: ArtifactKnowledgeInput
): Promise<{ documentId: string; scope: ArtifactKnowledgeScope; chunkCount: number }> {
  const scope = inferKnowledgeScope(input.confidentiality);
  const content = String(input.contentMd || '').trim();
  const documentId = knowledgeDocumentId(kind, input.artifactId);
  const filename = `${String(input.title || kind).trim() || kind}.md`;

  await KnowledgeService.addDocument(
    filename,
    `artifact://${kind}/${input.artifactId}`,
    input.organizationId,
    input.projectId ?? null,
    Buffer.byteLength(content, 'utf8'),
    'generated_artifact',
    [kind, 'generated'],
    documentId,
    input.ownerId,
    scope
  );

  // The default search_knowledge_base path reads ai_knowledge_embeddings and
  // currently has no user-scope filter. Private artifacts therefore remain in
  // the scope-aware Vault tables only. This protection is local and does not
  // depend on the parallel Day 210 search fix landing first.
  const chunkCount = await KnowledgeService.processDocument(
    documentId,
    content,
    input.organizationId,
    scope === 'user'
  );

  return { documentId, scope, chunkCount };
}

export function indexDocumentArtifactForKnowledge(input: ArtifactKnowledgeInput) {
  return indexArtifactForKnowledge('document', input);
}

export function indexDeckArtifactForKnowledge(input: ArtifactKnowledgeInput) {
  return indexArtifactForKnowledge('deck', input);
}

function collectText(value: unknown, output: string[]): void {
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (normalized) output.push(normalized);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectText(item, output));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((item) => collectText(item, output));
  }
}

export function deckArtifactToKnowledgeMarkdown(deckJson: unknown, unifiedJson?: unknown): string {
  const deck = deckJson && typeof deckJson === 'object' ? (deckJson as Record<string, any>) : null;
  const lines: string[] = [];

  if (deck) {
    collectText(deck.title, lines);
    for (const card of Array.isArray(deck.cards) ? deck.cards : []) {
      collectText(card?.title, lines);
      collectText(card?.key_message, lines);
      for (const block of Array.isArray(card?.blocks) ? card.blocks : []) {
        collectText(block?.content, lines);
      }
      collectText(card?.speaker_notes, lines);
    }
  }

  if (lines.length === 0) {
    const unified =
      unifiedJson && typeof unifiedJson === 'object'
        ? (unifiedJson as Record<string, any>)
        : null;
    for (const slide of Array.isArray(unified?.slides) ? unified.slides : []) {
      collectText(slide?.key_message, lines);
      collectText(slide?.content, lines);
    }
  }

  return lines.join('\n\n');
}
