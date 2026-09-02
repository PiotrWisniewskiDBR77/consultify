# CODEX DAY 255 — NAZWY AGENTA

## Streszczenie

Status: **FIXED / VERIFIED lokalnie** na markerze `df7f13056f`, gałąź `codex/day255-nazwy-agenta-20260901`.

- `split_slide` tnie pojedynczy blok na najbliższej granicy białego znaku; dla jednego słowa zachowuje jawny fallback do połowy znaków.
- identyfikator nowej karty używa `randomUUID()`, więc dwa synchroniczne podziały nie kolidują;
- `change_archetype` dopuszcza wyłącznie identyfikatory zaakceptowane przez `isArchetypeId()` i zwraca czytelne odrzucenie bez mutacji;
- `rewrite_slide` zachowuje literalną podmianę po dwukropku, ale odpowiedź uczciwie mówi o podmianie tekstu, nie o redagowaniu przez model.

Prawdziwe redagowanie treści przez model językowy to osobny dyżur, wymagający jawnej zgody właściciela na wyłączenie `Z15` dla tego zakresu — NIE zrobione w tym dyżurze, świadomie.

## Wejście i marker

```text
git merge-base --is-ancestor df7f13056f github-backup/codex/m03-admin-20260824
MARKER OK

git -C /private/tmp/cx-day255-nazwy-agenta rev-parse HEAD
df7f13056fa24995be07f64b0e8c877b3faeab45

git -C /private/tmp/cx-day255-nazwy-agenta status --short | head -3
<brak wyjścia>
```

Tip gałęzi bazowej był przed markerem o 9 commitów; zakres rozbieżności obejmował dokumenty programu i instrukcje, bez plików produktu zmienianych w tym dyżurze. Pełny zapis: `/private/tmp/cx-day255-nazwy-agenta-artefakty/r1.txt`.

## R1 — dziewięć tez i dosłowne wyniki

| Teza | Werdykt | Dosłowny wynik istotny |
|---|---|---|
| T1 literalna podmiana | TAK | `const replacement = String(prompt).split(':').slice(1).join(':').trim();` |
| T2 cięcie znakowe | TAK | `const splitAt = Math.max(1, Math.ceil(text.length / 2));` |
| T3 `Date.now()` w ID | TAK | `540: card_id: \`${card.card_id || 'card'}-split-${Date.now()}\`,` |
| T4 brak walidacji | TAK | `cards[index].layout_id = layoutId;` bez walidatora w bloku |
| T5 walidator istnieje i nie jest wołany | TAK | `502:export const SLIDE_ARCHETYPES...`; `508:export function isArchetypeId...`; drugi grep: `<brak wyjścia>` |
| T6 ścieżka regexowa, bez modelu | TAK | `? /(?:przeredaguj|rewrite)\b/.test(normalized)`; grep modelu: `<brak wyjścia>` |
| T7 brak etykiet/przycisków | TAK | grep w `AgentPanel.tsx`: `<brak wyjścia>` |
| T8 flaga OFF | TAK | `38: ENABLE_TERESA_DECK_EDIT: z.boolean().default(false),` |
| T9 dysk | TAK | `/dev/disk3s1s1 1.8Ti 12Gi 9.4Gi 56% /` po utworzeniu worktree |

Pełne, nieobcięte wyniki wszystkich dziewięciu komend: `/private/tmp/cx-day255-nazwy-agenta-artefakty/r1.txt` (SHA-256 `238b9047162c5143e8105f4b1a0e3fcae62106fcbedffca2cae6379d0b0c8ecd`).

## Baza i bezpieczeństwo

Kontener `cx-day255-pg`, wyłącznie `127.0.0.1:6250`, obraz `pgvector/pgvector:pg16`, baza `cx255`. Pierwszy przebieg: `Applying migrations: 880`, zakończony `Postgres migrations complete`; drugi: `Applying migrations: 0`, także zakończony poprawnie.

```text
env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)" || echo ...
BRAK ZMIENNYCH POCZTY

SELECT key, left(coalesce(value,''),8) FROM settings WHERE key LIKE 'smtp%';
(0 rows)

grep ... server/src/Gateway.ts
<brak wyjścia>
```

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## R2 — split_slide

Zielony kontrakt sprawdza dokładny wynik `['Alpha bravocharlie', 'delta echo']`. Dla ID zamraża `Date.now()` na tej samej wartości, uruchamia dwa podziały bez `await` pomiędzy wywołaniami i wymaga różnych `card_id`.

Dowody mutacyjne z `--retry=0`:

- cofnięta granica słowa: JSON `1 passed / 1 failed`, czerwony pełny test `day255 split_slide word boundary and identifiers splits a single text block at the nearest whitespace rather than inside a word`;
- cofnięte UUID na `Date.now()`: JSON `1 passed / 1 failed`, czerwony pełny test `day255 split_slide word boundary and identifiers creates distinct card identifiers for two synchronous split operations`;
- kod przywrócony z kopii w scratch; końcowy pakiet zielony.

## R3 — change_archetype

`two_column` jest akceptowany i zapisany. `nieistniejacy_archetyp_xyz` nie zmienia `layout_id`, nie trafia do `appliedActions` i daje komunikat `nieznany identyfikator ...`.

Dowód mutacyjny: po usunięciu wywołania `isArchetypeId` JSON raportuje `1 passed / 1 failed`; czerwony pełny test: `day255 change_archetype validation rejects an unknown archetype without mutating the card`. Po przywróceniu końcowy pakiet zielony.

## R4 — uczciwa nazwa rewrite_slide

Identyfikator wewnętrzny `rewrite_slide` pozostał bez zmiany, aby nie rozszerzać kontraktu ani danych. Trigger regexowy również pozostał. Odpowiedź PL/EN mapuje wewnętrzną akcję na „podmieniono treść ... na podany tekst” / “replaced ... with the supplied text”. Test potwierdza jednocześnie niezmienioną literalną podmianę i brak sugestii analizy/redagowania przez model.

## Testy i pełne nazwy

Właściwy config dla plików serwerowych wymaga uruchomienia z katalogu `server` i `--config vitest.config.ts`. Pierwsza próba z roota dała `0 tests / success false` i nie została uznana za pomiar. Wszystkie uznane przebiegi używały `RUN_DB_TESTS=0 MOCK_DB=true` oraz `--retry=0`; testy są czysto jednostkowe i nie dotykają DB, HTTP, `ApiGateway`, auth ani modelu.

- przed: 10 pełnych nazw, 10/10 zielone;
- po: 15 pełnych nazw, 15/15 zielone;
- dodane: pięć pełnych nazw testów day255;
- zniknięte: zero.

Diff pełnych nazw: `/private/tmp/cx-day255-nazwy-agenta-artefakty/nazwy.diff` (SHA-256 `054e9caa2e247955e891088132775688703a2f2d0d3971a6dc4a896f51ff995f`). Końcowy JSON: `/private/tmp/cx-day255-nazwy-agenta-artefakty/po.json` (SHA-256 `9b4aab3cd45f02b5834c56332b1dc7a12e1df1cece53a2cfcf123a14b4dfdc8b`).

Pułapki Z33: (a)–(d) nie leżą na ścieżce tych czystych testów usługi — nie montują Gateway, middleware ani DB. Pułapka (e) została wyłączona konstrukcyjnie: produkcja i testy nie importują ani nie wołają żadnego klienta/modelu; R1 grep modelu ma zero trafień.

## Pliki

```text
server/src/services/presentationAgentEditService.ts
server/src/services/__tests__/day255-presentationAgentEditService.splitSlideWordBoundary.test.ts
server/src/services/__tests__/day255-presentationAgentEditService.changeArchetypeValidation.test.ts
server/src/services/__tests__/day255-presentationAgentEditService.rewriteSlideHonestName.test.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY255_NAZWY_AGENTA_REPORT.md
```

## Korekty wobec instrukcji

- T7 potwierdzona: front nie ma wskazanych twardych etykiet, więc nie był zmieniany.
- Żadna z trzech wad nie była wcześniej naprawiona na markerze.
- Szkic instrukcji proponował `content_full` jako możliwą nazwę w kontekście slajdów, ale rejestr archetypów jej nie zawiera; test pozytywny używa realnego `two_column`.
- Reporter Vitest może zwrócić procesowi kod 0 przy czerwonym JSON; werdykty mutacyjne oparto na `success:false` i nazwach nieudanych asercji z JSON, zgodnie z pułapką 10.

## TWIERDZENIA NIEZWERYFIKOWANE

- Nie wykonano dowodu realnej ścieżki HTTP/ApiGateway/PG, ponieważ zmiany dotyczą deterministycznej usługi i licencja wskazuje testy jednostkowe; nie twierdzę, że wykonano odbiór E2E.
- Nie wykonano zrzutów UI, ponieważ front nie był zmieniany.
- Nie wołano modelu językowego; jakość prawdziwego redagowania pozostaje poza zakresem i nie została zmierzona.
