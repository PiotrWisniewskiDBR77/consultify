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

## 2c. Przyciski i ikony — gdzie crimson jest WIODĄCY (kluczowy standard)

Crimson `#85182F` jest akcentem „lekko" — to znaczy: **wiodący dla akcji głównych i stanu aktywnego, ale NIE dla wszystkiego**. Czerwień (rose) jest osobna i semantyczna (stop/nagrywanie). Macierz:

| Element | Kolor | Token | Przykłady |
|---|---|---|---|
| **Akcja główna / CTA / submit** | **crimson** | `bg-primary-600` (hover 500) | Send, „New conversation", Start trial, primary buttons, start/connect voice |
| **Stan aktywny / selected / brand** | **crimson** | `primary-600` / `text-primary-600` | aktywna zakładka, aktywna ikona sidebara, „Piotr"/TERESA/DBR77 akcent, focus ring |
| **Disabled akcji głównej** | **przygaszony crimson** | `bg-primary-600/40` | voice gdy unavailable (NIE amber/slate) |
| **Stop / destrukcja / nagrywanie LIVE** | **rose/red** (NIE crimson) | `bg-rose-600` / `bg-rose-500` | Stop generating, live voice recording, dictation active, Delete |
| **Akcja drugorzędna / ghost / toolbar** | **neutral** | `text-slate-600` hover `text-primary-600`/`bg-primary-50` | +, pen, people, mic‑dictation, ikony narzędziowe |
| **Status (semantyczne)** | green/amber/red/blue | `--c-success/warning/danger/info` | success ✓, warning ⚠, error, info — NIGDY crimson dla statusu |
| **Ikony kategorii / narzędzi** | własne kolory kategorii | (np. Market=red, Finance=green, Digital=blue) | kafle „Market/Financial/Classic/Digital" — celowo różne, NIE brand |

**Reguły rozstrzygające:**
- **Crimson ≠ czerwień‑danger.** Crimson = marka/akcja/aktywność. Rose/red = stop/nagrywanie/usuwanie. Nie mieszać (crimson nigdy jako „delete", red nigdy jako „submit").
- **Jedna akcja główna na widok** dostaje crimson; reszta = neutral/ghost (zasada „lekko").
- **Amber/orange ZAKAZANY na przyciskach akcji** — tylko jako status‑warning (badge/tekst), nie jako tło przycisku. (Naprawione: voice connecting/unavailable były amber → crimson.)
- **Ikony kategorii zostają kolorowe** (różnicowanie), ale akcent interakcji (hover/active) = crimson.

## 2d. Minimalizm tekstu — „czym mniej, tym więcej" (PLATFORMOWE)

Zasada nadrzędna UX: **mniej słów = więcej**. Platforma w wielu miejscach robi nadmiar opisówki — tniemy.

- **Menu / listy akcji:** pozycja = **ikona + krótka etykieta**. BEZ drugiej linii opisu (chyba że naprawdę niezbędna do rozróżnienia). Wzorzec = AI MODES (ToolsMenu): same etykiety, kompaktowo.
- **Kierunek otwierania menu w composerze:** **do góry** (`bottom-full mb-2`), spójnie dla wszystkich 3 przycisków (+, AI modes, co‑thinker).
- **Podpowiedzi/hinty:** jedna krótka linia max; bez „Supported: PDF, TXT, MD, CSV, JSON" rozpisanego — skrót lub tooltip.
- **Karty/kafle:** tytuł + max 1 linia. Bez akapitów.
- **Nagłówki sekcji:** rzeczownikowe, krótkie. Bez zdań‑wstępów.
- **Reguła sweepu:** przy każdym module — szukać wielolinijkowych opisów pod akcjami/menu/kaflami → skracać do etykiety (+ ewentualnie tooltip). Nie usuwać informacji krytycznej; usuwać redundancję.

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

## 4. Status wdrożenia

> ✅ **PALETA ZAAKCEPTOWANA przez właściciela (Piotr) 2026-06-04 — light + dark.**
> Dotyczy ekranu Czatu/Teresa jako wzorca: crimson `#85182F`, neutrale navy/slate, kontrast tekstu, ramki, tła/wypełnienia. Kolejne elementy graficzne (poza paletą) — do omówienia osobno.

- [x] Crimson `#A51C30` → `#A41034` → **`#85182F` (locked)** centralnie (commity `05cca2d93b`, `e3bc80289f`, `6eed5b0d3b`).
- [x] Skala crimson spójna (500/600/700) — commit `6eed5b0d3b`.
- [x] Standard kontrastu tekstu + ramek + przycisków/ikon zapisany; DoD trackera zaktualizowany.
- [x] Wordmark Czatu przyciemniony (`5466e88684`); voice button on-brand crimson (`27f76417c1`).
- [ ] Sweep kontrastu tekstu per‑moduł (01→19) — w toku przy każdym module.
- [ ] Egzekwowanie standardu przycisków/ikon per‑moduł (amber→crimson na akcjach, slate→crimson na active).

---

**Powiązane:** `UI_STANDARD_TRACKER.md` (DoD pkt 3/4), `_PROCEDURE_MODULE_BY_MODULE.md`.
