# Step 1b — dowód wizualny (render + VisionQA before/after)

**Program:** Prezentacje / Deck composition redesign (SSOT `docs/product/DECK_COMPOSITION_REDESIGN.md` §Miernik).
**Zadanie:** P1.2 — udowodnić, że composition B1 (Step 1a) zmienia REALNY wygląd slajdów, gdy renderer ją honoruje (Step 1b).
**Data:** 2026-07-04 · **Gałąź:** `worktree-agent-a162b8b3317028327` (merge `feat/prezentacje-finisz` @ `6b15a232e0`).

> **Bramka Piotra:** to jest jego gate akceptacji. Nic nie idzie na demo bez jego zgody na te zrzuty.

---

## Co to udowadnia

Ten sam realny deck (VTS Group — diagnoza transformacji cyfrowej, 7 slajdów) renderowany DWA razy przez PRAWDZIWY `CardRenderer`:

- **BEFORE** = `composition = null` → renderer używa dzisiejszej heurystyki (intent + liczba bloków + anty-powtórka).
- **AFTER** = `composition` obecna → `selectLayout` honoruje `layoutVariantId`, `assignBlocksToRegions` honoruje `regions` (Step 1b).

`composition` w fixture to **autentyczny output B1** (`planDeckLayout`, `claude-sonnet-4-6`, tier PREMIUM, fallback=false) przechwycony 2026-07-04. Bloki to reprezentatywna treść konsultingowa dla tego tematu (B1 nie autoruje bloków — autoruje układ).

## Wynik — dowód deterministyczny (bez przeglądarki, bez kluczy)

`_prove-composition-layout.mts` uruchamia PRAWDZIWE funkcje renderera na fixture:

| Metryka | Wynik |
| --- | --- |
| Zmieniony szablon layoutu | **5 / 7 slajdów** |
| Zmienione przypisanie bloków do regionów | **5 / 7 slajdów** |
| Jakakolwiek widoczna zmiana | **5 / 7 slajdów** |

Slajdy 0 (cover) i 5 (recommendation) trafiają w **ten sam** szablon w obu ścieżkach — heurystyka już wybiera dobry układ dla prostej okładki / pojedynczej rekomendacji, więc composition go nie nadpisuje. To uczciwe: composition zmienia layout tam, gdzie ma znaczenie, i zostawia dobre domyślne bez zmian. Zgadza się to z bajt-identycznymi parami PNG (`slide0_*`, `slide5_*`).

## Wynik — deck-visual VisionQA (rubryka ze specu §Miernik)

Model: `claude-sonnet-4-6` (vision). Rubryka: readability / hierarchy / balance / no_overflow / layout_fit. Pełne dane: `visionqa-results.json`.

| Wymiar | BEFORE | AFTER | Δ |
| --- | --- | --- | --- |
| **overall** | 0.490 | 0.516 | **+0.026** |
| readability | 0.570 | 0.609 | +0.039 |
| hierarchy | 0.500 | 0.521 | +0.021 |
| balance | 0.231 | 0.243 | +0.011 |
| no_overflow | 0.829 | 0.857 | +0.029 |
| layout_fit | 0.350 | 0.357 | +0.007 |

Największy zysk tam, gdzie layout faktycznie się zmienił:

- **slide 3** (`single_insight` → `big_number`): 0.48 → **0.64** (+0.16)
- **slide 6** (`next_steps` → `timeline_strip`): 0.31 → **0.38** (+0.07)

Uczciwe sygnały ostrzegawcze (NIE ukrywane):

- **slide 1** (`two_column`): 0.63 → 0.55 (−0.08) — dwukolumnowy split rozrzedził treść na tym konkretnym slajdzie; heurystyczny pojedynczy stos wypadł lepiej dla tego zestawu bloków.
- **slide 2** (`kpi_grid_2x2`): 0.63 → 0.59 (−0.04) — siatka KPI poprawna semantycznie, ale wykres jako placeholder w harnessie obniża balans.

## Ważne zastrzeżenie interpretacyjne (dla Piotra)

Bezwzględne wyniki są niskie (balance ~0.23) bo **harness renderuje bloki od góry na scenie 720px** — dużo pustej przestrzeni na dole. Ta cecha renderu jest IDENTYCZNA w before i after, więc **zaniża wyniki bezwzględne, ale NIE zaburza Δ before/after**. Wykresy renderują się jako placeholder (harness nie ma danych live-chart) — też identycznie po obu stronach. Δ jest miarodajne; bezwzględny poziom nie jest oceną gotowości produkcyjnej pełnego decka.

**Wniosek:** Step 1b DZIAŁA (composition mierzalnie steruje layoutem, 5/7 slajdów, VisionQA Δ dodatnie zwłaszcza tam gdzie layout się zmienił), ale zysk netto na tym decku jest UMIARKOWANY z lokalnymi regresjami (slide 1/2). To materiał do decyzji Piotra, nie automatyczny „zielony".

---

## Jak wygenerować/odtworzyć zrzuty (dokładne komendy)

Wszystkie skrypty w `scripts/deliverables/step1b/`. Uruchamiane z roota repo.

### 1. Dowód deterministyczny (bez kluczy, bez przeglądarki)
```bash
node --import tsx scripts/deliverables/step1b/_prove-composition-layout.mts
```

### 2. Render PNG (przeglądarka; bez kluczy)
Wymaga chromium Playwright (`npx playwright install chromium`, jeśli brak).
```bash
node --import tsx scripts/deliverables/step1b/render-slides.mts
# → docs/qa/deliverables/runs/2026-07-04-step1b/png/slide<N>_<before|after>.png
```

### 3. deck-visual VisionQA (WYMAGA klucza wizyjnego)
```bash
export ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv \
  | grep -E '^ANTHROPIC_API_KEY=' | head -1 | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
node --import tsx scripts/deliverables/step1b/visionqa-deck.mts
# → docs/qa/deliverables/runs/2026-07-04-step1b/visionqa-results.json
```
Model musi być widoczny dla klucza — staging key dziś obsługuje `claude-sonnet-4-6` (użyty). Gdyby zwrócił 404 na model, sprawdź listę: `curl -s https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01"`.

### 4. Wszystko naraz
```bash
export ANTHROPIC_API_KEY=$(railway variables --environment staging --service consultify --kv \
  | grep -E '^ANTHROPIC_API_KEY=' | head -1 | sed 's/^ANTHROPIC_API_KEY=//' | tr -d ' "')
bash scripts/deliverables/step1b/run-all.sh
```

### Odświeżenie autentycznej composition B1 (opcjonalne)
Fixture ma composition przechwyconą 2026-07-04. By pobrać świeżą z B1:
```bash
export ANTHROPIC_API_KEY=...  # jak wyżej
node --import tsx scripts/deliverables/_diag-deck-composition.mts
# przepisz layoutVariantId/regions/emphasis per slajd do scripts/deliverables/step1b/fixture.vts.ts
```

## Pliki
- `png/slide<N>_<before|after>.png` — 14 zrzutów (2× device scale, 1280×720 16:9).
- `visionqa-results.json` — pełne wyniki per slajd + per wymiar.
- Skrypty: `scripts/deliverables/step1b/{fixture.vts.ts, _prove-composition-layout.mts, render-slides.mts, visionqa-deck.mts, run-all.sh, harness/}`.
