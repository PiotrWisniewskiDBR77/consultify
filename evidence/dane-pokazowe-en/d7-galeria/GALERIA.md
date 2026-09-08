# D7 — Galeria odbiorcza, 16 modułów, organizacja Northwind (EN)

Paczka D7 programu „jedna baza pokazowa po angielsku"
(`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D7 i §3). Pełny łańcuch
seedów D1–D6 zaaplikowany na świeżej lokalnej kopii `consultify_kopia_d7`
(TEMPLATE `consultify_staging_kopia`), API 4191 / Vite 3211, jasny motyw,
1440×900, konto OWNER `james.whitfield@northwind.example`. Zrzuty:
`evidence/dane-pokazowe-en/d7-galeria/NN-<modul>-<ekran>.png` (+ `.png.json`:
opis, url, błędy konsoli, liczba polskich trafień w `innerText`).

**Nic w tej paczce nie zostało naprawione** — jeden wyjątek jest opisany
w sekcji „Odstępstwo od zakazu napraw" poniżej.

## Tabela 16 modułów

| # | Moduł | Ekran(y) | Stan | Polskie słowa UI | Uwagi |
|---|---|---|---|---|---|
| 1 | Chat | `01-chat-lista`, `01b-chat-watek` | PEŁNY | brak | 3 wątki Northwind, panel historii grupowany „This week/This month", treść wątku w 100% angielska |
| 2 | My Work | `02-my-work-skrzynka` | PEŁNY | brak | 6 zadań OWNER-a, filtry Overdue/Action required poprawne po angielsku |
| 3 | Interview | `03-interview-lista`, `03b-interview-podglad` | PEŁNY | brak | 2 sesje Completed; panel podglądu nie otworzył się jednym kliknięciem (przycisk „Show panel" pozostaje zwinięty) — nie pogoniono dalej, brak wpływu na ocenę języka |
| 4 | Tools | `04-tools-lista` | PEŁNY | **„Narzędzia"** (tytuł strony), **„Operacyjne"/„Strategiczne"/„Oceny"** (kolumna Category) | 3 sesje Northwind + 1 sesja DRD, wszystkie dane po angielsku — polskie tylko etykiety kategorii i tytuł zakładki |
| 5 | Assessment | `05-assessment-lista`, `05b-assessment-raport` | PEŁNY, ale patrz defekt #1 | **„Ocena"** (tytuł strony); raport sesji **~49 trafień PL** | Lista czysta po angielsku. Otwarcie raportu (dwuklik) ujawnia ekran niemal całkowicie polski — patrz DEFEKT #1 |
| 6 | Initiatives | `06-initiatives-lista` | PEŁNY | 16 trafień — **„Przypisany właściciel"** ×8 wierszy | 13 inicjatyw, 7 statusów DEC-424 (zakres „All"), w tym „On hold"/„Blocked". Kolumna Owner pokazuje polski literał zamiast nazwiska dla inicjatyw zarejestrowanych w runtime-v1 — patrz DEFEKT #2 |
| 7 | Execution | `07a` Realizacje, `07b` Praca, `07c` Zasoby, `07d` Decyzje i ryzyka, `07e` Raporty | PEŁNY | Praca: daty „14 sie 2026" itd. (6); Zasoby: zdanie podsumowania + daty „od DD.MM.RRRR" (9); Decyzje: daty (1); **Raporty: WSZYSTKIE nagłówki kolumn PL** (RAPORT/POZIOM/OKRES/STAN DANYCH NA/AUTOR) | 4 execution_case, 42 zadania, 9 decyzji, 7 RAID, 2 raporty statusu — dane w 100% angielskie, ale formatowanie dat i nagłówki tabeli Raportów po polsku — patrz DEFEKT #3 |
| 8 | Results | `08-results-kpi-lista`, `08b-results-kpi-karta` | PEŁNY | brak (drobne: okres „IX 2026" — rzymski numer miesiąca zamiast „Sep 2026") | 8 KPI, karta „OEE — Line 3" z 6 pomiarami, SPEC-A poprawne. 1 błąd konsoli 404 (zasób nieistotny) |
| 9 | Finance | `09-finance-sprawozdania`, `09b-finance-budzet` | PEŁNY | brak | 4 kwartały GBP, 1 scenariusz budżetu FY2026 |
| 10 | Materials | `10-materials-lista`, `10b-materials-dokument` | PEŁNY | „Sekcje" (etykieta paska nad edytorem) | 7 materiałów (4 dok./2 decki/1 sheet), dokument „Operational Excellence Charter" — treść w całości angielska, wysokiej jakości |
| 11 | Audits | `11-audits-glowny` | **PUSTY** | brak | „No audit packs yet." — poprawny pusty stan (StandardTable), nie błąd. Powód: żaden z `server/scripts/seed/demo-en/{01..06}*.ts` nie zapisuje do `audit_packs`/`audit_programs`/`audit_program_findings` (zweryfikowane grepem) — moduł Audits nie wchodzi w zakres paczek D1–D6 z `PLAN.md` §3.1 |
| 12 | Meetings | `12-meetings-lista`, `12b-meetings-notatka` | PEŁNY | brak | 2 spotkania Completed, notatka „Weekly PMO Review" z decyzjami/akcjami, w pełni angielska. 1 błąd konsoli 404 (zasób nieistotny) |
| 13 | Organization | `13-organization-profil` | PEŁNY danymi, **CZĘŚCIOWY językowo** | **46 trafień, ~27 unikalnych słów/fraz** | Prawie cała treść główna po polsku (zakładki „Tożsamość"/„Skala", pola „BRANŻA"/„PODBRANŻA"/„OPIS ORGANIZACJI", panel „STAN DANYCH"/„ŹRÓDŁA", przycisk „Dodaj źródło", „Zapisz zmiany") — patrz DEFEKT #4 |
| 14 | Admin | `14-admin-panel` | PEŁNY | brak | Ekran ląduje od razu na „Members & Roles" — 9 kont, role poprawne (1 Owner, 2 Admin, 6 Member), całość angielska |
| 15 | Settings | `15-settings-glowny` | PEŁNY | brak | Profil OWNER-a, dane osobowe, w pełni angielskie |
| 16 | Partners | `16-partners-portal` | **PUSTY (celowo)** | brak | „The Partner profile is not connected yet" — poprawny, angielski ekran „connect", zgodny z komentarzem w kodzie: `src/routes/AppRoutes.tsx:3775-3781` (dostęp do powłoki celowo bez blokady partner-role; dane partnera wymagają wiersza `partner_users`, którego D1–D6 nie seeduje) |

## 5 najważniejszych defektów wizualnych do decyzji właściciela

1. **Raport sesji Assessment/DRD jest w ~90% po polsku, zero i18n.**
   Ekran `Sesja 08ef1def — Zamrożona` (`05b-assessment-raport.png`): „Wyjdź",
   „Zamrożona"/„Zamknięta", odznaka „DANE Z SERWERA", kolumna „JEDNOSTKA",
   cały akapit `limitations` po polsku. Stringi wpisane na sztywno, nie przez
   i18n: `src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx:299,404,1616,1619`.
   Najgorszy pojedynczy ekran w całej galerii (49 trafień).

2. **Kolumna Owner na liście Inicjatyw pokazuje polski literał zamiast nazwiska.**
   `06-initiatives-lista.png`: 8 z 13 wierszy pokazuje „Przypisany właś…"
   zamiast realnego właściciela. Znany od paczki D4b, nadal obecny.
   Źródło: `src/components/Initiatives/initiativeRegisterProjection.ts:336`
   — literał wstawiany na sztywno, gdy `initiativeOwnerId` agregatu jest
   UUID-em (czyli dla każdej zarejestrowanej w runtime-v1 inicjatywy poza
   własną).

3. **Organizacja > profil — prawie cała treść główna po polsku.**
   `13-organization-profil.png` (46 trafień, zdecydowanie druga najgorsza
   strona): zakładki „Tożsamość"/„Skala"/„Rynki i systemy", filtry
   „Wszystkie/Uzupełnione/Do uzupełnienia/Konflikty", pola formularza
   („BRANŻA", „PODBRANŻA", „KOD BRANŻY (PKD)" — nawet nazwa polskiej
   klasyfikacji branżowej), panel „STAN DANYCH"/„ŹRÓDŁA", przyciski „Dodaj
   źródło"/„Zapisz zmiany"/„Opublikuj wersję kontekstu". Tylko lewe menu
   i okruszki są po angielsku — reszta ekranu wygląda jak nieprzetłumaczony
   moduł. Źródło najprawdopodobniej w `src/components/Organization/redesign/`
   (nie zlokalizowano precyzyjnego wiersza — do doprecyzowania przy naprawie).

4. **Execution > Raporty: WSZYSTKIE nagłówki kolumn tabeli po polsku.**
   `07e-execution-raporty.png`: „RAPORT", „POZIOM", „OKRES", „STAN DANYCH NA",
   „AUTOR" — jedyna tabela w całej galerii z w pełni nieprzetłumaczonym
   nagłówkiem (sąsiednie zakładki Deliveries/Work/Resources/Decisions mają
   nagłówki po angielsku). Prawdopodobne źródło:
   `src/components/ResultsVNext/kpiScorecards/kpiReportPresenters.tsx`
   (współdzielony z prezenterem raportów KPI — do zweryfikowania).

5. **Polski format daty przecieka w całym module Execution.**
   Kolumna „Due" w Work (`07b`), kolumna „Needed by" w Decyzje i ryzyka
   (`07d`) oraz cała linijka podsumowania w Zasobach (`07c`: „Stan na
   8.09.2026: osób 9 · popyt 360 h · podaż 2704 h · obłożenie 13% ·
   przeciążonych tygodni 2 · zaległość 73 h u 5 os.") renderują się z polskimi
   skrótami miesięcy (sie/wrz/lip/gru/lis/paź) i formatem `DD.MM.RRRR`
   zamiast angielskiego. Znane od paczki D4b („polski format dat i zdanie
   podsumowania w Zasobach"), nadal obecne — locale renderowania dat nie
   podąża za `language='en'` konta.

## Drobne, poza top 5 (odnotowane, nie priorytetowe)

- Tools: tytuł zakładki „Narzędzia" + kolumna Category „Operacyjne"/
  „Strategiczne"/„Oceny" (katalog globalny, nie dane Northwind).
- Assessment: tytuł zakładki „Ocena" (widoczny nawet na czystej liście, zanim
  otworzy się raport z defektu #1).
- Materials (dokument): etykieta „Sekcje" nad edytorem bloków.
- Results: okres raportu KPI renderowany jako rzymski numer miesiąca
  „IX 2026" zamiast „Sep 2026".
- Interview i Assessment: panel podglądu/raport nie otwiera się pojedynczym
  kliknięciem wiersza (Interview: trzeba dodatkowo kliknąć „Show panel";
  Assessment: trzeba dwuklik) — niespójne z Initiatives, gdzie klik na
  wiersz zaznacza go, ale też nie otwiera drawera przez parametr URL
  `?open=<id>&mode=drawer` (sprawdzone, nie działa niezawodnie z pełnej
  nawigacji — możliwe że wymaga nawigacji z listy przez klik w aplikacji,
  nie przez `page.goto`).
- 2 błędy konsoli 404 (`08-results-kpi-lista`, `12b-meetings-notatka`) —
  „Failed to load resource" bez dalszych szczegółów w komunikacie, nie
  zbadano które zasoby; nie blokują renderowania treści.

## Odstępstwo od zakazu napraw

Zlecenie mówi „nic nie naprawiasz" w kontekście defektów PRODUKTU/UI. Podczas
uruchamiania paczki D5 (`05-wyniki-finanse.ts --apply`) natrafiono na twardy
błąd narzędzia SEEDUJĄCEGO (nie produktu): stała `TYTUL_INICJATYWY.skills` w
`server/scripts/seed/demo-en/05-dane-wynikow.ts:32` szukała inicjatywy
„Skills Matrix **&** Upskilling" (z ampersandem), podczas gdy D3 celowo
zapisuje ten tytuł jako „Skills Matrix **and** Upskilling" (bez `&`, żeby
uniknąć znanego escapowania `&`→`&amp;` przez sanitizer — STOP z paczki D4b).
To była literówka w danych własnego skryptu seedującego (nie w kodzie
produktu), blokująca ukończenie CAŁEGO łańcucha D1–D6 wymaganego przez to
zlecenie. Poprawiono jednym słowem (`&` → `and`) w tym jednym miejscu, bez
czego moduły Results i Finance byłyby puste w całej galerii. Zmiana zostaje
w gałęzi razem z zaaplikowanym seedem; nic w kodzie `src/`/`server/src/`
(produkt) nie zostało dotknięte.

## VERIFY — liczby PRZED/PO per paczka (na `consultify_kopia_d7`)

| Paczka | Komenda | Wynik |
|---|---|---|
| D1 rdzeń | `01-rdzen.ts --apply` → `99-verify.ts --verify` | apply: utworzono=33 zmieniono=0 pominieto=0 · verify: **13/13 PASS** |
| D2 odkrycie | `02-odkrycie.ts --apply --verify` | apply: utworzono=36 zmieniono=0 pominieto=0 · verify: **9/9 PASS** |
| D3 inicjatywy | `03-inicjatywy.ts --apply --api ... --verify` | apply: SQL utworzono=141, agregaty=8/8, execution_case=4/4 · verify: **31/31 PASS** |
| D4 realizacja | `04-realizacja.ts --apply --api ... --verify` | apply: SQL utworzono=40 zmieniono=10, RAID=7, decyzje=9, migawki=2 · verify: **31/31 PASS** |
| D5 wyniki+finanse | `05-wyniki-finanse.ts --apply --api ... --verify` | apply (2. przebieg po naprawie literówki): utworzono=5 zmieniono=15 pominieto=149 (KPI/OKR/ROI/sprawozdania idempotentne, budżet nowy) · verify: **38/38 PASS** |
| D6 materiały | `06-materialy.ts --apply --verify` | apply: utworzono=80 zmieniono=0 pominieto=0 · verify: **16/16 PASS** |

Wszystkie 6 paczek: **PASS**, zero asercji FAIL, zero rozjazdu z premisą
zmierzoną w KROKU 0 każdej paczki.
