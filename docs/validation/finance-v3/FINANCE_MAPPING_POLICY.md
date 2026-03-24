# Finance Mapping Policy — Confidence Tier System

> **SSOT**: `server/src/services/financeMappingPolicy.ts`
> **Last audit**: 2026-03-15 (`REAL_STATEMENT_IMPORT_AUDIT.md`)

---

## 1. Filozofia

System NIE próbuje mapować 100% każdej możliwej linii finansowej.
Zamiast tego stosuje **świadomy system tierów**, który:

| Cel | Wartość |
|-----|---------|
| Auto-mapped (Tier 1 + 2) | **≥ 95%** typowych linii |
| Pozostałe | trafiają do **review queue** (Tier 3) |
| Szum (nagłówki, daty, noty) | automatycznie **wykluczane** (Tier 4) |

Zasada: **lepiej poprosić użytkownika o potwierdzenie niż źle zmapować**.

---

## 2. Cztery tiery

### Tier 1 — AUTO (heurystyka)
- Dopasowanie aliasowe z bazy + hardcoded hints
- Determinystyczne, bez kosztów API, natychmiastowe
- Pokrywa ~70% linii przy pierwszym kontakcie, ~95% po nauce

### Tier 2 — LLM_CONFIRMED (LLM, confidence ≥ 0.75)
- LLM zaproponował mapowanie z wysoką pewnością
- Automatycznie zaakceptowane, wyświetlane użytkownikowi do pasywnego review
- Po potwierdzeniu → promowane do Tier 1 (learned alias)

### Tier 3 — REVIEW_REQUIRED (LLM 0.50–0.75, konflikty, brak mapowania)
- Wymaga jawnej akceptacji/odrzucenia przez użytkownika
- Żółte podświetlenie w UI
- Przypadki:
  - LLM niska pewność
  - Konflikt duplikatów bez alternatywy
  - Linia bez żadnego kandydata

### Tier 4 — EXCLUDED (szum)
- Nagłówki stron, daty, referencje do not, sumy częściowe
- Automatycznie ukryte z tabeli mapowania
- Użytkownik może override'ować

---

## 3. Progi decyzyjne

| Parametr | Wartość | Opis |
|----------|---------|------|
| `HEURISTIC_AUTO_ACCEPT` | 0.60 | Wynik heurystyczny powyżej → Tier 1 |
| `LLM_AUTO_ACCEPT` | 0.75 | Confidence LLM powyżej → Tier 2 |
| `LLM_REVIEW_MIN` | 0.50 | Poniżej → Tier 3 (review) |
| `LLM_REJECT` | 0.40 | Poniżej → odrzucone |
| `LLM_BATCH_SIZE` | 30 | Max linii w jednym callu LLM |
| `TARGET_COVERAGE_PCT` | 90% | Poniżej → ostrzeżenie |
| `AUTO_CONFIRM_COVERAGE_PCT` | 95% | Powyżej + 0 review → auto-confirm |

---

## 4. Pipeline decyzyjny

```
Linia wyekstrahowana
  │
  ├── isNonFinancial? ──yes──→ Tier 4 (excluded)
  │
  ├── isSubtotal + no mapping? ──yes──→ Tier 4 (excluded)
  │
  ├── heuristic match? ──yes──→ Tier 1 (auto)
  │
  ├── LLM 1st pass → conf ≥ 0.75? ──yes──→ Tier 2 (llm_confirmed)
  │                 → 0.50 ≤ conf < 0.75? → Tier 3 (review_required)
  │                 → conf < 0.50? ──────→ Tier 3 (review_required)
  │
  ├── duplicate resolution → winner stays, loser → LLM 2nd pass
  │
  └── LLM 2nd pass → same thresholds as above
```

---

## 5. Learning Loop

```
Użytkownik potwierdza/koryguje mapowanie
  │
  └── learnStatementAliases()
        │
        └── INSERT INTO financial_statement_line_aliases
              (label_normalized, canonical_line_id, source='user_confirmed')
```

**Efekt**: Następnym razem ta sama etykieta → Tier 1 (heurystyka), bez LLM.

Każde potwierdzenie wzmacnia system. Po ~50 sprawozdaniach oczekujemy,
że >98% linii będzie Tier 1.

---

## 6. Wyniki audytu (2026-03-15)

| Dokument | BS | P&L | CF |
|----------|----|----|-----|
| Apator SA R 2024 | ✅ 100% auto | ✅ 100% auto | ✅ 100% auto |
| Grupa Apator RS 2023 | ⚠️ 19% (sekcje za szerokie) | ✅ 100% auto | ✅ 100% auto |
| Grupa Apator RS 2024 | ✅ 100% (1 LLM) | ✅ 100% auto | ✅ 100% auto |
| Raport skons. Apator | ⚠️ 38% (sekcje za szerokie) | ✅ 100% auto | ✅ 100% auto |

### Kluczowe obserwacje

1. **P&L i CF — production ready** — 100% auto-confirm we wszystkich dokumentach
2. **BS — problem z detekcją sekcji, nie z mapowaniem** — w dwóch raportach skonsolidowanych
   sekcja BS ciągnie setki linii z not objaśniających (szczegóły zapasów, należności,
   kapitałów, leasingów). To nie problem mapowania — to problem `locateStatementSections`
3. **Learning loop działa** — LLM mappings z jednego audytu stają się aliasami heurystycznymi

### Znane edge-cases (świadomie nie obsługiwane)

- Linie z not objaśniających (rozbicie zapasów na materiały/WIP/FG z dokładnymi kwotami)
- Dane o akcjonariuszach (np. "Tadeusz Sosgórnik 2023 → 1490000")
- Efektywna stopa podatkowa, stawki nominalne, analiza wrażliwości
- Detale leasingu (minimalne opłaty, wartości bieżące netto)

Te przypadki to **Tier 3 review** — system je pokazuje, ale nie próbuje zmapować na siłę.

---

## 7. Strategia rozwoju

| Faza | Opis | Szacowany wpływ |
|------|------|-----------------|
| **Teraz** | Policy tiers + learning loop | 95% auto dla typowych dokumentów |
| **Następna** | Poprawka `locateStatementSections` — lepsza granica BS kontra noty | +15% pokrycia BS dla raportów skonsolidowanych |
| **Później** | Subtotal formula engine — auto-wykrywanie sum i weryfikacja | Walidacja arytmetyczna |
| **Docelowo** | User dashboard z review queue | Pełna kontrola nad Tier 3 |
