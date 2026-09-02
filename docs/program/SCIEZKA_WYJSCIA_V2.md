---
doc_id: program-sciezka-wyjscia-v2
status: canonical
owner: piotr
truth_type: plan
established: 2026-09-01
supersedes: program-sciezka-wyjscia
---

# ŚCIEŻKA WYJŚCIA v2 — aktualizacja po tygodniu

Zastępuje `SCIEZKA_WYJSCIA.md` (30.08, K1-K6). **Tamten plan nie był zły — trzy z sześciu
kroków wykonano co do joty, a K5 poszedł pięć razy szybciej.** Ten dokument nie wymyśla
nowej metodyki; **poprawia jedną rzecz, którą tamten plan przewidział, a mimo to nie
rozwiązał: rytm werdyktów.**

## Definicja KOŃCA — niezmieniona od 24.08
1. **16 × `CLOSED_FINAL`** — SHA + hash kompletu zrzutów + tag.
2. **Demo aktualne** — frozen SHA → staging → demo + tag `demo-safe`.
3. **Decyzja o agencie** — podjęta świadomie.

## ★ Najważniejsza lekcja tygodnia — i dlatego ten plan wygląda inaczej

**Licznik `CLOSED_FINAL` stoi na 2/16 od tygodnia, a formalnie na 0/16.**
Zmierzone: **bramka G18 („moduł zaakceptowany i zaczekpointowany") ma `NOT_STARTED`
we wszystkich 16 kartach.** Tak samo G17, G19 i G20. **Mechanizm formalnego zamknięcia
nie został uruchomiony ani razu, dla żadnego modułu.**

Przez tydzień robiliśmy **pomiar i naprawę** — i to poszło dobrze. **Nie robiliśmy
zamykania.** Plan v1 nazwał to wąskie gardło z góry (*„werdykty właściciela — 14 modułów
× pakiet zrzutów"*) i **miał rację, ale nie postawił bramki, która by to wymusiła.**

> **Poprawka v2: zamykanie modułów przestaje być ostatnim krokiem po wszystkich dyżurach.
> Staje się RÓWNOLEGŁYM torem, który rusza natychmiast.**

## ★★ Rozdzielenie, którego v1 nie miał: co BLOKUJE odbiór, a co nie

Szacunek „56-91 dyżurów" z pomiaru dotyczy **domknięcia wszystkiego**. **Do rozpoczęcia
odbiorów potrzeba znacznie mniej** — i to jest sedno tej aktualizacji.

### A. BLOKUJE — musi być zrobione, zanim właściciel patrzy (3 dyżury, wydane dziś)

| Dyżur | Dlaczego blokuje |
| --- | --- |
| **242 Uprawnienia** | **3 dziury cross-org wciąż otwarte** (wnioski o uprawnienia, wideo, kontekst AI — ten ostatni ma **dwie** trasy, nie jedną). Dziś wygaszone flagą na demo, **żywe kodowo wszędzie indziej**. Nie pokazujemy produktu, w którym obca firma kasuje cudze dane. |
| **243 Podgląd** | **Trzecia część kanonu list nie została sfotografowana ANI RAZU** — 12/12 zrzutów toru grafiki i 0/20 naszych ekranów dowodowych. Bez tego każdy werdykt dotyczy dwóch części z trzech. |
| **244 Organizacja + Ustawienia** | Jedyne dwa moduły liczone jako zamknięte — **oba zakwestionowane**. Organizacja zamknięta na akcepcie **prototypu**, Ustawienia przy **nierozpoczętym** przeglądzie. Dopóki to stoi, **żadne inne zamknięcie nie jest wiarygodne.** |

**Trzy naprawione dziś dziury** (wstrzyknięcie obcego administratora do projektu,
pełny CRUD cudzych dokumentów, zmiana cudzych eskalacji) — **zweryfikowane w kodzie,
nie w dokumencie**: kontrola obecna, testy regresyjne na realnym Postgresie istnieją.

### B. NIE BLOKUJE — idzie równolegle albo po pierwszych werdyktach

Rzeczy realne, ale **niepowstrzymujące patrzenia na ekrany**: mianownik pokrycia Wyników
(146 czy 152) · „management report" wyceny w MVP czy poza · trzecia bramka Spotkań ·
kreator formularzy w Mojej Pracy (naprawiony, czeka na odbiór) · 39 martwych bliźniaków
tras (porządek, nie funkcja) · rozjazdy nazw pól poza dwoma zmierzonymi.

### C. CZEKA NA COŚ SPOZA NASZEJ KONTROLI
- **Generatory dokumentu i prezentacji** — **czekają na klucz do modelu**, nie na dyżur.
  Dopóki go nie ma, oceniamy zastępniki. **Arkusz działa i jest jedynym ocenionym.**
- **Filar 2 Gammy (kolor, układ)** — **twardy sufit biblioteki**: zero gradientów,
  zero osadzania czcionek, potwierdzone dwukrotnie. **To nie jest dyżur, to decyzja
  kierunku** (własne składanie · API Gammy · render do obrazu).
- **Trzy zablokowane moduły** — Realizacja, Assessment, Inicjatywy: **materiał do decyzji
  zmierzony (239-241)**, czeka na Twój wybór wariantu.

## KROKI v2

**W1 · Trzy dyżury blokujące (242, 243, 244).** Wydane, wklejki gotowe.
→ *bramka: zero rzeczy, które psują dane lub zasłaniają kanon.*

**W2 · ★ RYTM WERDYKTÓW — rusza RÓWNOLEGLE z W1, nie po nim.**
To jest zmiana wobec v1. Partia = **2-3 moduły**, komplet zrzutów **po kliknięciu w wiersz**
(podgląd w kadrze), jasny i ciemny.
**Pierwsza partia gotowa dziś: Finanse · Wyniki · Materiały** — mają najświeższy pomiar.
→ *bramka: pierwszy moduł z G17-G20 `PASS`. To będzie pierwszy raz w programie.*

**W3 · Kolejne partie w rytmie ciągłym.** Po pierwszej partii wiemy, ile realnie trwa
posiedzenie werdyktowe — **i dopiero wtedy da się uczciwie policzyć koniec.**
Dziś każda liczba dni jest zgadywaniem, bo **ten mechanizm nigdy nie działał.**

**W4 · Decyzje właściciela na materiale z 239-241.** Magazyny zadań (wariant A/B/C),
Assessment, ścieżka zapisu Inicjatyw. **Materiał gotowy, czeka wyłącznie na Ciebie.**

**W5 · Staging.** Dystans **668 commitów** (był 3709). Kolejność: obejrzeć 10 cudzych
commitów `develop` → punkt bezpieczny → decyzja o flagach → pchnięcie (**wdrożenie jest
automatyczne**) → migracje na **pustej bazie** = pierwszy realny test odtworzenia.

**W6 · Demo, potem decyzja o agencie.** Demo dostaje **wyłącznie stan zaakceptowany
na stagingu**. Flaga agenta **nie istnieje dziś w kodzie** — dyżur 174 scalony,
mechanizm do zweryfikowania przed decyzją.

## Rachunek czasu — uczciwie, z nazwaniem niewiadomej
**Tor funkcji nie jest wąskim gardłem** — trzy blokujące dyżury to godziny, nie dni.
**Wąskim gardłem jest tempo werdyktów, którego NIE ZNAMY, bo ani jeden moduł nigdy
nie przeszedł G17-G20.**

**Dlatego v2 nie podaje daty końca.** Poda ją **po pierwszej partii** — wtedy będzie to
pomiar, nie życzenie. **v1 podał „tydzień-półtora" i to była jedyna liczba w tamtym
planie, która się nie sprawdziła.**

## Czego ten plan wymaga od Ciebie — trzy rzeczy
1. **Zgoda na rytm werdyktów** — partie 2-3 modułów. **To jest brakujący element całego
   programu**, nie formalność.
2. **Cztery decyzje z gotowym materiałem**: magazyny zadań · Assessment · zapis Inicjatyw ·
   kierunek filaru 2 Gammy.
3. **Odpowiedź o produkcji** — czy `consultify.ai` jest wdrożona z danymi klientów.
   **Jedyna rzecz, która może zmienić kolejność wszystkiego.**
