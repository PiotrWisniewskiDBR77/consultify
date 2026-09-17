# RB-2 export P1 v2 — RECEIPT W204

Data: 2026-09-17
Tor: B / Codex-2
Baza: `9847032a375a65c64178cdc18b161f9c2e50220a`

## Wynik

READY FOR CTO REVIEW. Zaktualizowano jedyną zastaną asercję GATE-NOTION do
kontraktu DEC-543: nieprzechodząca bramka jakości daje HTTP 200 z nagłówkami
`BLOCKED_P1` i liczbą ostrzeżeń, a żądany eksport Notion jest wykonywany.
Pozostałe przypadki testu, w tym ochrona cross-org, pozostają zielone.

## Dowody v2

- `server/src/routes/__tests__/cross-org-idor-m17.test.ts`: 8/8 PASS.
- Mutacja oczekiwania 200 → 409: 1/1 RED, RC=1; po przywróceniu 8/8 PASS.
- Server TypeScript exact-lock: RC=0; `@types/node` = `22.19.3`.
- `git diff --check`: PASS.

## Granica

Delta v2 zmienia wyłącznie test wskazany w W204. Kod produktu i zakres toru A
nie zostały zmienione względem paczki W195.
