# TESTY MANUALNE — F4: FE SHARED STATE (Zustand + Deep Link + Gantt)

**Moduł:** F4 — Wspólny stan FE  
**Data:** 2026-06-25  
**Wersja:** 1.0  
**Środowisko:** staging / lokalny dev  
**Łączna liczba scenariuszy:** 30

---

## Kontekst F4

F4 dotyczy spójności stanu frontendowego między komponentami:
- `useInitiativeRefreshStore` (Zustand) — licznik wersji inkrementowany przy każdej mutacji inicjatywy
- `bumpInitiativeRefresh()` wywoływana po create/update/zmianie statusu
- `InitiativesHub` i `ExecutionHub` subskrybują `sharedRefreshVersion` i re-fetchują gdy zmienia się wartość
- `buildInitiativeDeepLink(id)` / `readInitiativeDeepLinkId()` — kanoniczny wzorzec deep-linku URL
- Jedno źródło prawdy Gantta: `InitiativeGantt` i `TimelinePlanner` czytają z tabeli `task_dependencies`
- `InitiativeDetailModal` usunięty (był martwym kodem)
- Pliki `* 2.ts` (sieroty) usunięte

---

## F4-01 — Tworzenie inicjatywy w czacie → automatyczne odświeżenie InitiativesHub

**Cel:** Weryfikacja, że po utworzeniu inicjatywy przez czat `InitiativesHub` odświeża listę bez ręcznego przeładowania strony.

**Preconditions:**
- Zalogowany użytkownik z dostępem do czatu i `InitiativesHub`
- Otwarta zakładka `InitiativesHub` (widoczna lista inicjatyw)
- Zapamiętana liczba inicjatyw na liście przed testem

**Kroki:**
1. Otwórz czat Teresa w osobnym panelu lub oknie (bez przeładowania hubu)
2. Wyślij prompt tworzący nową inicjatywę, np. „Stwórz inicjatywę: Optymalizacja procesu onboardingu"
3. Poczekaj na potwierdzenie od AI (ok. 3–8 s)
4. Przełącz widok na `InitiativesHub` bez odświeżania strony

**Oczekiwany wynik:**
- Nowa inicjatywa pojawia się na liście w `InitiativesHub` automatycznie
- Liczba inicjatyw wzrosła o 1
- Brak konieczności odświeżenia (F5) przez użytkownika
- Licznik `sharedRefreshVersion` w store Zustand wzrósł o co najmniej 1 (weryfikacja przez DevTools)

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-02 — Aktualizacja tytułu inicjatywy → InitiativesHub pokazuje nowy tytuł bez przeładowania

**Cel:** Weryfikacja, że edycja tytułu inicjatywy propaguje się do listy w `InitiativesHub` bez manualnego reload.

**Preconditions:**
- Istnieje co najmniej jedna inicjatywa na liście
- `InitiativesHub` otwarty i widoczny

**Kroki:**
1. Kliknij inicjatywę na liście, aby otworzyć jej szczegóły
2. Edytuj tytuł inicjatywy (np. zmień „Stary tytuł" na „Nowy tytuł testowy 2026")
3. Zapisz zmianę (kliknij Zapisz lub naciśnij Enter)
4. Zamknij panel szczegółów / wróć do listy `InitiativesHub`

**Oczekiwany wynik:**
- Na liście `InitiativesHub` widoczny jest zaktualizowany tytuł „Nowy tytuł testowy 2026"
- Zmiana widoczna bez F5
- Pozostałe pola inicjatywy (status, data) niezmienione

**API endpoint:** `PATCH /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-03 — Zmiana statusu inicjatywy → ExecutionHub aktualizuje licznik natychmiast

**Cel:** Weryfikacja, że zmiana statusu inicjatywy (np. DRAFT → APPROVED) powoduje natychmiastową aktualizację licznika w `ExecutionHub`.

**Preconditions:**
- `ExecutionHub` otwarty z widocznym licznikiem inicjatyw w statusie APPROVED (lub SCHEDULED/EXECUTING)
- Istnieje inicjatywa w statusie DRAFT

**Kroki:**
1. Zapamiętaj aktualny licznik w `ExecutionHub` dla statusu APPROVED
2. Otwórz inicjatywę w statusie DRAFT
3. Zmień status na APPROVED
4. Potwierdź zmianę statusu
5. Wróć do `ExecutionHub`

**Oczekiwany wynik:**
- Licznik APPROVED w `ExecutionHub` wzrósł o 1
- Inicjatywa widoczna w sekcji APPROVED w `ExecutionHub`
- Brak konieczności ręcznego odświeżenia

**API endpoint:** `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-04 — Tworzenie inicjatywy z Assessmentu → pojawia się w InitiativesHub natychmiast

**Cel:** Weryfikacja, że inicjatywa wygenerowana automatycznie z wyników Assessmentu pojawia się w `InitiativesHub` bez reload.

**Preconditions:**
- Ukończony assessment z dostępnymi rekomendacjami
- `InitiativesHub` otwarty w osobnej zakładce / panelu

**Kroki:**
1. Przejdź do wyników Assessmentu
2. Kliknij „Utwórz inicjatywę" przy wybranej rekomendacji
3. Potwierdź utworzenie w dialogu
4. Przełącz się na `InitiativesHub`

**Oczekiwany wynik:**
- Nowa inicjatywa widoczna na liście w `InitiativesHub`
- Inicjatywa ma poprawnie przeniesiony tytuł/opis z rekomendacji
- Brak konieczności F5

**API endpoint:** `POST /api/initiatives` (source_type=assessment)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-05 — Usunięcie inicjatywy → znika z listy bez przeładowania

**Cel:** Weryfikacja, że po usunięciu inicjatywa natychmiast znika z listy w `InitiativesHub`.

**Preconditions:**
- Na liście istnieje co najmniej jedna inicjatywa którą można usunąć
- `InitiativesHub` otwarty

**Kroki:**
1. Zapamiętaj tytuł inicjatywy do usunięcia i licznik całkowity
2. Kliknij menu kontekstowe (⋮) przy inicjatywie
3. Wybierz „Usuń inicjatywę"
4. Potwierdź operację w dialogu

**Oczekiwany wynik:**
- Inicjatywa znika z listy natychmiast
- Całkowity licznik inicjatyw zmniejszył się o 1
- Nie pojawia się błąd w konsoli
- Brak konieczności F5

**API endpoint:** `DELETE /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-06 — bumpInitiativeRefresh wywoływana po create → licznik wersji inkrementuje

**Cel:** Weryfikacja, że `bumpInitiativeRefresh()` jest wywoływana po tworzeniu inicjatywy i licznik `sharedRefreshVersion` rośnie.

**Preconditions:**
- Otwarte DevTools (React DevTools lub Zustand DevTools)
- Dostęp do inspektora stanu Zustand

**Kroki:**
1. Otwórz DevTools → zakładka Zustand (lub wyszukaj `useInitiativeRefreshStore` w React DevTools)
2. Zanotuj aktualną wartość `sharedRefreshVersion` (np. 0)
3. Utwórz nową inicjatywę (przez czat lub formularz)
4. Obserwuj stan store po zakończeniu operacji

**Oczekiwany wynik:**
- `sharedRefreshVersion` wzrósł o dokładnie 1 po jednym create
- Zmiana widoczna w DevTools bez dodatkowej akcji
- Brak wielokrotnego wywołania (nie +2 lub +3 za jedną operację)

**API endpoint:** `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-07 — bumpInitiativeRefresh wywoływana po zmianie statusu → ExecutionHub re-fetchuje

**Cel:** Weryfikacja, że zmiana statusu inicjatywy wyzwala re-fetch w `ExecutionHub` poprzez mechanizm `sharedRefreshVersion`.

**Preconditions:**
- `ExecutionHub` otwarty
- DevTools Network tab otwarty (filtr: XHR/Fetch)
- Inicjatywa w statusie SCHEDULED widoczna w `ExecutionHub`

**Kroki:**
1. Otwórz Network tab w DevTools, wyczyść logi
2. Zmień status inicjatywy na EXECUTING (np. przez panel szczegółów)
3. Obserwuj Network tab

**Oczekiwany wynik:**
- W Network tab pojawia się nowy request do endpointu listy inicjatyw (`GET /api/initiatives` lub odpowiednika)
- Request inicjowany przez zmianę statusu, nie przez nawigację użytkownika
- `ExecutionHub` pokazuje zaktualizowany stan bez F5

**API endpoint:** `GET /api/initiatives` (re-fetch)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-08 — Dwie zakładki: mutacja w tab1 → tab2 aktualizuje się (Zustand cross-component)

**Cel:** Weryfikacja, że stan Zustand synchronizuje się między komponentami w tej samej sesji przeglądarki.

**Preconditions:**
- Dwie zakładki przeglądarki otwarte na tej samej instancji aplikacji (nie dwie osobne sesje)
- W obu zakładkach widoczny `InitiativesHub`

**Kroki:**
1. W tab1 utwórz nową inicjatywę
2. Bez odświeżania tab2, przełącz się na tab2
3. Obserwuj listę inicjatyw w tab2

**Oczekiwany wynik:**
- Tab2 pokazuje nową inicjatywę (Zustand store jest wspólny w ramach jednego kontekstu React)
- Jeżeli tab2 to osobna instancja SPA (osobna sesja przeglądarki) — dopuszczalny brak synchronizacji (not in scope); jeśli ten sam SPA context — synchronizacja wymagana

**Uwaga:** Test weryfikuje zachowanie komponentów w tym samym drzewie React, nie między izolowanymi kartami przeglądarki.

**API endpoint:** n/d (test stanu FE)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-09 — Deep link: /initiatives?initiativeId=X → otwiera poprawny szczegół inicjatywy

**Cel:** Weryfikacja, że wejście na URL z parametrem `initiativeId` automatycznie otwiera panel szczegółów właściwej inicjatywy.

**Preconditions:**
- Znane ID istniejącej inicjatywy (np. `abc-123`)
- Użytkownik zalogowany

**Kroki:**
1. Wpisz w przeglądarce URL: `/initiatives?initiativeId=abc-123`
2. Naciśnij Enter i poczekaj na załadowanie strony

**Oczekiwany wynik:**
- Strona `InitiativesHub` ładuje się
- Panel szczegółów inicjatywy `abc-123` otwiera się automatycznie
- Tytuł i dane inicjatywy zgadzają się z oczekiwanymi
- Brak błędu 404 lub pustego panelu

**API endpoint:** `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-10 — buildInitiativeDeepLink zwraca URL z poprawnym parametrem

**Cel:** Weryfikacja, że funkcja `buildInitiativeDeepLink(id)` generuje poprawny URL z parametrem `initiativeId`.

**Preconditions:**
- Dostęp do konsoli przeglądarki lub testów jednostkowych
- Znane ID inicjatywy

**Kroki:**
1. Otwórz konsolę przeglądarki (F12 → Console)
2. Wywołaj (jeśli eksponowane globalnie) lub zweryfikuj przez kliknięcie „Kopiuj link" przy inicjatywie
3. Sprawdź skopiowany URL

**Oczekiwany wynik:**
- URL ma postać `/initiatives?initiativeId=<id>` (lub odpowiedni path zgodny z routerem)
- `id` w URL zgadza się z ID inicjatywy
- URL jest kompletny (zawiera origin jeśli wymagany przez funkcję)

**API endpoint:** n/d (funkcja FE)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-11 — Deep link z ExecutionHub → otwiera szczegół inicjatywy

**Cel:** Weryfikacja, że link do inicjatywy z poziomu `ExecutionHub` poprawnie przenosi do szczegółów danej inicjatywy.

**Preconditions:**
- `ExecutionHub` otwarty z listą inicjatyw SCHEDULED lub EXECUTING
- Co najmniej jedna inicjatywa widoczna

**Kroki:**
1. W `ExecutionHub` kliknij ikonę lub link „Otwórz szczegóły" / tytuł inicjatywy
2. Obserwuj nawigację

**Oczekiwany wynik:**
- Aplikacja nawiguje do widoku z otwartym panelem szczegółów tej konkretnej inicjatywy
- URL w pasku adresu zawiera `initiativeId=<id>` inicjatywy
- Panel szczegółów pokazuje poprawne dane (tytuł, status, opis)

**API endpoint:** `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-12 — Deep link z ResultsHub → otwiera ten sam szczegół inicjatywy poprawnie

**Cel:** Weryfikacja, że deep link generowany z `ResultsHub` prowadzi do tej samej inicjatywy, co z innych hubów.

**Preconditions:**
- `ResultsHub` otwarty z inicjatywami mającymi wyniki
- Co najmniej jedna inicjatywa z przypisanymi rezultatami widoczna

**Kroki:**
1. W `ResultsHub` kliknij link do inicjatywy (tytuł, ikona lub dedykowany przycisk)
2. Obserwuj cel nawigacji

**Oczekiwany wynik:**
- Aplikacja otwiera panel szczegółów właściwej inicjatywy
- Dane w panelu (tytuł, status) zgodne z inicjatywą klikniętą w `ResultsHub`
- URL zawiera poprawny `initiativeId`
- Brak błędu 404 ani białego ekranu

**API endpoint:** `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-13 — Deep link: nieprawidłowe ID → nie crashuje, pokazuje pusty stan

**Cel:** Weryfikacja odporności na błędne ID w parametrze deep link.

**Preconditions:**
- Użytkownik zalogowany

**Kroki:**
1. Wpisz URL: `/initiatives?initiativeId=NIEISTNIEJACE-ID-99999`
2. Naciśnij Enter
3. Obserwuj zachowanie aplikacji

**Oczekiwany wynik:**
- Aplikacja nie crashuje (brak białego ekranu, brak nieskończonego spinnera)
- Wyświetlany jest pusty stan lub komunikat „Inicjatywa nie znaleziona"
- Lista inicjatyw w `InitiativesHub` nadal widoczna i funkcjonalna
- W konsoli może pojawić się ostrzeżenie, ale nie uncaught error

**API endpoint:** `GET /api/initiatives/NIEISTNIEJACE-ID-99999` → oczekiwany 404

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-14 — Gantt: TimelinePlanner pokazuje strzałki zależności między zadaniami

**Cel:** Weryfikacja, że `TimelinePlanner` renderuje powiązania (strzałki) między zależnymi zadaniami.

**Preconditions:**
- Inicjatywa z co najmniej 2 zadaniami i zdefiniowaną zależnością (task B zależy od task A) w tabeli `task_dependencies`

**Kroki:**
1. Otwórz inicjatywę zawierającą zadania z zależnościami
2. Przejdź do widoku `TimelinePlanner` (oś czasu / Gantt)
3. Obserwuj diagram

**Oczekiwany wynik:**
- Między task A i task B widoczna strzałka zależności
- Strzałka wskazuje właściwy kierunek (od poprzednika do następnika)
- Brak błędów renderowania SVG/canvas w konsoli

**API endpoint:** `GET /api/initiatives/:id/tasks` + `GET /api/initiatives/:id/task-dependencies`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-15 — Gantt: InitiativeGantt pokazuje te same strzałki zależności (to samo źródło danych)

**Cel:** Weryfikacja, że `InitiativeGantt` korzysta z tego samego źródła (`task_dependencies`) co `TimelinePlanner` i renderuje identyczne powiązania.

**Preconditions:**
- Ta sama inicjatywa z zależnościami co w F4-14

**Kroki:**
1. Otwórz tę samą inicjatywę w widoku `InitiativeGantt`
2. Porównaj strzałki zależności z widokiem `TimelinePlanner` (F4-14)

**Oczekiwany wynik:**
- `InitiativeGantt` pokazuje identyczne zależności (te same pary zadań połączone strzałkami)
- Żaden widok nie ma „dodatkowych" lub „brakujących" strzałek względem drugiego
- Oba komponenty czytają z `task_dependencies`, nie z lokalnego `dependsOnId` na modelu zadania

**API endpoint:** `GET /api/initiatives/:id/task-dependencies`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-16 — Gantt: dodanie zależności w InitiativeGantt → pojawia się w TimelinePlanner

**Cel:** Weryfikacja, że dodanie nowej zależności przez `InitiativeGantt` jest widoczne w `TimelinePlanner` bez przeładowania.

**Preconditions:**
- Inicjatywa z co najmniej 2 zadaniami BEZ zdefiniowanej zależności między nimi
- Oba widoki dostępne (np. przez przełączanie zakładek)

**Kroki:**
1. Otwórz `InitiativeGantt`
2. Dodaj zależność: task C zależy od task B (przeciągnij lub kliknij „Dodaj zależność")
3. Zapisz zmianę
4. Przejdź do widoku `TimelinePlanner`

**Oczekiwany wynik:**
- W `TimelinePlanner` widoczna nowa strzałka B → C
- Zmiana widoczna bez F5
- Żaden z istniejących task nie utracił swoich poprzednich zależności

**API endpoint:** `POST /api/initiatives/:id/task-dependencies`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-17 — Gantt: wykrycie zależności cyklicznej (A→B→A) nie crashuje aplikacji

**Cel:** Weryfikacja odporności Gantta na cykliczne zależności między zadaniami.

**Preconditions:**
- Inicjatywa z co najmniej 2 zadaniami A i B
- Istniejąca zależność A → B

**Kroki:**
1. Spróbuj dodać zależność B → A (zamknięcie cyklu)
2. Obserwuj reakcję aplikacji

**Oczekiwany wynik:**
- Aplikacja nie crashuje (brak białego ekranu, brak nieskończonej pętli renderowania)
- Wyświetlany jest komunikat o błędzie: „Nie można utworzyć zależności — cykl" lub podobny
- Zależność B → A NIE zostaje zapisana
- Strzałka A → B pozostaje nienaruszona w Gantt

**API endpoint:** `POST /api/initiatives/:id/task-dependencies` → oczekiwany błąd walidacji

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-18 — Gantt: brak zależności → brak strzałek (bez crashu)

**Cel:** Weryfikacja, że Gantt poprawnie renderuje się gdy inicjatywa ma zadania, ale żadnych zależności.

**Preconditions:**
- Inicjatywa z co najmniej 2 zadaniami, tabela `task_dependencies` pusta dla tej inicjatywy

**Kroki:**
1. Otwórz inicjatywę w widoku `InitiativeGantt`
2. Otwórz tę samą inicjatywę w widoku `TimelinePlanner`
3. Obserwuj oba widoki

**Oczekiwany wynik:**
- W obu widokach widoczne są paski zadań (timeline), ale BEZ strzałek zależności
- Brak błędu: „Cannot read properties of undefined" lub podobnego
- Widoki ładują się poprawnie, nie ma spinnera w nieskończoność

**API endpoint:** `GET /api/initiatives/:id/task-dependencies` → pusta tablica `[]`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-19 — InitiativesHub ładuje listę przy montowaniu (brak nieskończonego spinnera)

**Cel:** Weryfikacja, że `InitiativesHub` prawidłowo pobiera i wyświetla listę inicjatyw przy pierwszym załadowaniu.

**Preconditions:**
- Użytkownik zalogowany z co najmniej jedną inicjatywą w organizacji

**Kroki:**
1. Przejdź do `InitiativesHub` (np. kliknij „Inicjatywy" w nawigacji)
2. Obserwuj czas ładowania i wynik

**Oczekiwany wynik:**
- Spinner ładowania znika w ciągu max 5 sekund
- Lista inicjatyw widoczna (co najmniej jeden element)
- Brak komunikatu o błędzie
- Brak nieskończonego spinnera (skeleton nie trwa dłużej niż 10 s)

**API endpoint:** `GET /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-20 — ExecutionHub ładuje inicjatywy SCHEDULED/EXECUTING przy montowaniu

**Cel:** Weryfikacja, że `ExecutionHub` poprawnie pobiera i wyświetla inicjatywy w statusach SCHEDULED i EXECUTING.

**Preconditions:**
- Istnieje co najmniej jedna inicjatywa w statusie SCHEDULED lub EXECUTING

**Kroki:**
1. Przejdź do `ExecutionHub` przez nawigację (np. `/implementation`)
2. Obserwuj ładowanie

**Oczekiwany wynik:**
- `ExecutionHub` wyświetla sekcje SCHEDULED i EXECUTING z inicjatywami
- Liczniki per-status są poprawne (zgodne z danymi w bazie)
- Brak nieskończonego spinnera

**API endpoint:** `GET /api/initiatives?status=SCHEDULED,EXECUTING` (lub odpowiednik)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-21 — Widok Kanban w InitiativesHub pokazuje kolumnę DRAFT

**Cel:** Weryfikacja, że widok Kanban w `InitiativesHub` zawiera kolumnę DRAFT i wyświetla w niej właściwe inicjatywy.

**Preconditions:**
- Istnieje co najmniej jedna inicjatywa w statusie DRAFT
- `InitiativesHub` otwarty w trybie Kanban (nie lista)

**Kroki:**
1. Otwórz `InitiativesHub`
2. Przełącz na widok Kanban (jeśli nie jest domyślny)
3. Zlokalizuj kolumnę DRAFT

**Oczekiwany wynik:**
- Kolumna DRAFT widoczna w Kanban
- Inicjatywy ze statusem DRAFT wyświetlone w tej kolumnie
- Karty inicjatyw zawierają tytuł i podstawowe metadane
- Brak inicjatyw z innych statusów w kolumnie DRAFT

**API endpoint:** `GET /api/initiatives?status=DRAFT`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-22 — Brak komponentu InitiativeDetailModal (usunięty)

**Cel:** Weryfikacja, że `InitiativeDetailModal` nie istnieje w aplikacji (był martwym kodem i został usunięty).

**Preconditions:**
- Dostęp do kodu źródłowego lub możliwość obserwacji bundla

**Kroki:**
1. Kliknij inicjatywę na liście w `InitiativesHub`
2. Obserwuj jak otwierają się szczegóły inicjatywy
3. Sprawdź, czy komponent to Modal czy inline panel / drawer
4. Opcjonalnie: przeszukaj bundle/sources w DevTools pod kątem `InitiativeDetailModal`

**Oczekiwany wynik:**
- Szczegóły inicjatywy otwierają się jako panel boczny lub strona, NIE jako modal (`<dialog>` / modal overlay)
- W DevTools Sources lub bundle brak komponentu `InitiativeDetailModal`
- Interakcja ze szczegółami działa poprawnie bez starego komponentu

**API endpoint:** n/d (weryfikacja struktury komponentów)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-23 — Wersja odświeżenia = 0 przy pierwszym załadowaniu

**Cel:** Weryfikacja, że `sharedRefreshVersion` startuje od 0 przy inicjalizacji store Zustand.

**Preconditions:**
- Świeża sesja przeglądarki (bez cached state)
- DevTools z inspektorem Zustand lub React DevTools

**Kroki:**
1. Otwórz aplikację w trybie incognito lub po wyczyszczeniu localStorage
2. Zaloguj się
3. Przejdź do `InitiativesHub`
4. Otwórz DevTools → React DevTools lub Zustand DevTools
5. Znajdź store `useInitiativeRefreshStore`
6. Sprawdź wartość `sharedRefreshVersion`

**Oczekiwany wynik:**
- `sharedRefreshVersion` = 0 (lub analogiczna wartość startowa: null / undefined) bez żadnej mutacji
- Store widoczny i poprawnie zainicjalizowany

**API endpoint:** n/d (stan FE)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-24 — Po 3 mutacjach → wersja = 3

**Cel:** Weryfikacja, że każda mutacja (create/update/delete/status change) inkrementuje `sharedRefreshVersion` dokładnie o 1.

**Preconditions:**
- `sharedRefreshVersion` = 0 (świeża sesja)
- DevTools z inspektorem Zustand otwarte

**Kroki:**
1. Zanotuj startową wartość (= 0)
2. Utwórz nową inicjatywę → sprawdź wersję (oczekiwana: 1)
3. Zaktualizuj tytuł tej inicjatywy → sprawdź wersję (oczekiwana: 2)
4. Zmień status tej inicjatywy → sprawdź wersję (oczekiwana: 3)

**Oczekiwany wynik:**
- Po każdej operacji `sharedRefreshVersion` wzrasta o dokładnie 1
- Po 3 operacjach końcowa wartość = 3
- Brak skoków (+2 za jedną operację) i brak pominięć (wartość nie wraca do 0)

**API endpoint:** `POST /api/initiatives`, `PATCH /api/initiatives/:id`, `PATCH /api/initiatives/:id/status`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-25 — Subskrypcja InitiativesHub: zmiana innego slice Zustand nie wyzwala re-fetchu

**Cel:** Weryfikacja, że `InitiativesHub` re-fetchuje TYLKO przy zmianie `sharedRefreshVersion`, nie przy zmianach innych slice'ów store.

**Preconditions:**
- DevTools Network tab otwarty
- Aplikacja otwarta z `InitiativesHub`

**Kroki:**
1. Wyczyść Network tab
2. Wykonaj akcję zmieniającą inny slice Zustand (np. zmień motyw kolorystyczny, zmień język, otwórz/zamknij sidebar)
3. Obserwuj Network tab przez 3 sekundy

**Oczekiwany wynik:**
- Brak nowego requestu `GET /api/initiatives` w Network tab
- `sharedRefreshVersion` pozostaje niezmieniona
- `InitiativesHub` nie przeładowuje listy

**API endpoint:** brak (obserwacja braku requestu)

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-26 — Nawigacja z Analizy do deep link inicjatywy → właściwy moduł otwiera się

**Cel:** Weryfikacja, że kliknięcie linku do inicjatywy z modułu Analiza (np. z raportu AI) otwiera poprawny widok.

**Preconditions:**
- Moduł Analiza dostępny z wynikami zawierającymi referencję do inicjatywy
- Znane ID inicjatywy referencjonowanej w raporcie

**Kroki:**
1. Przejdź do modułu Analiza
2. Otwórz raport/wynik zawierający link do konkretnej inicjatywy
3. Kliknij link do inicjatywy

**Oczekiwany wynik:**
- Aplikacja nawiguje do `InitiativesHub` z otwartym panelem szczegółów właściwej inicjatywy
- URL zawiera `initiativeId=<id>`
- Tytuł inicjatywy w panelu zgadza się z referencją w raporcie
- Brak błędu 404 lub pętli nawigacji

**API endpoint:** `GET /api/initiatives/:id`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-27 — Nieaktualna lista: nowa inicjatywa podczas przeglądania → pojawia się na górze

**Cel:** Weryfikacja, że nowo dodana inicjatywa (przez inny komponent lub czat) pojawia się na liście w `InitiativesHub` bez utraty aktualnego widoku.

**Preconditions:**
- `InitiativesHub` otwarty z widoczną listą
- Użytkownik przegląda szczegóły istniejącej inicjatywy (panel otwarty)

**Kroki:**
1. Otwórz szczegóły dowolnej inicjatywy (panel boczny)
2. Przez czat lub drugie okno utwórz nową inicjatywę
3. Zamknij panel szczegółów (wróć do listy)

**Oczekiwany wynik:**
- Nowa inicjatywa widoczna na liście (na górze lub w odpowiednim porządku sortowania)
- Wcześniej otwarta inicjatywa nadal dostępna na liście
- Brak duplikatów na liście

**API endpoint:** `POST /api/initiatives`, `GET /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-28 — Duża lista (50+ inicjatyw) → paginacja działa, refresh version nadal wyzwala re-fetch

**Cel:** Weryfikacja, że mechanizm `sharedRefreshVersion` działa poprawnie przy dużej liczbie inicjatyw i aktywnej paginacji.

**Preconditions:**
- Organizacja z 50+ inicjatywami
- `InitiativesHub` otwarty na drugiej stronie paginacji (jeśli dostępna) lub z przewiniętą listą

**Kroki:**
1. Przejdź do `InitiativesHub` i przewiń listę lub przełącz na stronę 2 paginacji
2. Utwórz nową inicjatywę (przez czat lub formularz)
3. Obserwuj zachowanie listy

**Oczekiwany wynik:**
- Lista odświeża się po mutacji (re-fetch wyzwolony przez `sharedRefreshVersion`)
- Paginacja pozostaje funkcjonalna po odświeżeniu
- Nowa inicjatywa widoczna na liście (na stronie 1 jeśli posortowana malejąco)
- Brak błędów w konsoli

**API endpoint:** `GET /api/initiatives?page=2`, `POST /api/initiatives`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-29 — Filtr statusu w hubie — zmiana filtra nie resetuje refresh version

**Cel:** Weryfikacja, że zmiana filtra statusu w `InitiativesHub` nie zeruje `sharedRefreshVersion` ani nie wyzwala fałszywego re-fetchu.

**Preconditions:**
- `InitiativesHub` otwarty
- Co najmniej 2 różne statusy inicjatyw dostępne (np. DRAFT i APPROVED)
- DevTools Zustand otwarte, zanotowana aktualna wartość `sharedRefreshVersion` (np. 3)

**Kroki:**
1. Zanotuj wartość `sharedRefreshVersion` = 3
2. Zmień filtr statusu: wybierz „APPROVED" (wcześniej był „Wszystkie")
3. Sprawdź wartość `sharedRefreshVersion` po zmianie filtra
4. Zmień filtr ponownie na „DRAFT"
5. Sprawdź wartość `sharedRefreshVersion`

**Oczekiwany wynik:**
- `sharedRefreshVersion` pozostaje = 3 (niezmieniona przez filtrowanie)
- Filtrowanie działa (lista zawęża się do inicjatyw w wybranym statusie)
- Filtr wywołuje re-fetch z nowym parametrem, ALE nie inkrementuje `sharedRefreshVersion`

**API endpoint:** `GET /api/initiatives?status=APPROVED`

**Bramka:** ✅ PASS / ❌ FAIL

---

## F4-30 — Store Zustand zachowuje refresh version podczas tej samej sesji (nie resetuje się przy nawigacji)

**Cel:** Weryfikacja, że `sharedRefreshVersion` nie wraca do 0 po nawigacji między modułami w tej samej sesji.

**Preconditions:**
- Zalogowana sesja
- DevTools Zustand dostępne

**Kroki:**
1. Przejdź do `InitiativesHub` i wykonaj mutację (np. utwórz inicjatywę) → `sharedRefreshVersion` = 1
2. Przejdź do innego modułu (np. Czat, Analiza, Notatki)
3. Wróć do `InitiativesHub`
4. Sprawdź wartość `sharedRefreshVersion` w DevTools

**Oczekiwany wynik:**
- `sharedRefreshVersion` = 1 (lub wyższa jeśli były inne mutacje)
- Wartość NIE wróciła do 0 po nawigacji
- `InitiativesHub` nie wykonał zbędnego re-fetchu po powrocie (jeśli wersja się nie zmieniła)
- Stan Zustand trwa przez całą sesję przeglądarki (nie jest kasowany przy re-mount komponentu)

**API endpoint:** n/d (weryfikacja trwałości stanu FE)

**Bramka:** ✅ PASS / ❌ FAIL

---

*Koniec pliku TESTY_USPOJNIENIE_F4_STAN_FE.md*
