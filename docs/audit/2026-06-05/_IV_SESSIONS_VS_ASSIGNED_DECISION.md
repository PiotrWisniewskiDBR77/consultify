# Sessions vs Assigned — analiza decyzji architektonicznej

**Data:** 2026-06-05
**Pytanie ownera:** Czy ma sens trzymać Sessions i Assigned w 2 osobnych zakładkach, czy zrobić jedną „wypasioną"? Plus: archiwizacja + usuwanie + skalowanie do 400 ankiet (100 osób × 4 zestawy).

---

## 1. CO DOKŁADNIE RÓŻNI SIĘ DZIŚ (z kodu)

| Aspekt | Sessions tab | Assigned tab |
|---|---|---|
| **Endpoint** | `GET /interview/sessions/managed` | `GET /interview/assignments/managed` |
| **Tabela źródłowa** | `interview_sessions` (LEFT JOIN assignments) | `interview_assignments` (LEFT JOIN sessions) |
| **Co to jest** | Ankieta = obiekt z pytaniami i odpowiedziami | Przypisanie ankiety osobie z deadlinem |
| **Kolumny default** | Name, Status (sesji), Progress, Date | Inbox-like (Assignee, Status, Progress, Days to due) |
| **Można utworzyć bez drugiego?** | TAK — ad-hoc session bez assignmentu (V-A naprawa #104) | NIE — assignment wymaga sessionu (lub go tworzy) |
| **Manager perspektywa** | „Jakie ankiety istnieją w mojej org" | „Komu kazałem co wypełnić" |
| **Po Approve** | Sesja zostaje `status='completed'` | Assignment zostaje `status='approved/completed'` |

**Kluczowy insight:** dla 99% przypadków **session ≈ assignment** (relacja 1:1). Wyjątki:
- Ad-hoc session bez assignmentu (manager tworzy sesję dla siebie, bez przypisania)
- Wielu assignees dla jednej sesji (team_members) — bardzo rzadkie
- Sesja archiwalna bez aktywnego assignmentu — historyczne

---

## 2. ZA i PRZECIW każdej opcji

### OPCJA A — Status quo (2 zakładki: Sessions + Assigned)

**ZA:**
- ✅ **Sesja ≠ assignment** w teorii data model (sesja może istnieć bez assignmentu — ad-hoc, archiwalna). Czysta separacja typów obiektów.
- ✅ **Inne perspektywy filtrowania:** w Sessions filtr po template/project; w Assigned filtr po assignee/due date.
- ✅ Manager może mieć **mental model** „panel kontroli pracy zespołu" (Assigned) vs „katalog ankiet" (Sessions).
- ✅ Dwa różne SQL queries → mniejszy data load per view.

**PRZECIW:**
- ❌ **Duplikacja danych:** 99% sesji ma 1:1 assignment → user widzi tę samą rzecz w 2 miejscach z różnym tytułem kolumn. Owner się dziś gubił („dlaczego mam dwie zakładki na to samo?").
- ❌ **Niespójne statusy:** sesja może być `in_progress`, assignment `submitted` — co manager widzi? W kodzie są normalizery (`normalizeAssignmentStatusForClient`) próbujące to skleić, ale to tworzy bugi (V-A S5: sent_back maskowane jako in_progress).
- ❌ **Duplikacja UI:** dwa hand-written buildery tabel, dwa zestawy filtrów, dwa popovery view-settings → 2× robota na każdą zmianę (np. dodanie kolumny Assignee). To jest dokładnie część kosztu, który płacisz w V-B.
- ❌ Manager przy 400 ankietach **musi pamiętać** czy nawigować przez Sessions czy Assigned aby coś znaleźć. Filtrowanie po assignee dziś jest tylko w Assigned, po template tylko w Sessions.
- ❌ **Bulk actions** musisz dublować (zaznacz 10 w Sessions vs 10 w Assigned). Z punktu widzenia ownera oba robią to samo: „zatwierdź te 10".
- ❌ Manager szuka „wszystko Janka Kowalskiego" — musi przejrzeć obie zakładki, bo Sessions to filtruje słabo.

### OPCJA B — Jedna „wypasiona" zakładka **Work** (sesje+przypisania razem)

**ZA:**
- ✅ **Jeden mental model:** „lista pracy do zrobienia/przejrzenia w mojej org". To jest tak jak Linear ma „Issues", Asana „Tasks" — nie ma osobnej zakładki „Assignments".
- ✅ **Wszystkie filtry razem:** template, project, assignee, status, due, overdue, AI score — wybierasz co chcesz, każdy filtr działa.
- ✅ **Skala na 400 ankiet:** jedna potężna tabela z grupowaniem (`Group by: assignee` / `Group by: template` / `Group by: project`) jak w Linear.
- ✅ **Bulk actions w jednym miejscu:** zaznacz 50, klik „Send back" lub „Approve" → cała robota za jednym razem.
- ✅ **Mniej kodu:** jeden builder tabeli, jeden zestaw filtrów, jeden popover. Spójność jak w Templates → status = jedno.
- ✅ Zgadza się z #10 (filtry per-column) — jeden FilterableTable z bogatymi kolumnami robi wszystko.
- ✅ Ad-hoc sessions bez assignmentu są wciąż widoczne — wystarczy „Assignee: —" w kolumnie.

**PRZECIW:**
- ❌ **Pierwszy raz strome** dla nowego usera (więcej kolumn na start). Mitygacja: domyślnie tylko 5 kolumn widocznych, reszta opt-in.
- ❌ Czyste view „tylko moje pracowite zadania" (Inbox today) vs „kontrola zespołu" wymaga **savedViews** (presets jak w Linear: My Work, Team, Overdue, Awaiting my approval).
- ❌ Migracja danych: trzeba zmergować logikę dwóch endpointów → jedna lista `interview_work_items` z field `kind: 'session' | 'assignment_with_session'`.

### OPCJA C (hybryda) — Sessions zostaje jako „katalog/archiwum", Assigned dostaje wszystkie aktywne

**ZA:**
- ✅ Trochę kompromisu: Assigned = „aktywna praca", Sessions = „historia + ad-hoc".
- ✅ Mniej drastyczna zmiana.

**PRZECIW:**
- ❌ Nadal 2 zakładki z niejasnym podziałem („co tu, co tam").
- ❌ Manager nadal musi przeszukiwać 2 miejsca.
- ❌ Definicja granicy „archiwum" zaczyna się rozjeżdżać (kiedy sesja staje się historyczna?).

---

## 3. REKOMENDACJA: **OPCJA B — Work** ⭐

Zwłaszcza w kontekście 100 osób × 4 zestawy = 400 ankiet — OPCJA B jest jedyna sensowna. Sessions+Assigned osobno przy tej skali = trauma użytkownika.

**Konkretna nazwa zakładki:** zostawiamy **„Sessions"** jako termin (znany), ale wewnątrz pokazujemy **work-items** (kombinację session+assignment). Albo zmieniamy etykietę na **„Work"** / **„Praca"** / **„Ankiety"** — to do owner spec.

Nowy układ zakładek Interview:
```
[Inbox]    [Sessions/Work]    [Templates]    [Insights]    [Initiatives]
   ↑              ↑
moja praca   wszystko co przypisałem + ad-hoc + archiwum
```

**Assigned** znika jako osobna zakładka → staje się **saved view** wewnątrz Sessions (chip „Assigned by me").

---

## 4. ARCHIWIZACJA + USUWANIE — proponowana mechanika (owner spec)

**Stany cyklu życia:**
```
active  →  archived  →  trash  →  deleted_permanently
   ↑          ↓ Restore        ↓ Restore        ↓ (irreversible)
   └──────────┘                └─────────────────┘
```

**Reguły:**

1. **Active** (default view): wszystko co nie jest archived/trashed.
2. **Archived** (klik „Archive"):
   - Soft, reversible.
   - Sesja znika z domyślnych widoków, ale wciąż dostępna w zakładce „Archive" (lub chip).
   - Dane nietknięte, AI snapshot, evidence, odpowiedzi — wszystko czytelne (owner spec: „można przeanalizować co było w archiwach").
   - **Auto-archive po X dniach od approved** — opcjonalna automatyzacja per org.
3. **Trash** (klik „Move to trash" w Archive):
   - Soft, reversible przez 30 dni.
   - Wciąż w bazie, ale niedostępne w UI (poza zakładką Trash).
4. **Permanently delete** (klik „Delete forever" w Trash, lub auto po 30 dniach):
   - Hard delete (z kaskadą: assignments, questions, evidence, AI snapshots, linked items).
   - Owner spec: „jak jest usuwane, to jest usuwane trwale" → wymaga **drugie potwierdzenie** modal („wpisz nazwę sesji aby potwierdzić").

**Implementacja DB (lazy-ensure ALTER):**
```sql
ALTER TABLE interview_sessions ADD COLUMN archived_at TIMESTAMP NULL;
ALTER TABLE interview_sessions ADD COLUMN archived_by UUID NULL;
ALTER TABLE interview_sessions ADD COLUMN trashed_at TIMESTAMP NULL;
ALTER TABLE interview_sessions ADD COLUMN trashed_by UUID NULL;
-- (deletion = DELETE row z cascade)
```

**Filtry w zakładce Work:**
- `Active` (default) → `archived_at IS NULL AND trashed_at IS NULL`
- `Archive` → `archived_at IS NOT NULL AND trashed_at IS NULL`
- `Trash` → `trashed_at IS NOT NULL`

Albo (mniej zaszumione UX): chip-row na górze tabeli `Active 12 · Archive 47 · Trash 3` zamiast osobnej zakładki.

---

## 5. SKALOWANIE: 400 ankiet (100 osób × 4 zestawy) — co MUSI być

Przy tej skali jeden manager nie ogarnie listy 400 wierszy bez:

1. **Saved views (presets)** — najważniejsze:
   - „Awaiting my approval" (submitted, assigned_by=me)
   - „Overdue z mojego zespołu"
   - „Ten miesiąc" (created_at > 30d)
   - „Janek Kowalski" — quick filter per osoba
   - User definiuje własne i pinuje.
2. **Bulk actions** (z #8 + #11):
   - Bulk Approve / Send back (z opcjonalnym wspólnym reason)
   - Bulk Remind
   - Bulk Archive
   - Bulk Reassign (np. „przeładuj wszystkie Janka na Pawła")
3. **Grouping** (jak Linear):
   - Group by Assignee → 100 grup po 4
   - Group by Template → 4 grup po 100
   - Group by Status → 6 grup
   - Group by Project (jeśli multi-project)
4. **Server-side pagination + virtual scroll** — przy 400 wierszach naive render bedzie laggował.
5. **Cross-org dashboard** dla power-managera: jeden widok „cała moja organizacja" z heatmapą overdue.
6. **AI insights na poziomie batcha** (już jest endpoint `evaluate-quality`, ale per pojedyncza sesja):
   - „W tej kohorcie 28 odpowiedzi z 400 są poniżej threshold quality"
   - „Najczęstsze braki: pytanie #3 i #7 — recommend update template"
7. **Export do CSV/Excel z filtrem** — power-user może chcieć przepuścić przez Excel.

---

## 6. PROPOZYCJA KOLEJNOŚCI

**Faza 1 — strukturalne (2-3 dni):**
1. Zmerguj Sessions+Assigned w jedną zakładkę **Work** opartą na FilterableTable (#10 migration kanoniczny komponent).
2. Dodaj wszystkie kolumny z #10 (Assignee, Due, Submitted, Overdue, AI Score itd.).
3. Wprowadź saved views: „My work / Awaiting my approval / Team / Overdue / All".

**Faza 2 — lifecycle (1-2 dni):**
4. ALTER tabeli (archived/trashed columns).
5. Akcje Archive/Trash/Restore/Delete-forever w menu wiersza + bulk.
6. Chip-row filter `Active / Archive / Trash`.

**Faza 3 — skalowanie (2-3 dni):**
7. Grouping (Linear-style).
8. Server-side pagination.
9. Bulk actions (Approve/SendBack/Remind/Reassign).
10. AI insights batch panel.

**Razem: ~1 tydzień skupionej pracy** na to żeby moduł obsłużył 400 ankiet z managerską wygodą.
