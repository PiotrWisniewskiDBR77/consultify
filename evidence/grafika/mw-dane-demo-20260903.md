---
dyzur: agent/mw-dane-demo-20260903
data: 2026-09-03
zadanie: MYW-PHOTO-001 + MYW-PHOTO-007 (docs/program/waves/WAVE_03_ACCEPTANCE/modules/07_MY_WORK_AGENT/MODULE_ACCEPTANCE.md)
pakiet_decyzji: docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md — R-7, wiersze 23 i 25
commity:
  - 4f195a4390 fix(mywork-demo) dołóż brakujące stany fikstur Skrzynki i Kalendarza
  - e98350d620 test(mywork-demo) strażnik pokrycia stanów
---

# Dane pokazowe Mojej Pracy — pełny zakres stanów (MYW-PHOTO-001 / MYW-PHOTO-007)

## Skąd wynika zadanie

`MODULE_ACCEPTANCE.md` (2026-08-23) opisuje `MYW-PHOTO-001`/`MYW-PHOTO-007` jako brak w
**serwerowym** skrypcie seedującym `scripts/dev/seed-wave3-my-work-owner-review-owned.mjs`
(seeduje własne organizacje pokazowe przez API, nie aktywny tenant `dbr77`). Pakiet decyzji
właściciela z 2026-09-03 (`R-7`, wiersze 23/25) przedefiniował zakres na **dane demo w dev-render**
(ekrany, z których biorą się zrzuty do odbioru wizualnego, zgodnie z CLAUDE.md #7) — cytat
robotnika pakietu: "ŚREDNIE — jeden plik zasilający". Pomiar w tym dyżurze pokazuje, że to
uproszczenie: fikstury dev-render żyją w **czterech osobnych plikach**
(`dev-render/screens/mywork-inbox.tsx`, `mywork-tasks.tsx`, `mywork-decisions.tsx`,
`mywork-calendar.tsx`), każdy z własną tablicą mocków, montujący REALNE komponenty produkcyjne
(`InboxContent`, `MyTasksListContent`, `DecisionsPanelContent`, `CalendarView`) przez
`<MyWorkHub>` — nie serwerowy seed. **Rozbieżność do decyzji nadzorcy**: te dwa źródła danych
(seed serwerowy dla żywego tenanta vs. mocki dev-render dla zrzutów) są od siebie całkowicie
niezależne i się NIE synchronizują — naprawa jednego nie naprawia drugiego. Ten dyżur dotyka
WYŁĄCZNIE dev-render (zgodnie z poleceniem — "NIE ruszaj serwera"); stan opisany w
`MYW-PHOTO-001` dla żywego tenanta (`docs/program/waves/...`, "All counters read 0") pozostaje
nierozstrzygnięty i wymaga osobnego dyżuru na `scripts/dev/seed-wave3-my-work-owner-review-owned.mjs`.

Trzy z siedmiu ekranów z zakresu (`mywork-tasks.tsx`, `mywork-decisions.tsx`,
`mywork-calendar.tsx` — częściowo) miały **pierwszy w historii wpis harnessu dodany tego samego
dnia, wcześniejszym dyżurem** (commity `2ba1fb989f`, `a7abcee705`, `95c37a7d0a`, już na `HEAD`
przed rozpoczęciem tej pracy) — pomiar poniżej ocenia stan PO tamtym dyżurze, nie stan sprzed
2026-09-03.

## R1 — Pomiar: enumeracje z kodu vs. dane pokazowe (PRZED naprawą w tym dyżurze)

| Ekran | Pole | Źródło enumeracji w kodzie | Wartości możliwe | Wartości obecne (PRZED) | Brakujące (PRZED) |
| --- | --- | --- | --- | --- | --- |
| Skrzynka (`mywork-inbox.tsx`) | `section` | `InboxContent.tsx:201-210` `InboxSection` (9) | decisions_required, approvals_gates, assigned_tasks, blocked_escalations, overdue_sla_breach, fyi_system, fyi_mentions, ai_insights, other | 7/9 | **fyi_system, other** |
| Skrzynka | `itemType` | `services/api/v8/my-work.ts:58` `V8CanonicalInboxItem` (6) | task, decision, approval, signal, mention, escalation | 6/6 | — |
| Skrzynka | `status` (zakładka) | `InboxContent.tsx` `mapCanonicalItemStatus` (3 kubełka) | pending→Otwarte, resolved→Zamknięte, snoozed→Zapisane | 3/3 | — |
| Skrzynka | `slaStatus` | `services/api/v8/my-work.ts:67` (4) | on_track, at_risk, breached, resolved | 2/4 | on_track, resolved — **nieistotne wizualnie**: UI (`InboxContent.tsx:489-490`) rozróżnia TYLKO `breached`/`at_risk`, reszta wpada w ten sam poziom L1 — brak defektu wizualnego, nie naprawiane |
| Kalendarz (`mywork-calendar.tsx`) | `source` | `Calendar/calendarTypes.ts:1-8` `CalendarEventSource` (7) | event, task, initiative, decision, google, outlook, consultify | 5/7 | **event, outlook** |
| Zadania (`mywork-tasks.tsx`) | `status` (widoczny) | `MyTasksListContent.tsx` `INLINE_STATUS_OPTIONS`/filtr (5) | todo, in_progress, review, blocked, done | 5/5 | — (wcześniejszy dyżur już domknął) |
| Zadania | `priority` (widoczny) | `MyTasksListContent.tsx` `getPriorityConfig` (5 etykiet) | critical, high, medium, low, normal(domyślny) | 5/5 | — |
| Decyzje (`mywork-decisions.tsx`) | `status` | `DecisionsPanelContent.tsx` `statusLabel()` (5) | PENDING, APPROVED, REJECTED, DEFERRED, ESCALATED | 5/5 | — |
| Decyzje | `priority` | `DecisionsPanelContent.tsx` `priorityOrder` (4) | CRITICAL, HIGH, MEDIUM, LOW | 4/4 | — |
| karta-task / karta-decision / karta-notification | `status` (rekord pojedynczy) | j.w. | j.w. | po 1 stanie/kartę (z definicji — karta pokazuje JEDEN rekord na raz) | nie dotyczy — patrz uwaga niżej |

**Uwaga o kartach (karta-task/karta-decision/karta-notification):** to widoki POJEDYNCZEGO
rekordu (archetyp Rekord, SPEC-A), nie listy — nie da się na nich "pokazać wszystkich stanów
naraz" bez utraty sensu (karta = jeden obiekt, jeden stan). `karta-decision.tsx` demonstruje
`requestedByName` ≠ `decisionOwnerId` (Anna Kowalska prosi, Piotr decyduje) — dokładnie relację
"requester vs. approver" z cytatu `MYW-PHOTO-007`. Pełne przejście stanów (pending→approved,
todo→done) żyje w `mywork-tasks.tsx`/`mywork-decisions.tsx` (listy), nie w kartach.

**Odkryta niejednoznaczność (do decyzji nadzorcy, nie rozstrzygnięta w tym dyżurze):**
`MyTasksListContent.tsx` `getStatusConfig()`/`TASK_STATUS_SORT_ORDER` rozpoznaje też
`pending_approval`/`cancelled` — ale ŻADEN kontrolny element UI (filtr, inline-dropdown) nie
pozwala ich ustawić. Nie wiadomo, czy to martwy kod defensywny, czy stan osiągalny przez inną
ścieżkę (np. API/integrację) niewidoczną w UI listy. Nie dołożone do fikstury — poza pewnym
zakresem tego dyżuru.

## R2 — Uzupełnienie

Zmienione WYŁĄCZNIE `dev-render/screens/mywork-inbox.tsx` i `dev-render/screens/mywork-calendar.tsx`
(jedyne dwa realne braki z pomiaru R1). Żaden z 9 istniejących rekordów Skrzynki (`inbox-1`…`inbox-9`)
ani 6 istniejących wydarzeń Kalendarza nie został zmieniony/usunięty/przemianowany — sprawdzone
przeciw `docs/program/grafika/status.json` (wpisy `mywork-inbox`/`mywork-calendar`, oba `ocena: B`,
cytujące "9 pozycji"/"6 wydarzeń") PRZED edycją; liczby w tym pliku zaktualizowane na 11/8 w tym
samym commicie, z jawną notatką "jeszcze BEZ ponownego zrzutu do akceptu Piotra" (patrz #7 CLAUDE.md
— żaden z tych ekranów nie wchodzi na demo bez akceptu na zrzutach, ten dyżur tylko przygotowuje
kandydata).

Dołożone (branża doradcza, po polsku, realistyczne — zero "test"/"lorem"/"asdf"):
- `inbox-10` — sekcja `fyi_system`: "Synchronizacja z kalendarzem Google zakończona" (2 nowe
  spotkania z klientem Bielmar).
- `inbox-11` — sekcja `other`: "Nowa wersja szablonu raportu końcowego DRD" (aktualizacja
  szablonu przez zespół metodyczny).
- `evt-manual-przeglad-tygodniowy` — źródło `event` (ręcznie dodane, bez powiązanego
  task/decision/initiative): "Przegląd tygodniowy zespołu — status projektów".
- `evt-outlook-kickoff-atelier-toys` — źródło `outlook`: "Spotkanie kick-off — Atelier Toys"
  (zsynchronizowane, `syncState: in_sync`), plus dodany wpis `outlook: connected` do mocka
  `Api.getIntegrations()` (żeby pasek boczny "Outlook: Aktywne" pokazywał spójny stan z realnym
  wydarzeniem, nie martwą legendę).

## R3 — Dowód

### Test jednostkowy

`tests/unit/dev-render/mywork-demo-fixtures.stateCoverage.test.ts` (nowy plik, `git add -f`) —
8 testów, czyta źródło jako tekst (bez montowania `<MyWorkHub>`, kosztowne pod vitest), wyciąga
enumeracje DYNAMICZNIE z 4 plików produkcyjnych (`InboxContent.tsx`, `services/api/v8/my-work.ts`,
`Calendar/calendarTypes.ts`, `DecisionsPanelContent.tsx` przez regex na `export type`/`switch`/obiekt)
plus 2 zestawy ręcznie zacytowane (status/priorytet Zadań — żyją w tablicy opcji UI, nie w czystym
union type). **Mutacja zweryfikowana**: uruchomiony na commicie-rodzicu (przed naprawą R2) —
2 z 8 testów padają dokładnie na `section: fyi_system/other` i `source: event/outlook`, czyli na
lukę, którą ten dyżur naprawia. Na naprawionej fikstrurze: `8 passed (8)`.

```
npx vitest run tests/unit/dev-render/mywork-demo-fixtures.stateCoverage.test.ts
 Test Files  1 passed (1)
      Tests  8 passed (8)
```

### Zrzuty PO (kanoniczne narzędzie)

```
node scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5424 \
  --ekrany=mywork-inbox,mywork-calendar,mywork-tasks,mywork-decisions,karta-task,karta-decision,karta-notification \
  --jezyk=pl --motywy=light,dark --szerokosc=1440 --a11y=1 --rozwin-sekcje=1 \
  --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=1500 --cofnij-jesli-skraca=1 \
  --katalog=mw-dane-demo-20260903 --faza=PO --wyjscie=/private/tmp/ag-mw-demo-artefakty/po
```

14/14 zrzutów wykonanych (7 ekranów × light/dark), **0 błędów konsoli** na każdym. Pliki:
`/private/tmp/ag-mw-demo-artefakty/po/mw-dane-demo-20260903/*.png` (poza repo — dowód roboczy;
do przeniesienia do `evidence/grafika/mw-dane-demo-20260903/` po akcepcie Piotra, zgodnie z #7 —
Piotr nigdy nie jest pierwszym testerem, więc te zrzuty jeszcze nie poszły do niego).

### a11y (axe-core, `--a11y=1`, DOM po rozwinięciu sekcji)

| Ekran | light | dark |
| --- | --- | --- |
| mywork-inbox | 0 | 0 |
| mywork-calendar | 0 | 0 |
| mywork-tasks | **1 (color-contrast, serious, 5 węzłów)** | **1 (color-contrast, serious, 5 węzłów)** |
| mywork-decisions | 0 | 0 |
| karta-task | 0 | 0 |
| karta-decision | 0 | 0 |
| karta-notification | 0 | 0 |

**Zero NOWYCH naruszeń** na ekranach zmienionych w tym dyżurze (Skrzynka, Kalendarz — oba 0/0).
Naruszenie na `mywork-tasks` jest PRZEDISTNIEJĄCE — ten plik nie był tu zmieniany (ostatni commit
`2ba1fb989f`, wcześniejszy dyżur tego samego dnia). Zgłoszone jako osobne zadanie w tle
(`task_70e773e1` — "Fix color-contrast a11y violation on Zadania"), nie naprawiane tutaj (poza
zakresem MYW-PHOTO-001/007, który dotyczy DANYCH, nie kontrastu).

### Ocena wzrokiem (jedno zdanie na ekran, oba motywy obejrzane)

- **Skrzynka** — wygląda jak produkt: 9 realnych spraw doradczych (klient/inicjatywa/SLA), w tym
  oba nowe rekordy widoczne w kolumnie "SEK…" jako "Powiadomienia systemowe"/"Inne", liczniki
  pigułek (Wszystkie 9, Zaległe 2, Zapisane 1, AI 1, Krytyczne 2, Wymaga akcji 6, Dziś 4, Ten
  tydz. 4, Gotowe 1) spójne z danymi — nie test.
- **Kalendarz** — wygląda jak produkt: legenda "ŹRÓDŁA" (Consultify 1, Zadania 2, Wydarzenia
  własne 1, Google Calendar, Outlook — oba "Aktywne") ma teraz treść za każdą pozycją zamiast
  martwej etykiety; jedno ograniczenie zrzutu — wydarzenie Outlook o 15:00 wypada poza widoczny
  fragment siatki tygodnia na statycznym zrzucie (ekran przewija się niżej w realnej aplikacji) —
  to ograniczenie narzędzia zrzutowego, nie danych.
- **Zadania** — wygląda jak produkt: 8 zadań, wszystkie 5 statusów i 5 priorytetów widocznych
  naraz w jednej tabeli, terminy realistycznie rozłożone (Sep 2/Today/Tomorrow/Sep 1/Sep 8/Sep 13),
  czworo różnych właścicieli — najmocniejszy ekran z całej siódemki.
- **Decyzje** — wygląda jak produkt: 6 decyzji, wszystkie 5 statusów obecne, treści merytoryczne
  (budżet, harmonogram, ryzyko dostawcy) — nie zmieniane w tym dyżurze, potwierdzone jako już
  kompletne.
- **karta-task** — wygląda jak produkt: kryteria akceptacji rozpisane falsyfikowalnie (3 warunki),
  realny properties-panel; nie zmieniane w tym dyżurze.
- **karta-decision** — wygląda jak produkt: treść klasy "rezydencja danych klienta enterprise" z
  realną kwotą i konsekwencją biznesową; nie zmieniane w tym dyżurze.
- **karta-notification** — wygląda jak produkt: sygnał AI z liczbami (77 tys. PLN, 12 dni
  roboczych, 92% raportów) i jawnym założeniem kosztowym; nie zmieniane w tym dyżurze.

## Meldunek końcowy

**Pokrycie PRZED → PO:**

| Enumeracja | PRZED | PO |
| --- | --- | --- |
| Skrzynka `section` (9 wartości) | 7/9 | **9/9** |
| Kalendarz `source` (7 wartości) | 5/7 | **7/7** |
| Zadania `status`/`priority` widoczne (5+5) | 5/5, 5/5 | bez zmian (już domknięte wcześniejszym dyżurem tego dnia) |
| Decyzje `status`/`priority` (5+4) | 5/5, 4/4 | bez zmian (już kompletne) |

**Commity (worktree `/private/tmp/ag-mw-demo`, gałąź `agent/mw-dane-demo-20260903`):**
- `4f195a4390` — fix(mywork-demo): dołóż brakujące stany fikstur Skrzynki i Kalendarza
- `e98350d620` — test(mywork-demo): strażnik pokrycia stanów (8 testów, zmutowany, łapie
  dokładnie tę lukę)

**Rozbieżności zgłoszone do decyzji nadzorcy (nie rozstrzygnięte tutaj):**
1. Serwerowy seed (`scripts/dev/seed-wave3-my-work-owner-review-owned.mjs`, żywy tenant) i mocki
   dev-render (ten dyżur) to DWA niezależne źródła danych — naprawa jednego nie naprawia
   drugiego. `MYW-PHOTO-001` dla żywego tenanta ("All counters read 0") pozostaje otwarte.
2. `pending_approval`/`cancelled` w `MyTasksListContent.tsx` — kod je obsługuje, żaden element UI
   nie pozwala ich ustawić; nie wiadomo, czy to martwy kod czy nieodkryta ścieżka.
3. a11y `color-contrast` na `mywork-tasks` — przedistniejące, zgłoszone osobno (`task_70e773e1`).

**Czego NIE zrobiłem:**
- Nie ruszałem serwera ani `scripts/dev/seed-wave3-my-work-owner-review-owned.mjs` (zgodnie z
  poleceniem).
- Nie naprawiałem `color-contrast` na Zadaniach (poza zakresem — zgłoszone osobno).
- Nie dołożyłem `pending_approval`/`cancelled` do fikstury Zadań (niejednoznaczny status
  osiągalności — do decyzji nadzorcy, nie zgadywane).
- Nie przenosiłem zrzutów PO do `evidence/grafika/` w repo ani nie pokazywałem ich Piotrowi —
  zostają w `/private/tmp/ag-mw-demo-artefakty/po/` jako kandydat do akceptu (CLAUDE.md #7).
- Nie pushowałem gałęzi.
