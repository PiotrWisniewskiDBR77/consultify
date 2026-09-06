# Audyt gotowości MVP — pakiet B (05/06.09.2026)

Moduły: 08 Spotkania · 11 Materiały · 12 Audyty · 01 Organizacja · 14 Administracja ·
15 Ustawienia · 16 Partner · powłoka globalna.

## ZASTRZEŻENIE METODOLOGICZNE — BLOKADA ŚRODOWISKA (przeczytaj przed resztą raportu)

W trakcie całego audytu (05.09 wieczór, ok. 22:40–23:05) współdzielona sesja
`ODBIOR_AUTH_STATE=/private/tmp/odbior-auth/auth.json` była w większości czasu
**wygasła/nieważna**. Zmierzone wprost:

- Dekodowanie JWT z pliku sesji pokazało `iat=18:51:51`, `exp=19:51:51` (token 1h) —
  w chwili pomiaru było już **23:00+**, czyli token był przeterminowany o >3 h.
- Próby nawigacji na chronione trasy (`/meetings`, `/organization`, `/admin`, `/settings`,
  `/settings/security`, `/partner`, a także trasy KONTROLNE spoza pakietu B: `/my-work`,
  `/dashboard`, `/presentations`) kończyły się przekierowaniem na `/login` i konsolowymi
  `401 Unauthorized` / `No token provided`. Backend (`/api/health`) działał poprawnie
  (`status:ok`, DB i Redis connected) — to nie jest awaria stagingu, tylko martwa sesja klienta.
- Jeden raz w trakcie audytu sesja **odzyskała ważność** (najpewniej inny agent/właściciel
  zalogował się równolegle we współdzielonym worktree `m03`) i `/my-work` wczytał się
  poprawnie — ale plik `auth.json` chwilę później znów zawierał stan **bez klucza `token`**
  w ogóle (pełne wylogowanie). Przyczyna: `scripts/dev/odbior-zywo/zrzut.mjs` zapisuje z
  powrotem `ctx.storageState()` za KAŻDYM razem, gdy końcowy URL nie zawiera `/login` —
  także gdy trafi na stronę PUBLICZNĄ bez ważnej sesji (np. `/audits` marketingowe, `/`).
  W środowisku, gdzie kilku agentów naraz używa TEGO SAMEGO pliku sesji, wystarczy że
  jeden proces odwiedzi publiczną stronę bez tokenu, żeby nadpisać ważną sesję innego —
  to realne ryzyko narzędziowe (nie produktowe), warte naprawy w skrypcie audytowym.
- Zgodnie z zasadą „Piotr nigdy nie jest pierwszym testerem" i zakazem logowania się w
  jego imieniu, NIE podjęto próby ręcznego zalogowania (`zaloguj.mjs` wymaga interakcji
  właściciela) ani mintowania tokenu.

**Skutek dla tego raportu:** większość ekranów flagowych modułów B nie została
zweryfikowana ŻYWO dzisiaj. Tam gdzie to możliwe, zastąpiono to (a) świeżymi (tego samego
dnia, sprzed kilku godzin) zrzutami z `evidence/odbior-zywo-20260905/` obejrzanymi na
nowo krytycznym okiem, (b) `git diff` kodu między commitem akceptacji CTO a HEAD `59e282df88`
dla plików danego modułu (realna, zweryfikowalna zmiana od czasu „GOTOWY"), (c) grepem po
kluczach i18n w `public/locales/pl/translation.json`. Każdy wiersz tabeli ma jawnie
zaznaczone, czy jest „ZMIERZONE ŻYWO DZIŚ", „ZMIERZONE STATYCZNIE (kod)" czy
„NIE ZMIERZONE — blokada sesji".

---

## Powłoka globalna

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| G1 | `/login` bez sesji | Treść, błędy konsoli, język | OK — w pełni po polsku („Witamy ponownie", „Zaloguj się", „Wpisz kod dostępu"), 0 błędów konsoli, dev-badge „LOCAL" widoczny tylko lokalnie (oczekiwane) | `global-login.png` (ŻYWO DZIŚ) | — | — |
| G2 | `/nie-ma-takiej-strony-xyz123` (404) | Czy istnieje strona 404 po polsku z powrotem | **BRAK strony 404.** Nieznana trasa jest CICHO przekierowywana: zalogowany → `/chat` (`ROUTES.AI_CHAT`), niezalogowany → strona główna (`ROUTES.WELCOME`). Zero komunikatu „strona nie istnieje", zero odróżnienia od normalnego działania. Potwierdzone kodem i żywo (dwukrotnie, w tym bez żadnej sesji — więc niezależne od blokady auth). | `global-404-retest.png` (ŻYWO DZIŚ, url końcowy = `/`); `src/routes/AppRoutes.tsx:3808-3818` (komentarz w kodzie: „404 - Redirect based on auth status") | **WAŻNY** | `src/routes/AppRoutes.tsx:3811` |
| G3 | Nawigacja lewa — etykiety/tooltips | Nie zmierzone dziś (wymaga żywej sesji + hover) | NIE ZMIERZONE — blokada sesji | — | — | — |
| G4 | Górny pasek — „Dane"/„Model", powiadomienia, Teresa | Widoczne na zrzutach z 05.09 (np. `meetings-module.png`): przełączniki „Dane ▾ / Model ▾" obecne po polsku, dzwonek pokazuje poprawnie format przepełnienia „99+", awatar Teresy (ikonka gwiazdki) obecny | Wygląda OK na zrzutach sprzed kilku godzin | `evidence/odbior-zywo-20260905/12-spotkania/meetings-module.png` | — | — |
| G5 | Pusty stan nowego użytkownika | Nie da się bezpiecznie wywołać bez tworzenia konta/rekordów | NIE ZMIERZONE | — | — | — |
| G6 | Token/sesja — higiena narzędzia audytowego | Patrz sekcja „Blokada środowiska" wyżej | **Ryzyko narzędziowe**: `zrzut.mjs` może nadpisać cudzą ważną sesję wizytą na stronie publicznej bez tokenu | — | INFO dla nadzorcy (nie produkt) | `scripts/dev/odbior-zywo/zrzut.mjs:105-110` |

**Werdykt powłoka globalna: NIEGOTOWY do pełnej oceny (G3/G5 nie zmierzone), ale G2 (brak
strony 404) to potwierdzony, realny brak — WAŻNY, nie blokuje MVP jutro, ale zasługuje na
świadomą decyzję właściciela (akceptować na start czy naprawić).**

---

## 01 Organizacja (`/organization`)

Status.json (05.09 14:23): GOTOWY, „21 ekranów zaakceptowanych".

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 01-1 | `/organization` na żywo | Redirect do loginu (sesja martwa), 3 próby w różnych momentach | NIE ZMIERZONE ŻYWO DZIŚ — blokada sesji (100% prób → `/login?redirect=%2Forganization`) | `01-organization-flagship.png` | — | — |
| 01-2 | „Gotowość organizacji" (`OrganizationReadinessScreen`) — zrzut sprzed ~8h (05.09 14:xx) obejrzany ponownie | **1) Nagłówek strony w lewym górnym rogu pokazuje literalnie „Organization" (angielski)**, podczas gdy breadcrumb tuż pod nim poprawnie pokazuje „Organizacja › Gotowość i nadzór › Gotowość organizacji". **2) W kartach „Co blokuje i kogo zatrzymuje" widoczne są SUROWE identyfikatory techniczne jako treść user-facing: „Konflikt: myWork.idea", „Konflikt: tools.sessionOutput", „Konflikt: notes.manualContext", „Konflikt: operations.interviewAnswers"** — kropkowane nazwy pól zamiast spolszczonych etykiet. **3) Pod „Konflikt: myWork.idea" wyświetla się gigantyczny blok wyraźnie testowych/śmieciowych danych**: „AUDIT Table 20260809-0759", „TEST 2026-07-23 — Tabela", „AUDYT-M06 2026-07-05T18-18-15", „AUDYT-M06 2026-07-05T18-15-19", „__M06_REPRO_TEST_", „Q2 Strategy — Market expansion playbook", „Out of cosmos." — to są ślady wewnętrznych testów/regresji, nie treść demo dla klienta. | `evidence/odbior-zywo-20260905/14-organizacja/org-summary.png` (zrzut z ~14:2x, ZMIERZONE WCZORAJ WIECZOREM, nie dziś) | **(1) prawdopodobnie już naprawione — patrz niżej. (2)+(3) BLOKER** | `src/components/Organization/redesign/OrganizationReadinessScreen.tsx` |
| 01-3 | Weryfikacja (1) w kodzie po fakcie | `git diff` między commitem akceptacji (`e4f3b74efb`, 14:23) i HEAD (`59e282df88`) pokazuje, że domyślny breadcrumb trasy `/organization/*` ZMIENIŁ SIĘ z literału `['Organization']` na `[t('layout.breadcrumb.module.organization')]`, a klucz `layout.breadcrumb.module.organization` istnieje w `public/locales/pl/translation.json` = „Organizacja". | Zmiana wygląda na naprawę TEGO DOKŁADNIE problemu, zrobioną PO wczorajszym zrzucie. | `src/routes/AppRoutes.tsx:3540`; `public/locales/pl/translation.json` | INFO (nie licz jako otwarty defekt, ale potwierdź żywym zrzutem przy najbliższej okazji) | `src/routes/AppRoutes.tsx:3540` |
| 01-4 | (2)+(3) — czy to kod czy dane | `OrganizationReadinessScreen.tsx` nie był w ogóle w zbiorze plików zmienionych od 14:23 do HEAD (`git diff --stat` pusty dla tego pliku) — więc jeśli komponent renderuje surowe klucze pól i treść demo-danych, to (2) jest kodem niezmienionym od wczoraj (wciąż aktualny), a (3) jest treścią **bazy danych demo**, która sama się nie posprząta. | brak zmian w pliku od akceptacji | **BLOKER — realne, bardzo prawdopodobnie WCIĄŻ aktualne dziś wieczorem, bo nic tego nie dotknęło** | `src/components/Organization/redesign/OrganizationReadinessScreen.tsx` |

**Werdykt: NIEGOTOWY** — (2)/(3) to dokładnie to, przed czym ostrzega CLAUDE.md
(„Dane demo = twarz produktu: probe'y sprzątają po sobie, zero rekordów testowych") i to na
module oznaczonym GOTOWY. Wymaga: (a) żywego zrzutu jutro rano na świeżej sesji, zanim
Piotr zobaczy ekran, (b) czyszczenia danych demo w tabeli konfliktów/kontekstu organizacji,
(c) zamiany kluczy pól (`myWork.idea` itp.) na spolszczone etykiety w komponencie.

---

## 08 Spotkania (`/meetings`)

Status.json (05.09): GOTOWY, „3 ekrany zgodne z obrazami, bez uwag".

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 08-1 | `/meetings` na żywo | 3 próby | NIE ZMIERZONE ŻYWO DZIŚ — blokada sesji | `08-meetings-flagship.png` | — | — |
| 08-2 | Lista spotkań — zrzut sprzed ~8h obejrzany ponownie | **1) WSZYSTKIE 10 tytułów spotkań są po angielsku** („Platform Migration — Kick-off", „Sprint 14 Planning — Product & Engineering", „SOC 2 Readiness — External Auditor Briefing" itd.) — to dane demo, nie UI, ale dla polskiego MVP jutro to będzie rzucać się w oczy. **2) Jeden wiersz wygląda na śmieciowy test**: „Zaplanuj i wykonaj dla mnie inicjatywe której c…" (urwany, brak polskiej odmiany „inicjatywę", „Bez lokalizacji", termin 29 cze 2026 14:06, 0 uczestników) — wygląda jak nieoczyszczony prompt testowy, nie realny rekord demo. **3) Wszystkie 10 wierszy mają status „Po terminie — wymaga aktualizacji" (chip pomarańczowy) i 0 w kolumnie FOLLOW-UPY** — brak jakiejkolwiek różnorodności statusów robi wrażenie, że dane są martwe/nieaktualizowane. | `evidence/odbior-zywo-20260905/12-spotkania/meetings-module.png` | (1) WAŻNY (dane), (2) **BLOKER** (wygląda jak śmieć testowy w danych demo), (3) KOSMETYKA/do weryfikacji | dane demo, nie kod — `server` seed/DB |
| 08-3 | Czy coś w kodzie modułu zmieniło się od akceptacji | `git diff e4f3b74efb..HEAD` dla `src/components/Meeting/*`: dodano `translateOperatorMessage()` (nowy plik `meetingOperatorBriefI18n.ts`) do tłumaczenia briefu operatora (`prepSummary`/`agendaGaps`/`followUpSuggestions`) zamiast wyświetlania surowego angielskiego tekstu z backendu. Realna naprawa klasy „angielski z API". Ryzyko rezydualne: funkcja ma gałąź `typeof message === 'string' → return message` — jeśli backend gdzieś jeszcze zwraca STARY format (goły string zamiast `{key,params}`), tekst nadal wyjdzie po angielsku. | Nie da się dziś zweryfikować bez żywej rozmowy z backendem | INFO / do potwierdzenia na żywo | `src/components/Meeting/meetingOperatorBriefI18n.ts:9` |
| 08-4 | Publiczny widget rezerwacji | Zrzut z 05.09 (`public-booking-widget.png`) — nie otwierany ponownie w tej sesji z powodu braku czasu/budżetu tokenów po priorytetyzacji BLOKERÓW powyżej | NIE ZMIERZONE DZIŚ | `evidence/odbior-zywo-20260905/12-spotkania/public-booking-widget.png` | — | — |

**Werdykt: NIEGOTOWY** z powodu wiersza „śmieciowego" w danych demo (08-2.2) — dokładnie
tego typu rzecz ma zawstydzić na żywym demo. Reszta listy jest funkcjonalnie w porządku.

---

## 11 Materiały (`/presentations`, moduł „Materiały")

Status.json (05.09): GOTOWY, „35 z 36 ekranów zgodnych".

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 11-1 | Rejestr materiałów (lista główna) na żywo | Nie udało się dziś (sesja martwa); najstarszy zrzut w repo (`materials-registry.png`, 04:43 rano 05.09, PRZED akceptacją) pokazuje **100% angielski interfejs**: zakładki „All/Documents/Presentations/Sheets/Template Library", kolumny „TITLE/TYPE/FORMAT/STATUS/OWNER/VISIBILITY/SOURCE/REVIEW/EXPORTS/DATE", CTA „New output", wartości „Draft"/„Ready"/„Organization"/„Private". | Zrzut jest SPRZED naprawy tego samego dnia (potwierdzone: capture o 04:43, akceptacja CTO o 14:26 dla tego modułu) | patrz 11-2 | `evidence/odbior-zywo-20260905/10-materialy/materials-registry.png` | — |
| 11-2 | Weryfikacja w KODZIE, czy stan z 04:43 jest dziś nadal aktualny | Sprawdzono grepem `ReportsAndPresentationsHub.tsx` i `OutputsAggregateTabContent.tsx`: WSZYSTKIE etykiety z 11-1 (zakładki, 10 kolumn, CTA „Nowy output", statusy Draft/Ready) idą przez `t()` i MAJĄ wypełnione polskie tłumaczenia w `public/locales/pl/translation.json` (`rap.outputs.tabs.*` → Wszystkie/Dokumenty/Prezentacje/Arkusze/Biblioteka wzorców; `rap.columns.*` → Tytuł/Typ/Status/Właściciel/Data; `rap.outputs.columns.*` → Format/Widoczność/źródło/Przegląd/Eksporty; status „draft"/„ready" renderowany przez `isPolish ? 'Szkic' : 'Draft'` itd.). | **Bardzo prawdopodobnie NAPRAWIONE** — kod dziś nie ma angielskich literałów w tym miejscu | `src/components/ReportsAndPresentations/OutputsAggregateTabContent.tsx:400-420,494-603` | INFO — potwierdź jednym żywym zrzutem jutro PRZED pokazaniem Piotrowi | — |
| 11-3 | Raport (dokument) — podgląd artefaktu | Zrzut z 05.09 (`report-artifact.png`) obejrzany: w pełni po polsku, czytelny, jedyna uwaga kosmetyczna — techniczny identyfikator dokumentu „DOC-DBR77-20260806-SIGMA-7" wypisany wprost w tytule treści (akceptowalne w kontekście referencji raportu) | OK, brak blokerów | `evidence/odbior-zywo-20260905/10-materialy/report-artifact.png` | — | — |
| 11-4 | Document Studio + Teresa (edytor dokumentu) | Zrzut `document-studio-ai-teresa.png` — czysty, polski, dobre teksty pustego stanu | OK | `evidence/odbior-zywo-20260905/10-materialy/document-studio-ai-teresa.png` | — | — |
| 11-5 | „document-studio-nowy-dokument-martwe-przyciski.png" (nazwa pliku sugeruje znany problem: martwe przyciski) | Otwarto zrzut — WIZUALNIE ekran wygląda kompletnie i po polsku (pasek narzędzi z 16 przyciskami widoczny), ale nazwa pliku (nadana przez wcześniejszego audytora) sugeruje, że część przycisków nie reagowała na klik — tego nie da się ocenić ze statycznego PNG | NIE ZMIERZONE (wymaga klikania na żywo) | `evidence/odbior-zywo-20260905/10-materialy/document-studio-nowy-dokument-martwe-przyciski.png` | do weryfikacji | — |
| 11-6 | Arkusz (Sheet), Whiteboard, Mapa myśli — po jednym artefakcie każdego typu | Sheet: zrzut z 05.09 istnieje (`sheet-artifact.png`), nie otwarty w tej rundzie z powodu budżetu. Whiteboard/Mapa myśli/Prezentacja/Notatnik w kontekście Materiałów: brak dedykowanego zrzutu z dzisiejszej/wczorajszej ewidencji dla tego DOKŁADNIE modułu (Mapa myśli i Notatnik żyją głównie w „Moja Praca", nie „Materiały") | NIE ZMIERZONE w pełni (częściowe pokrycie) | — | — | — |

**Werdykt: GOTOWY Z KOSMETYKĄ, pod warunkiem potwierdzenia 11-2 żywym zrzutem jutro
rano PRZED pokazaniem Piotrowi** (skill „Piotr nigdy pierwszym testerem" — właśnie po to).
Jeśli 11-2 się nie potwierdzi, cały moduł spada do NIEGOTOWY (flagowy ekran całkowicie
po angielsku byłby najgorszym możliwym pierwszym wrażeniem).

---

## 12 Audyty (`/audit-programs`)

Status.json (05.09): GOTOWY, „4 ekrany zgodne, liczniki z realnych danych".

Uwaga: instrukcja zadania podawała trasę `/audits` — to jest w rzeczywistości PUBLICZNA
strona marketingowa (`src/routes/AppRoutes.tsx:1430`, poza logowaniem), NIE moduł aplikacji.
Rzeczywista trasa modułu w aplikacji to `/audit-programs` (`ROUTES` w `routeConfig.ts:98+`,
potwierdzone też przez `AppView.ASSESSMENT_AUDITS` w `menuConfig.ts:169`).

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 12-1 | `/audit-programs` na żywo | NIE ZMIERZONE ŻYWO DZIŚ — blokada sesji | — | — | — |
| 12-2 | Biblioteka audytów — zrzut z 05.09 obejrzany ponownie | **1) Nagłówek lewy-górny pokazuje „Audits" (angielski)**, mimo że reszta ekranu (zakładki Biblioteka/Sesje/Wyniki/Raporty/Ustalenia/Inicjatywy, kolumny, statusy) jest w pełni po polsku. **2) Pod tytułem audytu widoczny surowy slug techniczny** „dbr77–robotyzacja–linia–spawalnicza" bez żadnej etykiety kontekstowej (np. „ID:") | (1) patrz 12-3, (2) drobne | `evidence/odbior-zywo-20260905/11-audyty/audyty-piec-powierzchni.png` | (1) prawdopodobnie naprawione, (2) KOSMETYKA | `src/components/Audit/method/*` |
| 12-3 | Weryfikacja (1) w kodzie | `git diff e4f3b74efb..HEAD` na `AppRoutes.tsx` pokazuje że domyślne breadcrumby tras `/audit-programs*` zmieniły się z literałów `['Audits']`/`['Audits','Raport DRD']`/`['Audits','Reports']` na `t('layout.breadcrumb.module.audits')` + odpowiednie `t('layout.breadcrumb.page.*')`; wszystkie klucze mają wypełnione polskie wartości w locale PL. | Prawdopodobnie naprawione | `src/routes/AppRoutes.tsx:1709,1733,1755,1779`; `public/locales/pl/translation.json` | INFO | — |
| 12-4 | Zmiany w kodzie modułu od akceptacji | `git diff` pokazuje drobne, kosmetyczne zmiany (2-6 linii) w kilku plikach `src/components/Audit/method/**` — bez oznak regresji przy pobieżnym przeglądzie | Brak alarmu | `src/components/Audit/method/tabs/*.tsx` | — | — |

**Werdykt: GOTOWY Z KOSMETYKĄ**, pod warunkiem potwierdzenia 12-3 żywym zrzutem.

---

## 14 Administracja (`/admin`)

Status.json (05.09): GOTOWY, „28 ekranów zgodnych, health po polsku".

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 14-1 | `/admin` na żywo | NIE ZMIERZONE ŻYWO DZIŚ — blokada sesji | `14-admin-flagship.png` | — | — |
| 14-2 | Stan systemu → Zależności — zrzut z 05.09 obejrzany ponownie | Bardzo dobra jakość: pełen polski, jasne puste stany („Brak wyniku", „20 probe'ów · nigdy nie sprawdzono"), zero technicznego żargonu, breadcrumb spójny z nagłówkiem tym razem (co ciekawe — w przeciwieństwie do Organizacji/Audytów ten akurat NIE miał angielskiego nagłówka wczoraj) | OK, brak defektów | `evidence/odbior-zywo-20260905/13-administracja/admin-health-dependencies.png` | — | — |
| 14-3 | Zmiany w kodzie od akceptacji | Jedyna zmiana w `src/components/Admin/` to nowy plik `ChatV9FlagsIndicator.tsx` — plakietka deweloperska „STAGING/V9 overrides", jawnie ograniczona do trybu dev/`?debug=1` (widziana jako „3 V9 overrides" w rogu wielu dzisiejszych zrzutów — to jest OCZEKIWANE zachowanie dev-buildu, nie wyciek do produkcji) | OK, brak regresji | `src/components/Admin/ChatV9FlagsIndicator.tsx` | — | — |

**Werdykt: GOTOWY** (na podstawie wczorajszej ewidencji + braku niepokojących zmian w
kodzie od akceptacji). Zalecane jednorazowe potwierdzenie żywym zrzutem, niski priorytet.

---

## 15 Ustawienia (`/settings`)

Status.json (05.09): GOTOWY, „8 ekranów zgodnych".

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 15-1 | `/settings`, `/settings/security`, `/settings/profile` na żywo | 3× próba każda | NIE ZMIERZONE ŻYWO DZIŚ — blokada sesji (wszystkie → `/login`) | `15-settings-flagship.png`, `15-settings-security.png`, `15-settings-profile.png` | — | — |
| 15-2 | Import/Eksport ustawień — zrzut z 05.09 obejrzany ponownie | **Rozjazd breadcrumbów**: górny globalny pasek (obok logo „77") pokazuje „Ustawienia › Profil", podczas gdy treść strony i lokalny breadcrumb w białym panelu poprawnie pokazują „Ustawienia › Import/Eksport ustawień", a lewe menu podświetla „Import/Eksport" jako aktywne. Górny pasek NIE aktualizuje się przy nawigacji między podstronami Ustawień. | Kosmetyczny, ale widoczny na każdej podstronie Ustawień poza Profilem | `evidence/odbior-zywo-20260905/18-ustawienia/ustawienia-zaawansowane.png` | WAŻNY | `MainLayout` / breadcrumb prop dla `${ROUTES.SETTINGS.ROOT}/*` (route mount ok. `src/routes/AppRoutes.tsx:3471`) |
| 15-3 | **Rola użytkownika na ekranie Profilu — regresja znaleziona w kodzie** | `git diff e4f3b74efb..HEAD` na `src/components/settings/ProfileSettings.tsx` pokazuje, że linia `t(...roles.${role}, currentUser.role)` (z fallbackiem na surową rolę, gdy klucz i18n brakuje) została zmieniona na `t(...roles.${role})` **BEZ fallbacku**. Sprawdzono `public/locales/pl/translation.json`: klucze `settings.profile.roles.*` istnieją dla `owner/admin/member/superadmin/product/sales/operations/finance/partner/consultant`, ale **NIE ISTNIEJE klucz `settings.profile.roles.user`** — a `UserRole` w `src/types/domain/user.ts:14-24` zawiera wartość `'user'`/`'USER'`, czyli DOKŁADNIE rolę zwykłego, niebędącego adminem/właścicielem członka zespołu (prawdopodobnie najliczniejsza rola w systemie). i18next skonfigurowany jest z `returnNull:false, returnEmptyString:false` i BEZ własnego `parseMissingKeyHandler` (`src/i18n.ts:110-111`) — domyślne zachowanie i18next przy braku klucza i braku `defaultValue`: **zwraca sam klucz jako tekst**. Skutek: użytkownik z rolą „user" zobaczy na ekranie Profilu literalny napis `settings.profile.roles.user` zamiast „Użytkownik". | **Zweryfikowane statycznie w 100% (kod + brak klucza potwierdzony grepem), NIE zweryfikowane żywym zrzutem z powodu blokady sesji** | `src/components/settings/ProfileSettings.tsx:603`; brak `settings.profile.roles.user` w `public/locales/pl/translation.json` | **BLOKER (kod-zweryfikowany, wysoka pewność)** | `src/components/settings/ProfileSettings.tsx:603` |
| 15-4 | ConnectedAppsSettings — integracje | `git diff` pokazuje DOBRĄ naprawę: brak sprawdzania odpowiedzi `fetch(...connect)` zamieniono na properny toast błędu, gdy backend zwróci błąd | Poprawa, nie regresja | `src/components/settings/ConnectedAppsSettings.tsx:1067-1085` | — | — |
| 15-5 | Bezpieczeństwo (MFA) | Zgodnie z instrukcją NIE włączano MFA ani nie zmieniano ustawień; brak żywego zrzutu dziś | NIE ZMIERZONE | — | — | — |

**Werdykt: NIEGOTOWY** z powodu 15-3 — to najsilniejszy, w pełni kodowo potwierdzony
defekt w tym pakiecie: dowolny użytkownik z rolą „user"/„USER" (nie owner/admin) zobaczy
techniczny klucz i18n zamiast słowa „Użytkownik" na własnym ekranie profilu. Naprawa jest
jednowierszowa: albo dodać klucz `settings.profile.roles.user` do `translation.json`, albo
przywrócić fallback `t(key, currentUser.role)`.

---

## 16 Partner (`/partner`, `/become-partner/apply`, `/partner/pricing`)

Status.json (05.09): GOTOWY, „pierwszy przegląd, 21 ekranów, 5 defektów językowych/waluty
naprawionych + 1 stacking-context".

| # | Ekran/krok | Co sprawdzono | Wynik | Dowód | Waga | Plik |
|---|---|---|---|---|---|---|
| 16-1 | `/partner` (portal, wymaga logowania) | 3 próby | NIE ZMIERZONE ŻYWO DZIŚ — blokada sesji | `16-partner-flagship.png` | — | — |
| 16-2 | `/become-partner/apply` (publiczne, zadziałało mimo braku sesji) | Zrzut na żywo, DOM+tekst | **OK.** W pełni po polsku, formularz zgłoszeniowy czytelny, CTA „Wyślij zgłoszenie partnerskie" i „Rozpocznij trial" w kolorze crimson — to wygląda na świadomy kolor marki na stronach MARKETINGOWYCH (publicznych), odrębny od zakazu „primary=crimson" w kanonie APLIKACJI; nie flaguję jako naruszenie bez dodatkowego kontekstu brandingu, ale warto, żeby właściciel świadomie to potwierdził. | `16-partner-public-apply.png` (ŻYWO DZIŚ) | do potwierdzenia z właścicielem (branding), nie BLOKER | — |
| 16-3 | `/partner/pricing` → przekierowuje na `/become-partner#commercial-framework` | Zrzut na żywo | OK, czysty polski, karty ścieżek partnerskich czytelne | `16-partner-public-pricing.png` (ŻYWO DZIŚ) | — | — |
| 16-4 | Portal partnerski — Pulpit (dev-render, zrzut z 05.09) | Liczby sformatowane poprawnie po polsku („10 800,00 PLN" / „10 800,00 zł" z przecinkiem), etykiety „Gotowe"/„Niedostępne"/„Zależne od zasad programu" — kolory nie nadużywają crimson (żółty/fioletowy/zielony wg semantyki) | OK | `evidence/odbior-cto-20260905/partner/dr-dashboard-po.png` | — | — |
| 16-5 | Weryfikacja napraw językowych/waluty w kodzie | `git diff e4f3b74efb..HEAD` na `PartnerRuntimeSummaryStrip.tsx` (49 linii): „X unique/signups/trials/pending" i „{{phase}} lifecycle" zamienione na `t('partner.metrics.detail*', ...)`; sprawdzono `public/locales/pl/translation.json` — wszystkie klucze (`detailUnique/detailSignups/detailTrials/detailLifecycle/detailPending`) wypełnione poprawną polszczyzną („{{count}} unikalnych", „etap: {{phase}}" itd.), kwota przeformatowana przez `Intl.NumberFormat('pl-PL', ...)` z walutą PO liczbie | **Potwierdzona, dobra naprawa** | `src/components/Partner/PartnerRuntimeSummaryStrip.tsx:20-27,150-176` | — | — |

**Werdykt: GOTOWY Z KOSMETYKĄ** (16-2 do świadomego potwierdzenia brandingu; portal
zalogowany 16-1 nie zweryfikowany dziś na żywo).

---

## Lista defektów wg wagi (z reprodukcją)

### BLOKER

1. **Ustawienia → Profil pokazuje surowy klucz i18n zamiast „Użytkownik" dla roli `user`.**
   Repro: zaloguj się jako dowolny użytkownik z rolą `USER`/`user` (nie owner/admin) →
   `/settings/profile` → sekcja z ikoną budynku obok roli. Oczekiwane: „Użytkownik".
   Aktualne (wg kodu): literalny tekst `settings.profile.roles.user`.
   Plik: `src/components/settings/ProfileSettings.tsx:603`.
   Naprawa: dodać `"user": "Użytkownik"` do `settings.profile.roles` w
   `public/locales/pl/translation.json` (i `en/translation.json` dla spójności),
   ALBO przywrócić drugi argument `t(key, currentUser.role)` jako fallback.
   Status weryfikacji: kod-zweryfikowany (100%), żywy zrzut niemożliwy dziś (sesja martwa).

2. **Organizacja → „Gotowość organizacji" pokazuje surowe klucze pól i wyraźne dane
   testowe zamiast treści demo.** Repro: `/organization` → zakładka „Gotowość i nadzór" →
   „Gotowość organizacji" → sekcja „Co blokuje i kogo zatrzymuje". Widoczne:
   „Konflikt: myWork.idea" z blokiem tekstu zawierającym „AUDYT-M06 2026-07-05T18-18-15",
   „__M06_REPRO_TEST_", „TEST 2026-07-23 — Tabela". Plik:
   `src/components/Organization/redesign/OrganizationReadinessScreen.tsx` (niezmieniony
   od wczorajszej akceptacji — więc najprawdopodobniej WCIĄŻ aktualne). Naprawa: (a)
   humanizacja etykiet pól w komponencie, (b) czyszczenie danych testowych w bazie demo
   (organizacja `a3e05d4a-5397-419d-b486-8e44366c0063` / kontekst DBR77).
   Status weryfikacji: zrzut sprzed ~8h + brak zmian w pliku od tego czasu.

3. **Spotkania — rekord na liście wygląda na nieoczyszczony test.** Repro: `/meetings` →
   ostatni wiersz listy: „Zaplanuj i wykonaj dla mnie inicjatywe której c…", „Bez
   lokalizacji", 29 cze 2026 14:06, 0 uczestników. Naprawa: usunąć/zastąpić ten rekord w
   danych demo prawdziwym spotkaniem po polsku.
   Status weryfikacji: zrzut sprzed ~8h, dane — nikt ich nie ruszał od tego czasu.

### WAŻNY

4. **Brak strony 404 w aplikacji.** Każda nieznana trasa jest cicho przekierowywana na
   `/chat` (zalogowany) lub stronę główną (niezalogowany) — zero komunikatu. Plik:
   `src/routes/AppRoutes.tsx:3811-3818`. Status: kod-zweryfikowany + potwierdzone żywo
   dwukrotnie dziś (niezależnie od stanu sesji).

5. **Ustawienia — górny globalny breadcrumb nie aktualizuje się** przy nawigacji między
   podstronami modułu (pokazuje „Profil" na każdej podstronie Ustawień, np. na
   Import/Eksport). Status: zrzut sprzed ~8h, brak potwierdzenia dziś.

6. **Spotkania (i wszystkie 10 rekordów demo) — tytuły po angielsku**, mimo w pełni
   polskiego UI dookoła. Dane, nie kod. Do rozważenia przed jutrzejszym demo.

7. **Materiały — flagowy rejestr wyglądał w 100% po angielsku na zrzucie z 04:43 rano**;
   kod dzisiaj (grep) pokazuje, że WSZYSTKIE odnośne etykiety mają wypełnione klucze PL —
   bardzo prawdopodobnie naprawione, ale **wymaga jednego żywego zrzutu jutro PRZED
   pokazaniem właścicielowi**, zanim ktokolwiek to nazwie „gotowe".

### KOSMETYKA

8. Audyty — surowy slug `dbr77–robotyzacja–linia–spawalnicza` pod tytułem audytu bez
   etykiety kontekstowej.
9. Materiały — dokument raportu pokazuje techniczny identyfikator „DOC-DBR77-…" wprost w
   tytule treści (akceptowalne, ale warto ujednolicić z resztą produktu).
10. `FilterableTable.tsx` (współdzielony komponent list, zmieniony dziś, 174 linii) —
    nowy `OverflowTooltip` przekazuje `content={String(row[column.id])}`; teoretyczne
    ryzyko literału „undefined"/„[object Object]" w tooltipie dla nie-tekstowych wartości
    komórki, ALE kod jest chroniony wcześniejszym `isEmptyCell()` dla null/undefined/pusty
    string, więc ryzyko ograniczone do rzadkiego przypadku surowego obiektu przekazanego
    bez `column.render` (co byłoby błędem już wcześniej). Nie potwierdzone na żywo — do
    obejrzenia przy pierwszej okazji na gęstej tabeli (Materiały/Audyty/Spotkania).
    Plik: `src/components/shared/ModuleHub/FilterableTable.tsx:1843-1860`.

---

## Czego NIE dało się zmierzyć (wprost)

- Wszystkie ekrany flagowe modułów B **na żywo, dzisiaj wieczorem** — sesja audytowa była
  martwa przez większość okna czasowego (patrz zastrzeżenie na górze). Jedyne żywe
  potwierdzenia dziś: `global-login.png`, `global-404-retest.png`,
  `16-partner-public-apply.png`, `16-partner-public-pricing.png`, oraz jeden przelotny
  `/my-work` (kontrolny, spoza pakietu B).
- Przepływ klikany (lista → wiersz → podgląd → „Otwórz" → powrót) dla ŻADNEGO z 7 modułów
  — wymaga wieloklikowej żywej sesji, niemożliwe przy padającej autoryzacji.
- Wejście do Teresy z prawego panelu na ekranie flagowym + „Podsumuj co tu widzisz" — dla
  żadnego z 7 modułów (wymaga żywej sesji + interakcji + 8s oczekiwania).
- Tryb ciemny i szerokość 1280 px — narzędzie `zrzut.mjs` NIE ma opcji `--ciemny` ani
  `--szerokosc` (tylko `--wysokosc`; `colorScheme` jest na sztywno `'light'`, viewport na
  sztywno `1440`px). Zgodnie z warunkiem zadania „jeśli skrypt ma opcje" — nie ma, więc
  pominięte. Istnieje wariant `scripts/dev/odbior-zywo-agent/zrzut-agent-dark.mjs`, ale
  jest zahardkodowany na port `3042` (cudzy agent) i inny mechanizm kopiowania sesji —
  nie nadaje się do użycia bez modyfikacji (zakaz edycji kodu w tym audycie).
- Lewa nawigacja — etykiety/tooltips na hover — wymaga żywej sesji.
- Pusty stan nowego użytkownika — nie da się bezpiecznie wywołać bez tworzenia konta.
- Uwagi właścicielskie z `ODBIOR_CTO_20260905/*.md` dla modułów B — nie przeglądnięte
  pozycja po pozycji z powodu priorytetyzacji budżetu na weryfikację BLOKERÓW powyżej.
- „document-studio-nowy-dokument-martwe-przyciski.png" — czy przyciski faktycznie są
  martwe, wymaga klikania na żywo, nie widać tego na statycznym zrzucie.

## Werdykty modułów (podsumowanie)

| Moduł | Werdykt |
|---|---|
| Powłoka globalna | NIEGOTOWY do pełnej oceny (braki pomiarowe) — 1 WAŻNY potwierdzony (brak 404) |
| 01 Organizacja | **NIEGOTOWY** (dane testowe + surowe klucze pól na ekranie Gotowości) |
| 08 Spotkania | **NIEGOTOWY** (rekord wyglądający na śmieć testowy na liście) |
| 11 Materiały | GOTOWY Z KOSMETYKĄ (pod warunkiem potwierdzenia naprawy rejestru) |
| 12 Audyty | GOTOWY Z KOSMETYKĄ |
| 14 Administracja | GOTOWY |
| 15 Ustawienia | **NIEGOTOWY** (kod-zweryfikowany BLOKER — klucz roli „user" brakujący) |
| 16 Partner | GOTOWY Z KOSMETYKĄ |
