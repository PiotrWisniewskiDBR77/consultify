# D8 — dowód na STAGINGU (https://staging.consultify.ai)

Organizacja pokazowa "Northwind Manufacturing Ltd." (`468b234c-66c4-54e1-b626-5e0fb3a92f6a`)
zasiana przed restartem maszyny (paczki D1-D6, poprzedni robotnik). Ten dokument to
TYLKO ODCZYT: zapytania SELECT na żywej bazie stagingu (`thomas.proxy.rlwy.net`) +
zrzuty Playwright (login formularzem, jasny motyw, 1440x900, bez żadnej akcji zapisu).

Stanowisko: `/Users/piotrwisniewski/Developer/wt/fable-inicjatywy`, gałąź
`mvp/inicjatywy-lancuch-20260907`, SHA `5d01b63f72` (bazowy — brak commitów kodu
produktu w tej sesji, tylko evidence + skrypty pomocnicze).

## 1. Liczby: Northwind (staging) vs `--verify` paczki D7

Źródło porównania: `evidence/dane-pokazowe-en/d7-galeria/dowod-cli.txt` (rehearsal
na kopii bazy `consultify_kopia_d7`, nie na stagingu — to jedyny dostępny wzorzec
liczbowy). Surowe zapytania: `evidence/dane-pokazowe-en/d8-staging/liczby-baza.txt`.

| Metryka | Staging (D8, SELECT) | D7 verify (wzorzec) | Różnica |
|---|---|---|---|
| users | 9 | 9 | brak |
| organization_members (ACTIVE) | 9 | 9 | brak |
| initiatives razem | 13 (APPROVED 4, CLOSED 1, DRAFT 1, IN_EXECUTION 4, PENDING_APPROVAL 1, PROPOSED 1, REJECTED 1) | 13 (ten sam rozkład) | brak |
| tasks | **42** | **36** | **+6** |
| raid_items | 7 | 7 | brak |
| decisions | 9 | 9 | brak |
| initiative_milestones | **16** | **8** | **+8 (dokładnie 2×)** |
| rvn_kpi_definitions | 8 | 8 KPI | brak |
| rvn_kpi_measurements | 48 | 48 pomiarów | brak |
| budgets | 1 | 1 budżet | brak |
| financial_statements | 4 | 4 kwartały | brak |
| execution_report_snapshots | 2 | 2 raporty statusu | brak |
| meetings | 2 | 2 spotkania | brak (ale patrz TABELA §3 — moduł UI tego nie pokazuje) |
| conversations | 3 | 3 wątki czatu | brak |
| interview_sessions | 2 | 2 | brak |
| ie_aggregate_state: execution_case | 4 | 4 | brak |
| ie_aggregate_state: handoff_package | 4 | 4 | brak |

Bez wzorca w D7 (informacyjnie, sam odczyt ze stagingu): v8_output_artifacts=97,
audit_programs=1, audit_program_findings=3.

**Różnice wymagające wyjaśnienia:** `tasks` i `initiative_milestones` na
stagingu są wyższe niż w rehearsalu D7 (odpowiednio +6 i dokładnie 2×). Nie
oceniam przyczyny (mogła to być druga aplikacja seeda, migracja, albo inny
przebieg D4 na prawdziwym stagingu niż na kopii testowej) — tylko odnotowuję
rozjazd między tym, co `--verify` D7 zmierzył, a tym, co faktycznie jest w
bazie stagingu dzisiaj.

## 2. Liczby: DBR77 (staging) vs przegląd 08.09

Źródło porównania: `docs/program/PRZEKAZANIE_KODOWANIA_20260907/PRZEGLAD_DANYCH_DBR77_20260908.md`
(pomiar na kopii bazy stagingu z 05:50 tego samego dnia).

| Metryka | Staging teraz (D8) | Przegląd 08.09 | Różnica |
|---|---|---|---|
| initiatives | 106 | 104 | +2 |
| tasks | 214 | 197 | +17 |
| users | 16 | 17 | -1 |

Wypisuję różnice bez oceny przyczyny (zgodnie z poleceniem) — możliwe, że
między porannym pomiarem (05:50) a teraz ktoś coś dopisał/usunął na
stagingu, albo że różne zapytania liczą inny zakres (np. inny filtr
statusu/soft-delete). Do wyjaśnienia przez kogoś ze znajomością zmian na
DBR77 z dnia 08.09.

## 3. Tabela 16 modułów (login OWNER james.whitfield@northwind.example)

| # | Moduł | Stan | Polskie słowa UI | Uwagi |
|---|---|---|---|---|
| 1 | Chat | PEŁNY | 0 | Ekran startowy ("Nice to have you here, James") — lista 3 wątków nie jest domyślnie widoczna na start, wymaga ikony historii. Dane (conversations=3) są w bazie. |
| 2 | My Work | PEŁNY | 0 | Inbox: All 8, Overdue 2 — zgodne z D6 verify (6 zadań + 6 pozycji skrzynki, 2 overdue). |
| 3 | Interview | PEŁNY | 0 | 2 sesje (Quality & Compliance, Plant Operations), oba Completed 100%. |
| 4 | Tools | **CZĘŚCIOWY** | 2 (nagłówek "Narzędzia", kategorie "Strategiczne"/"Operacyjne") | Treść biblioteki (36 narzędzi, tagi, statusy) w 100% angielska — tylko nagłówek modułu i etykiety kategorii po polsku. |
| 5 | Assessment | **CZĘŚCIOWY** | 1 (nagłówek "Ocena") | Treść (5 metodyk: ADMA/CMMI/DRD/Lean 4.0/SIRI) w pełni angielska — tylko nagłówek modułu po polsku. |
| 6 | Initiatives + podgląd | PEŁNY | 0 | Lista domyślnie "Active"=11 (13 minus CLOSED/REJECTED — filtr, nie błąd). Podgląd "Customer Portal for Order Tracking" (DRAFT) otwarty realnym kliknięciem w wiersz — panel z tytułem, kontekstem, właściwościami, CTA "Submit for approval" (nieklikane). |
| 7a-e | Execution (5 zakładek) | PEŁNY | 0 | Deliveries (4), Work (42 zadania), Resources (9 osób, utilisation 13%), Decisions & risks (9 decyzji/7 RAID), Reports (2 raporty: 1 Draft, 1 Published). |
| 8 | Results (KPI) | PEŁNY | 0 | 1 raport "Northwind 2027 — monthly performance", 8 wskaźników, 8 open actions. |
| 9 | Finance | PEŁNY | 0 | 1 sprawozdanie (P&L/BS/CF, Q3 FY2025–Q2 FY2026, GBP, Approved). |
| 10 | Materials | PEŁNY | 0 | 7 pozycji: 4 dokumenty, 2 prezentacje, 1 arkusz — zgodne z D6 verify. |
| 11 | Audits | PEŁNY | 0 | 1 audyt "Operational Excellence Audit 2026", Published, Unverified. |
| 12 | Meetings | **PUSTY (bramka)** | 0 | Ekran pokazuje zaślepkę: "Meetings — planned for Wave 2. This module isn't part of the MVP yet." — mimo że baza ma meetings=2, meeting_participants=8, meeting_notes=2 (D6 verify PASS). Dane istnieją, moduł jest wyłączony/zaślepiony na tym środowisku. |
| 13 | Organization | **CZĘŚCIOWY — DEFEKT JĘZYKOWY** | 46 trafień diakrytyków, 28 unikalnych słów DANE-heurystyka (realnie: całe UI) | Cały ekran "Identity & Operating Model" renderuje się PO POLSKU: "Tożsamość", "Skala", "Rynki i systemy", "BRANŻA", "OPIS ORGANIZACJI", "STAN DANYCH", "Zapisz zmiany", "Opublikuj wersję kontekstu" — mimo że OWNER ma ustawiony `language=en` i `localStorage.i18nextLng=en`. Dane uzupełnienia: 8/13 pól. |
| 14 | Admin | PEŁNY | 0 | Members: 9 kont, role zgodne z D7 verify (1 Owner, 2 Admin w tym Robert Chen, 6 Member). |
| 15 | Settings | PEŁNY | 0 | Profil OWNER-a poprawny (James Whitfield, Operations, Northwind Manufacturing Ltd.). |
| 16 | Partners | PUSTY (oczekiwane) | 0 | "The Partner profile is not connected yet" — zgodne z D7 ("brak wiersza partner_users w D1-D6"), to jest oczekiwany stan CTA, nie błąd. |
| 17 | Initiatives (MEMBER) | PEŁNY | 0 | emily.carter@northwind.example widzi tę samą listę co OWNER (11 aktywnych), badge powiadomień "6". |
| 18 | Execution (MEMBER) | PEŁNY | 0 | Ta sama lista Deliveries (4) co OWNER. |

**Podsumowanie stanu:** 13/16 PEŁNY, 2/16 CZĘŚCIOWY (Tools, Assessment —
nagłówek modułu po polsku), 1/16 CZĘŚCIOWY z defektem językowym całego
ekranu (Organization), 1/16 PUSTY z powodu bramki/flagi mimo obecnych
danych (Meetings), 1/16 PUSTY oczekiwanie (Partners). [Liczby sumują się do
więcej niż 16 bo Organization liczony osobno jako podkategoria CZĘŚCIOWY.]

## 4. 5 najważniejszych defektów widocznych

1. **Meetings — dane w bazie, ekran zaślepiony.** `meetings`=2,
   `meeting_participants`=8, `meeting_notes`=2 (D6 verify PASS), ale
   `/meetings` na stagingu pokazuje statyczną zaślepkę "planned for Wave 2 /
   This module isn't part of the MVP yet" zamiast realnych spotkań. Wzorzec
   "zbudowane, ale niepodłączone" — dane i (prawdopodobnie) UI istnieją,
   coś je odcina na tym środowisku (flaga/branch/build).
2. **Organization → Identity & Operating Model w całości po polsku.**
   Nagłówki sekcji, etykiety pól, przyciski akcji ("Zapisz zmiany",
   "Opublikuj wersję kontekstu") — mimo `language=en` na koncie OWNER-a i
   wymuszonego `i18nextLng=en` w localStorage. To jedyny ekran z tak
   totalnym brakiem tłumaczenia w całej 16-ekranowej galerii.
3. **Tools i Assessment — nagłówek modułu po polsku, treść po angielsku.**
   "Narzędzia" zamiast "Tools", kategorie "Strategiczne"/"Operacyjne"
   zamiast "Strategy"/"Operations" na ekranie Tools; "Ocena" zamiast
   "Assessment" na ekranie Assessment. Reszta obu ekranów (nazwy narzędzi,
   metodyk, statusy) jest angielska — to częściowe tłumaczenie, nie pełny
   brak.
4. **Rozjazd liczb `tasks` i `initiative_milestones` vs wzorzec D7.**
   Staging ma 42 zadania i 16 kamieni milowych, podczas gdy `--verify`
   paczki D7 (na osobnej kopii bazy) potwierdził 36 zadań i 8 kamieni.
   `initiative_milestones` jest dokładnie 2× wzorca — możliwe podwójne
   uruchomienie części seeda na stagingu, do zweryfikowania.
5. **Rozjazd liczb DBR77 vs przegląd z rana 08.09.** initiatives 106 (było
   104, +2), tasks 214 (było 197, +17), users 16 (było 17, -1) — zmiana
   między pomiarem z 05:50 a teraz; przyczyna nieznana, tylko odnotowana.

## 5. Plik dowodowy

- `liczby-baza.txt` — surowy wydruk zapytań SELECT (Northwind + DBR77).
- `przebieg-zrzutow.log` — log przebiegu Playwright (18 zrzutów OWNER+MEMBER).
- `wpisy-galerii.json` — metadane zbiorcze wszystkich zrzutów.
- `NN-*.png` + `NN-*.png.json` — 23 zrzuty (21 OWNER + 2 MEMBER), każdy z
  url, błędami konsoli, liczbą polskich słów (podział UI/DANE — heurystyka
  słownikowa w skrypcie, realnie oceniona ręcznie w tabeli §3 powyżej) i
  odpowiedziami API ≥400 znaków zawierającymi polskie znaki.

Hasło kont Northwind NIE jest zapisane w żadnym pliku evidence ani w tym
dokumencie — skrypty czytają je programowo z
`/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt`
w czasie działania.
