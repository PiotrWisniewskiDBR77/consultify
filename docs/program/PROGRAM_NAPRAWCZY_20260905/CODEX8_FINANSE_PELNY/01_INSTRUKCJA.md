---
doc_id: codex8-finanse-pelny
status: WYDANY 12.09 (decyzja właściciela: „w fali 2 ma iść cały finance")
truth_type: codex-block-instruction
established: 2026-09-12
marker: <<MARKER_SHA_8>>
baza: origin/integracja/20260911
---

# CODEX 8 — FINANSE PEŁNY (fala 2, poz. 3.5)

Właściciel 12.09: **Finanse w menu jako jawne „wkrótce", a cały moduł idzie w fali 2.**
Ten blok robi obie rzeczy: natychmiast porządkuje to, co widzi użytkownik (E0), i zaczyna
program PEŁNY od pierwszego ogniwa łańcucha.

**Materiał wiążący jest w repozytorium** — nie wymyślaj zakresu:
- `docs/program/PROGRAM_NAPRAWCZY_20260905/F1_FINANSE_PROGRAM_DOKONCZENIA_20260905.md` — program
  dokończenia; sekcja **PEŁNY** zawiera paczki **F‑P1…F‑P6** rozpisane co do pliku i progu
  oraz **F‑P7…F‑P11** w skrócie. To jest twój zakres, w tej kolejności.
- `docs/program/PROGRAM_NAPRAWCZY_20260905/F0_FINANSE_AUDYT_LUKI_20260905.md` — audyt luk.
- `docs/program/PROGRAM_NAPRAWCZY_20260905/F_FINANSE_PELNA_TABELA.md` — plan danych (kroki 5–9).
- `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX3_FINANSE_MINIMUM/98_RAPORT.md` — co zrobił blok 3
  (MINIMUM: F‑M2/M3/M4/M6/M7). **KROK 0: zmierz, co z tego realnie działa dziś na linii** — raport
  poprzednika jest deklaracją, a łańcuch finansowy jest szeregowy: jeśli ogniwo 1–3 nie działa,
  budowanie ogniwa 4 nic nie da i masz to zgłosić, zanim zaczniesz.

## §0 BEZPIECZNIKI

Obowiązują Z1–Z24 z `CODEX4_DLUG_MVP/01_INSTRUKCJA.md` (§0), z różnicami: kontener `cx-codex8-pg`
(port **6459**), bazy `cx8_*`, API **4218**, preview **5218**, harness **5599**, migracje
**20262200–20262219**, artefakty `~/Developer/codex-wt/codex8-artefakty`, gałąź
`codex/finanse-pelny-20260912` z markera `<<MARKER_SHA_8>>`.
Znaczniki commita: **Finanse NIE są modułem zamrożonym** (rejestr `docs/program/MVP_FINAL_ZAMROZONE.json`
nie ma pozycji finansowej — zmierzone 12.09), więc domyślnie wystarcza `[ODMROZENIE WSPOLNE DEC-470]`.
Jeżeli dotkniesz plików należących do modułu zamrożonego (np. `src/services/ideaFinance/**` należy do
`07_MY_WORK_AGENT`), hook `commit-msg` wypisze nazwę modułu — dopisz wtedy `[ODMROZENIE <MODUŁ> DEC-470]`.
**Nigdy `--no-verify`.**
Flagi paneli finansowych: **każda nowa rzecz domyślnie wyłączona**; istniejących domyślnych wartości
nie przestawiasz w tym bloku (przestawienie to osobna decyzja po zrzutach).

## E0 — „Wkrótce" zamiast ciszy (decyzja właściciela, robisz to pierwsze, ~pół dnia)

Dziś Finanse bywają chowane flagą **bez słowa wyjaśnienia**. Ma być odwrotnie: pozycja w menu
**widoczna**, a wejście prowadzi do jednego ekranu „Coming soon" z jednym zdaniem, co tu będzie
i kiedy (fala 2). Bez kłódek, bez okien modalnych „beta", bez czerwieni.
Mechanizm już istnieje i był użyty dla Spotkań (`betaMenuStatus.ts`, `BetaGate`, `declutterMenu`) —
**KROK 0:** sprawdź, jak dokładnie działa dla Spotkań i zrób tak samo, zamiast pisać drugi mechanizm.
Definicja ukończenia: pozycja widoczna · wejście = ekran „wkrótce" po angielsku · żadna trasa
finansowa nie zwraca 404 ani 500 · zrzut jasny i ciemny w `evidence/finanse-wkrotce/` **twój własny**.

## E1…E6 — PEŁNY, ogniwo po ogniwie

Kolejność jest szeregowa i **nie wolno jej zmieniać**, bo każde ogniwo karmi następne:

| Etap | Paczka z F1 | Rdzeń |
|---|---|---|
| E1 | **F‑P1** | rejestr `finance_baseline_models` + trzy krawędzie (ogniwo 4) |
| E2 | **F‑P2** | generator miesięcznych okresów prognozy (ogniwo 5) |
| E3 | **F‑P3** | `PUT` kontekstu z kreatora + akcja „Skonfiguruj kontekst" (ogniwo 6) |
| E4 | **F‑P4** | producent definicji analizy i wierszy selekcji wskaźników |
| E5 | **F‑P5** | analiza: krawędź z kreatora, koniec 404 (ogniwo 3) |
| E6 | **F‑P6** | pełna tabela RZiS · Bilans · przepływy: historia i horyzont w jednej tabeli |

Dla **każdego** etapu obowiązuje sekcja tej paczki w `F1_…md` (§1–§11): zakres, pliki, progi
odbioru §10 i dyscyplina §11 są **wiążące** — ta instrukcja ich nie zastępuje i nie skraca.

**Minimum bloku: E0 + E1 + E2 skończone i udowodnione.** Etap nieskończony opisujesz jako
NIEWYKONANY z tym, co ustaliłeś — to więcej warte niż sześć etapów zrobionych po łebkach.
Jeżeli któreś ogniwo okaże się już zbudowane — **nie buduj go drugi raz**, udowodnij, że działa,
i idź dalej.

## §9 CZEGO NIE ROBISZ

Nie projektujesz nowych ekranów ani wyglądu (polerowanie przodu robią wewnętrzni robotnicy po
prototypie zaakceptowanym przez właściciela — możesz podpinać **istniejące** powierzchnie) ·
nie ruszasz magazynu kanonicznego inicjatyw (blok 2b) ani zatwierdzania inicjatyw (blok 7) ·
nie przestawiasz domyślnych wartości istniejących flag · nie łączysz się z Railway, stagingiem,
demo ani produkcją · nie pushujesz.

## §10 RAPORT

`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX8_FINANSE_PELNY/98_RAPORT.md`: stanowisko ·
**KROK 0: co z MINIMUM realnie działa na linii** (per F‑M2/M3/M4/M6/M7, z dowodem, nie z raportu
poprzednika) · per etap POMIAR PRZED→PO, co zmieniłeś (`plik:linia`), progi §10 danej paczki
z wynikiem, testy RED→GREEN · zrzuty · SHA per etap · STOP-y · **czego nie sprawdziłeś**.
