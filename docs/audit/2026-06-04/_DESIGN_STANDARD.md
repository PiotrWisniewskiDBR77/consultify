# Consultify — Design Standard (kolor + kontrast tekstu)

**Ustalono:** 2026-06-04 (Piotr + Claude, na bazie pomiarów WCAG + HBS Identity Guidelines).
**Status:** obowiązujący standard dla całego przejścia 01→19. Aktualizować tu przy każdej zmianie reguły.

---

## 1. Kolor akcentu marki — HBS Crimson `#A41034`

**Jedyny akcent marki = `#A41034`** (rgb 164,16,52, Pantone 187U/1807C) — **oficjalny HBS Identity Guidelines** (identity.hbs.edu). Głębszy/ciemniejszy niż ogólny Harvard `#A51C30`; buduje zaufanie, „Harvard/HBS style".

- **Token:** `primary` (Tailwind) / `--primary` / `--accent` (shadcn HSL) = `#A41034`.
  - Light HSL: `345 82% 35%`. Dark (lifted): `345 72% 60%`.
- **Skala:** 50–500 = jaśniejsze tinty, 600 = `#A41034` (baza), 700–950 = ciemniejsze.
- **Zasada „lekko":** crimson TYLKO na CTA / active/selected / Teresa / momenty brandowe. Struktura = neutralne (navy/slate). NIE jako dekoracja ani tła całych sekcji.
- **ZAKAZANE jako akcent:** indigo / violet / fuchsia / purple / `#7C3AED` / `#C90016` (jaskrawa nazwa‑web, NIE HBS). Sweepujemy → `primary`.
- **Źródło prawdy:** `tailwind.config.js` (primary/brand/crimson scale + `hig-primary`), `src/index.css` (`--primary`, `--accent`, `--c-accent`).

> Pomiar live (po remapie): `.bg-primary-600` = `rgb(164 16 52)` ✓.

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
