import type { DeckDocument, DeckDocumentCard } from './presentationDeckDocumentService.js';

export interface HeaderFooterOptions {
  enabled: boolean;
  showLogo: boolean;
  showConfidentiality: boolean;
  showPageNumbers: boolean;
  showCopyright: boolean;
  hideOnCover: boolean;
  footerText?: string;
}

export interface DeckBrandLayoutSystem {
  templateFamily: string;
  brand: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    surface: string;
    textPrimary: string;
    textSecondary: string;
    fontTitle: string;
    fontBody: string;
    logoUrl?: string | null;
  };
  headerFooter: HeaderFooterOptions;
  semanticStyles: {
    priority: Record<string, string>;
    confidence: Record<string, string>;
    readiness: Record<string, string>;
  };
  layoutLibrary: Record<string, string>;
}

const DEFAULT_LAYOUT_LIBRARY: Record<string, string> = {
  cover: 'cover-client-gradient',
  executive_summary: 'executive-summary-three-column',
  section_intro: 'section-divider-full-bleed',
  key_messages: 'insight-card-grid',
  performance_overview: 'dashboard-kpi-strip',
  single_insight: 'single-insight-proof',
  comparison: 'before-after-comparison',
  assessment: 'maturity-scorecard',
  recommendation_portfolio: 'initiative-card-grid',
  initiative_portfolio: 'portfolio-table-client',
  prioritization_matrix: 'impact-effort-matrix',
  roadmap: 'governance-roadmap',
  risk_management: 'raid-table',
  next_steps: 'decision-and-next-steps',
  appendix: 'appendix-dense-table',
};

export function buildBrandLayoutSystem(params: {
  brandColor?: string;
  confidentiality?: string;
  templateFamily?: string;
  footerText?: string;
}): DeckBrandLayoutSystem {
  const primary = params.brandColor || '#0B3D91';
  return {
    templateFamily: params.templateFamily || 'Digital Transformation Read Deck',
    brand: {
      primary,
      secondary: '#1A8A8A',
      accent: '#00BCD4',
      background: '#F8FAFC',
      surface: '#FFFFFF',
      textPrimary: '#0F172A',
      textSecondary: '#475569',
      fontTitle: 'Aptos Display',
      fontBody: 'Aptos',
    },
    headerFooter: {
      enabled: true,
      showLogo: true,
      showConfidentiality: params.confidentiality !== 'public',
      showPageNumbers: true,
      showCopyright: true,
      hideOnCover: true,
      footerText: params.footerText || 'Consultify transformation deck',
    },
    semanticStyles: {
      priority: {
        critical: 'rose',
        high: 'amber',
        medium: 'blue',
        low: 'slate',
        foundation: 'emerald',
      },
      confidence: {
        high: 'emerald',
        medium: 'blue',
        low: 'amber',
        gap: 'rose',
      },
      readiness: {
        ready: 'emerald',
        partial_ready: 'amber',
        missing_sales_data: 'amber',
        insufficient_evidence: 'rose',
        policy_blocked: 'rose',
      },
    },
    layoutLibrary: DEFAULT_LAYOUT_LIBRARY,
  };
}

export function applyBrandLayoutSystem(deck: DeckDocument, system: DeckBrandLayoutSystem): DeckDocument {
  const cards = deck.cards.map((card: DeckDocumentCard, index) => ({
    ...card,
    layout_id: system.layoutLibrary[String(card.intent)] || card.layout_id || 'content-card',
    blocks: card.blocks.map((block) => ({
      ...block,
      style_overrides: {
        ...(block.style_overrides || {}),
        semanticPalette: system.semanticStyles,
      },
    })),
    header_footer:
      system.headerFooter.enabled && !(index === 0 && system.headerFooter.hideOnCover)
        ? {
            confidentiality: deck.meta.confidentiality || 'internal',
            pageNumber: index + 1,
            totalPages: deck.cards.length,
            footerText: system.headerFooter.footerText,
            showPageNumbers: system.headerFooter.showPageNumbers,
          }
        : undefined,
  }));

  return {
    ...deck,
    theme_id: system.templateFamily,
    meta: {
      ...deck.meta,
      deckType: system.templateFamily,
    },
    delivery: {
      ...deck.delivery,
      brandLayoutSystem: system as any,
    } as any,
    cards,
  };
}
