# CODEX DAY 117 — STATUS AI

Data: 2026-08-29  
Gałąź: `codex/day117-status-ai-20260829`  
Baza: `eecf2c1dae434bb1f1fb68a72094825e317bc5ea`  
Stan: `FIXED` dla kontraktu API statusu dostawców; `PARTIAL / NO_CONSUMER` dla ekranu System Health.

## 0. Wiązanie instrukcji i stan wejściowy

Wklejka podała marker `332fa1c161`, ale wydana instrukcja wskazała marker
`eecf2c1dae434bb1f1fb68a72094825e317bc5ea`; zgodnie z poleceniem wiążąca była
instrukcja. Tip gałęzi był do przodu o cztery commity (`332fa1c161`,
`b03936face`, `2c3825cdb3`, `9b020b5cf7`), więc worktree powstał dokładnie z
markera.

Dosłowny wynik markera i sanity:

```text
MARKER OK
eecf2c1dae434bb1f1fb68a72094825e317bc5ea
```

Warunki STOP: `/` miał `40Gi` wolnego; porty `5999`, `4898`, `4899` były
wolne. Katalog właściciela nie był czytany ani modyfikowany; użyto wyłącznie
dozwolonego symlinku `node_modules`.

## 1. K1 — pomiar defektu przed zmianą

`server/src/controllers/SuperAdminController.ts:3495-3512` uznawał status za
`online` tylko dla OpenAI albo Anthropic i zwracał mapę OpenAI, Anthropic,
Groq. Nie zawierał OpenRouter ani Google.

`server/src/services/ai/llmConfigService.ts:278-311` ustala domyślną allowlistę
synchronizacji jako jednoelementowy zbiór `openrouter`. Defekt z instrukcji
został potwierdzony własnym greptem.

Fixture statusu nie wypisywał wartości kluczy. Stany były reprezentowane tylko
jako obecny/nieobecny:

- wszystkie nieobecne → `no_keys`;
- tylko OpenRouter obecny → przed `no_keys`, po `online`;
- tylko każdy z czterech aliasów Google obecny → przed `no_keys`, po `online`;
- istniejące zachowania OpenAI, Anthropic i Groq pozostały bez zmian.

## 2. K2 — najmniejsza naprawa

Zmiana produktu ogranicza się do fragmentu liczącego status w
`server/src/controllers/SuperAdminController.ts`. Dodano:

- `openrouter` do mapy dostawców i warunku `online`;
- `google` do mapy dostawców i warunku `online`;
- cztery aliasy Google używane już w warstwie AI: `GOOGLE_API_KEY`,
  `GEMINI_API_KEY`, `GOOGLE_AI_KEY`, `GOOGLE_AI_API_KEY`.

Nie zmieniono trybu OpenRouter-only, listy synchronizowanych dostawców, flag,
uprawnień ani `Gateway.ts`. Groq nadal jest raportowany, ale — zgodnie ze stanem
zastanym — sam nie podnosi ogólnego statusu do `online`.

Commity rdzenia: `891ff965e1`, `f0af1495b9` (oba wypchnięte na
`github-backup/codex/day117-status-ai-20260829`).

## 3. K3/K7 — dowód mutacyjny w obie strony

Pakiet: `tests/unit/backend/controllers/SuperAdminSystemHealthProviders.test.ts`.
To czysta jednostka: `RUN_DB_TESTS=0 MOCK_DB=true`, bez `ApiGateway`, JWT,
Postgresa i bez wywołania modelu. Pułapki Z33 (a)–(e) nie leżą na tej ścieżce:
pakiet wywołuje eksportowany handler z lokalnym callbackiem DB i mierzy wyłącznie
deterministyczną interpretację `process.env`.

Mutacja (przywrócenie starego fragmentu) i przebieg:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/backend/controllers/SuperAdminSystemHealthProviders.test.ts --retry=0 --reporter=json --outputFile=/private/tmp/cx-day117-status-ai-artefakty/day117-focused-mutation-red-final.json
MUTATION_EXIT=1
9 total; 3 passed; 6 failed
```

Sygnatura: czerwone były dokładnie asercje mapy OpenRouter/Google, OpenRouter-only
i czterech aliasów Google. Zielone pozostały trzy sąsiednie kontrakty:
OpenAI, Anthropic i zastane zachowanie Groq.

Po `cp /private/tmp/cx-day117-status-ai-scratch/SuperAdminController.fixed-v2.ts
server/src/controllers/SuperAdminController.ts`:

```text
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/backend/controllers/SuperAdminSystemHealthProviders.test.ts --retry=0 --reporter=json --outputFile=/private/tmp/cx-day117-status-ai-artefakty/day117-focused-mutation-green-final.json
9 total; 9 passed; 0 failed
DIFF_AFTER_RESTORE_BEGIN
DIFF_AFTER_RESTORE_END
```

## 4. K4 — regresja po pełnych nazwach

Pełny zakres `tests/unit`, bez bazy i bez retry, wykonano dla starego fragmentu
i po naprawie. Pułapki Z33 (a)–(e): pakiet jest klasyfikowany jako czysto
jednostkowy (`RUN_DB_TESTS=0 MOCK_DB=true`), więc nie stanowi dowodu egzekucji
Gateway/DB/auth; służy wyłącznie pomiarowi regresji nazw.

```text
przed: 17297 total; 17074 passed; 27 failed; 185 pending
po:    17297 total; 17081 passed; 20 failed; 185 pending
NAME_DELTA_BEGIN
NAME_DELTA_END
```

Delta pełnych nazw: `0`. Sześć zamówionych nazw zmieniło status red→green.
Jedna niezwiązana nazwa `ApiGateway D-01 ... /api/integrations` także zmieniła
red→green; to zastana niestabilność i nie jest przypisana naprawie. Pozostałe
`20/17297` czerwonych nazw są zastanym długiem poza licencją dyżuru; pełna lista
pozostaje w `day117-unit-after.json`.

## 5. Realny Postgres, fixture i Z30

Kontener `cx-day117-pg`, obraz `pgvector/pgvector:pg16`, port
`127.0.0.1:5999`; migracje zakończyły się powodzeniem, drugi przebieg zastosował
`0` zmian. Kanoniczny seeder Admin utworzył `8/8` person, `3/3` główne aktywne
członkostwa i odczytał `863` udane migracje.

Przed runtime i po seedzie baza zwróciła `0` wierszy `smtp%`; środowisko powłoki
i procesu serwera nie zawierało kluczy pocztowych. `Gateway.ts` nie montuje
drenaży. Pełny runtime uruchomiony przez kanoniczny skrypt raportował auth/test
bypassy OFF, `DOTENV_DISABLED`, właściwy SHA i lokalną bazę. Log potwierdził, że
dwa drenaże wystartowały, ale brak konfiguracji SMTP oraz brak operacji
tworzących wiadomości utrzymały transport fail-closed.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie
zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie
przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie
dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log
serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani
powiadomienie zewnętrzne nie zostało wysłane.

## 6. B.3 — mapa powierzchni polityki AI

`src/views/superadmin/AIPlatformModule/AIPlatformModule.tsx:103-180` wystawia
konfigurację dostawców, tierów, routingu, przypisań celów, polityki organizacji,
governance i ustawień globalnych; rozwój promptów/eksperymentów/model registry;
operacje/health/SLA; analitykę; enforcement oraz security.

`src/views/superadmin/LLMManagementView.tsx:220-257,316,379-530` pozwala
wyświetlać, dodawać/edytować/usuwać i testować konfiguracje dostawców oraz
stosować rekomendowany preset. `src/components/SuperAdmin/SuperAdminAISettings.tsx:1-11,298-421`
deklaruje zapis domyślnego dostawcy, fallback chain, limitów, PII, rezydencji i
circuit breakerów.

Nie udowodniono w tym dyżurze semantyki zapisu/readbacku tych powierzchni ani
tego, że faktycznie sterują runtime. To mapa kodu i UI, nie akceptacja.

## 7. K5 — zrzuty przed/po

Pełny produkt działał na `4898/4899`, z podpisanym logowaniem syntetycznej
persony SUPERADMIN i bazą na `5999`. Zrzuty wykonano dla realnie starego i
realnie naprawionego fragmentu, w motywie jasnym i ciemnym:

```text
1c9f5d5bb8f7d0795d270828bf5afd23cefda19969e70b699f3503126c5f8779  /private/tmp/cx-day117-status-ai-artefakty/day117-before-light.png
d8e093a129e9f87708e68c8cb197a268bdda11d590eb329f57a39db0b8e3d35f  /private/tmp/cx-day117-status-ai-artefakty/day117-before-dark.png
9395639bc7faa7444f8aac4fcfa6f8c857a1306843abe7ec6126feca27e9b47b  /private/tmp/cx-day117-status-ai-artefakty/day117-after-light.png
903ff0e18b3d9fed9a51d8b812b0b177b34336491509355614e1a4bc862822a8  /private/tmp/cx-day117-status-ai-artefakty/day117-after-dark.png
```

Werdykt wizualny: `4/4` zrzuty wykonane i obejrzane, ale ekran jest identycznie
zdegradowany przed i po: `System health unavailable / The requested API endpoint
does not exist.` Konsument `src/services/api.ts:12848` woła `/system-health`,
podczas gdy naprawiony handler jest zamontowany pod
`/api/superadmin/system-health` (`server/src/Gateway.ts:775`,
`server/src/routes/superadmin.routes.ts:1914`). Zatem naprawa API nie ma dziś
widocznego konsumenta na badanym ekranie. Nie zmieniono tego poza licencją Z40.

## Korekty wobec instrukcji

1. Instrukcja odwołuje się do nieistniejących `§0.4a`, „BLOKU 0” i „tabeli
   licencji”. Zastosowano bezpieczniejszą interpretację: porty sprawdzono przed
   startem, zakres zapisu przyjęto literalnie z Z40 i §D, a pomiar zasięgu
   wykonano na pełnym `tests/unit`.
2. §B ma dwa nagłówki `B.3`; oba wykonano (mapa oraz mutacja).
3. Teza o widocznym ekranie została częściowo obalona: backendowa trasa istnieje
   i jest naprawiona, ale obecny ekran jej nie konsumuje. Jest to wynik, nie
   powód do improwizacji.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie zweryfikowano realnego wywołania żadnego modelu; Z15 tego zabrania.
- Nie zweryfikowano produkcji, demo, stagingu ani Railway; Z28 tego zabrania.
- Nie udowodniono, że powierzchnie polityki AI zapisują i egzekwują wszystkie
  opisane ustawienia w runtime.
- Nie udowodniono browserowej prezentacji poprawnego statusu dostawcy, ponieważ
  badany ekran woła inną, nieistniejącą trasę.
- Nie usunięto `20/17297` zastanych czerwonych testów jednostkowych.

## Stan końcowy

`FIXED` — kontrakt API dostawców, z dowodem red→green.  
`PARTIAL / NO_CONSUMER` — widoczny ekran System Health.  
`NOT VERIFIED` — egzekucja całej polityki AI i środowiska zdalne.
