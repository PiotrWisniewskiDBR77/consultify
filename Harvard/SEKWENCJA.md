# SEKWENCJA GŁÓWNA — 8 kroków do dokończonej aplikacji

**Decyzja właścicielska (2026-06-11, Harvard):** pracujemy w sztywnej sekwencji — najpierw PEŁNA WIDOCZNOŚĆ wszystkich modułów, potem kompletna dokumentacja dokończenia, dopiero potem budowa i testy. Nie przeplatamy audytów z naprawami (wyjątek niżej).

| Krok | Co | Gdzie | Wynik (bramka wyjścia) |
|---|---|---|---|
| **1** | Pełna dokumentacja formuły audytowej (protokół, szablony, struktura, instrukcje) | Komputer 1 (Harvard) | ✅ ZROBIONE — ten katalog |
| **2** | Push do GitHuba | Komputer 1 | commit z kompletem formuły na `feat/deliverables-light` |
| **3** | Odbiór na drugim komputerze (clone/pull + BOOTSTRAP_PROMPT + checklist środowiska) | Komputer 2 | Claude na K2 potwierdza gotowość środowiska |
| **4** | **AUDYTY: pełna analiza wszystkich modułów po kolei wg Protokołu V1** (Fazy 0–7, w tym sekcja 1g — połączenia międzymodułowe) | Komputer 2 (całodniowo, gdy zespół na wykładach) | 28/28 kart wypełnionych z ocenami; tracker komplet; **pełna widoczność** |
| **5** | **WYMOGI DOKOŃCZENIA:** dla każdego modułu Faza 8 — kompletny plan dokończenia (odpowiedź na błędy, braki, problemy z kroku 4) | Komputer 2 | 28/28 sekcji „Plan dokończenia" + DoD; backlogi testowe |
| **6** | **PRZEGLĄD POŁĄCZEŃ MIĘDZYMODUŁOWYCH:** synteza sekcji 1g wszystkich kart → `INTEGRACJE.md`; weryfikacja każdego przepływu FE+BE end-to-end; uzupełnienie planów dokończenia o brakujące przepływy | Komputer 2 | `INTEGRACJE.md` komplet = **idealnie kompletna dokumentacja** |
| **7** | **BUDOWA:** realizacja planów dokończenia moduł po module + zatwierdzenie każdego (DoD pkt 1, 4–6 + wszystkie testy wykonywalne na niepełnym środowisku); log w WDROZENIE_LOG.md | Komputer 2 (+1) | moduły zbudowane i zatwierdzone jednostkowo |
| **8** | **SYSTEM TESTÓW:** Claude w pełni automatycznie opisuje scenariusze i buduje system testów wszystkich modułów DZIAŁAJĄCYCH RAZEM (integracyjne + E2E po przepływach z INTEGRACJE.md) + żywa weryfikacja całości (DoD pkt 2–3) | Komputer 2 | zielony pełny test-suite + raport końcowy „stan aplikacji" |

## Reguły sekwencji

1. **Bramki:** nie wchodzimy w krok N+1, dopóki bramka kroku N nie jest spełniona (tracker to odzwierciedla). Wyjątek: krok 7 może startować modułami, których plany są zatwierdzone, zanim 28/28 planów istnieje — ALE dopiero po zamknięciu kroku 6 (bo przeglądy połączeń zmieniają plany).
2. **Wyjątek quick-fix w kroku 4:** jeśli audyt znajdzie błąd naprawialny w ≤5 linijkach i bez ryzyka (literówka, zły URL endpointu, brak nagłówka auth) — wolno naprawić od razu, z wpisem do WDROZENIE_LOG i adnotacją w karcie. Wszystko większe czeka na krok 7.
3. **Kolejność modułów w kroku 4:** pula 1 core → pula 2 beta → Ideas (dociągnięcie 🔁) → internal (jak w _TRACKER.md). Maks 2 moduły równolegle (Faza 4 jest sekwencyjna — jedna przeglądarka).
4. **Commit + push po każdym module w krokach 4–7** — postęp widoczny w GitHubie na obu komputerach; `git pull` przed każdą sesją.
5. **Krok 8 — zakres systemu testów:** scenariusze przekrojowe z INTEGRACJE.md (np. czat→intent→Canvas→registry→Outputs→inicjatywa; wywiad→insight→inicjatywa→wdrożenie→rezultaty; notatka→konwersja→zadanie→inbox), uruchamialne w CI; tam gdzie potrzebne pełne środowisko — oznaczone i odpalane na staging.

## Środowisko K2 (deklaracja właściciela — nie blokować się na tym)
- Pliki lokalne (w tym `.env`, `server/.env.local`) przechodzą przez synchronizację chmurową komputerów — NIE trzeba ich przenosić ręcznie.
- Dostęp do Railway zostanie zbudowany na K2.
- Wszystkie potrzebne połączenia/integracje będą udostępnione.
- Mimo to: BOOTSTRAP checklist na K2 weryfikuje każdy z tych punktów PRZED startem kroku 4 (zaufanie + weryfikacja); szczególnie `DATABASE_URL` — sprawdzić, na którą bazę patrzy, zanim cokolwiek zapisze.
