# CODEX DAY 375 — KARTY PROPOZYCJI W CZACIE — DOMKNIĘCIE

Data: 2026-09-05

Marker: `8f60ab998734adcdf61a080f4e1270c3dbdffceb`

Gałąź: `codex/day375-karty-domkniecie-20260905`
Werdykt: **R1 ODTWORZONY · R2 NAPRAWIONY · R3 NAPRAWIONY · PARTIAL wobec osobnego realnego HTTP/JWT/PG dowodu kwitu adopcji**.

## R0 — wejście i twarde zasady

Przeczytałem instrukcję wydaną z vaulta do EOF (1172 linie) przed utworzeniem worktree. Nie przyjąłem hipotezy o backendzie Teresy bez własnego grepa. Test R2 asertuje zachowanie po prawdziwym remoncie z tym samym zamrożonym propem. Mutacje R1, R2 i R3 celowały w linie odpowiedzialne za zachowanie i zostały cofnięte przez `cp`, bez `git stash`. Mianownik porównuję pełnymi nazwami, a nie samą liczbą testów.

Warunki wejścia: 41 GiB wolne przed materializacją i 33 GiB po materializacji; porty 6446 i 5586 bez procesu LISTEN; brak kontenera `cx-day375-pg`; `MARKER OK`.

Dosłowny wynik kroku markera:

```text
ba8e018672 merge: wskazanie źródła wyceny — endpoint powiązania + chooser (decyzja właściciela 05.09)
18b27b19c8 feat(finanse): wskazanie źródła wyceny — endpoint powiązania Baseline/Scenariusz→Wycena + chooser w zakładce Źródło (decyzja właściciela 05.09)
2fe54a0844 merge: neutralny CTA w modalu nowej oceny (kanon, bez crimson)
597a24b30e fix(ocena): neutralny CTA w modalu nowej oceny — koniec crimson gradientu (kanon)
ca7aa8a33a merge: pole Jednostka w formularzu nowej oceny + skrypt uzupełnienia (decyzja właściciela 05.09)
ba85bb465a merge: D-01 potwierdzona — usunięcie martwego UnifiedCreateLauncher
2e138a8fdd feat(ocena): pole „Jednostka” w formularzu nowej oceny + skrypt uzupełnienia jednostek DBR77 (decyzja właściciela 05.09)
50c0fbd632 chore(wywiad): usunięcie martwego UnifiedCreateLauncher — D-01 potwierdzona przez właściciela 05.09
f655d076e6 docs(mvp): sekcja E — 12 decyzji właściciela ze strony 3100 (05.09) + skutki i fala 2
fd44e23d92 mvp-final: zamrożenie modułu 13_CHAT (decyzja właściciela 05.09, strona 3100)
6326ee0544 merge: runda 5 odbioru — szuflada węzła mapy myśli przez portal (Dodaj dowód klikalny)
7c6c898f29 fix(mindmap): szuflada węzła nad szyną inspektora — przycisk „Dodaj dowód” klikalny (runda 5 odbioru)
5cdc947d9f docs(dyzury): instrukcje 374-377 — domkniecia po odbiorze 367-373 (i18n reszta, karty, akcje-zrzut-porzadki, governed connect)
86450cd275 evidence(odbior): rundy 3-5 odbioru MVP 05.09 — wyniki.json, RUNDA3.md, zrzuty, dowody napraw
d8d03863da fix(chat): strażnik typu dla kickoffu ze store po scaleniu 368 — 37 czerwonych w UnifiedChatPanel.test (content.trim/clearChatKickoffMessage) → 4 zastane
8f60ab9987 Merge codex/day373-duplikaty-martwe-20260905 — odbior adwersaryjny 05.09
7b787d849f Merge codex/day372-i18n-czat-20260905 — odbior adwersaryjny 05.09
18789b3b44 Merge codex/day368-przewody-chat-20260905 — odbior adwersaryjny 05.09
0037419a1b Merge codex/day371-karty-propozycji-20260905 — odbior adwersaryjny 05.09
4773ff2699 Merge codex/day369-chmura-oauth — odbior adwersaryjny 05.09
6ff2a97f9a Merge codex/day370-akcje-wiadomosci — odbior adwersaryjny 05.09
82bdebcd2d Merge codex/day367-kanwa-ai — odbior adwersaryjny 05.09
c5496102bf feat(odbior): /decyzje v2 — Akceptuję / Do poprawki + uwaga na każdej karcie
1359f1e141 merge: runda 3 odbioru — nazwiska zamiast UUID, pasek akcji wyceny i OKR
4b3198fafc fix(ui): nazwiska zamiast UUID w rodzinie + pasek akcji wyceny i OKR
MARKER OK
```

Dosłowny sanity:

```text
8f60ab998734adcdf61a080f4e1270c3dbdffceb
```

`status --short | head -3` nie wypisał żadnej linii. Tip bazowy był do przodu; wykonano wymagane `log` i `diff --name-only`, bez rebase i bez scalania.

## Bezpieczeństwo wysyłki

`env`: `BRAK ZMIENNYCH POCZTY`; grep `Gateway.ts`: `ZERO_DRENAZY_W_GATEWAY`; po migracjach zapytanie `settings WHERE key LIKE 'smtp%'`: `(0 rows)`.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R1 — DOWÓD ODTWORZONY

Kontener `cx-day375-pg`, `pgvector/pgvector:pg16`, baza `cx375`, port `127.0.0.1:6446`. Migracje: `Applying migrations: 897`, potem `Applying migrations: 0`.

| Artefakt | numPassedTests | numFailedTests | status | SHA-256 |
| --- | ---: | ---: | --- | --- |
| `r1-green.json` | 1 | 0 | `passed` | `993f1d645ca784a53fc06a9a53418de52241dba4caa58cb3a3e001d56fff639b` |
| `r1-mutation-red.json` | 0 | 1 | `failed` | `b3f2ba9040a2fd36ec0278c1b8f7add95b7a233b91e9efdfa7235b7086814d3e` |
| `r1-restored-green.json` | 1 | 0 | `passed` | `a588e1e6688d50cf53f358b7668ffec416f1e1264822e178cff4ac7637132755` |

Pełna nazwa: `Day371 schema proposal execute conflict through real ApiGateway and PostgreSQL returns 200 once, then typed 409 without changing resolved_at again`. Mutacja: `expected 500 to be 409`. Po przywróceniu obu plików produktu diff był pusty.

Komenda z roota zebrała 0 testów i została odrzucona. Dwa czyste restored przy 60 s dały `skipped`; jedyna zmiana pg-testu to timeout `beforeAll` 60 s → 120 s, bez zmiany asercji. Pułapki wyłączono przez komplet env w tej samej linii, `ENABLE_TEST_AUTH_BYPASS=false`, `ENABLE_V8_GLOBAL=true`, `DB_TYPE=postgres`, `--retry=0` i inspekcję JSON zamiast exit code.

## R2 — SPÓR BACKENDU ROZSTRZYGNIĘTY

Akcje Teresy prowadzą przez `server/src/routes/v8/teresa.routes.ts:43,215` do `teresaCopilotService`; grep `workCanvasService` zwrócił `ZERO_WORKCANVAS_W_TERESA_ROUTES`. Wynik zgadza się z instrukcją i przeczy `ODBIOR_371.md`.

`Api.getTeresaProposal` już istniało na markerze w `src/services/api.ts:2522-2531`; dlatego `api.ts` pozostał nietknięty. Test używa identycznego `staleProposal` w obu mountach i mocka `completed`. RED: nowa nazwa failed, rodzina 5/2. GREEN: nowa nazwa passed, 6/1 (zastany R3). Mutacja: 5/2; restored: 6/1. Cztery chronione przypadki i stary przypadek Teresy pozostały `passed`; zero nazw zniknęło. Jawny `getTeresaProposal: vi.fn()` z `mockResolvedValue` wyłącza pułapkę undefined; asercja sprawdza DOM i wywołanie API.

## R3 — WERDYKT I DLACZEGO

**NAPRAW.** Producent i flaga są żywe (`UnifiedChatPanel.tsx:815,2320-2345`; `FeatureFlags.ts:35,166`; bramka `initiativesExecutionRuntime.routes.ts:1820-1822`). POST zachowuje `clientRequestId` (`:1853-1866`). GET znajduje kwit (`:4692-4705`), wymaga `initiative.view` (`:1312-1326,4706-4707`), daje `CONFIRMED` dla wersji agregatu co najmniej równej wersji kwitu (`:4708-4724`), a brak kwitu/uprawnienia daje `404` (`:4728-4730`). Mount: `initiatives.routes.ts:154-156`.

RTL mierzy 404 przed adopcją → odczyt draftu → POST `chat-draft-adopt:initiative-1` → remont → `CONFIRMED`/`Adopted`; `initiative-hidden` dostaje 404 i pozostaje `Awaiting consent`. URL koduje dwukropek jako `%3A`, JSON POST zachowuje logiczne ID. Wynik: 7/7; mutacja starego komponentu: 6/7 i zero read-back; restored: 7/7.

Dodatkowa próba generycznego RealPG testu autoryzacji nie jest dowodem: 0 pass / 1 fail / 14 skipped przez zastany `TRUNCATE` bez `CASCADE`. Nie zmieniono nielicencjonowanego testu. Autoryzacja jest dowiedziona źródłowo, reakcja karty dopuszczonym RTL; osobny ApiGateway/JWT/PG read-back kwitu adopcji pozostaje **NOT PROVEN**. Flaga nadal default OFF, fetch ma `credentials:'include'`, 404 jest fail-soft, nie dodano endpointu ani flagi.

## Mianowniki i bramki PRZED → PO

- PL `35294 → 35294`, EN `33154 → 33154`;
- `focus=0 → 0`, `list=0 → 0`, `artefakt=0 → 0`;
- `reach=1 → 1`; diff list `reach-przed.txt`/`reach-po.txt` pusty;
- rodzina: 6 nazw przed, 7 po; dodano tylko test live statusu Teresy; zero nazw zniknęło; finał 7/7;
- `CaseIntakeConfirmCard.tsx`, `MessageRenderer.tsx` i wszystkie `MODULE_ACCEPTANCE.md`: diff pusty.

## Korekty wobec instrukcji

1. `§0.3(3)` oczekiwał 0 `getTeresaProposal`; pomiar dał gotowy wrapper w `api.ts:2522-2531`. Użyto go bez duplikatu.
2. R1 z roota i `--config server/vitest.config.ts` zebrał 0; poprawny runner wymagał `cwd=server`, lokalnego configu i ścieżki `src/routes/...`.
3. Timeout 60 s dwukrotnie dał pending/skipped; 120 s dał 1 passed bez zmiany asercji.
4. 5 GREEN / 1 RED na wejściu, słowniki, bezpieczniki i zastany `reach=1` potwierdzono.
5. Tip uciekł do przodu; praca pozostała dokładnie na markerze.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano pełnego ApiGateway → JWT → RealPG `CONFIRMED/404` dokładnie dla kwitu `chat-draft-adopt:*`.
- Nie wykonano przeglądarkowego F5 ani zrzutów; RTL nie dowodzi produkcyjnego renderu ani akceptacji właściciela.
- Nie włączono flagi na wdrożeniu; nie wykonano deploymentu, Railway ani połączeń zdalnych.
- Nie dowiedziono integracji z najnowszym tipem; scalenie należy do nadzorcy.

## PYTANIA DO WŁAŚCICIELA

Czy `GovernedInitiativeHandoffCard` (przekazanie inicjatywy z czatu do realizacji) ma w ogóle wejść do produktu z domyślnie włączoną flagą w najbliższym czasie, czy zostaje wyłączona do dalszych decyzji?

## Commity — `git show --stat`

```text
407e2be0d4 test(chat): odtwórz dowód konfliktu 409 dla dyżuru 375
 evidence/day375-karty-domkniecie/R1-realpg-conflict.md       | 12 ++++++++++++
 .../__tests__/day371.chatToSchema.executeConflict.pg.test.ts |  2 +-
 2 files changed, 13 insertions(+), 1 deletion(-)

bb6eb31b22 fix(chat): odśwież stan propozycji Teresy po remoncie
 .../R2-teresa-live-status.md                            | 11 +
 src/components/AIChat/TeresaProposalCard.tsx           | 18 +
 .../day371.proposalFamily.remount.test.tsx              | 17 +
 3 files changed, 46 insertions(+)

6d90f00e48 fix(chat): odczytaj kwit adopcji inicjatywy po remoncie
 .../R3-initiative-readback.md                           | 12 +
 .../GovernedInitiativeHandoffCard.tsx                   | 24 +-
 .../day371.proposalFamily.remount.test.tsx              | 76 +-
 3 files changed, 108 insertions(+), 4 deletions(-)
```

Surowe JSON-y, logi migracji, pełne nazwy i listy reach: `/private/tmp/cx-day375-karty-domkniecie-artefakty/` (poza repo, Z13).
