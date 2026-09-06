/**
 * czatWidocznosc — DEC-403 (06.09, słowo właściciela przy przejściu do Fali 2).
 *
 * Trzy elementy Czatu, które właściciel uznał za pozostałość po
 * nieukończonych/wyłączonych funkcjach ("system generowania w ogóle nie
 * działa, pozostałość po czymś — ukryłbym go"), zostają UKRYTE z UI do
 * czasu Fali 2. Kod komponentów, które te elementy renderują
 * (BranchSelector, ChatSignalsPanel, V8ArtifactRunControl, klasyfikator
 * intencji dokumentu w UnifiedChatPanel.tsx) NIE jest usuwany ani
 * okaleczany — świadomie zostaje w repo, gotowy do odkrycia po
 * dokończeniu w Fali 2.
 *
 * To jest JEDYNE miejsce sterujące tą widocznością — jawnie, w kodzie,
 * bez nowej flagi środowiskowej (ZAKAZ nowych flag env z tego zlecenia).
 * Komponenty czytają te stałe zamiast duplikować warunki.
 */
export const UKRYTE_DEC403 = {
  /** Wybór/przełącznik gałęzi rozmowy ("Main (2)") w pasku nad czatem
   *  (BranchSelector w UnifiedChatPanel.tsx) — do Fali 2. Rozmowa zostaje
   *  zawsze na gałęzi domyślnej. */
  galezie: true,
  /** Wejście do "ważnych sygnałów" — ikona w nagłówku czatu i panel
   *  ChatSignalsPanel (UnifiedChatPanel.tsx) — do Fali 2. */
  sygnaly: true,
  /** System generowania materiałów: wejście do panelu "Plan materiału
   *  wynikowego" (V8ArtifactRunControl) oraz tryb "Dokument: …" w
   *  odpowiedziach czatu (klasyfikator detectDocumentIntent /
   *  hasStrongDocumentNoun w UnifiedChatPanel.tsx) — do Fali 2. Prośby o
   *  treść dostają zwykłą odpowiedź czatu (z istniejącym "Otwórz jako
   *  dokument" z canvasEmissionHeuristic, gdy treść się do tego nadaje). */
  generatorMaterialow: true,
} as const;
