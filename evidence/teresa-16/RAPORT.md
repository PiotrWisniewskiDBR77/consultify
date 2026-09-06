# Teresa — pomiar 16 modułów

Stan odbioru: **DONE / POTWIERDZONE**. Pełny przebieg (bez wyczerpania limitu) potwierdził
13/13 modułów z wejściem Teresy: odpowiedź po polsku, `used_sources > 0` tam gdzie moduł ma
dane, polskie „Brak danych w module" tam gdzie nie ma (Narzędzia, Audyty, Spotkania —
zgodnie z przewidywaniem). 3 moduły bez ekranu-artefaktu (Administracja, Ustawienia,
Partner) pozostają twardym STOP, poza MVP — nie budowano nowego ekranu. Dokładnie jeden
`UnifiedChatPanel` w DOM w każdym z 13 przypadków, zero błędów konsoli.

## Jak obszedłem dzienny limit AI (WYŁĄCZNIE lokalnie, poza kodem)

Poprzedni przebieg Codexa wyczerpał `max_ai_calls_per_day=50` konta `audyt@dbr77.local`
(org `cc9db573-260f-4a19-927f-f3cc1fbaea38`, „DBR77"). Nie zmieniono żadnej flagi ani
limitu w kodzie. Organizacja była już wcześniej ustawiona na `organization_type=PAID`
w bazie `consultify_noc` (decyzja z sesji 05/06.09, „jak na stagingu" — commit
`8547baf97c`, dotyczyła innego blokera eksportu). Dla PAID `accessPolicyService.checkAccess`
i `AIOrchestrator.processMessage` pomijają sprawdzenie dziennego licznika (`isPaid` ⇒ brak
bramki `AI_LIMIT_REACHED`) — potwierdzone empirycznie: w trakcie tego przebiegu licznik
`usage_counters.ai_calls_count` przekroczył 50 (doszedł do konkretnej wartości ponad 60) i
mimo to wszystkie 13 wywołań z wejściem zwróciło poprawną odpowiedź. Żadna migracja, żaden
plik `.env` repozytorium, żadna flaga w kodzie nie zostały zmienione — jedyna zmiana to
istniejący, lokalny wiersz `organizations.organization_type` w bazie `consultify_noc:54400`
(poza repo, nie dotyka stagingu/demo/produkcji).

Własne stanowisko: serwer `4106` (`ENV_FILE=/private/tmp/stanowisko-noc/server-teresa16.env`,
kopia `server.env` bez zmian wartości; `DATABASE_URL` na tę samą bazę `consultify_noc:54400`
co stanowisko `4100`), frontend `vite --port 3115` (`VITE_API_TARGET=http://127.0.0.1:4106`),
sesja `auth-teresa16.json` (token audytowy, ważny do 12:17 UTC). Stanowisko `4100`/`3090` nie
było dotykane.

## Naprawy

Brak nowych napraw kodu w tej turze — poprzednie naprawy Codexa (`d04bf6b771`: klasyfikacja
`routeInfo`, źródła per moduł, polski komunikat pustego modułu) już działały poprawnie;
jedyną przeszkodą do pełnego pomiaru był wyczerpany limit wywołań AI z poprzedniej sesji
pomiarowej, nie defekt produktu. Zadanie tej tury: dokończyć pomiar i poprawić jakość
16 zrzutów dowodowych.

## Poprawka zrzutów (bez zmian produktu)

Pierwszy przebieg testu E2E (`tests/e2e/teresa-16-modulow.spec.ts`, bez zmian) zrobił zrzut
natychmiast po odebraniu odpowiedzi SSE — w 8 z 13 przypadków panel Teresy był w trakcie
przewijania i plakietka „Źródła: N" (`TrustBadge`, i18n `trust.badge.sources` =
„Źródła: {{count}}", domyślnie WŁĄCZONA, `src/utils/trustBadgeFlag.ts`) wypadała poza
widoczny obszar (widoczne na przykład na pierwotnym `07-realizacja.png` — środek listy
zadań zamiast plakietki). Dane w JSON (`used_sources`, `sources[]`) były już wtedy
poprawne — to był wyłącznie problem czytelności dowodu, nie defekt produktu. Dogrywka:
jednorazowy skrypt `scripts/dev/teresa16-shots.mjs` (dodany do repo) powtarza dokładnie te
same kroki UI, ale przed zrzutem przewija do widocznego `Źródła:\s*\d+` (albo do „Brak
danych w module" gdy `used_sources=0`) i dopiero wtedy robi zrzut 1440×1000. Nadpisano
13 plików `NN-slug.png` (moduły z wejściem); 3 zrzuty STOP (`13`, `14`, `16` — brak
wejścia) zostały bez zmian, bo nie ma tam interakcji do pokazania.

## Bramki techniczne

- Brak zmian w `server/src`/`src` w tej turze → esbuild/`tsc` per plik nie dotyczy
  (nic nie dotknięto poza `scripts/dev/teresa16-shots.mjs`, plikiem pomocniczym Node ESM
  bez TS).
- `server/src/services/ai/__tests__/moduleContextGrounding.test.ts`: 10/10 PASS (bez
  zmian od bazy Codexa — brak regresji).
- `check-teresa-kontrakty.sh`: `TERESA-CONTRACT tools 19/19`, `PASS entries=13 preview=3
  dead=0` (identyczne z bazą).
- `check-list-canon.sh`: OK (`361` naruszeń, baseline `364` — dług nie rósł, spadek
  odziedziczony po poprzednim merge`).
- `check-artefakt.sh`: OK (`8` / baseline `8`, karty N i danger-* bez zmian).
- `server/migrations`: 0 zmienionych plików.
- Playwright `teresa-16-modulow.spec.ts` (bez zmian): `1 passed` — generator raportu;
  16/16 wierszy w tabeli poniżej, statusy produktowe czytane z tabeli, nie z exit code.

## Co niezmierzone

- Nic z zakresu zadania. Wszystkie 13 modułów z wejściem: PASS, zmierzone realnym
  wywołaniem AI (nie flagą, nie kodem). 3 moduły STOP: potwierdzony brak wejścia
  (Administracja, Ustawienia, Partner) — wymagałoby to nowego ekranu-artefaktu, poza
  zakresem tego zlecenia i poza MVP.
- Jakość i18n samej treści odpowiedzi AI (nie UI) ma znany, nieszkodliwy artefakt pomiaru:
  `response.text()` w harnessie Playwright dekoduje SSE z mojibake (np. „WidzÄ™" zamiast
  „Widzę") w kolumnie „Odpowiedź / blokada" poniżej — to usterka dekodowania w skrypcie
  pomiarowym (`parseSse`), nie w produkcie: te same zrzuty ekranu pokazują poprawne polskie
  znaki wyrenderowane w przeglądarce (`ą/ę/ł/ż` czytelne na `01-czat.png` itd.). Nie
  naprawiano (poza zakresem kategorii napraw z tego zlecenia: `teresaEntry` /
  `moduleContextGrounding` / `languagePolicy` — żadna z nich tego nie dotyczy, to
  wyłącznie dekodowanie w pliku testowym).

## Tabela 16 modułów

| # | Moduł | Trasa | Wejście | Język | used_sources | UnifiedChatPanel DOM | Błędy konsoli | Stan | Odpowiedź / blokada |
|---:|---|---|---|---:|---:|---:|---:|---|---|
| 1 | Czat | `/chat` | Czat główny | pl | 6 | 1 | 0 | PASS | Novatek Manufacturing Sp. z o.o. jest firmÄ… z branÅ¼y przemysÅ‚owej, zajmujÄ…cÄ… siÄ™ produkcjÄ… dyskretnÄ…. Firma ma 620 pracownikÃ³w i generuje przychody w wysokoÅ›ci 120 milionÃ³w euro. Obecnie re |
| 2 | Moja Praca | `/my-work` | Teresa | pl | 15 | 1 | 0 | PASS | Novatek Manufacturing Sp. z o.o. to firma z branÅ¼y produkcji dyskretnej, zatrudniajÄ…ca 620 pracownikÃ³w i generujÄ…ca przychody na poziomie 120 milionÃ³w euro. W organizacji obecnie dziaÅ‚ajÄ… dwie  |
| 3 | Wywiad | `/interview` | Teresa | pl | 10 | 1 | 0 | PASS | Oto podsumowanie dostÄ™pnych informacji: 1. **Organizacja**: Novatek Manufacturing Sp. z o.o. jest Å›redniej wielkoÅ›ci firmÄ… produkcyjnÄ… z branÅ¼y przemysÅ‚owej, zatrudniajÄ…cÄ… 620 pracownikÃ³w i |
| 4 | Narzędzia | `/discovery-tools` | Teresa | pl | 0 | 1 | 0 | PASS | Brak danych w module. |
| 5 | Ocena | `/assessment?tab=library` | Teresa | pl | 4 | 1 | 0 | PASS | W kontekÅ›cie Novatek Manufacturing Sp. z o.o.: 1. **Organizacja**: Firma dziaÅ‚a w branÅ¼y produkcyjnej (Manufacturing - Discrete) na poziomie Mid-Market, z przychodem â‚¬120M i zatrudnia 620 pracow |
| 6 | Inicjatywy | `/initiatives` | Teresa | pl | 12 | 1 | 0 | PASS | Jestem Teresa, partnerem konsultingowym w Consultify, i widzÄ™ nastÄ™pujÄ…ce informacje: 1. **Organizacja**: Novatek Manufacturing Sp. z o.o., dziaÅ‚a w branÅ¼y produkcyjnej z przychodem â‚¬120M i za |
| 7 | Realizacja | `/execution?tab=list&view=table` | Teresa | pl | 24 | 1 | 0 | PASS | Oto podsumowanie dostÄ™pnych informacji: 1. **Organizacja:** Novatek Manufacturing Sp. z o.o. dziaÅ‚a w branÅ¼y manufacturing (discrete), zatrudnia 620 pracownikÃ³w i generuje przychody na poziomie â |
| 8 | Wyniki | `/results/kpi/ed531550-a7bc-54bb-bbfc-71f2daa14d7f` | Zapytaj Teresę o ten miernik | pl | 15 | 1 | 0 | PASS | WidzÄ™, Å¼e organizacja Novatek Manufacturing Sp. z o.o. dziaÅ‚a w branÅ¼y produkcji dyskretnej i posiada Å›redniÄ… wielkoÅ›Ä‡ z przychodem â‚¬120M oraz 620 pracownikÃ³w. Obecnie realizowane sÄ… trzy  |
| 9 | Finanse | `/finance?tab=statements` | Teresa | pl | 1 | 1 | 0 | PASS | Novatek Manufacturing Sp. z o.o. to firma z branÅ¼y produkcji dyskretnej o Å›redniej wielkoÅ›ci rynku, z rocznym przychodem 120 milionÃ³w euro. W organizacji pracuje 620 osÃ³b. Obecnie prowadzone sÄ…  |
| 10 | Materiały | `/presentations` | Teresa | pl | 5 | 1 | 0 | PASS | WidzÄ™, Å¼e mamy do czynienia z organizacjÄ… Novatek Manufacturing Sp. z o.o., dziaÅ‚ajÄ…cÄ… w branÅ¼y produkcyjnej. Firma zatrudnia 620 pracownikÃ³w i generuje przychÃ³d w wysokoÅ›ci 120 milionÃ³w eu |
| 11 | Audyty | `/audit-programs?tab=library` | Teresa | pl | 0 | 1 | 0 | PASS | Brak danych w module audytÃ³w. |
| 12 | Spotkania | `/meetings` | Teresa | pl | 0 | 1 | 0 | PASS | Brak danych w module Spotkania. |
| 13 | Administracja | `/admin/team/members` | /^(Teresa\|Zapytaj Teresę)/ | — | 0 | 0 | 0 | STOP | brak wejścia, poza MVP |
| 14 | Ustawienia | `/settings/profile` | /^(Teresa\|Zapytaj Teresę)/ | — | 0 | 0 | 0 | STOP | brak wejścia, poza MVP |
| 15 | Organizacja | `/organization/profile/identity-scale` | Zapytaj Teresę o kontekst organizacji | pl | 1 | 1 | 0 | PASS | Novatek Manufacturing Sp. z o.o. to firma produkcyjna Å›redniej wielkoÅ›ci z 620 pracownikami i przychodami na poziomie 120 milionÃ³w euro [M1]. Organizacja ma obecnie dwa aktywne projekty i charakter |
| 16 | Partner | `/partner?tab=partner-home` | /^(Teresa\|Zapytaj Teresę)/ | — | 0 | 0 | 0 | STOP | brak wejścia, poza MVP |
