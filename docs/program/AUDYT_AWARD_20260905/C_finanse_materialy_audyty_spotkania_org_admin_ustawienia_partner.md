# Audyt „CES 2027" — pakiet C: Finanse · Materiały · Audyty · Spotkania · Organizacja · Panel Administratora · Ustawienia · Partnerzy

Data pomiaru: 2026-09-05. Środowisko: `http://127.0.0.1:3000` (frontend m03 → backend/dane stagingu `5097394eb6`),
sesja właściciela z `ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json`, motyw jasny, viewport 1440
(flagowe ekrany dodatkowo 1280/1920). Narzędzie: własny skrypt Playwright
`/private/tmp/odbior-zywo-skrypty/audyt-award/zrzut2.mjs` (wzorowany na
`scripts/dev/odbior-zywo/zrzut.mjs` z tego repo, rozszerzony o przechwytywanie sieci ≥400 i
żądań >5s). Zrzuty i sidecar `.json` (konsola/sieć/czas) w
`evidence/audyt-award-20260905/<modul>/`.

**Uczciwość metody — co NIE zostało zmierzone.** To jest próbka, nie pełny spis wszystkich
ekranów i przepływów wymienionych w briefie (każdy create→edit→save→reopen, każda zakładka,
każdy panel, 1280/1920 dla każdego ekranu). W budżecie czasu jednej sesji zmierzono 27 realnych
ekranów/stanów na żywo, z realnymi rekordami klienta DBR77 (zero danych testowych tworzonych).
Poniżej explicite wypisano, czego NIE zmierzono (`NIE_DOTARLEM`) zamiast zgadywać ocenę.
Podczas pracy własny harness dwa razy dał fałszywy alarm (zły parametr `--tab=` zgadnięty zamiast
odczytany z kodu; za krótki czas oczekiwania na zimny start modułu Organizacja/Admin/Ustawienia) —
oba przypadki zweryfikowano w kodzie/ponownym pomiarze przed wpisaniem do tego dokumentu, więc
żadne z poniższych ustaleń nie opiera się na tym błędzie pomiaru.

Skala: **A = Stabilność** (błędy konsoli, 4xx/5xx, martwe kontrolki, nieskończone ładowanie,
flicker, utrata stanu), **B = Spójność grafiki** (skala typograficzna, rytm 8px, tokeny `c-*`,
kształt Menu 1/2/3, puste stany, chipy, ikony, kebab, polska kopia, overlaye, wyrównanie).
0 = nie do pokazania, 3 = gotowe na scenę CES 2027.

---

## Finanse

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| Sprawozdania — lista (`?tab=statements`) | 2 | 2 | kolumny STATUS/Waluta obcięte przez stały panel Teresy; chip zakładki „finance 2025" miesza EN+PL |
| Sprawozdanie — podgląd 1-click | 2 | 1 | surowe kody enum w polu „Stan pakietu" |
| Sprawozdanie — pełny widok | 2 | 2 | puste „Brak linii sprawozdania" — czytelny, poprawny pusty stan |
| Analiza — lista + podgląd | 1 | 1 | 2× 404 w konsoli; szablon tekstu z pustą wartością przed dwukropkiem |
| Predykcja — lista + podgląd | 1 | 1 | 2× 404 w konsoli; ten sam pusty szablon; nakładający się przycisk „Przelicz" |
| **Wycena przedsiębiorstw (flagowy)** | 1 | 1 | 22 nazwy narzędzi w 100% po angielsku; 404 na sub-zasobie rekomendacji doradczych |

Średnia modułu: A = 1,5 · B = 1,3 (6 ekranów zmierzonych). Kolumna „Źródło" w tabeli Wycen jest
obecna i poprawnie pusta (`—`) — zgodnie z wymogiem zadania.

**Deductions:**

1. **[H/M]** Pasek narzędzi na ekranie „Wycena przedsiębiorstw" (Banking value, Cash forecast,
   Driver planner, Driver tree, Extended ratios, Headcount planner, Investment appraisal, Rolling
   forecast, Valuation visuals, Value attribution, Value capture pipeline, Value ledger, Value
   office, Variance bridge, Variance narration, EV basket, Monte Carlo NPV, Real options,
   Efficient frontier, What-if sensitivity, Scenario compute) — 22 etykiety w 100% po angielsku
   na flagowym ekranie modułu. Dowód: `evidence/audyt-award-20260905/finanse/07-wycena-detal.png`,
   `10-wycena-1280.png`, `11-wycena-1920.png` (powtarza się na obu szerokościach). Naprawa: dodać
   klucze i18n dla etykiet zakładek narzędzi wyceny. Effort M, Impact H.
2. **[H/S]** Podgląd sprawozdania pokazuje wprost surowe kody wewnętrzne w polu „Stan pakietu":
   `MISSING_PLAN`, `MISSING_CF`, `INVALID_PERIOD_COUNT`, `INVALID_MEMBER_COUNT`,
   `MISSING_PERIOD_STATEMENT`, `HAS_PENDING_STATEMENT`. Dowód:
   `evidence/audyt-award-20260905/finanse/02-sprawozdanie-detal.png`. Naprawa: zmapować kody na
   komunikaty PL (słownik statusów pakietu) zamiast renderować surowy enum. Effort S, Impact H.
3. **[M/S]** Kolumna „Wartość"/„Waluta" w tym samym podglądzie ucięta na krawędzi panelu (panel
   preview węższy niż treść, bo po prawej stoi stały ~380px panel Teresy). Ten sam mechanizm
   obcina kolumny STATUS/WA. na liście Sprawozdań i kolumny TYP ŹRÓDŁA/WERYF./STATUS PUBLIK. w
   Audytach (patrz niżej) — defekt cross-cutting, nie lokalny. Dowód: jw. + `finanse/01-lista.png`,
   `audyty/01-lista.png`. Naprawa: domyślnie zwinięty/węższy panel Teresy na ekranach z tabelą, albo
   min-width tabeli z poziomym scrollem zamiast obcinania kolumn. Effort M, Impact M.
4. **[M/M]** Otwarcie rekordu Analizy odpytuje `GET /api/v8/finance/analyses/:id/ratios` i
   `GET /api/economics/financial-analyses/:id/ratios` (`src/components/Economics/hooks/useFinanceSelection.ts:811`,
   `src/components/Benefits/FinancialAnalysisWorkspace.tsx:307`; serwer:
   `server/src/routes/economics.routes.ts:2342`) — obie kończą się 404 w konsoli. Analogicznie
   Predykcja: `GET .../models/:id/validations` (`src/components/Economics/hooks/useFinanceSelection.ts:93`,
   `src/components/Finance/FinancialModelWorkspace.tsx:168`; serwer
   `server/src/routes/financial-modeling.routes.ts:733`). UI nie łamie się (dane poboczne), ale
   błędy trafiają do konsoli za każdym otwarciem — do zbadania, czy sub-zasób wymaga wcześniejszego
   przeliczenia rekordu, czy ID nie jest rozpoznawane przez serwis. Dowód:
   `finanse/08-analiza-detal.png.json`, `finanse/09-predykcja-detal.png.json`. Effort M, Impact M.
5. **[M/S]** Otwarcie rekordu Wyceny wywołuje `GET /api/economics/valuations/:id`
   (`src/components/Finance/Valuation/ValuationWorkspace.tsx:289`, serwer
   `server/src/routes/economics.routes.ts:2664`) kończące się 404 — panel rekomendacji doradczych
   (advisory) dla tego rekordu cicho nie ładuje się, reszta ekranu działa. Dowód:
   `finanse/07-wycena-detal.png.json`. Effort M, Impact M.
6. **[M/S]** Złożone teksty podglądu renderują pustą wartość przed dwukropkiem: „Analiza
   finansowa: Waluta: Liczba okresów: 0" i „Predykcja / scenariusz: Waluta: Horyzont: 0
   miesięcy" — brakuje wartości waluty w interpolacji szablonu. Dowód: `finanse/08-analiza-detal.png`,
   `finanse/09-predykcja-detal.png`. Naprawa: uzupełnić fallback (np. „—") zamiast pustego stringu
   w budowie etykiety. Effort S, Impact M.
7. **[S/S]** Na ekranie Predykcji przycisk „Przelicz" nachodzi wizualnie na sekcję „Powiązania"
   (z-index/pozycjonowanie). Dowód: `finanse/09-predykcja-detal.png`. Effort S, Impact M.
8. **[S/S]** Chip zakładki po otwarciu pełnego widoku sprawozdania brzmi „finance 2025" — miesza
   angielskie słowo „finance" z resztą polskiego interfejsu. Dowód:
   `finanse/02b-sprawozdanie-pelny.png`. Effort S, Impact M.

**NIE_DOTARLEM:** komentarze (comments) do sprawozdań/wycen — nie znaleziono wejścia w budżecie
czasu; ekran Modeli (`?tab=models`) zmierzony tylko jako lista, bez otwarcia rekordu.

**Rekomendacja flagowa:** *Sprawozdania — lista* (najbardziej stabilny i spójny ekran modułu).
Wycena przedsiębiorstw ma najbogatszą funkcję (Monte Carlo, koszyk EV), ale angielski pasek
narzędzi dyskwalifikuje ją z pokazania na scenie do czasu tłumaczenia.

---

## Materiały

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| Biblioteka — Wszystkie | 2 | 2 | tytuły wierszy obcięte bez tooltipa |
| Dokumenty | 2 | 1 | kolumna formatu = „Unknown" dla części rekordów |
| Prezentacje | 2 | 2 | — |
| Arkusze | 2 | 1 | „Unknown" jak wyżej; zimny start ~6s |
| Biblioteka wzorców (szablony) | 2 | 2 | część opisów kart w seed-danych po angielsku (dane, nie stały UI) |
| **Document Studio — nowy dokument (flagowy)** | 2 | 3 | brak zastrzeżeń |

Średnia modułu: A = 2,0 · B = 1,8 (6 ekranów zmierzonych).

**Deductions:**

1. **[M/S]** Kolumna formatu pliku pokazuje surowe angielskie „Unknown" zamiast realnej wartości
   (np. „XLSX") lub polskiego placeholdera „—" — widoczne w Dokumentach (`Model realizacji k...`)
   i w Arkuszach (`Model realizacji k...`). Dowód: `evidence/audyt-award-20260905/materialy/02c-dokumenty.png`,
   `materialy/04c-arkusze.png`. Naprawa: fallback na „—" gdy format nieznany, nigdy surowy angielski
   token. Effort S, Impact M.
2. **[S/S]** Nagłówki kolumn „FOR..." i „WIDOCZNO..." obcięte bez tooltipa w Dokumentach/Arkuszach
   (prawdopodobnie „Format"/„Widoczność"). Dowód: jw. Effort S, Impact M.
3. **[S/S]** Górny breadcrumb Menu 1 pokazuje rodzica „Dokumenty" dla WSZYSTKICH zakładek biblioteki
   (Dokumenty, Arkusze, Prezentacje, Biblioteka wzorców), mimo że nagłówek modułu i pozycja menu
   głównego to „Materiały" — niespójna etykieta okruszkowa. Dowód: `materialy/04c-arkusze.png`
   (breadcrumb „Dokumenty › Arkusze"). Effort S, Impact S.
4. **[S/M]** Zimny start zakładki Arkusze zajął ~6,4 s (patrz `czasMs` w
   `materialy/04c-arkusze.png.json`) — powyżej progu 5 s z briefu; nie blokuje, ale widoczne
   opóźnienie bez wskaźnika postępu poza generycznym spinnerem. Effort M, Impact S.

**Uwaga metodologiczna:** pierwsze podejście użyło błędnych wartości `?tab=outputs_documents` /
`?tab=outputs_sheets` (nazwy wewnętrznych identyfikatorów zakładek, nie kontraktu URL) i dawało
fałszywy obraz „zepsutego deep-linku" — zweryfikowano w `src/components/ReportsAndPresentations/outputsLibraryTabQuery.ts`
(kontrakt to `all`/`documents`/`sheets`/`presentations`/`templates`) i powtórzono pomiar z
poprawnymi wartościami przed wpisaniem czegokolwiek do tego raportu. Nie jest to defekt produktu.

**NIE_DOTARLEM:** Teresa panel wewnątrz Document Studio (task wymagał zbadania), pełny artefakt
raportu, arkusze (edytor), przepływ create→edit→save→reopen dla dokumentu.

**Rekomendacja flagowa:** *Document Studio — wybór trybu nowego dokumentu* („Od zera"/„Z AI") —
czysty, dobrze zaprojektowany, zero zastrzeżeń.

---

## Audyty

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| Biblioteka — lista | 2 | 1 | breadcrumb „Audits" po angielsku; kolumny obcięte przez panel Teresy |
| Biblioteka — podgląd programu | 2 | 2 | brak przycisku „Otwórz" w nagłówku podglądu |
| Ustalenia (pusty stan) | 2 | 3 | wzorowy pusty stan |
| Raporty DRD | 2 | 1 | ten sam angielski breadcrumb |

Średnia modułu: A = 2,0 · B = 1,75 (4 ekrany zmierzone).

**Deductions:**

1. **[M/S]** Górny breadcrumb Menu 1 modułu Audyty pokazuje „Audits" po angielsku na WSZYSTKICH
   siedmiu zakładkach (Biblioteka/Sesje/Wyniki/Raporty/Ustalenia/Inicjatywy/Raporty DRD), mimo że
   same zakładki i cała reszta treści jest po polsku. Dowód: `evidence/audyt-award-20260905/audyty/01-lista.png`,
   `03-raporty-drd.png`. Effort S, Impact M.
2. **[M/M]** Kolumny „TYP ŹRÓDŁA", „WERYF...", „STATUS PUBLIK..." i wartości chipów („Proced...",
   „Niezwe...", „Opubli...") obcięte bez tooltipa — ten sam cross-cutting defekt panelu Teresy co w
   Finansach. Dowód: `audyty/01-lista.png`. Effort M, Impact M.
3. **[S/S]** Podgląd programu audytowego (1-click) nie ma przycisku „Otwórz" w nagłówku — tylko ×,
   niezgodnie z kanonem Preview (tytuł+pin+Open+×). Dowód: `audyty/04-program-detal.png`. Effort S,
   Impact S.

**NIE_DOTARLEM:** Sesje, Wyniki, Raporty (osobne zakładki, niezmierzone treścią); warsztat
kryterium (`/audit-programs/:programId/criteria/:criterionId`) — nie znaleziono bezpośredniego
linku z podglądu programu w dostępnym budżecie czasu, wymaga dalszego badania nawigacji.

**Rekomendacja flagowa:** *Biblioteka — podgląd programu audytowego* (bogata, dobrze zorganizowana
treść: Cel/Zakres/Źródło/Prawa/Wymagane role/Taksonomia ustaleń) — po drobnej poprawce nagłówka
podglądu gotowa do pokazania.

---

## Spotkania

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| Lista spotkań | 2 | 1 | status „Po terminie — wy..." obcięty w komórce |
| Podgląd spotkania (1-click) | 2 | 1 | blok sugestii AI po angielsku |

Średnia modułu: A = 2,0 · B = 1,0 (2 ekrany zmierzone).

**Deductions:**

1. **[S/S]** Status w komórce tabeli ucięty do „Po terminie — wy..." — pełny tekst „Po terminie —
   wymaga aktualizacji" widoczny tylko w chipie Menu 3, nie w komórce, bez tooltipa. Dowód:
   `evidence/audyt-award-20260905/spotkania/01-lista.png`. Effort S, Impact S.
2. **[M/S]** Blok sugestii AI w podglądzie spotkania renderuje treść w 100% po angielsku
   („Focus the meeting on delivery status, close open follow-ups, and convert discussion into
   owned next steps. Add pre-read materials before the meeting. • Expand the agenda to cover
   decisions, risks, and next steps.") mimo że wszystkie etykiety wokół (SZCZEGÓŁY, Uczestnicy,
   Follow-up, Agenda, Decyzje, POWIĄZANIA) są po polsku. Dowód: `spotkania/02-obiekt.png`. Nie
   zweryfikowano, czy to dane seed czy generowany na sztywno prompt — do zbadania przed
   przypisaniem effortu naprawy. Effort S–M, Impact M.

Poza tym podgląd spotkania jest dobrze zbudowany: karta meta ze statusem+terminem, sekcja
SZCZEGÓŁY z tabelą właściwości, blok AI, POWIĄZANIA, dwie akcje na dole („Oznacz jako zakończone",
„Notatki AI") — zgodny kształt z kanonem Preview.

**NIE_DOTARLEM:** minutes/decisions/note (`/meetings/:id/minutes|decisions|notes/:noteId`) — nie
zmierzone w tej turze.

**Rekomendacja flagowa:** *Lista + podgląd spotkania* — solidny kandydat po poprawieniu języka
bloku AI.

---

## Organizacja

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| Profil organizacji › Tożsamość i model działania | 2 | 2 | nagłówek Menu 1 „Organization" po angielsku |
| „Members" (`/organization/members`) | 2 | 2 | przekierowuje poza moduł do Panelu Administratora |

Średnia modułu: A = 2,0 · B = 2,0 (2 ekrany zmierzone; treść merytorycznie mocna).

**Deductions:**

1. **[M/S]** Górny nagłówek strony w Menu 1 brzmi „Organization" po angielsku, podczas gdy
   breadcrumb bezpośrednio pod nim („Organizacja › Profil organizacji › Tożsamość i model
   działania") i cała reszta ekranu są w pełni po polsku. Dowód:
   `evidence/audyt-award-20260905/organizacja/01-profile.png`. Ten sam wzorzec występuje w
   Ustawieniach (patrz niżej) — prawdopodobnie wspólny komponent nagłówka czyta nieprzetłumaczoną
   nazwę modułu. Effort S, Impact M.
2. **[M/M]** Trasa `/organization/members` nie renderuje własnego ekranu — przekierowuje wprost do
   `/admin/team/members` (Panel Administratora). Ekran „Members" zapowiedziany w
   `src/routes/routeConfig.ts` (`ORGANIZATION.MEMBERS`) nie istnieje jako osobny widok modułu
   Organizacja; sama docelowa treść (tabela Członkowie i role) jest poprawna i dobrze zbudowana,
   ale użytkownik trafia w inny moduł bez ostrzeżenia wizualnego (breadcrumb i nagłówek zmieniają
   się na „Panel Administratora"). Dowód: `evidence/audyt-award-20260905/organizacja/02-members.png`
   (`.json` pokazuje `url` końcowy `/admin/team/members`). Do potwierdzenia z właścicielem: czy to
   zamierzona konsolidacja (jedna tabela członkostwa dla obu modułów) czy dług routingu. Effort M,
   Impact M.

Sam ekran Tożsamości jest bardzo dobrej jakości: „Stan danych" (2/13 pól uzupełnionych, 864
zatwierdzone fakty), sekcja „Źródła" z licznikiem konfliktów, jasne CTA „Zapisz zmiany"/„Opublikuj
wersję kontekstu" — dobry wzór dla reszty aplikacji.

**NIE_DOTARLEM:** Cele i oczekiwania, Wyzwania i dowody, Synteza strategiczna, Rozliczenia i plany,
Domeny, Branding — 7 z 9 zapowiedzianych podekranów Organizacji niezmierzonych w tej turze (budżet
czasu). Zgodnie z wcześniejszym wpisem w `docs/FUNCTIONAL_DOCUMENTATION.md` („11 ekranów
nieosiągalnych, właściciel nie obejrzał") to obszar wymagający osobnej, dedykowanej sesji pomiaru.

**Rekomendacja flagowa:** *Profil organizacji › Tożsamość i model działania* — najbogatszy,
najbardziej dopracowany zmierzony ekran modułu.

---

## Panel Administratora

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| „Przegląd" (realnie: Zespół i dostęp › Użytkownicy) | 2 | 1 | desynchronizacja breadcrumb Menu 1 vs treść |
| Bezpieczeństwo i tożsamość › Polityka bezpieczeństwa | 2 | 3 | brak zastrzeżeń |
| 4 ekrany platformowe (`/superadmin/*`) | — | — | **niemierzalne na tym koncie** — poprawnie przekierowuje do `/chat` |

Średnia modułu: A = 2,0 · B = 2,0 (2 ekrany zmierzone; superadmin poprawnie niedostępny).

**Deductions:**

1. **[M/M]** Kliknięcie „Panel Administratora" (trasa `/admin/overview`, zakładka „Przegląd" w
   Menu 1) NIE renderuje dedykowanego ekranu przeglądu — po cichym przekierowaniu wewnętrznym
   ląduje na „Zespół i dostęp › Użytkownicy" (`/admin/team/members`), ale górny pasek Menu 1 dalej
   pokazuje etykietę „Przegląd", podczas gdy wewnętrzny breadcrumb i nagłówek strony mówią
   „Użytkownicy" — desynchronizacja stanu breadcrumb vs. realna trasa/treść. Dowód:
   `evidence/audyt-award-20260905/admin/01-overview.png` (pasek górny „Panel Administratora ›
   Przegląd", treść „Panel administratora › Zespół i dostęp › Użytkownicy" + nagłówek
   „Użytkownicy"). `ROUTES.ADMIN.OVERVIEW` zdefiniowane w `src/routes/routeConfig.ts`, ale brak
   referencji w `src/routes/AppRoutes.tsx` dla dedykowanego renderowania — do potwierdzenia przez
   `rg` w komponencie routingu wewnętrznego Panelu Administratora. Effort M, Impact M.

Ekran Bezpieczeństwo › Polityka bezpieczeństwa jest wzorowej jakości: sub-taby (Polityka
współpracy/Dostęp API/Delegowane IAM/SCIM i cykl życia/Podsumowanie ryzyka), trzy karty (Wymuszanie
MFA/Postawa SSO/Sesja i hasło) w pełni po polsku, spójne z resztą aplikacji.

**NIE_DOTARLEM:** Rozliczenia i plany, Sterowanie AI, Dziennik audytu, Centrum dowodzenia, Stan
systemu — 5 z ok. 12 zapowiedzianych sekcji Panelu Administratora niezmierzonych. 4 ekrany
platformowe superadmina (AI Platform, System, Content, Security SSO/Policies) poprawnie oznaczone
jako **niemierzalne na koncie testowym** (przekierowują do `/chat` — brak roli superadmina, zgodnie
z oczekiwaniem zadania).

**Rekomendacja flagowa:** *Bezpieczeństwo i tożsamość › Polityka bezpieczeństwa* — gotowy do
pokazania bez zastrzeżeń.

---

## Ustawienia

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| Profil | 2 | 1 | plakietka „Product" po angielsku obok „Dział: Produkt" po polsku |
| Bezpieczeństwo › Przegląd bezpieczeństwa | 2 | 3 | brak zastrzeżeń |

Średnia modułu: A = 2,0 · B = 2,0 (2 ekrany zmierzone).

**Deductions:**

1. **[S/S]** Pod adresem e-mail w karcie profilu widoczna plakietka roli „Product" po angielsku,
   podczas gdy pole wyboru „Dział" bezpośrednio nad nim pokazuje tę samą wartość po polsku
   („Produkt") — ta sama dana w dwóch miejscach ekranu w dwóch różnych językach. Dowód:
   `evidence/audyt-award-20260905/ustawienia/01-profile.png`. Effort S, Impact S.
2. **[M/S]** Ten sam wzorzec nagłówka Menu 1 co w Organizacji: nagłówek strony konsekwentnie
   pokazuje nazwę sekcji po polsku w Ustawieniach („Ustawienia"/„Profil") — TU akurat poprawnie po
   polsku, w przeciwieństwie do Organizacji/Panelu Administratora („Organization"/działa inaczej).
   Odnotowane jako POZYTYWNY kontrast — potwierdza, że mechanizm i18n działa, więc defekt w
   Organizacji (patrz wyżej) jest lokalny, nie systemowy. Brak deduction tutaj.

Ekran Bezpieczeństwo › Przegląd bezpieczeństwa jest wzorowy: poprawne semantyczne użycie czerwieni
(karta ostrzegawcza „0% Wymaga poprawy" — to jest dokładnie dozwolony przypadek krytycznej
semantyki, nie CTA), uczciwa etykieta „Odroczone / Nieuwzględnione w demo MVP" przy 2FA zamiast
ukrywania braku funkcji.

**NIE_DOTARLEM:** Preferencje pracy, AI i automatyzacja, Powiadomienia, Integracje, Dane i
prywatność, Płatności, Wygląd, Zaawansowane — 8 z ok. 15 zapowiedzianych sekcji Ustawień
niezmierzonych w tej turze (budżet czasu; zgodnie z wcześniejszym wpisem w
`docs/FUNCTIONAL_DOCUMENTATION.md`, „33 z 37 sekcji niedostępnych dla zwykłego użytkownika" —
niepotwierdzone ani obalone w tym pomiarze, wymaga dedykowanej sesji z kontem nie-właścicielskim).

**Rekomendacja flagowa:** *Bezpieczeństwo › Przegląd bezpieczeństwa* — gotowy bez zastrzeżeń.

---

## Partnerzy

| Ekran | A | B | Kluczowe odchylenia |
| --- | :-: | :-: | --- |
| Logowanie `/auth` (bez sesji) | 2 | 3 | brak zastrzeżeń |
| Aplikacja partnerska `/become-partner/apply` (bez sesji) | 2 | 1 | crimson jako kolor CTA na landing page |
| Portal partnerski `/partner` (z sesją, konto bez roli partnera) | 2 | 2 | uczciwy pusty stan |

Średnia modułu: A = 2,0 · B = 2,0 (3 ekrany zmierzone).

**Deductions:**

1. **[M/M]** Strona aplikacji partnerskiej używa crimson (`#85182F`-podobny odcień) jako kolor
   głównych CTA („Wyślij zgłoszenie partnerskie", „Rozpocznij trial" w topbarze) — dokładnie
   pułapka opisana w zasadach projektu („primary w tailwind = crimson, CTA/stany aktywne muszą być
   neutralne"). Ta strona jest jednak publiczną stroną marketingową z osobnym systemem wizualnym
   (ciemne tło, duża typografia), nie ekranem aplikacji objętym Standardem/SPEC-A wprost — do
   ustalenia z właścicielem, czy reguła crimson-tylko-krytyczne obowiązuje też stronę marketingową
   przed przypisaniem ostatecznego efforts. Dowód:
   `evidence/audyt-award-20260905/partner/03b-apply.png`. Effort M, Impact M.
2. Trasa `/partner/pricing` przekierowuje na kotwicę `#commercial-framework` tej samej strony
   `/become-partner` zamiast osobnego ekranu — architektura, nie defekt (odnotowane, nie
   punktowane).

Ekran logowania (`/auth`) jest najczystszym ekranem całego pakietu C: minimalistyczna karta,
pełny polski tekst, poprawna hierarchia — ale jest wspólny z całą aplikacją, nie specyficzny dla
Partnera. Portal Partnerski dla konta bez roli partnera pokazuje uczciwy, dobrze zaprojektowany
pusty stan („Profil partnera nie jest jeszcze podłączony" + wyjaśnienie) zgodny z kanonem pustych
stanów.

**NIE_DOTARLEM:** Dashboard/Clients/Commission/Directory/Resources z realnymi danymi partnera —
konto testowe (Piotr, właściciel organizacji) nie ma roli partnera, więc nie da się uczciwie ocenić
tych ekranów z treścią bez tworzenia nowego konta partnerskiego (poza zakresem tego pomiaru:
zakaz tworzenia kont/rekordów niepotrzebnych). Formularz rejestracji (`/register` lub odpowiednik)
nie został osobno zmierzony.

**Rekomendacja flagowa:** *Ekran logowania* jako ogólny wzorzec jakości; w obrębie samego portalu
partnerskiego — *pusty stan „Profil partnera nie jest jeszcze podłączony"*.

---

## Top 10 ustaleń wg wpływu/wysiłku

| # | Ustalenie | Moduł | Impact | Effort |
| :-: | --- | --- | :-: | :-: |
| 1 | 22 nazwy narzędzi w 100% po angielsku na flagowym ekranie Wyceny | Finanse | H | M |
| 2 | Surowe kody enum w polu „Stan pakietu" podglądu sprawozdania | Finanse | H | S |
| 3 | Breadcrumb Menu 1 „Przegląd" niezgodny z realną treścią „Użytkownicy"; brak ekranu Overview | Panel Administratora | M | M |
| 4 | Panel Teresy (~380px, domyślnie otwarty) obcina kolumny tabel bez tooltipa (Finanse, Audyty) | cross-cutting | M | M |
| 5 | Kolumna formatu = „Unknown" zamiast realnej wartości/„—" | Materiały | M | S |
| 6 | Puste wartości przed dwukropkiem w tekście podglądu Analizy/Predykcji | Finanse | M | S |
| 7 | 404 w konsoli przy każdym otwarciu Analizy/Predykcji/Wyceny (sub-zasoby ratios/validations/advisory) | Finanse | M | M |
| 8 | Nagłówek Menu 1 „Organization" po angielsku mimo w pełni polskiej reszty ekranu | Organizacja | M | S |
| 9 | Trasa `/organization/members` przekierowuje poza moduł do Panelu Administratora bez ostrzeżenia | Organizacja | M | M |
| 10 | Breadcrumb Menu 1 „Audits" po angielsku na wszystkich 7 zakładkach modułu | Audyty | M | S |

## Rekomendacje flagowe — podsumowanie

| Moduł | Ekran flagowy | Warunek pokazania |
| --- | --- | --- |
| Finanse | Sprawozdania — lista | gotowy |
| Materiały | Document Studio — nowy dokument | gotowy |
| Audyty | Biblioteka — podgląd programu audytowego | po dodaniu przycisku „Otwórz" w nagłówku |
| Spotkania | Lista + podgląd spotkania | po przetłumaczeniu bloku sugestii AI |
| Organizacja | Profil organizacji › Tożsamość i model działania | po poprawie nagłówka „Organization”→„Organizacja” |
| Panel Administratora | Bezpieczeństwo i tożsamość › Polityka bezpieczeństwa | gotowy |
| Ustawienia | Bezpieczeństwo › Przegląd bezpieczeństwa | gotowy |
| Partnerzy | Portal partnerski — pusty stan / ekran logowania | gotowy |

## Liczby zbiorcze

- Ekranów/stanów zmierzonych na żywo: **27** (Finanse 6 · Materiały 6 · Audyty 4 · Spotkania 2 ·
  Organizacja 2 · Panel Administratora 2 · Ustawienia 2 · Partnerzy 3).
- Średnia A (Stabilność): **1,89 / 3**.
- Średnia B (Spójność grafiki): **1,74 / 3**.
- Ekranów gotowych bez zastrzeżeń (A=2,B≥2): 10 z 27.
- Ekranów z realnym błędem 4xx w konsoli: 3 z 27 (Analiza, Predykcja, Wycena — wszystkie w Finansach).
- Ekranów niemierzalnych poprawnie (brak uprawnień superadmina): 4 (`/superadmin/*`).
- Sekcji zgłoszonych jako NIE_DOTARLEM (budżet czasu, nie brak dostępu): ok. 25 podekranów łącznie
  w Audytach, Spotkaniach, Organizacji, Panelu Administratora, Ustawieniach, Partnerach — wymagają
  osobnej, dedykowanej sesji pomiaru przed ogłoszeniem modułów w pełni odebranymi.

## Indeks dowodów

Wszystkie zrzuty i sidecary `.json` (konsola/sieć/czas) w:
`evidence/audyt-award-20260905/{finanse,materialy,audyty,spotkania,organizacja,admin,ustawienia,partner}/`.
Pliki z sufiksem literowym (`02b-`, `04c-`, …) to kolejne próby tego samego ekranu (dłuższy czas
oczekiwania po fałszywym alarmie zimnego startu, lub poprawiony parametr URL) — ostatnia litera w
każdej serii jest wersją cytowaną w tym dokumencie; wcześniejsze zostawiono jako ślad metodologii.
