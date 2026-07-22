# Testy wypełniania kart N — czy da się nimi PRACOWAĆ

> **Data:** 2026-07-22 · **Gałąź:** `fix/prv-mywork-preview` (worktree `.worktrees/prv-mywork`, baza `origin/demo`)
> **Metoda:** ścieżka użytkownika w harnessie `localhost:3220`, przeglądarka izolowana (Playwright,
> chromium headless, 1600×950, `lang=pl`, `theme=light`). Klikane naprawdę: wpis do pól, przełącznik
> Edycja/Podgląd, menu Sekcje, przyciski AI, dropdowny panelu, przeładowanie strony.
> **To jest analiza. Zero zmian w kodzie.**
> Numery linii = pliki w `.worktrees/prv-mywork` (główny checkout jest na innej gałęzi).

---

## 0. Uczciwie: jak powstał ten dokument i gdzie się pomyliłem

Pierwsze podejście robiłem przez współdzieloną kartę przeglądarki i **dwa razy dostałem wynik
z obcego ekranu** (URL mówił `karta-decision`, treść była z `karta-tool`) — inna sesja sterowała
tą samą kartą. Przerzuciłem się na własną instancję Playwright i wszystkie liczby niżej pochodzą
stamtąd. Gdyby nie ten przeskok, raport byłby zmyślony w połowie.

**Druga, ważniejsza pomyłka — i to jest sedno tego zadania.** Pierwszy przebieg pokazał dla
Decision i Task **zero pól edytowalnych** i **zero zarządzania sekcjami**. Wniosek „karty są
martwe" byłby fałszywy. Powód: obie karty **otwierają się domyślnie w trybie Podgląd**, a ja nie
kliknąłem przełącznika. Po kliknięciu „Edycja" pojawiają się pola, menu Sekcje, usuwanie,
ukrywanie i zmiana kolejności — **wszystko działa**.

To nie mock zasłonił prawdę, tylko **stan domyślny**. Ta sama klasa błędu co wczoraj z Initiative.
Wniosek roboczy: przy każdej karcie N pierwszym ruchem testu musi być przełącznik trybu.

---

## 1. Tabela zbiorcza — 7 kart × 5 zdolności

Legenda: **✅ DZIAŁA** · **⚠️ DZIAŁA CZĘŚCIOWO** · **❌ NIE DZIAŁA** · **N/D** (świadomie nieobecne)

| Karta | 1. Edycja | 2. Sekcje | 3. AI | 4. Panel | 5. Pusty stan |
|---|---|---|---|---|---|
| **Tool** | N/D read-only | N/D | N/D | ❌ nie do zmiany | ✅ uczciwy |
| **Notification** | ❌ wpis ginie | ❌ brak | ⚠️ handler jest, backendu nie ma | ❌ nie do zmiany | ⚠️ niemierzone |
| **Interview** | ✅ tytuł | ❌ brak | ⚠️ przyciski bez efektu | ❌ nie do zmiany | ✅ „Brak odpowiedzi" |
| **Decision** | ✅ po „Edycja" | ✅ **komplet** | ✅ pełny pasek | ❌ nie do zmiany | ⚠️ niemierzone |
| **Insight** | ⚠️ bez autozapisu | ⚠️ tylko dodawanie | ⚠️ regeneruje całość | ⚠️ dropdown-widmo | ✅ „Brak powiązań" |
| **Task** | ✅ po „Edycja" | ✅ **komplet** | ✅ pełny pasek | ❌ nie do zmiany | ⚠️ niemierzone |
| **Initiative** | ✅ 10 pól | ⚠️ tylko kolejność | ✅ pełny pasek | ⚠️ 3 dropdowny-widma | ⚠️ niemierzone |

---

## 2. Zdolność 1 — EDYCJA

| Karta | Pola edytowalne | Wpis zostaje | Wskaźnik zapisu | Dowód |
|---|---|---|---|---|
| Tool | 0 | — | stale „Zapisano" | `KnownToolDetailView.tsx:1612-1616` — `titleReadOnly: true`, `onTitleChange: () => {}`, `onSave: () => {}`, `isDirty: false` |
| Notification | 3 textarea | **nie** | stale „Zapisano" | patrz §6 defekt D1 |
| Interview | 1 (tytuł) | tak | „Zapisz" → „Zapisano" po blur | zmierzone |
| Decision | 0 → **3 po „Edycja"** | tak | „Zapisano" | `DecisionDetailView.tsx:891` `useState(() => Boolean(decisionId))` |
| Insight | 2 | tak | **zostaje „Zapisz"** — brak autozapisu | `InsightViewer.tsx:1075` `useState(false)` = domyślnie Edycja |
| Task | 0 → **3 po „Edycja"** | tak | „Zapisano" | `TaskDetailView.tsx:684` `useState(() => Boolean(taskId))` |
| Initiative | 10 | tak | „Zapisz" → „Zapisano" po blur | `InitiativeDocumentView.tsx:727` `useState(false)` |

**Przełącznik Edycja/Podgląd** (`ReadEditToggle.tsx`) ma cztery karty: Decision, Task, Insight,
Initiative. Nie mają go: Tool, Notification, Interview.

**Niespójność domyślnego trybu (mierzone `aria-checked`):**
- Decision, Task → otwierają się w **Podgląd** (dla istniejącego rekordu)
- Insight, Initiative → otwierają się w **Edycja**

Ten sam komponent, ta sama klasa karty, przeciwne domyślne. Nieudokumentowane.

---

## 3. Zdolność 2 — SEKCJE (dodaj · usuń · kolejność · ukryj)

**To jest największa korekta wobec SPEC-N.**

`_SPEC_N_KARTY_2026-07-21.md` §2.1 twierdzi: *„Usuwanie sekcji — MUST, dziś nie ma nigdzie ❌ 0 z 8"*.
**To jest nieaktualne.** Usuwanie istnieje, działa i jest trwałe — w dwóch kartach.

| Karta | Dodaj | Usuń | Kolejność | Ukryj | Mechanizm |
|---|---|---|---|---|---|
| Tool | ❌ | ❌ | ❌ | ❌ | — |
| Notification | ❌ | ❌ | ❌ | ❌ | — |
| Interview | ❌ | ❌ | ❌ | ❌ | — |
| **Decision** | ✅ | ✅ | ✅ menu + drag | ✅ | `NModeCardManager` (`DecisionDetailView.tsx:5315`) |
| Insight | ✅ | ❌ | ✅ drag | ❌ | tylko `AddCardMenu` (`InsightViewer.tsx:8218`) |
| **Task** | ✅ | ✅ | ✅ menu + drag | ✅ | `NModeCardManager` (`TaskDetailView.tsx:4344`) |
| Initiative | menu „Nowy" | ❌ | ✅ drag | ❌ | brak `NModeCardManager` |

### Pomiar usuwania — liczby, nie wrażenie

**Decision:** menu Sekcje przed = 8 wierszy → po kliknięciu „Usuń kartę" na „Opcje i trade-offy" = **7 wierszy**;
przycisków usuwania 7 → 6.
**Task:** 10 wierszy → **9**; przycisków 9 → 8.

**Trwałość:** po `reload()` układ zostaje. Klucze localStorage:
`decision:nmode:card-layout:v1:decision-prv-mywork-1`, `task:nmode:card-layout:v1:task-dbr77-demo-1`.
Zmiana kolejności („W dół" na pierwszej pozycji) też przetrwała przeładowanie — zmierzone.

**Ukrywanie:** po kliknięciu ikony oka pojawia się przycisk „Pokaż sekcję" (1 sztuka) — działa
w obu kartach.

**Zestawy gotowe:** menu ma „Standardowy / Minimalny" + „Przywróć domyślne" (widoczne na zrzucie).

### Dlaczego tego nie było widać

`SectionsManagerMenu` renderuje przycisk usuwania z klasą
`opacity-0 group-hover:opacity-100` — **`NModeCardManager.tsx:369`**. Krzyżyk jest niewidoczny,
dopóki nie najedziesz myszą na wiersz. Na zrzucie z otwartym menu **nie widać ani jednego**
przycisku usuwania, choć w DOM jest ich siedem. To odkrywalność, nie brak funkcji.

---

## 4. Zdolność 3 — AI

| Karta | Przyciski AI | `NModeCardState` | Klik → co realnie | Ocena |
|---|---|---|---|---|
| Tool | 0 | 0 | — | N/D świadomie |
| Notification | „Analizuj z AI" + 2 per pole | **0** | handler odpala, pada `AI returned no JSON`, uczciwy toast „Nie udało się wypełnić kontekstu przez AI" | **brak backendu**, nie brak handlera |
| Interview | „Czat AI", „Ocena AI" | **0** | klik bez widocznego efektu (0 paneli, 0 toastów) | niepotwierdzone |
| Decision | 4 | **12** | pasek **Regeneruj · Edytuj · Zaakceptuj** widoczny | ✅ |
| Insight | „AI sekcji", „AI Konsultant" | **1** | toast „Regenerowanie rozpoczęte…", brak paska | ⚠️ |
| Task | 4 | **5** | pasek Regeneruj/Zaakceptuj | ✅ |
| Initiative | 6 | **8** | toast „Scope wygenerowany przez AI" + pasek | ✅ |

**Insight — istotne rozróżnienie.** `handleRegenerate` (`InsightViewer.tsx:2257-2281`) to prawdziwy
handler, ale regeneruje **cały insight**, nie sekcję: woła `regenerateInsight(insight.id)`,
po czym przeładowuje całość. Brak kontraktu AI per sekcja — inaczej niż Decision/Task/Initiative.
Toast obiecuje więcej, niż ekran robi.

**Notification — wzór poprawny.** Handler jest, wywołanie leci, brak backendu daje **uczciwy
komunikat błędu**. To jest zachowanie, którego oczekujemy — nie ma tu wady do naprawy w harnessie.

---

## 5. Zdolność 4 — PANEL (czy właściwości da się ZMIENIĆ)

| Karta | Sekcje panelu (kolejność zmierzona) | Właściwości zmienialne |
|---|---|---|
| Tool | Właściwości · Powiązania | ❌ tabela tekstowa |
| Notification | Właściwości · Historia | ❌ |
| Interview | Właściwości · Powiązania · Historia | ❌ |
| Decision | Akcje · Właściwości · Powiązania · Komentarze · Historia/AI | ❌ 0 kontrolek |
| Insight | Akcje · Właściwości · Powiązania · Komentarze · Historia/AI | ⚠️ 1 select, w większości no-op |
| Task | **Dowody** · Akcje · Właściwości · Powiązania · Komentarze · Historia/AI | ❌ |
| Initiative | Akcje · Właściwości · Powiązania · **Źródła i założenia** · Komentarze · Historia/AI | ⚠️ 3 widma + 3 działające |

**Kolejność kanoniczna §11.2 (Akcje · Właściwości · Powiązania · Komentarze · Historia)** jest
zachowana w Decision, Insight, Initiative. **Initiative ma `evidence` we właściwym miejscu** —
„Źródła i założenia" między Powiązaniami a Komentarzami, dokładnie jak każe SPEC-N §2.2.
**Task ma „Dowody" jako pierwszą sekcję, przed Akcjami** — to złamanie tej samej reguły.

### Widmowe dropdowny — najbardziej mylące, co znalazłem

W Initiative trzy pola panelu renderują **pełnoprawny, włączony `<select>`** rozciągnięty na całą
komórkę (`absolute inset-0 w-full h-full opacity-0 cursor-pointer`) z **pustym handlerem**:

| Pole | Deskryptor | Handler w `render()` |
|---|---|---|
| Faza | `InitiativeDocumentView.tsx:5598` `onChange: () => {}` (:5602), `readOnly: true` (:5603) | `onChange={() => {}}` :5616 |
| Następna brama | :5630 / `onChange: () => {}` :5634 | `onChange={() => {}}` :5646 |
| Źródło (sourceInsight) | :5781 / `onChange: () => {}` :5785 | — |

Użytkownik widzi kursor „rączkę", klika, **otwiera się prawdziwa lista opcji**, wybiera — i nic
się nie dzieje, wartość wraca. Bez komunikatu.

**Zmierzone:** Faza `TOOLS` → wybrano `ASSESSMENT` → po 2 s wartość = `TOOLS`. Wskaźnik dalej
„Zapisano".
**Kontrola:** pole `Termin` (`input[type=date]`) w tym samym panelu przyjęło `2026-12-24`
i **zatrzymało** wartość. Czyli to nie backend — to pusty handler.

**Insight ma odmianę tego samego.** Select statusu (`InsightViewer.tsx:7901-7916`) oferuje **6 opcji**,
a `runStatusTransition` (:3114-3124) obsługuje **trzy konkretne przejścia**; komentarz w kodzie
przyznaje wprost, że statusy generowania AI *„are not user-settable, so selecting them is a no-op"*.
Zmierzone: `in_review` → wybrano `draft` → wróciło `in_review`, bez komunikatu.

---

## 6. Defekty (łamią kanon) — z dowodem

**D1. Notification: wszystko, co wpiszesz, ginie — a nagłówek mówi „Zapisano".**
Zakleszczenie w `NotificationDetailView.tsx`:
- `:207` `const [lastSavedWorksheetSnapshot, setLastSavedWorksheetSnapshot] = useState<string>('')`
- setter wołany **wyłącznie** w `:497`, wewnątrz `handleSaveWorksheet`
- `:493` `if (!worksheetIsDirty) return;` — wyjście przed setterem
- `:302-306` `worksheetIsDirty` → `if (!lastSavedWorksheetSnapshot) return false;`

Pętla: snapshot pusty → `isDirty=false` → zapis wychodzi wcześniej → snapshot nigdy się nie ustawia.
Skutek: autozapis (`:516`) nigdy nie odpala, ręczny zapis to no-op, wskaźnik trwale „Zapisano".
**Niezależne od backendu.** Zmierzone: wpis do 3 pól, po blur i 2,5 s wskaźnik = „Zapisano", disabled.

**D2. Initiative: 3 widmowe dropdowny** — `:5602`, `:5634`, `:5785` (szczegóły §5).

**D3. Insight: select statusu oferuje opcje, których nie honoruje** — `:3114-3124` + `:7901`.

**D4. Usuwanie sekcji niewidoczne do najechania** — `NModeCardManager.tsx:369`
`opacity-0 group-hover:opacity-100`. Dodatkowo: przycisk jest fokusowalny z klawiatury, a przy
`opacity-0` **pierścień fokusu też jest niewidoczny** — bariera dostępności.

**D5. Zarezerwowane identyfikatory w lewej kolumnie** (SPEC-N §2.1 zabrania `comments`/`history`/`activity-log`):
- Decision — menu Sekcje zawiera **„Komentarze"** i **„Logi aktywności"**
- Task — **„Komentarze"** i **„Aktywność"**
Zmierzone jako wiersze menu Sekcje, nie z kodu.

**D6. Task: „Dowody" jako pierwsza sekcja panelu, przed Akcjami** — SPEC-N §2.2 każe umieścić
`evidence` między Powiązaniami a Komentarzami (jak w Initiative).

**D7. Insight: brak autozapisu na blur.** Po wpisie i `Tab` wskaźnik zostaje „Zapisz" (aktywny),
podczas gdy Interview i Initiative przechodzą na „Zapisano". Ta sama powłoka, inne zachowanie.

**D8. Notification: crimson na fokusie pola** — `focus:border-primary-400` w `:1544`, `:1573`, `:1596`.
`primary-*` = #85182F (CLAUDE.md pułapka nr 1).

**D9. Insight: powtarzalny błąd Reacta** — `Encountered two children with the same key`
w konsoli przy każdym ładowaniu i przy kliknięciu AI.

**D10. Dokument SPEC-N wprowadza w błąd.** §2.1 („usuwanie 0 z 8") i §2.2 („5 kart bez panelu")
opisują stan sprzed implementacji. Decision i Task mają dziś komplet zarządzania sekcjami,
a Decision/Insight/Initiative mają panel w kanonicznej kolejności. Kto zaplanuje falę W4 na
podstawie tego dokumentu, **przepisze rzeczy, które już działają**.

---

## 7. Uzasadnione różnice (nie naprawiać)

- **Tool jest read-only w całości.** To karta biblioteczna, nie obiekt pracy. Decyzja jest
  udokumentowana w kodzie (`KnownToolDetailView.tsx:1494-1506`) razem z powodem pominięcia
  Akcji/Komentarzy/Historii. Spójne.
- **Tool: „Powiązania" jako uczciwie pusta sekcja** z komunikatem zamiast zniknięcia
  (`:1553-1566`, `isEmpty` + `emptyLabel`) — wzór do naśladowania.
- **Notification bez pełnego panelu** — zgodne z decyzją SPEC-N §7 pkt 3 („lżejszy podtyp
  wiadomość systemowa").
- **Interview bez `NModeCardState`** — wywiad ma własny silnik pytań; kontrakt AI per sekcja
  nie ma tu zastosowania w tej samej formie.
- **Notification: AI pada w harnessie** — brak backendu, handler poprawny, komunikat uczciwy.

---

## 8. Do decyzji Piotra

1. **Domyślny tryb karty: Podgląd czy Edycja?** Dziś Decision/Task = Podgląd,
   Insight/Initiative = Edycja. Trzeba wybrać jedną stronę — to zmienia pierwsze wrażenie
   z karty („martwa" vs „gotowa do pisania").
2. **Czy usuwanie sekcji ma być widoczne zawsze?** Dziś tylko po najechaniu. Zawsze widoczne =
   odkrywalne, ale gęściej.
3. **Faza / Następna brama / Źródło w Initiative — edytowalne czy nie?** Dziś udają edytowalne.
   Albo dostają handler, albo `<select>` znika i zostaje sam tekst. Trzeciej opcji nie ma.
4. **Czy Insight ma dostać AI per sekcja?** Dziś regeneruje całą kartę — najdroższy i najbardziej
   ryzykowny wariant (nadpisuje pracę konsultanta bez pytania, wbrew SPEC-N §2.5).
5. **Czy Tool/Notification/Interview mają dostać pełny panel 5-sekcyjny**, czy zostają lekkie?
6. **Czy SPEC-N §2.1/§2.2 aktualizujemy przed falą W4?** Rekomendacja: tak, inaczej fala
   przepisze działający kod.

---

## 9. Czego NIE zweryfikowałem

- **Pustych stanów per sekcja** — mój selektor „centrum ekranu" zwracał 0 znaków dla Decision,
  Task, Insight i Interview (zbyt wąskie założenie o układzie). Kolumna 5 w tabeli opiera się na
  wyszukiwaniu fraz w całym `body`, nie na obejrzeniu każdej sekcji. **Wymaga powtórki.**
- **Initiative: czy przełączanie sekcji w lewym railu zmienia centrum.** Wszystkie sekcje dały
  identyczną treść (470 znaków). Prawdopodobnie układ „scroll-all" z podświetleniem, a nie wada —
  ale nie potwierdziłem.
- **Interview: co robią „Czat AI" / „Ocena AI".** Klik nie dał widocznego efektu; nie ustaliłem,
  czy to brak handlera, czy brak backendu. **Nie twierdzę, że są zepsute.**
- **Trwałość zapisu treści przez backend** — harness łata `window.fetch`, więc żaden pomiar
  „czy poszło na serwer" nie jest tu miarodajny. Wszystkie wnioski o zapisie opieram na logice
  komponentu, nie na ruchu sieciowym.
- **Motyw ciemny i `lang=en`** — testowane wyłącznie `light`/`pl`.
- **Drag sekcji w lewym railu** — potwierdziłem tylko obecność mechanizmu
  (`NModeLeftNav.tsx:49,304`, `onSectionReorder` przekazywany przez Decision, Insight, Task,
  Initiative). **Nie przeciągnąłem żadnej sekcji myszą.**

---

## 10. Materiał dowodowy

Zrzuty i surowe pomiary JSON:
`/private/tmp/claude-501/-Users-piotrwisniewski-.../f8c13049-409b-4bb2-9f7d-5997d01ba27f/scratchpad/`
- `shots/DOWOD-decision-sekcje-menu.png` — menu Sekcje otwarte: 8 wierszy, oko + ↑↓, zestawy
  Standardowy/Minimalny, „Przywróć domyślne"; pasek AI „Regeneruj · Edytuj · Zaakceptuj"
- `shots/DOWOD-decision-domyslny-READ.png` — ta sama karta bez kliknięcia: brak menu Sekcje
- `shots/DOWOD-initiative-panel.png` — panel z „Źródła i założenia" + pola Faza/Brama (widma)
- `shots/DOWOD-notification-zapisano-klamie.png` — wpisany tekst i wskaźnik „Zapisano"
- `survey.json` · `interact.json` · `edit.json` · `sections.json` · `props.json` · `init.json`
