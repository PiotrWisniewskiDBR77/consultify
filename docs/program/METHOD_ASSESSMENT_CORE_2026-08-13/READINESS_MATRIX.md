# Macierz readiness — STRUMIEŃ 5

> Cztery wymiary rozdzielone. **Technical może być PASS wyłącznie z dowodami dla
> dokładnego SHA.** Reszta nie jest kwestią wysiłku inżynierskiego — i żadna flaga
> tego nie zmienia.

---

## 1. Macierz

| Wymiar | DRD | SIRI | Uzasadnienie |
| --- | --- | --- | --- |
| **Technical** | **PASS** | **PASS** | bramki zielone bez retry na dokładnym SHA; pełny E2E z przeglądarki 13/14; restart + reopen; instalacja od zera dowiedziona z `information_schema` |
| **Methodology** | **BLOCKED** | **BLOCKED** | DRD: `misScoringTraps` 0/233, pola pomocy pytania 0/699 — **brak źródła w repo**. SIRI: 0/16 wymiarów ma treść. `canStartSession()` = **false** dla obu. |
| **Legal** | n/d | **BLOCKED** | SIRI Module 2 str. 32–69: klauzula zakazu reprodukcji. **Zero** wygenerowanej treści licencjonowanej. |
| **Runtime** | **warunkowe** | **warunkowe** | wszystko za flagami domyślnie **OFF** (`methodWorkspaceShellV1`, `drdMethodWorkspaceSliceV1`, `drdHttpSourceOfTruthV1`, `SIRI_PM_V2`, `drdScoringV2`) — stan przed-akceptacyjny zgodny z regułą #7 |

---

## 2. Technical — dowody dla dokładnego SHA

| Bramka | Wynik | Warunki |
| --- | --- | --- |
| serwer (realny PostgreSQL) | **170/170**, 14/14 plików | `--retry=0`, `--no-file-parallelism`, `RUN_DB_TESTS=1`, `MOCK_DB=false` |
| front | **337/337**, zero pominiętych | `--retry=0`, `RUN_TERESA_LIVE_TESTS=1` + żywy serwer |
| zakres dotknięty (szerszy) | **538/538** | `--retry=0` |
| `tsc` scoped | **0 błędów** w zakresie | jedyny błąd repo to pre-existing `turndown-plugin-gfm` |
| instalacja od zera | **14 tabel `method_*`** | potwierdzone `information_schema`, nie kodem wyjścia |
| prawdziwy browser E2E | **13/14 PASS** | dane wprowadzane przez UI, SQL wyłącznie do potwierdzenia |
| stabilność bramki | **6/6 zielonych** | po usunięciu migotania; wcześniej 2/5 czerwonych |

★ **Technical = PASS jest twierdzeniem o KODZIE, nie o produkcie.** Moduł nie
jest gotowy do użycia przez klienta, bo blokują go dwa wymiary poniżej.

---

## 3. Methodology — dlaczego BLOCKED, a nie „do dokończenia"

**DRD.** Kanoniczna dokumentacja repo definiuje 7 osi / 39 obszarów i to jest
w kodzie zgodnie (`src/services/drdStructure.ts` — zweryfikowane). Czego **nie
ma w żadnym źródle repo**:

| Element | Stan |
| --- | --- |
| `misScoringTraps` (pułapki błędnej oceny) | **0 / 233** — `EVIDENCE_MISSING` |
| pola pomocy przy pytaniu | **0 / 699** — `EVIDENCE_MISSING` |
| `distinctionFromNext` (czym poziom różni się od następnego) | `EVIDENCE_MISSING` |

Zgodnie z COORD-07: **nie generuję tych treści.** Wypełnia je właściciel
metodyki. Model językowy układający „pułapki błędnej oceny" tworzyłby treść
doradczą bez źródła — czyli dokładnie to, przed czym broni cały kontrakt dowodowy
tego modułu.

**SIRI.** 0/16 wymiarów ma treść. `readiness` = `draft`.

---

## 4. Legal — SIRI

Materiał SIRI (Module 2, str. 32–69) jest objęty klauzulą zakazu reprodukcji.

| Zasada | Stan |
| --- | --- |
| generowanie treści licencjonowanej | **nie wykonano** |
| rekonstrukcja opisów Band | **nie wykonano** |
| struktura (16 wymiarów, Bands 0–5, no-leapfrog, 80:20, TIER) | zaimplementowana — to **mechanika**, nie treść chroniona |

Bez zatwierdzonego materiału SIRI pozostaje `LEGAL_BLOCKED` **i**
`METHODOLOGY_BLOCKED`. To nie jest do obejścia inżynierią.

---

## 5. ★ Bramka gotowości NIE została podniesiona

Koordynator zakazał podnoszenia `canStartSession` ani `RUNTIME_ACTIVE` przez flagę,
bypass lub zmianę statusu bez spełnienia manifestu. Kontrola:

| Kontrola | Wynik |
| --- | --- |
| `canStartSession()` dla DRD | **false** (`methodology_review`) |
| `canStartSession()` dla SIRI | **false** (`draft`) |
| czy demo-bypass zmienia `method_packs.readiness` | **NIE** — dowiedzione testem serwerowym przed i po całym przepływie freeze→Output→Report |
| czy Output z bypassem jest odróżnialny od produkcyjnego | **TAK** — nosi jawny znacznik demonstracji; produkcyjny ma `demoBypassActive: false` |
| czy jakakolwiek ścieżka HTTP omija bramkę | **NIE** — test: „production always refuses session start against methodology_review" |
| SIRI przez UI | **HTTP 422 `pack_not_released`** — potwierdzone w realnym E2E |

★ Odmowa startu sesji SIRI w E2E to **dowód działania bramki**, nie defekt.

---

## 6. Wniosek — dwa osobne kandydaty, nie jeden

Blokada licencyjna SIRI uniemożliwia deklarowanie kompletności całego Assessment.
Zgodnie z instrukcją koordynatora zgłaszam **rozdzielnie**:

| Kandydat | Klasyfikacja |
| --- | --- |
| **DRD** | `DRD_PRODUCT_CANDIDATE` — technical PASS, methodology BLOCKED (brak źródła treści) |
| **SIRI** | `SIRI_TECHNICAL_CANDIDATE` / `LEGAL_BLOCKED` / `METHODOLOGY_BLOCKED` |

**Nie zgłaszam `ASSESSMENT_PRODUCT_COMPLETE_CANDIDATE` dla całości.**
