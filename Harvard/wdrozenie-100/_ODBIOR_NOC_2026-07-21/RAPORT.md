# BILANS NOCY 2026-07-21 — karty N

> Gałąź: `fix/prv-mywork-preview` (worktree `.worktrees/prv-mywork`), baza `origin/demo`.
> **NIC NIE POSZŁO NA DEMO.** Dwa commity leżą na gałęzi roboczej i czekają na Twój akcept.
> Wszystko poniżej zmierzone dziś w nocy — nie przepisane z raportów agentów.

---

## 1. BRAMKA — PRZED i PO

| Miara | PRZED (plan nocny §1) | PO (zmierzone) |
|---|---|---|
| R1 — solid CTA poza slotem primary (ostrzeżenia) | **3** | **2** |
| R2+R3 — blokujące w trybie strict | 0 | **0** |
| Crimson w powłoce artefaktów | 5 (baseline 17) | **5** (baseline 17 — dług nie rośnie) |
| Rejestr kart N (`karty-n-smoke.mjs`) | 7/7 | **7/7** |
| `public/locales/pl` + `en` — parsowanie JSON | — | **oba OK** (równoległe zapisy nic nie zepsuły) |

Bilans: bramka poprawiła się o **jedno** ostrzeżenie R1. Reszta nocy poszła w rzeczy,
których bramka nie mierzy.

---

## 2. CO POWSTAŁO — 2 commity

| SHA | Karta | Co |
|---|---|---|
| `8a3b13f79a` | **Initiative** | „AI Konsultant" solid → outline. Był teal `rgb(0,127,142)` — **dokładnie ten sam kolor** co CTA „Zaplanuj zadania". Dwa elementy o równej wadze na jednym ekranie. |
| `32e5f72c74` | **Tool** | Dwa numeratory kroków (`bg-blue-600`, `bg-navy-900`, każdy inny, oba bez wariantu dark) wyrównane do wzorca z tego samego pliku. |

Commit-messages są uczciwe — agent Tool sam napisał, czego **nie** zweryfikował wzrokiem
(te sekcje są nieosiągalne w harnessie, bo `karta-tool.tsx` ma `TOOL_TYPE = 'dynamic-swot'`
na sztywno).

---

## 3. WERYFIKACJA W PRZEGLĄDARCE — zrobiona, nie zadeklarowana

Harness `:3220` odpowiada. Przeszedłem **wszystkie 7 kart × 2 motywy = 14 kombinacji**,
1440×900, odczyt z DOM + computed style (nie „na oko"):

| Kryterium (§3 planu) | Wynik |
|---|---|
| Error-boundary / „Coś poszło nie tak" / ReferenceError | **0 na 14** ✅ |
| Surowe klucze i18n (regex `(myWork\|interview\|initiatives\|discoveryTools)\.[a-z]`) | **0 na 14** ✅ |
| Panel Właściwości — wartości czytelne | ✅ na 7/7 (pigułki, nie ciemne prostokąty) — **z jednym wyjątkiem, p. 4.1** |
| Initiative: dokładnie jeden element filled | ✅ **potwierdzone** — został wyłącznie teal „Zaplanuj zadania", w obu motywach |

**Wada z kroniki „Initiative: wartości panelu jako ciemne prostokąty" jest w większości
naprawiona** — Status/Faza/Następna brama/Priorytet/Właściciel renderują się jako czytelne
pigułki. Zostało jedno pole (niżej).

---

## 4. ZNALEZISKA — czego noc NIE naprawiła

### 4.1. Initiative → „Termin" to surowy input daty
Wiersz `Termin` w panelu Właściwości renderuje `dd/mm/yyyy 📅` — nagi, pusty kontrolka
przeglądarki, wizualnie niespójna z pozostałymi pięcioma wierszami (stylowane pigułki).
W ciemnym motywie dodatkowo blada. **To resztka po Twojej uwadze o „ciemnych prostokątach".**

### 4.2. ★ Interview — crimson na wskaźniku ZAZNACZENIA (bramka tego NIE łapie)
`src/components/Interview/RuntimeModeSelector.tsx:173`

```
isSelected ? 'border-[var(--c-accent)] bg-[var(--c-accent)]' : 'border-[var(--c-border)]'
```

`--c-accent` = **`#85182f`** (jasny) / `#c8324a` (ciemny) — Harvard Crimson.
Zmierzone na żywym ekranie: `rgb(133, 24, 47)`. Łamie punkt 9 odbioru
(„zero crimsona na fokus/status/badge/**zaznaczenie**").

### 4.3. ★★ ŚLEPA PLAMA BRAMKI — najważniejsze ustalenie nocy
`check-artefakt.sh` skanuje **powłokę** (`NModeLayout/`, `ExecutiveModuleShell/`,
`ArtifactRightPanel`, `IdeaMapWorkspace`) **plus 7 plików kart**. Nie skanuje komponentów
**renderowanych przez** karty. Dlatego crimson z p. 4.2 świeci na ekranie, a bramka
mówi „✓ brak naruszeń".

**Wniosek: „bramka zielona" ≠ „brak crimsona na ekranie".** Znalazłem to wyłącznie
dlatego, że mierzyłem computed style w przeglądarce, a nie czytałem kod.

### 4.4. Dwa pozostałe ostrzeżenia R1 — różnej wagi
| Plik | Co | Ocena |
|---|---|---|
| `NotificationDetailView.tsx:2216` | „Go Back" w stanie pustym, `bg-slate-100 dark:bg-navy-800` | **prawdopodobnie fałszywy alarm** — neutralny, nie wygląda na primary |
| `TaskDetailView.tsx:6219` | „Create Decision", `bg-amber-500 text-white` | **realny solid CTA**, ale w UI warunkowym — nieosiągalny w domyślnym stanie harnessu, więc **nie obejrzany wzrokiem** |

### 4.5. Punkty z zakresu planu, których nikt nie tknął
- **Spójność sekcji AKCJE** (Task/Insight mają tekst, Decision/Initiative przyciski) — nietknięte.
- **„Tryb pokazu" jako akcja w Initiative** — wciąż przycisk w sekcji AKCJE, wbrew SPEC-N §2.7.
- **Wąski ekran <1024px** — niesprawdzony. Panel to `hidden lg:block`, poziomy pasek usunięty;
  pytanie „czy właściwości są widoczne gdziekolwiek" **pozostaje bez odpowiedzi**.

### 4.6. Folder odbioru był PUSTY
`_ODBIOR_NOC_2026-07-21/` nie zawierał ani jednego raportu agenta ani ani jednego zrzutu —
mimo że plan §5 zapowiadał zrzuty wszystkich dotkniętych kart. Materiał do odbioru wzrokiem
istnieje wyłącznie w treści dwóch commit-messages. **Zrzuty obejrzałem sam, w tej sesji.**

---

## 5. DO DECYZJI PIOTRA

1. **Crimson na zaznaczeniu w Interview** (4.2) — zmieniamy `--c-accent` na `c-focus`/neutralny,
   czy crimson na zaznaczeniu zostaje świadomie?
2. **Ślepa plama bramki** (4.3) — rozszerzyć skan `check-artefakt.sh` na komponenty potomne kart?
   To zmiana w `scripts/`, poza zakresem nocnym, i pewnie odsłoni więcej długu.
3. **„Termin" w Initiative** (4.1) — stylujemy jak pozostałe wiersze, czy pole daty ma prawo
   wyglądać inaczej?
4. **`bg-amber-500` „Create Decision"** (4.4) — stonować do outline, czy amber jest tu celowy?
   Nie oglądałem tego stanu, więc nie zgaduję.
5. **„Tryb pokazu"** — własny slot wg SPEC-N §2.7 czy zostaje akcją?
6. **Sekcja AKCJE** — ujednolicić Task/Insight z Decision/Initiative, czy różnica jest uzasadniona?
7. **Pełna lista „dużo błędów" z demo** — z kroniki §6 pkt 1. Nadal nierozpisana. **Nie zgaduję.**

---

## 6. CZEGO NIE ZWERYFIKOWANO

- **Wąski ekran** (<1024px) — żaden motyw, żadna karta.
- **Tool: sekcje `marketForces.process` / `growthPaths.process`** — nieosiągalne w harnessie
  (`TOOL_TYPE` zahardkodowany). Commit `32e5f72c74` opiera się na dowodzie pośrednim.
- **Task: „Create Decision"** — w UI warunkowym, nieosiągalne w domyślnym stanie.
- **Pełny `tsc`/`vitest`** — zakaz (OOM). Bez zmian kodu tej nocy z mojej strony.
- **Zachowania interaktywne** (kebaby, rozwijanie sekcji, zapis) — sprawdzałem stan
  po załadowaniu, nie klikałem przez ekrany.
- **Liczba „dokładnie jeden primary"** na 6 z 7 kart: mój detektor liczy tła **nasycone**
  (sat > 60). Na 6 kartach naliczył **zero**. Albo slot primary jest pusty w danych mock,
  albo primary jest z założenia neutralny i detektor go nie widzi. **Nie rozstrzygam
  automatem — to punkt na Twoje oko.**

---

## 7. PUSH NA DEMO PO AKCEPCIE — jedno polecenie

```bash
cd "/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify/.worktrees/prv-mywork" && git fetch origin && git rebase origin/demo && bash scripts/check-artefakt.sh && bash scripts/check-list-canon.sh && git push origin fix/prv-mywork-preview:demo
```

Zwykły `push`, **nigdy `--force`** (demo = święte, runbook cofania §8).
Bramki wołane przed pushem świadomie — `.husky` to nadal `exit 0`, więc same się nie odpalą.

---

*Zmierzone w nocy 2026-07-21. Tam, gdzie czegoś nie sprawdziłem, napisane wprost — §6.*
