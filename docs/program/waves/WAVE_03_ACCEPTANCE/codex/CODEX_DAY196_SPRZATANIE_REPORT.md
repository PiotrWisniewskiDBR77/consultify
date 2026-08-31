# CODEX — DYŻUR 196 — RAPORT SPRZĄTANIA

Data: 2026-08-31  
Baza: `6894f3da05`  
Gałąź: `codex/day196-sprzatanie-20260831`  
Werdykt wykonawcy: `R1-R4 ZREALIZOWANE / FOCUSED 3/3 PASS / FULL SUITE PARTIAL (1 FAIL + 4 SKIP)`

## 1. Wejście, marker i rozjazd

Wynik komend markera, dosłownie:

```text
6894f3da05 odbior 189: SCALONO po FIX-189
MARKER OK
```

Wynik sanity, dosłownie:

```text
6894f3da05375672bca0207c98dcd2f3e241f2a5
```

`git status --short | head -3` nie zwrócił żadnej linii. Tip
`github-backup/codex/m03-admin-20260824` był o 11 commitów do przodu względem markera; zgodnie
z DEC-2026-08-26-95 praca rozpoczęła się dokładnie z markera, bez rebase. Lista
rozejścia i lista plików zostały zmierzone komendami wymaganymi w §0.1; tip
zawierał m.in. instrukcje dyżurów 194-196 oraz zmiany dyżurów 188/193.

Warunki STOP: 21-24 GiB wolnego miejsca podczas dyżuru, `MARKER OK`, porty
`6121`, `5062`, `5063` wolne, brak połączeń z bazą zdalną i brak ryzyka wysyłki.

## 2. Wynik R1-R4

### R1 — Execution Source

Commit: `216aa1d538`. `ExecutionHub.tsx` używa teraz
`getSourceDisplayLabel(previewModel.sourceType)`, a framework czyta bez
rozszerzania współdzielonego typu z
`String((selectedRow as any)?.sourceFramework || '').trim()`. Relacja ma trzy
jawne stany: etykieta + ` · framework`, sama etykieta, albo `[]` bez typu.

Test kontraktowy ma dwa przypadki. Mutacja usuwająca mapowanie etykiety dała
`1 PASS / 1 FAIL`; po odtworzeniu pliku diff był pusty, a finalny pakiet celowany
był zielony.

### R2 — komentarz DEC-104

Commit: `eb716902cd`. Zmieniono wyłącznie komentarz. Stare zdanie
`no card-level status write path exists` ma 0 trafień. Nowy komentarz wskazuje
`handleStatusAction` (~3025), `updateInitiativeStatusWriteTruth` (~3148), realny
PATCH oraz mutacyjny dowód odbioru 172: 200+zapis i 403+zero zapisu. Kod
`stripStatusActions`, `statusActions` i handlerów nie został zmieniony.

### R3 — UsageMeters

Commit: `aa3d73cdd5`. Pomiar przed decyzją zwrócił cztery trafienia
`UsageMeters`: plik własny, `SidebarUsage.tsx`, `BillingSettings.tsx` i
`BillingCore.tsx`. Dwa ostatnie są żywymi konsumentami, więc zastosowano FIX:
import `useTranslation` oraz `const { t } = useTranslation()`; klucz i tekst
fallback pozostały bez zmian.

`SidebarUsage.tsx` ma wyłącznie trafienie własne, czyli zero konsumentów. Nie
usunięto go i nie przeniesiono do kwarantanny. Po R3 nie dziedziczy już błędu
niezainicjalizowanego `t`, gdyby został ponownie podłączony.

Smoke renderuje scenariusz z niepustym `periodEnd`. Mutacja usuwająca hook dała
`0 PASS / 1 FAIL`; po odtworzeniu pliku diff był pusty.

Dlaczego plik mógł się budować przed naprawą: `package.json` rozdziela
`build` (`vite build`) od `type-check` (`tsc --noEmit`). Vite transpiluje bez
pełnej kontroli typów, więc niezadeklarowane `t` ujawniało się dopiero w
wykonywanej gałęzi JSX. Pełny `tsc` nie jest jednak zieloną bramką tej bazy:
zwrócił 875 zastanych błędów; po naprawie nie zwrócił trafienia dla
`UsageMeters.tsx` ani nowych testów.

### R4 — dwie karty MODULE_ACCEPTANCE

Commit: `31c5005a5a`. Zmieniono wyłącznie dwa pola `Decision:`. Stare wartości
pozostały widoczne jako przekreślone, a aktualna wartość to `CLOSED_FINAL` z
odpowiednimi, różnymi decyzjami/SHA/tagami dla Organization i Settings.
Sekcje źródłowe `CLOSED_FINAL` oraz sekcje `STAN PO DYŻURZE` nie zostały
zmienione.

## 3. Migracje, poczta i testy

Lokalny `pgvector/pgvector:pg16` działał jako `cx-day196-pg` na
`127.0.0.1:6121`. Pierwszy przebieg zastosował 870 migracji, drugi 0; oba
zakończyły się `Postgres migrations complete`. Tabela `settings` miała 0 wierszy
`smtp%`, `Gateway.ts` miał 0 trafień drenaży, a środowisko zwróciło
`BRAK ZMIENNYCH POCZTY`.

Deklaracja Z30: **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza
tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem
`server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie
kalendarzowe nie zostało wysłane.**

Pakiet celowany finalny: 3/3 PASS, 0 FAIL, 0 SKIP. Pełny zamówiony pakiet:
202 testy, 197 PASS, 1 FAIL, 4 SKIP. Residual FAIL to zastany
`upsertFinancialBlock language toggle still matches the same block via the stable marker token`.
Cztery SKIP to testy Day 136 Initiative sections. Nie uznaję pełnego pakietu za
PASS i nie zmieniałem residualu poza licencją.

Pułapki §0.2d: wszystkie komendy miały w tej samej linii `RUN_DB_TESTS=1`,
`MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`,
`ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, jawny lokalny
`DATABASE_URL`, `JWT_SECRET` oraz `--retry=0`. Nowe testy są frontendowe i nie
mierzą bramek HTTP; env wyłącza jednak fałszywe tryby całego pakietu. Wyniki
oceniono po JSON i pełnych nazwach, nie po samym exit code.

## 4. Artefakty

- `day196-targeted-final.json` — `4ad49d22928e9bf0d89878e61f4af6f145d02b8a1ee2c06da8f74369bd397bf9`
- `day196-vitest-final.json` — `da05af9040e2611c7a223961e4e9bf7d3aae8af6bf682cd3f66cc88ba9562ce8`
- `day196-r1-mutation-red.json` — `7156299d830deb8bb7eeecd827e73c33e269ac11b4e807caedcc6228360d4457`
- `day196-r3-mutation-red.json` — `9537f35dc0530c289b7412226a3026c6fe311aa3f8de0a6bec7976253b310968`
- `migrate-first.log` — `326df0d41fee1e491721f2b15f4fe0d2814d1656b423d4a8cd9f153beb6bb0e2`
- `migrate-second.log` — `cee74cd35ea2ab8c4e0d8728765fa00915ce32434b09d2262fd31ff8a2d6de82`
- `day196-typecheck.log` — `a449c9524bcb78429af7bb06fbd57606d495f978d0497a1ec7ec37217f8c589a`

Wszystkie leżą w `/private/tmp/cx-day196-sprzatanie-artefakty`; żaden nie został
dodany do repo.

## 5. Zakres plików

`git diff --name-only 6894f3da05..HEAD` przed raportem zwrócił dokładnie siedem
licencjonowanych plików: dwa MODULE_ACCEPTANCE, trzy pliki produktu i dwa nowe
testy. Ten raport jest ósmym i ostatnim plikiem. Nie zmieniono `server/**`,
infrastruktury testów ani katalogu właściciela.

## 6. Korekty wobec instrukcji

- Instrukcja odwołuje się do §0.4a, ale wydany dokument nie zawiera nagłówka
  §0.4a. Zastosowano dosłownie podaną w §0.1 komendę zasięgu plików oraz pełny
  zamówiony pakiet z §0.2c.
- Pełny pakiet nie jest zielony: 1 FAIL i 4 SKIP. Nie przepisano oczekiwanej
  liczby i nie osłabiono testów.
- T4b: na markerze nie było commita day176 dla `UsageMeters.tsx`, a importu/hooka
  brakowało; R3 nie był wcześniej zrobiony na tej bazie.

## 7. TWIERDZENIA NIEZWERYFIKOWANE

- R3 nie był wcześniej naprawiony na markerze — zweryfikowane przez historię i
  treść pliku; brak trafień day176 i brak `useTranslation`/hooka.
- Pomiar importerów zgodził się z instrukcją: dwa żywe importy `UsageMeters`,
  jeden martwy pośredni `SidebarUsage`, zero konsumentów `SidebarUsage`.
- W `15_SETTINGS/MODULE_ACCEPTANCE.md` nie ma trzeciego dokumentu odnoszącego
  się dosłownie do starej wartości Decision. Ta wartość występuje po poprawce
  wyłącznie jako przekreślona historia w polu `Decision`. Inne, odmienne statusy
  `PENDING/PARTIAL` istnieją w tabelach i opisują osobne bramki; nie zostały
  objęte R4.
- Nie wykonano browser replay ani zrzutów: R1 został udowodniony kontraktem
  trzech stanów i mutacją testu, nie wizualnym odbiorem właściciela.
