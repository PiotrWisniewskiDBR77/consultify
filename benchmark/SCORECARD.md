# Consulting Benchmark Scorecard

_Generated: 2026-07-15T13:26:45.461Z_

**No graded runs yet.**

No run result files were found under the results directory. Run `npx tsx server/scripts/run-consulting-benchmark.ts` (optionally with `--generate`) to produce one, then re-run this script.

## Czego nie twierdzimy

- **Brak porównań konkurencyjnych.** Ta karta nie mówi, jak Consultify wypada na tle innych
  narzędzi/konsultantów AI (McKinsey Lilli, Harvey, generic GPT-wrappery) — nie mamy takiego
  pomiaru równoległego.
- **Brak baseline'u ludzkiego.** Nie porównujemy z odpowiedzią realnego konsultanta na te same
  zadania — pass-rate poniżej odnosi się WYŁĄCZNIE do rubryki tego benchmarku, nie do jakości
  "na tle człowieka".
- **Charakter wewnętrzny, regresyjny.** To narzędzie do wyłapywania REGRESJI między wersjami
  produktu (ten sam korpus, ten sam sędzia, w czasie) — nie certyfikat jakości ani twierdzenie
  marketingowe.
- **Sędzia to LLM, nie audytor.** Werdykty PASS/FAIL i oceny 1–5 pochodzą z modelu-sędziego
  (patrz `consultingBenchmarkJudgeService.ts`) — podlegają jego własnym ograniczeniom i wariancji,
  nie są niezależnie zweryfikowane przez eksperta co do każdego zadania.

