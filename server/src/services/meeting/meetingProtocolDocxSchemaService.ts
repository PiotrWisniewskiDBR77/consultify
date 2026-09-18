import type {
  DocumentBlock,
  DocumentSchema,
} from '../documentStudio/documentStudioTypes.js';
import type {
  ProtocolActionsBlock,
  ProtocolContent,
  ProtocolDecisionsBlock,
} from './meetingProtocolService.js';

const SOURCE_LABEL: Record<'register' | 'approved_note', Record<'decisions' | 'actions', string>> = {
  register: {
    decisions: 'Source: decisions register',
    actions: 'Source: follow-ups register',
  },
  approved_note: {
    decisions: 'Source: approved note',
    actions: 'Source: approved note',
  },
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.map(display).join(', ');
  return String(value);
}

function heading(id: string, text: string, level: 1 | 2 | 3): DocumentBlock {
  return { blockId: id, type: 'heading', content: { text, level } };
}

function paragraph(id: string, text: string): DocumentBlock {
  return { blockId: id, type: 'paragraph', content: { text } };
}

function table(id: string, headers: string[], rows: string[][]): DocumentBlock {
  return { blockId: id, type: 'table', content: { headers, rows } };
}

function numbered(id: string, items: string[]): DocumentBlock {
  return { blockId: id, type: 'numbered_list', content: { items } };
}

export interface MeetingProtocolDocumentInput {
  meetingId: string;
  version: string;
  status: string;
  content: ProtocolContent;
}

export function buildMeetingProtocolDocumentSchema(
  input: MeetingProtocolDocumentInput
): DocumentSchema {
  const { content } = input;
  const stamp = content.generatedAt || new Date(0).toISOString();
  const sections: DocumentSchema['sections'] = [];

  for (const block of content.blocks) {
    if (block.kind === 'meta') {
      sections.push({
        sectionId: 'meeting',
        orderIndex: sections.length,
        level: 1,
        title: 'Meeting',
        kind: 'body',
        sourceRefs: [],
        blocks: [
          heading('meeting-heading', block.title, 2),
          table('meeting-properties', ['Property', 'Value'], [
            ['When', `${display(block.startAt)} — ${display(block.endAt)}${block.timezone ? ` (${block.timezone})` : ''}`],
            ['Location', display(block.location)],
            ['Type', display(block.meetingType)],
            ['Lifecycle', display(block.lifecycleState)],
            ['Protocol', `v${input.version} (${input.status})`],
          ]),
        ],
      });
    } else if (block.kind === 'roles') {
      sections.push({
        sectionId: 'roles',
        orderIndex: sections.length,
        level: 1,
        title: 'Roles',
        kind: 'body',
        sourceRefs: [],
        blocks: [
          table('roles-table', ['Role', 'Person'], [
            ['Chair', display(block.chair)],
            ['Scribe', display(block.scribe)],
            ['Approver', display(block.approver)],
          ]),
        ],
      });
    } else if (block.kind === 'attendance') {
      sections.push({
        sectionId: 'attendance',
        orderIndex: sections.length,
        level: 1,
        title: 'Attendance',
        kind: 'body',
        sourceRefs: [],
        blocks: [
          table('attendance-table', ['Response', 'Attendees'], [
            ['Accepted', display(block.accepted)],
            ['Declined', display(block.declined)],
            ['Pending', display(block.pending)],
          ]),
        ],
      });
    } else if (block.kind === 'agenda') {
      sections.push({
        sectionId: 'agenda',
        orderIndex: sections.length,
        level: 1,
        title: 'Agenda',
        kind: 'body',
        sourceRefs: [],
        blocks: [
          numbered(
            'agenda-list',
            block.items.map(
              (item) =>
                `${item.title} (${item.durationMinutes} min${item.lead ? `, lead: ${item.lead}` : ''})`
            )
          ),
        ],
      });
    } else if (block.kind === 'proceedings') {
      sections.push({
        sectionId: 'proceedings',
        orderIndex: sections.length,
        level: 1,
        title: 'Proceedings',
        kind: 'body',
        sourceRefs: [],
        blocks: block.points.flatMap((point) => [
          heading(`proceedings-${point.position}-heading`, point.title, 3),
          ...(point.notes.trim() ? [paragraph(`proceedings-${point.position}-notes`, point.notes)] : []),
          paragraph(
            `proceedings-${point.position}-counts`,
            `${point.decisionCount} decisions · ${point.actionCount} actions`
          ),
        ]),
      });
    } else if (block.kind === 'decisions') {
      const decisions = block as ProtocolDecisionsBlock;
      sections.push({
        sectionId: 'decisions',
        orderIndex: sections.length,
        level: 1,
        title: 'Decisions',
        kind: 'body',
        sourceRefs: [],
        blocks: [
          paragraph('decisions-source', SOURCE_LABEL[decisions.source].decisions),
          table('decisions-table', ['Decision', 'Rationale', 'Owner', 'Type', 'Decided by'], [
            ...decisions.items.map((decision) => [
              display(decision.statement),
              display(decision.rationale),
              display(decision.owner),
              display(decision.decisionType),
              display(decision.decidedBy),
            ]),
          ]),
        ],
      });
    } else if (block.kind === 'actions') {
      const actions = block as ProtocolActionsBlock;
      sections.push({
        sectionId: 'actions',
        orderIndex: sections.length,
        level: 1,
        title: 'Actions',
        kind: 'body',
        sourceRefs: [],
        blocks: [
          paragraph('actions-source', SOURCE_LABEL[actions.source].actions),
          table('actions-table', ['Action', 'Owner', 'Due', 'Status', 'Agenda point'], [
            ...actions.items.map((action) => [
              display(action.title),
              display(action.owner),
              display(action.dueAt),
              display(action.taskStatus ?? action.status),
              display(action.agendaItemTitle),
            ]),
          ]),
        ],
      });
    } else if (block.kind === 'footer') {
      sections.push({
        sectionId: 'footer',
        orderIndex: sections.length,
        level: 1,
        title: 'Version history',
        kind: 'appendix',
        sourceRefs: [],
        blocks: [
          ...(block.nextOccurrence
            ? [paragraph('footer-next', `Next occurrence: ${block.nextOccurrence}`)]
            : []),
          ...(block.versions.length
            ? [
                numbered(
                  'footer-versions',
                  block.versions.map(
                    (entry) =>
                      `v${entry.version} — ${entry.status}${entry.approvedAt ? ` (${entry.approvedAt}${entry.approvedBy ? ` by ${entry.approvedBy}` : ''})` : ''}${entry.errata ? ` — ${entry.errata}` : ''}`
                  )
                ),
              ]
            : []),
        ],
      });
    }
  }

  return {
    documentId: `meeting-protocol-${input.meetingId}-v${input.version}`,
    artifactId: input.meetingId,
    title: content.blocks.find((block) => block.kind === 'meta')?.title ?? 'Meeting protocol',
    documentType: 'workshop_summary',
    language: 'en',
    audience: [],
    goal: 'inform',
    communicationRegister: 'professional',
    density: 'comprehensive',
    languageStyle: 'formal',
    confidentiality: 'internal',
    formattingSchema: {
      fonts: { body: 'Aptos', heading: 'Aptos Display' },
      headingStyles: { h1: 'Heading1', h2: 'Heading2', h3: 'Heading3' },
      tableStyles: { default: 'default' },
      listStyles: { bullet: 'bullet', numbered: 'numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2, right: 2 } },
      headers: { enabled: true, content: 'Meeting protocol' },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: true, content: `v${input.version} (${input.status})` },
      toc: false,
      coverPage: false,
      appendixStyle: 'none',
      citationStyle: 'inline_marker',
    },
    sections,
    sourceRefs: [],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export const meetingProtocolDocxSchemaService = Object.freeze({
  build: buildMeetingProtocolDocumentSchema,
});
