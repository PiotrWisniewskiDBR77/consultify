# CODEX DAY 236 — ORGANIZACJA — RAPORT

Data: 2026-09-01  
Gałąź: `codex/day236-organizacja-20260901`  
Baza: marker `e014ba0d8b`; worktree `/private/tmp/cx-day236-organizacja`  
Zasoby wyłączne: PostgreSQL `127.0.0.1:6184` (`cx-day236-pg`), harness `5156` (5157 niewykorzystany)  
Werdykt: `R1 DOSTARCZONE / R2 ROZSTRZYGNIĘTE / R3 DOPISANE / R4 DOPISANE / OWNER_NOT_REVIEWED`

## Wynik wykonawczy

- Dodałem dev-only entry `day236-organizacja`, który montuje realny `OrganizationView` przez istniejący fixture adapter, steruje wszystkimi 11 kanonicznymi parami `{module, screen}`, wymusza flagę wyłącznie query-paramem i ma warianty `redesign=off` oraz `persona=member`.
- Wykonałem i obejrzałem 22 zrzuty (11 ekranów × light/dark), zrzut legacy OFF i zrzut MEMBER. Wszystkie 11 ekranów renderuje się bez crasha; trzy rodziny danych pozostają uczciwie puste zgodnie z fixture'em.
- Każda para light/dark ma różnicę `mean_luma > 150`; zmierzony zakres to `211.8–228.4`.
- Nie zmieniłem defaultu flagi ani żadnej logiki produktu. Jedyna zmiana w `orgRedesignFlag.ts` to jedno zdanie komentarza nagłówka.
- Nie dopisałem Goals/Challenges/Risks do seeda: pomiar R2 wykazał brak tych danych w istniejącym fixture, a zakres dyżuru nie upoważnia do produkowania nowej merytoryki ani budowy backendu.

## §0 — wejście, marker i rozjazd tipa

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    11Gi    52%    459k  115M    0%   /
26bf13a839 236/237/238: marker podniesiony do wlasnego commitu
e014ba0d8b instrukcje 236 Organizacja / 237 Spotkania / 238 Ustawienia
319eb8b48d SPROSTOWANIE nadzorcy: moje zdanie o niewidocznosci OKR/ROI na demo bylo falszywe — VITE_DEMO_ACCEPTANCE omija flagi w SZESCIU rodzinach; flaga OFF w kodzie != wylaczone na demo
820cf9e023 Merge remote-tracking branch 'github-backup/codex/day234-wyniki-20260901' into HEAD
3c743fdc5c style: prettier na nowym bloku ENABLE_PPTX_CANONICAL_GEOMETRY (dyzur 227 zameldowal '0 errors', odbior zmierzyl 2 — usterka formatowania, zero zmiany logiki)
bd1b3ed862 Merge remote-tracking branch 'github-backup/codex/day227-gamma-geometria-20260901' into HEAD
dbb4f54bbb GAMMA: punkt wejscia — marzenie, trzy filary slowami wlasciciela, stan kazdego, twardy sufit biblioteki, LISTA CZEGO NADAL NIE WIEM, trzy drogi i rekomendacja
b94515af72 ksztalt 19: para zrzutow przechodzi bezpiecznik jasnosci tym latwiej, im wiekszy defekt — dwa rozne stany zamiast dwoch motywow
8d13ed9719 Merge remote-tracking branch 'github-backup/codex/day233-finanse-20260901' into HEAD
f5c0c7ebfd Merge remote-tracking branch 'github-backup/codex/day235-materialy-20260901' into HEAD
abfd802902 208: marker podniesiony do e99e81301a, zasoby przeniesione na wolne porty (6187, 5162-5163) — dyzur nigdy nie zostal wykonany
c28889b936 docs(day234): record Results measurements and evidence
b775104e32 docs(day235): report materials evidence duty
de542c4d65 feat(day233): add finance owner-review evidence
11fd0c23f9 docs(day235): correct excele default comments
ea1f453e86 docs(day235): correct materials generator measurements
67fab88756 feat(day235): add materials evidence screens
0b56823c99 feat(day234): add Results evidence switchboards
e99e81301a instrukcje 233 Finanse / 234 Wyniki / 235 Materialy (fala Z2: moduly nigdy nieogladane przez wlasciciela)
cb8150381a odbior FIX-230 i FIX-232: obie oceny podniesione; dowody mutacyjne w obie strony; para dowodowa przy weryfikacji cytowan
795fed6625 merge: FIX-230 (detektor przepelnienia) + FIX-232 (wyscig, weryfikacja cytowan, uczciwosc makiety)
bc07db19c7 Merge remote-tracking branch 'github-backup/codex/day230-gamma-przepelnienie-20260901' into HEAD
288ef86137 fix(day232): evidence screen names what the product actually does (FIX-232 A3)
af24425ad7 fix(day230): show detector confidence + stop preflighting PDF exports (FIX-230 F7+F8)
689881be65 227/229: marker podniesiony do 142686b772 przed wydaniem
MARKER OK
```

Sanity po utworzeniu worktree:

```text
[core]
        bare = false
e014ba0d8b541a1e9079f595d489dcc0814eaaca
```

`git status --short | head -3` nie zwrócił żadnego wiersza. Marker był przodkiem tipa, więc zgodnie z DEC-95 zacząłem dokładnie z `e014ba0d8b`; późniejsze zmiany tipa pozostają do scalenia przez nadzorcę.

Stan końcowego tipa bazowego podczas raportowania był już dalej niż przy starcie. Pełne `git log e014ba0d8b..github-backup/codex/m03-admin-20260824` i `git diff --name-only` zapisano w historii poleceń dyżuru; nie wykonałem rebase ani scalenia.

## §0 — siedem tez wejściowych

```text
98 src/utils/orgRedesignFlag.ts
86:export function isOrgRedesignV1Enabled(): boolean {
34: *   4. Default: ON (DEC-2026-08-26-78).
return parsed === null ? false : parsed;
51:import { isOrgRedesignV1Enabled } from '../utils/orgRedesignFlag';
132:  const [redesignEnabled] = useState(() => isOrgRedesignV1Enabled());
14 plików .tsx w redesign/: 11 ekranów + 3 współdzielone
94:function resolveOrganizationLocation(
98:  const modules = redesign ? ORGANIZATION_REDESIGN_MODULES : ORGANIZATION_MODULES;
72:G08 ... OWNER_NOT_REVIEWED
73:G09 ... 2 z 5 ... OWNER_NOT_REVIEWED
74:G10 ... 14 z 20 ... OWNER_NOT_REVIEWED
Filesystem: 5.9 GiB wolnego po utworzeniu worktree, powyżej progu STOP
```

T1–T7 potwierdzone własnym pomiarem. Porty 6184/5156/5157 nie miały listenerów; `docker ps` nie wykazał kontenera ani mapowania kolidującego z zasobami Day236.

## Migracje i Z30

Pierwszy przebieg zastosował `879` migracji, drugi przebieg był idempotentny:

```text
Applying migrations: 879
✅ Postgres migrations complete
Applying migrations: 0
✅ Postgres migrations complete
```

Dowód poczty przed operacjami:

```text
BRAK ZMIENNYCH POCZTY
 key | left
-----+------
(0 rows)
```

`grep` drenaży w `server/src/Gateway.ts` zwrócił 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Po zakończeniu zrzutów zatrzymałem harness, usunąłem wyłącznie własny kontener poleceniem `docker rm -fv cx-day236-pg` i potwierdziłem brak listenerów na 6184/5156/5157.

## R1 — harness i zrzuty

Realna ścieżka każdego zrzutu: `dev-render/main.tsx` → `dev-render/screens/day236-organizacja.tsx` → istniejący `dev-render/screens/org-identity-operating.tsx` → `AppProviders` → realny `OrganizationView` → realne komponenty `src/components/Organization/redesign/*`.

Dane nie są ręcznymi propsami do ekranów. Harness zasila istniejące adaptery API realistycznym profilem, claims, versions i stats, a `goals/challenges/synthesis` pozostawia `{}`; ekrany odczytują je własną ścieżką store/context sync.

| # | Para `{module, screen}` | Render | Luma light/dark | Δ |
|---:|---|---|---:|---:|
| 1 | `profile/identity-scale` | pełny | 244.7 / 29.7 | 215.0 |
| 2 | `profile/position-direction` | pełny | 244.7 / 29.6 | 215.1 |
| 3 | `goals/strategic-intent` | pusty zgodny z fixture | 245.3 / 28.2 | 217.1 |
| 4 | `goals/stakeholder-expectations` | pusty zgodny z fixture | 245.1 / 28.2 | 216.9 |
| 5 | `challenges/declared-challenges` | pusty zgodny z fixture | 244.9 / 28.3 | 216.6 |
| 6 | `challenges/root-causes` | pusty zgodny z fixture | 245.3 / 28.1 | 217.2 |
| 7 | `strategy/risks-opportunities` | pusty zgodny z fixture | 246.0 / 26.3 | 219.7 |
| 8 | `strategy/executive-brief` | częściowy, liczniki 0 | 242.8 / 31.0 | 211.8 |
| 9 | `sources/claims-sources` | pełny | 245.3 / 28.4 | 216.9 |
| 10 | `sources/knowledge-graph` | pełny stats | 249.1 / 20.7 | 228.4 |
| 11 | `readiness/summary` | pełny pomiar fixture | 247.0 / 25.1 | 221.9 |

Porównanie OFF pokazało 21 ekranów nawigacji w 6 grupach; ON pokazało 11 ekranów w tych samych 6 grupach. Wariant MEMBER ma tę samą IA; w `Sources & Claims` realny prop `isAdmin=false` ogranicza akcje administracyjne, nie ukrywa całej powierzchni.

Artefakty: `/private/tmp/cx-day236-organizacja-artefakty/day236-*.png`. Pełny manifest SHA-256: `/private/tmp/cx-day236-organizacja-artefakty/day236-screenshots.sha256`, SHA-256 manifestu `bc5a1946ab47e7d1c27436decc6d1473bf9ca80f4eceb703827e10c4be07ac45`.

## R2 — realna zawartość fixture

| Ekran | Dane w fixture | Co renderuje | Rozstrzygnięcie |
|---|---|---|---|
| Tożsamość i model działania | TAK: `organization_profiles` + claims | pełny | dane istnieją i są odczytywane |
| Kierunek i ograniczenia | TAK: `organization_profiles` | pełny | dane istnieją i są odczytywane |
| Cele i mierniki | NIE: brak `goals` w seederze | pusty | brak danych fixture, nie błąd odczytu |
| Zakres i tryb współpracy | NIE: brak `goals` w seederze | pusty | brak danych fixture, nie błąd odczytu |
| Wyzwania i dowody | NIE: brak `challenges` w seederze | pusty | brak danych fixture, nie błąd odczytu |
| Przyczyny i blockery | NIE: brak `challenges` w seederze | pusty | brak danych fixture, nie błąd odczytu |
| Ryzyka i szanse | NIE: brak `synthesis` w seederze | pusty | brak danych fixture, nie błąd odczytu |
| Scenariusze i brief | NIE: brak `goals/challenges/synthesis` | częściowy/zera | brak danych fixture, nie błąd odczytu |
| Źródła i twierdzenia | TAK: governed items/claims | pełny | dane istnieją i są odczytywane |
| Graf wiedzy | TAK w harness stats | pełny | dane harnessu, nie readback seeda Day85 |
| Gotowość organizacji | TAK: profil + claims + versions | pełny pomiar | dane istnieją i są odczytywane |

Dowód: seeder zapisuje profil w `server/scripts/seed-wave3-organization-owner-review.ts:341-385` oraz governed context w dalszej części, ale nie zawiera `organization_context_store`, `goals`, `challenges` ani `synthesis`. Day85 niezależnie opisał ten sam wynik w `CODEX_DAY85_ORGANIZATION_OWNER_REPORT.md:91-112`. Nie znaleziono podstawy do zmiany seeda w licencji R2.

## R3 — korekta karty modułu

Na końcu `MODULE_ACCEPTANCE.md` dopisałem zmierzony stan: flaga istnieje, realny default jest OFF, mapa ma 11 ekranów, routing jest zagnieżdżony, a `OWNER_NOT_REVIEWED` pozostaje prawdziwe. Nie zmieniłem `REKONESANS_ZAMKNIECIA_16_MODULOW.md`, `FUNCTIONAL_DOCUMENTATION.md` ani ledgeru decyzji.

## R4 — komentarz nagłówka flagi

Dopisano jedno zdanie informujące, że stan wykonawczy od 2026-08-29 jest DEFAULT OFF i odsyłające do aktualnego komentarza przy `readEnvFlag()`. Logika linii 37–99 nie została zmieniona.

## §0.4a — mianownik testów po pełnych nazwach

Komenda przed i po:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/Organization/__tests__ src/components/Organization/redesign/__tests__ src/utils/__tests__ dev-render/screens --retry=0 --reporter=json --outputFile=<przed|po>.json
```

| Pomiar | Suites PASS/FAIL | Testy PASS/FAIL | Nazwy |
|---|---:|---:|---:|
| PRZED | 199 / 11 | 820 / 21 | 841 |
| PO | 199 / 11 | 820 / 21 | 841 |

`diff przed-nazwy.txt po-nazwy.txt`: pusty.  
`diff przed-nazwy-status.txt po-nazwy-status.txt`: pusty.  
Nazwy dodane: 0. Nazwy zniknięte: 0. Statusy zmienione: 0.

Pakiet jest jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`) i nie jest dowodem egzekucji DB/HTTP. Pułapki Z33: `ENABLE_V8_GLOBAL`, auth bypass i visibility middleware nie leżą na ścieżce tego pomiaru; pułapka flagi dotyczy bezpośrednio i została rozstrzygnięta kodem oraz testem. Dwa zastane testy `orgRedesignFlag.test.ts` nadal oczekują ON i padają wobec realnego OFF; ich zmiana nie mieści się w licencji. Pozostałe zastane FAIL obejmują registry ChatV9, mock `DbPromise` i fonty PDF; nie zmieniłem ich ani nie przedstawiam jako wynik Day236.

SHA-256: przed `7aff1e31a2fee5aaa191ae7f6447a938fb8bad290c715e37918c1bbb15b13075`; po `8fa9f954e98c6720dc5429a337e619043d441d3cce142e00539e463e1ba6908e`.

## Korekty wobec instrukcji

1. Ramka §0.1 mówi „SHA markera: `e014ba0d8b`”, natomiast ciało §1 zawiera „POMIAR NA MARKERZE `e99e81301a`”. Wybrałem wiążącą ramkę wydania i jawne pole użytkownika: pracowałem z `e014ba0d8b`; `MARKER OK` potwierdził przodka.
2. R5 odsyła do „struktury z §R.2”, ale w wydanym pliku nie istnieje nagłówek ani treść §R.2. Zastosowałem bezpieczną strukturę obejmującą wszystkie jawne wymagania: §0, R1–R5, mianownik nazw, korekty, niezweryfikowane twierdzenia, pliki/commity i artefakty.
3. Instrukcja startowa pokazywała tip `26bf13a839`, ale podczas raportowania tip przesunął się dalej. DEC-95 nakazuje nadal pracować z markerem; nie rebasowałem i nie scalałem obcych zmian.
4. Teza instrukcji o 11 ekranach, default OFF, zagnieżdżonym routingu i 2/5 pełnych powierzchni została potwierdzona. Nie obalono T1–T7.

## Commity i pliki

Commity:

- `03dca73409` — harness R1,
- `1448ad64d9` — komentarz R4,
- `e86a448a49` — dopisek R3.

Pliki względem markera:

```text
dev-render/main.tsx
dev-render/screens/day236-organizacja.tsx
docs/program/waves/WAVE_03_ACCEPTANCE/modules/01_ORGANIZATION/MODULE_ACCEPTANCE.md
src/utils/orgRedesignFlag.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY236_ORGANIZACJA_REPORT.md
```

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano realnego loginu przez pełny runtime ani realnego HTTP → ApiGateway → JWT → PostgreSQL, ponieważ ten dyżur jest screenshot/harness i nie zmienia backendu; pakiet jednostkowy nie jest przedstawiany jako taki dowód.
- Nie zweryfikowano, czy fixture Grafu wiedzy odpowiada retained DB Day85; zrzut Day236 używa jawnego, realistycznego `kgGetStats` z dev-render.
- Nie rozstrzygnięto `ORG-Q-001..007`; to jawnie pozostaje decyzją właściciela.
- Nie uzyskano werdyktu właściciela dla nowych 22 zrzutów. Stan pozostaje `OWNER_NOT_REVIEWED`.

## Rekomendacje dla nadzorcy

1. Poprawić osobno testy `src/utils/__tests__/orgRedesignFlag.test.ts`, które nadal kodują stary default ON; Day236 nie miał licencji zapisu do testów.
2. Skorygować `FUNCTIONAL_DOCUMENTATION.md` i `REKONESANS_ZAMKNIECIA_16_MODULOW.md` bez kasowania historii: flaga dziś istnieje, ale mismatch trwa przez realny default OFF i brak owner review.
3. Jeśli właściciel ma oceniać pełny happy path Goals/Challenges/Risks, przygotować osobną decyzję i fixture danych; nie nazywać dzisiejszych pustych zrzutów „full”.
