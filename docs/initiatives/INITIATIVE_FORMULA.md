# Formuła Inicjatywy — SSOT

> Jeden kanon tworzenia, zarządzania i analizy inicjatyw. Status: **draft do akceptacji**.
> Do tego dokumentu odwołują się: wizardy tworzenia, huby, 22 karty detalu i raporty.
> Wcielona doktryna konsultingowa: MECE (Minto/McKinsey) · kompletny charter + WBS + PMMM (Kerzner) ·
> powiązanie ze strategią (Kaplan–Norton, „Execution Premium") · fale i pojemność (McKinsey
> Transformation Office; HBR „rób mniej projektów").

## 0. Manifest
Inicjatywa = **moment, w którym diagnoza staje się zobowiązaniem**. Jest jednocześnie:
- **lejem** — spływają do niej insighty, tury/tools, assessmenty, analizy finansowe, idee, notatki, dyskusja z AI;
- **silnikiem** — rodzi taski, decyzje, notyfikacje, deliverables, KPI-tracking;
- **obiektem informacyjnym** — raportuje status transformacji.

Sukces transformacji = jakość tworzenia + dyscyplina cyklu + uczciwa analiza wyników.

## 1. Doktryna (na czym się opieramy)
- **MECE** — portfel inicjatyw *wzajemnie wykluczający* (nie nachodzą) i *łącznie wyczerpujący*
  (pokrywają cele): „bez nakładania, bez luk".
- **Kompletny charter + WBS** (Kerzner) — każda inicjatywa w pełni opisana; granice zakresu tak
  wytyczone, by się nie zazębiały; odróżniaj zależność od nakładania. Dojrzałość (PMMM): wspólny język
  → proces → metodyka → benchmark → ciągłe doskonalenie.
- **Powiązanie ze strategią** (Kaplan–Norton) — każda inicjatywa mapuje na cel/value-driver; portfel
  zarządzany jak budżet strategiczny (StratEx).
- **Five Frames of Transformation** (McKinsey, oś nadrzędna całej Formuły): **Aspire → Assess →
  Architect → Act → Advance**. Mapowanie: Aspire/Assess = źródła + diagnoza (§3); Architect =
  tworzenie charteru (§4); Act = realizacja + bramki (§6–7); Advance = analiza + pętla (§8).
- **Fale i pojemność** (McKinsey Transformation Office; HBR „rób mniej projektów") — time-boxed
  wave'y, WIP-limit; nie przeciążaj organizacji.

## 2. Anatomia inicjatywy
- **Charter-lite (rdzeń, próg utworzenia DRAFT):** tytuł · falsyfikowalna teza („jeśli X to Y bo Z") ·
  jeden owner · impact × effort · ≥1 KPI (baseline→target) · źródło/lineage.
- **Pełny charter (22 karty detalu):** scope in/out, success criteria, KPI, finanse (CAPEX/OPEX/ROI),
  team/RACI, zasoby, zależności, RAID, milestones, timeline, tasks, decisions, gates, załączniki,
  komentarze, activity log… Dopełniany **progresywnie** w miarę przechodzenia bramek — NIE w wizardzie.

## 3. ↓ Źródła (wejścia) i lineage
Kanały: interview insight · tools/tury · assessment / assessment_report · financial_analysis ·
idee (MyWork) · notatki · kanwa/AI (Teresa) · discovery · report-import · audyt · ręcznie.

Reguła: **lineage obowiązkowy** — `sourceType` + `sourceId` (+ `evidenceRefs`), albo jawnie `manual`
z uzasadnieniem. `sourceType ≠ manual` ⇒ `sourceId` wymagany. Zabija inicjatywy-sieroty.

## 4. Tworzenie — *mądrze* (wizard)
Jeden kanon (`WizardModal`), dwa tryby; tryb dobiera kontekst:
- **Charter** (1 źródło / ręcznie / handoff finding) — human-first, AI-assist per pole (✨ wypełnij),
  nigdy auto-submit. Zrealizowane v1: `src/components/Initiatives/Wizard/InitiativeCharterWizard.tsx`
  (3 kroki: Definicja → Uzasadnij → Zarządź; żywy kwadrant 2×2; podgląd bramki).
- **Portfolio** (koszyk N źródeł) — AI generuje kandydatów → triage → shortlist gate.

Każde źródło = pre-fill `source`, nie osobny wizard. AI nigdy nie blokuje utworzenia (degraduje się
przy timeout taniego stacku).

### 4a. Jeden kontrakt wywołania (wszędzie tak samo)
W każdym miejscu z „wyzwaniem" (wiersz insightu, gap assessmentu, pozycja analizy finansowej, idea
MyWork, wątek w kanwie) jest ten sam przycisk **„Zaproponuj inicjatywę"**. Klik zawsze otwiera **ten
sam kreator** z innym `source` — kontrakt `otwórz(source)`. Huby tylko wołają, nie mają własnych wizardów.

### 4b. Przebieg „Zaproponuj" (nie pusty formularz)
Po wywołaniu kreator robi przebieg uzgadniający, zanim cokolwiek pokaże:
1. czyta **mądrość ze źródła** (dowody, pewność, cytaty),
2. czyta **organizację** (cele, value-drivery, ograniczenia, pojemność),
3. czyta **siatkę** (inicjatywy biegnące/planowane),
4. **uzgadnia** → zwraca **zestaw propozycji**, każda z etykietą relacji (§5), a nie „1 inicjatywę".

### 4c. Tablica propozycji (główny ekran tworzenia)
Zamiast od razu formularza — panel triage. Po lewej karty propozycji z **plakietką relacji**
(🟢 Nowa · 🔵 Zmiana istniejącej · ⚪ Dowód · 🔴 Konflikt · 🟡 Re-priorytet). Po prawej **evidence
drawer** ze źródłem przed oczami. Człowiek triażuje (akceptuj/scal/odrzuć). Plakietka „**0 nowych ≠
porażka**". Po triage:
- **Nowa** → charter-lite (`InitiativeCharterWizard`) → DRAFT.
- **Zmiana istniejącej** → *suggested change* do właściciela/PM tamtej inicjatywy → mini-bramka
  (przyjmij/odrzuć); **nigdy zmiana od ręki**.

## 5. Generacja portfela = REKONCYLIACJA Z SIATKĄ (serce systemu)
Generacja to **nie akcja jednorazowa** — każda tura wywiadów to **delta** wobec żywej siatki
inicjatyw. Generator trzyma dwa konteksty:
- **organizacji** — cele, value-drivery, ograniczenia, pojemność, pamięć odrzuceń;
- **portfela** — inicjatywy biegnące / planowane / zrobione.

**Taksonomia relacji** kandydata do siatki (rozszerza dzisiejsze duplikat↔nowy):

| Relacja | Skutek |
|---|---|
| **Nowa** | kandydat na DRAFT |
| **Duplikat** | odrzuć / scal |
| **Rozszerzenie (extend)** | dorzuca scope/KPI do biegnącej |
| **Dowód (evidence-only)** | nie tworzy nic — wzmacnia istniejącą nowym dowodem/pewnością |
| **Konflikt** | nowa obserwacja podważa biegnącą → sygnał re-review |
| **Zależność (depends-on)** | sensowna tylko z/po inicjatywie X |
| **Re-priorytetyzacja** | dane zmieniły wagę istniejącej |
| **Wkład w cel** | ta sama wiązka value-drivera → grupuje pod wave/program |

**MECE-check przy każdym przebiegu:** (1) *nakładanie* — czy zakres nie zazębia się z istniejącą;
(2) *luki pokrycia* — czy cele transformacji mają inicjatywy, czy są białe plamy.

**„Jedna czy szereg" się rozpuszcza:** liczy się, jak każdy kandydat osadza się w siatce.
**0 nowych ≠ porażka** — przebieg może wzmocnić 3 biegnące, zgłosić 1 konflikt, podbić 1 priorytet.

**Pamięć odrzuceń:** rejestr „odrzucone i dlaczego", by generator nie wracał z tym samym co tura temu.

Reuse: `server/src/services/initiativeSimilarityService.ts`, triage merge/extend, capacity signal
(#29c) — rozszerzyć o relacje evidence-only / konflikt / re-priorytet.

## 6. Cykl zarządzania (bramkowanie)
SSOT statusów/bramek: `server/src/constants/initiativeStatuses.ts` — 13 statusów:
DRAFT → PENDING_REVIEW → REVIEW → PROMOTED → PLANNING → APPROVED → SCHEDULED → EXECUTING/BLOCKED →
DONE → TRACKING → ARCHIVED (+ CANCELLED).

**Jeden lejek, zero tylnych drzwi:** każda inicjatywa startuje DRAFT niezależnie od źródła.
Konsultant może tylko `SUBMIT_FOR_REVIEW`; promuje PM/Lead/PMO (GATE_PERMISSIONS). Wizard pokazuje
**podgląd następnej bramki**, nigdy sam nie promuje.

## 7. ↑ Skutki (silnik)
Inicjatywa generuje: taski · decyzje · notyfikacje · deliverables · KPI-tracking; taski rodzą kolejne
zdarzenia. 22 karty detalu = typy zdarzeń (informowanie + konkretne działania). Każde zdarzenie nosi
backlink do inicjatywy (i dalej do źródłowego dowodu) — pełna traceability w obie strony.

## 8. Analiza wyników + pętla zamknięta
Benefits realization: KPI baseline→actual; rollup portfela (wave/program); „co zadziałało / co nie".
**Pętla:** wyniki inicjatyw → nowa diagnoza/insighty → nowe inicjatywy (rekoncyliacja §5).
Transformacja jako cykl, nie lista.

## 9. Warstwa informacyjna
Inicjatywa jako obiekt raportowy: status do interesariuszy, dashboardy, rollupy portfela/wave/program.

## 10. Zasady-dyscypliny (skrót)
Lineage obowiązkowy · jeden owner · falsyfikowalna teza · minimum viable charter · jeden lejek (DRAFT) ·
similarity przed utworzeniem · WIP-limit/pojemność · kill criteria · MECE (nakładanie + luki) ·
0 nowych ≠ porażka · pamięć odrzuceń.

## 11. Otwarte decyzje (do domknięcia z właścicielem)
1. Owner i KPI wymagane już w DRAFT, czy dopiero przy promocji do REVIEW?
2. Quick-create: zabić w module inicjatyw (łapanie pomysłów → stub w MyWork) czy zostawić?
3. Tryb Charter/Portfolio: auto wg kontekstu czy świadomy wybór?
4. Impact/effort: w tagach (zero migracji) czy dedykowane kolumny przez guarded ALTER (sortowanie portfela)?
5. Czy generator *proponuje zmiany* na biegnących (extend / re-priorytet) czy tylko tworzy nowe + flaguje?

## 12. Mapowanie na kod (reuse — bez wymyślania od nowa)
- Shell: `src/components/shared/WizardModal/*`
- Charter v1: `src/components/Initiatives/Wizard/InitiativeCharterWizard.tsx`
- Create: `createInitiativeWriteTruth()` (POST `/initiatives`, status DRAFT) + `CreateInitiativeSchema`
  (`server/src/validators/initiative.validators.ts`)
- Bramki: `server/src/constants/initiativeStatuses.ts`
- Similarity/dedup: `server/src/services/initiativeSimilarityService.ts`,
  `src/utils/initiativeDuplicateDetection.ts`
- Priorytet 2×2: `src/components/MyWork/table/IdeaScoringModel.tsx`,
  `src/components/MyWork/mindmap/AIPriorityRecommender.tsx`

## 13. Plan budowy (fazy)
- **Faza 0 — kontrakt wejścia.** Jeden komponent + props `source`+`mode`; jedno „Zaproponuj
  inicjatywę" podpinane wszędzie (huby tylko wołają). Reuse `WizardModal`. [addytywne, bez kolizji]
- **Faza 1 — Charter (GOTOWE).** `InitiativeCharterWizard` v1 — zweryfikowany, commit 888942b3e1.
- **Faza 2 — silnik „Zaproponuj".** Backend: przebieg source + org + siatka → zestaw propozycji z
  relacją. Rozszerzyć `initiativeSimilarityService` + wizard-candidates o relacje *evidence-only /
  konflikt / re-priorytet* (dziś tylko duplikat↔nowy). [styk z przebudową drugiego agenta — koordynacja]
- **Faza 3 — Tablica propozycji.** UI triage z plakietkami relacji + evidence drawer.
- **Faza 4 — Suggested changes.** Kanał „propozycja zmiany istniejącej" + mini-bramka u właściciela.
- **Faza 5 — Coverage/MECE + wave.** Widok „luki pokrycia celów" + układanie zaakceptowanych w fale
  (McKinsey wave/WIP).

## Źródła doktryny
- MECE (Barbara Minto / McKinsey) — non-overlapping, no-gaps.
- Harold Kerzner — *Project Management: A Systems Approach*; Kerzner PMMM (5 poziomów).
- Kaplan & Norton — *The Execution Premium* / Strategy Maps / Balanced Scorecard (StratEx).
- McKinsey Transformation Office (wave-based) · HBR 2025 „Focus on Fewer Projects".
