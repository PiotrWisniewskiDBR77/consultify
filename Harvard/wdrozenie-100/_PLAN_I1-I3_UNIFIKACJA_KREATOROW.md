# PLAN I1-I3 — Unifikacja kreatorów Insight / Initiative / Decision

**Data:** 2026-07-14 · **Autor:** audyt+plan (Claude, agent audytowo-planistyczny) · **Status:** DO DECYZJI PIOTRA (nie zaczynaj budowy L bez akceptu architektury)
**Weryfikacja:** całość poniżej potwierdzona na żywym kodzie `origin/demo` (grep realnych callerów, nie z docy/handoffów) — zgodnie ze złotą regułą repo.
**Kontekst wejściowy:** świadomie odłożona pozycja z rozliczenia 145 uwag (`_ROZLICZENIE_1-88_2026-07-12.md` linie 288/307/327/335); istnieje wcześniejszy ADR #68b (`docs/initiatives/INITIATIVE_GENERATOR_UNIFICATION_DECISION.md`, commit `cfa4051dd5`, na gałęzi `claude/agitated-haslett-f9842a`, **nie scalony do demo**) który analizował węższy problem (tylko 2 ścieżki generacji Initiative) i rekomendował NIE unifikować backendu. Niniejszy plan rozszerza zakres na 3 encje (Insight/Initiative/Decision) zgodnie z aktualną decyzją Piotra i musi pogodzić się z wnioskami ADR #68b, nie ich ignorować.

---

## 0. Executive summary (dla Piotra)

Zadanie brzmiało "ujednolić 2 generatory" — **audyt pokazuje, że w kodzie jest ich faktycznie 6+**, nie 2, plus jeden orphan (martwy kod). To zmienia kalkulację ryzyka: pełna unifikacja treści formularzy (opcja "1 formularz ze wszystkim") jest realistycznie **L (duży)**, nie M, i ADR #68b już raz ostrzegał przed dokładnie tym scenariuszem dla samych Initiative.

**Rekomendacja architektury:** NIE jeden płaski formularz z warunkowymi sekcjami. Zamiast tego: **1 wspólna powłoka (shell) + 3 typowe warianty treści**, dokładnie ten sam wzorzec co już zaakceptowany i wdrożony w #83c/d (buildery szablonów: `ExecutiveModuleShell` + wizard START 3-kroki + 3 buildery per typ Doc/Deck/Table, reużyta fasada backendu). To NIE jest teoria — to jest już żywy precedens w tym repo, do skopiowania 1:1.

**Bezpieczny pierwszy krok (S, można zacząć od razu):** wspólny router/launcher "+ Nowy" (jeden przycisk z wyborem typu: Insight / Initiative / Decision), który pod spodem **nadal woła te same, niezmienione generatory**. Zero zmiany logiki wewnętrznej, zero ryzyka regresji AI/governance, natychmiastowa wartość UX (jeden punkt wejścia zamiast rozproszonych 6 przycisków w różnych miejscach). Pełna unifikacja treści kroku 2 (właściwy formularz) wymaga decyzji Piotra — patrz §7.

---

## 1. Stan obecny — TO NIE JEST "2 generatory", TO JEST 6 ŻYWYCH ścieżek + 1 martwa

Grep realnych callerów (nie nazw plików) w `src/components/`:

| # | Komponent | Linie | Wywoływany z | AI? | Model danych |
|---|---|---|---|---|---|
| 1 | `DiscoveryTools/GenerateInitiativesModal.tsx` | 213 | `DiscoveryToolsHub.tsx`, `ToolDocumentView.tsx`, `ToolWorkspace.tsx` (Tools▸Inicjatywy) | **TAK** — `ToolInitiativeService.generateFromSession` (AIPipeline + `CARD_CONTENT_FORMULA_A3_LITE`) | `title/description/category/priority/risk` |
| 2 | `Initiatives/Wizard/InitiativeWizardModal.tsx` (kanoniczny) | 2606 | `InterviewHub.tsx` (`generate_from_evidence`), `InitiativesHub.tsx` Menu 3 | **NIE** — `initiativeWizardService.buildSeedCandidates` = deterministyczne szablony, zero AI | `impact/effort/risk/timeToValue/strategicFit` + `confidence/limits/evidenceRefs/sourceRefs` (lineage) |
| 3 | `Initiatives/Wizard/InitiativeCharterWizard.tsx` | 847 | `InitiativesHub.tsx`, `InitiativeGeneratorModal.tsx` | częściowo (AI-assist per pole przez `POST /initiatives/generate-section`) | `problem/solution/scope/kpi` (charter-lite, 4 core fields) |
| 4 | `Initiatives/Wizard/InitiativeGeneratorModal.tsx` | — | `Interview/InsightViewer.tsx` ("Propose initiative" z Insighta) | pośrednio (routing do #3) | reconciliation → Proposal Board → Charter |
| 5 | `assessment/modals/GenerateInitiativesModal.tsx` | 839 | `assessment/InitiativesTable.tsx` (generacja z zatwierdzonego raportu oceny) | TAK — analiza luk z raportu | `title/description/category/priority` (wariant assessment) |
| 6 | `assessment/manage/InitiativesManagementPanel.tsx` (lokalny `const GenerateInitiativesModal`) | ~275 lin. inline | sam siebie (nie import, WŁASNA redefinicja) | TAK (własna kopia logiki #5) | wariant assessment, zduplikowany kod |
| — | `assessment/InitiativeGeneratorWizard.tsx` | 892 | **BRAK CALLERA** (0 importów poza plikiem) | — | **MARTWY KOD** — kandydat do usunięcia, poza zakresem tego planu |

Do tego osobno:

| Encja | Komponent kreacji | Wywoływany z | AI? |
|---|---|---|---|
| **Insight** | `Interview/InsightCreatorModal.tsx` (2813 lin., BCG-enterprise: 12 typów analiz, 7 trybów, filtry, koszyki źródeł) | `InterviewHub.tsx` | TAK — pełna generacja AI |
| **Decision** | `MyWork/DecisionsPanel.tsx` → `NewDecisionModal` (inline, ~210 lin.) | `DecisionsPanel.tsx` (My Work) | **NIE** — czysto manualny formularz (`title/description/decisionType/priority/dueDate/assigneeId`), `POST /decisions` |

**Wniosek #1:** Initiative ma najgorszy rozjazd — 6 różnych UI + 2 modele danych jednocześnie (portfolio-scoring 5-osiowy w wizardzie vs category/priority/risk w Tools/assessment vs charter problem/solution/scope/kpi). Insight ma 1 bardzo rozbudowany kreator. Decision nie ma AI wcale — to zupełnie inna kategoria dojrzałości.

**Wniosek #2:** dwie kopie logiki assessment (#5 zaimportowana + #6 lokalnie zredefiniowana w `InitiativesManagementPanel.tsx`) to osobny, mały, bezpieczny do naprawienia dług techniczny — warto posprzątać PRZED unifikacją (patrz §6 Faza -1).

---

## 2. Dedup — jak działa dziś i czy da się reużyć

Trzy niezależne mechanizmy, wszystkie żywe na demo (commit `4dd262bf58c`):

1. **Initiative-side similarity:** `server/src/services/initiativeSimilarityService.ts` (`checkSimilarInitiatives`, embeddings cosine + token-Jaccard fallback), wystawione przez `POST /initiatives/similarity-check`. Wołane w DWÓCH miejscach:
   - `ToolController.ts:1632-1657` po generacji Tools▸Insight → `duplicateWarnings` → nieblokujący toast w `DiscoveryToolsHub.tsx:5100`.
   - `InitiativeWizardModal.tsx` — per-kandydat `SimilarityCandidateResult` z werdyktem `new/related/similar/duplicate`, UI resolution **wbudowane w model kandydata wizarda**: `setSimilarResolution(candidateId, 'merge'|'extend'|'create_anyway')` → `POST /initiatives/:id/merge-from-insight` lub `/extend-from-insight` (realny merge treści, nie tylko toast).
2. **Insight-side similarity:** `V8InterviewApi.checkInsightSimilarity` → `POST /interview/insights/similarity-check` (ten sam wzorzec: embeddings + fallback), z client-side heuristic fallback w `InsightCreatorModal.tsx` (`computeClientSideHits`, token overlap) gdyby serwer padł.
3. **Proposal reconciliation:** `proposalReconciliation.ts` (Jaccard 0.6) wewnątrz `InitiativeGeneratorModal.tsx` — MECE-coverage reconciliation przy propozycji "Scal/Merge" w `InitiativeProposalBoard`.

**Czy jednolity kreator może to reużyć?** Backend **TAK bez zmian** — `checkSimilarInitiatives`/`checkInsightSimilarity` to gotowe, niezależne serwisy per encja, wystarczy wywołać je z nowego shared kroku "podobieństwo". **UI resolution TRZEBA wyodrębnić** — dziś logika merge/extend/create_anyway żyje wewnątrz stanu kandydata `InitiativeWizardModal` (`SimilarResolution`, `resolvedExisting`, `resolvingCandidateId`), nie jest komponentem. To osobna, mała ekstrakcja (M), niezależna od reszty unifikacji — dobry kandydat na Fazę 3.
**Decision nie ma dziś ŻADNEGO dedup** — nowa funkcjonalność, nie migracja istniejącej (decyzja: czy w ogóle potrzebna dla Decision — governance-owy obiekt, mniej podatny na duplikaty niż insighty z wielu wywiadów).

---

## 3. Schemat pól — wspólne vs różne (czy da się 1 formularz z warunkowymi sekcjami)

| Pole/koncept | Insight | Initiative (wizard) | Initiative (Tools/assessment) | Initiative (charter) | Decision |
|---|---|---|---|---|---|
| title | ✓ | ✓ | ✓ | ✓ | ✓ |
| description/content | `content`, `executiveSummary`, `themes[]` (AI-generated blob) | `problemStatement/opportunityStatement/rationale` | `description` | `problem/solution/scope/kpi` | `description` (manual) |
| źródło/evidence | `sourceSessionIds[]`, koszyki źródeł, dokumenty kontekstowe | `evidenceRefs/sourceRefs`, `tools_session` anchor | raport oceny (1 źródło) | insight/gap (1 źródło) | `relatedObjectType/relatedObjectId` |
| tryb generacji | 12 typów analizy × 7 trybów × filtry (respondent/rola/dział/data) | brak (deterministyczne szablony) | AI single-shot z parametrami | AI-assist per-pole (opcjonalne) | brak — 100% manualny |
| scoring/priorytet | brak | `impact/effort/risk/timeToValue/strategicFit` (5-osiowy) | `category/priority/risk` (3-osiowy) | brak (deferred do 19 sekcji) | `priority` (`LOW/MEDIUM/HIGH/CRITICAL`) |
| governance | similarity-check only | triage (9 statusów) + shortlist-gate + audyt zdarzeń | DoD-gate + decision-record + idempotencja (`tool_initiative_batches`) | "zawsze DRAFT, nigdy promuje" | `decisionOwnerId`, `status`, `escalationLevel`, `required` |
| dedup | semantic + fallback | semantic + merge/extend UI | informacyjny toast (reużywa initiative-side) | brak (dziedziczy z wizarda) | **brak** |

**Wniosek:** pola wspólne to właściwie tylko **title + jakiś tekst opisowy + referencja źródła** — reszta rozjeżdża się mocno (AI-config Insighta nie ma sensu dla Decision; 5-osiowy scoring Initiative nie ma odpowiednika w Insight/Decision; governance triage jest unikalny dla portfolio-wizarda). **Jeden płaski formularz z warunkowymi sekcjami nie ma sensu** — sekcje "warunkowe" objęłyby 80% powierzchni formularza, co w praktyce jest tym samym co 3 osobne formularze pod wspólnym dachem.

**Rekomendacja:** wzorzec **1 powłoka + 3 warianty kroku 2** (patrz §4), analogicznie do #83c/d.

---

## 4. Wzorzec fundamentu: `ExecutiveModuleShell` + wizard START (precedens #83c/d)

Zweryfikowano na żywo (`_ROZLICZENIE_1-88_2026-07-12.md:324`): #83c/d builder szablonów jest **zaakceptowany i wpięty na demo** (flaga ON, Materials▸Biblioteka wzorców "Nowy"). Kształt: **wspólna powłoka `ExecutiveModuleShell`** (`src/components/shared/ExecutiveModuleShell/index.tsx` + `TopBar`/`LeftRail`/`RightRail`) **+ wizard START 3-kroki** (wybór typu → konfiguracja → nazwa/miejsce) **+ 3 buildery per typ** (Doc/Deck/Table), wszystkie wołające tę samą fasadę `POST /api/deliverables/templates`. Buildery edytują STRUKTURĘ, powłoka daje wspólny chrome (kebab, motyw, nawigacja).

To jest **dokładnie ten kształt architektury**, jakiego potrzebuje I1-I3: shell wspólny dla wejścia/wyjścia/chrome, 3 buildery per encja dla treści.

Dodatkowo w repo już istnieje niżej-poziomowy prymityw **`shared/WizardModal`** (`WizardModal.tsx` + `WizardStepper.tsx`) — używany JUŻ DZIŚ przez `InsightCreatorModal` (kroki: `define/material/refine`) i przez `InitiativeCharterWizard`. Decision jest jedynym z trzech, który NIE korzysta z tego prymitywu (ma płaski jednokrokowy modal) — to jest de facto pierwszy krok normalizacji: przenieść `NewDecisionModal` na `WizardModal`, zanim zacznie się myśleć o wspólnym shellu wyższego poziomu.

**Ocena dopasowania:** `WizardModal`/`WizardStepper` = gotowy fundament kroków. `ExecutiveModuleShell` = gotowy fundament chrome/nawigacji, ale jest to shell PEŁNOEKRANOWY (dla edytorów typu Excel/Deck/Mind Map) — prawdopodobnie zbyt ciężki dla kreatora-modala uruchamianego z 6 różnych miejsc jako overlay. Rekomendacja: nowy **`UnifiedCreatorShell`** na bazie `WizardModal` (lekki, modalny), NIE na bazie pełnego `ExecutiveModuleShell` — ale z tą samą filozofią "1 powłoka + N builderów per typ" co #83c/d.

---

## 5. Architektura rekomendowana

```
UnifiedCreatorShell (nowy, na bazie shared/WizardModal)
├── Krok 0: Wybór typu [Insight | Initiative | Decision]
│    (pomijalny — jeśli launcher wie z góry jaki typ, od razu Krok 1)
├── Krok 1: Źródło/Definicja  — TREŚĆ WARIANTOWA per typ:
│    ├── Insight   → reużyj existing "define"+"material" steps z InsightCreatorModal
│    ├── Initiative→ reużyj existing charter fields z InitiativeCharterWizard
│    │                (NIE dotykać portfolio-wizarda InitiativeWizardModal — ADR #68b)
│    └── Decision  → reużyj existing pola z NewDecisionModal (przeniesione na WizardModal)
├── Krok 2: Podobieństwo/Dedup (opcjonalny per typ)
│    → reużyj checkSimilarInitiatives / checkInsightSimilarity (bez zmian backendu)
│    → nowy reużywalny komponent rezolucji (ekstrakcja z InitiativeWizardModal)
└── Krok 3: Review & Submit
     → per-typ POST do istniejącego endpointu (bez zmiany kontraktów backendu)
```

**Kluczowa zasada projektowa (zgodna z ADR #68b i złotą regułą "reużywaj, nie wymyślaj"):** shell orkiestruje, ale **backend per encja zostaje nietknięty**. Nie przepisujemy `ToolInitiativeService`, `initiativeWizardService`, DoD-gate/decision-record/idempotencji ani triage/shortlist-gate. Unifikujemy TYLKO front-end wejścia i chrome.

---

## 6. Plan wykonania — fazowany, każda faza samodzielnie wartościowa

### Faza -1 (S, sprzątanie, zero ryzyka — może iść RÓWNOLEGLE, niezależnie od reszty)
- Usunąć martwy `assessment/InitiativeGeneratorWizard.tsx` (0 callerów, zweryfikowane grepem).
- Ujednolicić `assessment/manage/InitiativesManagementPanel.tsx`'s lokalną redefinicję `GenerateInitiativesModal` do importu z `assessment/modals/GenerateInitiativesModal.tsx` (dziś 2 kopie tej samej logiki).
- Zero zmian widocznych dla użytkownika — czysty dług techniczny.

### Faza 0 (S, BEZPIECZNY PIERWSZY KROK — można zacząć od razu, bez decyzji architektonicznej)
- Jeden wspólny router/launcher: przycisk "+ Nowy" z wyborem [Insight/Initiative/Decision], otwierający — bez zmian — istniejące komponenty (1 z 6 wyżej, w zależności od kontekstu wywołania).
- Wpięcie w miejsca, gdzie dziś jest rozproszenie: My Work (dziś ma tylko Decision), Interview Hub (ma Insight + Initiative osobno), Initiatives Hub Menu 3.
- Realizuje największą część wartości UX (jeden punkt wejścia zamiast szukania właściwego przycisku) przy ~zerowym ryzyku regresji — logika wewnętrzna generatorów się nie zmienia.
- Za flagą OFF do akceptu Piotra na zrzutach (zasada #7 — Piotr nigdy pierwszym testerem wizualnym).

### Faza 1 (M) — normalizacja powłoki
- Przenieść `NewDecisionModal` (dziś płaski, custom modal) na `shared/WizardModal` — ujednolicić z tym, czego już używają Insight/Initiative-charter.
- Zbudować `UnifiedCreatorShell` (Krok 0 wyboru typu + routing do Kroku 1 per-typ), na razie Krok 1 nadal = embed istniejących komponentów bez rozbioru na pola.
- Test: wszystkie 3 ścieżki tworzenia nadal działają end-to-end (żywy runtime, nie tylko tsc).

### Faza 2 (L) — pełna unifikacja treści Kroku 1+2
- Rozbić istniejące formularze na reużywalne pod-komponenty (Insight define/material/refine, Initiative charter core-fields, Decision manual fields) osadzone jako warianty w `UnifiedCreatorShell`.
- Wspólny Krok 2 (dedup) — ekstrakcja UI resolution z `InitiativeWizardModal` do reużywalnego komponentu, podłączenie pod Insight (już ma backend) i ew. Decision (nowy backend, do decyzji czy potrzebny).
- **NIE dotyka** `InitiativeWizardModal` (portfolio wizard z triage/shortlist-gate) ani `ToolInitiativeService` (AI Tools) — te zostają jako odrębne, "power-user" ścieżki poza unified shell, zgodnie z rekomendacją ADR #68b opcja (b).

### Faza 3 (opcjonalna, M) — AI-assist dla Decision
- Jeśli Piotr zdecyduje, że Decision też ma dostać wsparcie AI (dziś 100% manualny) — osobna decyzja produktowa, nie techniczna.

**Rozmiar całości:** Faza -1: S · Faza 0: S · Faza 1: M · Faza 2: **L** · Faza 3: M (opcjonalna).

---

## 7. Ryzyka

1. **Blast radius realnie większy niż założenie "2 generatory".** 6 żywych ścieżek + 2 modele danych Initiative jednocześnie. Komunikować to Piotrowi PRZED startem Fazy 2 — może zmienić zakres decyzji.
2. **ADR #68b już raz przeanalizował pełną unifikację Initiative i odradził ją** (regresja jakości AI Tools albo blast radius na współdzielony wizard). Ten plan świadomie respektuje tę rekomendację — unifikuje TYLKO front-end shell, nie backend/governance. Jeśli Piotr chce iść dalej (opcja "a" z ADR, pełne scalenie backendu), to jest osobna, świadomie większa decyzja — nie robić jej przy okazji.
3. **Governance nie może zostać spłaszczona.** DoD-gate+decision-record+idempotencja (Tools) i triage+shortlist-gate (wizard) to realne gwarancje jakości — wspólna powłoka nie może ich pominąć ani uprościć przy okazji "ujednolicania UX".
4. **Decision nie ma dziś AI ani dedup** — najbardziej "surowa" z trzech encji. Ryzyko nadmiarowego skoku ambicji (dorzucanie AI do Decision przy okazji unifikacji) — trzymać jako osobną decyzję (Faza 3).
5. **Reguła #7 (Piotr nigdy pierwszym testerem wizualnym)** — każdy krok z widoczną zmianą UI wymaga prototyp → mój zrzut mock-danymi → akcept, flaga OFF domyślnie do akceptu.
6. **Migracje bazy** — Faza 0/1 nie wymagają nowych migracji (routing/shell-only). Faza 2 może wymagać ujednolicenia pola typu `sourceRefs`/`evidenceRefs` między encjami, jeśli dedup ma być spójny — do potwierdzenia z Piotrem przed startem Fazy 2, nie zakładać z góry.
7. **Dług techniczny (Faza -1)** nie jest blokerem dla Fazy 0, ale warto go zamknąć wcześnie — inaczej "trzecia kopia" logiki assessment utrudni Fazę 2.

---

## 8. Rekomendacja dla Piotra

- **Zacząć od razu:** Faza -1 (sprzątanie martwego kodu) + Faza 0 (wspólny launcher, generatory bez zmian) — łącznie S, zero ryzyka regresji, realna wartość UX.
- **Wymaga decyzji Piotra przed startem:** Faza 2 (pełna unifikacja treści formularzy) — bo dotyka pytania "czy Decision dostaje AI-assist", "czy dedup UI staje się wspólny dla wszystkich 3", i wymaga zaakceptowania, że `InitiativeWizardModal` (portfolio) i `ToolInitiativeService` (Tools AI) **zostają poza** unified shell jako odrębne power-user ścieżki (zgodnie z ADR #68b) — a nie znikają.
- Warto też formalnie zamknąć/zescalić ADR #68b (dziś żyje tylko na niescalonej gałęzi `claude/agitated-haslett-f9842a`) — ten plan go rozszerza, ale sam ADR nigdy nie trafił do `origin/demo`.
