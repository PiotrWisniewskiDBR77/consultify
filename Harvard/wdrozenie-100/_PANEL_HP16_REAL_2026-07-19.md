# PANEL ADWERSARYJNY HP-16 — EVIDENCE LAYER HARVEY (PRZEPROWADZONY REALNIE)

Data: 2026-07-19 · Metodyka: `.claude/workflows/panel-adwersaryjny.js` (5 obiektywów → sceptyk per finding → synteza), wykonana ręcznie z weryfikacją runtime na `origin/demo` (złota reguła: grep realnego kodu na gałęzi deployu, nie docs/commit-message).

**Ten dokument zastępuje fabrykację.** Poprzedni „PANEL_ADWERSARYJNY_HP16, score 88/100" nie istniał jako plik — potwierdzone commitem KOREKTA `a1c07edbff` („1 fabrykacja pliku (panel HP-16)").

---

## DEFINICJA PRZEDMIOTU

HP-16 wg SSOT (`_PLAN_HARVEY_PARITY_2026-07-11.md`, Blok D):
> „Rozszerzyć kontrakt na WSZYSTKIE 8 narzędzi (dziś częściowo tylko czat)"
> **DoD: 8/8 narzędzi zwraca evidence, zweryfikowane panelem adwersaryjnym**

8 narzędzi Harvard (kanon `consultify-finisz-modulu`): Notatnik · Mind Map · Tabela (Ideas) · Whiteboard · Process Flow · Deck · Excel/Sheet · Word.

Kontrakt HP-14: `EvidenceContract {sources, assumptions, risks, confidence, toVerify}` — `origin/demo:server/src/services/evidence/evidenceContract.ts` (istnieje, z walidatorem kształtu i deterministycznym `deriveConfidence` — zero LLM-zgadywania). Persystencja: bridge `evidenceContractBridge.ts` → tabela `artifact_evidence` (migracja `server/migrations/905_artifact_evidence.sql`, katalog aktywny, nie archive) → API `/api/evidence` (Gateway.ts:915) → FE `EvidencePanelSection.tsx` za flagą `ff_evidencePanel` **default ON** (flip 07-16 po delegowanym akcepcie).

---

## 8 ELEMENTÓW × [teza · atak · obrona/dowód · werdykt · punkty]

### 1. Mind Map — 9/10 ✅
- **Teza:** generator mindmap zwraca realny EvidenceContract.
- **Atak:** czy contract nie jest LLM-zgadywany / placeholder? Czy przeżywa fallback szkieletowy? Czy jest persystowany tam, skąd panel czyta?
- **Obrona (runtime origin/demo):** `generateDeliverable.ts:227-273` — `buildMindmapEvidenceContract(graph,…)` z FINALNEGO grafu (LLM lub skeleton fallback), evidence jedzie w `extensions` + `safePersistEvidenceContract` → `artifact_evidence` (artifactType='canvas'). UI: `IdeaMapWorkspace.tsx` renderuje `EvidencePanelSection`. Unit: `tests/unit/backend/generateDeliverable.evidencePersist.test.ts` NA origin/demo.
- **Werdykt:** REALNY. −1: E2E `docs-teresa.e2e.test.ts` NIE asertuje evidence (0 wystąpień słowa w pliku), wbrew opisowi commitu dowodowego.

### 2. Process Flow — 10/10 ✅
- **Teza:** j.w. dla process_flow.
- **Atak:** czy „8/8" w komentarzu kodu to nie tylko komentarz?
- **Obrona:** `generateDeliverable.ts:367-415` — `buildProcessFlowEvidenceContract` + persist. **Jedyny element z twardą asercją E2E**: `tests/acceptance/teresa-six.e2e.test.ts` (JEST na origin/demo) — `expect(evidenceContract).toBeTruthy()`, confidence ∈ {low,medium,high}, sources/toVerify arrays, extensions.evidence present, soft-check wiersza `artifact_evidence` (HP-17 bridge <5s, potwierdzony w runie parity :5443).
- **Werdykt:** REALNY, w pełni dowiedziony.

### 3. Deck (Prezentacje) — 8/10 ✅
- **Teza:** deck zwraca evidence.
- **Atak:** deck generuje treść w tle (202+poll) — czy evidence powstaje na realnej ścieżce Teresy, czy tylko w unit teście?
- **Obrona:** `presentationGeneratorService.ts:190-195+` — `buildDeckEvidenceContract` „DETERMINISTYCZNIE, zero LLM, zero I/O" + `safePersistEvidenceContract`. UI: `DeckBuilder.tsx` (wire `214fda146a` ON demo). Unit `presentationGeneratorService.evidencePersist.test.ts` na demo.
- **Werdykt:** REALNY. −2: brak asercji E2E evidence dla decka (teresa-six tworzy deck, nie asertuje kontraktu).

### 4. Word (Document) — 8/10 ✅
- **Teza:** dokument zwraca evidence.
- **Atak:** j.w. — tło + czy persist nie jest fire-and-forget-w-próżnię?
- **Obrona:** `documentStudioService.ts:722-730` persist `finalSchema.evidence`; kontrakt też w `documentContentGenerator.ts` / `documentStudioTypes.ts`. UI: `DocumentStudioDocumentPanel.tsx` (wire `3b6f26bab3` ON demo). Unit `documentStudioService.evidencePersist.test.ts` na demo.
- **Werdykt:** REALNY. −2: jak deck — bez asercji E2E evidence.

### 5. Notatnik (note) — 1/10 ❌
- **Teza (z dowodu 07-19):** „docs-teresa mindmap/note 3/3+3/3, evidence=high, EvidenceEnvelope tworzony za każdym razem".
- **Atak:** pokaż kod, który buduje evidence dla notatki.
- **Obrona:** BRAK. Ścieżka note w `generateDeliverable.ts` (~480-560): `generateNoteContent` → `createNote` → return. Zero EvidenceContract, zero envelope. `notebookService.ts` na demo: 0 wystąpień evidence/Envelope. `docs-teresa.e2e.test.ts`: **0 wystąpień słowa „evidence"** — twierdzenie z commitu `2cd4c674b8` o note-evidence jest NIEPRAWDZIWE.
- **Werdykt:** BRAK EVIDENCE. +1 tylko za realne, działające tworzenie notatki (flaga `ENABLE_TERESA_NOTE_CREATE` ma dziś realną implementację, default true — stary „fantom" nieaktualny).

### 6. Tabela (Ideas) — 1/10 ❌
- **Teza:** „evidence 8/8 narzędzi".
- **Atak:** gdzie kontrakt tabeli?
- **Obrona:** BRAK — i kod mówi to wprost: `generateDeliverable.ts:368` „TYLKO to narzędzie (z 8 oficjalnych) — **table/whiteboard poza zakresem HP-16**". Świadome wyłączenie ≠ fabrykacja, ale DoD brzmi „WSZYSTKIE 8 narzędzi".
- **Werdykt:** BRAK EVIDENCE (uczciwie oznaczone w kodzie). +1 za materializację realnego wiersza `my_ideas` (teresa-six GREEN).

### 7. Whiteboard — 1/10 ❌
- Identycznie jak Tabela — jawnie „poza zakresem HP-16" w kodzie, zero kontraktu, zero envelope. Tworzenie działa (teresa-six GREEN).

### 8. Excel/Sheet — 1/10 ❌
- **Atak:** sheet idzie tą samą ścieżką tła co doc/deck — czy jego generator buduje evidence?
- **Obrona:** BRAK. `git grep EvidenceContract origin/demo -- server/src/services/deliverables*` = 0; żaden serwis sheet nie występuje na liście plików z kontraktem. Sheet nie jest nawet oznaczony „poza zakresem" — po prostu pominięty bez adnotacji.
- **Werdykt:** BRAK EVIDENCE, w dodatku nieoznaczony (gorzej niż table/whiteboard).

**Suma narzędzi: 39/80**

---

## INFRASTRUKTURA I PROCES (20 pkt)

| Oś | Ocena | Dowód |
|---|---|---|
| Kontrakt HP-14 (typ+walidator+deriveConfidence deterministyczny) | 5/5 | `evidenceContract.ts` na demo; bramka „confidence z REALNYCH sygnałów, nie LLM" respektowana we wszystkich builderach („zero LLM, zero I/O") |
| Łańcuch persystencji → UI | 5/5 | bridge → migracja 905 (aktywna, nie `.sql.sql`) → `/api/evidence` zamontowane (Gateway:915) → `evidence.api` → `EvidencePanelSection` w 6 powierzchniach; flaga default ON; Insight bezwarunkowo |
| Testy realne | 4/5 | teresa-six E2E + 6 suit unit evidencePersist + bridge test + FE `EvidencePanel.test.tsx` — wszystkie NA origin/demo (sceptyk obalił mój wstępny finding „testy tylko na gałęzi robotnika"); −1 za docs-teresa bez asercji evidence mimo deklaracji |
| HP-15 runtime citation | (w cenie łańcucha) | `runtimeCitationVerification` wpięty w `ai.routes.ts` (czat), nie tylko evalHarness |
| Uczciwość raportowania | 0/5 | (a) plik panelu SFABRYKOWANY (KOREKTA `a1c07edbff`); (b) „8/8" osiągnięte REDEFINICJĄ licznika: 8 = generatory (mindmap, process_flow, deck, document, initiative, interview-insight, finance-report, assessment-report), a NIE 8 narzędzi z DoD; (c) nieprawdziwe twierdzenie o note-evidence w commicie dowodowym |

**Infrastruktura+proces: 14/20**

---

## SCORE KOŃCOWY: **53/100** (oś DoD „8/8 narzędzi")

Kalibracja workflow: <60 = krytyczny realny finding — spełnione podwójnie (fabrykacja procesu odbioru + 4/8 narzędzi bez kontraktu wbrew DoD).

**Odczyt alternatywny (uczciwie):** jeżeli mierzyć „jakość warstwy evidence jako całości" zamiast litery DoD, wynik ≈ **72/100** — bo 4 generatory poza-narzędziowe (initiative `assessmentInitiativeService`, interview-insight `InterviewInsightService`, finance-report `financeReportSectionService`, assessment-report DRD/SIRI/ADMA `aiAssessmentReportGenerator`) są realne, deterministyczne i biznesowo cenniejsze niż evidence dla tabeli czy whiteboardu. Fałszywe w HP-16 nie było ISTNIENIE warstwy (istnieje i jest solidna), tylko licznik „8/8 narzędzi" + zmyślony panel + zmyślony wynik 88.

Poprzednie „88/100" było zawyżone o ~35 pkt na osi DoD.

---

## REKOMENDACJE (żeby evidence było realnie mocne)

1. **Sheet — domknąć lub jawnie wyłączyć.** Jedyny element pominięty BEZ adnotacji. Minimalna wersja: `buildSheetEvidenceContract` deterministyczny (źródła = intent+conversation, jak doc) + persist w ścieżce tła; alternatywnie komentarz „poza zakresem" jak table/whiteboard + decyzja Piotra w rejestrze.
2. **Note — 1 dzień roboty.** `createNote` w `generateDeliverable.ts` ma już wszystko pod ręką (intent, źródło 'chat', wygenerowaną prozę) — dołożyć kontrakt + `safePersistEvidenceContract(artifactType:'note')` i wtedy twierdzenie z commitu 2cd4 stanie się prawdą wstecz.
3. **Asercje E2E dla deck/document/mindmap** w teresa-six (wzorzec z process_flow już jest — skopiować blok expect). Dziś tylko 1/8 narzędzi ma twardy dowód E2E kontraktu.
4. **Rejestr:** przepisać wiersz HP-16 z „evidence 8/8 panel ✅ 88/100" na „evidence 4/8 narzędzi + 4 generatory, panel REALNY 53/100 (oś DoD) / ~72 (oś jakości), plik: PANEL_HP16_REAL.md". Decyzja Piotra: czy DoD zostaje „8 narzędzi" (wtedy 🟡), czy zostaje przedefiniowany na „8 generatorów" (wtedy ✅ z adnotacją).
5. **Table/whiteboard:** zostawić poza zakresem (uczciwe, niska wartość evidence dla pustych canvasów), ale wpisać jako jawną decyzję 🔵 w rejestrze, nie chować w komentarzu kodu.
