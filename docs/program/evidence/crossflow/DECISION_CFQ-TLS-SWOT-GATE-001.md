# DECYZJA OWNERA — `CFQ-TLS-SWOT-GATE-001`

## Pytanie
Czy przekazanie rekomendacji SWOT do kandydata inicjatywy (`POST /api/tools/:toolId/swot-candidates`)
jest **krokiem promocji**, który musi być poprzedzony zamrożeniem i zatwierdzeniem narzędzia — czy
**krokiem sugestii**, celowo otwartym, w którym prawdziwą bramką jest dopiero akceptacja kandydata?

## Co zostało zmierzone (nie wywnioskowane)
Bieg integratora na świeżej bazie (733 migracje), przez prawdziwy router, z **prawdziwym podpisanym JWT**:
`tests/integration/crossflow/cf-04-tools-swot-governance.realdb.test.ts`, test **E1**.

Łańcuch: sesja SWOT w stanie `DRAFT` → `POST /swot-candidates` (**201**) → kandydat →
`POST /api/initiatives/candidates/:id/accept` (**200**) → **zarejestrowana Inicjatywa**.

Zimny odczyt po zakończeniu (osobne połączenie):
| co sprawdzono | wartość |
|---|---|
| `tool_sessions.status` | `DRAFT` |
| `tool_sessions.approved_at` | `NULL` |
| decyzje `APPROVE_TOOL` dla sesji | **0** |
| wiersze w `initiatives` (`source_type='swot_recommendation'`) | **1** |

Czyli: **inicjatywa o pełnym rodowodzie z SWOT-a, który nigdy nie był ani zamrożony, ani zatwierdzony.**

Przyczyna źródłowa: `server/src/services/tools/swotCandidateHandoffService.ts` czytał z sesji
wyłącznie `id, tool_type` — nigdy `status`.

## Warianty

**W1 — bramka WŁĄCZONA (rekomendacja).** Przekazanie do kandydata wymaga sesji `APPROVED`/`FINALIZED`.
- Zgodne z brzmieniem zadania 4 („SWOT → freeze → approval → promotion").
- Zamyka obejście na najwcześniejszym ogniwie; kolejne ogniwa nie muszą go łatać.
- **Koszt**: zmiana zachowania. `tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts`
  (8/8 zielone na baseline) tworzy fixture ze statusem `'DRAFT'` — po włączeniu wymaga zmiany
  fixture'u na `APPROVED`. Frontend, który dziś pozwala przekazać z roboczego SWOT-a, zacznie
  dostawać 409 i wymaga komunikatu „najpierw zatwierdź narzędzie".

**W2 — bramka WYŁĄCZONA, gate przeniesiony na akceptację kandydata.** Kandydat pozostaje sugestią;
`acceptCandidate` sprawdza status źródłowego narzędzia.
- Zachowuje dzisiejszy UX zbierania pomysłów z roboczych narzędzi.
- **Koszt**: `acceptCandidate` obsługuje wiele typów źródeł (`interview_insight`, `audit`,
  `swot_recommendation`, …); dokładanie tam wiedzy o narzędziach rozmywa odpowiedzialność.
  Obejście nadal istnieje dla każdej innej ścieżki, która czyta `initiative_candidates`.

**W3 — status quo.** Żadnej bramki.
- **Koszt**: zadanie 4 nie może zostać uznane za spełnione; sekwencja freeze→approval→promotion
  nie jest w runtime egzekwowana w żadnym punkcie.

## Rekomendacja
**W1.** Sekwencja zarządcza ma wartość tylko wtedy, gdy jest egzekwowana na wejściu do łańcucha.
Koszt to jeden fixture testowy i jeden komunikat w UI.

## Co już jest gotowe technicznie (stan owner-gated)
Bramka jest **zaimplementowana i dowiedziona**, ale **domyślnie WYŁĄCZONA** — zero zmiany zachowania,
zero regresji. Włączenie to jedna zmienna środowiskowa:

```bash
TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL=true
```

Dowód obu trybów w jednym pliku:
- `B1` — bramka OFF: `DRAFT` → 201, 1 kandydat (defekt zapisany jako asercja, więc nie zmieni się po cichu);
- `B2` — bramka ON: `DRAFT` → **409 `SWOT_SESSION_NOT_APPROVED`**, 0 kandydatów, 0 pokwitowań;
- `B3` — bramka ON: sesja `APPROVED` → 201, 1 kandydat (bramka blokuje wyłącznie ścieżkę niezarządzaną);
- `E2` — bramka ON: łańcuch do Inicjatywy w ogóle się nie zaczyna.

## Ścieżki odblokowywane tą decyzją
- pakiet cross-flow SWOT (`SWOT → freeze → approval → promotion`);
- `TLS-BVP-001` — ta sama sekwencja;
- kryterium DoD „maker/checker i zakaz self-approval" w części dotyczącej narzędzi.

## Czego ta decyzja NIE odblokowuje
Braku zakazu self-approval w `ToolController.approveTool` (ten sam użytkownik może poprosić o przegląd
i zatwierdzić) — to osobne ustalenie, wymagające własnej decyzji o macierzy ról.

## Requalification integratora — 2026-08-17

- Baseline integracji: `eb310fb344d3339c67cad81188ce13c6f950d100`.
- Fresh PostgreSQL 16: 733/733 migracji, repeat 0, dry-run 0.
- `cf-04` + `tls-007`: 2/2 pliki, 19/19 testów, 0 skip/todo.
- promotion race + failure injection: 2/2 pliki, 16/16 testów, 0 skip/todo.
- Pierwszy łączny przebieg został odrzucony: historyczny race harness wymagał
  nazwy bazy `consultinity`. Powtórzono go na izolowanym klonie o tej nazwie;
  produkt nie został zmieniony w celu obejścia harnessu.
- Test A1 został opisany precyzyjnie: dowodzi odrzucenia `alg:none` przy
  `E2E_MODE=off`, ale nie usuwa ani nie rehabilituje osobnego bypassu E2E.

Werdykt pozostaje `BLOCKED_OWNER`: kod obu trybów jest gotowy, lecz domyślny
runtime nadal realizuje W3/status quo, dopóki właściciel nie wybierze W1 albo W2.
