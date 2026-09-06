# RAPORT K1 — kontrakt kart N (Wniosek/Insight, Inicjatywa) kontra realny ekran

Czytane z `/private/tmp/m03` (tylko odczyt). Zrzuty: `/private/tmp/stanowisko-noc/audyt-k1/0*.png`.

## 0. Sprostowanie zlecenia (zweryfikowane, nie zgadywane)
- Rejestr `registry.ts` ma **8 kluczy** (`tool, initiative, insight, interview, decision,
  notification, task, action`) — komentarze w TYM SAMYM pliku wciąż mówią „siedem kart N".
- **Nie istnieje** krok/zakładka „Wnioski" wewnątrz kreatora „Nowy insight"
  (`InsightCreatorModal.tsx:81,84-108`). Kreator ma 3 kroki: `Definicja`, `Materiał`,
  `Dostrojenie` (opcjonalny) — zob. `02-kreator-nowy-insight.png`. „Wnioski" to ZAKŁADKA
  MODUŁU (Menu 2 Interview, `InterviewHub.tsx:2356`) = lista, nie ekran w kreatorze.
- `scripts/dev/stanowisko-lokalne/zrzut.mjs` **nie istnieje**. Użyty realny, działający
  `scripts/dev/odbior-zywo/zrzut.mjs` (`--url/--out/--klik/--wpisz`, `ODBIOR_AUTH_STATE=env`).

## A. Tabela rozjazdów — WNIOSEK (Insight)
Kontrakt: `src/components/Interview/insightCardContract.ts` (861 linii, `INSIGHT_CARDS`, 30 kart).
Ekran: `InsightViewer.tsx`, tablica `INSIGHT_SECTIONS` (linia 786, 32 wpisy renderowane).
Flaga `VITE_VF1_INSIGHT_CARD_CONTRACT` / `?cardContract=1` — **domyślnie OFF**
(`InsightViewer.tsx:1454`: `spec: insightCardContractEnabled ? INSIGHT_CARD_SPEC : undefined`).//
**Z flagą OFF (czyli w realu, na każdym dzisiejszym ekranie) kontrakt NIE bierze udziału w
renderze w ogóle** — picker „Sekcje ▾" i widoczność chodzą po `INSIGHT_SECTIONS`/legacy
`cardSets.ts`, nie po `insightCardContract.ts`.

| Sekcja/pole | Kontrakt mówi | Ekran pokazuje | Rozjazd | Waga |
|---|---|---|---|---|
| `artifact-actions` (rdzeń, kolejność 0) | `kompozycja: kolumna:'left'` — rdzeń nieusuwalny w LEWEJ kolumnie (linia 110-125) | Kafelki „Rozpocznij…" NIE renderują się w centrum od 2026-07-23 — przeniesione do PRAWEGO PANELU, sekcja „Rezultaty" (`InsightViewer.tsx:770-784,3965-3976,8282`) | Sekcja poza kontraktem (id żyje w katalogu, ale kolumna/miejsce nieaktualne) | Kosmetyka (udokumentowana świadomie w kodzie, flaga OFF nie szkodzi) |
| `candidate-triage` | label „Findings & Evidence" (linia 426-444) | DOC ma „Triage kandydatów"; ekran renderuje pod etykietą kontraktu, wchłania `traceability` | `statusKanonu:'rozjazd'` — sam plik przyznaje niespójność z DOC (`InsightViewer.tsx:750,752,664`) | Kosmetyka |
| `source-pack` | `rolaAI:'dane'`, brak promptu (linia 446-464) | wchłania `source-sessions` | `rozjazd` — DO POTWIERDZENIA: rola dane vs asystuje | Kosmetyka |
| `material-quality` | `rolaAI:'dane'` (linia 493-509) | Renderuje się (nav :771, case :3581) | KANON §2.3 błędnie twierdzi „nie istnieje" — istnieje | Kosmetyka (błąd w DOC, nie w kodzie) |
| 9 kart „Phase-D" (`key-findings`, `tensions`, `patterns`, `mental-models`, `moments`, `quote-bank`, `stakeholder-map`, `source-credibility`, `consulting-narrative`) | `statusKanonu:'do-decyzji-piotra'`, w katalogu jako `dodawalna` | Renderują się (`InsightViewer.tsx:894-921`) | Semantycznie DUBLUJĄ 16 istniejących kart (np. `key-findings`↔`candidate-triage`) — czekają na dedup Piotra | Blokuje porządek katalogu, nie blokuje MVP |
| `executive-memo`, `recommendations` | USUNIĘTE z `INSIGHT_CARDS` (scalone z rdzeniem, Faza 0 DEDUP) | WCIĄŻ renderowane przez `INSIGHT_SECTIONS` jako „extras" (linia 899, 908 w ekranie) | Ekran pokazuje 2 sekcje, których kontrakt świadomie już nie zna | Kosmetyka (udokumentowane, zero regresji wg autorów) |

## B. Treść karty WNIOSKU — pochodzenie i martwe sekcje
- Prawie wszystkie 30 kart mają `rolaAI:'pisze'` z realnym `aiPrompt.szablon` — generowane przez AI
  z materiału wywiadu. `source-pack`, `material-quality` = `rolaAI:'dane'` (agregat, nie proza).
- **Martwych sekcji renderowanych bez pisarza NIE znaleziono** — wszystkie 32 renderowane id mają
  obsługę w `switch` (`InsightViewer.tsx`, dev-log `orphans` przy `?cardContract=1` to pilnuje).
- Odwrotny problem (patrz C): pola zbierane przez kreator, których żadna sekcja NIE POKAZUJE.

## C. Kreator „Nowy insight" vs karta — realne pola
`InsightCreatorModal.tsx:handleSubmit` (~1283-1355) wysyła do `POST /interview/insights`:
`title, sessionIds, promptType, filters{…}, analysisScope{…, consultant_note, leading_question}`,
`analysisMode, contextMode, topicFocus, consultantNote, leadingQuestion, customPrompt`.
Serwer PERSYSTUJE i WSTRZYKUJE te pola wprost do promptu AI
(`InterviewInsightService.ts:1024-1025,1703,2112-2113,2224`).

**Grep `leadingQuestion|leading_question|consultantNote|consultant_note|topicFocus|
analysisMode|contextMode` w `InsightViewer.tsx` → ZERO wystąpień.** Konsultant wypełnia w kroku
„Dostrojenie" pytanie przewodnie i notatkę dla AI — one STERUJĄ generacją, ale wynikowa karta
NIGDZIE nie pokazuje, o co poproszono AI. Pole zbierane przez kreator, całkiem ignorowane przez kartę.

## D. Tabela rozjazdów — INICJATYWA
Kontrakt: `src/components/Initiatives/sections/initiativeCardContract.ts` (1173 linii, 35 kart
żywych z 36 zadeklarowanych + `watchers`). Ekran: `InitiativeDocumentView.tsx`, `initiativeNSections`
(linia 5402, ok. 24 sekcje N-mode board). Flaga `VITE_VF1_INITIATIVE_CARD_CONTRACT` — domyślnie
OFF; z flagą ON kontrakt WYŁĄCZNIE **porządkuje** kolejność sekcji (DEC-387, `:9100-9172`), nie
ukrywa i nie dodaje niczego — bezpieczniejsze niż Insight, ale wciąż nieaktywne domyślnie.

| Sekcja/pole | Kontrakt mówi | Ekran pokazuje | Rozjazd | Waga |
|---|---|---|---|---|
| Przestrzeń id | katalog kluczuje po `registry.ts` (camelCase: `overview`, `targetState`, `scope`, `raid`, `kpis`, `financialAnalysis`…) | board renderuje WŁASNE, inne id (kebab: `initiative-definition`, `target-state-scope`, `risk-raid`, `kpi`, `financial-analysis`…) | Dwie różne przestrzenie nazw, mostkowane WYŁĄCZNIE do nawigacji „skocz z D-mode" (`nModeMap`, `InitiativeDocumentView.tsx:1708-1719`, 9 wpisów) — kontrakt i renderowany board NIE dzielą jednego źródła prawdy | Strukturalne, ale bez wpływu na treść (świadomie odłożone w nagłówku pliku) |
| `overview`+`problemDefinition` → `initiative-definition` | osobne karty, osobne prompty | JEDNA sekcja ekranu „Zakres inicjatywy" (potwierdzone zrzutem `08`) | Merge 2→1 bez alias w kontrakcie poza `nModeMap` | Kosmetyka |
| `targetState`+`scope` → `target-state-scope` | label kontraktu: „Stan docelowy" / „Zakres" (osobno) | Ekran renderuje JEDNĄ sekcję pod etykietą **„Kryteria sukcesu"** (`InitiativeDocumentView.tsx:5452-5457`, potwierdzone zrzutem `09`) | Etykieta na ekranie nie pochodzi od żadnej z dwóch kart kontraktu wprost — to `opis` `targetState` awansowany na główną etykietę | Kosmetyka, ale myląca (użytkownik szuka „Zakres", widzi „Kryteria sukcesu") |
| `competencyRequirements`, `skillsGap` | W katalogu z realnym `aiPrompt` (`rolaAI:'asystuje'`), `statusKanonu:'rozjazd'` — „brak wiersza w seedzie DB" | **ZERO wystąpień** w `InitiativeDocumentView.tsx` — nie renderują się WCALE, żadną etykietą | Sekcja martwa dla tego widoku — ale ma serwer (`server/src/routes/skills-gap.routes.ts`, `skillsGapService.ts`) i osobny, OSIEROCONY komponent `src/components/Initiatives/sections/SkillsGapSection.tsx` (zero importerów w całym `src`) | **Blokuje kompletność karty** — pełny pionek zbudowany, niepodłączony (wzorzec „zbudowane, ale niepodłączone") |
| `governance` (alias `raci`) | `idWArtefakcie` mapuje na `raci` | Board renderuje osobną pozycję nawigacji „RACI" (grupa LUDZIE, zrzut `09`) | Zgodne — alias działa | brak |
| `financialAnalysis` | `statusKanonu:'rozjazd'` — „DB aktywna, ale komentarz kodu «enum is dead per F0»" | Renderuje się jako „Analiza finansowa" (zrzut `09`) | Rozjazd żywy/martwy nierozstrzygnięty (DO POTWIERDZENIA PIOTRA wpisane w kontrakcie) | Do decyzji, nie blokuje wyświetlania |
| 2 klucze „martwe" z `registry.ts` (`initiativeTeam`, `linkedItems`) | Nie mają WCALE osobnych kart w katalogu — scalone aliasem w `team`/`attachments` | zgodnie z tym, board pokazuje `team`/`attachments-links`, nie osobne duplikaty | Brak rozjazdu (poprawnie zwinięte) | brak |

## B2. Treść karty INICJATYWY — martwe sekcje
Jedyne potwierdzone martwe (renderowane NIGDZIE, mimo pełnego pipeline'u backend+kontrakt):
**`competencyRequirements` i `skillsGap`** — patrz tabela D. To NAJWAŻNIEJSZE znalezisko dla
Inicjatywy: karta ma kompletny kontrakt (prompt AI, DB route, komponent), a użytkownik nigdy
tego nie zobaczy na ekranie inicjatywy.

## Zrzuty (realne dane, sesja „Audyt Nocny", `/private/tmp/m03` na porcie 3127)
1. `01-wnioski-lista.png` — zakładka „Wnioski" (Menu 2 Interview), lista.
2. `02-kreator-nowy-insight.png` — kreator, krok 1 „Definicja" (3 kroki widoczne w pasku).
3. `04-kreator-material.png` — krok 2 „Materiał" (wybór sesji źródłowych).
4. `06-karta-wniosku.png` — realny rekord `seed_ii_..._bottleneck`, lewa nawigacja
   (grupy WGLĄD/MIĘDZY WIERSZAMI/DOWODY) + prawy panel.
5. `07-karta-wniosku-prawy-panel.png` — prawy panel rozwinięty: POWIĄZANIA, ŹRÓDŁA I ZAŁOŻENIA
   (`EvidencePanelSection`, NIE pokazuje leading_question/consultant_note), REZULTATY.
6. `08-karta-inicjatywy.png` — realny rekord `Supply Chain Optimization`, sekcja
   „Zakres inicjatywy" otwarta, prawy panel.
7. `09-karta-inicjatywy-nav-dol.png` — pełna lewa nawigacja (6 grup) + pełny prawy panel
   (widać „RACI" i „Kryteria sukcesu").

**Nieudane:** krok 3 kreatora „Dostrojenie" — 3 próby `--klik` zamykały modal zamiast
przejść dalej (timing/selektor automatu, nie produktu — kroki 1-2 działają). Potwierdzone
kodem: `InsightCreatorModal.tsx:renderRefineStep` (linia 2601+).

## Werdykt
- **Wniosek (Insight): rozjazdy KOSMETYCZNE + jedna luka funkcjonalna.** Kontrakt typu istnieje,
  ale jest wyłączony (flaga OFF) i nie steruje niczym na produkcji — realną prawdą jest
  `INSIGHT_SECTIONS`. Rozjazdy nazwane w kontrakcie są już opisane przez autorów i świadome.
  Jedyna realna dziura funkcjonalna: **brak śladu instrukcji dla AI** (`leading_question`,
  `consultant_note`) na wynikowej karcie.
- **Inicjatywa: rozjazdy strukturalne (nazewnictwo) + jedna luka blokująca kompletność.**
  Dwie równoległe przestrzenie id (kontrakt vs board) połączone tylko wąskim mostkiem
  nawigacyjnym. Etykieta „Kryteria sukcesu" myląca względem kontraktu. Najważniejsze:
  **`competencyRequirements`/`skillsGap` mają pełny silnik i zero UI** — martwy pionek.

### 3 naprawy w kolejności
1. Podłącz `competencyRequirements`/`skillsGap` do `InitiativeDocumentView.tsx` (silnik i UI
   już istnieją osobno — brakuje jednego importu/case'a) ALBO jawnie zdecyduj, że to backlog
   (dziś to cichy brak, nie decyzja).
2. Dodaj na karcie Wniosku widoczny odczyt `leading_question`/`consultant_note` (np. w sekcji
   „Odczyt konsultingowy" lub jako meta-pasek nad Executive Summary) — dziś konsultant traci
   ślad, o co poprosił AI.
3. Zrewiduj etykietę sekcji `target-state-scope` na ekranie Inicjatywy („Kryteria sukcesu" →
   coś oddającego, że to i cel, i zakres) ALBO rozdziel z powrotem na dwie sekcje zgodnie z
   kontraktem (`targetState`, `scope`).

## Co niezmierzone i dlaczego
- Krok 3 kreatora „Dostrojenie" na żywym zrzucie (problem automatyzacji, nie produktu).
- Pełne 32 sekcje karty Wniosku pojedynczo rozwinięte — budżet czasu; sprawdzono
  „Podsumowanie" + cały prawy panel na żywo, resztę przez kod (`switch` w `InsightViewer.tsx`).
- Dark/mobile — poza zakresem K1 (kontrakt treści, nie wygląd).
- ★ DO POTWIERDZENIA w kontraktach — decyzja dla Piotra, nie dla audytu.
