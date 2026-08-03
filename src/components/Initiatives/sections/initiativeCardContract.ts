/**
 * initiativeCardContract.ts — MIGRACJA: Initiative adoptuje WIĄŻĄCY kontrakt karty (D-8).
 *
 * SSOT modelu:  Harvard/wdrozenie-100/_KANON_KARTY_MODEL_2026-07-22.md (§2.2, §3)
 * Przepis:      Harvard/wdrozenie-100/_PRZEPIS_MIGRACJI_INITIATIVE_2026-07-22.md (§1 deskryptor, §2 kroki)
 * Typ wiążący:  src/components/standard/cardContract.types.ts (definiujKarteKanoniczna)
 * Wzorzec POC:  src/components/MyWork/decisionCardContract.ts (commit 738447b039)
 *
 * ── CO TEN PLIK ROBI ─────────────────────────────────────────────────────────
 * Deklaruje 29 kluczy silnika Initiative (`sections/registry.ts:50-83`) jako kanoniczne
 * karty przez fabrykę `definiujKarteKanoniczna`, więc stany niedozwolone są MARTWE TYPEM:
 *   · brak id/label/roli/kompozycji            → błąd kompilacji,
 *   · rola 'pisze'/'asystuje' bez `aiPrompt`    → błąd kompilacji,
 *   · rola 'dane'/'systemowa'/'transakcyjna'    → MUSI jawnie nazwać brak promptu.
 *
 * 29 kluczy → 27 kart kanonicznych (26 żywych #17-37/#47-51 + `watchers` placeholder) +
 * 2 martwe zwinięte przez alias (`initiativeTeam`→`team`, `linkedItems`→`attachments`).
 * Aliasy dedup (KANON §2.2): `history`→`activity-log`, `raciEscalation`→`governance`
 * (DB `key='raci'`, R2). `idWArtefakcie` niesie id, pod którym silnik RENDERUJE kartę.
 *
 * ── RDZEŃ + WĘŻSZY DOMYŚLNY (D-4/D-5, przepis §1.3) ──────────────────────────
 * RDZEŃ nieusuwalny (rola `rdzen`): `overview` + `control`.
 * Zestaw domyślny „minimal"-7 = RDZEŃ + `problemDefinition, targetState, scope, tasks, kpis`
 * (rola `domyslna`). Reszta = `dodawalna` (katalog, poza domyślnym) — zejście z dzisiejszego
 * „pokaż wszystko" 24/29 (`registry.ts:138-170`). `pilot`, `watchers`, `governance`(raci) =
 * `ukryta-domyslna` (DEFAULT_VISIBLE=false dziś).
 *
 * ── GRANICA MIGRACJI (uczciwość > kompletność, przepis „Initiative = OSTATNI/NAJTRUDNIEJSZY") ─
 * To jest MIGRACJA FRONTEND: typowany deskryptor kompozycji + adapter DB→kanon + flaga.
 * ŚWIADOMIE ODŁOŻONE do serializacji (wymaga DB/silnika/decyzji Piotra — NIE połowicznie):
 *   · REKONCYLIACJA DUAL-PATH (R1): silnik ma katalog z DB (`initiative_section_types`) LUB
 *     fallback registry (29); adapter czyta jedno źródło — wybór = DO POTWIERDZENIA PIOTRA.
 *   · WIDZIALNE ZWĘŻENIE EKRANU: domyślny widok to N-mode C-board (`InitiativeDocumentView.tsx:5190`
 *     `initiativeNSections`) o WŁASNEJ, kuratorowanej przestrzeni id (`initiative-definition`,
 *     `target-state-scope`, `risk-raid`, `kpi`, `raci`…), NIE registry-key. `DEFAULT_VISIBLE_SECTIONS`
 *     służy tam tylko jako LOOKUP istnienia (`:7222 leftSections.find(s=>s.key==='tasks')`), nie jako
 *     lista renderowana. Zwężenie boardu = ziarno `hiddenSectionIds` (`:8837`) po id boardu — most
 *     registry↔board to istniejący `nModeMap` (`:1640`). Wpięcie = osobny krok (poniżej eksporty
 *     `INITIATIVE_MINIMAL_BOARD_VISIBLE_IDS`), DO POTWIERDZENIA PIOTRA (który board = rdzeń).
 *   · UŚMIERCENIE martwych kluczy w `registry.ts` (`initiativeTeam`/`linkedItems`) zmienia
 *     fallback-path → razem z rekoncyliacją DB, nie tu.
 *   · SEED brakujących wierszy DB (`competencyRequirements`/`skillsGap` — brak w `529`) + `financialAnalysis`
 *     „enum dead per F0" → statusKanonu `rozjazd` niżej; naprawa = DB.
 *   · CRIMSON w centrum (13, gł. `InitiativeGatesWorkflowTable.tsx`) — INNA fala (decyzja 07-08),
 *     baseline NIE ruszany.
 */

import type { KanonicznaKarta } from '../../standard/cardContract.types';
import { definiujKarteKanoniczna } from '../../standard/cardContract.types';
import type { SectionTypeInfo } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// (1) KATALOG KANONICZNY INITIATIVE — 27 kart (26 żywych + `watchers` placeholder).
//     Kolejność deklaracji = kolejność w registry (lewa kolumna, potem prawa).
//     `kolumna`/`kolejnosc` = nadzbiór B (`column_position`/`default_order`, 529_...sql).
//     `idWArtefakcie` obecne TYLKO przy aliasie dedup (id renderu ≠ id kanoniczny).
// ─────────────────────────────────────────────────────────────────────────────

// ── LEWA KOLUMNA — content (16 kluczy registry) ────────────────────────────────

/** RDZEŃ — nieusuwalny (rola `rdzen`). registry.ts:52; DB 529:107. */
const OVERVIEW = definiujKarteKanoniczna({
  id: 'overview',
  label: { en: 'Overview', pl: 'Przegląd' },
  opis: { en: 'Initiative summary and context.', pl: 'Streszczenie i kontekst inicjatywy.' },
  grupa: 'CONTENT',
  ikona: 'FileText',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Opisz przegląd inicjatywy: cel, kontekst, jednozdaniowe streszczenie wartości.',
    kluczPromptu: 'initiative.overview',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'rdzen', klasa: 'L', kolumna: 'left', kolejnosc: 0 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const PROBLEM_DEFINITION = definiujKarteKanoniczna({
  id: 'problemDefinition',
  label: { en: 'Problem Definition', pl: 'Definicja problemu' },
  opis: {
    en: 'Symptom, root cause, cost of inaction.',
    pl: 'Symptom, przyczyna źródłowa, koszt zaniechania.',
  },
  grupa: 'CONTENT',
  ikona: 'AlertCircle',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zdefiniuj problem: symptom, przyczyna źródłowa, koszt zaniechania (cost of inaction).',
    kluczPromptu: 'initiative.problemDefinition',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 1 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const TARGET_STATE = definiujKarteKanoniczna({
  id: 'targetState',
  label: { en: 'Target State', pl: 'Stan docelowy' },
  opis: { en: 'Success criteria and deliverables.', pl: 'Kryteria sukcesu i produkty.' },
  grupa: 'CONTENT',
  ikona: 'Target',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Opisz stan docelowy: kryteria sukcesu (mierzalne), produkty (deliverables).',
    kluczPromptu: 'initiative.targetState',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 2 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const SCOPE = definiujKarteKanoniczna({
  id: 'scope',
  label: { en: 'Scope', pl: 'Zakres' },
  opis: {
    en: 'In-scope / out-of-scope, kill criteria.',
    pl: 'W zakresie / poza zakresem, kryteria zatrzymania.',
  },
  grupa: 'CONTENT',
  ikona: 'ListChecks',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Wyznacz zakres: co w zakresie, co poza, kryteria zatrzymania (kill criteria).',
    kluczPromptu: 'initiative.scope',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 3 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const TASKS = definiujKarteKanoniczna({
  id: 'tasks',
  label: { en: 'Tasks & Milestones', pl: 'Zadania i kamienie milowe' },
  grupa: 'EXECUTION',
  ikona: 'CheckSquare',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zaproponuj zadania i kamienie milowe realizujące stan docelowy, z sekwencją i właścicielami.',
    kluczPromptu: 'initiative.tasks',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 4 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const DECISIONS = definiujKarteKanoniczna({
  id: 'decisions',
  label: { en: 'Decisions', pl: 'Decyzje' },
  grupa: 'EXECUTION',
  ikona: 'GitBranch',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Wypunktuj decyzje do podjęcia/podjęte w inicjatywie, z ich zakresem i konsekwencją.',
    kluczPromptu: 'initiative.decisions',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 5 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const RAID = definiujKarteKanoniczna({
  id: 'raid',
  label: { en: 'RAID', pl: 'RAID' },
  opis: {
    en: 'Risks, assumptions, issues, dependencies.',
    pl: 'Ryzyka, założenia, problemy, zależności.',
  },
  grupa: 'EXECUTION',
  ikona: 'ShieldAlert',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zbuduj rejestr RAID: ryzyka/założenia/problemy/zależności z oceną i planem mitygacji.',
    kluczPromptu: 'initiative.raid',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  // Silnik renderuje `raid` na boardzie jako `risk-raid` (nModeMap, InitiativeDocumentView.tsx:1645).
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 6 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const GATES = definiujKarteKanoniczna({
  id: 'gates',
  label: { en: 'Gates', pl: 'Bramy' },
  grupa: 'EXECUTION',
  ikona: 'Flag',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Opisz gotowość bramek fazowych (G0-G5): kryteria wejścia/wyjścia i status listy kontrolnej.',
    kluczPromptu: 'initiative.gates',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  // ★ Centrum karty `gates` niesie 13 crimson (InitiativeGatesWorkflowTable.tsx) — INNA fala,
  //   baseline nietknięty (przepis §4, decyzja 07-08). To nie rozjazd kontraktu → statusKanonu czysta.
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 7 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const FINANCIAL_ANALYSIS = definiujKarteKanoniczna({
  id: 'financialAnalysis',
  label: { en: 'Financial Analysis', pl: 'Analiza finansowa' },
  grupa: 'FINANCE',
  ikona: 'Calculator',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Przeprowadź analizę finansową: nakłady, oszczędności, NPV/ROI, okres zwrotu.',
    kluczPromptu: 'initiative.financialAnalysis',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 8 },
  ],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'DB aktywna, ale komentarz kodu „enum is dead per F0" — do rozstrzygnięcia żywy/martwy (DO POTWIERDZENIA PIOTRA).',
    dowod: 'registry.ts:60; 529_...sql:131; KANON §2.3',
  },
});

const FINANCIAL_IMPACT = definiujKarteKanoniczna({
  id: 'financialImpact',
  label: { en: 'Financial Impact', pl: 'Wpływ finansowy' },
  grupa: 'FINANCE',
  ikona: 'TrendingUp',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Oszacuj wpływ finansowy: marża, przychód, koszt uniknięty — w horyzoncie inicjatywy.',
    kluczPromptu: 'initiative.financialImpact',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 9 },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** W zestawie domyślnym „minimal"-7 (rola `domyslna`). registry.ts:62; board id `kpi`. */
const KPIS = definiujKarteKanoniczna({
  id: 'kpis',
  label: { en: 'KPIs & Benefits', pl: 'KPI i korzyści' },
  grupa: 'RESULTS',
  ikona: 'Gauge',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon:
      'Zdefiniuj KPI i korzyści: wartość bazowa, cel, częstotliwość pomiaru, kierunek alertu.',
    kluczPromptu: 'initiative.kpis',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 10 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const COMPETENCY_REQUIREMENTS = definiujKarteKanoniczna({
  id: 'competencyRequirements',
  label: { en: 'Competency Requirements', pl: 'Wymagane kompetencje' },
  grupa: 'COMPETENCY',
  ikona: 'GraduationCap',
  // Karta ASYSTUJE (AI podpowiada kompetencje, człowiek prowadzi). Kontrakt wymaga promptu dla
  // 'asystuje' — `(brak promptu)` z przepisu odnosi się do BRAKU wiersza DB (529 kończy `watchers`),
  // nie do braku roli AI. Szablon = intencja; kluczPromptu pominięty (brak wpisu w DB).
  rolaAI: 'asystuje',
  aiPrompt: {
    szablon: 'Podpowiedz wymagane kompetencje do realizacji; człowiek zatwierdza listę i poziomy.',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 11 },
  ],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'Klucz w registry, ale BRAK wiersza w seedzie DB (529). Zaseedować czy fallback-only — DO POTWIERDZENIA PIOTRA.',
    dowod: 'registry.ts:63; brak w 529_...sql (seed kończy watchers :178)',
  },
});

const SKILLS_GAP = definiujKarteKanoniczna({
  id: 'skillsGap',
  label: { en: 'Skills Gap', pl: 'Luka kompetencyjna' },
  grupa: 'COMPETENCY',
  ikona: 'UserMinus',
  rolaAI: 'asystuje',
  aiPrompt: {
    szablon:
      'Wskaż lukę kompetencyjną (posiadane vs wymagane) i propozycje jej domknięcia; człowiek decyduje.',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 12 },
  ],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'Klucz w registry, brak wiersza w seedzie DB (529); istnieje tabela skills_gap — spójność DO POTWIERDZENIA PIOTRA.',
    dowod: 'registry.ts:64; brak w 529_...sql',
  },
});

/** Ukryta-domyślna (DEFAULT_VISIBLE.pilot=false, registry.ts:165). */
const PILOT = definiujKarteKanoniczna({
  id: 'pilot',
  label: { en: 'Pilot', pl: 'Pilotaż' },
  grupa: 'EXECUTION',
  ikona: 'FlaskConical',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Opisz pilotaż: zakres próbny, hipoteza, próg decyzji o rozszerzeniu.',
    kluczPromptu: 'initiative.pilot',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'ukryta-domyslna', klasa: 'L', kolumna: 'left', kolejnosc: 13 },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `comments` (#47) — strumień transakcyjny; żyje też w prawym panelu (ArtifactRightPanel). */
const COMMENTS = definiujKarteKanoniczna({
  id: 'comments',
  label: { en: 'Comments', pl: 'Komentarze' },
  grupa: 'AUDIT',
  ikona: 'MessageSquare',
  rolaAI: 'transakcyjna',
  aiPrompt: { none: true, reason: 'strumień komentarzy użytkowników — nie generacja treści' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'left', kolejnosc: 14 },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `activity-log` (#48) — registry key `history` → kanon `activity-log` (alias). */
const ACTIVITY_LOG = definiujKarteKanoniczna({
  id: 'activity-log',
  label: { en: 'Activity Log', pl: 'Historia aktywności' },
  grupa: 'AUDIT',
  ikona: 'History',
  rolaAI: 'systemowa',
  aiPrompt: {
    none: true,
    reason: 'log zdarzeń jest zapisem faktów — generowana treść byłaby fałszem',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  // Silnik renderuje pod `history` (registry key) / board `activity-log` (nModeMap:1651).
  kompozycja: [
    {
      artefakt: 'initiative',
      rola: 'dodawalna',
      klasa: 'L',
      kolumna: 'left',
      kolejnosc: 15,
      idWArtefakcie: 'history',
    },
  ],
  statusKanonu: { stan: 'czysta' },
});

// ── PRAWA KOLUMNA — control / meta (13 kluczy registry) ────────────────────────

/** RDZEŃ — nieusuwalny (rola `rdzen`). registry.ts:70; DB 529:151. */
const CONTROL = definiujKarteKanoniczna({
  id: 'control',
  label: { en: 'Control', pl: 'Sterowanie' },
  opis: {
    en: 'Status, priority, owner, dates, gate readiness.',
    pl: 'Status, priorytet, właściciel, daty, gotowość bramki.',
  },
  grupa: 'CONTROL',
  ikona: 'SlidersHorizontal',
  // Kontrakt: rola `pisze`/`asystuje` wymaga promptu. Przepis §1.2 dopuszcza „pisze/asystuje";
  // wybrano `asystuje` (AI podpowiada gotowość bramki/status, człowiek zatwierdza) — DO POTWIERDZENIA PIOTRA
  // (alternatywa: `dane`, gdyby control miał być czysto metadanymi bez asysty AI).
  rolaAI: 'asystuje',
  aiPrompt: {
    szablon:
      'Podpowiedz gotowość bramki i rekomendację statusu na podstawie stanu inicjatywy; człowiek decyduje.',
    kluczPromptu: 'initiative.control',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'rdzen', klasa: 'L', kolumna: 'right', kolejnosc: 0 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const TEAM = definiujKarteKanoniczna({
  id: 'team',
  label: { en: 'Team', pl: 'Zespół' },
  grupa: 'CONTROL',
  ikona: 'Users',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'obsada zespołu pochodzi z danych/przypisań — nie z generacji AI',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 1 },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `governance` (#51) — registry key `raciEscalation` (DB `key='raci'`, R2). Ukryta-domyślna. */
const GOVERNANCE = definiujKarteKanoniczna({
  id: 'governance',
  label: { en: 'RACI & Escalation', pl: 'RACI i eskalacja' },
  grupa: 'CONTROL',
  ikona: 'Users',
  rolaAI: 'asystuje',
  aiPrompt: {
    szablon: 'Zaproponuj macierz RACI i ścieżkę eskalacji; człowiek zatwierdza role i progi.',
    kluczPromptu: 'initiative.raci',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  // ROZJAZD kluczy (R2): DB `key='raci'`, ale registry/render `component_key='raciEscalation'`.
  // Kanon = `governance`; render pod `raciEscalation`. Adapter re-derywujący klucze POWTÓRZYŁBY
  // footgun migracji 542 (snake vs camel) — dlatego id renderu podane jawnie, nie liczone.
  kompozycja: [
    {
      artefakt: 'initiative',
      rola: 'ukryta-domyslna',
      klasa: 'L',
      kolumna: 'right',
      kolejnosc: 2,
      idWArtefakcie: 'raciEscalation',
    },
  ],
  statusKanonu: {
    stan: 'rozjazd',
    opis: 'DB/nawigacja `key=raci`, registry/render `component_key=raciEscalation`. Który klucz kanoniczny — DO POTWIERDZENIA PIOTRA.',
    dowod: 'registry.ts:73; 541_...sql:7 (key=raci → component=raciEscalation)',
  },
});

const TIMELINE = definiujKarteKanoniczna({
  id: 'timeline',
  label: { en: 'Timeline', pl: 'Harmonogram' },
  grupa: 'META',
  ikona: 'Calendar',
  rolaAI: 'dane',
  aiPrompt: { none: true, reason: 'harmonogram wynika z dat kamieni/zadań — dane, nie generacja' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 3 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const RESOURCES = definiujKarteKanoniczna({
  id: 'resources',
  label: { en: 'Resources', pl: 'Zasoby' },
  grupa: 'META',
  ikona: 'Boxes',
  rolaAI: 'pisze',
  aiPrompt: {
    szablon: 'Zaproponuj zasoby (ludzie, narzędzia, budżet) potrzebne do realizacji zakresu.',
    kluczPromptu: 'initiative.resources',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 4 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const STAKEHOLDERS = definiujKarteKanoniczna({
  id: 'stakeholders',
  label: { en: 'Stakeholders', pl: 'Interesariusze' },
  grupa: 'CONTROL',
  ikona: 'Contact',
  rolaAI: 'dane',
  aiPrompt: { none: true, reason: 'lista interesariuszy/RACI pochodzi z przypisań — dane' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 5 },
  ],
  // Uwaga (R7): nakłada się pojęciowo z `governance`(raci) — obie dotyczą RACI. Do przeglądu przy odbiorze.
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `dependencies` (#50). */
const DEPENDENCIES = definiujKarteKanoniczna({
  id: 'dependencies',
  label: { en: 'Dependencies', pl: 'Zależności' },
  grupa: 'META',
  ikona: 'Link',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'zależności między inicjatywami/zadaniami to relacje danych — nie generacja',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 6 },
  ],
  statusKanonu: { stan: 'czysta' },
});

/** WSPÓLNA `attachments` (#49) — silnik renderuje na boardzie jako `attachments-links` (nModeMap:1652). */
const ATTACHMENTS = definiujKarteKanoniczna({
  id: 'attachments',
  label: { en: 'Attachments & Links', pl: 'Załączniki i powiązania' },
  grupa: 'META',
  ikona: 'Paperclip',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'pliki i powiązania wskazuje użytkownik — AI nie ma czego wygenerować',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 7 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const TAGS = definiujKarteKanoniczna({
  id: 'tags',
  label: { en: 'Tags', pl: 'Etykiety' },
  grupa: 'META',
  ikona: 'Tag',
  rolaAI: 'dane',
  aiPrompt: { none: true, reason: 'etykiety nadaje użytkownik/klasyfikacja — dane' },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 8 },
  ],
  statusKanonu: { stan: 'czysta' },
});

const REMINDERS = definiujKarteKanoniczna({
  id: 'reminders',
  label: { en: 'Reminders', pl: 'Przypomnienia' },
  grupa: 'META',
  ikona: 'Bell',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'przypomnienia to reguły/terminy ustawiane przez użytkownika — nie generacja treści',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    { artefakt: 'initiative', rola: 'dodawalna', klasa: 'L', kolumna: 'right', kolejnosc: 9 },
  ],
  statusKanonu: { stan: 'czysta' },
});

/**
 * `watchers` — PLACEHOLDER (przepis §1.2 #29). Dziś registry mapuje na `OverviewSection`
 * („simpler UI — can be enhanced later", registry.ts:82). Własny UI czy skreślić — DO DECYZJI PIOTRA.
 * Ukryta-domyślna (DEFAULT_VISIBLE.watchers=false, registry.ts:166).
 */
const WATCHERS = definiujKarteKanoniczna({
  id: 'watchers',
  label: { en: 'Watchers', pl: 'Obserwujący' },
  grupa: 'META',
  ikona: 'Eye',
  rolaAI: 'dane',
  aiPrompt: {
    none: true,
    reason: 'lista obserwujących pochodzi z subskrypcji użytkowników — dane',
  },
  prog: { rodzaj: 'do-decyzji-piotra' },
  kompozycja: [
    {
      artefakt: 'initiative',
      rola: 'ukryta-domyslna',
      klasa: 'L',
      kolumna: 'right',
      kolejnosc: 10,
    },
  ],
  statusKanonu: {
    stan: 'do-decyzji-piotra',
    opis: 'Placeholder: registry mapuje `watchers` na OverviewSection (registry.ts:82). Własny UI czy skreślić?',
  },
});

/**
 * Deskryptor kanoniczny Initiative — 27 kart (26 żywych + `watchers` placeholder).
 * Typ elementu = `KanonicznaKarta`: dopisanie karty bez kompletu pól NIE skompiluje się.
 */
export const INITIATIVE_CANONICAL_CARDS: readonly KanonicznaKarta[] = [
  // Lewa kolumna (content)
  OVERVIEW,
  PROBLEM_DEFINITION,
  TARGET_STATE,
  SCOPE,
  TASKS,
  DECISIONS,
  RAID,
  GATES,
  FINANCIAL_ANALYSIS,
  FINANCIAL_IMPACT,
  KPIS,
  COMPETENCY_REQUIREMENTS,
  SKILLS_GAP,
  PILOT,
  COMMENTS,
  ACTIVITY_LOG,
  // Prawa kolumna (control/meta)
  CONTROL,
  TEAM,
  GOVERNANCE,
  TIMELINE,
  RESOURCES,
  STAKEHOLDERS,
  DEPENDENCIES,
  ATTACHMENTS,
  TAGS,
  REMINDERS,
  WATCHERS,
];

// ─────────────────────────────────────────────────────────────────────────────
// (2) MARTWE KLUCZE — zwinięte przez alias (przepis §1.2). NIE renderowane jako
//     osobne karty; registry key → kanoniczny zamiennik. Uśmiercenie w registry.ts
//     = osobny krok (zmienia fallback-path, razem z rekoncyliacją DB).
// ─────────────────────────────────────────────────────────────────────────────

export const INITIATIVE_DEAD_ALIASES: Readonly<Record<string, string>> = {
  // registry.ts:72 — dubluje `team`, brak typu DB, DEFAULT_VISIBLE=false (:167).
  initiativeTeam: 'team',
  // registry.ts:79 — dubluje `attachments`, brak typu DB, DEFAULT_VISIBLE=false (:169).
  linkedItems: 'attachments',
};

// ─────────────────────────────────────────────────────────────────────────────
// (3) POCHODNE KOMPOZYCJI — do wpięcia w silnik (rdzeń, węższy domyślny, picker).
// ─────────────────────────────────────────────────────────────────────────────

/** Id, pod którym Initiative RENDERUJE kartę (alias dedup albo id kanoniczny). */
function initiativeRenderId(karta: KanonicznaKarta): string {
  const m = karta.kompozycja.find((p) => p.artefakt === 'initiative');
  return m?.idWArtefakcie ?? karta.id;
}

/** Rola kompozycyjna karty w Initiative (dokładnie jedna na kartę tego deskryptora). */
function initiativeRola(karta: KanonicznaKarta): string {
  const m = karta.kompozycja.find((p) => p.artefakt === 'initiative');
  if (!m)
    throw new Error(`initiativeCardContract: karta ${karta.id} bez przynależności 'initiative'`);
  return m.rola;
}

/** RDZEŃ nieusuwalny — klucze kanoniczne z rolą `rdzen` (overview + control). */
export const INITIATIVE_CORE_KEYS: readonly string[] = INITIATIVE_CANONICAL_CARDS.filter(
  (k) => initiativeRola(k) === 'rdzen'
).map((k) => k.id);

/** Czy dany klucz registry/kanoniczny to RDZEŃ (nieusuwalny). */
export function isInitiativeCoreKey(key: string): boolean {
  return INITIATIVE_CORE_KEYS.includes(key);
}

/**
 * RDZEŃ w przestrzeni id N-mode C-boardu (przez istniejący `nModeMap`,
 * InitiativeDocumentView.tsx:1640). `overview` → `initiative-definition`;
 * `control` NIE ma sekcji boardu (żyje w Menu 1 / prawym panelu), więc nie ma czego
 * chronić na boardzie. To jest most, którym „RDZEŃ nieusuwalny" egzekwuje się w
 * pickerze „Sekcje" (hiddenSectionIds po id boardu).
 */
export const INITIATIVE_CORE_BOARD_IDS: ReadonlySet<string> = new Set(['initiative-definition']);

/**
 * Zestaw DOMYŚLNY „minimal"-7 wg klucza registry (drop-in dla `DEFAULT_VISIBLE_SECTIONS`).
 * = RDZEŃ (`rdzen`) + `domyslna`. Reszta 29 kluczy = false. Konsumpcja w ścieżce
 * registry (`InitiativeDocumentView.tsx:2123`) — WIDZIALNE zwężenie tej ścieżki za flagą.
 * (Domyślny widok = N-mode board; zwężenie boardu → `INITIATIVE_MINIMAL_BOARD_VISIBLE_IDS`.)
 */
export const INITIATIVE_MINIMAL_VISIBLE: Readonly<Record<string, boolean>> = (() => {
  const defaultKeys = new Set(
    INITIATIVE_CANONICAL_CARDS.filter((k) => {
      const r = initiativeRola(k);
      return r === 'rdzen' || r === 'domyslna';
    }).map((k) => initiativeRenderId(k))
  );
  // Wszystkie 29 kluczy registry → false, oprócz minimal-7 → true.
  const allRegistryKeys = [
    'overview',
    'problemDefinition',
    'targetState',
    'scope',
    'tasks',
    'decisions',
    'raid',
    'gates',
    'financialAnalysis',
    'financialImpact',
    'kpis',
    'competencyRequirements',
    'skillsGap',
    'pilot',
    'comments',
    'history',
    'control',
    'team',
    'initiativeTeam',
    'raciEscalation',
    'timeline',
    'resources',
    'stakeholders',
    'dependencies',
    'attachments',
    'linkedItems',
    'tags',
    'reminders',
    'watchers',
  ];
  const out: Record<string, boolean> = {};
  for (const k of allRegistryKeys) out[k] = defaultKeys.has(k);
  return out;
})();

/**
 * Zestaw DOMYŚLNY zmapowany na id N-mode C-boardu (przez `nModeMap`). Minimal-7 →
 * boardy: overview/problemDefinition → `initiative-definition`; targetState/scope →
 * `target-state-scope`; tasks → `tasks`; kpis → `kpi`. `control` nie ma sekcji boardu.
 * Do przyszłego ZIARNA `hiddenSectionIds` (zwężenie widocznego boardu za flagą).
 * ★ Który board = rdzeń/domyślny — DO POTWIERDZENIA PIOTRA (board to inna, kuratorowana
 *   kompozycja niż registry; mapa to nasza rozsądna propozycja, nie kanon).
 */
export const INITIATIVE_MINIMAL_BOARD_VISIBLE_IDS: readonly string[] = [
  'initiative-definition',
  'target-state-scope',
  'tasks',
  'kpi',
];

/** Render-idy w kolejności deklaracji — do lekkiej asercji zgodności (R2). */
export const INITIATIVE_CARD_RENDER_IDS: readonly string[] =
  INITIATIVE_CANONICAL_CARDS.map(initiativeRenderId);

/** Zestawy pickera „Rdzeń/Pełny" (dane; wpięcie w menu „Sekcje" = krok silnika). */
export function buildInitiativeCardSets(): {
  default: readonly string[];
  full: readonly string[];
} {
  const def = INITIATIVE_CANONICAL_CARDS.filter((k) => {
    const r = initiativeRola(k);
    return r === 'rdzen' || r === 'domyslna';
  }).map(initiativeRenderId);
  const full = INITIATIVE_CANONICAL_CARDS.filter(
    (k) => initiativeRola(k) !== 'ukryta-domyslna'
  ).map(initiativeRenderId);
  return { default: def, full };
}

// ─────────────────────────────────────────────────────────────────────────────
// (4) ADAPTER DB→KANON (przepis §2 KROK 1). Nakłada metadane z żywych wierszy
//     `initiative_section_types` na statyczny katalog kanoniczny. Klucze bez wiersza
//     DB zachowują `statusKanonu:'rozjazd'`. Wiersze org-custom (R4,
//     `organization_id != NULL`) są POZA katalogiem kanonicznym (51 id zamknięte) —
//     ich pełna obsługa = krok DB/decyzja Piotra (nie tu, uczciwość > komplet).
// ─────────────────────────────────────────────────────────────────────────────

/** Dopasuj wiersz DB do karty kanonicznej po id renderu / kluczu / component_key / martwym aliasie. */
function matchDbRow(
  karta: KanonicznaKarta,
  rows: readonly SectionTypeInfo[]
): SectionTypeInfo | undefined {
  const renderId = initiativeRenderId(karta);
  return rows.find(
    (r) =>
      r.key === renderId ||
      r.componentKey === renderId ||
      r.key === karta.id ||
      r.componentKey === karta.id ||
      INITIATIVE_DEAD_ALIASES[r.key] === karta.id ||
      INITIATIVE_DEAD_ALIASES[r.componentKey] === karta.id
  );
}

/**
 * Buduje kanoniczne karty Initiative z żywych wierszy DB, nakładając ich etykiety/opisy
 * na statyczny katalog. Zachowuje kolejność deklaracji i całą semantykę kontraktu
 * (rola AI, kompozycja, statusKanonu). Zwraca 27 kart (nie mnoży org-custom — patrz wyżej).
 */
export function buildInitiativeCanonicalCards(dbRows: SectionTypeInfo[]): KanonicznaKarta[] {
  return INITIATIVE_CANONICAL_CARDS.map((karta) => {
    const row = matchDbRow(karta, dbRows);
    if (!row) return karta;
    const label = {
      en: row.name || karta.label.en,
      pl: row.namePl || karta.label.pl,
    };
    const opis =
      row.description || row.descriptionPl
        ? {
            en: row.description || karta.opis?.en || '',
            pl: row.descriptionPl || karta.opis?.pl || '',
          }
        : karta.opis;
    // Nakładka etykiet/opisu jest addytywna; rolaAI/aiPrompt/kompozycja/statusKanonu bez zmian,
    // więc typ `KanonicznaKarta` (dyskryminowana unia rola↔prompt) pozostaje spełniony.
    return { ...karta, label, ...(opis ? { opis } : {}) } as KanonicznaKarta;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// (5) FLAGA (default OFF, jak POC / vf1InitSpecAFlag). Wygląd czeka za flagą do
//     akceptu Piotra (CLAUDE.md #7/#9). Kolejność: URL ?ff_initiativeCardContract=0|1
//     → localStorage ff.initiativeCardContract → env VITE_VF1_INITIATIVE_CARD_CONTRACT → OFF.
// ─────────────────────────────────────────────────────────────────────────────

const FLAG_QUERY = 'ff_initiativeCardContract';
// ALIAS wspólny dla wszystkich 6 artefaktów: `?cardContract=1` włącza je naraz jednym linkiem.
const FLAG_QUERY_ALIAS = 'cardContract';
const FLAG_LS = 'ff.initiativeCardContract';
const FLAG_ENV = 'VITE_VF1_INITIATIVE_CARD_CONTRACT';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const v = String(raw).trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'on') return true;
  if (v === '0' || v === 'false' || v === 'off') return false;
  return null;
}

export function isInitiativeCardContractEnabled(): boolean {
  if (typeof window !== 'undefined' && window.location) {
    try {
      const params = new URLSearchParams(window.location.search);
      // Query akceptuje ALBO własny klucz, ALBO wspólny alias `cardContract`.
      const q = parseFlag(params.get(FLAG_QUERY) ?? params.get(FLAG_QUERY_ALIAS));
      if (q !== null) {
        try {
          window.localStorage.setItem('ff.cardContract', q ? '1' : '0');
        } catch {
          /* ignore */
        }
        return q;
      }
    } catch {
      /* ignore */
    }
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      // Wspólny klucz `ff.cardContract` (jeden link włącza wszystkie artefakty),
      // z fallbackiem na własny FLAG_LS dla wstecznej kompatybilności.
      const ls = parseFlag(
        window.localStorage.getItem('ff.cardContract') ?? window.localStorage.getItem(FLAG_LS)
      );
      if (ls !== null) return ls;
    } catch {
      /* ignore */
    }
  }
  try {
    const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
    const env = parseFlag(meta?.env?.[FLAG_ENV]);
    if (env !== null) return env;
  } catch {
    /* ignore */
  }
  return false;
}

export const INITIATIVE_CARD_CONTRACT_FLAG_KEYS = {
  query: FLAG_QUERY,
  localStorage: FLAG_LS,
  env: FLAG_ENV,
} as const;
