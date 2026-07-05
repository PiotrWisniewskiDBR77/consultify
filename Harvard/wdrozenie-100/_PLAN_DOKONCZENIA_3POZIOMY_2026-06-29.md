# PLAN DOKOŃCZENIA — 3 poziomy odbioru, przekrojowe sweep-y (2026-06-29)

> **Po co:** system jest ogromny, robimy go miesiące, bez konkretnego planu nigdy nie skończymy. Ten dokument = **jak przejść całość od początku do końca**, systematycznie i skończenie. Nadrzędny dashboard: [`_STAN_PRACY_ODBIORY.md`](_STAN_PRACY_ODBIORY.md).
> **Decyzja bazowa (Piotr 2026-06-29):** M18/M19/M20 **pochłonięte przez M17** — ich odbiory standalone znikają.

## 1. Diagnoza — dlaczego „leci miesiącami"

Robiliśmy **wszerz** (wiele modułów na ~80% na wszystkich warstwach naraz) → nic się nie domyka, wszystko „prawie". Ból nie jest „brak kodu" — jest **rozjazd między warstwami**, a najgorsza warstwa (nawigacja/uprawnienia) jest **przekrojowa**: ten sam bałagan powtórzony w wielu narzędziach. Domykanie go moduł-po-module = naprawianie tego samego N razy.

**Lekarstwo:** przestajemy myśleć „moduł → 8/8". Myślimy **macierz: powierzchnie × warstwy**, którą wypełniamy **przekrojowymi sweep-ami** (jedna warstwa, wszystkie powierzchnie), w ustalonej kolejności. Każdy sweep = skończona checklista + widoczny skok spójności.

## 2. Trzy poziomy + integracja (model Piotra)

- **L1 — Nawigacja + uprawnienia.** Jak otwiera się narzędzie, gdzie są akcje (hamburger vs strip vs toolbar), back/breadcrumbs, paleta Cmd+K, bramki ról/beta. **Dziś: bałagan i niespójność między narzędziami.** Wzorzec udowodniony na Notatniku (hamburger ⋯, kasacja zdublowanego 3-strip, czyste menu) → **rozlać na wszystkie powierzchnie**.
- **L2 — Funkcjonalność.** Każda akcja robi to co obiecuje: zero martwych przycisków (404/401/no-op), zero fasad (mock zamiast DB), błędy czytelne. **Tu wpada drenaż Twoich odbiorów** — wiele L2 jest już gotowe, czeka tylko na przeklikanie.
- **L3 — Rozwój narzędzi.** Jedyny realny duży build: **M12A Tools consultingowe** (domknięcie 31 frameworków do standardu) + **M12B Assessmenty** (SIRI/DRD/ADMA: raport+mapa+klasa wizualna). Koncepcje gotowe.
- **L4 — Integracja cross-tool (spina poziomy).** link-graph, convert, Materiały, handoffy M13→M14→M15. **W dużej mierze gotowa** — domykamy braki przy okazji + final polish/i18n/klasa wizualna.

## 3. Artefakt sterujący: MACIERZ powierzchnie × warstwy (burn-down)

Wiersze = **powierzchnie** (nawigowalne narzędzia), kolumny = **L1 / L2 / L3 / L4**. Komórka: ⬜ nie · 🟡 w toku · ✅. To jest **meta na jednym ekranie** — widać dokładnie ile zostało. Wypełniamy głównie **kolumnami** (sweep), nie wierszami.

| Powierzchnia | L1 nawig+upr | L2 funkcja | L3 rozwój | L4 integ+polish |
|---|:--:|:--:|:--:|:--:|
| Czat / Canvas (M01/M02) | ✅ | ✅ | — | 🟡 |
| My Work: Notatnik (M04) | ✅ | ✅ | — | 🟡 |
| My Work: Ideas ×4 (M06–M09) | 🟡 | 🟡 | — | ⬜ |
| My Work: organizer/Inbox/Tasks/Decisions (M03) | ✅ | ✅ | — | 🟡 |
| Wywiad (M10) ⚠ żywy P0 VTS | ⬜ | ⬜ | — | ⬜ |
| **Assessmenty (M12B)** | 🟡 | 🟡 | 🟡 | ⬜ |
| **Tools consultingowe (M12A)** | 🟡 | 🟡 | 🟡 | ⬜ |
| Audyty (M12) | ⬜ | ⬜ | — | ⬜ |
| Inicjatywy (M13) | 🟡 | 🟡 | — | 🟡 |
| Wdrożenie/Execution (M14) | 🟡 | 🟡 | — | 🟡 |
| Rezultaty (M15) | ✅ | ✅ | — | 🟡 |
| Finanse (M16) | 🟡 | 🟡 | — | ⬜ |
| Materiały (M17, w tym silniki M18/19/20) | 🟡 | 🟡 | — | 🟡 |
| Organizacja / Admin / Ustawienia (M23/24/25) | ⬜ | ⬜ | — | ⬜ |
| Meeting (M21) | ⬜ | ⬜ | — | ⬜ |
| AI OS (M22) | ⬜ | ⬜ | — | ⬜ |
| Portal Partnerski (M26) / SuperAdmin (M27) | ⬜ | ⬜ | — | ⬜ |

*(Stan startowy szacunkowy — Krok 0 zastąpi go pomiarem z kodu.)*

## 4. Kolejność wykonania — sweep po sweepie (WIP = 1)

**Krok 0 — Pomiar AS-IS (raz, ja, automat).** Agent-sweep po kodzie (sidebar/routing/guardy/toolbary/betaAccess) → wypełnia macierz **faktem** (które przyciski martwe/niespójne/bez uprawnień, per powierzchnia). Bez tego L1 to zgadywanie. **+ scalenie kanonu** nawigacji+uprawnień w 1 autorytet (mamy `CANON.md`/table-canon/workspace-strip — rozjechane).

**SWEEP 1 — L1 nawigacja+uprawnienia (PIERWSZY, bo największy ból + odblokowuje L2).** Naprawiamy WZORZEC raz, przejeżdżamy WSZYSTKIE powierzchnie jednym przebiegiem: spójne otwieranie narzędzia, akcje w jednym miejscu (hamburger-wzorzec), back/breadcrumbs, Cmd+K, bramki ról. **Efekt: aplikacja nagle wygląda spójnie i „skończona".**

**SWEEP 2 — L2 funkcjonalność (teraz testowalne).** Per powierzchnia: każda akcja działa, zero fasad, błędy czytelne. **Równolegle drenaż Twoich odbiorów →F** — przygotuję per powierzchnia „pakiet odbioru" (co kliknąć / gdzie / czego oczekiwać / screeny), Ty odbierasz seriami.

**SWEEP 3 — L3 rozwój narzędzi (vertical build).** M12B Assessmenty → M12A Tools (wg gotowych koncepcji). Jedyny duży build; reszta to sweep-y.

**SWEEP 4 — L4 integracja + klasa wizualna + i18n.** Domknięcie cross-tool + jakość outputów do klasy konsultanta. Jeden przebieg.

## 5. Kręgosłup i meta: jedna ścieżka konsultanta end-to-end

Definiujemy **złotą ścieżkę** (od początku do końca): **Czat → Ideas → Assessment (diagnoza) → Tool (np. SWOT) → Inicjatywa → Wdrożenie → Rezultaty → Finanse → Materiały (raport/deck)**. 

To jest jednocześnie **final gate**: GA-v1 = ta cała ścieżka przechodzi end-to-end, na realnych danych, w klasie konsultanta. Dopóki ścieżka się „rwie" gdzieś — wiemy dokładnie którą komórkę macierzy domknąć.

## 6. Mechanika, żeby SKOŃCZYĆ (nie kolejny miesiąc)

1. **WIP = 1 sweep.** Domykamy jedną kolumnę (w zakresie GA-v1), zanim ruszymy następną.
2. **Zamrożenie zakresu.** M12A/M12B = ostatnie dodatki. Nowe pomysły → backlog post-GA, nie do bieżącego przebiegu.
3. **SLA odbioru 48h.** „Gotowe" → Ty odbierasz w 48h, inaczej kolejka rośnie.
4. **Decyzje wsadowo.** Zbieram otwarte decyzje (M16 D1–D5, M13 A2/B1/C3, Assessment D2–D4) i podaję z rekomendacją; zatwierdzasz seriami.
5. **Role:** ja pcham sweep-y + buildy + pakiety odbioru (autonomicznie, też nocą); Ty odbierasz i decydujesz w skupionych blokach.
6. **Burn-down codziennie:** liczba komórek `powierzchnia × warstwa` w GA-v1 = N; odhaczamy → meta widoczna.

## 7. GA-v1 vs beta-po-starcie (rekomendacja)

- **GA-v1 (pełna ścieżka konsultanta):** M01–M09 · M12/M12A/M12B · M13–M17. + **M10 Wywiad** jako pilne (żywy P0 VTS u płacącego klienta — niezależnie od planu).
- **Beta-po-starcie:** M21 Meeting · M22 AI OS · M23/24/25 platforma/admin · M26 Portal · M27 SuperAdmin.

## 8. Pierwszy krok (do startu potrzebuję 3 decyzji Piotra)
1. Akceptacja modelu **sweep-y po warstwach** + zestawu **GA-v1**.
2. Od czego zaczynam: **Krok 0 (pomiar AS-IS + kanon)** od razu, czy najpierw **P0 VTS w M10**?
3. Potwierdzenie **M18/M19/M20 = pochłonięte przez M17** (odbiory znikają) — przyjęte, czy chcesz je jednak osobno?

→ Po decyzjach: zamieniam macierz w **żywy burn-down** (odhaczany codziennie) i ruszam od pierwszego sweepu.
