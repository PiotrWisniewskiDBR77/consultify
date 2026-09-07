# P16 — Realizacja: Praca · Zasoby · Decyzje i ryzyka · Raporty do działania

> Paczka programu naprawczego · autor: Fable (nadzorca) · 07.09 wieczór.
> Pomiar: Opus na `/private/tmp/wt-fable-inicjatywy` (HEAD `aa3bd98d1e`, kopia bazy `consultify_fable`, UI 3160),
> zrzuty `evidence/realizacja-analiza/`, wiersz P16-POMIAR w rejestrze. Wzorce rynkowe: `AUDYT_RYNKU_PMO_20260907.md`
> (18 produktów, dokumentacja producentów, źródła z URL). Spec bazowa: `1_12_REALIZACJA_PLAN.md` (części A, C).
> Moduł `06_EXECUTION` ZAMROŻONY → każdy commit z markerem **`[ODMROZENIE 06_EXECUTION DEC-453]`**.
> Słowa właściciela 07.09: „To jest ostatni moduł, który leży. Jak mają działać Praca, Zasoby, Decyzje i ryzyka i Raporty?"

## 1. Cel dla użytkownika

PMO w poniedziałek otwiera Realizację: w Pracy widzi zadania po terminie i z tego samego wiersza zmienia osobę, termin
lub status; w Zasobach widzi, kto jest przeciążony w tym tygodniu, a zaległość stoi obok jako osobna liczba z trzema
akcjami; w Decyzjach i ryzykach widzi decyzje niepodjęte na czas, rozstrzyga je jednym kliknięciem z uzasadnieniem, a
sygnały opóźnień wyliczone przez system czyta zamiast wpisywać ręcznie; w Raportach jednym kliknięciem robi tygodniowy
pakiet, zamrożony na dzień, do PDF. Zero liczb, których nie da się wyjaśnić jednym zdaniem.

## 2. Zakres (zmierzony 07.09)

| Zakładka | Werdykt | Co jest | Co nie działa |
|---|---|---|---|
| Praca (`ExecutionWorkSurface.tsx`) | CZĘŚCIOWO | rejestr z `/api/tasks`, poślizg, chipy poprawne | zero zapisu z zakładki („Zaktualizuj zadanie" → `/my-work`, `:1191`); „Nowe zadanie" tylko dla realizacji runtime-v1 (0 szt.); pierwszy ekran = same „—" w kolumnie Inicjatywa (20 zadań demo bez `initiative_id` sortują się pierwsze); kebab mówi słownikiem runtime-v1; kanban = martwy kod |
| Zasoby (`ExecutionResourcesSurface.tsx`, `workloadCapacityService.ts`) | NIE | podaż z profilu (`PATCH /users/:id/capacity` działa), popyt z `tasks.estimated_hours` | zaległe zadania w całości na tydzień 1 (`:723-728`) → „853 %"; chip „Osoby 72" liczy wiersze; „Role" = filtr `job_title` (0/31); „Konflikty" = przeciążenia; **duplikat tygodnia 19.10 przez zmianę czasu** (`:666-667`); kolejne tygodnie 0 h; panel „Dodaj dostępność" pod tabelą, domyślnie pierwsza osoba |
| Decyzje i ryzyka (`ExecutionControlSurface.tsx`) | NIE | odczyt `/api/decisions` + `/api/raid`, dni po terminie i eskalacja liczone poprawnie | brak kebaba (`StandardTable` bez `rowMenu`, `:1120`), podgląd bez akcji → nie da się rozstrzygnąć; „Nowa decyzja" = 400 zawsze (`Missing decision context`, brak `sourceId`), komunikat po angielsku; 0/16 RAID ma termin; 42 sygnały z `/execution-control/delay-signals` nieczytane; „Dodaj sygnał" wymaga UUID i wersji; kolumna Typ miesza status decyzji z typem RAID |
| Raporty (`ExecutionReportsSurface.tsx`) | CZĘŚCIOWO | migawka → publikacja → DOCX działa, treść PL i realna, 4 poziomy | u właściciela 0 raportów (nikt nie wygenerował; katalog za przełącznikiem „Definicje"); 2 z 5 przycisków Menu 2 dla dewelopera; chipy 0/0/0 liczą migawki |

## 3. Przyczyna źródłowa (plik:linia)

1. `ExecutionWorkSurface.tsx:1191` — jedyna „edycja" zadania to nawigacja poza moduł; `:864` CTA tworzenia tylko przy `caseId`.
2. `workloadCapacityService.ts:723-728` — zadania po terminie wliczane do popytu tygodnia bieżącego (komentarz `:617` mówi, że celowo); `:666-667` — `+7*24h` przez zmianę czasu 25.10 daje niedzielę 23:00, `getMonday` cofa o 6 dni → dwa razy ten sam tydzień; `:694` rola = `COALESCE(job_title, title)`.
3. `ExecutionResourcesSurface.tsx:409-411` — chipy liczą wiersze osoba×tydzień, nie osoby; „Konflikty" = `util>105% || luka<0`.
4. `ExecutionControlSurface.tsx:741` — payload `{title, sourceType:'execution'}` bez `sourceId` → `DecisionController.ts:1235` 400; `:1120` brak `rowMenu`; `:568/:581` jedna kolumna „Typ" dla dwóch semantyk; `:603-604` czyta puste runtime-v1 zamiast `delay-signals`.
5. `ExecutionReportsSurface.tsx:612-615` chipy liczą `runs`; widok domyślny = migawki; `:1217` i `:855` edytory deweloperskie w Menu 2.

## 4. Projekt rozwiązania (decyzje CTO; właściciel zmienia jednym zdaniem — §12)

- **D1 Popyt w Zasobach z zadań, zaległość osobno.** MVP liczy popyt tygodnia z zadań przypisanych osobie, z pracochłonnością
  rozłożoną równo między datą startu (lub utworzenia) a terminem (wzorzec Asana). **Zaległość (h)** = suma pracochłonności
  zadań, których termin minął, a status nie jest końcowy — **osobna kolumna, nie wchodzi do popytu tygodnia** (wyróżnik
  wobec rynku; Planview AdaptiveWork ma „na dziś" i to jest ich udokumentowana bolączka). Klik w zaległość → lista →
  trzy akcje: przenieś na wskazany tydzień · uznaj za zamknięte · zmniejsz zakres. Alokacje jako osobny obiekt = Fala 2
  (rynek PSA), a planowanie per rola żyje już w Inicjatywy → Obciążenie (P15).
- **D2 Podaż per dzień tygodnia minus nieobecności.** `users.weekly_capacity_hours` × `availability_percent` zostaje jako
  źródło MVP (działa), ale liczone per dzień roboczy tygodnia, a nie stałe 40; nieobecności = Fala 2 (brak tabeli).
  Duplikat tygodnia naprawiony arytmetyką dat w UTC/poniedziałek bez `+7*24h`.
- **D3 Decyzja ma termin i decydenta; rozstrzyga się w wierszu.** Kolumny: Tytuł · Potrzebna do dnia (`decisions.deadline`,
  istnieje) · Decydent (`decision_maker_id`, istnieje) · Status (Oczekuje / Rozstrzygnięta / Odrzucona / Nieaktualna) ·
  Dni po terminie · Eskalacja. Kebab i podgląd: Rozstrzygnij / Odrzuć / Nieaktualna → obowiązkowe uzasadnienie
  (`decision_rationale`), wpis nieusuwalny; Eskaluj ręcznie; automat dzienny: termin minął i „Oczekuje" → poziom +1
  (działa wstecznie przy pierwszym uruchomieniu). „Nowa decyzja" wysyła `sourceId` = inicjatywa (wybór w formularzu,
  domyślnie z filtra realizacji) + termin + decydent. Przełącznik Decyzje/Ryzyka zmienia ZESTAW KOLUMN: RAID = Tytuł ·
  Typ · Właściciel · Termin (`raid_items.due_date`, edycja) · Prawdopodobieństwo · Wpływ · **Ekspozycja = iloczyn, tylko
  do odczytu** · Status; dodawanie i edycja RAID z tej zakładki kanonicznym pisarzem `runtime-v1/.../raid-items` (już
  udowodniony, `raidWrites.ts`).
- **D4 Sygnały z systemu, nie z ręki.** Trzeci preset Menu 3 „Sygnały (N)" czyta `/execution-control/delay-signals`
  (42 policzone, z powodami `whySlipReasons`); wiersz sygnału → „Przygotuj interwencję" = tworzy decyzję typu
  „przesunięcie" (re-baseline) z terminem i decydentem (metodyka A1 pkt 6: data planowana bez decyzji jest niezmienna).
  Ręczne „Dodaj sygnał" runtime-v1 znika z Menu 2 (zostaje w kontrakcie API).
- **D5 Praca: edycja w wierszu i w podglądzie.** Osoba · Termin · Status edytowalne w wierszu (podwójny klik, wzorzec
  Wrike/Clarity) i w podglądzie; zapis `PUT /api/tasks/:id` (działa, 200); „Nowe zadanie" = `POST /api/tasks` z inicjatywą
  z filtra (bez wymogu realizacji runtime-v1); zadania bez inicjatywy sortowane na koniec z etykietą „Bez inicjatywy";
  kebab ze słownikiem modułu (Otwórz · Zmień osobę · Zmień termin · Zamknij · Otwórz podgląd); kolumna „Poślizg" nazwana
  uczciwie „Dni po terminie" (poślizg wobec baseline wraca z R3, gdy będą kamienie i baseline). Martwy kanban usunięty.
- **D6 Raporty: pierwsze wejście prowadzi do generowania.** Gdy 0 migawek → pusty stan z czterema kaflami „Wygeneruj"
  (Karta realizacji · Tygodniowy pakiet · Zdrowie programu · Jedna strona dla sponsora) zamiast „Brak raportów";
  „Nowa definicja" i „Kontrakt raportu" tylko dla ADMIN w kebabie Menu 2; chipy liczą migawki + „Definicje (12)";
  PPTX dla poziomu zarządu = Fala 2 (generator z 1.6 już umie).
- **D7 Liczby czytelne.** Zasoby: pasek „osób 9 · popyt · podaż · obłożenie" i chipy liczą OSOBY (Osoby 9 · Przeciążeni 3 ·
  Zaległość > 0: 5); kolumna „Osoba / Rola" pokazuje stanowisko, gdy jest, inaczej samo imię; progi 75/100 konfigurowalne
  (domyślne z rynku: <75 niebieski, 75–100 zielony, >100 czerwony).
- Zakazy: `Standard*` tylko; zero nowych flag; zero `.catch(() => {})`; teksty pl+en; `primary-*` wyłącznie dla Odrzuć.

## 5. Kroki wykonania

| # | Krok | Pliki | Kto | Rozmiar | Zależy od |
|---|---|---|---|---|---|
| R0 | Zasoby: naprawa duplikatu tygodnia + test z datą 25.10 (mutacja: `+7*24h` → red); chipy liczą osoby; „Osoba / Rola" ze stanowiskiem | `workloadCapacityService.ts:660-700`, `ExecutionResourcesSurface.tsx:400-415` | Sonnet | S | — |
| R1 | Zasoby D1/D2: zaległość jako osobna kolumna i pole w odpowiedzi API (`backlogHours`), popyt tygodnia bez zadań po terminie, rozkład równy start→termin, podaż per dzień roboczy; lista zaległości + trzy akcje (`PUT /tasks/:id` termin / status / `estimated_hours`) | `workloadCapacityService.ts`, `executionControl.routes.ts:1083-1110`, `ExecutionResourcesSurface.tsx`, `resourcePlanApi.ts` | Opus | M | R0 |
| R2 | Praca D5: edycja w wierszu (osoba/termin/status) + podgląd z akcjami, „Nowe zadanie" z inicjatywą, sortowanie „Bez inicjatywy", kebab modułu, „Dni po terminie", usunięcie martwego kanbanu | `ExecutionWorkSurface.tsx`, `ExecutionHub.tsx:3199-3300` (kanban), `tasks.routes.ts` (bez zmian, tylko użycie) | Opus | M | — |
| R3 | Decyzje D3: naprawa POST (`sourceId`, termin, decydent), kolumny decyzji, kebab + podgląd Rozstrzygnij/Odrzuć/Nieaktualna z uzasadnieniem, eskalacja ręczna + automat dzienny (job w `DISABLE_SCHEDULER`-aware schedulerze; działa wstecznie), komunikaty PL | `ExecutionControlSurface.tsx`, `DecisionController.ts`, `decisions.routes.ts`, nowy job | Opus | M | — |
| R4 | RAID w tej zakładce: kolumny RAID (termin, prawdopodobieństwo, wpływ, ekspozycja liczona), dodawanie/edycja kanonicznym pisarzem, konwersja ryzyko → problem z linkiem do źródła | `ExecutionControlSurface.tsx`, `raidWrites.ts`, model `raid_items` (kolumny p/i — K0 sprawdzi) | Opus | M | R3 |
| R5 | Sygnały D4: preset „Sygnały (N)" z `delay-signals`, wiersz → „Przygotuj interwencję" = decyzja typu re-baseline; ręczne „Dodaj sygnał" schowane | `ExecutionControlSurface.tsx`, `executionControl.routes.ts` (odczyt istnieje) | Sonnet | M | R3 |
| R6 | Raporty D6/D7: pusty stan z 4 kaflami, przyciski deweloperskie za ADMIN, chipy | `ExecutionReportsSurface.tsx` | Sonnet | S | — |
| R7 | Dane demo: 20 zadań bez inicjatywy → przypięcie albo etykieta; tytuły PL; terminy na 16 RAID; migawki startowe 4 poziomów na stagingu (skrypt seedu, uruchamiany po akcepcie) | `scripts/dev/…seed` | Sonnet | S | R1–R6 |
| R8 | Dowód na ekranie (Playwright, 1440, jasny, reload po każdym zapisie): przejście PMO z §6 + rejestr + panel | `scripts/dev/realizacja/dowod-realizacja.mjs`, `evidence/realizacja/` | Sonnet | M | R1–R6 |

Równolegle: R0 ∥ R2 ∥ R3 ∥ R6; po R0: R1; po R3: R4 ∥ R5; na końcu R7, R8. Wszystkie kroki dotykają `06_EXECUTION`.

## 6. Testy

- Jednostkowe z mutacją → RED: (a) tydzień 25.10 nie duplikuje się; (b) zadanie po terminie nie wchodzi do popytu tygodnia,
  wchodzi do zaległości (mutacja: stary `:723` → red); (c) rozkład równy start→termin; (d) chipy liczą osoby; (e) edycja
  w wierszu woła `PUT /tasks/:id` z jednym polem; (f) „Nowa decyzja" wysyła `sourceId` + termin (mutacja: usuń → red);
  (g) Rozstrzygnij bez uzasadnienia → zablokowane; (h) automat eskalacji podnosi poziom dla terminów w przeszłości przy
  pierwszym uruchomieniu; (i) ekspozycja = p × w, tylko do odczytu; (j) preset Sygnały liczy `delay-signals`; (k) pusty
  stan Raportów z 4 kaflami przy 0 migawek; (l) przyciski deweloperskie niewidoczne dla MEMBER.
- Realny PG: decyzja rozstrzygnięta trwale (status + uzasadnienie + `decided_at`), RAID z terminem przez pisarza kanonicznego.
- Przepływ klikany: Praca → zadanie po terminie → zmień osobę w wierszu → reload → trwałe → Zasoby → osoba z zaległością →
  „przenieś na tydzień" → reload → popyt tygodnia i zaległość zgodne → Decyzje → decyzja po terminie → Rozstrzygnij z
  uzasadnieniem → reload → status i historia → Sygnały → „Przygotuj interwencję" → decyzja re-baseline w rejestrze →
  Raporty → kafel „Tygodniowy pakiet" → migawka → publikacja → PDF → reload: opublikowana, „stan na" w nagłówku.
  Para negatywna: MEMBER nie widzi Rozstrzygnij ani przycisków deweloperskich; Rozstrzygnij bez uzasadnienia nieaktywne.

## 7. Kryterium odbioru właściciela

Na stagingu, w poniedziałek: zmieniasz osobę zadania po terminie z listy, widzisz kogo naprawdę przeciąża ten tydzień
(bez 853 %), a zaległość obok z przyciskiem „przenieś", rozstrzygasz decyzję po terminie z jednym zdaniem uzasadnienia,
z sygnału opóźnienia robisz wniosek o przesunięcie, i generujesz tygodniowy pakiet do PDF — wszystko bez wychodzenia
z modułu Realizacja i bez ani jednej liczby, której nie umiesz wyjaśnić.

## 8. Ryzyka i cofanie

- Automat eskalacji zmienia dane co noc — pierwsze uruchomienie na stagingu tylko po obejrzeniu listy „co zostanie
  podniesione" (tryb suchy w R3). Cofanie: `git revert` kroku; brak migracji destrukcyjnych.
- Zmiana definicji popytu zmienia liczby w Kokpicie (kafel Obłożenie) — R1 aktualizuje oba miejsca z jednej funkcji.
- Danych demo z angielskimi tytułami nie tłumaczymy w kodzie — R7 osobnym skryptem po akcepcie.

## 9. Nakład

Opus: R1 1 · R2 0,75 · R3 1 · R4 0,75 = **3,5 osobodnia**; Sonnet: R0 0,25 · R5 0,5 · R6 0,25 · R7 0,25 · R8 0,5 = **1,75**.
Ścieżka krytyczna R3 → R4 → R8 ≈ 2,5 dnia przy zrównolegleniu.

## 10. Samokontrola wykonawcy

Jak w P15 §10: esbuild per plik, `npx vitest run <testy kroku>`, `check-gestosc.sh`, `check-triada.sh`, `check-list-canon.sh`,
tsc serwera 0, własne API 41xx na kopii bazy + vite 3140–3199, progi: 0 wartości obłożenia > 300 % bez zaległości w
osobnej kolumnie, 0 błędów konsoli poza `NetworkBuffer`, 0 angielskich komunikatów błędu, 0 przycisków deweloperskich
dla MEMBER. STOP przy decyzji właściciela, nigdy obejście. Zakazy jak w P15.

## 11. Wklejka dla wykonawcy

Generowana per krok przez nadzorcę po decyzjach §12.

## 12. Decyzje do potwierdzenia przez właściciela (jedno zdanie każda)

| # | Pytanie | Rekomendacja CTO |
|---|---|---|
| D1 | Popyt w Zasobach z zadań czy z alokacji? | MVP z zadań (dane są), zaległość osobno; alokacje = Fala 2 |
| D3 | Decyzja ma „Potrzebna do dnia" i decydenta, rozstrzygana w wierszu z uzasadnieniem? | Tak; to nasz wyróżnik wobec rynku |
| D4 | Sygnały opóźnień z systemu jako trzeci preset zamiast ręcznego „Dodaj sygnał"? | Tak; wniosek o przesunięcie = decyzja re-baseline |
| D6 | Raporty: cztery kafle na starcie, przyciski deweloperskie schowane? | Tak |
