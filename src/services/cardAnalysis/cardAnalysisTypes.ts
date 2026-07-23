/**
 * cardAnalysisTypes — kształt danych funkcji „Analizuj z AI" (ETAP 3 standardu n-Type).
 *
 * KONTRAKT WŁAŚCICIELA (2026-07-23, dosłownie):
 *   „Przycisk odnosi się do AKTYWNEJ KARTY. AI dostaje: opis celu karty, standard
 *    informacji które karta powinna zawierać, aktualną zawartość, kontekst całego
 *    artefaktu. Funkcja ma: ocenić kompletność karty, wskazać braki, wykryć
 *    niespójności, zaproponować poprawki, pokazać rekomendowane rozwinięcia,
 *    umożliwić zastosowanie zmian POJEDYNCZO.
 *    Przepływ: kliknięcie otwiera panel wyników → wynik podzielony na
 *    Braki · Ryzyka · Sugestie · Proponowane zmiany → każda zmiana ma akcje
 *    Zastosuj · Pokaż różnicę · Odrzuć → AI NIE nadpisuje treści bez potwierdzenia."
 *
 * ── DLACZEGO OSOBNY MODUŁ, A NIE KOD W KARCIE ────────────────────────────────
 * Sześć kart N (Decision · Task · Notification · Insight · Tool · Initiative) ma
 * dziś sześć różnych, niezależnych ścieżek AI (`handleOpenChat`, `aiPanelOpen`,
 * `openInsightConsultant`, `handleAnalyzeWithAI`). Każda robi coś innego, a jedna
 * z nich (Notification) NADPISUJE pola bez pytania — dokładnie to, czego kontrakt
 * zabrania. Standard jest KODEM: karta DEKLARUJE co ma być analizowane i gdzie
 * wolno zapisać, silnik NARZUCA rubrykę, format wyniku i zakaz nadpisania.
 *
 * ── ZAKAZ NADPISANIA (twardy, na poziomie typu) ──────────────────────────────
 * Silnik NIE dostaje setterów. Zwraca `CardAnalysisChange[]` — propozycje. Zapis
 * dzieje się WYŁĄCZNIE przez `onApplyChange` dostarczone przez kartę i WYŁĄCZNIE
 * po kliknięciu „Zastosuj". Nie ma ścieżki, w której wynik analizy trafia do pola
 * bez akcji człowieka.
 *
 * @see src/services/cardAnalysis/cardAnalysisRubric.ts   — rubryka per typ artefaktu
 * @see src/services/cardAnalysis/cardAnalysisService.ts  — wywołanie LLM + parsowanie
 * @see src/components/shared/NModeLayout/NCardAIAnalysisPanel.tsx — panel wyników
 */

import type { KartaNKey } from '@/components/standard/registry';

/** Typ artefaktu = klucz rejestru kart N (SSOT: `src/components/standard/registry.ts`). */
export type CardAnalysisArtifactType = KartaNKey;

/** Waga znaleziska. Steruje kolejnością i kropką koloru — nigdy nie blokuje. */
export type CardAnalysisSeverity = 'high' | 'medium' | 'low';

/**
 * Jedna z czterech szuflad wyniku (kontrakt właściciela — kolejność wiążąca).
 *   gap        — „Braki": czego karta NIE ma, a standard tego wymaga.
 *   risk       — „Ryzyka": niespójności, sprzeczności, zagrożenia jakości/gotowości.
 *   suggestion — „Sugestie": rekomendowane rozwinięcia (nie brak, tylko wzmocnienie).
 *   change     — „Proponowane zmiany": KONKRETNA treść do wstawienia (osobny typ).
 */
export type CardAnalysisBucket = 'gap' | 'risk' | 'suggestion';

/** Znalezisko bez gotowej treści — Braki / Ryzyka / Sugestie. */
export interface CardAnalysisFinding {
  /** Stabilny id w obrębie jednego przebiegu (do klucza Reacta i odrzucania). */
  id: string;
  /** Nagłówek jednym zdaniem. */
  title: string;
  /** Rozwinięcie — dlaczego to brak/ryzyko, co konkretnie jest nie tak. */
  detail: string;
  /**
   * Kryterium rubryki, z którego wynika znalezisko (np. `acceptance-criteria`).
   * Pozwala pokazać użytkownikowi, WOBEC CZEGO AI oceniło kartę — bez tego
   * ocena jest opinią, a nie pomiarem wobec standardu.
   */
  criterionId?: string;
  severity: CardAnalysisSeverity;
}

/** Sposób zastosowania zmiany do pola karty. */
export type CardAnalysisChangeMode =
  /** Podmień całą zawartość pola na `proposedValue`. */
  | 'replace'
  /** Dopisz `proposedValue` na końcu istniejącej treści (nowa linia/pozycja). */
  | 'append';

/**
 * Propozycja KONKRETNEJ zmiany treści. Jedyny obiekt, który może trafić do karty —
 * i tylko przez „Zastosuj".
 */
export interface CardAnalysisChange {
  id: string;
  /**
   * Id pola docelowego — MUSI pochodzić z `CardAnalysisField.id` zadeklarowanych
   * przez kartę. Zmiana z nieznanym `fieldId` jest renderowana jako
   * „propozycja bez celu" (Zastosuj wyłączone + uczciwy powód), nigdy zapisywana
   * na ślepo w losowe pole.
   */
  fieldId: string;
  /** Etykieta pola dla nagłówka pozycji (rozwiązana z deklaracji karty). */
  fieldLabel: string;
  /** Dlaczego ta zmiana — jedno zdanie uzasadnienia. */
  rationale: string;
  /** Zawartość pola w chwili analizy (do „Pokaż różnicę"). */
  currentValue: string;
  /** Treść proponowana przez AI. */
  proposedValue: string;
  mode: CardAnalysisChangeMode;
  severity: CardAnalysisSeverity;
  criterionId?: string;
}

/** Stan pozycji „Proponowana zmiana" w panelu (lokalny, nie wraca do AI). */
export type CardAnalysisChangeState = 'pending' | 'applied' | 'rejected' | 'failed';

/** Pełny wynik jednego przebiegu analizy aktywnej karty. */
export interface CardAnalysisResult {
  artifactType: CardAnalysisArtifactType;
  /** Render-id analizowanej karty (== id sekcji lewej nawigacji). */
  cardId: string;
  /** Nazwa karty pokazana w nagłówku panelu (język UI). */
  cardLabel: string;
  /**
   * Ocena kompletności 0-100. To LICZBA OD AI, nie próg systemowy — kontrakt
   * karty (`ProgKompletnosci`) ma dziś `do-decyzji-piotra` dla wszystkich kart
   * (cardContract.types.ts §4), więc panel pokazuje ocenę, ale NICZEGO nie blokuje.
   */
  completeness: number;
  /** Werdykt jednym zdaniem (np. „Karta gotowa do zatwierdzenia po uzupełnieniu ryzyk"). */
  verdict: string;
  gaps: CardAnalysisFinding[];
  risks: CardAnalysisFinding[];
  suggestions: CardAnalysisFinding[];
  changes: CardAnalysisChange[];
  /** ISO — kiedy powstał ten wynik (panel pokazuje „sprzed X min"). */
  generatedAt: string;
}

// ── Wejście: co karta DEKLARUJE ─────────────────────────────────────────────

/** Rodzaj pola — steruje wyłącznie sposobem serializacji do promptu i scalania. */
export type CardAnalysisFieldKind =
  /** Zwykły tekst / akapit. */
  | 'text'
  /** Lista pozycji (checklist, kryteria, ryzyka) — wartość jako linie. */
  | 'list';

/**
 * Pole karty widziane przez analizę. Karta deklaruje TYLKO to, co realnie potrafi
 * odczytać i (opcjonalnie) zapisać. Pole bez `writable` jest widziane przez AI jako
 * kontekst, ale „Zastosuj" dla niego nie powstanie.
 */
export interface CardAnalysisField {
  id: string;
  label: string;
  value: string;
  kind?: CardAnalysisFieldKind;
  /**
   * Czy `onApplyChange` potrafi zapisać do tego pola. `false`/pominięte ⇒
   * propozycje do tego pola są pokazane, ale „Zastosuj" jest wyłączone
   * z uczciwym powodem (zamiast udawać, że zapis zadziała).
   */
  writable?: boolean;
  /** Krótkie wyjaśnienie DLA AI, co w tym polu ma być. Opcjonalne. */
  hint?: string;
}

/**
 * Kompletne wejście analizy — to, co karta podaje silnikowi.
 * Cztery pozycje wprost z kontraktu właściciela: cel karty + standard treści
 * (obie z kanonu kart), aktualna zawartość (`fields`) i kontekst artefaktu.
 */
export interface CardAnalysisInput {
  artifactType: CardAnalysisArtifactType;
  /** Render-id AKTYWNEJ karty. */
  cardId: string;
  /** Nazwa artefaktu (tytuł Decyzji/Zadania/…) — nagłówek kontekstu. */
  artifactTitle: string;
  /**
   * Kontekst CAŁEGO artefaktu: pozostałe karty, właściwości, powiązania.
   * Karta buduje go sama (wie, co ma) — silnik tylko przycina do limitu promptu.
   */
  artifactContext: string;
  /** Zawartość aktywnej karty, pole po polu. */
  fields: CardAnalysisField[];
  /** Język wyniku. */
  isPolish: boolean;
}

/**
 * Sygnatura zapisu. Zwraca `true` gdy zapis się udał. Karta MUSI zwrócić `false`
 * (a nie rzucić), gdy pola nie da się zapisać — panel oznaczy pozycję jako
 * `failed` i zostawi ją do ponowienia zamiast udawać sukces.
 */
export type CardAnalysisApply = (change: CardAnalysisChange) => boolean | Promise<boolean>;
