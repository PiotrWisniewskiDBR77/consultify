# MACIERZ BŁĘDÓW — view × element kanonu (przegląd 2, 2026-07-28)

> Metoda zamówiona przez Piotra: dla KAŻDEGO widoku sprawdzić pięć rzeczy —
> **Menu 1 · Menu 2 · Menu 3 · tabela · kebab · preview** — wytypować błędy,
> zrobić listę, poprawiać krok po kroku.
>
> Źródło: `rejestr/_zrzuty/2026-07-28/` (74 zrzuty Piotra, demo `0bc0a4df0b44`).
> `✓` = zgodne z kanonem · `✗` = naruszenie · `—` = nie dotyczy / nie na zrzucie.

---

## MACIERZ

| View | Menu 1 | Menu 2 | Menu 3 | Tabela | Kebab | Preview |
|---|---|---|---|---|---|---|
| **My Work → Ideas** | ✓ | ✓ 1 CTA | ✗ `Folder`/`Recent` po prawej (A3: tam tylko AI) | ✗ nagłówki Title Case | ✗ brak etapów, `Table soon` = atrapa | ✗ `Source: manual` ×2, brak ⋮, WHAT'S NEXT poza panelem |
| **My Work → Inbox** | ✓ | ✓ | ✓ sam `AI Triage` | ✗ daty `Apr 20` | — | ✗ brak pinezki, ✗ data `Apr 20`, ~150px pustki |
| **My Work → Tasks** | ✓ | ✓ | ✓ sam `AI Priorities` | ✗ daty `Feb 9` | — | ✗ `Done` pełny zielony (kanon: tint) |
| **My Work → Run agent** | ✓ | ✓ segment+folder+CTA | ✓ (znikło) | ✗ daty `Jul 24, 2026`, 3 puste kolumny | ✓ bez atrap | — |
| **Tools → Library** | ✓ | ✓ 1 CTA | ✗ prawa strona PUSTA (brak AI) | ✗ `CATEGORY` goły kolorowy tekst, tagi ucięte | — | — |
| **Finance → Statements** | ✓ | ✓ | ✗ `Analyze ⌄` + `AI` (A3) | ✗✗ surowy `Date.toString` w NAME i PERIOD | — | — |

---

## LISTA BŁĘDÓW — do naprawy po kolei

### GRUPA 1 · Jedna przyczyna, wiele ekranów (najwyższy zwrot)

| ID | Błąd | Ekrany | Przyczyna |
|---|---|---|---|
| **G1-1** | **Daty w formacie angielskim** (`Apr 20`, `Feb 9`, `Jul 24, 2026`) zamiast `DD/MM/YYYY` | Inbox, Tasks, Run agent, Decisions, Notebook — **całe My Work** | Formatter `listDateFormat` objął tylko Interview/Tools/Ideas. My Work pominięty |
| **G1-2** | **Atrapy z etykietą `soon`** nadal w menu | Ideas (`Table soon`), prawdopodobnie inne | Mój `czyAtrapa` szuka `coming soon`/`wkrótce` — samo **`soon`** nie pasuje |
| **G1-3** | **Naprawa trafiła w zły komponent** | Ideas: brak ⋮ w DETAILS (P-4), brak etapów w kebabie | `MyIdeasListContent` (karty) ≠ komponent renderujący tabelę + preview |

### GRUPA 2 · Pojedyncze ekrany

| ID | Błąd | Ekran |
|---|---|---|
| **G2-1** | Nagłówki Title Case zamiast UPPERCASE (N-1) | Ideas |
| **G2-2** | `Source: manual` renderuje się dwa razy (PILNE-2) | Ideas preview |
| **G2-3** | `WHAT'S NEXT` wychodzi poza panel — 5 pozycji się nie mieści | Ideas preview |
| **G2-4** | Prawa strona Menu 3 pusta (brak AI) | Tools → Library |
| **G2-5** | `CATEGORY` jako goły kolorowy tekst zamiast chipa | Tools → Library |
| **G2-6** | Chip `In development` duplikuje kolumnę `STATUS` | Tools → Library |
| **G2-7** | `Analyze ⌄` po prawej Menu 3 (kanon: tylko AI) | Finance |
| **G2-8** | Brak pinezki w nagłówku preview (N-14) | Inbox |
| **G2-9** | `Done` pełny zielony zamiast tintu (N-22) | Tasks preview |
| **G2-10** | Kolumny zawsze puste: `SCHEDULED FOR`, `LAST RUN`, `DURATION` | Run agent |

### GRUPA 3 · Dane (nie kod)

| ID | Błąd | Ekran |
|---|---|---|
| **G3-1** | Duplikaty wierszy ×2–×3 | Inbox |
| **G3-2** | Filtry z zerem: `Saved 0 · AI 0 · Today 0 · This week 0` | Inbox |

---

## KOLEJNOŚĆ WYKONANIA

1. **G1-1 daty** — jeden formatter, największy zasięg, widoczne na każdym ekranie
2. **G1-2 atrapy `soon`** — jedna linijka regexu, odblokowuje regułę wszędzie
3. **G1-3 zły komponent** — ustalić, który plik renderuje tabelę+preview Ideas, przenieść naprawy
4. **G2-1…G2-3** — Ideas do końca (nagłówki, duplikat źródła, WHAT'S NEXT)
5. **G2-4…G2-10** — pozostałe ekrany
6. **G3** — dane, osobno

Po każdej grupie: `tsc` + strażniki + **zrzut na dowód**.
