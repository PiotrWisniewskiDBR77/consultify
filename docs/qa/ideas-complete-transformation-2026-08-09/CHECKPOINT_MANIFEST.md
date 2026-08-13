# CHECKPOINT MANIFEST — Ideas Transformation

> **Ten commit zawiera wyłącznie ten manifest.** Commit nie może zawierać własnego
> skrótu kryptograficznego, więc wszystkie pomiary poniżej odnoszą się do
> **rodzica** tego commita — `TESTED_CODE_SHA` — a `FINAL_HANDOFF_SHA` odczytaj
> z `git log -1`. Różnica między nimi to `MANIFEST_ONLY`.

## Tożsamość

| | |
|---|---|
| Moduł | Ideas Transformation (Idea Workspace: Mind Map · Whiteboard · Process Flow · Table) |
| Właściciel | sesja agenta `a9a97ffb-be7f-4c10-ac35-06db51d2ab70`, 2026-08-12/13 |
| Worktree | `/Users/piotrwisniewski/.codex/worktrees/ideas-transform/consultify` |
| Branch | `codex/ideas-transformation-20260809` |
| **TESTED_CODE_SHA** | `9d65acff7db18b98062ea1fae93afe9431a0e32a` |
| Baseline branch | `origin/demo` |
| Baseline tip w chwili checkpointu | `f3e7df565e0da826ba110d85aad3c3c81a1087f1` |
| **Merge-base** (baza wszystkich porównań A/B) | `9d17cac11484a82f729a51044e30453e39fbcb02` |
| Upstream | `origin/demo` |
| Ahead / behind | 85 ahead / 2 behind |
| Tag | `ideas-transformation-final-2026-08-13` |

## Commity

- **85** commitów od merge-base
- **41 odziedziczonych** (`9d17cac114..edb38d6a29`) — poprzednie sesje
- **44 z tej sesji** (`edb38d6a29..HEAD`)

Pełne listy: `manifest_own_commits.txt`, `manifest_inherited_commits.txt`
w kopii bezpieczeństwa (`Documents/_consultify-backup/dowody/`).

## Zmienione pliki

**835** plików względem merge-base. Pełna lista: `manifest_all_files.txt` w kopii
bezpieczeństwa. Pliki dotknięte wyłącznie przez tę sesję: **230**.

## Cztery defekty zamknięte w tej sesji

| Defekt | Commit | Istota |
|---|---|---|
| D1 (P2) | `2771824f08` | klucz `sessionStorage` `moduleHub.openDocuments.mywork` był globalny — dwie tożsamości w jednej karcie dziedziczyły otwarte dokumenty. Zawężony do `<org>.<user>`, stary klucz czyszczony. |
| D4 (P3) | `87360b62e9` | „Skip for now" w onboardingu wyrzucało użytkownika na `/chat`. Zreprodukowane na żywo (`/my-work` → `/chat`), naprawione bez nawigacji. |
| D2 | `499b4b98c2` | **klasa utraty danych, nie kosmetyka.** Przy nieudanym `GET /map` kod budował 6-węzłowy szablon **i zapisywał go na serwer**. Komentarz w repo sam to nazywał: „overwriting the real server map". Istniejące zabezpieczenie chroniło tylko przypadek „ładuje się", nie „błąd". |
| D3 | `914759d4cb` | szkic z `pending` nie był porównywany wersją → wskaźnik „Changes queued" utrzymywał się mimo zapisu; realnie zaległy szkic nie był ponawiany. |

Higiena: `a64b2657be` (20 uwag whitespace poza CSV), `b2438008fd` (4 błędy typów TS2345),
`83d6576c83` + `9d65acff7d` (dokumentacja).

## Pliki wspólne / kolizyjne — wymagają decyzji integratora

Commit **`2c12080ebf`** (migracja `jp` → `ja`, BCP47) obejmuje **65 plików**, w tym
**10 plików serwera spoza modułu Ideas**:

```
server/src/routes/conversations.routes.ts
server/src/routes/public-anna.routes.ts
server/src/routes/public-contact.routes.ts
server/src/routes/helpChat.routes.ts
server/src/routes/ai/smart-followup.routes.ts
server/src/routes/v8/help.routes.ts
server/src/services/annaAnalyticsService.ts
server/src/validators/ai.validators.ts
server/src/validators/conversations.validators.ts
server/src/validators/user.validators.ts
```

**Uzasadnienie:** `jp` nie jest poprawnym kodem BCP47. `Intl.PluralRules('jp')`
cicho rozwiązuje się do `en-US`, więc japoński liczył liczbę mnogą regułami
angielskimi w całym produkcie. Naprawa musiała objąć wszystkie unie typu języka.
`LANGUAGE_ALIASES = { jp: 'ja' }` zachowany dla wartości już zapisanych w bazie.

Inne pliki wspólne: `server/src/Gateway.ts` (montaż routera E09, 5 linii addytywnie),
`.claude/launch.json` (6 linii dodanych, 0 usuniętych — cudze wpisy nietknięte).

## Testy wykonane na `TESTED_CODE_SHA`

| Bramka | Wynik |
|---|---|
| E15 — runda 1 | 216 plików / 1304 testy · 1183 PASS / 121 FAIL / 0 SKIP · 37 s |
| E15 — runda 2 | identycznie · 38 s |
| **E15 — porównanie per test** | **0 różnic** → dwie stabilne rundy |
| A/B wobec zamrożenia 2026-08-12 | 121 czerwonych wtedy, 121 teraz, **0 nowych, 0 naprawionych** |
| type-check klient | rc=0 · 0 błędów (sterta 8 GB) |
| type-check serwer | rc=0 · 0 błędów |
| Strażniki (`check-actions`, `check-list-canon`, `check-artefakt`, `check-focus-canon`) | 4/4 rc=0 |
| `git diff --check` — pełny | rc=2 · 580 uwag · **0 markerów konfliktu** |
| `git diff --check` — bez 4 dowodowych CSV | **rc=0 · 0 uwag** |
| Testy 4 defektów łącznie | 18/18 PASS |
| realDB E09 | 6/6 PASS |

**Wyjątek CSV:** 580 uwag to `CR` z CRLF w czterech plikach dowodowych, które są
w 100% CRLF zgodnie z RFC 4180 (43/43, 265/265, 232/232, 40/40 linii). Konwersja
złamałaby standard i przepisała dowody wyłącznie po to, żeby checker był zielony.

## Odbiór runtime — izolowane środowisko

Baza `127.0.0.1:54331/ideas_final`, zero połączeń do demo (`trolley:28146`),
produkcji (`centerbeam:37823`) i dev (`thomas:20221`) — zweryfikowane `lsof` na PID.

| Obszar | Wynik |
|---|---|
| Golden Journey z realnym modelem | **PASS** — `openai/gpt-4o-mini` przez OpenRouter, `degraded: null`, 82 tokeny |
| Ścieżka negatywna Teresy | PASS — jawny błąd, licznik prób, działający retry |
| Macierz wizualna | 80 kombinacji · 1920 i 1280 **PASS** dla 4 narzędzi · zoom 200% **FAIL** · JA **FAIL** |
| Regresja `Updated` vs kolumna akcji | **ZAMKNIĘTA** — odstęp +31 px, `overlap: false` |
| Whiteboard — utwórz/zapisz/odśwież | PASS (serwer: 7 węzłów, wersja 9 → 14) |
| Whiteboard/Process Flow — pełna lista odbioru | **EVIDENCE_MISSING** |

## Znane defekty i braki

1. **Zoom 200% — FAIL wspólnej powłoki**, wszystkie 4 narzędzia: pasek zakładek urywa
   się w połowie słowa bez uchwytu do przewijania; data i kebab przycięte krawędzią.
   **Stan zastany**, nie regresja tej sesji.
2. **Locale JA nie dociera do treści modułu.** Przyczyna zmierzona: 60 miejsc
   `isPolish ? PL : EN` zamiast `t()`. Merge-base miał 49 wystąpień w samej tabeli,
   kandydat ma 43 → **program ten dług zmniejszył**. Migracja `jp`→`ja` była konieczna,
   ale nie mogła dać japońskiego tam, gdzie nie było trzeciej ścieżki językowej.
3. **390 px — nierozstrzygnięte.** Automat zgłosił FAIL, zrzut pokazał poprawny układ
   mobilny (hamburger, dolna nawigacja). Werdykt automatu odrzucony, dowodu brak.
4. Klucze `mindmap.persistence` w `de`/`ar`/`ja`/`es` to **angielskie placeholdery**.
5. `moduleHub.openDocuments.**interview**` w `InsightViewer.tsx` ma **ten sam defekt
   co D1** — celowo nietknięty, cudzy moduł.

## RISK-24 — dwa mechanizmy migracji

- `server/scripts/migrate.postgres.ts:555-558` — przy fladze `--safe` **padnięta
  migracja jest zapisywana jako `skipped`**, pętla leci dalej, skrypt kończy
  komunikatem „✅ Postgres migrations complete" i kodem 0. Zepsuta migracja daje
  zielony wynik.
- Nazewnictwo myli: `db:migrate`, `db:migrate:strict` i `db:migrate:postgres` to
  ta sama komenda bez flagi; `db:migrate:unsafe-continue` podaje `--safe`.
- Drugi mechanizm: `DB_MANAGED_SCHEMA` (`server/src/index.ts:239-244`,
  `server/src/database/PostgresDatabase.ts:477-479`) wyłącza automatyczne DDL przy starcie.
- **Konsekwencja:** „zielona migracja" nie dowodzi zgodności schematu.

## Pułapki pomiarowe potwierdzone w tej sesji

- `npx vitest run` **bez filtra katalogów** uruchamia całe monorepo (3869 plików /
  38 896 testów), a **nie E15** (216 / 1304). Odrzuciłem dwugodzinny pomiar z tego powodu.
- `tsc` z `rc=134` przy „0 błędów" to **SIGABRT/OOM**, nie sukces — ukrył 4 realne
  błędy typów. Wymagane `NODE_OPTIONS=--max-old-space-size=8192`.
- `version` w mapie idei **nie jest dowodem zmiany treści** — rośnie przy samym
  otwarciu warsztatu (78→83→86→88→90→93). Dowodem są `nodes`/`edges`.
- Pierwszy zrzut po nawigacji potrafi wyjść czarny (strona przed pierwszym malowaniem).

## Rekomendowana metoda integracji

**NEEDS OWNER DECISION.** Prace Ideas są spójne i przetestowane, ale mikropakiet
`jp`→`ja` (`2c12080ebf`) dotyka 10 plików serwera poza modułem i musi dostać własną
decyzję: razem czy jako osobny commit z osobnym odbiorem.

## Status

**To NIE jest odbiór produktu.** Status pracy: `BLOCKED / EVIDENCE_MISSING` —
Whiteboard i Process Flow nie mają pełnej listy odbioru runtime, a dwa zmierzone
FAIL-e (zoom 200%, locale JA) leżą w module, nawet jeśli są stanem zastanym.

Nie merge'ować do `demo`/`main`/`develop` bez decyzji integratora.
Nigdy nie force-pushować na `demo`.
