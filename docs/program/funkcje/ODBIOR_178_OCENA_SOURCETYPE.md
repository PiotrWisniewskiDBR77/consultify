---
doc_id: funkcje-odbior-178
status: canonical
truth_type: acceptance
established: 2026-08-30
---

# ODBIÓR 178 — Ocena: sourceType · SCALONO

Gałąź `codex/day178-ocena-20260830` (3 commity nad `d3d36cd5f5`). Odbiór: własny
kontener 6097, mutacja odtworzona niezależnie (przywrócenie nadpisywania →
`expected 'DRD' to be 'assessment'`; restore → 2/2), SHA artefaktów 11/11 bit-w-bit.

Naprawa 1-liniowa (`InitiativeController.ts:363`) — **zakładka Inicjatywy w Ocenie
widzi wreszcie rekordy** (test-sonda: seed DRD → realny Gateway → filtr frontu
przechodzi). Bonus: fix naprawia przy okazji 2 inne ciche usterki konsumentów
(`InitiativeFullView` link źródła, `InitiativeCompactPanel` chip). Empty-state
Library uczciwy (katalog statyczny — nie było fetchu, więc nie było „błędu ładowania").

Oceny: backend **A** · front **A** · analiza konsumentów **B** (raport sugeruje
szerszą weryfikację niż wykonana — lukę znalazł odbiór) · uczciwość **A−**.

## Do rejestru (nie blokuje)
1. `ExecutionHub.tsx:5680-5681` — podgląd pokazuje surowe `Source: assessment`
   (przed fixem: `Source: DRD`); `sourceFramework` niewpięty — pozycja osobna.
2. **§0.4a — NAPRAWIONE przy tym scaleniu**: szkielet dostał realną sekcję
   pomiaru zasięgu (A.1-TER), zgłaszaną przez 5 dyżurów.
