# P13-A — raport Karty N: Moja Praca / Wywiad / Inicjatywy

Data: 2026-09-10  
Baza: `29992c920bd451018ee25712e49c3ba7e0297e5c`  
Gałąź: `codex/p13a-karty-n`

## Wynik

Implementacja kodowa DEC-432/433/434/442/443 jest zapisana w commitach poniżej. Bramka odbioru
na żywo pozostaje **BLOCKED — AWARIA STANOWISKA**: `127.0.0.1:4100` odrzuca połączenie, a wymagany
katalog `/private/tmp/stanowisko-noc` (wraz z `auth.json` i `server.env`) nie istnieje. Zgodnie z
instrukcją nie utworzono rekordu inną drogą i nie podstawiono zrzutów z harnessu za realne trasy.

## K1–K30: przed → po

| karta | K1–K5 sekcje | K6–K16 powłoka/panel/Menu 5 | K17–K20 czytelność | K21–K24 AI | K25–K30 trasa/odbiór | zrzut | SHA |
|---|---|---|---|---|---|---|---|
| Zadanie | flaga i lista lokalna → kontrakt zawsze, adapter SSOT | bez zmiany zachowania | tokeny c-* | wspólne AI zachowane | runtime BLOCKED | brak — awaria stanowiska | `b4aa0c35c1` |
| Decyzja | flaga i lista lokalna → kontrakt zawsze, adapter SSOT | bez zmiany zachowania | tokeny c-* | wspólne AI zachowane | runtime BLOCKED | brak — awaria stanowiska | `a64e6e9b16` |
| Powiadomienie | flaga/lista → kontrakt zawsze; puste AI ukrywane | TeresaMark usunięty | tokeny c-* | wspólne AI zachowane | runtime BLOCKED | brak — awaria stanowiska | `11bdecfa32` |
| Wniosek | `INSIGHT_SECTIONS` → adapter kontraktu | bez zmiany zachowania | tokeny c-* | wspólne AI zachowane | runtime BLOCKED | brak — awaria stanowiska | `850ac9ae61` |
| Sesja wywiadu | lokalna lista → członkostwo/nazwy/ikony/kolejność z kontraktu; sekcje bez danych ukryte | istniejąca powłoka/Menu 5 | tokeny c-* | rubryka uzupełniona | runtime BLOCKED | brak — awaria stanowiska | `c49b7f8c9b`, `129427dc2a` |
| Inicjatywa | flaga → kontrakt zawsze; board składany z deskryptorów kanonicznych | istniejący panel/Menu 5 | tokeny c-* | istniejące AI zachowane | runtime BLOCKED | brak — awaria stanowiska | `914a5c8637`, `2269b204e9` |
| Pomysł — 4 centra | lokalne wejście AI/Teresa → jedno `Pracuj z AI`; przycisk narożny AI usunięty | wspólna powłoka centrów zachowana | tokeny c-* | propozycje nadal trafiają do `IdeaProposalReview`; zapis dopiero po akceptacji | runtime BLOCKED | brak — awaria stanowiska | `5f309498f3`, `89913d900f` |
| Wzorzec wywiadu | ręczny układ → sekcja w `StandardArtifactShell` | dodane powłoka, prawy panel, Menu 5 | zero nowych `primary-*` | 3 przyciski w trybie dokumentu → jedno `Pracuj z AI`; neutralne AI bez Teresy | runtime BLOCKED | brak — awaria stanowiska | `c03c95d27e`, `8e7717fc5d`, `f772dffe0d` |
| Karta działania | brak kontraktu → 4 sekcje klasy S | pełna powłoka i panel | tokeny c-* | rejestr, rubryka i `Pracuj z AI`; propozycja → Zatwierdź | dodane GET i `/action-cards/:id`; rekord/runtime BLOCKED | brak — awaria stanowiska | `22de4c7e17`, `164f037d60`, `f772dffe0d` |

Legenda: kolumna grupuje wymagania K1–K30 z SSOT. Brak zrzutu oznacza, że K29–K30 nie są
zaliczone; nie jest to zastępowane wynikiem kompilacji.

## Dowody testowe

- Stan przed zaakceptowany przez właściciela: 53 zielone, 0 czerwonych.
- Testy celowane po zmianie: 4 pliki, 19 testów zielonych, 0 czerwonych.
- Mutacja sekcji: dodatkowe id poza kontraktem rzuca `SEKCJE_POZA_KONTRAKTEM` — RED.
- Mutacja AI: oczekiwanie zapisu bez „Zatwierdź” — RED; test zachowania potwierdza zero wywołań
  writera przed zatwierdzeniem i dokładnie jedno po zatwierdzeniu.
- Esbuild zmienionych ciężkich plików (`InterviewWorkspace`, `InitiativeDocumentView`,
  `TemplateBuilder`, `IdeaMapWorkspace`, `ActionCardPage`, `AppRoutes`) — exit 0.
- Pełny TypeScript serwera, wymagane polecenie z limitem 3072 MB — exit 0.
- Frontend `npx tsc --noEmit -p tsconfig.json` — OOM przy domyślnym limicie. Powtórzenie z 8192 MB
  zakończyło analizę i wykazało zastane błędy poza zakresem; filtr zmienionych plików po poprawkach
  zwrócił 0 błędów P13-A. Zgodnie z instrukcją dowodem dla zmienionych plików jest esbuild.

## Bramka stanowiska i rekord pokazowy

Nie wykonano zapisu danych. Próba `GET http://127.0.0.1:4100/api/health` zakończyła się
`curl: (7) Failed to connect`; nie istnieje wymagany plik sesji. Dlatego nie dało się bezpiecznie:

1. znaleźć/utworzyć odchylenia KPI przez kontrakt `recovery-card`,
2. zapisać identyfikatora realnej karty działania,
3. wykonać zrzutów 1440 light z realnych tras,
4. potwierdzić `url != /login` i `bledyKonsoli = 0`.

Do zamknięcia P13-A potrzebne jest odtworzenie tego samego stanowiska: API na 4100 oraz
`/private/tmp/stanowisko-noc/auth.json`. Po odtworzeniu należy wykonać wyłącznie cztery kroki z tej
sekcji; kod i testy lokalne są zapisane na gałęzi.

## Commity

Pełny łańcuch od bazy jest dostępny przez `git log 29992c920b..codex/p13a-karty-n`. Commity są
rozdzielone per karta/moduł i zawierają wymagane znaczniki odmrożenia; nie wykonano push.
