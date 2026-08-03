/**
 * insightCardContract.ts — MIGRACJA: Insight adoptuje WIĄŻĄCY kontrakt karty (D-8).
 *
 * SSOT modelu:  Harvard/wdrozenie-100/_KANON_KARTY_MODEL_2026-07-22.md (§2.2, §3)
 * Przepis:      Harvard/wdrozenie-100/_PRZEPIS_MIGRACJI_INSIGHT_2026-07-22.md (§1 deskryptor, §2 kroki)
 * Typ wiążący:  src/components/standard/cardContract.types.ts (definiujKarteKanoniczna)
 * Wzorzec:      src/components/MyWork/decisionCardContract.ts (POC, commit 738447b039)
 *
 * ── CO TEN PLIK UDOWADNIA ────────────────────────────────────────────────────
 * Kompozycja kart Insight PŁYNIE PRZEZ kontrakt kanoniczny, nie przez luźny
 * `INSIGHT_SPEC` z `cardSets.ts` (który dla Insight jest MARTWYM MIRROREM — 18
 * kart, NIE importowanym przez render; przepis §0). Każda z 32 renderowanych
 * sekcji jest zadeklarowana jako `KanonicznaKarta` (przez fabrykę
 * `definiujKarteKanoniczna`), więc stany niedozwolone są MARTWE TYPEM:
 *   · brak id/label/roli/kompozycji            → błąd kompilacji,
 *   · rola 'pisze'/'asystuje' bez `aiPrompt`    → błąd kompilacji,
 *   · rola 'dane'/'systemowa'/'transakcyjna'    → MUSI jawnie nazwać brak promptu.
 * Rdzeń (`executive-summary` + `artifact-actions`, rola `rdzen`) jest nieusuwalny
 * NIE przez konwencję UI, lecz przez typ: adapter wyprowadza `core:true` wprost z
 * `rola==='rdzen'`, a `useCardLayout.removeCard` przerywa dla `core`
 * (useCardLayout.ts:200). Rdzeń nie ma jak zniknąć z katalogu, bo krotka
 * `KompozycjaKarty` jest NIEPUSTA.
 *
 * ── ŹRÓDŁO PRAWDY = INSIGHT_SECTIONS, nie cardSets (przepis §1, R5) ───────────
 * `INSIGHT_SECTIONS` (InsightViewer.tsx:671-825) renderuje 32 sekcje lewej
 * kolumny — to jest prawda. `cardSets.INSIGHT_SPEC` to martwy mirror (R5: wciąż
 * trzyma `comments`+`activity-log` w secie default, choć TODO#23c usunął je z
 * lewej kolumny do PRAWEGO panelu). Deskryptor czerpie z INSIGHT_SECTIONS, więc
 * NIE przywraca `comments`/`activity-log` do lewej nawigacji — one żyją w
 * `ArtifactRightPanel` i NIE są tu deklarowane (poza katalogiem lewej kolumny).
 *
 * ── ROZJAZD 32/16: jawna trasa 16 sekcji poza katalogiem (przepis §1D) ───────
 * KANON §2.2 zna 16 id Insight (2 rdzeń + 14). INSIGHT_SECTIONS renderuje 32.
 * Nadwyżkę 16 rozstrzygamy TU, w danych (nie chowamy):
 *   · Grupa 1 (4 „między wierszami": quote-comparison, sentiment-tone,
 *     power-dynamics, hypothesis-board) → ADMIT jako `dodawalna`. Ryzyko niskie
 *     (render istnieje, brak dubla). ★ DO POTWIERDZENIA PIOTRA: dodawalne w
 *     katalogu (tak wybrano) vs „extras" zawsze-widoczne poza kontraktem.
 *   · Grupa 2 (material-quality) → ADMIT do katalogu (AUDIT). Koryguje KANON §2.3
 *     („w kodzie NIE ISTNIEJE") — ISTNIEJE i renderuje (InsightViewer.tsx:771 nav,
 *     :3581 case), DOC oznacza WYMAGANĄ. `statusKanonu:'rozjazd'` (wchłania
 *     truth-review-summary). ★ DO POTWIERDZENIA: rola 'dane' vs 'asystuje'.
 *   · Grupa 3 (9 „Phase-D: Canon 23/23") → `statusKanonu:'do-decyzji-piotra'`.
 *     Semantycznie DUBLUJĄ istniejące 16 (consulting-narrative↔consulting-readout,
 *     key-findings↔candidate-triage, tensions↔consensus-divergence, patterns↔themes,
 *     stakeholder-map↔people, source-credibility↔source-pack, …). Adapter WYKLUCZA
 *     je ze spec (katalog+sets) → renderują się nadal jako „extras" (applyToSections
 *     dokleja nieznane na końcu, useCardLayout.ts:306-308) — ZERO utraty treści,
 *     ZERO regresji — ale NIE wchodzą do kanonicznego katalogu, dopóki Piotr nie
 *     orzeknie dedupu.
 *     ★ DO POTWIERDZENIA PIOTRA: dla każdej — osobna karta czy alias/duplikat?
 *     ★ DECYZJA PIOTRA (Faza 0, 2026-07-22, DEDUP): 2 karty tej grupy dublowały
 *     RDZEŃ wprost (nie zwykłą kartę domyślną/dodawalną) — `executive-memo`
 *     (↔`executive-summary`) i `recommendations`(↔`artifact-actions`). Te dwie
 *     SCALONO z rdzeniem: usunięte z `INSIGHT_CARDS` (żadna unikalna treść promptu/
 *     progu do przeniesienia — obie miały wyłącznie zaślepkę „(Phase-D)", rdzeń już
 *     niósł pełny prompt+próg). Nadal renderowane przez `INSIGHT_SECTIONS`
 *     (nietknięte, poza zakresem tej migracji) jako „extras" na końcu — dokładnie
 *     tak jak pozostałe 9 działały PRZED „domknięciem zwężenia" (zero regresji,
 *     zero utraty treści). Katalog/picker „Sekcje ▾" NIE pokazuje już tych dwóch
 *     jako osobnych, mylących duplikatów obok kart rdzenia. Pozostałe 9 BEZ ZMIAN.
 *
 * ── WĘŻSZY ZESTAW DOMYŚLNY (D-5, przepis §1A/§1B) ────────────────────────────
 * Domyślny = RDZEŃ (2) + spine analityczny (8: consulting-readout, themes,
 * issues-risks, opportunities, evidence-map, candidate-triage, source-pack,
 * report-pack) = 10 kart. Reszta katalogu (6 „full" między-wierszami + 4 extras
 * grupy 1 + material-quality = 11) → `dodawalna`, ukryta domyślnie, wracalna
 * przez „≡ Sekcje ▾" (show/hide) i „Przywróć domyślne". Zestaw „Pełny" = 21.
 *
 * ── ALIASY (przepis §1: brak aliasów id dla Insight) ─────────────────────────
 * W przeciwieństwie do Decision (governance→governance-escalation), Insight NIE ma
 * aliasów id — id kanoniczne == id renderowane dla wszystkich 32. Absorpcje są
 * MERGE'ami treści (composedComponentById, InsightViewer.tsx:660), nie aliasami:
 *   candidate-triage ← wchłania traceability   (label „Findings & Evidence")
 *   source-pack      ← wchłania source-sessions
 *   material-quality ← wchłania truth-review-summary
 * Render-id == id kanoniczny; `renderId()` zostaje dla parytetu z Decision.
 *
 * ── ZAKRES = STRUKTURA, NIE KOLOR ────────────────────────────────────────────
 * Ten plik migruje KOMPOZYCJĘ kart (deskryptor/rdzeń/default/picker). Zero tokenów
 * wizualnych — czyste dane. Crimson w centrum Insight (baseline = 0) NIE dotknięty.
 *
 * ── GRANICA MIGRACJI (uczciwość > kompletność) ───────────────────────────────
 * · `aiPrompt.szablon` to SKRÓT intencji; pełny template generacji żyje w
 *   handlerach FE/serwisach Insight (generateInsight*, cardContentFormula*).
 * · `prog` = `do-decyzji-piotra` dla wszystkich (D-1 otwarte, KONTRAKT §2).
 * · Za flagą `VITE_VF1_INSIGHT_CARD_CONTRACT` / dev URL `?cardContract=1`
 *   (default OFF) — jak POC Decision/Task. Zero regresji na demo.
 */

import type { ArtifactCardSpec, CardCatalogEntry, CardSet } from '../shared/NModeLayout/cardSets';
import { definiujKarteKanoniczna, type KanonicznaKarta } from '../standard/cardContract.types';

// ─────────────────────────────────────────────────────────────────────────────
// (1) KATALOG KANONICZNY INSIGHT — 30 kart (po Faza 0 DEDUP; INSIGHT_SECTIONS,
//     InsightViewer.tsx:671, nadal renderuje 32 — `executive-memo`/`recommendations`
//     scalone z rdzeniem, poza katalogiem, patrz nagłówek pliku i Grupa 3 niżej).
//     Kolejność deklaracji = kolejność renderu (zero regresji układu). Grupa
//     kompozycyjna (rdzeń/domyślna/dodawalna) wg przepisu §1A/§1B/§1D.
// ─────────────────────────────────────────────────────────────────────────────

// ── 1A. RDZEŃ (2) — nieusuwalny (rola `rdzen` ⇒ core:true w adapterze) ────────

const ARTIFACT_ACTIONS = definiujKarteKanoniczna({
  id: 'artifact-actions',
  // 2026-07-23 (zgłoszenie właściciela, ETAP 2.5 pkt 1): etykieta przeklasyfikowana
  // z „Dalsze akcje" na „Rezultaty" — tworzenie kolejnego artefaktu to REZULTAT
  // wniosku, nie akcja na nim. `id` NIETKNIĘTE (rola `rdzen` ⇒ core:true).
  label: { en: 'Results', pl: 'Rezultaty' },
  grupa: 'INSIGHT',
  ikona: 'Rocket',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zaproponuj dalsze działania wynikające z wniosku: co, kto, po co — gotowe do konwersji na inicjatywę/zadanie.',
    kluczPromptu: 'insight.artifact-actions',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [{ artefakt: 'insight', rola: 'rdzen', klasa: 'L', kolumna: 'left', kolejnosc: 0 }],
  statusKanonu: { stan: 'czysta' },
});

const EXECUTIVE_SUMMARY = definiujKarteKanoniczna({
  id: 'executive-summary',
  label: { en: 'Executive Summary', pl: 'Podsumowanie' },
  grupa: 'INSIGHT',
  ikona: 'Star',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Napisz podsumowanie wykonawcze wniosku: główna teza, dowody, największa dostępna dźwignia — językiem zarządu.',
    kluczPromptu: 'insight.executive-summary',
  },
  prog: { rodzaj: 'scoring-calosci', prog: 90, dowod: 'cardContentFormulaValidator.ts:59' },
  kompozycja: [{ artefakt: 'insight', rola: 'rdzen', klasa: 'L', kolumna: 'left', kolejnosc: 1 }],
  statusKanonu: { stan: 'czysta' },
});

// ── 1B. Spine analityczny (8) — DOMYŚLNE (przepis §1B) ────────────────────────

const CONSULTING_READOUT = definiujKarteKanoniczna({
  id: 'consulting-readout',
  label: { en: 'Consulting Readout', pl: 'Odczyt konsultingowy' },
  grupa: 'INSIGHT',
  ikona: 'Sparkles',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zsyntetyzuj odczyt konsultingowy: narracja od problemu do rekomendacji, w tonie doradcy strategicznego.',
    kluczPromptu: 'insight.consulting-readout',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 2 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const THEMES = definiujKarteKanoniczna({
  id: 'themes',
  label: { en: 'Themes', pl: 'Tematy' },
  grupa: 'INSIGHT',
  ikona: 'Layers',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Wyodrębnij powtarzające się tematy z materiału źródłowego, z siłą i dowodami; oznacz wzorce między sesjami.',
    kluczPromptu: 'insight.themes',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 3 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const ISSUES_RISKS = definiujKarteKanoniczna({
  id: 'issues-risks',
  label: { en: 'Issues & Risks', pl: 'Problemy i ryzyka' },
  grupa: 'INSIGHT',
  ikona: 'ShieldAlert',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zidentyfikuj problemy i ryzyka z materiału: waga, dowód, pewność; osadź każde na cytacie źródłowym.',
    kluczPromptu: 'insight.issues-risks',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 4 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const OPPORTUNITIES = definiujKarteKanoniczna({
  id: 'opportunities',
  label: { en: 'Opportunity Spaces', pl: 'Przestrzenie szans' },
  grupa: 'INSIGHT',
  ikona: 'TrendingUp',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Wskaż przestrzenie szans wynikające z materiału: wpływ, wykonalność, dowód; preferuj dźwignie bez CAPEX.',
    kluczPromptu: 'insight.opportunities',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 5 },
  ],
  statusKanonu: { stan: 'czysta' },
});

// ── 1B/full. „Między wierszami" (6) — DODAWALNE (zestaw pełny, przepis §1B) ────

const PEOPLE = definiujKarteKanoniczna({
  id: 'people',
  label: { en: 'People', pl: 'Perspektywy' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'Users',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zestaw perspektywy poszczególnych ról/osób: co każda strona widzi inaczej i dlaczego.',
    kluczPromptu: 'insight.people',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 6 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const SIGNALS = definiujKarteKanoniczna({
  id: 'signals',
  label: { en: 'Signals', pl: 'Sygnały' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'Radio',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Wychwyć słabe sygnały: napięcia, luki, sprzeczności, wschodzące wzorce — z typem i uzasadnieniem.',
    kluczPromptu: 'insight.signals',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 7 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const ANALYSIS_MATRIX = definiujKarteKanoniczna({
  id: 'analysis-matrix',
  label: { en: 'Analysis Matrix', pl: 'Macierz Analizy' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'BarChart3',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zbuduj macierz analityczną (np. wpływ×wykonalność) pozycjonującą ustalenia względem siebie.',
    kluczPromptu: 'insight.analysis-matrix',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 8 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const CONSENSUS_DIVERGENCE = definiujKarteKanoniczna({
  id: 'consensus-divergence',
  label: { en: 'Consensus & Divergence', pl: 'Zgoda i rozbieżności' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'GitCompare',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Rozdziel to, co rozmówcy widzą zgodnie, od tego, w czym się rozchodzą; rozbieżność sama jest ustaleniem.',
    kluczPromptu: 'insight.consensus-divergence',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 9 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const IMPLICIT_ASSUMPTIONS = definiujKarteKanoniczna({
  id: 'implicit-assumptions',
  label: { en: 'Implicit Assumptions', pl: 'Ukryte założenia' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'Brain',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Ujawnij założenia przyjmowane milcząco przez rozmówców — to, co uznają za oczywiste, a nie jest.',
    kluczPromptu: 'insight.implicit-assumptions',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 10 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const SILENCES = definiujKarteKanoniczna({
  id: 'silences',
  label: { en: 'Silences', pl: 'Przemilczenia' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'EyeOff',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Nazwij to, czego w materiale NIE ma, a być powinno — tematy pominięte, role nieobjęte, pytania niezadane.',
    kluczPromptu: 'insight.silences',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 11 },
  ],
  statusKanonu: { stan: 'czysta' },
});

// ── 1D. Grupa 1 (4) — „między wierszami" extras → ADMIT `dodawalna` (przepis §1D) ─
// ★ DO POTWIERDZENIA PIOTRA: dodawalne w katalogu (tak wybrano — spójne z resztą
//   „między wierszami") vs „extras" zawsze-widoczne poza kontraktem kompozycji.

const QUOTE_COMPARISON = definiujKarteKanoniczna({
  id: 'quote-comparison',
  label: { en: 'Quote Comparison', pl: 'Porównanie cytatów' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'MessageSquare',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zestaw cytaty mówiące o tym samym z różnych sesji — pokaż zbieżność lub kontrast sformułowań.',
    kluczPromptu: 'insight.quote-comparison',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 12 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const SENTIMENT_TONE = definiujKarteKanoniczna({
  id: 'sentiment-tone',
  label: { en: 'Sentiment & Tone', pl: 'Sentyment i ton' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'Heart',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Opisz sentyment i ton wypowiedzi per temat/rola — gdzie emocje różnią się od treści deklaracji.',
    kluczPromptu: 'insight.sentiment-tone',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 13 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const POWER_DYNAMICS = definiujKarteKanoniczna({
  id: 'power-dynamics',
  label: { en: 'Power Dynamics', pl: 'Dynamika władzy' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'Scale',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zmapuj układ wpływu i decyzyjności między rolami — kto realnie przesądza, a kto tylko wykonuje.',
    kluczPromptu: 'insight.power-dynamics',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 14 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const HYPOTHESIS_BOARD = definiujKarteKanoniczna({
  id: 'hypothesis-board',
  label: { en: 'Hypothesis Board', pl: 'Tablica hipotez' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'Target',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Sformułuj hipotezy do weryfikacji wynikające z materiału — z proponowanym sprawdzianem dla każdej.',
    kluczPromptu: 'insight.hypothesis-board',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 15 },
  ],
  statusKanonu: { stan: 'czysta' },
});

// ── 1B. Dowody + Dostarczane — DOMYŚLNE (przepis §1B) ─────────────────────────

const EVIDENCE_MAP = definiujKarteKanoniczna({
  id: 'evidence-map',
  label: { en: 'Evidence Map', pl: 'Mapa dowodów' },
  grupa: 'EVIDENCE',
  ikona: 'MapIcon',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zbuduj mapę dowodów: powiąż odpowiedzi źródłowe z tematami i problemami, z cytatem-fragmentem.',
    kluczPromptu: 'insight.evidence-map',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 16 },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** DOMYŚLNA — label drift „Findings & Evidence"; wchłania `traceability` (merge, nie alias). */
const CANDIDATE_TRIAGE = definiujKarteKanoniczna({
  id: 'candidate-triage',
  label: { en: 'Findings & Evidence', pl: 'Wnioski i dowody' },
  grupa: 'EVIDENCE',
  ikona: 'Eye',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zbierz wnioski-kandydatów wraz z dowodami i śladem pochodzenia; oznacz gotowość do przekazania.',
    kluczPromptu: 'insight.candidate-triage',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 17 },
  ],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'label „Findings & Evidence" ≠ DOC „Triage kandydatów"; wchłania traceability (R6). Relacja do key-findings (§1D grupa 3) do dedupu z Piotrem.',
    dowod: 'InsightViewer.tsx:750,752,664',
  },
});

/** DOMYŚLNA — dane (źródła/cytowania); wchłania `source-sessions` (merge). */
const SOURCE_PACK = definiujKarteKanoniczna({
  id: 'source-pack',
  label: { en: 'Sources', pl: 'Źródła' },
  grupa: 'EVIDENCE',
  ikona: 'Link2',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason:
      'źródła i sesje wskazuje materiał/użytkownik — karta zestawia referencje, nie generuje prozy (wchłania source-sessions, InsightViewer.tsx:756,663)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 18 },
  ],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'wchłania source-sessions (merge treści); ★ DO POTWIERDZENIA: rola dane vs asystuje (jeśli AI kuratoruje pakiet źródeł)',
    dowod: 'InsightViewer.tsx:756,663',
  },
});

const REPORT_PACK = definiujKarteKanoniczna({
  id: 'report-pack',
  label: { en: 'Report Pack', pl: 'Pakiet raportu' },
  grupa: 'DELIVERABLES',
  ikona: 'FileText',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Złóż pakiet raportu z sekcji wniosku — kompletny, gotowy do eksportu materiał dla klienta.',
    kluczPromptu: 'insight.report-pack',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 19 },
  ],
  statusKanonu: { stan: 'czysta' },
});

// ── 1D. Grupa 2 (1) — AUDIT: material-quality → ADMIT do katalogu (przepis §1D) ─
// Koryguje KANON §2.3 („w kodzie NIE ISTNIEJE"). ISTNIEJE i renderuje.
// ★ DO POTWIERDZENIA PIOTRA: rola 'dane' (metryki jakości materiału) vs 'asystuje'.

const MATERIAL_QUALITY = definiujKarteKanoniczna({
  id: 'material-quality',
  label: { en: 'Quality & Trust', pl: 'Jakość i zaufanie' },
  grupa: 'AUDIT',
  ikona: 'Gauge',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason:
      'metryki jakości i zaufania materiału są liczone/oceniane z danych źródłowych, nie generowane jako proza (wchłania truth-review-summary, InsightViewer.tsx:771,3581)',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 20 },
  ],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'KANON §2.3 błędnie: „w kodzie NIE ISTNIEJE" — ISTNIEJE (nav :771, case :3581), DOC oznacza WYMAGANĄ; wchłania truth-review-summary. Admit do katalogu.',
    dowod: 'InsightViewer.tsx:771,3581',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// (1D grupa 3) — „Phase D: Canon 23/23" (9, po dedupie Faza 0) — statusKanonu
//     'do-decyzji-piotra'. Renderowane (InsightViewer.tsx:783-824), lecz DUBLUJĄ
//     semantycznie 16 wyżej. Adapter WYKLUCZA je ze spec (katalog+sets) → renderują
//     jako „extras" (bez regresji), ale NIE wchodzą do kanonicznego katalogu do
//     czasu dedupu z Piotrem.
//     ★ DO POTWIERDZENIA PIOTRA: dla każdej — osobna karta czy alias istniejącej?
//     ★ DECYZJA PIOTRA (Faza 0, DEDUP): `executive-memo` i `recommendations`
//     dublowały RDZEŃ wprost — SCALONE z rdzeniem, usunięte z tej grupy (patrz
//     komentarz nagłówkowy pliku, sekcja Grupa 3). Definicje ich const USUNIĘTE
//     poniżej; treść zachowana w kartach rdzenia (EXECUTIVE_SUMMARY/ARTIFACT_ACTIONS
//     — już bogatsze niż zaślepki Phase-D, więc nic do przeniesienia).
// ─────────────────────────────────────────────────────────────────────────────

const KEY_FINDINGS = definiujKarteKanoniczna({
  id: 'key-findings',
  label: { en: 'Key Findings', pl: 'Kluczowe wnioski' },
  grupa: 'INSIGHT',
  ikona: 'Star',
  rolaAI: 'pisze',
  aiPrompt: { szablon: 'Kluczowe wnioski (Phase-D).', kluczPromptu: 'insight.key-findings' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 21 },
  ],
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: 'dubluje candidate-triage „Findings & Evidence" (InsightViewer.tsx:785 vs :750)',
  },
});

// USUNIĘTE (Faza 0, DEDUP): `recommendations` dublowało ARTIFACT_ACTIONS (rdzeń)
// wprost. Scalone z rdzeniem — brak unikalnej treści do przeniesienia (miało
// wyłącznie zaślepkę „Rekomendacje (Phase-D)."). Nadal renderowane przez
// INSIGHT_SECTIONS (nietknięte) jako „extra" doklejane na końcu listy —
// zero utraty treści, zero regresji (jak przed „domknięciem zwężenia").

const TENSIONS = definiujKarteKanoniczna({
  id: 'tensions',
  label: { en: 'Tensions', pl: 'Napięcia' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'GitCompare',
  rolaAI: 'pisze',
  aiPrompt: { szablon: 'Napięcia (Phase-D).', kluczPromptu: 'insight.tensions' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 23 },
  ],
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: 'dubluje consensus-divergence (InsightViewer.tsx:791 vs :713)',
  },
});

const PATTERNS = definiujKarteKanoniczna({
  id: 'patterns',
  label: { en: 'Patterns', pl: 'Wzorce' },
  grupa: 'INSIGHT',
  ikona: 'Layers',
  rolaAI: 'pisze',
  aiPrompt: { szablon: 'Wzorce (Phase-D).', kluczPromptu: 'insight.patterns' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 24 },
  ],
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: 'dubluje themes (InsightViewer.tsx:792 vs :690)',
  },
});

const MENTAL_MODELS = definiujKarteKanoniczna({
  id: 'mental-models',
  label: { en: 'Mental Models', pl: 'Modele myślowe' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'Brain',
  rolaAI: 'pisze',
  aiPrompt: { szablon: 'Modele myślowe (Phase-D).', kluczPromptu: 'insight.mental-models' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 25 },
  ],
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: 'częściowo dubluje implicit-assumptions (InsightViewer.tsx:793)',
  },
});

const MOMENTS = definiujKarteKanoniczna({
  id: 'moments',
  label: { en: 'Moments', pl: 'Momenty' },
  grupa: 'EVIDENCE',
  ikona: 'MessageSquare',
  rolaAI: 'pisze',
  aiPrompt: { szablon: 'Momenty (Phase-D).', kluczPromptu: 'insight.moments' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 26 },
  ],
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: 'dubluje evidence/quotes (InsightViewer.tsx:794)',
  },
});

const QUOTE_BANK = definiujKarteKanoniczna({
  id: 'quote-bank',
  label: { en: 'Quote Bank', pl: 'Bank cytatów' },
  grupa: 'EVIDENCE',
  ikona: 'MessageSquare',
  rolaAI: 'pisze',
  aiPrompt: { szablon: 'Bank cytatów (Phase-D).', kluczPromptu: 'insight.quote-bank' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 27 },
  ],
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: 'dubluje evidence-map/quotes (InsightViewer.tsx:796 vs :743)',
  },
});

const STAKEHOLDER_MAP = definiujKarteKanoniczna({
  id: 'stakeholder-map',
  label: { en: 'Stakeholder Map', pl: 'Mapa interesariuszy' },
  grupa: 'BETWEEN THE LINES',
  ikona: 'Users',
  rolaAI: 'pisze',
  aiPrompt: { szablon: 'Mapa interesariuszy (Phase-D).', kluczPromptu: 'insight.stakeholder-map' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 28 },
  ],
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: 'dubluje people (InsightViewer.tsx:803 vs :704)',
  },
});

const SOURCE_CREDIBILITY = definiujKarteKanoniczna({
  id: 'source-credibility',
  label: { en: 'Source Credibility', pl: 'Wiarygodność źródeł' },
  grupa: 'EVIDENCE',
  ikona: 'Eye',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Wiarygodność źródeł (Phase-D).',
    kluczPromptu: 'insight.source-credibility',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 29 },
  ],
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: 'dubluje source-pack (InsightViewer.tsx:809 vs :756)',
  },
});

const CONSULTING_NARRATIVE = definiujKarteKanoniczna({
  id: 'consulting-narrative',
  label: { en: 'Consulting Narrative', pl: 'Narracja konsultingowa' },
  grupa: 'DELIVERABLES',
  ikona: 'FileText',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Narracja konsultingowa (Phase-D).',
    kluczPromptu: 'insight.consulting-narrative',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'insight', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 30 },
  ],
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: 'dubluje consulting-readout (InsightViewer.tsx:814 vs :685)',
  },
});

// USUNIĘTE (Faza 0, DEDUP): `executive-memo` dublowało EXECUTIVE_SUMMARY (rdzeń!)
// wprost. Scalone z rdzeniem — brak unikalnej treści do przeniesienia (miało
// wyłącznie zaślepkę „Memo zarządcze (Phase-D)."). Nadal renderowane przez
// INSIGHT_SECTIONS (nietknięte) jako „extra" doklejane na końcu listy —
// zero utraty treści, zero regresji (jak przed „domknięciem zwężenia").

/**
 * Deskryptor kanoniczny Insight — 30 kart (INSIGHT_SECTIONS nadal renderuje 32;
 * `executive-memo` i `recommendations` USUNIĘTE stąd Faza 0 DEDUP — dublowały
 * RDZEŃ wprost, patrz komentarz nagłówkowy pliku i miejsce usunięcia w Grupie 3.
 * Nadal renderowane przez InsightViewer jako „extras" nieznane katalogowi —
 * zero utraty treści). Typ elementu to `KanonicznaKarta`, więc tablica jest
 * wiążąca: dopisanie karty bez kompletu pól nie skompiluje się. Kolejność =
 * kolejność renderu (z lukami po usuniętych 22/31 — pole `kolejnosc` jest
 * czysto dokumentacyjne, nieużywane poza tym plikiem).
 */
export const INSIGHT_CARDS: readonly KanonicznaKarta[] = [
  // 1A rdzeń
  ARTIFACT_ACTIONS,
  EXECUTIVE_SUMMARY,
  // 1B domyślne (spine analityczny — część INSIGHT)
  CONSULTING_READOUT,
  THEMES,
  ISSUES_RISKS,
  OPPORTUNITIES,
  // 1B full (między wierszami)
  PEOPLE,
  SIGNALS,
  ANALYSIS_MATRIX,
  CONSENSUS_DIVERGENCE,
  IMPLICIT_ASSUMPTIONS,
  SILENCES,
  // 1D grupa 1 (extras admit)
  QUOTE_COMPARISON,
  SENTIMENT_TONE,
  POWER_DYNAMICS,
  HYPOTHESIS_BOARD,
  // 1B domyślne (dowody + dostarczane)
  EVIDENCE_MAP,
  CANDIDATE_TRIAGE,
  SOURCE_PACK,
  REPORT_PACK,
  // 1D grupa 2 (AUDIT admit)
  MATERIAL_QUALITY,
  // 1D grupa 3 (Phase-D → do-decyzji, wykluczone ze spec)
  // (executive-memo, recommendations USUNIĘTE Faza 0 DEDUP — scalone z rdzeniem)
  KEY_FINDINGS,
  TENSIONS,
  PATTERNS,
  MENTAL_MODELS,
  MOMENTS,
  QUOTE_BANK,
  STAKEHOLDER_MAP,
  SOURCE_CREDIBILITY,
  CONSULTING_NARRATIVE,
];

// ─────────────────────────────────────────────────────────────────────────────
// (2) ADAPTER kanon → ArtifactCardSpec (zwężenie do modelu `useCardLayout`).
//     `core` z `rola==='rdzen'`; węższy default = rdzeń+domyślna (10); „full" =
//     WSZYSTKIE 30 kart deskryptora (łącznie z 9 Phase-D). Phase-D wchodzą do
//     katalogu jako `dodawalna` (rola w kompozycji), więc: ukryte w default (nie
//     w secie), WŁĄCZALNE z pickera „≡ Sekcje ▾". To DOMKNIĘCIE ZWĘŻENIA (D-5):
//     applyToSections przestaje traktować je jako „extras" doklejane zawsze-widoczne
//     na koniec (useCardLayout.ts:306-308) — bo są już ZNANE katalogowi. `statusKanonu`
//     `do-decyzji-piotra` ZOSTAJE (semantyczny marker oczekującego dedupu treści —
//     osobna decyzja Piotra), ale NIE wyklucza już karty ze spec.
//     ★ WYJĄTEK (Faza 0 DEDUP): `executive-memo` i `recommendations` dublowały
//     RDZEŃ wprost — SCALONE z rdzeniem i usunięte z `INSIGHT_CARDS` (nie tylko
//     ukryte rolą). Dla nich domknięcie zwężenia się COFA: nie są już „znane
//     katalogowi", więc InsightViewer nadal je renderuje (INSIGHT_SECTIONS
//     nietknięty), ale jako „extras" doklejane na końcu — tak jak WSZYSTKIE
//     Phase-D działały przed domknięciem zwężenia. Zero utraty treści.
// ─────────────────────────────────────────────────────────────────────────────

/** Członkostwo karty w Insight (dokładnie jedno na kartę tego deskryptora). */
function insightMembership(karta: KanonicznaKarta) {
  const m = karta.kompozycja.find((p) => p.artefakt === 'insight');
  if (!m) {
    throw new Error(`insightCardContract: karta ${karta.id} bez przynależności 'insight'`);
  }
  return m;
}

/** Id, pod którym Insight RENDERUJE kartę (dla Insight == id kanoniczny; brak aliasów). */
function renderId(karta: KanonicznaKarta): string {
  return insightMembership(karta).idWArtefakcie ?? karta.id;
}

function toCatalogEntry(karta: KanonicznaKarta): CardCatalogEntry {
  const m = insightMembership(karta);
  const entry: CardCatalogEntry = {
    id: renderId(karta),
    label: karta.label,
    icon: karta.ikona,
    group: karta.grupa,
  };
  return m.rola === 'rdzen' ? { ...entry, core: true } : entry;
}

/**
 * Buduje `ArtifactCardSpec` Insight z deskryptora kanonicznego.
 *   · catalog  = wszystkie 30 kart (id=render-id, core z rdzenia); Phase-D w środku,
 *   · default  = RDZEŃ + domyślne (10 kart — węższy zestaw D-5; Phase-D poza, bo `dodawalna`),
 *   · full     = wszystkie 30 kart („Pełny").
 * Phase-D (`do-decyzji-piotra`) są teraz w katalogu → ukryte w default, włączalne z
 * pickera; applyToSections nie dokleja ich już jako „extras" (domknięcie zwężenia).
 * Wyjątek: `executive-memo`/`recommendations` (Faza 0 DEDUP) NIE są już w katalogu —
 * scalone z rdzeniem, patrz (2) wyżej.
 */
export function buildInsightCardSpec(): ArtifactCardSpec {
  const admitted = INSIGHT_CARDS;

  const catalog = admitted.map(toCatalogEntry);

  const defaultCards = admitted
    .filter((k) => {
      const rola = insightMembership(k).rola;
      return rola === 'rdzen' || rola === 'domyslna';
    })
    .map(renderId);

  const allCards = admitted.map(renderId);

  const sets: CardSet[] = [
    { id: 'default', label: { en: 'Core insight', pl: 'Rdzeń wniosku' }, cards: defaultCards },
    { id: 'full', label: { en: 'Full', pl: 'Pełny' }, cards: allCards },
  ];

  return { catalog, sets };
}

/**
 * Stała referencja spec (moduł-const) — wymóg `useCardLayout` (spec musi być
 * stabilny, bo zasila memo warstwy). Wyprowadzona RAZ z deskryptora kanonicznego.
 */
export const INSIGHT_CARD_SPEC: ArtifactCardSpec = buildInsightCardSpec();

/**
 * Render-idy WSZYSTKICH 30 zadeklarowanych kart (admit + Phase-D) — do dev-only
 * asercji „każda renderowana sekcja jest ZNANA kontraktowi" (sekcja bez wpisu =
 * prawdziwa sierota). Pozostałe 9 Phase-D są znane (do-decyzji), więc nie wywołają
 * ostrzeżenia. `executive-memo`/`recommendations` (Faza 0 DEDUP, scalone z rdzeniem)
 * ŚWIADOMIE nie są tu — InsightViewer nadal je renderuje (nietknięty), więc dev-log
 * je zgłosi jako 2 „orphans"/„extras" — OCZEKIWANE, dev-only, zero wpływu na produkt.
 */
export const INSIGHT_CARD_RENDER_IDS: readonly string[] = INSIGHT_CARDS.map(renderId);

/**
 * Render-idy 9 sekcji Phase-D (`do-decyzji-piotra`, po Faza 0 DEDUP — było 11) —
 * w katalogu jako `dodawalna` (ukryte w default, włączalne z pickera). `statusKanonu`
 * pozostaje markerem oczekującego dedupu treści z Piotrem (osobna decyzja), NIE
 * wyklucza już ze spec. Lista używana przez dev-log InsightViewer do policzenia
 * extras (ma być 2, nie 0 — `executive-memo`/`recommendations`, scalone z rdzeniem
 * i celowo poza katalogiem; pozostałe 9 nadal w katalogu = 0 dodatkowych extras z ich strony).
 */
export const INSIGHT_PHASE_D_RENDER_IDS: readonly string[] = INSIGHT_CARDS.filter(
  (k) => k.statusKanonu.stan === 'do-decyzji-piotra'
).map(renderId);
