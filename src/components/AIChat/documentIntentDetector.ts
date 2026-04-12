/**
 * Detects if a chat message is a document creation intent (Wordy / Dokumenty module).
 * Targets reports, briefs, analyses, articles, and business documents.
 */

const DOCUMENT_INTENT_PATTERNS = [
  // EN — report/brief/article/document generation
  /\b(create|write|generate|prepare|draft)\s+(a\s+)?(report|brief|article|document|paper|analysis|memo|whitepaper)\b/i,
  /\b(weekly|monthly|quarterly|annual)\s+(report|update|summary)\b/i,
  /\bdue\s+diligence\b/i,
  /\bmarket\s+(analysis|research|report)\b/i,
  /\bexecutive\s+(summary|brief)\b/i,
  /\bsteering\s+committee\s+(brief|report|document)\b/i,
  /\bproject\s+kickoff\s+(document|report)\b/i,
  /\brisk\s+assessment\s+(report|document)\b/i,
  /\bbenefits?\s+track(ing|er)\s+(report)?\b/i,
  // PL — raport/brief/artykuł/dokument
  /\b(napisz|stwórz|przygotuj|wygeneruj|opracuj)\s+(mi\s+)?(raport|brief|artykuł|dokument|analizę|memo|notatkę)\b/i,
  /\b(tygodniowy|miesięczny|kwartalny|roczny)\s+(raport|przegląd|podsumowanie)\b/i,
  /\braport\s+(z\s+)?(due\s+diligence|oceny\s+ryzyk|analizy\s+rynku)\b/i,
  /\bdokument\s+(startu|kickoff)\s+(projektu)?\b/i,
];

const PRESENTATION_INTENT_PATTERNS = [
  // EN — deck/presentation/slides
  /\b(create|build|make|generate|prepare)\s+(a\s+)?(presentation|deck|slides?|pptx)\b/i,
  /\b(pitch\s+deck|investor\s+deck)\b/i,
  /\b(status\s+update|project\s+status)\s+(presentation|deck|slides)\b/i,
  /\bsteering\s+committee\s+(deck|presentation|slides)\b/i,
  /\bquarterly\s+(business\s+)?review\s+(deck|presentation|slides)?\b/i,
  /\bworkshop\s+(deck|presentation|slides|facilitation)\b/i,
  /\bstrategy\s+roadmap\s+(presentation|deck)?\b/i,
  // PL — prezentacja/deck/slajdy
  /\b(stwórz|przygotuj|wygeneruj|zbuduj)\s+(mi\s+)?(prezentację|prezentacja|deck|slajdy)\b/i,
  /\bpitch\s*deck\b/i,
  /\b(status\s+update|przegląd\s+kwartalny)\s+(prezentacj[aęi])?\b/i,
  /\bdeck\s+(zarządczy|warsztatowy|inwestycyjny)\b/i,
];

export function detectDocumentIntent(message: string): boolean {
  return DOCUMENT_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}

export function detectPresentationIntent(message: string): boolean {
  return PRESENTATION_INTENT_PATTERNS.some((pattern) => pattern.test(message));
}
