# Test „język i dane” — raport zbiorczy (09.09.2026, stan 15:00)

Kryteria: [KRYTERIA.md](KRYTERIA.md). Raporty szczegółowe: [RAPORT_JEZYK.md](RAPORT_JEZYK.md) (część A, żywy staging, 176 zrzutów EN+PL), [RAPORT_DANE.md](RAPORT_DANE.md) (część B, kopia czystej bazy stagingu, 70 ekranów + SQL + ścieżki zapisu + 9 kont).

## Werdykt

| pytanie właściciela | odpowiedź | uzasadnienie |
|---|---|---|
| Czy językowo jesteśmy poprawni? | **W EN: TAK po dwóch naprawach z 15:00; w PL: TAK po tej samej naprawie, z jednym widocznym wyjątkiem** | 14 z 16 modułów czyste na A1–A7 w obu językach. Dwa blokery w Materiałach (74 polskie napisy w EN z zaszytej funkcji liczby mnogiej; „Application → System” w PL) naprawione w kodzie (`d6f2c45bef`) i czekają na wdrożenie. Zostaje: Wyniki/OKR w PL pokazują zakres dat po angielsku („Jul to Sep”) — źródło poza komponentami, do następnej paczki. 3 globalne szablony prezentacji i 6 opisów miały polską treść w bazie — przetłumaczone na stagingu i demo. |
| Czy dane są wysyłane poprawnie? | **TAK** | 70 ekranów: 0 błędów konsoli, 0 odpowiedzi 5xx, 1 semantyczne 404 (brak opublikowanej migawki karty KPI). Liczby w interfejsie zgodne z bazą w 11 z 13 list. Zapis utrwala się w bazie dla zadań, decyzji i inicjatyw. 9 z 9 kont Northwind loguje się z właściwą rolą. |
| Czy dane wystarczają do pełnego testowania? | **NIE — pięć braków, dosiew w toku** | Organizacja: profil 8/13 pól, pusta strategia. Wywiad: 0 przydziałów (domyślna zakładka pusta). Wyniki: 0 opublikowanych migawek przeglądu. Realizacja: 42 zadania skupione w jednym tygodniu (Resources 13 %). Pola pochodne FORMAT/SOURCE/LEVEL/VARIANCE/AREA puste w każdym wierszu. Paczka DANE-D9 dopisuje etap seedu z weryfikacją; po niej zasiew na staging i demo. |

## Co jeszcze wyszło (kod, nie dane) — paczka POPRAWKI-PO-TESCIE-1 w toku
D-01 Ocena pokazuje „DRD · 614e5f28” zamiast nazwy, puste SCORE/CONFIDENCE · D-02 pięć polskich akapitów w bibliotece Oceny · D-06 surowe UUID w podglądzie Mojej Pracy · D-07 podgląd Materiałów bez separatorów i czerwona plakietka przy „Ready” · D-08/09 sprzeczne liczniki w Realizacji (backlog, decyzje 7 vs 9, „No ROI computed”) · D-10 e-mail wychodzi pod ROLE w Adminie · D-11 chipy Audytów nie sumują się, CRITERIA puste · D-12 „IX 2026” i „P&L / —BS / —CF” · D-15 brak ręcznej ścieżki tworzenia inicjatywy (tylko kreator AI) · D-17 plakietka „3 V9 overrides” na każdym ekranie.

## Poza kryteriami
- Meeting: moduł to zaślepka „planned for Wave 2” — flaga na stagingu włączona, ale nie ma czego testować (N/A w obu częściach).
- Partner Portal: konto OWNER bez `partner_users` widzi tylko ekran „connect” — N/A.
- Finanse: brak pozycji w Menu 1 (moduł poza MVP wg decyzji), działa pod `/finance`.
- Bezpieczeństwo: hasło kont Northwind raz trafiło do logu narzędzia (dwa razy, u robotnika i u nadzorcy) → **zrotowane na stagingu i demo 14:50**, nowy plik u właściciela. Stary literał w dwóch skryptach D6 to hasło kopii lokalnej z 08.09 (nie działa na stagingu) — usunięty z kodu (`b0ee195cdc`).

## Sprostowania robotników (zapisane, bo świadczą o jakości pomiaru)
- TEST-DANE: 22 „404” z pierwszego przebiegu to brak `ENABLE_V8_GLOBAL` w jego środowisku, nie produkt; „edycja inicjatywy nie zapisuje” to złe pole w żądaniu.
- TEST-JEZYK: pierwszy przebieg PL szukał zakładek po angielskich nazwach (51 nieudanych ekranów) — cztery dogrywki, wszystkie 86 ekranów PL domknięte.
