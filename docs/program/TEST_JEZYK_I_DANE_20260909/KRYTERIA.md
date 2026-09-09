# Test „język i dane” — kryteria (09.09.2026)

Zlecenie właściciela: „przetestuj, czy językowo jesteśmy poprawni i czy wszystkie dane są wysyłane
poprawnie oraz wystarczające do pełnego testowania”. Dwa pytania, dwie paczki, jeden raport.

## Zakres
- Środowisko języka: **żywy staging** (`https://staging.consultify.ai`, kod `0d79170f2a`), konto Northwind
  (język konta EN), tylko odczyt i nawigacja. Wersja PL: ten sam użytkownik z językiem konta przełączonym na PL
  na czas testu i przywróconym.
- Środowisko danych: **kopia czystej bazy stagingu** (zrzut po czystce 09.09, baza `consultify_staging_czysta`
  → kopia robocza), własne API + Vite. Tu wolno tworzyć i zmieniać rekordy.
- 16 modułów wg mapy przyrządu językowego (`scripts/i18n/pomiar-jezyka.mjs`): Chat, My Work, Interview, Tools,
  Assessment, Initiatives, Execution, Results, Finance, Materials, Audits, Meeting, Organization, Admin Panel,
  Settings, Partner Portal.
- Ekrany na moduł: każdy wpis Menu 1 modułu, każda zakładka Menu 2, jeden podgląd (StandardPreview) rekordu,
  jeden formularz/modal tworzenia, jeden stan pusty (jeśli osiągalny filtrem). Zrzuty 1440 px, jasny motyw,
  EN i PL.

## A. Język — kryteria (PASS = wszystkie spełnione na wszystkich ekranach modułu)
| # | Kryterium | Pomiar |
|---|---|---|
| A1 | W wersji EN **0 polskich słów** w tekście interfejsu (chrome: menu, nagłówki, przyciski, etykiety, puste stany, dymki, toasty) | tekst strony (`innerText`) + słownik z ogonkami i bez (`scripts/i18n/polski-bez-ogonkow.mjs` jako baza) + oko na zrzucie |
| A2 | W wersji EN **0 surowych kluczy i18n** (`moduł.sekcja.klucz`) i 0 napisów „undefined/null/[object” | regex na tekście strony |
| A3 | Daty i liczby w EN w formacie angielskim (np. `9 Sep 2026` / `Sep 9, 2026`, separator dziesiętny `.`), w PL polskim (`9 wrz 2026`, `,`) — bez `pl-PL` w EN i `en-US` w PL | regex na tekście + porównanie tej samej wartości w obu językach |
| A4 | Statusy/enumy pokazane etykietą, nie surową wartością (`IN_EXECUTION`, `on_hold`, `draft` wielkimi/snake) | regex `[A-Z]{3,}_[A-Z_]+` i `\b[a-z]+_[a-z]+\b` w tekście |
| A5 | W wersji PL **0 angielskich napisów chrome** (dane Northwind SĄ po angielsku z założenia — treść rekordów nie liczy się) | jak A1 z listą słów EN; rozróżnić chrome od danych |
| A6 | Ten sam ekran w EN i PL ma ten sam układ i tę samą liczbę elementów (brak ekranu, który „znika” w jednym języku) | porównanie liczby wierszy/kart/zakładek |
| A7 | Zmiana języka konta działa bez przeładowania cache (po zmianie w Ustawieniach cały interfejs jest w nowym języku po odświeżeniu) | zmiana → reload → A1/A5 |

## B. Dane — kryteria (PASS per moduł)
| # | Kryterium | Próg |
|---|---|---|
| B1 | Każdy ekran modułu ładuje się bez błędów: 0 błędów konsoli, 0 odpowiedzi 5xx, 0 nieoczekiwanych 4xx (401/403/404 na wołaniach ekranu) | log konsoli + sieć |
| B2 | Liczby w interfejsie zgadzają się z bazą (lista N wierszy = N rekordów w SQL dla organizacji Northwind) | SQL vs UI, per lista |
| B3 | Dane wystarczające do pełnego testu — minimum na moduł: Inicjatywy ≥ 10 i **każdy status** (szkic, zatwierdzona, w realizacji, wstrzymana, zamknięta) ≥ 1; Realizacja ≥ 3 sprawy z zadaniami, RAID, decyzjami, kamieniami milowymi, raportem; Moja Praca ≥ 5 zadań przypisanych do zalogowanego użytkownika + skrzynka niepusta; Spotkania ≥ 2 z notatką/decyzją; Wywiad ≥ 1 sesja z odpowiedziami; Ocena ≥ 1 ukończona z raportem; Narzędzia ≥ 3 artefakty w ≥ 2 typach; Wyniki: KPI ≥ 5 z wartościami; Finanse: ≥ 1 budżet i ≥ 1 ROI; Materiały ≥ 3 dokumenty/prezentacje; Audyty ≥ 1; Organizacja: profil kompletny (nazwa, branża, wielkość, strategia), ≥ 8 członków; Admin: lista użytkowników i ról; Ustawienia: profil, bezpieczeństwo; Partnerzy: ekran ładuje się (dane opcjonalne); Czat: ≥ 1 rozmowa z historią | SQL + UI |
| B4 | Ścieżka zapisu działa (na kopii): w każdym z modułów Inicjatywy, Realizacja, Moja Praca, Spotkania, Materiały — utwórz rekord → widać na liście → edytuj → podgląd pokazuje zmianę → usuń/zamknij; API 2xx | UI + sieć |
| B5 | Podgląd rekordu (StandardPreview) pokazuje pola z wartościami, nie same „—” (≥ 70 % pól wypełnionych dla ≥ 1 rekordu na moduł) | oko + zliczenie |
| B6 | Dane po angielsku i spójne: nazwy, opisy, statusy rekordów Northwind bez polskich wtrętów; osoby/właściciele przypisani (nie „Przypisany właściciel”, nie puste) | tekst rekordów |
| B7 | Konta Northwind: każde z 9 kont loguje się, ma rolę i widzi swój moduł startowy | logowanie per konto |

## C. Raport
`docs/program/TEST_JEZYK_I_DANE_20260909/RAPORT.md`: tabela 16 modułów × (A1–A7, B1–B7) z PASS/FAIL/N/A i ścieżką
dowodu; lista defektów uszeregowana (blokujący / widoczny / kosmetyczny) z `ekran → co → gdzie w kodzie`;
werdykt: „gotowe do pełnego testowania: TAK/NIE + co brakuje”. Zrzuty: `evidence/test-jezyk-dane-0909/{jezyk,dane}/`.
Zasada: PASS tylko po pomiarze; „nie sprawdziłem” = N/A z powodem, nie PASS.
