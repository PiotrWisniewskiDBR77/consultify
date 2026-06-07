# Generator Inicjatyw — plan budowy + checklista audytu

> Plan wykonawczy do [Formuły Inicjatywy](./INITIATIVE_FORMULA.md). Każda pozycja ma **kryterium
> akceptacji** sformułowane tak, by audytor mógł je niezależnie zweryfikować (☐/☑). Po pełnym
> przejściu wszystkich faz → **runda audytowa** (sekcja na końcu) → wspólne testy.

## Strategia anty-kolizyjna (twarda)
Drugi agent przebudowuje huby insightów/inicjatyw i serwisy. Dlatego buduję **wyłącznie addytywnie**:
- **Nowe pliki**, nie edycje jego plików. Punkty styku przez **cienki kontrakt props/funkcji**.
- NIE dotykam: `InitiativeWizardModal.tsx`, hubów (`InterviewHub`, `InitiativesHub`, `InsightViewer`),
  `initiativeSimilarityService.ts`, `initiativeWizardService.ts`. Zamiast edytować — **opakowuję/rozszerzam** nowym modułem.
- Weryfikacja UI: tymczasowy hash-mount (jak przy Charter), cofany po screenshocie.

## Fazy

### Faza 1 — Charter (GOTOWE ✅)
`src/components/Initiatives/Wizard/InitiativeCharterWizard.tsx` (commit 888942b3e1).
- ☑ 3 kroki na kanonie `WizardModal`; żywy impact×effort 2×2; gate preview; tworzy DRAFT z lineage.

### Faza 2 — Rdzeń rekoncyliacji (relacje do siatki) — ADDYTYWNE
**Plik:** `src/services/initiatives/proposalReconciliation.ts` (nowy, czysta logika, zero zależności od plików agenta).
- Typ `ProposalRelation = 'new' | 'duplicate' | 'extend' | 'evidence_only' | 'conflict' | 'depends_on' | 're_prioritize' | 'contributes_to_goal'`.
- `classifyProposalRelation(candidate, existing[], opts)` → `{ relation, matchedInitiativeId?, score, rationale }`.
- `reconcileProposals(candidates[], existing[], context)` → `{ proposals[], coverage }` (coverage = MECE: luki celów + nakładania).
- **Kryteria akceptacji (audyt):**
  - ☐ Duplikat: kandydat o ~identycznym tytule do biegnącej → `duplicate` z `matchedInitiativeId`.
  - ☐ Extend: silne pokrycie tematu istniejącej, ale nowy zakres → `extend`.
  - ☐ Nowa: brak bliskiego dopasowania → `new`.
  - ☐ Contributes-to-goal: wspólny tag/value-driver → grupuje (zwraca goal/wave).
  - ☐ `reconcileProposals` zwraca **coverage z lukami** (cele bez inicjatyw) i **nakładaniami**.
  - ☐ Funkcje **czyste i deterministyczne** (te same wejścia → to samo wyjście; brak AI/sieci).
  - ☐ Pokryte testem jednostkowym (poniżej), `tsc` + `eslint` czyste.
- **Audyt metodą:** uruchomić test jednostkowy; przejrzeć asercje per relacja.

### Faza 2t — Testy jednostkowe rdzenia
**Plik:** `src/services/initiatives/proposalReconciliation.test.ts` (lub `.spec`).
- ☐ Po jednym teście na każdą relację + coverage; zielone w runnerze repo.

### Faza 3 — Tablica propozycji (UI) — ADDYTYWNE
**Plik:** `src/components/Initiatives/Wizard/InitiativeProposalBoard.tsx` (nowy).
- Karty propozycji z **plakietką relacji**; **evidence drawer**; akcje triage (akceptuj/scal/odrzuć).
- Props-decoupled: `{ proposals, source, onAcceptNew, onAcceptChange, onDismiss }` — zero zależności od hubów.
- **Kryteria akceptacji (audyt):**
  - ☐ Renderuje karty z poprawnymi plakietkami (5 typów + kolory).
  - ☐ „0 nowych ≠ porażka" — stan pustych nowych pokazuje pozytywny komunikat, nie błąd.
  - ☐ Akcept „Nowa" → wywołuje `onAcceptNew` (→ Charter); „Zmiana" → `onAcceptChange` (suggested change).
  - ☐ Evidence drawer pokazuje treść `source`.
  - ☐ Zweryfikowane wizualnie (screenshot z hash-mount), `tsc`+`eslint` czyste, brak błędów w konsoli.

### Faza 4 — Suggested changes (kanał zmiany istniejącej) — ADDYTYWNE, czeka na styk
- Model „suggested change" + mini-bramka u właściciela. **Zależne od modelu agenta** → projektuję typ
  + UI, podpięcie API po wylądowaniu jego przebudowy.
- ☐ Typ `SuggestedChange` + komponent listy/akceptacji; ☐ kontrakt API opisany (do podpięcia).

### Faza 5 — Coverage/MECE + wave — ADDYTYWNE
- Widok „luki pokrycia celów" (z `coverage` z Fazy 2) + grupowanie zaakceptowanych w fale (WIP/wave).
- ☐ Widok pokazuje luki i nakładania; ☐ proponuje przypisanie do wave wg pojemności.

### Faza 0 — Kontrakt wejścia (wpięcie „Zaproponuj inicjatywę") — OSTATNIE (kolizja)
Podpięcie jednego przycisku w hubach/insighcie. **Robione po wylądowaniu przebudowy agenta** (edytuje
jego pliki). Do tego czasu wszystko testowalne przez hash-mount.
- ☐ Jeden komponent-launcher otwierany z `source`+`mode`; ☐ wpięty w ≥2 miejscach; ☐ E2E z realnym źródłem.

- 2026-06-07: **Fazy 2b / 4 / 5 ZBUDOWANE i ZINTEGROWANE** (3 agenty równolegle, addytywnie),
  commit `f4c848056c`:
  - 2b `proposeCandidates.ts` (AI-first + deterministic fallback) — wpięte: modal auto-proponuje z `source.content`.
  - 4 `suggestedChanges.ts` + `SuggestedChangesPanel.tsx` — wpięte: „accept change" → submitSuggestedChange (graceful, backend TBD).
  - 5 `InitiativeCoverageWaveView.tsx` — wpięte: zakładka „Coverage & waves" (luki MECE + fale + WIP-limit).
  Zweryfikowane live (temp-mount): tekst źródła → 4 propozycje; coverage tab → luki + „over capacity 4>3".
  tsc+eslint czyste; testy 12/12 + propose-engine 3/3.
  **Realne luki (uczciwie):** backend `/initiatives/propose` i persystencja suggested-changes = TBD
  (działa fallback); `SuggestedChangesPanel` zbudowany ale niemontowany w detalu inicjatywy (WIP agenta);
  GeneratorModal nie ma produkcyjnego launch-pointu (sensowny wpięty z insightu = `InsightViewer`, w WIP agenta);
  live-klik w zalogowanym Hubie do potwierdzenia po re-loginie.

## Runda audytowa (po pełnym przejściu Faz 1–5)
Audytor przechodzi checklistę ☐ z każdej fazy + globalnie:
- ☐ Zero edycji plików drugiego agenta (git: tylko nowe pliki + ewentualnie Faza 0 po koordynacji).
- ☐ Doktryna z Formuły odzwierciedlona: relacje (§5), one-funnel DRAFT (§6), MECE-coverage (§5), Five Frames (oś).
- ☐ `tsc` + `eslint` czyste dla wszystkich nowych plików; testy jednostkowe zielone.
- ☐ Każdy ekran zweryfikowany wizualnie (screenshoty w wątku).

## Wspólne testy (po audycie)
Scenariusz E2E z właścicielem: wywołaj „Zaproponuj" z realnego insightu → Tablica propozycji →
zaakceptuj 1 nową (DRAFT) + 1 zmianę (suggested change) → przejdź bramkę submit→review → potwierdź
lineage i podgląd bramki. Zero błędów w konsoli; screenshot każdego kroku.

## Log postępu
- 2026-06-07: plan utworzony.
- 2026-06-07: **Faza 2 + 2t DONE** — `src/services/initiatives/proposalReconciliation.ts` +
  `tests/unit/initiatives/proposalReconciliation.test.ts` (12/12 zielone, tsc+eslint czyste).
  Wszystkie 6 kryteriów akceptacji Fazy 2 spełnione (duplicate/extend/new/contributes-to-goal/
  evidence-only/conflict-depends-reprioritize + coverage gaps & overlaps, czyste deterministyczne).
  Następne: Faza 3 (Tablica propozycji UI).
- 2026-06-07: **Faza 3 DONE** — `src/components/Initiatives/Wizard/InitiativeProposalBoard.tsx`
  (nowy, props-decoupled). Plakietki 8 relacji + akcje per typ (new→Create draft; reszta→change),
  evidence drawer, coverage strip (luki + nakładania), „0 nowych ≠ porażka". Zweryfikowane
  wizualnie (hash/localStorage temp-mount, cofnięty); tsc+eslint czyste. Kryteria akceptacji Fazy 3 ✓.
  Następne: Faza 4 (suggested-changes) / Faza 0 (wpięcie) — czekają na styk z przebudową agenta.
- 2026-06-07: **Faza 2/3 złożone w całość** — `src/components/Initiatives/Wizard/InitiativeGeneratorModal.tsx`
  (nowy, samodzielny) spina rdzeń + Tablicę + Charter w jeden przepływ „Zaproponuj": fetch siatki
  (`/initiatives`) → reconcile → board → akcept New → Charter z prefillem + lineage; akcept Change →
  toast (placeholder Faza 4). Zweryfikowane live end-to-end (board→charter, lineage przeniesiony);
  tsc+eslint czyste. Gotowe do wpięcia jedną linią (Faza 0) po wylądowaniu przebudowy agenta.
  Decyzja CTO: cudzy WIP (1513 l. niezacommitowanych) NIETKNIĘTY — praca tylko w nowych plikach.
- 2026-06-07: **Faza 0 (częściowo) DONE** — wpięcie `InitiativeCharterWizard` w `InitiativesHub.tsx`
  (plik poza WIP agenta): przycisk „Charter" → wizard → DRAFT, refresh listy. Addytywnie,
  bez ruszania quick-create/AI-wizard. Commit `95ce81d175`. Przy okazji **naprawiony pre-existing
  build-break** wniesiony commitem `7701516eea` (canon §9 kebab wołał niezdefiniowane
  `handleOpenDocument`) — dodano generyczny opener; moduł znów typechecker-clean.
  **Pozostaje:** wpięcie handoffu „Zaproponuj" w `InsightViewer` (plik w WIP agenta) + silnik AI
  (Faza 2b) + suggested-changes (Faza 4). Live-klik w hubie do potwierdzenia po re-loginie
  (sesja dev wygasła; nie wprowadzam credentiali).
