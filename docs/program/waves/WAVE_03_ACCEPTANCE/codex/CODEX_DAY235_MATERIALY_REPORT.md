# CODEX DAY 235 — MATERIAŁY — RAPORT

Data pomiaru: 2026-09-01  
Gałąź: `codex/day235-materialy-20260901`  
Baza wykonania: `e99e81301ac8c9cc9b945eb44b7365fa7ff055d6`  
Stan: **PARTIAL / MATERIAŁ DOWODOWY DOSTARCZONY; GEN-1…GEN-5 NIE SĄ ODEBRANE**

## 0. Wejście i izolacja

Wynik markera i sanity, dosłownie:

```text
INSTRUKCJA_MARKER_142686b772 OK
USER_MARKER_e99e81301a OK
e99e81301ac8c9cc9b945eb44b7365fa7ff055d6
```

Worktree: `/private/tmp/cx-day235-materialy`; baza: `cx-day235-pg`, wyłącznie `127.0.0.1:6183/cx235`; harness: `5154`, `5155` niewykorzystany. Porty były wolne. Dysk przed startem: 20 GiB, po migracjach: 18 GiB. Pierwsze migracje zakończone `Postgres migrations complete`; replay: `Applying migrations: 0`. Logi: `/private/tmp/cx-day235-materialy-artefakty/migracje-1.log`, `migracje-2.log`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## 1. Wynik pozycji

| Pozycja | Wynik | Dowód |
| --- | --- | --- |
| R1 — trzy powierzchnie + rejestr | `PROVEN_VISUALLY` | cztery realne komponenty, 8 zrzutów light/dark, zero błędów konsoli |
| R2 — architekt Word | `PROVEN_VISUALLY` | realny `DocumentStudioTemplateArchitectView`; widoczne rekordy `draft`, `approved`, `deprecated`; 2 zrzuty |
| R3 — karta modułu | `DONE_MEASURED` | dopisana sekcja `MODULE_ACCEPTANCE.md:178-183`; bez zmiany tabeli GEN-1…GEN-5 |
| R4 — komentarze Excele | `DONE_NO_RUNTIME_CHANGE` | wyłącznie `AppRoutes.tsx:347,1842-1843`; zero zmiany kodu wykonywalnego |
| R5 — koszt domknięcia | `DESCRIBED_NOT_DECIDED` | sekcja 5 poniżej |

Dane na wszystkich zrzutach pochodzą z **ręcznych fixture propsów/moków harnessu**, nie z realnego przebiegu generatora ani z ApiGateway/PG. Renderowane komponenty są produkcyjne; dane nie są dowodem jakości eksportowanych plików.

## 2. Tezy T1–T9

| Teza | Wynik pomiaru |
| --- | --- |
| T1 | potwierdzona: `GROUNDING_ACRONYM_RULE = 'allowed'`, commit `1e852c9fae` w historii |
| T2 | potwierdzona: `materializedBrief` trafia do mappera, który czyta `briefLines` |
| T3 | potwierdzona: oba wejścia importują i renderują `PresentationBriefModal` |
| T4 | potwierdzona po korekcie komendy: 9 `id:`; regex autora zwraca 8, bo `[a-zA-Z]*` nie obejmuje `cashflow12m` |
| T5 | potwierdzona: architekt jest montowany na zakładce `templates` |
| T6 | potwierdzona i skorygowana komentarzem: default ON od `fb119cefe8` |
| T7 | potwierdzona: 269 słów, K5 `FAIL` |
| T8 | potwierdzona: dyżur 195 zakończył się `EVIDENCE_MISSING`, cleanup usunął artefakt |
| T9 | potwierdzona: zero trafień `grounding` w `FeatureFlags.ts` |

Pełne wyjście komend: `/private/tmp/cx-day235-materialy-artefakty/blok0-pomiary.txt`.

## 3. Zrzuty, luma i SHA-256

| Powierzchnia | light / dark mean_luma | Różnica | SHA-256 light / dark |
| --- | ---: | ---: | --- |
| rejestr | 247.6 / 19.1 | 228.5 | `ec181c6b…82d2c` / `8570aafe…5cc99` |
| dokumenty | 243.2 / 47.6 | 195.6 | `676c5a08…01b29` / `77b82ca4…ff1ce` |
| prezentacje | 246.6 / 27.0 | 219.6 | `78f98a03…d83e` / `32330cad…3b8` |
| excele | 245.7 / 26.0 | 219.7 | `4403fea8…8a` / `7ab41b3e…8688` |
| architekt | 247.8 / 25.8 | 222.0 | `1efdece3…15a80` / `9f4aa795…d2c` |

Pliki: `/private/tmp/cx-day235-materialy-artefakty/day235-<powierzchnia>-<light|dark>.png`. Pełne sumy: `screenshots-sha256.txt`; pomiary: `mean-luma.txt`. Każda różnica przekracza wymagane 150.

## 4. Pomiar zasięgu testów nazwami

Komenda przed i po była identyczna: szeroki pakiet `server/src/services/documentStudio/__tests__ server/src/services/__tests__ server/src/routes/__tests__ dev-render/screens`, `RUN_DB_TESTS=0 MOCK_DB=true`, JSON reporter, `--retry=0`.

| Moment | Suit | PASS | FAIL | pending | pełnych nazw |
| --- | ---: | ---: | ---: | ---: | ---: |
| przed zmianami produktu/dokumentacji | 1244 | 3070 | 338 | 376 | 3792 |
| po | 1244 | 3069 | 339 | 376 | 3792 |

`diff przed-nazwy.txt po-nazwy.txt` ma 0 linii: żadna pełna nazwa nie doszła ani nie zniknęła. Jeden niezwiązany test Settings zmienił status PASS→FAIL w szerokim przebiegu; pojedynczy ponowny przebieg całego pliku `settings.routes.test.ts` z `--retry=0` zakończył się `exit 0`. Klasyfikuję to jako niestabilność szerokiego, współdzielonego pakietu, nie dowód regresji R1–R4; nie ukrywam czerwonego wyniku. JSON-y: `przed-pakiet.json`, `po-pakiet.json`, `settings-focused.json`.

Pułapki Z33: pakiet był czysto jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), więc nie jest dowodem realnego PG, auth ani ApiGateway. `ENABLE_V8_GLOBAL`, auth bypass i Results test mode nie są użyte jako twierdzenie o egzekucji. Excele default potwierdzono logiką `exceleFlag.ts`, nie komentarzem. Grounding potwierdzono stałą TS i testem historycznym, nie flagą.

## 5. Koszt domknięcia GEN-1…GEN-5 — bez rozstrzygnięcia

- `GEN-1` — wymaga zasadniczej poprawy jakości decków i ponownej oceny minimum trzech realnych PPTX rubryką; rodzaj pracy: przebudowa/kalibracja generatora i layoutów, nie kosmetyka harnessu.
- `GEN-2` — mechanika i D-8 istnieją, lecz K5 pozostaje czerwone; potrzeba kalibracji struktury i gęstości prozy, realnego DOCX oraz pełnej oceny rubryką.
- `GEN-3` — generator i 9 szablonów istnieją, ale brak formalnej oceny; potrzeba realnych XLSX z reprezentatywnej próbki, readbacku formuł i oceny rubryką, zanim zapadnie decyzja o zmianach.
- `GEN-4` — brief działa w dwóch wejściach, lecz residual `default → smart_layout` i niezmierzone wejścia pozostają; potrzeba domknięcia mappera tam, gdzie pomiar wykaże brak treści, oraz ponownej oceny realnego PPTX.
- `GEN-5` — architekt i lifecycle istnieją; brakuje dowodu end-to-end szablon→generator→realny DOCX ze znacznikiem oraz jakości rubrykowej. To pomiar i integracja istniejącej architektury, nie „budowa od zera”.

## 6. Korekty wobec instrukcji

1. Wiadomość użytkownika: `Marker: e99e81301a`; §0.1 instrukcji: `MARKER=142686b772`. Oba są przodkami tipa; `e99e81301a` jest nowszym commitem wydającym instrukcje 233–235. Zastosowałem bezpośredni marker użytkownika jako nadrzędny i nie rebasowałem.
2. §0 komenda T4 `grep -n "^  [a-zA-Z]*: {" … | wc -l` oczekuje 9, lecz zwraca 8. Dowód: lista `id:` ma 9 pozycji; klucz `cashflow12m` zawiera cyfry i nie pasuje do regexu. W raporcie wiążący jest własny pomiar 9.
3. Marker `e99e81301a` miał dwa zastane braki `},` w rejestrze `dev-render/main.tsx` (po wpisach day221 i day230), przez co cały plik nie parsował się. Dodałem wyłącznie brakujące zamknięcia w ramach licencji wpisów do rejestru; bez zmiany tych ekranów. Pozostaje zastany warning duplikatu klucza `document-studio-blocks-i18n`.
4. Pierwszy techniczny odczyt pamięci uruchomiłem z `workdir=/Users/piotrwisniewski/Developer/Consultify`, choć komenda czytała wyłącznie plik pamięci poza repo. Nie odczytałem ani nie zapisałem żadnego pliku checkoutu właściciela, ale samo ustawienie cwd było niezgodne z literalnym Z5; wszystkie dalsze komendy biegły z `/private/tmp`.
5. Pomiar „przed” nastąpił po dodaniu samych plików harnessu, ale przed R3/R4. Harnessy nie dodały testów; porównanie nazw wykazało identyczne 3792. Fakt ten pozostaje ograniczeniem chronologii, nie jest przedstawiany jako idealny baseline.

## 7. TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano jakości żadnego nowego realnego DOCX/PPTX/XLSX; dyżur nie wygenerował pliku klientowskiego.
- Nie zweryfikowano realnej ścieżki HTTP przez `ApiGateway`, JWT i PG dla generatorów, ponieważ R1/R2 były ekranami z fixture i nie zmieniały backendu.
- Nie zweryfikowano, czy `GEN-1…GEN-5` spełniają pełną rubrykę. Żaden generator nie otrzymuje statusu `PASS`, `FIXED` ani `VERIFIED`.
- Nie zweryfikowano Teresa/chat i historycznego redirectu dla GEN-4 ani jakości `default → smart_layout`.
- Nie zweryfikowano właścicielskiej akceptacji wizualnej; zrzuty są materiałem do takiej decyzji, nie decyzją.
- Nie zweryfikowano, że szeroki czerwony pakiet jest wolny od wszystkich regresji; wykazano wyłącznie identyczny skład nazw i brak trwałego faila w skupionym teście Settings.

## 8. Commity i push

- `67fab88756` — R1+R2, push po pierwszym commicie;
- `ea1f453e86` — R3;
- `11fd0c23f9` — R4.

Każdy commit wypchnięto wyłącznie na `github-backup/codex/day235-materialy-20260901`.
