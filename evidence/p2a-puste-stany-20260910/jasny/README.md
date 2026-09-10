# Motyw jasny — zrzuty ZADANIE 2 (p10-decyzje, 2026-09-10)

## Dlaczego nie ze stagingu (jak oryginalna paczka `-light`/`-dark`)

Nie mam hasła do konta `p2a-wt091041@dbr77.com` — zlecenie podało tylko e-mail,
bez hasła; szukanie go w cudzym stanowisku `~/Developer/wt/p2a-puste` było mi
zabronione (siedmioro innych robotników pracuje równolegle, zakaz wchodzenia
do ich katalogów). Nie mam też ogólnych zasad pozwalających mi samodzielnie
wpisywać hasła w formularze logowania. Zgodnie z zapasowym wariantem ze
zlecenia użyłem harnessu `dev-render` (realne komponenty, mock-dane, bez
logowania) zamiast stagingu.

## Co faktycznie pokazują te 4 zrzuty

Harness `dev-render` montuje realne komponenty z uniwersum demo (klienci
Grupa Termika / Bielmar / Kolej Wschodnia) — to NIE są literalnie te same
puste-stanowe ekrany świeżej organizacji co w `../01-06-*-light.png` z
poprzedniej (ciemnej) paczki, tylko najbliższe dostępne realne ekrany do
weryfikacji samego wyglądu motywu jasnego (kontrast, kolor stanów, brak
crimson poza semantyką krytyczną, brak rozjazdu układu):

- `02-moja-praca-decyzje-light.png` — `?screen=mywork-decisions` — REALNY
  `DecisionsPanelContent` (ten sam komponent co ZADANIE 1 tego dyżuru),
  6 mock-decyzji, NIE pusty stan.
- `04-ocena-procesy-light.png` — `?screen=assessment-list` — REALNY
  `AssessmentHub` zakładka Procesy, 6 mock-ocen, NIE pusty stan.
- `03-wywiad-sesje-light.png` — `?screen=interview-sessions-status` — REALNY
  `InterviewHub` zakładka Sesje, 5 mock-wierszy, NIE pusty stan.
- `06-ustawienia-profil-light.png` — `?screen=ustawienia-personalne` —
  REALNY `SettingsView` grupa Profil, dane demo Piotra Wiśniewskiego.

## Czego brakuje i dlaczego (STOP, nie udawane)

- **Czat** — brak w `dev-render/main.tsx` gotowego ekranu odpowiadającego
  pustej stronie głównej Teresy dla świeżej organizacji; istniejące
  `chat-*` wpisy to warianty ze specyficznymi defektami (crimson, artefakty),
  nie neutralna strona startowa. Budowa nowego ekranu-hosta z zerowym stanem
  wykraczała poza budżet tego zadania.
- **Organizacja** — `OrganizationView` (src/views/OrganizationView.tsx) nie ma
  wpisu w `dev-render/main.tsx`; klucze `org-*` istniejące w harnessie to
  osobne podekrany Discovery Tool (`Organizacja i kontekst` wywiadu), nie
  moduł Organizacja (zespół/ustawienia firmy).

Obu tych dwóch brakujących ekranów NIE zmierzono w motywie jasnym w tym
dyżurze. Wymaga albo hasła do konta stagingowego, albo osobnego zlecenia
budowy hosta dev-render dla tych dwóch ekranów.

## UZUPEŁNIENIE 2026-09-10 (dyżur domknięcia S2.2): Czat i Organizacja

`01-czat-light.png` i `05-organizacja-light.png` w tym katalogu — NIE ze
stagingu (ten sam powód co wyżej: brak zgody na wpisywanie przechowywanego
hasła konta stagingowego w formularz logowania) i NIE z `dev-render`
(dalej brak gotowych hostów dla tych dwóch ekranów w `dev-render/main.tsx`).

Zamiast tego: realny LOKALNY build tej samej gałęzi (`mvp/p17-e2e-20260910`),
realna ŚWIEŻA organizacja bez ŻADNEGO hasła — sesja z
`POST /api/test-support/bootstrap` (dokładnie ten sam mechanizm zero-hasłowy,
którego używa `tests/e2e/p2b-empty-state-first-value.spec.ts`), motyw
wstrzyknięty do `localStorage` PRZED bootem (ten sam wzór co naprawiony
`scripts/dev/p2a-empty-states-capture.mjs`) i potwierdzony faktycznie
zastosowany (`document.documentElement.classList` → `light`, nie zgadywany).
Skrypt: `scripts/dev/p2a-jasny-czat-organizacja-capture.mjs`.

Różnica od oryginalnej paczki `-light`/`-dark`: interfejs jest po ANGIELSKU
(świeże konto z bootstrapu nie ma ustawionego języka polskiego — ten skrypt
tego nie zmieniał, bo cel to sam motyw, nie treść). To NIE to samo konto co
`p2a-wt091041@dbr77.com` na stagingu — inna, lokalna, jednorazowa organizacja.

Obejrzane wzrokiem:
- **`01-czat-light.png`** (`/`, świeża organizacja, zero rozmów) — białe tło,
  ciemny czytelny tekst ("Let's get to work."), input "Ask Teresa about your
  work..." z jasnym obramowaniem, cztery karty startowe (Market analysis /
  Financial analysis / Classic consulting / Digital transformation) neutralne
  szaro-białe z ikonami w kolorze semantycznym (fiolet/zielony/pomarańcz/
  niebieski), cztery pigułki (Daily brief / Quick savings / Product idea /
  Plan review) neutralne obrysowane, strzałka "wyślij" wyszarzona (nieaktywna
  — pusty input) na szarym tle, nie crimson. Crimson WYŁĄCZNIE na logotypie
  "77" w lewym górnym rogu (marka, nie CTA/stan) — zgodne z regułą
  crimson=semantyka krytyczna.
- **`05-organizacja-light.png`** (`/organization`, ten sam profil co widzi
  P2A) — białe tło, ciemny tekst, pasek "Add org profile details to improve
  Teresa's answers" (odpowiednik polskiego "Uzupełnij profil organizacji, aby
  Teresa odpowiadała trafniej" z testu P2A), przycisk "Add source" w prawym
  górnym rogu WIDOCZNY (odpowiednik "Dodaj źródło"), panel "DATA STATE"
  pokazuje uczciwie "2/13 Fields filled in" / "0 Approved facts" zamiast
  udawać kompletność. Aktywna pozycja menu ("Identity & Operating Model") ma
  niebieski akcent (c-focus), nie crimson. Przyciski "Save changes" i "Add
  source" — ciemny granat/czarny, nie crimson. Crimson wyłącznie na logotypie
  "77". Zero defektów wyglądu znalezionych.

Oba tła są NAPRAWDĘ jasne (nie powtórka błędu "dwanaście zrzutów nazwanych
jasny było ciemnych" z 2026-09-10 rano) — potwierdzone programowo
(`classList` → `light`) i wzrokiem.

## Weryfikacja wzrokiem 4 wcześniejszych zrzutów

Wszystkie cztery: białe/jasnoszare tło, ciemny czytelny tekst, brak jasnego
tekstu na jasnym tle. Stany kolorowe semantyczne, nie crimson-jako-CTA:
zielony (Zatwierdzone/Zatwierdzony/Zakończony/Przyjęta), pomarańczowy
(Oczekuje/W przeglądzie/Wysłany), niebieski/fiolet (W trakcie/Przydzielony),
czerwień TYLKO przy "Krytyczny" (priorytet) i "Odrzucona"/"Eskalowana" —
zgodne z regułą crimson=semantyka krytyczna. Aktywne stany menu/zakładek i
akcent w Ustawieniach (pasek przy "Profil") — niebieski/neutralny, nie
crimson. Przyciski główne (Nowa decyzja / Nowa ocena / Nowa sesja / Zapisz
zmiany) — ciemny granat/czarny, nie crimson. Układ tabel (StandardTable) bez
rozjazdu kolumn. Defektów wyglądu w tych 4 zrzutach NIE znaleziono.
