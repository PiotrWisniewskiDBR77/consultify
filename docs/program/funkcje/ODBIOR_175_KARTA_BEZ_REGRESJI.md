---
doc_id: funkcje-odbior-175
status: canonical
truth_type: acceptance
established: 2026-08-30
---

# ODBIÓR 175 — karta zadania bez regresji · SCALIĆ PO FIX-175 (wydany)

Gałąź `codex/day175-karta-bez-regresji-20260830` (3 commity nad `d3d36cd5f5`).
Odbiór: własny kontener 6084, migracja od pustej bazy 870/0 idempotentnie, testy 2/2 PG
odtworzone; **mutacja odbioru OSTRZEJSZA niż wykonawcy** (usunięcie `setLastSavedSnapshot`
→ test łapie DRUGIE wywołanie po 900 ms → pętla realnie staje). Obie regresje 163
usunięte. Licencja czysta (8 plików, 393+/0-), rozłączna z 173 i FIX-170.
Oceny: backend **B** · frontend **B−** · dowody **A−** (raport wzorowo uczciwy).

## Dwa braki blokujące demo → FIX-175 (wewnętrzny robotnik)
1. **Z-1 ★★ stały czerwony toast przy KAŻDYM zapisie zadania**: PUT do zabramkowanej
   trasy leci bezwarunkowo, nawet gdy ryzyka nietknięte → wieczny błąd o czymś,
   czego UI nie obiecuje. FIX: PUT tylko gdy sekcja realnie edytowana; 409 wtedy
   uczciwym komunikatem, brak edycji = brak PUT.
2. **Z-3 ★ zero dowodu izolacji najemcy** na GET risk-alternatives (mutacja zdjęcia
   `organization_id` → testy nadal zielone). FIX: asercja cross-org.

## Do rejestru (nie blokuje)
- **Z-2 ★★ warstwa tyłu martwa z konstrukcji**: jedyny pisarz `tasks.risks/alternatives`
  za bramą 409 → karta NADAL gubi ryzyka po zamknięciu. To skutek decyzji „brama
  zostaje" — realne domknięcie przyjdzie z migracją legacy→kanon (decyzja D-7);
  dyżur analizy migracji MUSI objąć te kolumny.
- Z-4 zbędny round-trip przy otwarciu karty · Z-6 SQL tylko-PG (latentne) ·
  **Z-8 błąd generatora instrukcji: odsyłacze do nieistniejącego §0.4a** (potwierdzone
  — poprawić w szkielecie).
