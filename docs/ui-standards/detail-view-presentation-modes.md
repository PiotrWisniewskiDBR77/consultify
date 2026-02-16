# Detail View Presentation Modes (D / N / C)

> **Status:** KANON (obowiązujący)  
> **Cel:** 3 równorzędne sposoby prezentacji _tej samej encji_ w detail view, przy **stałym nagłówku** i spójnym workflow.  
> **Zakres:** Initiative / Task / Decision / Notification (wszystkie “narzędzia” pracy).

> **Spójność wizualna (MUST):** wszystkie 3 tryby muszą trzymać się DBR77 Visual Language:
>
> - `docs/00_foundation/COLOR_SYSTEM_STANDARD.md`
> - `docs/00_foundation/DBR77_VISUAL_LANGUAGE_STANDARD.md`
> - tokeny w kodzie: `tailwind.config.js`, `src/index.css`

---

## 0) Niezmienne zasady (MUST)

### 0.1 Stały nagłówek (Header) — identyczny w każdym trybie

Każdy detail view (Initiative/Task/Decision/Notification) MUSI mieć ten sam nagłówek, a zmienia się wyłącznie prezentacja treści poniżej.

**Wymóg:**

- Nagłówek jest **sticky**.
- Nagłówek zawiera:
  - **Tytuł encji** + (opcjonalnie) breadcrumb/moduł.
  - **Primary actions** (np. Save/Mark Read) + **Chat**.
  - **Toggle trybu prezentacji**: 3 przyciski **pomiędzy Chat a AI**, wybierające:
    - `D` (D presentation mode)
    - `N` (N presentation mode)
    - `C` (C presentation mode)
  - (Opcjonalnie) **AI button** (jeśli w danym ekranie występuje).
- Zmiana trybu:
  - NIE zmienia encji,
  - NIE resetuje draftu,
  - NIE zmienia kontekstu czatu,
  - NIE zmienia uprawnień ani gate’ów,
  - zachowuje scroll/anchor (o ile możliwe).

### 0.2 Te same dane, różny render

Tryby prezentacji są **różnymi renderami tych samych sekcji**. To nie są różne “feature sety”.

### 0.3 i18n i offline draft

- Teksty są przez i18n (PL/EN) tam, gdzie obszar jest objęty tłumaczeniami.
- Widoki edycyjne z draftami (np. Task/Decision) zachowują dotychczasowy standard offline draft.

---

## 0.4 Kontrakty wspólne (naming, persystencja, URL) — implementation-ready

### 0.4.1 Enum trybu prezentacji

**MUST:**

- Tryby prezentacji są reprezentowane przez stabilne wartości (niezależne od języka):

```ts
type PresentationMode = 'd' | 'n' | 'c';
```

### 0.4.2 Priorytet źródeł wyboru trybu

**MUST:** tryb w danym momencie jest wybrany w tej kolejności:

1. **URL override** (np. `?view=n` lub hash/route state) — jeśli obecny
2. **Preferencja użytkownika** (persisted)
3. **Fallback**: `d`

### 0.4.3 Persystencja preferencji

**MUST:**

- Preferencja jest per użytkownik i per encja:
  - `presentationMode.task`
  - `presentationMode.decision`
  - `presentationMode.notification`
  - `presentationMode.initiative`

**SHOULD:**

- Preferencja jest zapisywana również server-side (user settings) — aby działała cross-device.
- Jeśli server-side nie jest gotowe, użyć localStorage jako fallback.

### 0.4.4 URL schema (deep links)

**MUST:**

- Sekcje N mode: `#sectionId` (anchor).
- Opcjonalny query param:
  - `?view=d|n|c`
- Jeśli system wspiera dynamic tabs:
  - przełączenie trybu nie tworzy nowej zakładki; to jest stan tej samej zakładki.

---

## 1) Tryby prezentacji

### 1.1 `D` (D presentation mode: obecny standard DBR77)

- Układ **2/3 + 1/3** (“chat-compatible”).
- Sekcje jako **zwijane karty**.
- Prawa kolumna: **Control / metadane / akcje** (sticky).

> Ten tryb (D) jest referencyjną bazą, z której mapujemy treści do N/C.

### 1.1.1 D mode (D presentation mode) — “summary-first + smart open” (MUST)

Problem obecnego UX: użytkownik widzi listę nagłówków sekcji i musi “przeklikać” się do sensu ekranu.
W D mode nie zmieniamy wizualnego stylu DBR77, ale zmieniamy **strategię domyślnych stanów**:

- z `collapsed-first` → na `summary-first + smart open`.

**Cel:** po wejściu w detail view użytkownik w max 5–10 sekund rozumie:

- co to jest za obiekt,
- jaki jest stan (blocked/overdue/pending),
- co jest “next action”,
- gdzie kliknąć, żeby wykonać pracę.

#### 1.1.1.1 Zasady ogólne (MUST)

- **Above-the-fold** (bez scrollowania) musi zawsze zawierać:
  - 1. “Executive / Next action” (callout),
  - 2. 2–4 sekcje **otwarte** (zależnie od encji + stanu),
  - 3. Control (prawa kolumna) jest **domyślnie otwarta**.
- **Zamknięta sekcja nie może być “pusta”**:
  - w nagłówku pokazuje `count` i/lub krótki `preview` (1–3 linie) (patrz 1.1.1.4).
- **State-driven UX**:
  - jeśli encja jest `BLOCKED/OVERDUE/PENDING/ESCALATED`, otwieramy sekcje, które wyjaśniają stan i prowadzą do akcji.
- **Persisted sections state**:
  - jeśli user otworzył/zamknął sekcje, stan jest zapamiętany (patrz 1.1.1.5) i ma priorytet nad defaultem.

#### 1.1.1.2 Domyślnie otwarte sekcje — Task (MUST)

**Domyślnie otwarte (zawsze):**

- `Task description`
- `Expected Outcome` + `Evidence & Acceptance` (jako jedna “Outcome & Acceptance” grupa, jeśli istnieje w UI)
- `Checklist` (w trybie compact, jeśli długa)
- (Prawa kolumna) `Control`

**Smart open (jeśli warunek spełniony):**

- `Dependencies / Linked Items`:
  - gdy `status=blocked` **lub** istnieją zależności **lub** `blockedReason` niepuste
- `Related Decisions`:
  - gdy istnieje decision “blocking” (np. `blockedByDecisionId` lub relacja typu `blocking`)
- `Risk Analysis / Alternatives`:
  - gdy `priority=high|critical` lub “risk posture” wskazuje podwyższone ryzyko
- `Evidence & Acceptance`:
  - gdy `requiresAcceptance=true` **lub** status `review|done`

**Domyślnie zamknięte (ale z preview):**

- `Implementation ideas`
- `Comments`
- `Activity Log`

#### 1.1.1.3 Domyślnie otwarte sekcje — Decision (MUST)

**Domyślnie otwarte (zawsze):**

- `Problem description / context`
- “Recommendation” + **Consequences of Inaction** (callout zawsze widoczny w `overview` tej sekcji)
- `Alternatives` / `Options` (w wersji skróconej, 2–3 top wiersze + “Show all”)
- (Prawa kolumna) `Control` + primary CTA (Approve/Reject/Delegate/Request info)

**Smart open (jeśli warunek spełniony):**

- `Stakeholders (RACI)` / `Escalation & Reminders`:
  - gdy status `pending|escalated|deferred` albo gdy istnieje escalation level > 0
- `Linked Items`:
  - gdy decision “blocks X” (ma powiązania blokujące)
- `Risk Analysis`:
  - gdy `impact` wysoki lub decyzja “high priority”

**Domyślnie zamknięte (ale z preview):**

- `Comments`
- `Activity Log`
- `Attachments`

#### 1.1.1.4 Domyślnie otwarte sekcje — Notification (MUST)

**Domyślnie otwarte (zawsze):**

- `What's Happening` (4-line contract)
- `Expected Action` (checklista + primary CTA)
- `AI Analysis / AI Insight` (compact; pełna analiza po expand)
- (Prawa kolumna) `Control`

**Smart open (jeśli warunek spełniony):**

- `Related Items / Context`:
  - gdy brak powiązanego obiektu (user musi zrozumieć “source”), albo gdy notyfikacja jest typu wymagającego kontekstu

**Domyślnie zamknięte (ale z preview):**

- `Activity Log`
- `Comments` (jeśli włączone)

#### 1.1.1.5 Domyślnie otwarte sekcje — Initiative (MUST)

**Domyślnie otwarte (zawsze):**

- `Executive Summary / Charter` (w praktyce: pierwsza sekcja merytoryczna)
- `Gate Readiness & Timeline` (lub sekcja readiness, jeśli występuje)
- `Tasks & Milestones` (kompakt: top 5 + CTA “Open full plan”)
- (Prawa kolumna) `Control`

**Smart open (jeśli warunek spełniony):**

- `Team`:
  - gdy brakuje `Owner` lub `Sponsor` (bo blokuje gates)
- `Decisions`:
  - gdy są `pending/escalated` decisions albo gate wymaga decyzji
- `RAID Log`:
  - gdy są elementy `critical/high` albo “at risk” callout
- `Economics / Finance & Risk`:
  - gdy jesteśmy w fazie, gdzie economics jest wymagane (investment gate) albo brakuje kluczowych pól

**Domyślnie zamknięte (ale z preview):**

- `Timeline` (jeśli osobno)
- `Resources`
- `Stakeholders (RACI)`
- `Attachments`
- `History / Activity`

#### 1.1.1.6 Preview w zamkniętych sekcjach (MUST)

Każda zamknięta sekcja pokazuje w nagłówku:

- `count` (jeśli dotyczy: checklist items, comments, attachments, linked items),
- `preview` (1–3 linie), np.:
  - Task/Decision: pierwsze zdanie opisu lub “top 1 blocker”
  - Notification: primary CTA label lub “next step 1/3”
  - Initiative: “Pending decisions: 2”, “RAID critical: 1”

**MUST:** preview nie może powodować layout shift; ma stałą wysokość (np. 1–2 linie z ellipsis).

#### 1.1.1.7 Controls: Expand/Collapse All + pamięć stanu (SHOULD)

**SHOULD:**

- Na górze lewej kolumny dodajemy:
  - `Expand all`
  - `Collapse all`
- Pamiętamy “expandedSections” per użytkownik i per encja:
  - key (przykład): `consultinity:accordionSections:<entityType>:<entityId>`
  - value: lista `sectionIds[]`
- Priorytet:
  1. persisted state (jeśli istnieje),
  2. smart-open rules,
  3. default open set.

### 1.2 `N` (N presentation mode: page-first)

**Intencja:** maksymalna czytelność i logika “dokumentu”, gdzie properties są “na górze”, a reszta to treść strony.

**Układ:**

- **Lewy panel**: nawigacja po blokach (8–10 pozycji, logiczne grupy).
- **Prawa część**: treść strony (bez “ramkowych”, zwijanych paneli po prawej).
- **Properties strip** (pod nagłówkiem, full-width lub w treści nad pierwszą sekcją):
  - status / owner / due / priority / tags / relacje
  - inline edit
- (Opcjonalnie) wąski rail: spis treści / quick links / activity preview.

**Zasada kluczowa:** w N mode NIE prezentujemy “Control / Team / Timeline…” jako osobnych kart w prawej kolumnie. To mają być **properties** + logiczne bloki w treści.

### 1.2.1 Motion & microinteractions (N feel w DBR77) (SHOULD)

Źródło tokenów motion: `docs/00_foundation/DBR77_VISUAL_LANGUAGE_STANDARD.md` (sekcja 9).

**SHOULD (N mode):**

- **Left nav active state**:
  - aktywny blok ma subtelne tło + 1px border accent,
  - przejście 160–220ms (bez “skakania” layoutu).
- **Anchor scroll polish**:
  - klik w lewym nav scrolluje do bloku płynnie,
  - po scrollu blok dostaje krótkie “focus highlight” (subtelny outline/surface na 600–900ms).
- **Block reveal**:
  - przy wejściu w widok: treść pojawia się w 2–3 grupach (opacity + minimalne y \(2–4px\)),
  - bez dużych animacji „fly-in”.
- **Embedded views loading**:
  - skeleton w stylu Apple HIG,
  - brak layout shift (stałe placeholder heights dla tabel/board).

**MUST (A11y):**

- `prefers-reduced-motion`: wyłącz smooth scroll i reveal (jump + natychmiastowe stany).

### 1.3 `C` (C presentation mode: action-first)

**Intencja:** praca operacyjna i szybkie throughput.

**Układ:**

- **Command bar** pod headerem: status/gate, owner, due, priority/severity, quick actions.
- **Taby** w detail:
  - `Overview`, `Comments`, `Activity`, `Links`, `Files`
  - - taby specyficzne per encja (Checklist/Options/RAID/Timeline itp.)
- (Opcjonalnie, docelowo) **3-pane**:
  - lista po lewej (kontekst bieżącego filtra),
  - detail w środku,
  - pola/metadane po prawej (inline edit).

---

## 2) N mode — kanoniczne bloki nawigacji (8–10)

Poniższy podział jest kanoniczny dla N mode i ma zastąpić “przypadkowe” grupowanie sekcji.  
Wszystkie istniejące elementy z aplikacji muszą być mapowane do jednego z bloków (nic nie znika).

### 2.1 Initiative — 10 bloków (Strategic PMO Gold Standard)

1. **Executive Summary**  
   Cel 1 zdanie, status, health, owners, priorytet, ryzyko, kluczowe fakty.

2. **Problem & Context**  
   Problem definition, kontekst, ograniczenia, “dlaczego teraz”.

3. **Target State & Success Criteria**  
   Kryteria sukcesu, KPI, definicja sukcesu / DoD.

4. **Scope & Kill Criteria**  
   Scope / out-of-scope, kill criteria, założenia krytyczne.

5. **Delivery Plan (Tasks & Milestones)**  
   Embedded view: taski, milestones, zależności w planie (table/board/timeline).

6. **Governance (Gates & Readiness)**  
   Gate readiness, wymagane artefakty, następna bramka, reguły przejść.

7. **Org & Stakeholders (Team + RACI)**  
   Team, stakeholders, RACI, sponsorzy, role decyzyjne.

8. **Timeline, Resources & Capacity**  
   Timeline, zasoby, capacity, ograniczenia wykonawcze.

9. **Economics / Finance & Risk Posture**  
   Finance, ROI/value, risk posture inicjatywy.

10. **RAID + Dependencies + Evidence & Audit**  
    RAID log, dependencies, attachments, activity/audit trail.

### 2.2 Task — 8 bloków (Unit of Change)

1. **Task Brief (Definition)** — opis zadania
2. **Outcome & Acceptance** — expected outcome + evidence/acceptance
3. **Plan & Implementation** — implementation ideas / podejście
4. **Checklist / Subtasks** — checklista
5. **Dependencies & Linked Items** — zależności, powiązania, załączniki
6. **Risks & Alternatives** — risk analysis + alternatives
7. **Decisions & Blockers** — related decisions + reminders/escalation (jeśli występuje)
8. **Collaboration & Audit** — comments + activity log + tagi (jeśli nie w properties)

### 2.3 Decision — 8 bloków (End Uncertainty)

1. **Decision Brief** — tytuł + co rozstrzygamy + status
2. **Context & Problem**
3. **Options & Trade-offs** — alternatywy jako porównywalna tabela
4. **Risk & Impact**
5. **Recommendation**
6. **Consequences of Inaction (must-have)** — osobny, wyeksponowany blok
7. **Stakeholders, Delegation & Escalation** — RACI, delegate, reminders
8. **Collaboration & Audit** — comments, attachments, activity, tags, linked items

### 2.4 Notification — 6–7 bloków (System presji, nie feed)

1. **Signal Contract (4-line)** — what/why/blocked
2. **Expected Action (CTA + checklist)**
3. **AI Insight**
4. **Context & Source** — related items + go to source
5. **Recipients & Why You Got It**
6. **Control & Triage** — snooze/mute/delete/mark read
7. **Audit** — activity ( + comments jeśli włączone)

---

## 2.5 N mode — UI execution spec (tech-sexy, czytelne, “N-style” w naszej estetyce)

Poniższa specyfikacja opisuje _jak ma wyglądać_ N mode w Consultify, z zachowaniem:

- naszej kolorystyki (navy + purple accents),
- naszych czcionek,
- naszych kształtów (rounded-xl / rounded-2xl),
- i jakości enterprise SaaS (a11y, performance, spójność, bez wizualnego “bałaganu”).

### 2.5.1 Układ (layout) — 2-pane + opcjonalny mini-rail

**MUST (2-pane):**

- **Left navigation rail** (stała szerokość): nawigacja po blokach + wyszukiwarka sekcji.
- **Page canvas** (prawa część): treść strony i embedded views.

**SHOULD (mini-rail):**

- Wąski prawy rail (opcjonalny): TOC / quick links / “jump to” / ostatnia aktywność.

**Zasada N-style:** canvas jest “page-first” — nie budujemy wrażenia “dashboardu z kartami”.

### 2.5.2 Left navigation rail — standard

**MUST:**

- Nagłówek “Contents” + pole `Search sections…`.
- Lista bloków (8–10) z:
  - ikoną (Lucide),
  - label,
  - licznikiem (jeśli w bloku są elementy, np. RAID=5),
  - aktywnym stanem (accent purple),
  - przewijaniem niezależnym od canvas.
- Klik w blok:
  - scrolluje canvas do odpowiedniego anchor (deep-link),
  - aktualizuje URL hash (np. `#governance`), jeśli tryb i router na to pozwalają.

**SHOULD:**

- Sekcje mogą być pogrupowane w 2–4 “folders” (np. Core / Governance / Value / Meta), ale **nigdy nie kosztem logiki bloków**.
- Klawisze:
  - `⌘K` / `Ctrl+K`: “Jump to section…”
  - `⌘F` / `Ctrl+F`: wyszukaj w treści (browser)

### 2.5.3 Page canvas — typografia i “quiet UI”

W N mode największą robotę robi typografia i whitespace, nie ramki.

**MUST:**

- Canvas ma max-width (czytelność) i stabilny rytm:
  - duży tytuł jest w headerze,
  - sekcje w canvas zaczynają się od H2.
- Sekcje są **block-first**:
  - nagłówek + krótki opis (jeśli potrzebny),
  - treść (tekst/tabela/checklista),
  - embedded views.

**SHOULD:**

- Minimalna liczba “kart”. Jeśli coś musi być wydzielone:
  - używamy naszej estetyki “glass” (jak w Golden Standard), ale subtelnie:
    - mniej cienia,
    - cień i border niższy kontrast,
    - większy padding.
- Dla treści strategicznej (np. Consequences of Inaction) używamy calloutów.

### 2.5.4 Properties strip — standard (zamiast prawej kolumny “Control cards”)

Properties w N mode są odpowiednikiem “Control” z D mode, ale bez ramek i dropdownów jako osobnych kart.

**MUST:**

- Properties są widoczne **zawsze na górze strony** (pod headerem).
- Układ: grid 2–4 kolumny (responsywnie).
- Edycja inline (tam gdzie to możliwe) + jasny stan “dirty/unsaved”:
  - delikatny marker przy polu,
  - a globalny `Save` nadal w headerze (jak w Golden Standard).

**SHOULD:**

- Puste wartości pokazują placeholder (szary), nie `—`.
- Walidacje pól pokazują się inline, bez modalnego “krzyku”.

### 2.5.5 N blocks kit — wspólny zestaw komponentów (MUST)

Każdy N mode powinien korzystać z tych samych “bloków” UI, żeby zachować spójność i premium feel:

- `PageSection` — H2 + anchor + optional description + optional count
- `PropertyGrid` — pasek properties (inline edit)
- `Callout` — (info/warning/critical) w naszej palecie
- `ToggleBlock` — opcjonalne chowanie rzadkich treści (domyślnie expanded dla kluczowych)
- `EmbeddedView` — wbudowane listy/tabele (Tasks/Decisions/RAID/Attachments)
- `InlineTable` — małe tabele (np. options, KPIs)
- `ChecklistBlock` — checklista + progress
- `ActivityStream` — log aktywności (z minimalnym UI)
- `EmptyStateInline` — puste stany w obrębie sekcji (z CTA)
- `CommentsCanvas` — wątek komentarzy (shared, §2.5.5.1)
- `ActivityLogCanvas` — log aktywności (shared, §2.5.5.1)
- `AttachmentsLinksCanvas` — załączniki + linked items (shared, §2.5.5.1)
- `RiskCanvas` — rejestr ryzyk z score P×I (shared, §2.5.5.1)
- `GovernanceCanvas` — RACI macierz + reminders + escalation rules (shared, §2.5.5.1)

> **Współdzielone sekcje N-mode (`NModeSections/`):** sekcje powtarzające się w 2+ artefaktach MUSZĄ korzystać z komponentów w `src/components/shared/NModeSections/`. NIGDY nie kopiuj kodu sekcji inline. Pełna specyfikacja: `docs/ui-standards/shared-nmode-sections-standard.md`.

> Wizualnie: te bloki używają naszych tokenów (`rounded-2xl`, `dark:bg-navy-900/..`, purple accents), ale zachowują “quiet UI” charakterystyczny dla N mode.

### 2.5.6 Embedded views (linked databases) — standard (to robi system “operacyjny”, nie tylko dokumentowy)

**MUST:**

- Relacje (Tasks/Decisions/RAID/Attachments/Linked items) pokazujemy jako **embedded view**, nie jako lista linków.
- Embedded view ma:
  - mini toolbar: view type (table/board/timeline), filter, sort,
  - `+ Add` / `Link existing`,
  - “Open full” (przejście do pełnego modułu).

**SHOULD:**

- Embedded view domyślnie pokazuje **najbardziej operacyjne pola** (owner/status/due/priority/blocks/next action).

### 2.5.7 A11y, performance, enterprise polish

**MUST:**

- Focus ring widoczny w dark mode.
- Kontrast tekstu w canvas wyższy niż w card-heavy trybach.
- Sekcje z dużą liczbą elementów (np. RAID 200) wymagają:
  - paginacji lub virtualizacji,
  - stabilnych skeletonów (bez layout shift).

**SHOULD:**

- Copy link to section (anchor).
- “Expand all / Collapse non-core” (opcjonalnie).

---

## 3) Mapping rule: z istniejących sekcji do bloków

Każdy istniejący element w aplikacji MUSI zostać przypisany do jednego z bloków N mode:

- Jeśli element jest **sterowaniem / metadanymi** (status, owner, due, priority, tags, relacje) → trafia do **Properties**.
- Jeśli element jest **merytoryką** (opis, kontekst, kryteria, analiza) → trafia do treści bloku.
- Jeśli element jest **relacją** (linked tasks/decisions/attachments) → preferuj **embedded view** (tabela/board) w bloku, a nie “lista linków”.

---

## 3.1 N mode — kanoniczne Properties i embedded views (4 narzędzia)

Poniżej minimalny, kanoniczny zestaw properties i embedded views dla każdej encji w N mode.  
To jest “enterprise PMO advantage”: szybkie sterowanie na górze + operacyjne relacje jako embedded views.

> Uwaga: to jest _layout/UX spec_. Konkretne nazwy pól wynikają z API/typów encji i i18n.

### 3.1.1 Initiative

**Properties (MUST):**

- Status (kanoniczny)
- Priority (CRITICAL/HIGH/MEDIUM/LOW)
- Owners: Business Owner + Execution Owner
- Dates: planned start / planned end (lub start/end, zależnie od fazy)
- Health/Risk (syntetyczne)
- Tags

**Embedded views (MUST):**

- Tasks (table/board/timeline)
- Decisions (table)
- RAID log (table)

**Embedded views (SHOULD):**

- Dependencies (graph/list)
- Attachments

### 3.1.2 Task

**Properties (MUST):**

- Status (TODO/IN_PROGRESS/BLOCKED/DONE)
- Priority
- Owner + Assignee
- Due date (+ start date, jeśli występuje)
- Initiative (relacja)
- Tags

**Embedded views (MUST):**

- Checklist / Subtasks (block)
- Dependencies (list/graph)
- Related Decisions (table)
- Attachments (list)

### 3.1.3 Decision

**Properties (MUST):**

- Status
- Decider
- Deadline (decision due)
- Escalation level (jeśli dotyczy)
- Tags

**Embedded views (MUST):**

- Options (inline table)
- Blocks / Linked items (np. taski/inicjatywy, które blokuje) — table
- Attachments (list)

### 3.1.4 Notification

**Properties (MUST):**

- Severity (INFO/WARNING/CRITICAL)
- Type
- Category
- Created at
- Related entity (type + id)
- Read state

**Embedded views (MUST):**

- Expected action checklist (block)
- Related items (mini list/table)

**Embedded views (SHOULD):**

- Why you got it (callout)
- Activity stream (block)

---

## 3.2 N mode — implementation-ready spec (kontrakty, tokeny, zachowania)

Ta sekcja jest pisana tak, aby implementacja była możliwa bez “domysłów”.

### 3.2.1 Design tokens (layout/spacing/typografia) — zgodne z naszą estetyką

**Zasada:** N-style = “quiet UI”, ale w naszych kolorach/fontach/kształtach.

**Layout tokens (MUST):**

- **Nav rail width**: stała (desktop), responsywnie zwijana (mobile).
  - Desktop: ~280–320px (w zależności od istniejącego sidebaru i przestrzeni).
  - Mobile: nav jako drawer / overlay.
- **Canvas max width**: czytelność w enterprise tekstach:
  - max: ~960–1120px (content), z bocznym marginesem (gutter).
- **Gutter**:
  - odległość nav↔canvas: 16–24px
  - padding canvas: 24px (desktop), 16px (tablet), 12px (mobile)
- **Section rhythm**:
  - odstęp między sekcjami: 20–28px
  - odstęp H2 → content: 10–14px

**Shapes (MUST):**

- Zostajemy przy `rounded-xl` / `rounded-2xl`.
- Jeśli element jest “block” (Callout / EmbeddedView), preferuj `rounded-2xl`.

**Typografia (MUST):**

- H2 w canvas = “sekcja” (czytelna, enterprise):
  - font-weight: semibold/bold
  - rozmiar: 16–18px (nie jak blog, bardziej jak narzędzie)
- Treść tekstowa:
  - 13–14px, line-height podwyższony (czytelność w dark)
- Label properties:
  - 11–12px uppercase/tracking minimalny, ale bez “krzyku”.

**Kolory (MUST):**

- Tło: używa obecnego navy/dark tła aplikacji.
- Akcent: purple (active state, focus, selected item).
- Separatory: bardzo subtelne (border o niskiej alfy).

### 3.2.2 Struktura strony (DOM / layout skeleton)

**N mode page skeleton (MUST):**

- `Header` (stały, wspólny dla 3 trybów)
- `PropertiesStrip` (pod headerem)
- `ActionBar` (primary actions + AI context actions)
- `Body` jako układ:
  - `LeftNav` (sections)
  - `Canvas` (sections content)
  - `MiniRail` (opcjonalnie)

**Vertical spacing standard (MUST):**

Oddech między warstwami jest krytyczny dla czytelności. Poniższe reguły są obowiązujące:

- Root container N mode: `space-y-4` — zapewnia 1rem gap między PropertiesStrip → ActionBar → Body (2-Pane).
- ActionBar:
  - Container: `px-4 py-3 rounded-2xl` z glass background (`bg-white/80 dark:bg-navy-900/80 backdrop-blur-xl`).
  - **Zakazane** ujemne marginy (`-mt-*`) — niszczą oddech między sekcjami.
  - Przyciski akcji (Approve, Reject, etc.) siedzą bezpośrednio w kontenerze — bez dodatkowych `mt-*`, `pt-*`, `border-t` wrapperów.
  - AI buttons sekcyjne używają `ml-auto` by dociągnąć w prawo.
- Canvas area: `pl-6 pt-1` — lewy gutter + mały top padding, żeby nagłówki sekcji nie były przyklejone do górnej krawędzi.
- LeftNav sidebar: sticky container z `pt-1` aby wyrównać się pionowo z początkiem Canvas.
- Tab items w LeftNav: `py-2.5 px-3` dla komfortowych klikanych celów.

**Scroll behavior (MUST):**

- Scroll kontentu odbywa się w jednym kontenerze (żeby anchor scroll był deterministyczny).
- LeftNav ma własny scroll (lista sekcji), ale nie wpływa na anchor scroll.

### 3.2.3 Anchor routing i deep-linking sekcji

**MUST:**

- Każdy blok ma `sectionId` (kebab-case), np.:
  - `executive-summary`
  - `problem-context`
  - `target-success`
  - `raid`
  - `governance`
- Klik w LeftNav:
  - scrolluje do anchor,
  - ustawia URL hash `#sectionId` (jeśli router wspiera),
  - podświetla active section w nav.

**SHOULD:**

- Przy scrollu canvas active section aktualizuje się automatycznie (IntersectionObserver).
- “Copy link to section” kopiuje pełny URL z `#sectionId`.

### 3.2.4 PropertiesStrip — kontrakt i zachowania

**Cel:** zastąpić “prawą kolumnę control cards” w N mode.

**MUST:**

- Properties są edytowalne inline (tam gdzie to ma sens).
- Properties pokazują:
  - aktualną wartość,
  - placeholder (gdy puste),
  - walidację (inline),
  - “dirty state” (jeśli zmienione lokalnie, a nie zapisane).
- Globalny `Save` w headerze zapisuje cały draft/zmiany.

**Draft/unsaved rules (MUST):**

- N mode nie może “gubić” zmian: zachowuje istniejący mechanizm offline draft (tam gdzie dotyczy).
- Jeśli encja nie ma draftów (np. Notification), pola są read-only lub zapisują się natychmiast — zgodnie z istniejącym zachowaniem encji.

### 3.2.5 N blocks kit — kontrakty komponentów (API)

Poniżej kontrakty (TypeScript) w formie specyfikacji. Implementacja może być inna, ale funkcjonalność musi się zgadzać.

#### `PageSection`

- **Inputs**:
  - `id: string` (anchor)
  - `title: string`
  - `description?: string`
  - `count?: number` (np. RAID=5)
  - `actions?: ReactNode` (np. “Add”, “Open full”)
  - `children: ReactNode`
- **Behavior**:
  - renderuje H2 + anchor
  - zapewnia spójny spacing i separator rytmu

#### `LeftNavSections`

- **Inputs**:
  - `sections: Array<{ id: string; label: string; icon: Icon; count?: number }>`
  - `activeId: string`
  - `onSelect(id): void`
  - `onSearch(query): void`
- **Behavior**:
  - wyszukuje sekcje
  - pokazuje active + count

#### `PropertyGrid`

- **Inputs**:
  - `fields: Array<PropertyFieldSpec>`
  - `values: Record<string, unknown>`
  - `onChange(fieldKey, value)`
  - `readOnly?: boolean`
- **PropertyFieldSpec** (MUST minimal):
  - `key`, `label`, `type` (`select|user|date|text|number|tags|relation|badge`)
  - `options?`, `placeholder?`, `validate?`

#### `Callout`

- **Inputs**:
  - `variant: info|warning|critical|success|neutral`
  - `title?: string`
  - `children`

#### `EmbeddedView`

- **Inputs**:
  - `title: string`
  - `defaultView: table|board|timeline`
  - `views: Array<ViewSpec>` (konfiguracje)
  - `data: unknown[]`
  - `loading/error/empty` states
  - actions: `onAdd`, `onLink`, `onOpenFull`
- **Behavior**:
  - mini-toolbar: view switch, filter, sort
  - spójny Table UI Standard, gdy view=table

#### `ActivityStream`

- **Inputs**: `items`, `loading`, `onOpenItem?`
- **Behavior**: minimal, czytelny audit trail

### 3.2.6 Embedded views — standard kolumn (default columns)

Żeby N mode był “operacyjny”, embedded views muszą mieć domyślne kolumny jak w narzędziu PMO.

**Tasks (embedded table) — default:**

- Title
- Status
- Owner/Assignee
- Priority
- Due/Aging
- Blocker (jeśli występuje)
- Next action (CTA)

**Decisions (embedded table) — default:**

- Statement / Title
- Decider
- Status
- Deadline/Aging
- Blocks X
- Next action (Decide/Delegate/Escalate)

**RAID (embedded table) — default:**

- Type (Risk/Assumption/Issue/Dependency)
- Title
- Owner
- Severity/Impact
- Due/Aging
- Status
- Next action

### 3.2.7 Wymagane stany (loading/error/empty) per sekcja

**MUST:**

- Każdy EmbeddedView ma własne:
  - Loading (skeleton, bez layout shift)
  - Error (czytelny + retry)
  - Empty (komunikat + CTA `Add`/`Link`)

### 3.2.8 Spójność z AI Chat i „header switcher”

**MUST:**

- Niezależnie od trybu, `Chat` działa identycznie:
  - ten sam kontekst encji
  - ten sam draft policy
- Przełączenie trybu NIE może:
  - utracić kontekstu AI,
  - utracić niezapisanych zmian,
  - zmienić uprawnień/gate logic.

### 3.2.9 Persystencja preferencji trybu

**MUST:**

- Tryb jest zapamiętywany per użytkownik i per encja:
  - `presentationMode.task = n|d|c`
  - analogicznie dla decision/notification/initiative
- Fallback: `d` (Golden Standard).

**SHOULD:**

- Jeśli link zawiera query `?view=n`, to ma pierwszeństwo nad preferencją (deep link).

### 3.2.10 Definition of Done (DoD) — N mode

Implementacja N mode dla każdej encji jest “done”, jeśli:

- Jest przełącznik 3 trybów w headerze i działa deterministycznie.
- N mode renderuje:
  - LeftNav 8–10 bloków,
  - PropertiesStrip,
  - Canvas z blokami,
  - Embedded views zamiast list linków.
- Wszystkie elementy obecne w D mode są dostępne w N mode (po mapowaniu).
- Deep-link do sekcji działa (`#sectionId`), a active section śledzi scroll.
- A11y: focus ring, kontrast, klawiatura.
- Performance: brak layout shift, obsługa dużych list (paginacja/virtualizacja).

### 3.2.11 AI Assist Actions — “AI wypełnianie narzędzi” (cross-mode, implementation-ready)

Ta sekcja uzupełnia spec o brakujący element: **AI pomaga wypełniać treści i struktury** (Task/Decision/Initiative/Notification), w sposób spójny dla:

- `D` (D mode / DBR77),
- `N` (N mode / page-first),
- `C` (C mode / action-first).

#### 3.2.11.1 Zasady (MUST)

- **Human-in-the-loop**: AI **nigdy** nie zmienia statusów, gate’ów ani decyzji samodzielnie.
- **Apply ≠ Save**:
  - `Apply` wprowadza zmiany do draftu (lokalnie w UI) **bez** wymuszania natychmiastowego zapisu.
  - `Save` (globalny w headerze) jest jedynym “twardym” zapisem dla encji z draftami (Task/Decision/Initiative).
  - Dla encji bez draftu (część pól w Notification) `Apply` może mapować się na natychmiastowy update — zgodnie z istniejącą polityką encji.
- **Deterministyczny scope**: każda akcja AI jest przypięta do:
  - `entityType` + `entityId`,
  - `mode` (d/n/c) — tylko do telemetry/debug,
  - `surface` (`header-ai`, `section-ai`, `tab-ai`, `embedded-ai`),
  - `sectionId` (N mode) **lub** `tabKey` (C mode),
  - opcjonalnie `fieldKeys[]` (Properties/FieldsPane).
- **Bez utraty kontekstu**: przełączenie trybu NIE resetuje AI outputów w UI (o ile nie ma konfliktu z draftem).
- **A11y**: AI CTA są w pełni klawiaturowe, focus widoczny, `Esc` zamyka popover/drawer.

#### 3.2.11.2 Gdzie AI “mieszka” w UI (MUST)

**Wspólne dla wszystkich trybów:**

- `Header` może mieć **AI button** (jeśli dany ekran ma AI w headerze). Ten przycisk otwiera “AI Assist Drawer” (lub panel) z:
  - listą akcji kontekstowych,
  - ostatnimi sugestiami,
  - szybkim “Ask in Chat”.

**N mode:**

- Każdy `PageSection` (blok) MAY mieć `actions` z ikoną “sparkles” → menu **AI Assist** dla tej sekcji.
- `PropertiesStrip` MAY mieć AI helper dla pustych/kluczowych pól (np. “Suggest owners”, “Suggest due date”).

**C mode:**

- `CommandBar` MAY mieć `AI` quick action (np. “Suggest next actions”, “Generate checklist”).
- Dla encji, gdzie AI jest kluczowe, tab `ai` jest **MUST** (Task/Decision/Notification; Initiative SHOULD).

#### 3.2.11.3 Format outputu AI (MUST)

AI zwraca **sugestie** w jednym z 3 typów (to ma być renderowalne jako “Suggestion Cards”):

1. `text` — propozycja tekstu (np. executive summary, rewrite)
2. `items[]` — propozycja listy obiektów (np. risks, alternatives, checklist items)
3. `patch` — propozycja zmian pól (np. dueDate, priority, strategic contribution)

**Każda sugestia (MUST) ma:**

- `id`, `title`, `body`,
- `confidence` (`low|medium|high`),
- `reasoningSummary` (1–3 zdania, bez “chain-of-thought”),
- `target`:
  - `sectionId` / `tabKey`,
  - `fieldKeys[]` (opcjonalnie),
- `actions`:
  - **Apply** (wprowadza do draftu),
  - **Dismiss** (ukrywa; opcjonalnie loguje telemetry),
  - (Opcjonalnie) **Preview** (diff/porównanie).

**UI (MUST):**

- przy `Apply` pokazujemy “inline save confidence” (Saving…/Saved) w obrębie sekcji/pola (bez spamowania toastami),
- `Dismiss` nie może być destrukcyjne (brak utraty danych usera),
- jeśli sugestia dotyka wielu pól, UI pokazuje listę zmienianych pól przed Apply (“will update: …”).

#### 3.2.11.4 Katalog akcji AI (KANON) — per encja i sekcja

**Task — MUST (jeśli sekcja istnieje w UI):**

- `Task Brief / Description`: `summarize`, `rewrite`, `clarify`, `extract_actions`
- `Outcome & Acceptance` (w tym Evidence): `generate_acceptance_criteria`, `generate_evidence_checklist`
- `Plan & Implementation`: `generate_implementation_ideas`, `decompose_to_checklist`
- `Risks & Alternatives`: `generate_risks`, `generate_alternatives`
- `Checklist / Subtasks`: `generate_checklist`, `suggest_next_actions`
- `Dependencies & Linked Items`: `suggest_dependencies` (tylko propozycje — user zatwierdza linki)
- `AI Insights` (jeśli włączone): `generate_ai_insights` (recommendation/warning/prediction/optimization)
- `Strategic Contribution` (jeśli włączone): `suggest_strategic_contribution` → pole `strategicContribution[]`
  - enum (KANON, zgodny z `src/types/core.ts`): `PROCESS_CHANGE | BEHAVIOR_CHANGE | CAPABILITY_CHANGE`

**Decision — MUST (jeśli sekcja istnieje w UI):**

- `Context & Problem`: `rewrite`, `clarify`, `summarize`
- `Options & Trade-offs`: `generate_options_table` (opcje + pros/cons + recommendation flag)
- `Risk & Impact`: `generate_risk_impact`, `identify_unknowns`
- `Consequences of Inaction` (blok zawsze istnieje): `generate_consequences_of_inaction`
- `Governance`: `draft_request_info`, `draft_delegation_note`, `suggest_escalation` (tylko propozycje)

**Notification — MUST:**

- `Signal Contract (4-line)`: `explain_signal`, `summarize`, `classify_severity` (tylko sugestia; systemowe severity nie zmienia się automatycznie)
- `Expected Action`: `generate_action_checklist`, `suggest_primary_cta`
- `AI Insight`: `generate_ai_insight`, `ask_ai_followup`
- `Context`: `explain_why_received`, `suggest_related_items` (tylko propozycje linków)

**Initiative — SHOULD (enterprise):**

- `Executive Summary / Charter`: `generate_charter`, `rewrite`, `summarize_for_exec`
- `Problem/Target/Scope`: `generate_success_criteria`, `generate_kill_criteria`, `detect_gaps`
- `Delivery Plan`: `generate_plan_skeleton` (tasks/milestones), `suggest_next_actions`
- `RAID`: `generate_raid_items` (risks/issues/assumptions/dependencies)
- `Governance (Gates & Readiness)`: `gate_readiness_coach` (checklist braków + rekomendacje)
- `Economics/Value`: `draft_value_narrative`, `explain_roi_assumptions` (bez automatycznego “APPROVE”)

#### 3.2.11.5 Minimalny kontrakt danych (TS) (MUST)

To nie narzuca backendu, ale standaryzuje payloady w UI.

```ts
type AiEntityType = 'task' | 'decision' | 'notification' | 'initiative';
type AiAssistSurface = 'header-ai' | 'section-ai' | 'tab-ai' | 'embedded-ai';
type AiSuggestionType = 'text' | 'items' | 'patch';
type AiConfidence = 'low' | 'medium' | 'high';

type AiAssistActionKey =
  | 'summarize'
  | 'rewrite'
  | 'clarify'
  | 'extract_actions'
  | 'generate_acceptance_criteria'
  | 'generate_evidence_checklist'
  | 'generate_implementation_ideas'
  | 'decompose_to_checklist'
  | 'generate_risks'
  | 'generate_alternatives'
  | 'generate_checklist'
  | 'suggest_next_actions'
  | 'suggest_dependencies'
  | 'generate_ai_insights'
  | 'suggest_strategic_contribution'
  | 'generate_options_table'
  | 'generate_risk_impact'
  | 'identify_unknowns'
  | 'generate_consequences_of_inaction'
  | 'draft_request_info'
  | 'draft_delegation_note'
  | 'suggest_escalation'
  | 'explain_signal'
  | 'classify_severity'
  | 'generate_action_checklist'
  | 'suggest_primary_cta'
  | 'generate_ai_insight'
  | 'ask_ai_followup'
  | 'explain_why_received'
  | 'suggest_related_items'
  | 'generate_charter'
  | 'summarize_for_exec'
  | 'generate_success_criteria'
  | 'generate_kill_criteria'
  | 'detect_gaps'
  | 'generate_plan_skeleton'
  | 'generate_raid_items'
  | 'gate_readiness_coach'
  | 'draft_value_narrative'
  | 'explain_roi_assumptions';

type AiAssistRequest = {
  entityType: AiEntityType;
  entityId: string;
  mode: 'd' | 'n' | 'c';
  surface: AiAssistSurface;
  action: AiAssistActionKey;
  sectionId?: string; // N mode
  tabKey?: string; // C mode
  fieldKeys?: string[];
  locale: 'pl' | 'en';
  // snapshot wejścia (kanonicznie: to co user aktualnie widzi/edytuje)
  input: Record<string, unknown>;
  context?: {
    relatedEntities?: Array<{ type: AiEntityType; id: string; title?: string }>;
    attachments?: Array<{ id: string; name: string; mimeType?: string }>;
  };
};

type AiAssistSuggestion = {
  id: string;
  type: AiSuggestionType;
  title: string;
  body?: string;
  confidence: AiConfidence;
  reasoningSummary?: string;
  target: { sectionId?: string; tabKey?: string; fieldKeys?: string[] };
  // payload:
  text?: string;
  items?: unknown[];
  patch?: Array<{ op: 'add' | 'remove' | 'replace'; path: string; value?: unknown }>;
};
```

**MUST:** sugestie są “aplikowane” lokalnie do draftu i zapisują się dopiero przez standardowe endpointy encji (Save / inline save policy).

---

## 3.3 Mapping tables (D → N) — 1:1 z istniejącymi sekcjami

To jest “checklist” mapowania, aby nic nie zginęło.

### 3.3.1 Task (obecne sekcje → N bloki)

- `Task description` → **Task Brief (Definition)**
- `Expected Outcome` → **Outcome & Acceptance**
- `Evidence & Acceptance` → **Outcome & Acceptance**
- `Implementation ideas` → **Plan & Implementation**
- `Checklist` → **Checklist / Subtasks**
- `Dependencies` → **Dependencies & Linked Items**
- `Linked Items` → **Dependencies & Linked Items**
- `Attachments` → **Dependencies & Linked Items**
- `Related Decisions` → **Decisions & Blockers**
- `Reminders & Escalation` (jeśli występuje) → **Decisions & Blockers**
- `Risk Analysis` → **Risks & Alternatives**
- `Alternatives` → **Risks & Alternatives**
- `AI Insights` (jeśli występuje) → **AI Assist (Suggestions)**
- `Strategic Contribution` (jeśli występuje) → **PropertiesStrip** (`strategicContribution[]`)
- `Comments` → **Collaboration & Audit**
- `Activity Log` → **Collaboration & Audit**
- (Prawa kolumna) `Control / Stakeholders (RACI) / Tags` → **PropertiesStrip** + (opcjonalnie) **Collaboration & Audit**

### 3.3.2 Decision (obecne sekcje → N bloki)

- `Problem description / context` → **Context & Problem**
- `Alternatives` → **Options & Trade-offs**
- `Risk Analysis` → **Risk & Impact**
- `Comments` → **Collaboration & Audit**
- `Attachments` → **Collaboration & Audit**
- `Linked Items` → **Stakeholders, Delegation & Escalation** (relacje) + embedded view
- `Stakeholders (RACI)` → **Stakeholders, Delegation & Escalation**
- `Escalation & Reminders` → **Stakeholders, Delegation & Escalation**
- `Activity Log` → **Collaboration & Audit**
- (Prawa kolumna) `Control` → **PropertiesStrip**
- (Nowy wymóg) **Consequences of Inaction** → osobny blok (musi istnieć nawet jeśli puste)

### 3.3.3 Notification (obecne sekcje → N bloki)

- `What's Happening` → **Signal Contract (4-line)**
- `AI Analysis` → **AI Insight**
- `Expected Action` → **Expected Action (CTA + checklist)**
- `Related Items` → **Context & Source**
- `Why You Got It` → **Recipients & Why You Got It**
- `Stakeholders` → **Recipients & Why You Got It**
- `Control` → **Control & Triage** (lub PropertiesStrip dla metadanych)
- `Activity Log` → **Audit**
- `Comments` (jeśli włączone) → **Audit**

### 3.3.4 Initiative (minimalne elementy z kanonu Initiative.md → N bloki)

Zgodnie z `wdrozenia/standards/entities/07-INITIATIVE.md` (Full Card P0):

- Opis/Charter → **Executive Summary** + **Problem & Context** + **Target State & Success Criteria** + **Scope & Kill Criteria**
- Comments → **RAID + Dependencies + Evidence & Audit** (lub osobny sub-block w Audit)
- Tasks → **Delivery Plan (Tasks & Milestones)** (embedded view)
- Decisions → **Governance (Gates & Readiness)** (embedded view)
- RAID → **RAID + Dependencies + Evidence & Audit** (embedded view)
- Gate readiness + timeline → **Governance (Gates & Readiness)** + **Timeline, Resources & Capacity**
- Economics integration → **Economics / Finance & Risk Posture**
- Stakeholders → **Org & Stakeholders (Team + RACI)**
- Reminders & escalation → **Governance (Gates & Readiness)** (dla decyzji) + **Delivery Plan** (dla tasków)
- History/Audit → **RAID + Dependencies + Evidence & Audit**
- (Prawa kolumna Control) → **PropertiesStrip**

---

## 4) C mode — minimalny standard tabów (dla spójności)

W C mode zachowujemy wspólny zestaw tabów oraz zestaw pól/akcji “na wierzchu”.

### 4.1 Wspólne taby (MUST)

- `Overview`
- `Comments`
- `Activity`
- `Links`
- `Files`

### 4.2 Taby specyficzne (SHOULD)

- Task: `Checklist/Subtasks`, `Dependencies`, `AI`
- Decision: `Options`, `Approval`, `Escalation`, `AI`
- Notification: `Expected Action`, `AI`, `Snooze/Rules` (opcjonalnie)
- Initiative: `Plan (Tasks)`, `Timeline`, `RAID`, `Decisions`, `Benefits`, `Docs`

---

## 4.3 C mode — UI execution spec (enterprise action-first w naszej estetyce)

C mode ma być “operacyjny”: maksimum pracy w 1–2 klikach, minimalny czas do akcji.

### 4.3.1 Układ: 2-pane minimalnie, 3-pane docelowo

**MUST (2-pane):**

- `CommandBar` (pod headerem)
- `Tabs` + `TabContent` (detail w środku)
- `FieldsPane` (prawa kolumna: pola, automations, relations)

**SHOULD (3-pane):**

- `ListPane` (lewa kolumna) pokazująca listę elementów w bieżącym kontekście:
  - np. “Tasks w tej inicjatywie”, “Decisions awaiting me”, “Notifications (filtered)”
- `ListPane` umożliwia next/prev oraz bulk actions.

**Zasada:** 3-pane jest największym “C feel”, ale nie blokuje MVP.

### 4.3.2 CommandBar — kontrakt i zawartość (MUST)

CommandBar to “operacyjna linia”, gdzie są najczęstsze pola i akcje.

**MUST:**

- Zawiera (jeśli encja ma to pole):
  - Status / Gate dropdown
  - Owner/Assignee/Decider picker
  - Due date (deadline)
  - Priority/Severity
  - **AI Assist** (sparkles) — otwiera menu akcji AI dla bieżącej encji/zakładki (jeśli AI jest włączone dla ekranu)
  - Quick actions (kontekstowe)

**Quick actions (przykłady, MUST jeśli istnieją w obecnym UX):**

- Task: Block/Unblock, Reassign, Mark done
- Decision: Approve/Reject, Delegate, Escalate, Request info
- Notification: Mark read, Snooze, Mute, Delete, Open source
- Initiative: Gate action (next gate), Schedule/Start/Block/Cancel (jeśli workflow przewiduje), Open full module

### 4.3.3 Tabs — zachowanie

**MUST:**

- Wspólne taby zawsze w tej samej kolejności: `Overview`, `Comments`, `Activity`, `Links`, `Files`.
- Każdy tab ma własne loading/error/empty states.

**SHOULD:**

- Tab “Overview” jest zawsze “best summary” i zawiera kluczowe callouty + embedded views.

### 4.3.4 FieldsPane (prawa kolumna) — standard grup

**MUST:** Pola są pogrupowane (bez przypadkowych sekcji):

- **Control**: status, priority/severity, identifiers
- **Ownership**: owner/assignee/decider
- **Dates & SLA**: due, start, created, aging
- **Relations**: linked items, initiative/project
- **Governance**: escalation/reminders (jeśli dotyczy)
- **Tags**

### 4.3.5 Keyboard productivity (C-grade)

**SHOULD:**

- `j/k` lub `↑/↓` — next/prev w ListPane
- `s` — status dropdown
- `a` — assign picker
- `d` — due date
- `p` — priority
- `c` — comment focus

### 4.3.6 DoD (C mode)

Done gdy:

- CommandBar działa i ma kontekstowe quick actions.
- Taby są spójne i zawierają wszystkie elementy znane z D mode.
- FieldsPane ma logiczne grupy i inline edit.
- (Jeśli 3-pane) ListPane nie gubi kontekstu filtrów i umożliwia szybkie przełączanie elementów.

### 4.3.7 Motion & microinteractions (tech‑sexy, ale minimalistyczne) (MUST)

Źródło tokenów motion: `docs/00_foundation/DBR77_VISUAL_LANGUAGE_STANDARD.md` (sekcja 9).

**MUST (C mode):**

- **Sticky elevation**:
  - header + CommandBar są sticky,
  - gdy treść scrolluje “pod spodem” → pojawia się subtelny cień (`shadow-hig-sm`) bez zmiany layoutu.
- **Tab underline glide**:
  - aktywny tab ma underline przesuwający się płynnie (Framer Motion `layoutId`),
  - brak skakania szerokości tabów.
- **ListPane selection clarity** (jeśli 3-pane):
  - element aktywny: 1px border accent + bardzo subtelne tło (`primary/surface`),
  - hover: tylko delikatna zmiana tła (bez “cards in cards”).
- **RightRail transitions**:
  - przełączanie tabów Activity/Links/Followers bez “flash” (opacity 160–220ms),
  - rail ma własne skeletons (bez layout shift).
- **Quick actions**:
  - disabled state + tooltip “why disabled”,
  - “press” na przycisku \(~0.98\) max, 120–160ms.

**MUST (A11y):**

- `prefers-reduced-motion`: redukuj/wyłącz animacje przesunięć i skale (zostaw natychmiastowe stany).

**MUST NOT:**

- brak bounce/spring jako default,
- brak intensywnych glow jako stały styl UI (glow tylko incydentalnie dla premium CTA, jeśli w ogóle).

---

## 4.4 C mode — implementation-ready spec (kontrakty, tokeny, zawartość)

Ta sekcja domyka C mode tak, aby implementacja była możliwa “bez zgadywania”.

### 4.4.1 Design tokens (layout/spacing) — w naszej estetyce

**MUST:**

- C mode używa naszych:
  - kolorów (navy + purple),
  - fontów,
  - kształtów (`rounded-xl/2xl`),
  - Table UI Standard dla widoków tabelowych.

**Layout tokens (MUST):**

- **CommandBar height**: 44–52px (spójnie z header CTA).
- **Tabs bar height**: 40–44px.
- **FieldsPane width** (desktop): 320–380px (sticky), zależnie od gęstości pól.
- **ListPane width** (docelowo 3-pane): 280–340px.
- **Gutter**: 16–20px.
- **Content padding**: 16–24px (w tab content).

### 4.4.2 Component contracts (API)

#### `CommandBar`

```ts
type CommandBarField =
  | { key: string; type: 'select'; label: string; options: Array<{ value: string; label: string }> }
  | { key: string; type: 'user'; label: string }
  | { key: string; type: 'date'; label: string }
  | { key: string; type: 'tags'; label: string }
  | { key: string; type: 'badge'; label: string };

type CommandBarAction = {
  id: string;
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  icon?: string;
  disabled?: boolean;
  tooltip?: string;
  onClick: () => void;
};

type CommandBarProps = {
  fields: CommandBarField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  actions: CommandBarAction[];
  dirty?: boolean;
  loading?: boolean;
};
```

#### `FieldsPane`

```ts
type FieldGroup = {
  id: string;
  label: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'select' | 'user' | 'date' | 'text' | 'number' | 'tags' | 'relation' | 'badge';
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    helpText?: string;
  }>;
};

type FieldsPaneProps = {
  groups: FieldGroup[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  readOnly?: boolean;
};
```

#### `DetailTabs`

```ts
type DetailTabId = string;

type DetailTab = {
  id: DetailTabId;
  label: string;
  icon?: string;
  badgeCount?: number;
};

type DetailTabsProps = {
  tabs: DetailTab[];
  activeTabId: DetailTabId;
  onChange: (tabId: DetailTabId) => void;
};
```

#### `ListPane` (docelowo)

```ts
type ListPaneItem = {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  isHighlighted?: boolean;
};

type ListPaneProps = {
  title: string;
  items: ListPaneItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onNext?: () => void;
  onPrev?: () => void;
  onSearch?: (q: string) => void;
  onBulkAction?: (actionId: string, ids: string[]) => void;
};
```

### 4.4.3 Behavioral rules (MUST)

- **CommandBar** pokazuje tylko pola “hot path” (najczęściej używane).
- **FieldsPane** ma pełny zestaw pól i logikę walidacji (inline).
- **Tabs**:
  - `Overview` jest “best summary” (callouty + embedded views).
  - pozostałe taby rozdzielają obszary, żeby nie przewijać kilometra.
- **C mode musi zawierać 100% elementów** z D mode (po mapowaniu do tabów/pól).

---

## 4.5 C mode — taby i zawartość per encja (implementation-ready)

Zasada: każdy element z D mode trafia do:

- pola w `CommandBar` (hot path), albo
- pola w `FieldsPane` (control), albo
- konkretnego `TabContent`.

### 4.5.1 Task — taby i mapowanie treści

**Tabs (MUST):**

- `overview`
- `checklist`
- `dependencies`
- `decisions`
- `risks`
- `ai`
- `comments`
- `activity`
- `files`

**Tab content rules (MUST):**

- `overview`:
  - Task brief (description)
  - Expected outcome + acceptance (evidence/acceptance)
  - “Next action” callout (jeśli BLOCKED/overdue)
- `checklist`: checklist / subtasks + progress
- `dependencies`: dependencies + linked items (relacje) + quick unblock links
- `decisions`: related decisions (embedded table) + create/link
- `risks`: risk analysis + alternatives
- `ai`: AI Assist actions + AI Insights (suggestions) + apply/dismiss
- `comments`: comments thread
- `activity`: activity log / change log
- `files`: attachments + evidence items

### 4.5.2 Decision — taby i mapowanie treści

**Tabs (MUST):**

- `overview`
- `options`
- `impact_risk`
- `ai`
- `governance`
- `comments`
- `activity`
- `files`

**Tab content rules (MUST):**

- `overview`:
  - context/problem
  - recommendation
  - **consequences of inaction** (callout always visible)
- `options`: alternatives/options jako porównywalna tabela
- `impact_risk`: risk analysis + impact summary
- `ai`: AI Assist actions (options/risk/unknowns/inaction) + apply/dismiss
- `governance`:
  - stakeholders (RACI)
  - delegation / request info
  - reminders & escalation
  - linked items + “blocks X”
- `comments`: comments thread
- `activity`: audit trail
- `files`: attachments

### 4.5.3 Notification — taby i mapowanie treści

**Tabs (MUST):**

- `overview`
- `action`
- `ai`
- `context`
- `activity`

**Tab content rules (MUST):**

- `overview`: 4-line contract (what/why/blocked) + severity
- `action`: expected action checklist + primary CTA
- `ai`: AI analysis + “Ask AI”
- `context`: related items + why you got it + stakeholders
- `activity`: activity log (+ comments jeśli włączone)

### 4.5.4 Initiative — taby i mapowanie treści

**Tabs (MUST):**

- `overview`
- `plan`
- `timeline_resources`
- `raid`
- `decisions_governance`
- `economics_value`
- `comments_activity`
- `files`

**Tab content rules (MUST):**

- `overview`:
  - executive summary (one-liner + value statement)
  - problem/context
  - target state & success criteria
  - “health” callouts (blocked, risks, overdue decisions)
- `plan`: tasks & milestones embedded views (table/board/timeline)
- `timeline_resources`: timeline + capacity + team allocation
- `raid`: RAID embedded table + dependencies
- `decisions_governance`: gate readiness + decisions embedded + escalation overview
- `economics_value`: capex/opex/benefit/ROI + KPI snapshot
- `comments_activity`: comments + audit/activity (versions)
- `files`: attachments / evidence

---

## 4.6 C mode — CommandBar & FieldsPane (field keys, kontrolki, walidacje)

### 4.6.1 Task

**CommandBar (hot path) — MUST:**

- `status` (select)
- `assigneeId` (user)
- `dueDate` (date)
- `priority` (select)

**FieldsPane groups — MUST:**

- Control: `status`, `priority`, `progress`, `taskType`
- Ownership: `ownerId`, `assigneeId`, `backupAssigneeId`, `reporterId`
- Dates: `dueDate`, `startedAt`, `completedAt`
- Blockers: `blockedReason` (required if BLOCKED), `dependencies`
- Relations: `initiativeId`, linked items
- Tags: `tags`
- Acceptance/Evidence: `requiresAcceptance`, `acceptorId`, `evidenceRequired`, `evidenceItems`, `signedOff*`

### 4.6.2 Decision

**CommandBar (hot path) — MUST:**

- `status` (select)
- `decisionOwnerId` (user)
- `dueDate` (date)
- `escalationLevel` (select)

**FieldsPane groups — MUST:**

- Control: `status`, `decisionType`, `required`
- Ownership: `decisionOwnerId`
- Dates: `dueDate`, `decidedAt`
- Escalation: `escalationLevel`, `impact`
- Relations: `relatedObjectType`, `relatedObjectId`

### 4.6.3 Notification

**CommandBar (hot path) — MUST:**

- `severity` (select)
- `isRead` (badge)

**FieldsPane groups — MUST:**

- Control: `severity`, `type`, `category`
- Dates: `createdAt`, `readAt`, `expiresAt`
- Relations: `relatedObjectType`, `relatedObjectId`, `actionUrl`

### 4.6.4 Initiative

**CommandBar (hot path) — MUST:**

- `status` (select / gate-aware)
- `ownerExecutionId` (user)
- `plannedEndDate` (date)
- `priority` (select)

**FieldsPane groups — MUST:**

- Control: `status`, `priority`, `decisionReadiness`, `completenessScore`
- Ownership: `ownerBusinessId`, `ownerExecutionId`, `sponsorId`
- Dates: `plannedStartDate`, `plannedEndDate`, `slaDeadline`
- Governance: gate readiness snapshot, pending decisions count
- Economics: `capex`, `annualBenefit`, `roi/expectedRoi`
- Relations: tasks/decisions/RAID links, project
- Tags: `patternTags`

---

## 4.7 Mapping tables (D → C) — 1:1

### 4.7.1 Task

- `Task description` → `overview`
- `Expected Outcome` → `overview`
- `Evidence & Acceptance` → `overview` + `files` (evidence items)
- `Implementation ideas` → `overview`
- `Checklist` → `checklist`
- `Dependencies` → `dependencies`
- `Linked Items` → `dependencies`
- `Attachments` → `files`
- `Related Decisions` → `decisions`
- `Risk Analysis` → `risks`
- `Alternatives` → `risks`
- `AI Insights` (jeśli występuje) → `ai` (suggestions + apply/dismiss)
- `Strategic Contribution` (jeśli występuje) → `FieldsPane` (`strategicContribution[]`, Impact / Strategic)
- `Comments` → `comments`
- `Activity Log` → `activity`
- (Right column) `Control/Stakeholders/Tags` → `CommandBar` + `FieldsPane`

### 4.7.2 Decision

- `Problem description / context` → `overview`
- `Alternatives` → `options`
- `Risk Analysis` → `impact_risk`
- `Stakeholders (RACI)` → `governance`
- `Reminders & Escalation` → `governance`
- `Delegate/Request info` → `governance` + `CommandBar actions`
- `Linked Items` → `governance`
- `Attachments` → `files`
- `Comments` → `comments`
- `Activity Log` → `activity`
- (Right column) `Control` → `CommandBar` + `FieldsPane`

### 4.7.3 Notification

- `What's Happening` → `overview`
- `Expected Action` → `action`
- `AI Analysis` → `ai`
- `Related Items` → `context`
- `Stakeholders` → `context`
- `Why You Got It` → `context`
- `Control` → `CommandBar` + `FieldsPane`
- `Activity Log` → `activity`
- `Comments` (jeśli) → `activity`

### 4.7.4 Initiative

- Charter/Description → `overview`
- Problem definition → `overview`
- Target state/success criteria → `overview`
- Scope/Kill → `overview` (lub `plan` jeśli rozbudowane)
- Tasks & milestones → `plan`
- Timeline/resources/team allocation → `timeline_resources`
- RAID + Dependencies → `raid`
- Gate readiness + decisions + escalation → `decisions_governance`
- Economics/value/KPI → `economics_value`
- Comments + history/versions → `comments_activity`
- Attachments/evidence → `files`
- (Right column) Control/Team/Timeline/Resources/Finance/Risk/Stakeholders/Dependencies/Tags → `CommandBar` + `FieldsPane`

---

## 4.8 C mode — Right Rail (Activity / Links / Followers) (MUST)

C‑style praca potrzebuje “rail productivity”: szybki dostęp do zdarzeń, linków, relacji i obserwatorów — bez szukania po tabach.

### 4.8.1 Rail layout

**MUST:**

- Right rail jest **sticky** (desktop).
- Rail ma pionowe zakładki/ikony (C-style):
  - `Activity` (domyślne)
  - `Links`
  - `Followers`
  - (opcjonalnie) `Automation/Rules`
- Rail nie zastępuje tabów; jest “side utility panel”.

**SHOULD:**

- Rail może być zwijany do ikon.
- Na mobile rail jest drawerem.

### 4.8.2 Activity panel — funkcje

**MUST:**

- Lista zdarzeń w czasie (audit trail) z:
  - `who` (actor),
  - `what` (event type),
  - `when`,
  - (opcjonalnie) `diff/metadata`.
- Filtry typów zdarzeń (multi-select) + szybkie presety.
- Licznik zdarzeń (badge).

**SHOULD:**

- “Jump to” — klik w zdarzenie scrolluje do miejsca zmiany (jeśli ma anchor).
- “Copy link” do konkretnego eventu (opcjonalnie).

### 4.8.3 Activity taxonomy (KANON) — bez tego nie zrobimy filtrów

**MUST:** eventy mają stabilne `eventType` (enum/string union), niezależne od UI copy.

Minimalny zestaw (pokrywa C-like filtry na screenie):

- `created`
- `updated`
- `status_changed`
- `priority_changed`
- `assigned` / `unassigned`
- `due_date_changed`
- `comment_added`
- `attachment_added` / `attachment_removed`
- `dependency_added` / `dependency_removed`
- `relationship_added` / `relationship_removed`
- `watcher_added` / `watcher_removed`
- `archived` / `restored`
- `deleted`

**SHOULD:** dla PMO dopisz:

- `gate_requested` / `gate_approved` / `gate_rejected`
- `decision_created` / `decision_decided`
- `raid_item_added` / `raid_item_updated`

### 4.8.4 Links panel (Rail)

**MUST:**

- Pokazuje linki powiązane z encją:
  - URL (z preview/thumbnail best-effort),
  - dokumenty/załączniki,
  - linki do encji wewnątrz systemu.
- Akcje:
  - `Add link (URL)`
  - `Link entity`
  - `Open`
  - `Copy`
  - `Remove` (wg uprawnień)

### 4.8.5 Followers panel (Rail)

**MUST:**

- Pokazuje listę watchers/followers.
- Pozwala:
  - follow/unfollow,
  - ustawić `notifyOn` (all/mentions/status_changes) jeśli model to wspiera,
  - pokazuje licznik followers (badge).

**Ważne:** follow/unfollow ma generować event do Activity.

---

## 4.9 Relationships composer (C-like) — implementation-ready (MUST)

C mode musi mieć prosty “composer” relacji, bo to jest klucz w strategicznym PMO (blokady i przepływ).

### 4.9.1 Relationship types (KANON)

**MUST:**

- `link_task` (zwykłe powiązanie)
- `waiting_on` (ta encja czeka na X)
- `blocking` (ta encja blokuje X)
- `link_doc` (powiązany dokument wewnętrzny lub plik)
- `link_url` (URL z preview)
- `custom` (opcjonalnie)

### 4.9.2 Relationship object schema (proponowane)

```ts
type RelationshipType =
  | 'link_task'
  | 'waiting_on'
  | 'blocking'
  | 'link_doc'
  | 'link_url'
  | 'custom';

type RelationshipTarget =
  | { kind: 'task'; id: string }
  | { kind: 'decision'; id: string }
  | { kind: 'initiative'; id: string }
  | { kind: 'project'; id: string }
  | { kind: 'url'; href: string; title?: string; previewImageUrl?: string }
  | { kind: 'doc'; id: string; title: string };

type Relationship = {
  id: string;
  type: RelationshipType;
  sourceType: 'task' | 'decision' | 'initiative' | 'notification';
  sourceId: string;
  target: RelationshipTarget;
  createdAt: string;
  createdBy?: string;
};
```

### 4.9.3 Composer UX

**MUST:**

- Jedno wejście “Add relationship” z wyborem typu relacji.
- Dla `link_url`: input URL + preview best-effort + save.
- Dla linków do encji: wyszukiwarka encji + select.
- Dla `waiting_on/blocking`: UI pokazuje też skutki:
  - jeśli `blocking` → target powinien pokazywać “blocked by …”
  - jeśli `waiting_on` → source pokazuje “waiting on …”

---

## 4.10 Menu akcji (C-like) — standard (MUST)

Wzorzec “…” w headerze/rail ma być spójny.

**MUST actions (jeśli encja wspiera):**

- Copy link
- Duplicate/Clone (tam gdzie ma sens)
- Remind me (jeśli implementujemy reminders)
- Follow/Unfollow
- Relationships (otwiera composer)
- Archive
- Delete (z potwierdzeniem i polityką: tylko drafty, jeśli tak w kanonie)
- Sharing & permissions (jeśli wdrażamy item-level sharing)

**SHOULD:**

- “Convert to …” (np. notification → task/decision), jeśli workflow tego wymaga.

---

## 4.11 ListPane presets (3-pane) — 4 narzędzia (implementation-ready)

### 4.11.1 Initiative list item

**MUST fields shown:**

- Title
- Status badge
- Priority badge
- Owners (avatars)
- Planned end (lub due)
- Health indicator (blocked/at risk)

### 4.11.2 Task list item

**MUST fields shown:**

- Title
- Status
- Assignee
- Due/Aging
- Priority
- Blocked indicator (jeśli BLOCKED)

### 4.11.3 Decision list item

**MUST fields shown:**

- Title/statement
- Status
- Decider
- Deadline/Aging
- Escalation indicator (amber/red)
- Blocks X

### 4.11.4 Notification list item

**MUST fields shown:**

- Title
- Severity dot
- Type
- Created (relative)
- Read/unread indicator
- Related entity badge

---

## 4.12 Ustawienia (Settings) potrzebne dla C mode (4 narzędzia)

To jest lista ustawień, które C mode może wykorzystywać. Część z nich już istnieje; brakujące można dodać później.

**MUST (już macie fundamenty):**

- Notification preferences (channels/categories/schedule/digests/watchers)
- Work preferences (default due days, auto archive)
- Project/workspace defaults (enable dependencies, itd.)

**SHOULD (jeśli chcemy parity):**

- Default presentation mode per encja (server-side)
- Default rail tab (Activity/Links/Followers)
- Relationship types enabled per workspace/project

---

## 4.13 “Strategic tasks” rule — brak time tracking (KANON)

W Consultify taski są strategiczne i mogą trwać tygodnie.  
Nie mierzymy czasu pracy w metryce “time tracking” w C mode.

**MUST:**

- W UI C mode nie pokazujemy timera/worklog jako podstawowej funkcji.
- Planowanie odbywa się przez:
  - `dueDate` (deadline),
  - milestone’y (w inicjatywie),
  - status/blocked,
  - governance (decisions/gates).

**SHOULD:**

- `estimatedHours` może pozostać jako _opcjonalny hint capacity_ w module Execution/Workload, ale nie jako core UX w C mode.

---

## 4.14 C mode — standard ekranu (KANON, minimalistyczny)

Ten rozdział standaryzuje C mode jako **jeden wzorzec pracy** dla 4 narzędzi:

- Initiative
- Task
- Decision
- Notification

Cel: identyczna ergonomia, minimalizm, szybkość, przewidywalność.  
To ma być „tech‑sexy” przez **spójność i ciszę UI**, nie przez dekoracje.

### 4.14.1 Układ (desktop) — canonical 3-pane

**MUST (docelowo):**

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ HEADER (sticky): Title + Primary actions + Chat + [Mode switcher] + AI        │
├───────────────────────────────────────────────────────────────────────────────┤
│ COMMAND BAR (sticky): hot fields + quick actions                              │
├──────────────┬───────────────────────────────────────────────┬───────────────┤
│ LIST PANE    │ CENTER (Tabs + TabContent)                     │ RIGHT RAIL     │
│ (context)    │                                               │ (Activity/     │
│              │                                               │ Links/Followers│
├──────────────┴───────────────────────────────────────────────┴───────────────┤
│ (optional) Bulk bar for list selections                                      │
└───────────────────────────────────────────────────────────────────────────────┘
```

**MUST (MVP):** jeśli 3-pane nie jest wdrożone od razu, zostaje 2-pane:

- Center (Tabs)
- Right rail (Activity/Links/Followers)

### 4.14.2 Minimalizm UI (MUST / MUST NOT)

**MUST:**

- 1 główny punkt sterowania polami = **CommandBar + FieldsPane** (bez duplikatów w treści).
- 1 główny punkt pracy merytorycznej = **Tabs**.
- Right rail = narzędzia pomocnicze (Activity/Links/Followers), nie “druga wersja tabów”.
- Każdy tab ma jasny “top-of-tab” (nagłówek + 1–2 kluczowe callouty) i dopiero potem treść.

**MUST NOT:**

- nie używamy akordeonów w C mode (to jest tylko dla `D`).
- nie robimy “cards in cards” (zagnieżdżanie ramek) — max 1 poziom kontenera.
- nie dublujemy tych samych pól:
  - np. status nie może być jednocześnie w CommandBar i w treści Overview jako edytowalny.
- nie używamy ciężkich gradientów w tab content (gradienty tylko w headerze zgodnie z Golden Standard).

### 4.14.3 Standardy gęstości i rytmu

**MUST:**

- UI ma być “tight but breathable”:
  - małe, czytelne nagłówki sekcji w tabach,
  - subtelne separatory (thin borders),
  - spójne paddingi (zgodnie z 4.4.1).

**SHOULD:**

- w tabach preferuj “sections with dividers” zamiast “cards”.
- callouty tylko dla:
  - BLOCKED / overdue / escalated,
  - Consequences of inaction,
  - gate readiness warnings.

### 4.14.4 Standard interakcji (enterprise)

**MUST:**

- wszystkie quick actions mają:
  - disabled state + tooltip “why disabled”,
  - potwierdzenie dla destructive (archive/delete),
  - zapis do Activity.
- switch mode (D/N/C) nie może gubić draftu/kontekstu (patrz rozdz. 5).

**SHOULD:**

- keyboard shortcuts jak w 4.3.5 działają konsekwentnie w każdym narzędziu.

### 4.14.5 Standard “FieldsPane vs RightRail”

Żeby UI było minimalistyczne, rozdzielamy role paneli:

- **FieldsPane** (control): pola encji + walidacje + governance fields.
- **RightRail** (utility): activity, links, followers.

**MUST:** RightRail nie zawiera edycji core pól (status/owner/due/priority). To jest w CommandBar/FieldsPane.

### 4.14.6 “Tech‑sexy minimal” — checklist implementacyjny (MUST)

**MUST:**

- CommandBar jest zawsze widoczny (sticky) i ma stałą wysokość (bez “pływania” layoutu).
- Tabs są zawsze w tym samym miejscu (pod CommandBar), niezależnie od encji.
- Tab content nie robi „ściany tekstu”:
  - długie treści → sekcje + spis (opcjonalnie) lub anchors,
  - tabelki → zgodnie ze standardem tabel.
- Empty states są “quiet” (1 linia tytułu + 1 linia opisu + 1 CTA max).
- Ikony: jedna semantyka na całą aplikację (te same piktogramy dla: status, priority, due, link, follower, activity).
- Zawsze wspieramy pracę klawiaturą:
  - fokus jest czytelny,
  - `Esc` zamyka dropdown/modal,
  - `Enter` zatwierdza,
  - `Ctrl/Cmd+K` otwiera command palette (jeśli wdrożone).

**SHOULD (micro‑polish, premium feel):**

- “Inline save confidence”:
  - przy inline edit pokazujemy subtelny stan `Saving…` w miejscu edycji,
  - po sukcesie krótki “Saved” (toast tylko gdy to znacząca akcja; nie spamować).
- “Toast discipline”:
  - toasty tylko dla: błędy, akcje destrukcyjne, gate decisions, sukcesy “duże”.
  - drobne auto-save → bez toastów (cichy UI).
- “Glass hint” (bardzo subtelnie):
  - CommandBar/FieldsPane mogą mieć delikatny glass surface w dark mode (zgodnie z tokenami HIG),
  - ale tylko jeśli nie pogarsza czytelności.
- “Icon micro-contrast”:
  - ikony w kontrolkach mają spójny rozmiar (14–16) i spójny kolor (neutral → active primary).

**MUST NOT:**

- nie wolno “przyklejać” nowych przycisków do headera, jeśli nie są globalnie wspólne dla 4 narzędzi.
- nie wolno przenosić core pól do RightRail (żeby “zaoszczędzić miejsce”) — to łamie minimalizm przez chaos.

---

## 4.15 C mode — standard “pracy” per narzędzie (what users do)

To są kanoniczne „happy paths” — UI i dane muszą je wspierać bez tarcia.

### 4.15.1 Initiative — happy paths

- Planowanie:
  - ustawić ownerów + priorytet + daty (CommandBar/FieldsPane),
  - uzupełnić overview (tab Overview),
  - zbudować plan (tab Plan: tasks/milestones),
  - zarejestrować RAID (tab RAID),
  - przygotować gate readiness i decyzje (tab Decisions & gates).
- Governance:
  - wykonywać gate action,
  - widzieć “pending decisions” i eskalacje,
  - generować audyt/zgodność.

### 4.15.2 Task — happy paths

- Ustawić assignee + due + priorytet.
- Wypełnić brief i expected outcome.
- Zamknąć checklistę/subtasks.
- Jeśli BLOCKED:
  - widzieć blocker i next action,
  - link do decyzji lub relacji “waiting on”.

### 4.15.3 Decision — happy paths

- Wypełnić context/problem.
- Uzupełnić options (tabela) i rekomendację.
- Uzupełnić consequences of inaction (callout always).
- Approve/Reject/Delegate/Escalate z audit trail.

### 4.15.4 Notification — happy paths

- Zobaczyć sygnał (what/why/blocked) i wykonać primary CTA.
- Snooze/mute (triage) bez utraty kontekstu.
- Przejść do źródła (open task/decision/initiative).

---

## 5) Shared header switcher — spec implementacyjna (MUST)

Przełącznik trybu prezentacji jest częścią wspólnego headera detail view.

### 5.1 Placement i UX

**MUST:**

- 3 ikony/przyciski są **pomiędzy `Chat` a `AI`**.
- Każdy przycisk ma:
  - tooltip (np. “D mode”, “N mode”, “C mode”),
  - stan aktywny (accent purple),
  - pełną obsługę klawiatury (tab/focus/enter/space).

### 5.2 Behavior

**MUST:**

- klik → zmiana trybu natychmiast (bez reloadu)
- tryb zapisywany do preferencji (patrz 0.4.3)
- zachowanie:
  - nie gubi draftu
  - nie gubi scroll (best-effort)
  - nie zmienia kontekstu czatu

### 5.3 API komponentu (proponowane)

```ts
type PresentationMode = 'd' | 'n' | 'c';

type PresentationModeSwitcherProps = {
  value: PresentationMode;
  onChange: (mode: PresentationMode) => void;
  disabled?: boolean;
};
```

---

## 6) Test plan (high-signal, bez kodu)

### 6.1 Smoke tests (manual)

- Dla każdej encji:
  - otwórz detail
  - przełącz `D → N → C → D`
  - sprawdź: title/header bez zmian, Chat działa, dane widoczne, brak utraty zmian

### 6.2 E2E (minimum)

- Task:
  - edycja pola → przełączenie trybu → nadal dirty → Save → persist
- Decision:
  - delegation/escalation → przełączenie trybu → activity log pokazuje zdarzenie
- Notification:
  - snooze/mark read → przełączenie trybu → stan się nie cofa
- Initiative:
  - embedded Tasks view: add/link → przełączenie trybu → element widoczny

---

## 7) i18n + copy deck (PL/EN) — implementation-ready

Ta sekcja definiuje teksty i i18n keys dla D/N/C presentation modes oraz przełącznika trybów.

### 7.1 i18n keys — konwencja

**MUST:**

- Keys są stabilne i nie zależą od nazwy encji w kodzie.
- Preferuj strukturę:
  - `detailView.modes.*`
  - `detailView.sections.<entity>.<sectionId>.*`
  - `detailView.properties.<entity>.<fieldKey>.*`
  - `embeddedView.<type>.*`

### 7.2 Presentation mode switcher — teksty

| Key                          | PL                                                         | EN                                                          |
| ---------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------- |
| `detailView.modes.d.label`   | D                                                          | D                                                           |
| `detailView.modes.n.label`   | N                                                          | N                                                           |
| `detailView.modes.c.label`   | C                                                          | C                                                           |
| `detailView.modes.d.tooltip` | D presentation mode: sekcje zwijane (2/3 + 1/3)            | D presentation mode: collapsible sections (2/3 + 1/3)       |
| `detailView.modes.n.tooltip` | N presentation mode: nawigacja + treść strony + properties | N presentation mode: navigation + page content + properties |
| `detailView.modes.c.tooltip` | C presentation mode: command bar + taby + pola             | C presentation mode: command bar + tabs + fields            |

### 7.3 D mode — common actions (PL/EN)

> Keys: `detailView.d.*`

| Key                        | PL              | EN           |
| -------------------------- | --------------- | ------------ |
| `detailView.d.expandAll`   | Rozwiń wszystko | Expand all   |
| `detailView.d.collapseAll` | Zwiń wszystko   | Collapse all |
| `detailView.d.showAll`     | Pokaż wszystko  | Show all     |
| `detailView.d.showLess`    | Pokaż mniej     | Show less    |

### 7.2.1 C mode — tab labels (PL/EN)

> Keys: `detailView.tabs.<entity>.<tabId>`

#### Task

| Key                                 | PL                   | EN                   |
| ----------------------------------- | -------------------- | -------------------- |
| `detailView.tabs.task.overview`     | Przegląd             | Overview             |
| `detailView.tabs.task.checklist`    | Checklista           | Checklist            |
| `detailView.tabs.task.dependencies` | Zależności           | Dependencies         |
| `detailView.tabs.task.decisions`    | Decyzje              | Decisions            |
| `detailView.tabs.task.risks`        | Ryzyka i alternatywy | Risks & alternatives |
| `detailView.tabs.task.ai`           | AI                   | AI                   |
| `detailView.tabs.task.comments`     | Komentarze           | Comments             |
| `detailView.tabs.task.activity`     | Historia             | Activity             |
| `detailView.tabs.task.files`        | Pliki                | Files                |

#### Decision

| Key                                    | PL             | EN            |
| -------------------------------------- | -------------- | ------------- |
| `detailView.tabs.decision.overview`    | Przegląd       | Overview      |
| `detailView.tabs.decision.options`     | Opcje          | Options       |
| `detailView.tabs.decision.impact_risk` | Wpływ i ryzyko | Impact & risk |
| `detailView.tabs.decision.ai`          | AI             | AI            |
| `detailView.tabs.decision.governance`  | Governance     | Governance    |
| `detailView.tabs.decision.comments`    | Komentarze     | Comments      |
| `detailView.tabs.decision.activity`    | Historia       | Activity      |
| `detailView.tabs.decision.files`       | Pliki          | Files         |

#### Notification

| Key                                     | PL       | EN       |
| --------------------------------------- | -------- | -------- |
| `detailView.tabs.notification.overview` | Przegląd | Overview |
| `detailView.tabs.notification.action`   | Akcja    | Action   |
| `detailView.tabs.notification.ai`       | AI       | AI       |
| `detailView.tabs.notification.context`  | Kontekst | Context  |
| `detailView.tabs.notification.activity` | Historia | Activity |

#### Initiative

| Key                                               | PL                    | EN                   |
| ------------------------------------------------- | --------------------- | -------------------- |
| `detailView.tabs.initiative.overview`             | Przegląd              | Overview             |
| `detailView.tabs.initiative.plan`                 | Plan                  | Plan                 |
| `detailView.tabs.initiative.timeline_resources`   | Terminy i zasoby      | Timeline & resources |
| `detailView.tabs.initiative.raid`                 | RAID                  | RAID                 |
| `detailView.tabs.initiative.decisions_governance` | Decyzje i bramki      | Decisions & gates    |
| `detailView.tabs.initiative.economics_value`      | Wartość i ekonomika   | Value & economics    |
| `detailView.tabs.initiative.comments_activity`    | Komentarze i historia | Comments & activity  |
| `detailView.tabs.initiative.files`                | Pliki                 | Files                |

### 7.2.2 C mode — CommandBar field labels (PL/EN)

> Keys: `detailView.commandBar.<entity>.<fieldKey>`

| Key                                           | PL        | EN       |
| --------------------------------------------- | --------- | -------- |
| `detailView.commandBar.common.status`         | Status    | Status   |
| `detailView.commandBar.common.priority`       | Priorytet | Priority |
| `detailView.commandBar.common.owner`          | Owner     | Owner    |
| `detailView.commandBar.common.assignee`       | Osoba     | Assignee |
| `detailView.commandBar.common.decider`        | Decydent  | Decider  |
| `detailView.commandBar.common.dueDate`        | Termin    | Due date |
| `detailView.commandBar.notification.severity` | Severity  | Severity |

### 7.2.3 C mode — quick actions (PL/EN)

> Keys: `detailView.actions.<actionId>`

| Key                              | PL            | EN           |
| -------------------------------- | ------------- | ------------ |
| `detailView.actions.aiAssist`    | AI Assist     | AI Assist    |
| `detailView.actions.approve`     | Zatwierdź     | Approve      |
| `detailView.actions.reject`      | Odrzuć        | Reject       |
| `detailView.actions.delegate`    | Deleguj       | Delegate     |
| `detailView.actions.escalate`    | Eskaluj       | Escalate     |
| `detailView.actions.requestInfo` | Poproś o info | Request info |
| `detailView.actions.block`       | Zablokuj      | Block        |
| `detailView.actions.unblock`     | Odblokuj      | Unblock      |
| `detailView.actions.markDone`    | Zakończ       | Mark done    |
| `detailView.actions.markRead`    | Przeczytane   | Mark read    |
| `detailView.actions.snooze`      | Odłóż         | Snooze       |
| `detailView.actions.mute`        | Wycisz        | Mute         |
| `detailView.actions.delete`      | Usuń          | Delete       |
| `detailView.actions.openSource`  | Otwórz źródło | Open source  |

### 7.2.4 C mode — right rail tabs (PL/EN)

> Keys: `detailView.rail.<tabId>`

| Key                          | PL            | EN         |
| ---------------------------- | ------------- | ---------- |
| `detailView.rail.activity`   | Aktywność     | Activity   |
| `detailView.rail.links`      | Linki         | Links      |
| `detailView.rail.followers`  | Obserwujący   | Followers  |
| `detailView.rail.automation` | Automatyzacje | Automation |

### 7.2.5 C mode — relationship types (PL/EN)

> Keys: `detailView.relationships.type.<type>`

| Key                                        | PL              | EN            |
| ------------------------------------------ | --------------- | ------------- |
| `detailView.relationships.type.link_task`  | Powiąż task     | Link task     |
| `detailView.relationships.type.waiting_on` | Czeka na        | Waiting on    |
| `detailView.relationships.type.blocking`   | Blokuje         | Blocking      |
| `detailView.relationships.type.link_doc`   | Powiąż dokument | Link doc      |
| `detailView.relationships.type.link_url`   | Podłącz URL     | Connect a URL |
| `detailView.relationships.type.custom`     | Niestandardowe  | Custom        |

### 7.2.6 C mode — activity filters (PL/EN)

> Keys: `detailView.activityFilters.<filterId>`

| Key                                        | PL          | EN            |
| ------------------------------------------ | ----------- | ------------- |
| `detailView.activityFilters.all`           | Wszystko    | All           |
| `detailView.activityFilters.comments`      | Komentarze  | Comments      |
| `detailView.activityFilters.status`        | Status      | Status        |
| `detailView.activityFilters.assignments`   | Przypisania | Assignments   |
| `detailView.activityFilters.attachments`   | Załączniki  | Attachments   |
| `detailView.activityFilters.dependencies`  | Zależności  | Dependencies  |
| `detailView.activityFilters.relationships` | Relacje     | Relationships |
| `detailView.activityFilters.watchers`      | Obserwujący | Watchers      |

### 7.3 Common UI microcopy

| Key                                      | PL                    | EN                |
| ---------------------------------------- | --------------------- | ----------------- |
| `detailView.sections.search.placeholder` | Szukaj sekcji…        | Search sections…  |
| `detailView.jumpToSection.title`         | Przejdź do sekcji     | Jump to section   |
| `detailView.copySectionLink`             | Kopiuj link do sekcji | Copy section link |
| `detailView.openFull`                    | Otwórz pełny widok    | Open full view    |
| `detailView.add`                         | Dodaj                 | Add               |
| `detailView.linkExisting`                | Podłącz istniejące    | Link existing     |
| `detailView.retry`                       | Spróbuj ponownie      | Retry             |

### 7.4 Embedded views — empty/loading/error copy

| View      | Key                                  | PL                                                           | EN                                               |
| --------- | ------------------------------------ | ------------------------------------------------------------ | ------------------------------------------------ |
| Tasks     | `embeddedView.tasks.empty.title`     | Brak zadań                                                   | No tasks                                         |
| Tasks     | `embeddedView.tasks.empty.body`      | Dodaj pierwsze zadanie lub podłącz istniejące.               | Add the first task or link an existing one.      |
| Decisions | `embeddedView.decisions.empty.title` | Brak decyzji                                                 | No decisions                                     |
| Decisions | `embeddedView.decisions.empty.body`  | Utwórz decyzję lub podłącz istniejącą, aby odblokować pracę. | Create or link a decision to unblock work.       |
| RAID      | `embeddedView.raid.empty.title`      | Brak wpisów RAID                                             | No RAID entries                                  |
| RAID      | `embeddedView.raid.empty.body`       | Dodaj ryzyka, problemy, założenia lub zależności.            | Add risks, issues, assumptions, or dependencies. |
| Generic   | `embeddedView.loading`               | Ładowanie…                                                   | Loading…                                         |
| Generic   | `embeddedView.error`                 | Nie udało się załadować danych.                              | Failed to load data.                             |

---

## 8) Properties spec per encja (N mode) — field keys, control types, validation

**Zasada:** PropertiesStrip to “sterowanie” w N mode i musi być spójny między encjami.

### 8.1 Field types (kontrolki) — katalog

- `badge` — read-only pill (np. `#task-123`)
- `select` — dropdown (status, severity, priority)
- `user` — user picker (owner/assignee/decider)
- `date` — date/datetime picker (due/start/SLA)
- `tags` — multi-select chips
- `relation` — link do encji (initiative/project/task/decision)
- `number` — numeric (budget, ROI)
- `progress` — slider/readonly progress
- `text` — krótkie pole (value statement, placement reason)

### 8.2 Initiative (based on `FullInitiative` in `src/types/core.ts`)

**MUST fields:**

| Field key          | Type       | Source field(s)                          | Validation                       | Notes                                                                            |
| ------------------ | ---------- | ---------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| `status`           | `select`   | `status`                                 | required                         | kanoniczny `InitiativeStatus`                                                    |
| `priority`         | `select`   | `priority`                               | required                         | mapowanie: `High/Medium/Low/Critical` ↔ kanon CRITICAL/HIGH/MEDIUM/LOW (adapter) |
| `ownerBusinessId`  | `user`     | `ownerBusinessId` / `ownerBusiness`      | required in governance phases    | wyświetl person chip                                                             |
| `ownerExecutionId` | `user`     | `ownerExecutionId` / `ownerExecution`    | required from planning/execution |                                                                                  |
| `plannedStartDate` | `date`     | `plannedStartDate`                       | optional                         |                                                                                  |
| `plannedEndDate`   | `date`     | `plannedEndDate`                         | optional                         | end ≥ start                                                                      |
| `riskPosture`      | `select`   | computed from `keyRisks`/riskScore       | optional                         | LOW/MED/HIGH                                                                     |
| `tags`             | `tags`     | `patternTags` + `waveName` + domain tags | optional                         | scalone w 1 UI                                                                   |
| `project`          | `relation` | `projectId` / `projectName`              | optional                         | open project                                                                     |

**SHOULD fields:**

| Field key           | Type       | Source field(s)     | Validation | Notes                    |
| ------------------- | ---------- | ------------------- | ---------- | ------------------------ |
| `decisionReadiness` | `progress` | `decisionReadiness` | 0–100      | governance readiness bar |
| `completenessScore` | `progress` | `completenessScore` | 0–100      | completeness             |
| `valueStatement`    | `text`     | `valueStatement`    | optional   | executive value          |
| `capex`             | `number`   | `capex`/`costCapex` | >=0        | economics                |
| `annualBenefit`     | `number`   | `annualBenefit`     | >=0        | economics                |
| `roi`               | `number`   | `roi`/`expectedRoi` | optional   | percent                  |
| `slaDeadline`       | `date`     | `slaDeadline`       | optional   | SLA indicator            |

### 8.3 Task (based on `Task` in `src/types/core.ts`)

**MUST fields:**

| Field key    | Type       | Source field(s)                   | Validation                  | Notes                          |
| ------------ | ---------- | --------------------------------- | --------------------------- | ------------------------------ |
| `status`     | `select`   | `status`                          | required                    | `TaskStatus`                   |
| `priority`   | `select`   | `priority`                        | required                    | `low/medium/high/urgent`       |
| `ownerId`    | `user`     | `ownerId`                         | required for accountability | if empty, fallback to assignee |
| `assigneeId` | `user`     | `assigneeId` / `assignee`         | required for execution      |                                |
| `dueDate`    | `date`     | `dueDate`                         | optional                    |                                |
| `startedAt`  | `date`     | `startedAt`                       | optional                    |                                |
| `initiative` | `relation` | `initiativeId` / `initiativeName` | optional                    | open initiative                |
| `tags`       | `tags`     | `tags`                            | optional                    |                                |

**SHOULD fields:**

| Field key            | Type       | Source field(s)      | Validation                 | Notes             |
| -------------------- | ---------- | -------------------- | -------------------------- | ----------------- |
| `progress`           | `progress` | `progress`           | 0–100                      |                   |
| `blockedReason`      | `text`     | `blockedReason`      | required if status=BLOCKED | show inline error |
| `estimatedHours`     | `number`   | `estimatedHours`     | >=0                        |                   |
| `requiresAcceptance` | `select`   | `requiresAcceptance` | optional                   | manual/auto       |

### 8.4 Decision (based on `Decision` in `src/types/core.ts`)

**MUST fields:**

| Field key         | Type       | Source field(s)                       | Validation | Notes              |
| ----------------- | ---------- | ------------------------------------- | ---------- | ------------------ |
| `status`          | `select`   | `status`                              | required   | `DecisionStatus`   |
| `decisionOwnerId` | `user`     | `decisionOwnerId`                     | required   | “decider”          |
| `dueDate`         | `date`     | `dueDate`                             | optional   | deadline decyzji   |
| `escalationLevel` | `select`   | `escalationLevel`                     | optional   | NONE/AMBER/RED     |
| `impact`          | `select`   | `impact`                              | optional   | LOW/MED/HIGH       |
| `relatedObject`   | `relation` | `relatedObjectType`+`relatedObjectId` | required   | open linked entity |

**SHOULD fields:**

| Field key      | Type     | Source field(s) | Validation | Notes                           |
| -------------- | -------- | --------------- | ---------- | ------------------------------- |
| `decisionType` | `select` | `decisionType`  | required   | INITIATIVE_APPROVAL/UNBLOCK/... |
| `required`     | `badge`  | `required`      | n/a        | governance required             |

### 8.5 Notification (based on `Notification` in `src/types/core.ts`)

**MUST fields:**

| Field key       | Type       | Source field(s)                       | Validation | Notes                 |
| --------------- | ---------- | ------------------------------------- | ---------- | --------------------- |
| `severity`      | `select`   | `severity`                            | required   | INFO/WARNING/CRITICAL |
| `type`          | `select`   | `type`                                | required   | NotificationType      |
| `category`      | `select`   | derived                               | optional   | map to UI categories  |
| `createdAt`     | `badge`    | `createdAt`                           | n/a        | read-only             |
| `relatedObject` | `relation` | `relatedObjectType`+`relatedObjectId` | optional   | open source           |
| `isRead`        | `badge`    | `isRead`                              | n/a        | read-only             |

**SHOULD fields:**

| Field key   | Type    | Source field(s)           | Validation | Notes    |
| ----------- | ------- | ------------------------- | ---------- | -------- |
| `actionUrl` | `badge` | `actionUrl` / `data.link` | optional   | external |
| `expiresAt` | `badge` | `expiresAt`               | optional   |          |

---

## 9) Embedded views presets (N mode + C mode) — views, filters, sorts

### 9.1 Preset names (shared)

**MUST preset IDs:**

- `table`
- `board`
- `timeline`
- (optional) `compact`

### 9.2 Initiative embedded views

#### Tasks embedded

- **Default view**: `table`
- **Available**: `table`, `board`, `timeline`
- **Default filter**: `initiativeId = current`
- **Default sort**: `priority desc`, `dueDate asc`, `status asc`
- **Columns**: Title, Status, Assignee, Priority, Due/Aging, Blocker, Next action

#### Decisions embedded

- **Default view**: `table`
- **Filter**: `relatedObjectId = initiativeId` OR explicit link table
- **Sort**: `escalationLevel desc`, `dueDate asc`
- **Columns**: Title, Decider, Status, Deadline/Aging, Blocks X, Next action

#### RAID embedded

- **Default view**: `table`
- **Filter**: `initiativeId = current`
- **Sort**: `severity desc`, `dueDate asc`
- **Columns**: Type, Title, Owner, Severity, Due/Aging, Status, Next action

### 9.3 Task embedded views

- **Related decisions**: table, filter by `relatedObjectType=TASK` + `relatedObjectId=taskId`
- **Dependencies**: list/graph view (if graph exists), else compact list with “blocks/blocked by”
- **Attachments**: list with preview/open

### 9.4 Decision embedded views

- **Blocks / Linked items**: table of linked tasks/initiatives with status and due
- **Options**: inline table (Option, Pros, Cons, Risk, Cost, Recommendation flag)

### 9.5 Notification embedded views

- **Expected action**: checklist block
- **Related items**: compact list/table with type, title, status, due

---

## 10) Validation rules (cross-mode, enterprise)

### 10.1 Required-by-status (initiatives)

**MUST (gate-ready rules):**

- Jeśli status inicjatywy przechodzi do faz wymagających governance (np. `PLANNING/APPROVED/SCHEDULED`), UI musi walidować:
  - owners przypisani,
  - daty (jeśli wymagane),
  - minimalne artefakty (scope/success criteria) — zgodnie z kanonem workflow.

### 10.2 Task BLOCKED rule

**MUST:**

- `blockedReason` required gdy status = BLOCKED.

### 10.3 Decision “Consequences of Inaction”

**MUST:**

- Blok istnieje zawsze; jeśli puste, pokazujemy empty prompt (“Uzupełnij konsekwencje braku decyzji…”).

---

## 11) Backend/API contracts (implementation-ready, bez zgadywania)

Ta sekcja opisuje minimalne endpointy i kontrakty danych wymagane do wdrożenia N/C mode (w szczególności: Right Rail, Activity, Watchers, Relationships).

> **Zasada:** UI może startować od adapterów (mapowanie legacy), ale kontrakt docelowy musi być stabilny i wspólny dla 4 narzędzi.

### 11.1 Activity / Audit stream (Right Rail)

**MUST endpoints:**

- `GET /api/activity`
  - query:
    - `entityType=task|decision|initiative|notification`
    - `entityId=<id>`
    - `types=<comma-separated eventType>` (opcjonalne filtry)
    - `limit`, `cursor` (paginacja)
- `POST /api/activity/track` _(opcjonalne dla klienta; zwykle backend emituje automatycznie)_

**MUST response shape:**

```ts
type ActivityEvent = {
  id: string;
  entityType: 'task' | 'decision' | 'initiative' | 'notification';
  entityId: string;
  eventType: string; // zgodne z taksonomią z 4.8.3
  createdAt: string;
  actor?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
  summary?: string; // krótkie zdanie do UI
  metadata?: Record<string, unknown>; // diff, ids relacji itp.
  anchorId?: string; // jeśli da się “jump to section”
};
```

**MUST behavior:**

- Eventy muszą powstawać automatycznie dla:
  - status/priorities/dates/ownership changes,
  - watchers changes,
  - relationships changes,
  - archive/delete,
  - comments/attachments,
  - gates/decisions (dla initiatives).

### 11.2 Watchers / Followers

**MUST endpoints (dla każdej encji):**

- `GET /api/<entity>/<id>/watchers`
- `POST /api/<entity>/<id>/watchers`
  - body: `{ userId?: string; notifyOn?: 'all'|'mentions'|'status_changes' }`
- `DELETE /api/<entity>/<id>/watchers/<watcherId>`

Gdzie `<entity>` ∈ `tasks | decisions | initiatives | notifications`.

**MUST response shape:**

```ts
type Watcher = {
  id: string;
  userId: string;
  notifyOn: 'all' | 'mentions' | 'status_changes';
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
};
```

**MUST behavior:**

- dodanie/usunięcie watcher generuje event w Activity.

### 11.3 Relationships (waiting on / blocking / link url / link doc)

**MUST endpoints (wspólne, aby uniknąć 4 implementacji):**

- `GET /api/relationships?sourceType=<>&sourceId=<>`
- `POST /api/relationships`
  - body: `{ sourceType, sourceId, type, target }`
- `DELETE /api/relationships/<id>`

**MUST request/response:**

- Request/response używa schematu z rozdziału **4.9.2**.

**MUST behavior:**

- `waiting_on` / `blocking` ma wpływać na UI “blocked/waiting” (przynajmniej informacyjnie).
- Zmiany relacji generują event w Activity.

### 11.4 Links (URL previews)

**MUST:**

- `link_url` musi działać bez preview (fallback) — preview jest best-effort.

**SHOULD endpoints (opcjonalnie):**

- `POST /api/link-preview` body: `{ url }` → `{ title?, image?, siteName? }`

### 11.5 Presentation mode preference (server-side, cross-device)

**SHOULD endpoint:**

- `GET /api/users/me/prefs/presentation-modes`
- `PUT /api/users/me/prefs/presentation-modes`
  - body: `{ task: PresentationMode; decision: PresentationMode; notification: PresentationMode; initiative: PresentationMode }`

Fallback (MUST): localStorage jeśli server-side niegotowe.

---

## 12) Data model & migrations (compatibility-first)

### 12.1 Relationships storage

**MUST:**

- Relacje są przechowywane w osobnej tabeli (lub kolekcji), aby:
  - wspierać różne target kinds (task/decision/initiative/project/url/doc),
  - mieć audyt,
  - mieć indeksy pod query.

**MUST indexes:**

- `(sourceType, sourceId)`
- `(target.kind, target.id)` dla encji wewnętrznych
- `type` (opcjonalnie)

### 12.2 Activity storage

**MUST:**

- Activity jest append-only (audyt).
- Paginacja cursor-based.

### 12.3 Watchers storage

**MUST:**

- Watchers per (entityType, entityId, userId) unikalne.

### 12.4 Backward compatibility

**MUST:**

- Jeśli istnieją już:
  - dependencies tylko w `Task.dependencies`,
  - linked items w osobnych polach,
  - watchers tylko dla initiatives,

to adapter w UI powinien:

- najpierw czytać docelowy kontrakt (`/relationships`, `/watchers`),
- a jeśli nie dostępny — fallback na legacy pola, bez psucia UX.

---

### 12.5 Adapter / normalization layer (legacy → kanon) (MUST)

To jest krytyczne, żeby C mode / N mode były **spójne wizualnie i semantycznie** mimo rozjazdów typów:

- kanon w `src/types/core.ts` (enumy: `InitiativeStatus`, `TaskStatus`, `DecisionStatus`, `NotificationSeverity`)
- uproszczone API modele w `src/services/api/*.api.ts` (np. statusy lowercase, inne priorytety)
- legacy aliasy w polach `data` (np. w notyfikacjach)

**Zasada:** UI pracuje na **jednym zestawie wartości kanonicznych**. Adapter robi:

- normalizację inputu (read),
- normalizację outputu (write) do tego, co backend aktualnie akceptuje.

#### 12.5.1 Canonical “UI enums” (dla spójnych badge’ów)

**MUST:**

- `UiPriority` (globalnie, dla badge’ów): `CRITICAL | HIGH | MEDIUM | LOW`
- `UiSeverity` (notyfikacje): `CRITICAL | WARNING | INFO`
- `UiHealth` (opcjonalnie, dla initiative/task): `ON_TRACK | AT_RISK | BLOCKED`

**MUST:** C mode używa `UiPriority/UiSeverity` w badge’ach niezależnie od źródła danych.

#### 12.5.2 Input normalization (read) — reguły ogólne

**MUST:**

- Normalizuj stringi zanim mapujesz:
  - `trim`
  - `toUpperCase()`
  - zamień `-` na `_`
- Jeśli pole kanoniczne istnieje (np. `notification.severity`) → ono wygrywa.
- Jeśli kanoniczne pole nie istnieje → fallback na:
  - legacy aliasy (`notification.data.priority`, `notification.data.link`, itp.)
  - modele z `src/services/api/*.api.ts`

#### 12.5.3 Initiative — mapping status + priority

Źródła:

- Kanon: `InitiativeStatus` (13 statusów, uppercase)
- API: `src/services/api/initiatives.api.ts` status: `draft|planning|active|completed|cancelled`

**MUST mapping (read):**

| API (legacy) | Canonical `InitiativeStatus` | Notes                 |
| ------------ | ---------------------------- | --------------------- |
| `draft`      | `DRAFT`                      |                       |
| `planning`   | `PLANNING`                   |                       |
| `active`     | `EXECUTING`                  | “active” = praca trwa |
| `completed`  | `DONE`                       |                       |
| `cancelled`  | `CANCELLED`                  |                       |

**MUST mapping (priority read):**

| API/legacy priority                  | `UiPriority` / canonical initiative priority | Notes |
| ------------------------------------ | -------------------------------------------- | ----- |
| `low` / `LOW` / `Low`                | `LOW`                                        |       |
| `medium` / `MEDIUM` / `Medium`       | `MEDIUM`                                     |       |
| `high` / `HIGH` / `High`             | `HIGH`                                       |       |
| `critical` / `CRITICAL` / `Critical` | `CRITICAL`                                   |       |

**SHOULD (write):**

- Jeżeli endpoint acceptuje kanon (uppercase) → wysyłaj kanon.
- Jeśli dany endpoint nadal oczekuje lowercase (jak w `InitiativeApi`) → adapter mapuje w drugą stronę:
  - `EXECUTING` → `active`
  - `DONE` → `completed`
  - reszta zgodnie z tabelą wyżej

#### 12.5.4 Task — mapping status + priority (critical vs urgent)

Źródła:

- Kanon: `TaskStatus` = `TODO | IN_PROGRESS | BLOCKED | DONE`
- API: `src/services/api/tasks.api.ts` status: `todo|in_progress|review|done|blocked`
- Kanon: `TaskPriority` = `low|medium|high|urgent`
- API: `priority` = `low|medium|high|critical`

**MUST mapping (status read):**

| API/legacy task status | Canonical `TaskStatus` | UX Notes                                                                       |
| ---------------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `todo`                 | `TODO`                 |                                                                                |
| `in_progress`          | `IN_PROGRESS`          |                                                                                |
| `review`               | `IN_PROGRESS`          | **nie robimy osobnego statusu** w C mode; opcjonalnie pokaż sub-badge “REVIEW” |
| `blocked`              | `BLOCKED`              | wymaga `blockedReason`                                                         |
| `done`                 | `DONE`                 |                                                                                |

**MUST mapping (priority read):**

| API priority | Canonical `TaskPriority` | UI badge   |
| ------------ | ------------------------ | ---------- |
| `low`        | `low`                    | `LOW`      |
| `medium`     | `medium`                 | `MEDIUM`   |
| `high`       | `high`                   | `HIGH`     |
| `critical`   | `urgent`                 | `CRITICAL` |

**MUST:** w UI C mode pokazujemy task priority jako `UiPriority` (czyli `urgent` renderuje się jako `CRITICAL` badge).

#### 12.5.5 Decision — mapping status

Źródła:

- Kanon: `DecisionStatus` = `PENDING | APPROVED | REJECTED | ESCALATED`

**MUST mapping (read):**

- Jeśli backend zwraca lowercase (`pending`) lub mieszane (`Pending`) → normalizacja + mapowanie na enum.
- Nieznany status → fallback `PENDING` + event w Activity typu `SYSTEM_ALERT` (lub console warn w dev).

#### 12.5.6 Notification — mapping severity (z API priority)

Źródła:

- Kanon: `NotificationSeverity` = `INFO | WARNING | CRITICAL`
- API: `src/services/api/notifications.api.ts` ma `priority: high|normal|low` i brak `severity`
- Kanon `Notification` ma też legacy `data.priority?: string`

**MUST mapping (read):**

1. jeśli `notification.severity` istnieje → użyj.
2. else jeśli `notification.data.priority` istnieje → mapuj jak priority (critical/high/medium/low) na severity:
   - `CRITICAL`/`CRITICAL-like` → `CRITICAL`
   - `HIGH`/`MEDIUM` → `WARNING`
   - `LOW` → `INFO`
3. else mapuj z API `priority`:

| API priority | Canonical `NotificationSeverity` | Notes                         |
| ------------ | -------------------------------- | ----------------------------- |
| `high`       | `CRITICAL`                       | system of pressure            |
| `normal`     | `WARNING`                        | domyślny “action needed soon” |
| `low`        | `INFO`                           | informacyjne                  |

**MUST rendering (severity dot):**

- `INFO` → blue
- `WARNING` → amber
- `CRITICAL` → red

---

## 13) Security / RBAC / audit (enterprise)

**MUST:**

- Wszystkie operacje mutujące:
  - `POST/DELETE watchers`,
  - `POST/DELETE relationships`,
  - archive/delete,
  - gate actions,

muszą być kontrolowane przez backend (RBAC) i zapisywać audyt w Activity.

**SHOULD:**

- Item-level sharing (jeśli wdrażane) jako osobny kontrakt i UI; nie blokuje C mode MVP.

---

## 14) Performance & reliability (enterprise)

**MUST:**

- Right Rail Activity:
  - paginacja (cursor),
  - ograniczenie payloadów,
  - skeleton bez layout shift.
- Links previews:
  - caching + timeout,
  - fallback bez preview.

**SHOULD:**

- Telemetria:
  - czas otwarcia detail,
  - czas przełączenia trybu,
  - ilość eventów w rail,
  - błędy link preview.

---

## Historia zmian

- 2026-02-11: dodano kanoniczny standard 3 trybów prezentacji detail view (D/N/C) + bloki N mode dla Initiative/Task/Decision/Notification.
- 2026-02-11: dopisano spec implementacyjną N mode i C mode (tokeny, kontrakty komponentów, persystencja, mapping, DoD, test plan).
- 2026-02-11: dopisano pełny copy deck i18n, spec properties per encja, presety embedded views oraz reguły walidacji — implementation-ready pod kodowanie.
- 2026-02-11: dopisano kontrakty backend/API, model danych i wymagania enterprise (RBAC/audit/performance) dla C mode (Right Rail, Relationships, Watchers, Activity).
- 2026-02-11: dopisano kanoniczny standard minimalistycznego C mode dla 4 narzędzi (layout + minimalizm + happy paths) oraz adapter/normalization layer (legacy→kanon) dla statusów/priorities/severity.
- 2026-02-12: dodano §2.5.5.1 — standard współdzielonych sekcji N-mode (CommentsCanvas, ActivityLogCanvas, AttachmentsLinksCanvas, RiskCanvas). Pełna specyfikacja w `docs/ui-standards/shared-nmode-sections-standard.md`.
