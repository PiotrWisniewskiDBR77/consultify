# ROZJAZD: taksonomia kart — `n-mode-card-standard.md` (doc) vs `cardSets.ts` (kod)

> Data: 2026-07-22
> Autor: fala przygotowawcza artefaktów N (równolegle do `_KONTRAKT_KARTY_SSOT`)
> Zadanie audytowe: `_AUDYT_ARCHITEKTURY_ARTEFAKTOW_2026-07-22.md` — „dwa słowniki udające jeden standard"
> Status: DOKUMENT PRZYGOTOWAWCZY. Nie rozstrzyga decyzji produktowych Piotra — dostarcza mapę + werdykt per pozycja + rekomendację.

## 0. Źródła (dowód plik:linia)

| Rola | Plik | Zakres |
|---|---|---|
| DOC (taksonomia opisowa) | `docs/ui-standards/01-shell-layout/n-mode-card-standard.md` | §7 katalog (linie 503–1527), §2 definicja karty (35–45), §8 format (1530–1561) |
| KOD (żywy runtime) | `src/components/shared/NModeLayout/cardSets.ts` | `INSIGHT_SPEC` (71–223), `INITIATIVE_SPEC` (228–411), `DECISION_SPEC` (416–489), `TASK_SPEC` (494–576), rejestr `DEFAULT_CARD_SETS` (580–585) |

### 0.1 Dlaczego KOD = prawda (weryfikacja realnego runtime — złota reguła nr 1)

`cardSets.ts` NIE jest martwą deklaracją — jest konsumowany przez żywy silnik kart:

- `src/components/shared/NModeLayout/index.ts:44` — eksport `DEFAULT_CARD_SETS, getCardSpec`.
- `src/components/shared/NModeLayout/useCardLayout.ts:34,139` — `DEFAULT_CARD_SETS[artifactType]` zamienia spec na żywy layout `{id, visible, order}[]`.
- `src/components/shared/NModeLayout/NModeCardManager.tsx:67` — picker „+ Nowa karta" czyta `CardCatalogEntry`.

Card-id z `cardSets.ts` są zgodne 1:1 z sekcjami realnie renderowanymi przez ekrany (dowód):

- Decision: `DecisionDetailView.tsx:1220,1225,1230,1234,1236,1241` → `context-problem, options-tradeoffs, risk-impact, consequences, governance-escalation, resources-links` = dokładnie `DECISION_SPEC.catalog`.
- Task: `TaskDetailView.tsx:2172,2178,2184,2190,2196,2202,2208,2214` → `description-scope, implementation, risk-alternatives, checklist, dependencies, evidence, governance, attachments-links` = dokładnie `TASK_SPEC.catalog`.
- Initiative: `src/components/Initiatives/sections/registry.ts` zawiera 24 klucze identyczne z `INITIATIVE_SPEC.catalog` (`overview … reminders`).

Wniosek: id w `cardSets.ts` = to, co user faktycznie widzi i przełącza. **Kod jest prawdą runtime.** Doc §7 to opis z 2026-05-01, który nie nadążył za implementacją (`cardSets.ts` powstał commitem `c2d9d45142` — „system zarządzania kartami").

---

## 1. Rozjazd na poziomie STRUKTURY (nie tylko id)

To nie jest jedna lista, która się rozjechała — to **dwa różne modele danych**:

1. **DOC §7** modeluje kartę jako *generyczny słownik ról pracy*: najpierw katalog uniwersalny (§7.1) + operacyjny (§7.2) ze słownikiem konsultingowym (`outcome`, `acceptance`, `plan`, `recommendation`, `consequences`, `scope/brief`), a potem per-artefakt lista domyślna złożona z tych klocków.
2. **KOD `cardSets.ts`** modeluje kartę jako *sekcję konkretnego ekranu*: id = section-id realnego widoku (`description-scope`, `implementation`, `overview`, `problemDefinition`). Słownik pochodzi z tego, jak zbudowano `*DetailView.tsx`, nie z taksonomii doc.

Dwa dodatkowe rozjazdy strukturalne:

- **Pokrycie typów.** KOD zna 4 typy (`insight | initiative | decision | task` — `cardSets.ts:32`). DOC §7 opisuje 7 rodzin: Task (§7.3), Decision (§7.4), Initiative (§7.5), **Notification (§7.6)**, **Tools (§7.7)**, Interview/Insight (§7.8), **Ideas + Notebook (§7.9)**. Notification, Tools, Ideas, Notebook **nie mają żadnego card-setu w runtime** — ich karty z doc są w 100% martwe względem `cardSets.ts`.
- **Konwencja id.** Initiative w DOC = kebab-case (`financial-analysis`, `risk-raid`, `initiative-scope`); w KODZIE = camelCase (`financialAnalysis`, `raid`, `overview`). Insight/Decision/Task = kebab-case po obu stronach. Sam styl id dowodzi, że listy pisano niezależnie.

---

## 2. Tabela różnic — per typ (§7 vs cardSets.ts catalog)

Legenda: **W OBU** = ten sam `cardId` po obu stronach · **TYLKO DOC** = martwe w kodzie · **TYLKO KOD** = nieopisane w doc.

### 2.1 INSIGHT — DOC §7.8.1 (linie 679–719) vs `INSIGHT_SPEC.catalog` (73–173)

| `cardId` | W OBU | TYLKO DOC (martwe) | TYLKO KOD (nieopisane) | Uwaga |
|---|:--:|:--:|:--:|---|
| `artifact-actions` | ✅ | | | label zgodny |
| `executive-summary` | ✅ | | | |
| `consulting-readout` | ✅ | | | |
| `themes` | ✅ | | | |
| `issues-risks` | ✅ | | | |
| `opportunities` | ✅ | | | label drift: KOD „Opportunity Spaces / Przestrzenie szans" vs DOC „Opportunities / Szanse" |
| `people` | ✅ | | | |
| `signals` | ✅ | | | |
| `analysis-matrix` | ✅ | | | |
| `evidence-map` | ✅ | | | |
| `candidate-triage` | ✅ | | | **label drift krytyczny**: KOD „Findings & Evidence / Wnioski i dowody" (`:150`) vs DOC „Candidate Triage / Triage kandydatów" — inny sens karty |
| `source-pack` | ✅ | | | label drift: KOD „Sources / Źródła" vs DOC „Source Pack / Pakiet źródeł" |
| `comments` | ✅ | | | |
| `activity-log` | ✅ | | | |
| `material-quality` | | ✅ | | **DOC oznacza jako WYMAGANĄ** (§7.8.1 „karta wymagana"; lista required linia 1039). W kodzie NIE ISTNIEJE. |
| `traceability` | | ✅ | | **DOC WYMAGANA** (required linia 1043). Brak w kodzie. |
| `full-analysis` | | ✅ | | opcjonalna w doc (1054) |
| `source-sessions` | | ✅ | | opcjonalna w doc (1057) |
| `consensus-divergence` | | | ✅ | grupa BETWEEN THE LINES (`:126`) |
| `implicit-assumptions` | | | ✅ | (`:131`) |
| `silences` | | | ✅ | (`:137`) |
| `report-pack` | | | ✅ | grupa DELIVERABLES (`:156`) |

Podsumowanie insight: 14 wspólnych, 4 martwe w doc, 4 nieopisane w kodzie, 3 label-drift.

### 2.2 DECISION — DOC §7.4 (linie 567–585) vs `DECISION_SPEC.catalog` (417–467)

| `cardId` | W OBU | TYLKO DOC | TYLKO KOD | Uwaga |
|---|:--:|:--:|:--:|---|
| `context-problem` | ✅ | | | **KOD zwija DOC `decision-scope`+`context-problem` w JEDNO id `context-problem` z labelem „Decision Scope / Zakres decyzji"** (`:419–423`). Semantyczna kolizja. |
| `options-tradeoffs` | ✅ | | | |
| `risk-impact` | ✅ | | | |
| `consequences` | ✅ | | | |
| `comments` | ✅ | | | |
| `activity-log` | ✅ | | | |
| `decision-scope` | | ✅ | | wchłonięte przez `context-problem` (patrz wyżej) |
| `recommendation` | | ✅ | | brak osobnej karty w kodzie |
| `governance` | | ✅ | | KOD ma `governance-escalation` (inne id) |
| `attachments-evidence` | | ✅ | | KOD ma `resources-links` (inne id) |
| `related-context` | | ✅ | | z listy „Opcjonalne" §7.4 |
| `approval-history` | | ✅ | | opcjonalna w doc |
| `ai-decision-brief` | | ✅ | | opcjonalna w doc |
| `dependencies` | | ✅ | | opcjonalna w doc; brak w kodzie decision |
| `governance-escalation` | | | ✅ | (`:444`) — odpowiednik doc `governance`, inny id |
| `resources-links` | | | ✅ | (`:456`) — odpowiednik doc `attachments-evidence`, inny id |

Podsumowanie decision: 6 wspólnych, 8 martwych w doc, 2 nieopisane w kodzie (ale semantycznie = przemianowane pozycje doc).

### 2.3 TASK — DOC §7.3 (linie 545–563) vs `TASK_SPEC.catalog` (495–551)

| `cardId` | W OBU | TYLKO DOC | TYLKO KOD | Uwaga |
|---|:--:|:--:|:--:|---|
| `checklist` | ✅ | | | |
| `dependencies` | ✅ | | | |
| `comments` | ✅ | | | |
| `activity-log` | ✅ | | | |
| `task-brief` | | ✅ | | KOD ma `description-scope` (inne id) |
| `outcome` | | ✅ | | słownik konsultingowy doc; brak w kodzie |
| `acceptance` | | ✅ | | brak w kodzie |
| `plan` | | ✅ | | brak w kodzie |
| `risks` | | ✅ | | KOD ma `risk-alternatives` (inne id) |
| `attachments-evidence` | | ✅ | | KOD ma `attachments-links` (inne id) |
| `governance` (opcj.) | | ✅ | | KOD ma id `governance` też — patrz uwaga* |
| `related-context` (opcj.) | | ✅ | | brak w kodzie |
| `ai-insight` (opcj.) | | ✅ | | brak w kodzie |
| `decisions-blockers` (opcj.) | | ✅ | | brak w kodzie |
| `description-scope` | | | ✅ | (`:497`) — odpowiednik doc `task-brief` |
| `implementation` | | | ✅ | (`:503`) „Pomysły realizacji" — brak w doc |
| `risk-alternatives` | | | ✅ | (`:509`) — odpowiednik doc `risks` |
| `evidence` | | | ✅ | (`:527`) — brak w doc §7.3 |
| `governance` | (✅*) | | | *id zgodne, ale DOC listuje `governance` tylko jako opcjonalne; w kodzie jest w katalogu głównym (`:528`) |
| `attachments-links` | | | ✅ | (`:540`) — odpowiednik doc `attachments-evidence` |

Podsumowanie task: 4 (5 z `governance`) wspólne, ~9 martwych w doc, ~5 nieopisane w kodzie.

### 2.4 INITIATIVE — DOC §7.5 (linie 593–617) vs `INITIATIVE_SPEC.catalog` (229–342)

Największy rozjazd. Wspólne po dokładnym `cardId`: `tasks`, `decisions`, `gates`, `team`, `timeline`, `resources`, `dependencies`, `comments` (8 z ~25/24).

| Grupa | Pozycje |
|---|---|
| **W OBU (dokładny id)** | `tasks`, `decisions`, `gates`, `team`, `timeline`, `resources`, `dependencies`, `comments` |
| **Ten sam sens, INNY id** (drift kebab↔camel/skrót) | DOC `kpi` ↔ KOD `kpis` · DOC `risk-raid` ↔ KOD `raid` · DOC `financial-analysis` ↔ KOD `financialAnalysis` · DOC `financial-impact` ↔ KOD `financialImpact` · DOC `attachments-evidence` ↔ KOD `attachments` · DOC `initiative-scope` ↔ KOD `overview`/`scope`(?) |
| **TYLKO DOC (martwe)** | `success-criteria`, `technical-spec`, `benefits`, `quality-acceptance`, `communications`, `procurement-vendors`, `assumptions-constraints`, `closure-handover`, `governance`, `milestones` (KOD łączy w `tasks` = „Tasks & Milestones") |
| **TYLKO KOD (nieopisane w §7.5)** | `problemDefinition`, `targetState`, `competencyRequirements`, `skillsGap`, `pilot`, `history`, `control` (core), `stakeholders`, `tags`, `reminders` |

Dowód id kodu: `INITIATIVE_SPEC.catalog` linie 231–341; potwierdzenie runtime: `src/components/Initiatives/sections/registry.ts` (24 klucze zgodne).

### 2.5 Katalog GENERYCZNY DOC §7.1/§7.2 — status: w większości MARTWY

DOC §7.1 (uniwersalne) i §7.2 (operacyjne) definiują 26 „klocków" ze słownikiem konsultingowym. Konfrontacja z jakimkolwiek `*_SPEC.catalog`:

- **Żyją jako dokładny id gdzieś w kodzie**: `comments`, `activity-log`, `dependencies`, `kpi`(→`kpis`), `governance`(częściowo). 
- **Martwe (żaden `cardId` w `cardSets.ts`)**: `scope`, `properties`, `related-context`, `attachments-evidence`, `ai-insight`, `risks`, `checklist`(żyje tylko w task), `quality-readiness`, `outcome`, `acceptance`, `plan`, `options-tradeoffs`(żyje tylko w decision), `recommendation`, `consequences`(żyje tylko w decision), `timeline`(żyje w initiative), `milestones`, `resources`(żyje w initiative), `team`(żyje w initiative), `financial-analysis`, `benefits`, `technical-spec`.

Wniosek: §7.1/§7.2 jako „wspólny słownik uniwersalny" **nie został zaimplementowany** — kod nie dzieli kart między typami po wspólnym id; każdy `*_SPEC` ma własny, niezależny katalog.

---

## 3. Werdykt per pozycja: KOD czy DOC = prawda

Zasada nadrzędna: **kod = żywy runtime = prawda**, o ile nie ma dowodu, że doc opisuje świadomy, wymagany element produktu, którego brak w kodzie jest luką (nie wygraną doc).

| Kategoria | Werdykt | Działanie |
|---|---|---|
| Pozycje **W OBU** (zgodny id) | KOD = prawda; doc zgodny | Zostaw; przy migracji do SSOT przepisz label z kodu (kod ma finalne label PL/EN). |
| **Label drift** (`candidate-triage`, `source-pack`, `opportunities`, `context-problem`) | KOD = prawda (to, co user widzi) | Uśmierć w doc stare label; ale ODNOTUJ jako **wejście do kontraktu** — „Findings & Evidence" vs „Triage kandydatów" to różnica SENSU, nie tylko słowa (decyzja Piotra: czy to jedna karta czy dwie). |
| **TYLKO KOD** (`implementation`, `evidence`, `consensus-divergence`, `implicit-assumptions`, `silences`, `report-pack`, `problemDefinition`, `targetState`, `competencyRequirements`, `skillsGap`, `pilot`, `control`, `stakeholders`, `tags`, `reminders`, `history`) | KOD = prawda | **Dopisz do taksonomii** (obecnie nieopisane — łamią §8/§9 „każda karta musi mieć opis"). |
| **TYLKO DOC — z listy WYMAGANYCH** (`material-quality`, `traceability`) | ⚠️ NIEROZSTRZYGNIĘTE | Doc twierdzi „wymagana", kod ich nie ma. To **nie** jest zwykłe „uśmierć doc" — to albo luka implementacji, albo doc się przeterminował. **Wejście do kontraktu — decyzja Piotra.** |
| **TYLKO DOC — opcjonalne/generyczne** (`outcome`, `acceptance`, `plan`, `task-brief`, `decision-scope`, `recommendation`, `success-criteria`, `technical-spec`, `benefits`, `quality-acceptance`, `communications`, `procurement-vendors`, `assumptions-constraints`, `closure-handover`, `related-context`, `ai-insight`, `approval-history`, `ai-decision-brief`, `decisions-blockers`, całe §7.1/§7.2 nieżyjące, całe §7.6 Notification, §7.7 Tools, §7.9 Ideas/Notebook) | KOD = prawda → **uśmierć w doc** | Oznacz jako „nigdy nie zaimplementowane / historyczny plan". Wyjątek: jeśli Piotr chce którąś kartę → wejście do kontraktu jako backlog, nie jako obowiązujący standard. |
| **Drift id, ten sam sens** (`kpi`/`kpis`, `risk-raid`/`raid`, `financial-analysis`/`financialAnalysis`, `attachments-evidence`/`attachments`, `governance`/`governance-escalation`, `task-brief`/`description-scope`, `risks`/`risk-alternatives`) | KOD = prawda (id kodu jest tym, po czym woła runtime) | Uśmierć wariant doc; kontrakt przyjmuje id z kodu jako kanoniczny. |

---

## 4. Rekomendacja

**Nie uzgadniać `n-mode-card-standard.md` z kodem in-place.** Powody:

1. Doc to model *generyczny słownik*, kod to model *sekcja ekranu* — to nie rozjazd wartości, tylko dwa różne paradygmaty. Sklejanie ich edycjami wprowadzi trzeci hybrydowy słownik.
2. Doc §7.8.x rozrósł się w pełny Artifact Standard dla Interview Insight (linie 747–1527) — wartościowy, ale to inny gatunek treści niż „katalog id kart".
3. `cardSets.ts` jest już egzekwowanym runtime; każda karta produktu MUSI mieć tam id — więc SSOT id-kart z natury jest kodem, nie markdownem.

**Proponowana ścieżka (do zatwierdzenia w `_KONTRAKT_KARTY_SSOT`):**

1. **`n-mode-card-standard.md` → oznaczyć jako HISTORIĘ/DESIGN-NOTE** (nagłówek: „Status: HISTORYCZNY. SSOT taksonomii kart przeniesiony do `_KONTRAKT_KARTY_SSOT` + `cardSets.ts`. Ten dokument zachowuje intencję projektową z 2026-05-01 i pełny Artifact Standard dla Interview Insight."). Nie kasować — §7.8.x i §2–§6 (właściwości/workflow/AI/DoD) to nadal cenny opis anatomii.
2. **Taksonomię id-kart przenieść do `_KONTRAKT_KARTY_SSOT`**, gdzie żywym źródłem id jest `cardSets.ts`, a kontrakt dokłada tylko to, czego kod nie niesie: klasyfikację `default/optional/required` per typ (dziś w kodzie jest tylko `core:true` na nielicznych — `artifact-actions`, `executive-summary`, `overview`, `control`, `context-problem`, `description-scope`), oraz label PL/EN jako read-back z kodu.
3. **Tabela z §2 tego dokumentu = załącznik startowy kontraktu** (lista „TYLKO KOD → dopisać opis", „TYLKO DOC → uśmiercić/backlog", „drift id → przyjąć id kodu").

---

## 5. Wejście do `_KONTRAKT_KARTY_SSOT` (decyzje dla Piotra — NIE rozstrzygam)

1. **`material-quality` i `traceability`**: doc oznacza WYMAGANE, kodu brak. Zbudować (luka) czy skreślić (przeterminowany plan)? Wymaga decyzji.
2. **`candidate-triage` label**: kod mówi „Findings & Evidence / Wnioski i dowody", doc „Triage kandydatów". Czy to jedna karta (findingi+kandydaci razem), czy doc chciał dwie osobne? Decyzja o sensie karty.
3. **Klasyfikacja `default/optional/required`** per karta per typ: kod niesie tylko `core:true` (nieusuwalna) na kilku; pełnej trójki `default/optional/required` z §6.1/§7 doc **kod nie egzekwuje**. Progi „która karta domyślna" = decyzja produktowa Piotra (audyt to jawnie oddaje).
4. **Typy bez card-setu**: Notification, Tools, Ideas, Notebook mają karty w doc (§7.6/§7.7/§7.9), zero w `cardSets.ts` (`NModeArtifactType` = tylko 4). Czy te typy mają dostać card-management, czy karty doc to plan-który-nie-wszedł? Decyzja o zakresie.
5. **Initiative — słownik kebab vs camel**: kontrakt przyjmuje id kodu (`financialAnalysis`, `raid`, `kpis`) jako kanoniczne — potwierdzić, bo doc §7.5 sugeruje inaczej i to widoczne w każdym przyszłym mapowaniu.
