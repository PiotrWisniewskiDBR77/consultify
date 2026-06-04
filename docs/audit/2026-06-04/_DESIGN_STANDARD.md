# Consultify — Design Standard (kolor + kontrast tekstu)

**Ustalono:** 2026-06-04 (Piotr + Claude, na bazie pomiarów WCAG + HBS Identity Guidelines).
**Status:** obowiązujący standard dla całego przejścia 01→19. Aktualizować tu przy każdej zmianie reguły.

---

## 1. Kolor akcentu marki — Burgundy Crimson `#85182F`

**Jedyny akcent marki = `#85182F`** (rgb 133,24,47, HSL 347 69% 31%) — **deep burgundy crimson, „klasyczny Harvard"**, zaakceptowany przez właściciela. Świadomie ciemniejszy niż oficjalny HBS `#A41034` (który dla nas czytał za jasno) — buduje zaufanie, dojrzały, mniej krzykliwy.

Progresja (historia decyzji): `#A51C30` (Harvard ogólny, za jasny) → `#A41034` (HBS oficjalny, wciąż za jasny) → **`#85182F` (locked)**.

- **Token:** `primary` (Tailwind) / `--primary` / `--accent` (shadcn HSL) = `#85182F`.
  - Light HSL: `347 69% 31%`. Dark (lifted): `347 60% 55%`.
- **Skala (spójna):** 500 `#A82D49` → 600 `#85182F` (baza) → 700 `#6D1427`. Hover/pressed = 700 (wyraźnie ciemniejszy od bazy).
- **Zasada „lekko":** crimson TYLKO na CTA / active/selected / Teresa / momenty brandowe. Struktura = neutralne (navy/slate). NIE jako dekoracja ani tła całych sekcji.
- **ZAKAZANE jako akcent:** indigo / violet / fuchsia / purple / `#7C3AED` / `#C90016`. Sweepujemy → `primary`.
- **Źródło prawdy:** `tailwind.config.js` (primary/brand/crimson scale + `hig-primary`), `src/index.css` (`--primary`, `--accent`, `--c-accent`, `--c-focus`, `--ring`).

> Pomiar live (locked): `.bg-primary-600` = `rgb(133 24 47)` ✓; 500 `rgb(168 45 73)`, 700 `rgb(109 20 39)`.

## 2. Kontrast tekstu (light mode) — twarda reguła WCAG

Zmierzone realne kolory slate w apce, kontrast względem białego tła (#FFFFFF):

| Token | Hex | Kontrast vs białe | Werdykt | Użycie |
|---|---|---|---|---|
| slate‑900 | #0F172A | ~17:1 | AAA | Nagłówki, tytuły |
| slate‑700 | #334155 | ~9.5:1 | AAA | **Body/treść — DOMYŚLNY** |
| slate‑600 | #475569 | ~7:1 | AA mocne | **Secondary — minimum** |
| slate‑500 | #64748B | ~4.5:1 | granica AA | Muted/meta drobne TYLKO |
| slate‑400 | #94A3B8 | ~2.5:1 | ❌ **FAIL AA** | **ZAKAZANY dla tekstu** (placeholder/disabled/ikona‑dekoracja only) |

**Reguła (light):**
- **Body/treść → `slate-700`** (#334155). To domyślny, „trust".
- **Secondary → `slate-600`** minimum (nigdy niżej dla czytelnej treści).
- **Muted/meta → `slate-500`** floor — tylko drobne, mało istotne (np. timestampy).
- **`slate-400` (i jaśniejsze) ZAKAZANE dla czytelnego tekstu w light** — wolno tylko: placeholder inputów, disabled, ikony‑dekoracja, hairline.

**Reguła (dark mode):** body ≥ `slate-300` (#CBD5E1), secondary ≥ `slate-400` (#94A3B8 daje ~6:1 na navy‑900 — OK). `dark:text-slate-500/600` dla treści = za ciemne → bump.

## 2b. Ramki (borders) — standard + moja opinia

**Tokeny (źródło prawdy `src/index.css`):**
| Token | Light | Dark | Użycie |
|---|---|---|---|
| `--c-border` | `#e2e5e9` (≈ slate‑200) | `rgba(255,255,255,.10)` | domyślny border karty/panelu |
| `--c-border-subtle` | `#eef0f2` (≈ slate‑100) | `rgba(255,255,255,.06)` | hairline / divider |

**Reguła:**
- **Light:** border domyślny = `slate-200` (#E2E8F0) / `--c-border`; hairline = `slate-100` / `--c-border-subtle`. **NIE jaśniej niż slate‑200** dla elementów strukturalnych (zakaz `border-slate-200/50`, `border-slate-100` na kartach — znikają na białym).
- **Dark:** domyślny = `white/10`; hairline = `white/5`. Nie słabiej.
- **Active / selected / focus:** **jedyny kolorowy border = crimson** (`primary-500` / `--c-focus`/`--ring` #85182F). Zero off‑brand (indigo/violet) na borderach.
- **Spójność:** koniec miksu `border-slate-200` + `/70` + `border-white/5/10` + hardcoded rgba w jednym widoku — jeden system (slate‑200/100 light, white/10/5 dark).

**Moja opinia (szczerze):** kierunek Apple/OpenAI/Google 2026 = **minimalne ramki**, definicja przez **warstwy tła** (karta nieco inny `bg` niż strona), nie przez grube obrysy — i to jest dobre, zostawmy. ALE w light mode obecne bordery bywają **odrobinę za słabe na białym** (karty „pływają"). Dla „Harvard = struktura, zaufanie" rekomenduję: bordery **subtelne, ale widoczne** (slate‑200 floor, nie słabiej) + tam gdzie karta jest na białym tle bez różnicy warstwy — delikatny `--c-border`, nie hairline. Nie pogrubiamy (to nie „enterprise 2010"); pilnujemy tylko, by nie znikały. Tła/wypełnienia zostawiamy bez zmian (zaakceptowane).

## 3. Reguły sweepu (co zmieniać, czego NIE ruszać)

**Zmieniamy (text → ciemniej):**
- `text-slate-400` na elemencie z czytelnym tekstem (p, span z treścią, label, opis, wartość) → `text-slate-600` (secondary) lub `text-slate-700` (body).
- `text-slate-500` na ważnej treści body → `text-slate-700`.
- `dark:text-slate-500` / `dark:text-slate-600` na treści → `dark:text-slate-300` / `-400`.

**NIE ruszamy (slate‑400/500 są tu poprawne):**
- Placeholdery (`placeholder:text-slate-400`).
- Disabled state.
- Ikony czysto dekoracyjne (nie niosące treści).
- Hairline/bordery (`border-slate-*`), tła (`bg-slate-*`).
- Captiony 10px czysto pomocnicze (ocena per‑przypadek).

**Jak weryfikować:** po sweepie per‑moduł — `preview_inspect` koloru tekstu na próbce + porównanie z tabelą. Build zielony.

## 4. Status wdrożenia (uzupełniać)
- [x] Crimson `#A51C30` → `#A41034` centralnie (commit `05cca2d93b`).
- [x] Standard zapisany (ten plik) + DoD trackera zaktualizowany.
- [ ] Sweep kontrastu tekstu per‑moduł (01→19) — w toku przy każdym module.

---

**Powiązane:** `UI_STANDARD_TRACKER.md` (DoD pkt 3/4), `_PROCEDURE_MODULE_BY_MODULE.md`.
