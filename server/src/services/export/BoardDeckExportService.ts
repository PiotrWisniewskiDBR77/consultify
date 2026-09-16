import { unifiedExportService } from './UnifiedExportService.js';

export type CanvasDeckSection = {
  title: string;
  body: string;
};

export type CanvasBoardDeckInput = {
  title: string;
  organizationName: string;
  sourceId: string;
  lifecycle: string;
  updatedAt: string;
  sections: CanvasDeckSection[];
};

export type PartnerBoardDeckInput = {
  language: 'en' | 'pl';
};

class BoardDeckExportService {
  async exportCanvasDeck(input: CanvasBoardDeckInput): Promise<Buffer> {
    const sections = input.sections.length
      ? input.sections.slice(0, 6)
      : [{ title: input.title, body: 'No slide body available.' }];

    return unifiedExportService.exportBoardDeckPptx({
      title: input.title,
      organizationName: input.organizationName,
      date: input.updatedAt.slice(0, 10),
      confidentiality: input.lifecycle,
      author: 'Business Work Canvas',
      slides: [
        {
          role: 'cover',
          kicker: 'WORK CANVAS',
          title: input.title,
          subtitle: input.organizationName,
        },
        {
          role: 'agenda',
          kicker: 'Agenda',
          title: 'Contents',
          agenda: sections.map((section, index) => ({
            number: String(index + 1).padStart(2, '0'),
            title: section.title,
          })),
        },
        ...sections.map((section) => ({
          role: 'content-one' as const,
          kicker: 'Canvas output',
          title: section.title,
          body: section.body,
          source: `Work Canvas ${input.sourceId}`,
        })),
      ],
    });
  }

  async exportPartnerSalesDeck(input: PartnerBoardDeckInput): Promise<Buffer> {
    const pl = input.language === 'pl';
    const title = pl ? 'Consultify — Deck partnerski' : 'Consultify — Partner Sales Deck';
    const subtitle = pl
      ? 'Bezpieczne obietnice, uporządkowane discovery i decyzje oparte na dowodach'
      : 'Safe claims, structured discovery and evidence-backed decisions';
    const bullets = pl
      ? [
          'Prowadzi uporządkowane discovery i uzgodnienia w programach transformacji.',
          'Łączy fakty, niewiadome, insighty i decyzje w jeden ślad pracy.',
          'Wspiera governance bez obietnic automatyzacji, których nie potwierdzają dowody.',
        ]
      : [
          'Runs structured discovery and alignment in transformation programs.',
          'Connects facts, unknowns, insights and decisions in one work trail.',
          'Supports governance without automation claims that exceed the evidence.',
        ];

    return unifiedExportService.exportBoardDeckPptx({
      title,
      organizationName: 'Partner',
      date: new Date().toISOString().slice(0, 10),
      confidentiality: pl ? 'Materiał partnerski' : 'Partner material',
      language: input.language,
      slides: [
        {
          role: 'cover',
          kicker: pl ? 'MATERIAŁ PARTNERSKI' : 'PARTNER MATERIAL',
          title,
          subtitle,
        },
        {
          role: 'content-one',
          kicker: 'Consultify',
          title: pl ? 'Czym jest Consultify?' : 'What is Consultify?',
          bullets,
        },
      ],
    });
  }
}

export const boardDeckExportService = new BoardDeckExportService();
export type { BoardDeckExportService };
