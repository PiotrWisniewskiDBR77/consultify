# Modul 17 — proba domkniecia jednym przebiegiem realnego modelu (31.08.2026)

Galaz: `proof/modul17-real-model-20260831` (worktree `/private/tmp/cx-m17proof`,
z vaulta `github-backup/codex/m03-admin-20260824`, tip `d97d924cc9`).
Baza: lokalny Postgres w kontenerze Docker (`cx-m17proof-pg`, port 6499),
posprzatany po zakonczeniu proby.

## KROK 1 — przygotowanie bez modelu (WYKONANE, PASS)

1. `server/src/services/ai/__tests__/fix217.vaultProjectNameContract.pg.test.ts`
   (juz scalony test bezposredniej sciezki `executeToolCall`) — uruchomiony na
   swiezej lokalnej bazie: **6/6 PASS**. Potwierdza kontrakt na poziomie
   narzedzia: `vault_project_id` podane jako NAZWA rozwiazuje sie wylacznie w
   obrebie organizacji wolajacego, fail-closed przy 0 i >1 trafien, UUID nadal
   dziala.
2. Nowy test `tests/integration/m17-mockmodel-http-probe.realdb.test.ts`
   (atrapa `AIPipeline`, wzorzec z `day217-gf-agt-02.realdb.test.ts`) —
   przepuszcza wywolanie `search_knowledge_base` z argumentem
   `vault_project_id` = NAZWA projektu przez PELNA sciezke HTTP
   (JWT -> ApiGateway -> `/api/ai/chat/stream` -> atrapa pipeline'u -> realny
   `executeKBSearch` -> realny Postgres) — **PASS**: status 200, niepuste
   `events`, tresc odpowiedzi zawiera znacznik z bazy wiedzy.

Bramka wejsciowa do KROKU 3 spelniona: plumbing dziala od routingu HTTP po baze,
bez atrapy modelu.

## KROK 3 — JEDEN przebieg realnego modelu (WYKONANY)

Klucz z `~/.consultify-openrouter`. Uruchomiony
`server/scripts/day217-real-model-probe.ts` (samodzielny, `tsx`, poza
vitest/`tests/setup.ts`), model wybrany platformowo: `openrouter/openai/gpt-4o`
(tier BUDGET). Fixture: swieza organizacja `ORG_SETUP_COMPLETED`, uzytkownik,
czlonkostwo ACTIVE, projekt `Day217 R3 project`, dokument w bazie wiedzy z
unikalnym znacznikiem `ZNACZNIK-DAY217-R3-36ff422f` utworzony realna sciezka
`POST /api/document-studio/generate`.

Prompt (naturalny, bez dyktowania argumentow narzedzia):
> „Co wiadomo o dokumencie zatytulowanym „Day217 R3 probe topic
> ZNACZNIK-DAY217-R3-36ff422f”? Sprawdz dostepne materialy i podaj
> najwazniejszy szczegol.”

### Wynik bramki

| Punkt | Wynik | Dowod |
|---|---|---|
| (a) niepusta lista krokow, model sam decyduje | **PASS** | ON: `toolSteps=2` (`search_knowledge_base` running+completed), wywolane bez dyktowania argumentow. OFF (`ENABLE_TERESA_TOOL_LOOP=false`): `toolSteps=0` |
| (b) unikalny znacznik z bazy wiedzy w odpowiedzi modelu | **FAIL** | patrz nizej |
| (c) ta sama fraza przy flagach OFF = zero krokow | **PASS** | OFF: `toolSteps=0`, `markerPresent=false` (kontrola negatywna czysta) |

### Argument wywolania narzedzia (przechwycony z logu serwera, nie z SSE)

```
[ToolExecutor] Executing tool: search_knowledge_base
args: {"query":"Day217 R3 probe topic ZNACZNIK-DAY217-R3-36ff422f","document_type":"all","vault_scope":"organization"}
```

**Model NIE podal `vault_project_id` w ogole tym razem** — wybral
`vault_scope: "organization"` zamiast `"project"`. To NIE jest ten sam ksztalt
bledu co w dyzurze 217 (tam: `vault_project_id` = NAZWA zamiast UUID przy
`vault_scope: "project"`). Naprawiony kontrakt nazwa->UUID nie zostal w ogole
wywolany na tej sciezce — model obszedl potrzebe podania `vault_project_id",
wybierajac szerszy zakres wyszukiwania.

Retrieval faktycznie cos znalazl (log: `RagService BM25 results: 1, Vector
results: 2` — dokument prawdopodobnie zostal dopasowany po tytule/tresci).
Mimo to **odpowiedz modelu nie zawiera doslownie znacznika**
`ZNACZNIK-DAY217-R3-36ff422f`. Pelna tresc odpowiedzi (ON):

> „The document titled "Day217 R3 probe topic ZNACZNIK-DAY217-R3-36ff422f" is
> an executive memo intended for internal use. It appears to be concise and
> written in a consulting style, aimed at informing its audience. However, it
> currently lacks content in critical sections like the key message,
> findings, and recommendations, indicating that these areas are pending
> completion or further development.”

Model PARAFRAZUJE opis dokumentu (poprawnie identyfikuje typ/tytul — znacznik
pojawia sie WYLACZNIE w powtorzonym tytule z promptu, nie jako cytat z tresci
dokumentu) zamiast zacytowac fragment tresci zawierajacy znacznik. Tresc
dokumentu wygenerowana przez `useLlm:false` w `document-studio/generate` jest
najprawdopodobniej pusta/szablonowa (stad „lacks content in critical
sections” — to trafny opis PUSTEGO dokumentu, nie halucynacja) — sam znacznik
zyje wylacznie w TYTULE, ktory model odbil z promptu, a nie z realnie
przeczytanej tresci zwroconej przez narzedzie.

### Koszt tury (zmierzony)

- ON: 2 kroki narzedziowe x `costUsd=0.01` = **$0.02** (koszt narzedzia
  raportowany przez `TeresaToolLoop`); czas tury 4386 ms.
- OFF: 0 krokow narzedziowych, czas tury 1698 ms.
- Pelny koszt tokenow OpenRouter (poza kosztem narzedzia) nie byl osobno
  zmierzony przez ten skrypt — brak dedykowanego licznika w probie.

### Artefakty (skopiowane przed jakimkolwiek sprzataniem)

- `evidence-modul17/day217-real-model.json` — pelny obiekt wyniku (fixture,
  prompt, znacznik, ON/OFF ze wszystkimi eventami SSE).
- `evidence-modul17/real-model-run.log` (+ `.bak`) — surowy log serwera
  (w tym przechwycony argument `vault_scope`/brak `vault_project_id`).

## KROK 4 — STOP (budzet wyczerpany)

Punkt (b) nie zostal spelniony w tym jedynym dozwolonym przebiegu. Zgodnie z
zasada „jeden przebieg" — **nie ma drugiej proby**. Modul 17 **NIE MOZE** byc
ogloszony zamknietym na podstawie tego dowodu.

### Co konkretnie zostalo do zrobienia

1. **Bramka (b) tak jak zdefiniowana (doslowny substring znacznika w
   odpowiedzi modelu) jest krucha wobec parafrazy.** Model, gdy dokument jest
   pusty/szablonowy, opisuje go opisowo zamiast cytowac. Nalezy albo:
   (i) zasilic dokument realna trescia zawierajaca znacznik w SRODKU zdania
   (nie tylko w tytule) tak, aby zacytowanie bylo naturalna odpowiedzia na
   pytanie o „najwazniejszy szczegol”, albo
   (ii) zmienic kryterium bramki (b) na tresciowe/semantyczne zamiast
   doslownego stringu, co wymaga decyzji wlasciciela — to zmiana kryterium
   odbioru, nie kod.
2. **Kontrakt nazwa->UUID (FIX-217, `toolDefinitions.ts`) nie zostal w ogole
   wywolany na zywo w tym przebiegu** — model wybral `vault_scope:
   "organization"` i pominal `vault_project_id`. Dowod na dzialanie tej
   konkretnej sciezki na zywym modelu (nie tylko w tescie z atrapa) nadal nie
   istnieje. Test `fix217.vaultProjectNameContract.pg.test.ts` dowodzi
   kontraktu deterministycznie (BRAMKA 4), ale to nie jest dowod „zywy model
   sam tak wywolal”.
3. Kolejna proba (poza budzetem tego dyzuru) powinna albo silniej
   ukierunkowac prompt na scenariusz project-scoped (np. pytanie jawnie o
   dokumenty „w tym projekcie”), albo zaakceptowac, ze bramka (a)+(c) sa
   wystarczajacym dowodem na autonomiczne siegniecie po narzedzie, a punkt
   (b) wymaga osobnej, tanszej metody dowodu (np. test z atrapa modelu ale
   asercja na tresc zwrocona przez `executeKBSearch`, nie na parafraze
   modelu) — to jest dokladnie to, co KROK 1 juz dowodzi.

## Sprzatanie

- Kontener `cx-m17proof-pg` zatrzymany i usuniety (`docker rm -f -v`).
- Worktree pozostawiony do przegladu przez wlasciciela pod
  `/private/tmp/cx-m17proof` (galaz `proof/modul17-real-model-20260831`,
  wypchnieta WYLACZNIE do `github-backup`, nie do `origin`/demo/staging/
  produkcji/Railway).
