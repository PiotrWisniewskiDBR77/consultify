---
doc_id: przekazanie-20260913-noc
status: canonical
truth_type: handover
established: 2026-09-13 (01:00, koniec sesji nadzorczej 12.09)
author: CTO (Opus, sesja 12.09)
---

# PRZEKAZANIE — noc 12/13.09.2026

Sesja trwała od rana 12.09. Właściciel wyleciał do USA promować aplikację; pracuje w podróży
i odpowiada na wiadomości. **Cała robota kodowa idzie przez Codexa, który pracuje samodzielnie** —
nadzorca nie uruchamia własnych robotników i nie przekleja mu już wklejek.

## 1. Stan zmierzony (13.09, 00:45–01:00)

| Co | Wartość |
|---|---|
| staging | `60051310d7` · baza i Redis podłączone |
| demo | `60051310d7` · to samo |
| linia integracyjna | `origin/integracja/20260911` = **`76a57ebab8`**, drzewo czyste |
| najnowszy kandydat Codexa | `codex/integrator-mvp-20260912-rc2` = **`d7e713fd5f`** (13.09 00:36; 79 commitów, 83 pliki kodu nad linią, **zero migracji**) |
| poprzedni kandydat | `codex/mvp-candidate-20260912-rc1` = `c4c67a677e` |
| kopie zapasowe | **17 gałęzi** na `origin/backup/*-2026091[23]` — wszystkie gałęzie Codexa zabezpieczone |
| tagi cofnięcia | 37 na serwerze; najświeższe `staging-safe-20260912-0003`, `demo-safe-20260910-2300` |
| dysk | 35 GB wolne |

**Nic z pracy ostatnich dwóch dni nie jest wdrożone.** Staging i demo stoją na wersji z 12.09 00:20.

## 2. Co Codex zrobił 12.09 (bez przekejania, sam)

Gałęzie rdzenia — to jest odpowiedź na DEC-476:
- `codex/ie01-initiative-journey-20260912` = `ea59dd1fba` — ścieżka inicjatywy, wymagane przeglądy kart
- `codex/initiative-card-split-20260913` = `69dbb5b746` — rozbicie karty inicjatywy, niezależny odbiór IE01
- `codex/execution-bank-20260912` = `6919823003` — Bank realizacji, eksport dzierżawcy, atomowy ślad decyzji
- `codex/closed-autosave-20260912` = `4fe3e7d8ff` — zapis automatyczny i stan tylko-do-odczytu

Pozostałe: `w05-ai-evaluation` (ocena AI Wywiadu), `w17-deck-autosave`, `c6-export-contract`,
`zatwierdzanie-inicjatyw-20260913` = `590915fc89`.

**Uwaga dla następcy: Codex nie używa nazw plików z moich instrukcji.** Nie szukaj
`98_KANDYDAT.md` ani `98_AUDYT_LUKI.md` — nie istnieją. Jego raporty żyją w
`PROGRAM_NAPRAWCZY_20260905/INTEGRATOR_MVP_20260912/` (ponad 30 dokumentów, m.in.
`00_STAN_INTEGRACJI.md`, `RC2_*`, `W05_*`, `W17_*`, `C6_INDEPENDENT_REVIEW.md`) oraz
w `PRZEKAZANIE_KODOWANIA_20260907/IE01_CHECKPOINT_20260912.md` i `IE01_REVIEW_REPAIRS_20260913.md`.
Pracuje własnym procesem: dostawa → niezależny przegląd → scalenie do kandydata, i sam wystawia
sobie HOLD-y. Jakość tych przeglądów jest wysoka — dwa błędy krytyczne bezpieczeństwa znalazł sam.

## 3. Co blokuje wdrożenie (stan wg jego własnych raportów)

1. **C6 na HOLD — sześć znalezisk, w tym dwa krytyczne:** eksport sięgający poza organizację
   oraz obejście ochrony prawnej przy usuwaniu (wyścig migawki i błąd odczytu). **To są dane
   klienta — pilotaż nie może ruszyć, póki są otwarte.**
2. **Wywiad:** cztery luki interfejsu i brak pełnego cyklu jednego rekordu w przeglądarce.
3. **Budowa frontu wymaga 8 GiB** (`NODE_OPTIONS=--max-old-space-size=8192`); domyślna kończyła się
   brakiem pamięci. Type-check frontu na kandydacie był „w toku" i nie ma zamknięcia.
4. **Nie ma zamknięcia kandydata:** brak zamrożonego SHA z werdyktem i brak dowodu parytetu przy
   flagach wyłączonych — a to jest mój warunek wdrożenia (zlecenie Z-1).

## 4. Decyzje właściciela z 12.09 (wszystkie w rejestrze)

| Nr | Treść |
|---|---|
| DEC-469 | Inicjatywa bez projektu zostaje stanem zastanym; `assign` ma nie zwracać 500, ale nie legalizujemy stanu |
| DEC-470 | Finanse **widoczne w menu z jawnym „wkrótce"**, cały moduł do fali 2 |
| DEC-471 | Poczta zostaje na Hostingerze; właściciel prosi o dostęp do panelu → **zaproszenia i resety nadal martwe** |
| DEC-472 | **Pilotaż na stagingu, nie na demo** (odwraca decyzję z 06.09); demo = środowisko pokazowe |
| DEC-473 | Martwy serwis `Postgres` na stagingu **zostaje** (85 MB, 998 tabel, 1 użytkownik, aplikacja czyta z `pgvector`) |
| DEC-474 | Wariant ceremonii zatwierdzania inicjatyw wybiera właściciel w fali 2; budujemy rdzeń wspólny, ceremonia jako parametr |
| DEC-476 | **Rdzeń: dokańczamy Inicjatywy i Realizację. Wszystko inne do fali 2, nawet drobiazg.** |

Zakres docelowy obu modułów — słowami właściciela: `docs/program/FALA2/SPEC_FALA2_20260912.md`
(dyktowane w locie; sekcje „MODUŁ INICJATYWY", „MODUŁ REALIZACJA", „MODUŁ SPOTKANIA" plus PMO,
agent z graficznym przepływem klocków, finanse, wskaźniki, kontrakty kart).

## 5. Porządek dokumentów — nie łam go

Właściciel 12.09: „tych planów nie wiem ile już było, czy my to możemy jakoś poważnie zakończyć".
Zmierzone: **52 dokumenty planów i statusów** w `docs/program` na pierwszym poziomie; sześć z nich
dołożyłem tego dnia ja. Dlatego:

- **żyją dwa dokumenty:** `TRZY_POJEMNIKI_PRACY_20260906.md` (co zostało — sekcja „Stan na 12.09.2026”,
  27 kryteriów z werdyktem) i `PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md` (co się wydarzyło);
- **cztery konkurencyjne plany oznaczone jako HISTORYCZNE** z zakazem planowania z nich:
  `PLAN_CTO_20260910`, `PLAN_CODEX_2DNI_20260912`, `FALA_2_PO_STAGINGU`, `CONSULTIFY_FULL_MVP_MASTER_PLAN_2026-08-20`;
- **nowe pliki planów nie powstają.** Zlecenia stoją w **skrzynce na górze rejestru** (Z-1 zamknięcie
  kandydata, Z-2 rdzeń Inicjatyw i Realizacji z audytem luki, Z-3 dwa błędy krytyczne) — Codex czyta
  i pisze ten plik, więc to jest kanał zlecania.

## 6. Pięć kroków do zamknięcia MVP (kolejność obowiązująca)

1. Zamknięcie kandydata: zamrożony SHA, bramka, **dowód parytetu przy flagach OFF** → Codex.
2. Naprawa dwóch błędów krytycznych C6 → Codex.
3. Wdrożenie na staging z tagiem cofnięcia **przed** pushem, potem promocja na demo → nadzorca.
4. Przejście właściciela: Inicjatywy i Realizacja (warunkowe „tak" z 10.09 niepotwierdzone).
5. Konta pilotażu **na stagingu** (Katarzyna i Irina nie istnieją), hasła ręcznie, start pilotażu.

MVP jest zamknięte, gdy prawdziwe są trzy zdania: kandydat działa na stagingu i demo po odbiorze
na żywo; właściciel przeszedł oba moduły rdzenia i powiedział „tak"; czworo ludzi pracuje na kontach.

## 7. Moje błędy tej sesji (do nauki, nie do ukrycia)

1. **Dołożyłem sześć dokumentów planów** do już przepełnionego katalogu, zamiast rozliczać w istniejących.
   Właściciel to wychwycił. Naprawione oznaczeniem czterech planów jako historycznych.
2. **Podałem złą liczbę** zamkniętych kryteriów pojemnika 1 (osiem zamiast sześciu na trzynaście),
   bo napisałem ją z pamięci, nie z tabeli. Sprostowane przy składaniu strony.
3. **Wpisałem do pliku pojemników zdanie o kopiach zapasowych, zanim je zmierzyłem.** Okazało się
   prawdziwe dla sześciu gałęzi, ale to był przypadek, nie pomiar.
4. **Dwa własne skrypty skłamały mi w twarz:** sprawdzanie rodowodu paczek (tablica asocjacyjna w zsh
   — pięć fałszywych „marker nie jest przodkiem") i pętla kopii zapasowych (zsh traktuje dwukropek
   po zmiennej w cudzysłowie jako modyfikator, refspec zamieniał się w śmieci — jedenaście fałszywych
   „BŁĄD"). Oba wykryte przez ręczne powtórzenie jednego przypadku. **Zasada: jeśli skrypt melduje
   porażkę na całej serii, powtórz ręcznie jeden przypadek, zanim uwierzysz.**
5. **Wydałem odbiór paczek, zanim cokolwiek scaliłem** — blok wykonał się o 08:56 i zgodnie
   z instrukcją zameldował „obie paczki nieobecne”. Kolejność była moja, nie jego.

## 8. Rzeczy, które łatwo zepsuć (przeczytaj przed pierwszą komendą)

- Zmienne Railway **zawsze** z `--skip-deploys`, inaczej demo przebudowuje stary commit z gałęzi Londyn.
- Demo wdraża się **wyłącznie** przez `gh workflow run railway-deploy.yml --ref staging -f environment=demo -f confirm_demo=yes`; push na gałąź `demo` nie robi nic.
- Push na `staging` **sam** buduje na Railway (~12 min); workflow bywa `failure` na timeout mimo udanego wdrożenia — sprawdzaj `railway deployment list` i health, tag `staging-deployed` przesuwaj ręcznie.
- Żywa baza stagingu to serwis **`pgvector`**, nie `Postgres`.
- Hook `commit-msg` wymaga `[ODMROZENIE <MODUŁ> DEC-<nr>]`; nazwy modułów tylko z `docs/program/MVP_FINAL_ZAMROZONE.json` (15 pozycji, **Finansów tam nie ma** → dla nich `WSPOLNE`). Nigdy `--no-verify`.
- Ostatnia użyta decyzja: **DEC-476**. Następna wolna: DEC-477. Codex wymyśla własne numery
  (`DEC-2026091201`) — przy scalaniu to porządkuj.
- Cudzych katalogów roboczych (`codex-wt/*`, `wt/p11-*`, `wt/audyt-p1`) **nie kasuj** i nie wchodź do
  `/Users/piotrwisniewski/Developer/Consultify` poza symlinkiem `node_modules`.
