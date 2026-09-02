# ODBIÓR 220 — Audyty: trzy otwarte pozycje rejestru (AUD-OR-20260829-001/-002/-005)

Audytor: sesja adwersaryjna główna (Fable), 2026-09-01. Zakres materiału:
`/private/tmp/cx-day220-audyty-rejestr`, gałąź `codex/day220-audyty-rejestr-20260901`,
commity `64f106187f` (produkt+testy) i `21a5e1e476` (docs). Marker `9fb7942a01`.

## Werdykt: SCALIĆ PO FIX

Kod produktowy jest bezpieczny i potwierdzony niezależną mutacją. Jedyny wymagany FIX
dotyczy dowodu wizualnego (R4) — patrz niżej — nie kodu produkcyjnego.

Ocena: **B**

## Co zweryfikowano niezależnie (nie na podstawie raportu wykonawcy)

1. Uruchomiono realny Postgres 16 (`cx-day220-pg`), zastosowano 876 migracji, sprovisionowano
   i zaseedowano fixture `consultify_w3_audits_owner_day220` przez kanoniczny
   `scripts/dev/seed-wave3-audits-owner-review.mjs` (provision → seed → readback).
2. Uruchomiono 3 nowe pliki testów (`day220-audyty-rejestr.r1/r2/r3.test.tsx`) na żywo:
   **7/7 PASS**, realny `ApiGateway`, podpisany JWT, `verifyToken`, `GET /api/audits/programs`
   i `/reports` = 200.
3. **R1 (i18n) — bramka mutacyjna POTWIERDZONA przeze mnie.** Cofnięto `PACK_TITLE` do
   angielskiego literału w `scripts/dev/seed-wave3-audits-owner-review.mjs:47` → test
   `nie zawiera wskazanych angielskich literalów...` poszedł **RED** (1 failed). Przywrócono
   plik (`cp` z kopii), `cmp` potwierdził identyczność z oryginałem, test wrócił GREEN.
4. **R3 (ucinanie wartości) — bramka mutacyjna POTWIERDZONA przeze mnie.** Usunięto
   `title={row.statement}` z `AuditFindingsTab.tsx` → test R3 (przypadek Ustaleń) poszedł
   **RED**. Przywrócono plik, `cmp` czysty, test wrócił GREEN.
5. **R2 (surowe identyfikatory) — bramka SŁABSZA, nie kod produkcyjny.** Diff pokazuje, że
   `AuditProcessesTab.tsx` resolver `userNameById` **już istniał przed tym dyżurem** — dyżur
   dodał tylko `title=`. Mutacja opisana w raporcie (`userNameById={new Map()}`) podmienia
   **prop testu**, nie kod produktu — bo nie było czego naprawiać (defekt był już nieaktualny).
   To legalny dowód „test nie jest tautologią", ale NIE jest dowodem mutacyjnym na defekt
   przywrócony w produkcie, bo AUD-OR-002 był faktycznie już zamknięty przed dyżurem 220.
   Raport to ujawnia wprost („karta Sesji była już częściowo naprawiona przed dyżurem") —
   nie jest to ukrywane.
6. Zrzuty: 6 plików PNG (Sesje/Raporty/Ustalenia × jasny/ciemny) — hashe SHA-256 na dysku
   **dokładnie zgodne** z tabelą w raporcie. Różnice jasny–ciemny 223–227 (próg >150 spełniony
   z zapasem).
7. `MODULE_ACCEPTANCE.md`: zmienione WYŁĄCZNIE trzy wiersze `-001/-002/-005`; `-003`/`-004`
   nietknięte — zgodne z licencją `Z13`/`Z17`.

## FIX wymagany przed pokazaniem Piotrowi

**`dev-render/screens/day220-audyty-rejestr.tsx` NIE montuje realnych komponentów
`AuditProcessesTab`/`AuditReportsTab`/`AuditFindingsTab`.** To ręcznie sklejona,
osobna tabela z twardo wpisanymi wartościami (`rows.processes.values = [...]`), a nie
mount zmienionych plików produktowych. Konwencja repo (`idea-table.tsx`,
`finance-analysis-workspace.tsx` i inne w `dev-render/screens/`) montuje realny
komponent z mock-props — ten ekran łamie tę konwencję. Zrzuty są więc **estetyczną
rekonstrukcją zamierzonego efektu**, nie dowodem, że zmieniony kod (`title=` na sześciu
miejscach, i18n fixture) faktycznie tak wygląda w swoim naturalnym drzewie (StandardTable,
zakładki, kebab, prawdziwe klasy `truncate`/`max-w-[]`). Rule 7 CLAUDE.md wymaga realnego
renderu jako materiału do akceptu — ten ekran tego nie spełnia, mimo że sam raport uczciwie
zaznacza, że nie dowodzi produkcyjnej osiągalności (co jest prawdą, ale nie adresuje
problemu, że to w ogóle nie jest ten sam komponent).

**FIX:** przed pokazaniem Piotrowi — przebudować `dev-render/screens/day220-audyty-rejestr.tsx`
tak, by montował realne `AuditProcessesTab`/`AuditReportsTab`/`AuditFindingsTab` z mock-props
(wzorem `dev-render/screens/idea-table.tsx`), i wykonać nową parę zrzutów jasny/ciemny na
realnym komponencie. Kod produkcyjny (fix i18n + title + resolver) nie wymaga zmian — jest
zweryfikowany testami realnego API.

## Odpowiedź wprost

**Ile z trzech pozycji ma bramkę mutacyjną: 2 z 3 w pełni (R1, R3), R2 ma bramkę słabszą**
(mutacja propsów testu, nie kodu produktu — bo AUD-OR-002 był już wcześniej naprawiony i
nie było defektu do przywrócenia w kodzie).
