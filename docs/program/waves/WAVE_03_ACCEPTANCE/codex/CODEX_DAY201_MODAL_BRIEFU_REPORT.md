# CODEX — dyżur 201 — modal briefu prezentacji

Data: 2026-08-31  
Marker bazowy: `60581ed6b5054e3218f7bc33d6e2a32794fb2af8` (`60581ed6b5`)  
Branch: `codex/day201-modal-briefu-20260831`  
Commit implementacji: `ae5069bc68c86224eb107c4385948905c6d7a62c`  
Worktree: `/private/tmp/cx-day201-modal-briefu`  
Zasoby wyłączne: PostgreSQL `127.0.0.1:6133`, backend `5076`, frontend `5077`

## Wynik

`PARTIAL / ZAKRES DYŻURU WYKONANY` — oba live wejścia prezentacyjne otwierają wspólny modal briefu przed nawigacją. `Dalej` przekazuje przycięty, zakodowany `templatePrompt`; `Pomiń` zachowuje dotychczasową nawigację bez promptu. Wejścia Excel/tabele/raport pozostają bez modala. Realna ścieżka `ApiGateway -> JWT -> PostgreSQL -> from-template -> SQL readback -> export PPTX` potwierdziła wpływ briefu na zawartość eksportu. GEN-4 pozostaje `PARTIAL`, bo nie mierzono ścieżki Teresa/chat ani historycznego redirectu, a znany przypadek `content/default -> smart_layout` pozostaje poza zakresem.

## Zakres zmiany

- Jeden kontrolowany komponent `PresentationBriefModal`, wspólny dla `ArtifactModuleHome` i `TemplatesTabContent`.
- `ArtifactModuleHome`: modal tylko dla kart API w lane `prezentacje`; wbudowany `promptOverride`, Excel i tabele zachowują poprzednią semantykę.
- `TemplatesTabContent`: wszystkie sześć callsite'ów użycia szablonu przechodzi przez jeden handler; modal tylko dla typu `presentation` i ścieżki `/prezentacje?...`.
- Nowe klucze PL/EN w `public/locales/{pl,en}/translation.json`; oba JSON-y poprawne (`jq empty`).
- Backend i serwer bez zmian.

## Inwentaryzacja przed zmianą

- `ArtifactModuleHome` nawigował bezpośrednio do `/prezentacje?templateId=...`.
- `TemplatesTabContent` miał sześć wywołań użycia szablonu.
- `PrezentacjeView` już mapował `templatePrompt` na body `brief`.
- Test historycznego redirectu istnieje w commicie `0f9f98cfc3`; świeży bieg z `--retry=0` dał oczekiwane `2 failed / 2 total`.
- Korekta tezy: trafienie grepem w `src/routes/AppRoutes.tsx` jest definicją trasy, nie dodatkowym live wejściem UI.

## Testy i mutacja

Nowe pełne nazwy testów (`--retry=0`):

1. `ArtifactModuleHome presentation brief modal opens before navigation and Next carries the trimmed encoded brief`
2. `ArtifactModuleHome presentation brief modal Skip preserves the previous template-only navigation`
3. `ArtifactModuleHome presentation brief modal excele keeps immediate navigation without a modal`
4. `ArtifactModuleHome presentation brief modal tabele keeps immediate navigation without a modal`
5. `TemplatesTabContent presentation brief modal opens before presentation navigation and Next appends the encoded brief`
6. `TemplatesTabContent presentation brief modal Skip preserves the previous presentation template path`
7. `TemplatesTabContent presentation brief modal report templates navigate immediately without the modal`

Wynik nowych testów: `7 passed / 7 total`.

Mutacja obowiązkowa:

- po czasowym przywróceniu bezpośredniej nawigacji w `ArtifactModuleHome`: `2 failed / 4 total`;
- po czasowym przywróceniu bezpośredniej nawigacji w `TemplatesTabContent`: `2 failed / 3 total`;
- po odtworzeniu implementacji: `7 passed / 7 total`.

Pełne suite'y przed/po (`tests/components/AIChat/KimiWorkspace` i `tests/components/ReportsAndPresentations`, `--retry=0`, JSON):

| Pomiar | Suite | Testy | Wynik |
| --- | ---: | ---: | --- |
| przed | 55 | 129 | 103 passed, 26 failed |
| po | 59 | 136 | 110 passed, 26 failed |

Diff pełnych nazw zawiera dokładnie siedem nowych nazw powyżej; nie ubył żaden test, a liczba istniejących failures nie wzrosła. Targetowany `tsc` nie wykazał błędów w zmienionych plikach. `git diff --check` czysty.

## Dowód R3 — realny Gateway/JWT/PostgreSQL/PPTX

- PostgreSQL: `127.0.0.1:6133/cx201`, migracje `870`; powtórka: `Applying migrations: 0`.
- Realny `ApiGateway` z `initializeRoutes`, realny JWT i tenant fixture.
- Utworzenie i zatwierdzenie szablonu, następnie `POST .../from-template`: HTTP `201`.
- Brief zawierał świeże fakty: `PLN 4.9m`, `27 October` oraz unikalny znacznik Day201.
- SQL readback potwierdził zapis decku; eksport: HTTP `200`.
- PPTX: `/private/tmp/cx-day201-modal-briefu-artefakty/day201-template-brief.pptx`, `88 948 B`, SHA-256 `d402ed91e0c8e111d78c203cb7373a5ef9281ecb5862b0e80bdd4b2e53c5af9b`.
- `unzip -t`: brak błędów. Render trzech slajdów: `slides_test.py` — `Test passed. No overflow detected`.
- Oględziny: `PLN 4.9m`, `27 October`, owner Finance i znacznik są widoczne; brak widocznych kolizji. `Key point`: nieobecny dla testowanych intencji.
- Dwie pierwsze próby harnessu ujawniły obcięcie znacznika przez mapper; asercję skorygowano do realnej semantyki mapowania. Po wyniku proces harnessu wymagał `Ctrl-C` z powodu pozostawionych timerów/poola — to residual teardown, nie błąd HTTP/readback/eksportu.

## Dowód wizualny live UI

Kanoniczny runtime uruchomiono na commicie `ae5069bc68`, lokalnej bazie dyżuru i portach `5076/5077`. Health, ready i frontend zwróciły `200`, a build SHA był zgodny. W pełnym produkcie lokalnym potwierdzono:

- `ArtifactModuleHome -> prezentacje`: pusty modal, przyciski `Pomiń` i `Dalej`, motyw jasny i ciemny;
- `Template Library -> Day 201 Visual Template -> Row actions -> Use template`: ten sam modal w motywie jasnym.

Artefakty: `modal-light.png` (SHA-256 `c3305826be058327e70f6a34770f0989dec82abb57584e77c0d2fcf5a05ab547`) oraz `modal-dark.png` (SHA-256 `65f3681648f9c15e01faff16c70d933136ae11189f2d8c4ee583b4aebd908ce5`). Runtime zatrzymano kanonicznym skryptem: procesy należące do dyżuru zakończone, baza runtime usunięta, katalog katalogowy nieobecny, porty wolne.

## Bezpieczeństwo i deklaracja komunikacyjna

Przed testami: `BRAK ZMIENNYCH POCZTY`; w bazie dyżuru `0` wierszy konfiguracji SMTP. Nie uruchamiano Railway, zdalnej bazy ani LLM.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## Twierdzenia niezweryfikowane

- Nie wykonano ścieżki Teresa/chat ani historycznego bookmark/redirect — poza zakresem licencji dyżuru.
- Nie wykonano środowiska demo/produkcyjnego; dowód jest lokalny i oparty o realny PostgreSQL/Gateway/JWT.
- Nie twierdzę, że znany przypadek `content/default -> smart_layout` został naprawiony.

