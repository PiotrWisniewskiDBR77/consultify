---
doc_id: codex6-gotowosc-pilotazu
status: WYDANY
truth_type: codex-block-instruction
established: 2026-09-12
marker: <<MARKER_SHA_6>>
baza: origin/integracja/20260911
---

# CODEX 6 — GOTOWOŚĆ PILOTAŻU (pojemnik 2)

Za dwa dni na demo wchodzi czworo ludzi z pierwszej linii kontaktu z klientem: Tomasz Jankowski,
Katarzyna Marszałkiewicz, Irina Lebedjuk, Justyna Laskowska. Mają **sami** przejść drogę od pustej
organizacji do pierwszego wyniku i zgłosić, co ich zatrzymało. Ten blok usuwa to, co zatrzyma ich
na pewno. Kryteria pochodzą z `docs/program/TRZY_POJEMNIKI_PRACY_20260906.md` (pojemnik 2, punkty
1, 3, 11, 12, 14).

**Język: angielski** (decyzja właściciela DEC-461) — aplikacja i dane. Polskie tłumaczenie przyjdzie
osobną falą; nie polszczysz niczego przy okazji.

## §0 BEZPIECZNIKI

Obowiązują Z1–Z24 z `CODEX4_DLUG_MVP/01_INSTRUKCJA.md` (§0) **bez zmian**, z trzema różnicami:
zasoby wyłączne to kontener `cx-codex6-pg` (port **6457**), bazy `cx6_*`, API **4216**, preview **5216**,
harness **5597**, migracje **20262180–20262189**, artefakty `~/Developer/codex-wt/codex6-artefakty`;
gałąź `codex/gotowosc-pilotazu-20260912` z markera `<<MARKER_SHA_6>>`; znaczniki commita
`[ODMROZENIE WSPOLNE DEC-468]` plus moduł wskazany przez hook, jeśli go wskaże.
Przypomnienie szczególnie ważne tutaj: **ZERO połączeń do demo i stagingu** — skrypty, które piszesz,
uruchomi nadzorca; ty testujesz je wyłącznie na kopii lokalnej.

## E1 — „Pusta organizacja → pierwsza wartość" (najważniejszy etap bloku)

**Cel:** świeżo założona organizacja przechodzi całą drogę bez ekranu błędu, bez pustego ekranu bez
akcji i bez martwego przycisku: rejestracja → kontekst organizacji → wywiad → ocena → inicjatywa →
zadanie → wynik.

**KROK 0 — zmierz, nie zakładaj.** Na czystej bazie (`cx6_swieza`, **bez** kopii stagingu — to ma być
organizacja od zera, założona przez interfejs) przejdź tę drogę przyrządem przeglądarkowym i zapisz,
gdzie się zatrzymuje. Znane pułapki, które już raz wyszły przy świeżej organizacji: nowa organizacja
dostawała 404 na całym `/api/v8`, bo rejestracja nie zapisywała flag; konto `TRIAL` blokowało czat
po kilku pytaniach bez zrozumiałego komunikatu; puste stany bywały bez jednej akcji.

**Definicja ukończenia:**
- test przepływu (Playwright, `tests/e2e/` albo katalog zgodny z konwencją repozytorium) przechodzi
  od rejestracji do pierwszego wyniku na **świeżej** organizacji, bez ręcznego dosiewu danych;
- każdy pusty stan po drodze ma **jedno** zdanie po angielsku i **jedną** akcję prowadzącą dalej;
- zero ekranów błędu, zero `404` i `5xx` w przebiegu, zero martwych przycisków (kontrolka bez
  działania ma być ukryta z notatką „Planned", nie udawać działającej);
- każda naprawa ma test z mutacją RED→GREEN.

**Zrzuty robisz sam**, jasny i ciemny, każdy krok drogi: `evidence/pilotaz-przeplyw/`.

## E2 — Seed pilotażu po angielsku (skrypt dla nadzorcy)

Organizacja pilotażu ma wyglądać jak realna firma, nie jak baza testowa: zespół z rolami, kilkanaście
inicjatyw w różnych statusach, zadania z terminami i wykonawcami, kilka wskaźników z pomiarami,
jedna sesja wywiadu i jedna ocena. Wszystko **po angielsku**.

`scripts/dane/seed-pilotaz-20260912.mjs`: `DATABASE_URL` z env, **domyślnie `--dry-run`**
(wypisuje plan i stan PRZED), `--apply` w jednej transakcji, `--manifest=<ścieżka>` (stan PRZED,
umożliwia cofnięcie), **idempotentny** (drugi bieg nie tworzy duplikatów — sprawdź to realnie,
dwa biegi i porównanie liczb). Dane pisz **przez te same ścieżki zapisu, których używa aplikacja**,
nie surowymi `INSERT`-ami omijającymi logikę — inaczej seed wyprodukuje rekordy, których produkt
nie umie odczytać. Jeżeli jakiejś ścieżki nie da się zawołać ze skryptu — napisz to w raporcie.
Sprawdź na kopii: po `--apply` przejdź ekranami i pokaż zrzutami, że dane **widać w produkcie**.

## E3 — Limiter kosztu AI z budżetem per organizacja

Limiter jest wyłączony od 05.09, czyli rachunek za AI nie ma sufitu, a pilotaż to cztery osoby
rozmawiające z modelem. **KROK 0:** ustal, gdzie limiter siedzi, dlaczego jest wyłączony i co
dokładnie liczy (tokeny? koszt? wywołania?).
**Definicja ukończenia:** budżet ustawiany per organizacja (domyślnie 50 USD na miesiąc — wartość
z decyzji właściciela), zużycie liczone i widoczne dla administratora organizacji, po wyczerpaniu
budżetu użytkownik dostaje **zrozumiały komunikat po angielsku** (nie surowy kod błędu, nie cisza),
a nie 500; test z mutacją: po podniesieniu zużycia ponad budżet żądanie jest odrzucane, poniżej — przechodzi.
Włączenie na żywo robi nadzorca; ty zostawiasz to za flagą **domyślnie wyłączoną** i opisujesz, jak włączyć.

## E4 — Eksport i usunięcie organizacji z interfejsu

Wymóg prawny i warunek pilotażu: administrator organizacji ma móc **sam** wyeksportować swoje dane
i usunąć organizację. **KROK 0:** zmierz, co z tego dziś działa (trasa, przycisk, format pliku,
czy usunięcie faktycznie kasuje i czy nie zostawia sierot). Napraw **braki**, nie przepisuj tego,
co działa. Usunięcie ma być nieodwracalne dopiero po jawnym potwierdzeniu i ma zostawić ślad w audycie.
Test: eksport zawiera dane organizacji i **nie zawiera** danych innej organizacji (kontrola negatywna).

## E5 — Dziennik zgłoszeń pilotażu

Czworo ludzi będzie zgłaszać usterki z aplikacji. **KROK 0:** sprawdź, czy zgłoszenie wysłane
z ekranu Feedback gdziekolwiek dociera i czy ktokolwiek może je odczytać (tabela? e-mail? nic?).
**Definicja ukończenia:** zgłoszenie z aplikacji zapisuje się trwale z kontekstem (kto, organizacja,
adres ekranu, wersja aplikacji, przeglądarka), administrator widzi listę zgłoszeń w aplikacji,
a nadzorca ma zapytanie SQL wypisujące nowe zgłoszenia z ostatniej doby (wpisz je do raportu).
Poczta jest dziś martwa — **nie opieraj dziennika na e-mailu**.

## §9 KOLEJNOŚĆ I MINIMUM

E1 → E2 → E5 → E3 → E4. **Minimum bloku: E1 i E2 skończone i udowodnione.** Reszta w takiej kolejności,
na ile starczy czasu; etap nieskończony opisz jako NIEWYKONANY z tym, co ustaliłeś — to więcej warte
niż cztery etapy zrobione po łebkach.

## §10 RAPORT

`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX6_GOTOWOSC_PILOTAZU/98_RAPORT.md`: stanowisko ·
per etap POMIAR PRZED→PO, co zmieniłeś (`plik:linia`), dowód (testy RED→GREEN, zrzuty, zapytania) ·
komendy dla nadzorcy w bloku kodu (skrypty z zastępnikiem `DATABASE_URL`) · SHA per etap · STOP-y ·
**czego nie sprawdziłeś**.
