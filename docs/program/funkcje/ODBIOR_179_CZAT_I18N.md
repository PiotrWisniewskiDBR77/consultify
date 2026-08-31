---
doc_id: funkcje-odbior-179
status: canonical
truth_type: acceptance
established: 2026-08-30
---

# ODBIÓR 179 — Czat i18n karty propozycji · SCALONO

Gałąź `codex/day179-czat-20260830` (2 commity nad `d3d36cd5f5`). Odbiór: mutacja
odtworzona (podmiana klucza → 0/4; przywrócenie → 4/4), pakiet AIChat 332/332,
zrzut realnego runtime obejrzany — karta w całości po polsku, dane fixture
słusznie nietłumaczone. Merge-tree przeciw tipowi: czysty (klucze 173 nie kolidują).

**Wykonawca obalił liczbę z instrukcji pomiarem:** kluczy jest 19, nie 18 —
wszystkie pokryte, w tym rozróżnienie `state.rejected` vs `rejected`.
EN świadomie nietknięty (fallback w t(); licencja tego zakazywała — słusznie).

Oceny: kompletność **A** · jakość PL **B** (jedna kalka w `provenance` —
poprawka stylistyczna do rundy polerowania) · dowody **A**.
Otwarte: `OWNER_RETEST_PENDING` — wizualny akcept właściciela przed demo.
