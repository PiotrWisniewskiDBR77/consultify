/**
 * useMentionSources — aggregates @-mention candidates from the chat stores and
 * the knowledge base. Read-only: it never mutates state, it just surfaces things
 * the user can reference inline. Candidates are filtered by the typed query and
 * capped per category to keep the palette compact.
 */

import { useMemo } from 'react';

import { useKnowledgeSearch } from '../../../hooks/useKnowledge';
import { useChatProjectStore } from '../../../store/useChatProjectStore';
import { useConversationStore } from '../../../store/useConversationStore';
import { fuzzyIncludes, type MentionCandidate } from './composerMentions';

const PER_CATEGORY_CAP = 5;

export interface ComposerAttachmentLike {
  name?: string;
  url?: string;
  kind?: string;
}

export function useMentionSources(
  query: string,
  attachments: ComposerAttachmentLike[]
): MentionCandidate[] {
  const projects = useChatProjectStore((s) => s.projects);
  const conversations = useConversationStore((s) => s.conversations);
  // KB search self-gates on query.length >= 2 (see useKnowledgeSearch).
  const { data: kbResults } = useKnowledgeSearch(query, PER_CATEGORY_CAP);

  return useMemo(() => {
    const out: MentionCandidate[] = [];

    // Attachments already on this message — reference by name.
    for (const att of attachments) {
      const label = (att.name || att.url || '').trim();
      if (!label) continue;
      if (!fuzzyIncludes(label, query)) continue;
      out.push({ type: 'attachment', id: label, label, sublabel: 'Attachment' });
      if (out.filter((c) => c.type === 'attachment').length >= PER_CATEGORY_CAP) break;
    }

    // Knowledge base documents (referenced inline by title).
    const docs = Array.isArray(kbResults) ? kbResults : [];
    for (const doc of docs.slice(0, PER_CATEGORY_CAP)) {
      if (!doc?.title) continue;
      out.push({
        type: 'document',
        id: doc.slug || doc.title,
        label: doc.title,
        sublabel: 'Document',
      });
    }

    // Chat folders / projects.
    for (const p of projects) {
      if (!p?.name) continue;
      if (!fuzzyIncludes(p.name, query)) continue;
      out.push({ type: 'project', id: p.id, label: p.name, sublabel: 'Folder' });
      if (out.filter((c) => c.type === 'project').length >= PER_CATEGORY_CAP) break;
    }

    // Existing conversations.
    for (const c of conversations) {
      const label = (c?.title || '').trim();
      if (!label) continue;
      if (!fuzzyIncludes(label, query)) continue;
      out.push({ type: 'conversation', id: c.id, label, sublabel: 'Conversation' });
      if (out.filter((x) => x.type === 'conversation').length >= PER_CATEGORY_CAP) break;
    }

    return out;
  }, [attachments, kbResults, projects, conversations, query]);
}
