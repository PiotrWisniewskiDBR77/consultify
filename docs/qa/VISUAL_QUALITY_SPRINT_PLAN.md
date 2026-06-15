# Visual Quality — Plan Sprintów (Enterprise 2026)

> **Cel:** SaaS Enterprise 2026, jakość Apple/Google, „mniej znaczy więcej".
> **Model pracy (decyzja Piotra 2026-06-14):** najpierw **spisać wszystko po kolei** (katalog) → potem **ustalić zasady** → dopiero **przebudowa**, realizowana **per-obszar, sekwencyjnie** (inaczej tracimy kontekst).
> **Zasada zachowania kontekstu:** ten plan + katalog (Faza A) to SSOT, który przenosi kontekst między sprintami. Jeden obszar naraz, do końca, zanim następny.

---

## Faza 0 — Fundament (ZROBIONE w tej sesji)

| Element | Stan | Commit |
|---|---|---|
| CANON.md = jedyny autorytet UI/UX (F1–F4) | ✅ | 47bb…→cbcc… |
| Purga 236 snapshot-dupów (gitignored debris) | ✅ | lokalnie |
| Motion ratchet `lint:motion(:ci)` + paydown 2589→2135 | ✅ | 4e1c…→2503… |
| Doc-link integrity `docs:links` | ✅ | cbcc… |
| Build-integrity: 16 untracked-importowanych → tracked | ✅ | 4fed… (równoległa sesja) |
| Pilot Visual QA (dark+light, obiektywny pomiar) | ✅ | — |

**Wnioski z pilota (kierują planem):**
1. **Light ma znacząco więcej problemów niż dark** (potwierdzone: 2 ekrany → 2× P1 w light, dark głównie PASS).
2. **Obiektywny pomiar (computed color) jest konieczny** — uratował przed fałszywym raportem („wyprany tekst" = faktycznie slate-700). Sam screenshot nie wystarcza.
3. **Systemowe root-cause'y** — np. 187 komórek dat crimson = jeden współdzielony komponent, nie 187 bugów (jak `transition-all` w motion).

---

## Faza A — INWENTARZ (1 sprint) · „spisać wszystko po kolei"

### Sprint A1 — Visual QA Full Sweep
**Cel:** kompletny, obiektywny katalog długu wizualnego. ZERO naprawiania.

**Zakres:**
- Wszystkie moduły wg `VISUAL_AUDIT_PROCEDURE_V1.md` (M01–M2x) **× light + dark** (light = oś priorytetowa).
- Capture: powtarzalny harness Playwright (`?tab=` deep-link gdzie działa, inaczej rail-click + `storageState`).
- Ocena: AI proponuje z obrazu → **ZMIERZ** (`preview_inspect`/computed color/contrast) → potwierdź/odrzuć → kanon-ref.

**Deliverable:** `docs/qa/MASTER_VISUAL_QA_CATALOG.md` — findings `VIS-[nr]` z: moduł, theme, severity (P0–P3), pomiar, kanon-ref, dowód (screenshot), hipoteza root-cause (systemowy vs lokalny).

**Exit:** każdy moduł ma zrzuty light+dark + zmierzone findings w katalogu. Findings otagowane „systemowy" vs „lokalny".

**Szacunek:** 2–3 dni.

---

## Faza B — ZASADY (1 sprint)

### Sprint B1 — Reguły + Egzekwowanie ✅ (2026-06-14)
**Cel:** z wzorców w katalogu wyprowadzić twarde reguły.

**Ustalenie kluczowe:** `lint:colors` **odrzucony** — kolor NIE jest static-lintowalny (raw green 3645, slate-400 12612, hex 97 = w 99% legalne: dark-variant/placeholder/brand). Lint byłby cry-wolf. W przeciwieństwie do motion (`transition-all` lintowalny), **ratchetem koloru jest VISUAL SWEEP** (re-run katalogu) + istniejący `audit-ui-compliance.js`.

**Zrobione:**
- Reguły systemowe → `light-mode-readability.md §18` (VIS-001 badge fill w light, VIS-002 zakaz dark-only/metadata≠crimson, VIS-006 primary-CTA=navy). MUST dla C0.
- CANON §6 binding: wiersz „Kolor/light-mode" → sweep + audit-ui-compliance (nie lint).

**Exit:** ✅ reguły w kanonie; model egzekwowania (sweep) udokumentowany.

---

## Faza C — PRZEBUDOWA (per-obszar, sekwencyjnie)

> Każdy sprint C = **pełny pass jakości jednego obszaru** (light+dark): kolor/kontrast + motion paydown + component-canon + stany empty/loading/error. Dotykamy obszar **raz**, naprawiamy wszystko, weryfikujemy obiektywnie (pomiar przed/po), opuszczamy ratchety. Tak nie tracimy kontekstu.

### C0 — Systemowe root-cause'y (NAJPIERW)
Współdzielone komponenty, których jeden fix czyści findings w wielu obszarach: komponent daty/Received (crimson→slate), komponent badge (§5 tło+border w light), cytaty/Reasoning (crimson→info), composer (gęstość). **Robione przed per-obszarowymi**, by nie re-katalogować.

### C1–C9 — obszary (kolejność wg ruchu/widoczności)
| Sprint | Obszar | Uzasadnienie kolejności |
|---|---|---|
| **C1** | Chat & Canvas (M01/M02) | rdzeń codzienny + aktywny dev — najwyższa widoczność |
| **C2** | My Work (Inbox/Tasks/Calendar/Decisions/Ideas/Notebook/Home/Manager) | drugi rdzeń, dużo tabel |
| **C3** | Interview (Inbox/Sesje/Przydzielone/Szablony/Wnioski/Inicjatywy) | duży, wielozakładkowy |
| **C4** | Initiatives | portfolio/gantt/karty |
| **C5** | Tools / Assessment / Discovery | biblioteka + wizardy |
| **C6** | Outputs (Documents / Document/Presentation/Table Studio) | artefakty + edytory |
| **C7** | Execution / Results / Finance | dashboardy + KPI |
| **C8** | Admin / Settings / Organization | niższy ruch |
| **C9** | SuperAdmin / Partner | najniższy ruch, role-gated |

**Exit każdego C:** findings obszaru z katalogu = zamknięte i zweryfikowane (pomiar); ratchety light+motion dla obszaru = 0 nowych; zrzut przed/po.

**Szacunek:** 1–3 dni/sprint wg rozmiaru i długu obszaru.

---

## Backlog równoległy (nie blokuje, śledzony)

- **Motion paydown** (2135 pozostałych) — wchłaniany przez sprinty C per-obszar (dotykamy plik → płacimy też motion).
- **108 untracked .tsx (B+C)** — przegląd dead-code/WIP; robić gdy uciszy się równoległa sesja czat (git races).
- **Dystrybucja Golden/Operating → warstwy 00–03** — duże zadanie contentowe kanonu (osobno).

---

## Changelog
| Data | Zmiana |
|---|---|
| 2026-06-14 | Plan utworzony. Faza 0 done; A/B/C zdefiniowane; pilot potwierdził priorytet light + konieczność pomiaru. |
