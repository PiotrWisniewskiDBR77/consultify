# Inicjatywy — SSOT systemu (kręgosłup aplikacji)

> **Status:** PLAN DOMKNIĘCIA · v0.1 (dialog z Piotrem 2026-06-27) · **przed kodem**
> **Charakter:** Inicjatywy = główne wrzeciono i kręgosłup całej aplikacji. Przekrojowe.
> **Powiązane SSOT:** [`INITIATIVE_LIFECYCLE.md`](./INITIATIVE_LIFECYCLE.md) (proces statusów — GOTOWY) · [`INITIATIVE_PROCESS_EFFECTIVENESS.md`](./INITIATIVE_PROCESS_EFFECTIVENESS.md) (analiza) · [`INITIATIVE_FORMULA.md`](./INITIATIVE_FORMULA.md) + [`../standards/CARD_CONTENT_FORMULA.md`](../standards/CARD_CONTENT_FORMULA.md) (treść kart) · [`../../Harvard/Testy manualne/TESTY_M13_PROCES_STATUSOW.md`](../../Harvard/Testy%20manualne/TESTY_M13_PROCES_STATUSOW.md) (system testów — 92/92)
> **Dowód statusów:** [`WYNIKI_M13_INICJATYWY_RUN1.md`](../../Harvard/Testy%20manualne/WYNIKI_M13_INICJATYWY_RUN1.md)

---

## 0. Wizja — wrzeciono ŹRÓDŁO → INICJATYWA → REZULTATY

Inicjatywa nie jest osobnym modułem — jest **kręgosłupem**, który spina trzy fazy życia pracy w organizacji:

```
ROZPOZNANIE                INICJATYWA                    REZULTATY
(źródła wiedzy)      →   (zarządza pracą)         →    (wyniki pracy)
Insights · Assessments    13 statusów · bramki ·        Benefits register ·
Audyty · Financials       karty · zadania · decyzje     KPI realizacja · ROI
                                                          (M15/M16)
```

- **Wejście:** inicjatywa rodzi się z działań rozpoznających (insight z wywiadu, wynik assessmentu, audyt, twarde dane finansowe).
- **Środek:** inicjatywa zarządza pracą — przechodzi proces statusów (draft→zrealizowane), gromadzi karty (dokument), zadania, decyzje, KPI; rządzi pracą w organizacji.
- **Wyjście:** domknięta inicjatywa przekazuje wartość do rezultatów (benefits, ROI, KPI realization).

---

## 1. Decyzje architektoniczne (zablokowane w dialogu 2026-06-27)

| # | Oś | Decyzja |
|---|---|---|
| **D1** | Generator | **Dwa tory:** szybki (brief/Teresa → szkic w sekundy) + głęboki (kreator z recenzentem, rygor). User wybiera tryb na starcie. |
| **D2** | Karty | **Stały rdzeń + AI proponuje dodatkowe** z biblioteki opcjonalnych wg typu inicjatywy. (Nie pełna dynamika, nie sztywny kanon.) |
| **D3** | Grunt AI | **4 źródła:** kontekst organizacji (zawsze) + artefakt wyzwalający (insight/assessment/**audyt**) + **istniejące portfolio** (dedup/MECE) + **twarde dane** (Financials/KPI). |
| **D4** | Przedstawianie | **Jeden klik → M17:** inicjatywa/portfolio → deck / raport / **tabela** (nowy eksport) przez generatory materiałów. |
| **D5** | Wejście (narodziny) | **Wielomodalne:** proaktywna **skrzynka kandydatów AI** (skanuje rozpoznanie, sugeruje) + ręcznie z artefaktu/od zera + Teresa z czatu. |
| **D6** | Proces statusów | **GOTOWY** — 13 statusów, bramki, role, AI-merytorycznie + AI-na-linii-czasu. Udowodniony 92/92 testami. Nie przeprojektowujemy. |
| **D7** | Zakres | **Całe wrzeciono** — wejście (rozpoznanie→inicjatywa) + rdzeń M13 + wyjście (→benefits/ROI jako interfejs). M14/M15/M16 jako interfejsy, nie przebudowa. |
| **D8** | Skrzynka kandydatów | **Oba** — zbiorcza zakładka „Kandydaci" w hubie + badge kontekstowy przy każdym artefakcie rozpoznania. |
| **D9** | Analiza portfela | **Osobny widok zdrowia portfela** (mapa MECE, luki pokrycia, duplikaty, balans) + dedup w generatorze. |
| **D10** | Rdzeń kart | **6 kart rdzenia (zawsze):** Problem · Teza · KPI · Zakres · Właściciel · Business case. Reszta (20+) opcjonalna — AI proponuje wg typu. |
| **D11** | Układ kart | **Generyczny silnik bloków (jak M17)** — karty z deklaratywnych bloków (kpi/tekst/tabela/wykres/callout); AI składa układ. Spina karty z maszyną materiałów M17. |
| **D12** | Recenzent (tor szybki) | **Auto-heal** — recenzent w tle ocenia, karty <próg AI regeneruje raz przed pokazaniem szkicu (self-healing). W torze głębokim: widoczny/interaktywny. |

---

## 2. Architektura docelowa — oś po osi

### A. WEJŚCIE — narodziny inicjatywy (D5)
| Ścieżka | Stan dziś | Cel |
|---|---|---|
| **Skrzynka kandydatów AI** (proaktywna) | ❌ brak | AI skanuje nowe insights/assessmenty/audyty → generuje kandydatów inicjatyw z uzasadnieniem + wstępnym dopasowaniem do portfela → human akceptuje/odrzuca/scala. **NOWA zdolność.** |
| Ręcznie z artefaktu | 🟡 część (insight/assessment/tool ✅; audyt ❌) | „Utwórz inicjatywę z tego" na każdym artefakcie rozpoznania (dobudować audyt). |
| Ręcznie od zera | ✅ Charter/Nowa | bez zmian |
| Teresa z czatu | 🟡 płytkie (szkic) | pełniejszy fill (patrz B/E) + lineage źródła (dziś gubione). |

> **Otwarte (Q):** gdzie żyje skrzynka kandydatów — osobny widok? sekcja w My Work/Inbox? badge na artefakcie rozpoznania? (propozycja: dedykowana zakładka „Kandydaci" w hubie inicjatyw + notyfikacja).

### B. GENERATOR — dwa tory (D1)
| Tor | Mechanika | Stan |
|---|---|---|
| **Szybki** | brief/czat → AI dobiera karty (rdzeń+propozycje) → wypełnia WSZYSTKIE karty (ugruntowane) → szkic DRAFT w sekundy. Recenzent w tle (nie blokuje). | 🟡 dziś tylko tytuł+problem — **dobudować pełny fill** |
| **Głęboki** | wieloetapowy kreator: typ→propozycja kart→generacja per sekcja→recenzent adwersaryjny (0-100)→edycja. Rygor McKinsey. | ✅ istnieje (`initiativeGenerationService` + reviewer) — **odchudzić ceremonię** |

> **Uproszczenie (Twój sygnał „prostsza mechanika"):** szybki tor = domyślny (1 klik); głęboki = opcja dla ważnych inicjatyw. Recenzent: w głębokim torze widoczny, w szybkim w tle.
> **Otwarte (Q):** czy recenzent w torze szybkim ma być całkiem ukryty (tylko flaga jakości) czy pokazywać wynik po fakcie?

### C. KARTY — rdzeń + propozycja AI (D2)
- **Rdzeń (zawsze):** Problem · Teza (falsyfikowalna) · KPI (baseline→target) · Zakres · Właściciel · Business case. (charter-lite z `INITIATIVE_FORMULA §2/§11`)
- **Biblioteka opcjonalnych:** pozostałe z 26 systemowych (pilotaż, RAID, RACI, skills-gap, dependencies, stakeholders, financial-analysis…) + org-custom.
- **AI proponuje** które dodatkowe karty wg typu inicjatywy/źródła (np. inicjatywa regulacyjna → karta ryzyk regulacyjnych; pilotażowa → karta pilotażu).
- **Spec treści:** `CARD_CONTENT_FORMULA.md` (per-karta, już wstrzykiwany do generacji). ✅
- **Układ graficzny:** dziś bespoke React per karta (brak generycznego silnika bloków).

> **Otwarte (Q):** dokładny podział rdzeń vs opcjonalne (które z 26 są obowiązkowe?) — propozycja powyżej do potwierdzenia. · Czy „układ graficzny na kartach" przeprojektowujemy (generyczny silnik bloków jak w M17) czy zostawiamy bespoke?

### D. GRUNT AI — 4 źródła (D3)
| Źródło | Stan | Do zrobienia |
|---|---|---|
| Kontekst organizacji | 🟡 grounding block | wzmocnić (profil/branża/cele/standardy) |
| Artefakt wyzwalający | 🟡 (audyt ❌) | dobudować Audyt→inicjatywa jako source |
| Istniejące portfolio (dedup/MECE) | ❌ | **NOWE:** AI czyta portfel przed generacją → unika duplikatów, dopasowuje do luk |
| Twarde dane (Financials/KPI) | ❌ martwy enum | wpiąć realne liczby do business case / financial impact / KPI |

### E. AI-WYPEŁNIA — 3 granularności
| Granularność | Stan |
|---|---|
| Całą inicjatywę | 🟡 płytkie (szkic) → **dobudować pełny fill** (rdzeń tora szybkiego) |
| Kartę/sekcję | ✅ dojrzałe (`generate-section` + recenzent) |
| Pole/obszar | ✅ (`AIFieldEnhancer` per-pole) |

### F. PROCES ZATWIERDZANIA — GOTOWY (D6)
13 statusów · bramki RBAC · AI-readiness (merytorycznie) · timeline-gate (na linii czasu). Pełen opis: `INITIATIVE_LIFECYCLE.md`. **Udowodniony 92/92 testami** (L1/L2/L3). DEF-1 (BLOCKED-reason) znaleziony+naprawiony. → **nie ruszamy, tylko spinamy z resztą.**

### G. WIDOKI — GOTOWE
Lista · Kanban · Gantt · Preview · Karta inicjatywy (InitiativesHub 4 widoki + InitiativeDocumentView). ✅

### H. KORELACJE
| Typ | Artefakt | Stan |
|---|---|---|
| Źródła | Insights ✅ · Tools ✅ · Assessments ✅ · **Audits ❌** · **Financials ❌** · KPI (downstream ✅) · **Ideas 🟡** · **Notes 🟡** (edge, nie lineage) | dobudować audits/financials jako source; ideas/notes → lineage |
| Narzędzia | Tasks ✅ · Decyzje ✅ · Notyfikacje ✅ | gotowe |

### I. PRZEDSTAWIANIE — M17 jeden klik (D4)
| Materiał | Stan | Cel |
|---|---|---|
| Prezentacja | ✅ intent `initiative_portfolio` | „Zrób materiał" na inicjatywie/portfelu |
| Raport | 🟡 link M2M, render częściowy | domknąć render zarządczy |
| Tabela | ❌ | **NOWE:** eksport inicjatywa/portfolio → tabela (status/KPI/ROI) przez M17 |

### J. WYJŚCIE — rezultaty (M15/M16)
DONE→TRACKING handoff: benefits register + KPI realization + ROI (verified). ✅ istnieje (status process). Inicjatywa przekazuje wartość do M15 Rezultaty / M16 Finanse.

> **Otwarte (Q):** czy w tym domknięciu skupiamy się tylko na inicjatywach (M13), a M14 wykonanie / M15-M16 rezultaty traktujemy jako „spięte i osobne", czy chcesz objąć je tym samym spec?

---

## 3. Luki do zbudowania (backlog — priorytet do ustalenia)

| Lp | Luka | Oś | Rozmiar |
|---|---|---|---|
| G1 | Skrzynka kandydatów AI (proaktywna z rozpoznania) | A/D5 | DUŻY |
| G2 | Pełny AI-fill całej inicjatywy (tor szybki) | B/E | ŚREDNI |
| G3 | Grunt: portfolio-analysis (dedup/MECE) | D | ŚREDNI |
| G4 | Grunt: Financials/KPI realne dane | D | ŚREDNI |
| G5 | Audyt → inicjatywa (source) | A/H | MAŁY |
| G6 | AI proponuje dodatkowe karty + biblioteka | C | ŚREDNI |
| G7 | Eksport inicjatywa/portfolio → tabela (M17) | I | ŚREDNI |
| G8 | „Zrób materiał" jeden-klik (deck/raport/tabela) | I | MAŁY (leveruje M17) |
| G9 | Teresa: pełny fill + lineage źródła | A/E | MAŁY |
| G10 | Odchudzenie kreatora (tor głęboki) | B | MAŁY |
| G11 | Ideas/Notes → lineage (nie tylko edge) | H | MAŁY |

---

## 4. Otwarte pytania — ROZWIĄZANE (D7-D12)
Wszystkie 6 architektonicznych domknięte w dialogu 2026-06-27. Drobne do rozstrzygnięcia w trakcie budowy (propozycje):
- **Trigger skrzynki kandydatów:** auto-skan po każdym nowym rozpoznaniu (insight/assessment/audyt) + ręczne „przeskanuj". *(propozycja: auto + ręczne)*
- **Kolejność migracji kart na silnik bloków:** najpierw 6 kart rdzenia treściowego, potem opcjonalne. *(propozycja)*
- **Interfejsy M14/M15/M16:** traktujemy jako gotowe punkty styku (status handoff), nie przebudowujemy w tym spec.

---

## 5. Plan faz (F0–F7) — wzorem SSOT M17 + system testów L1/L2/L3

> **Zasada jakości (jak przy statusach):** każda faza = kod + testy 3-warstwowe (L1 unit / L2 integration / L3 E2E) + dowód. Defekty z testów = hardening. Deploy demo, PROD za zgodą.
> **Kolejność wg zależności:** grunt zasila generator; silnik bloków jest fundamentem kart; reszta bardziej równoległa.

### F0 — Grunt (fundament, zasila wszystko) · D3
- Wzmocnić kontekst organizacji w prompcie generacji (profil/branża/cele/standardy).
- Wpiąć **Financials/KPI realne dane** jako grunt business-case/financial-impact (martwy enum → żywy).
- Dobudować **Audyt → inicjatywa** jako source_type + ścieżka konwersji.
- **Ideas/Notes → lineage** (nie tylko edge w link-graph).
- **DoD:** generacja czyta 4 źródła; testy że prompt zawiera realne dane org+portfolio+finanse; audyt→inicjatywa E2E.

### F1 — Mózg generatora (rdzeń) · D1/D2/D10/D12/E
- **Tor szybki:** brief/Teresa → AI dobiera karty (6 rdzenia + propozycje) → wypełnia WSZYSTKIE ugruntowane → **auto-heal** (regen <próg) → szkic DRAFT.
- **AI proponuje dodatkowe karty** z biblioteki wg typu (D2).
- **Tor głęboki** odchudzony (mniej ekranów, recenzent interaktywny).
- **Teresa:** pełny fill + lineage źródła (dziś gubione).
- **DoD:** brief→kompletna inicjatywa <X s; rdzeń 6 kart zawsze; auto-heal podnosi jakość; testy L1/L2/L3 generatora.

### F2 — Wejście wrzeciona: skrzynka kandydatów · D5/D8
- **Zakładka „Kandydaci"** w hubie (zbiorcza) — AI skanuje nowe rozpoznanie, lista kandydatów z uzasadnieniem + dopasowaniem.
- **Badge kontekstowy** przy każdym insight/assessment/audycie („AI sugeruje inicjatywę").
- Akcept/odrzuć/scal → uruchamia generator (F1).
- **DoD:** auto-skan generuje kandydatów; badge na 3 typach artefaktów; akcept→DRAFT z lineage.

### F3 — Silnik bloków kart (fundament wizualny) · D11
- Generyczny renderer kart z bloków deklaratywnych (kpi_strip/paragraph/table/chart/callout) — **reużycie kompozycji M17**.
- Migracja 6 kart rdzenia treściowego na silnik; opcjonalne stopniowo.
- AI składa układ karty (grammar jak deck M17).
- Karty narzędziowe (Gantt/KPI/RAID) — interfejs do silnika lub pozostają bespoke (hybryda przejściowa).
- **DoD:** karty rdzenia renderowane z bloków; AI-skład układu; spójność wizualna; testy renderera.

### F4 — Analiza portfela · D9
- **Dedup w generatorze** (ostrzega o duplikacie, dopasowuje do luki).
- **Widok „Zdrowie portfela":** mapa MECE, luki pokrycia, duplikaty, balans.
- **DoD:** dedup przy tworzeniu; widok renderuje mapę MECE z realnego portfela; testy.

### F5 — Przedstawianie: M17 jeden klik · D4
- Przycisk **„Zrób materiał"** na inicjatywie + portfelu → generator M17.
- Deck (intent portfolio ✅ poleruj) · Raport zarządczy (domknij render) · **Tabela (nowy eksport** status/KPI/ROI).
- **DoD:** 1-klik → 3 materiały z realnych danych inicjatywy; tabela non-empty; testy eksportu.

### F6 — Wyjście: rezultaty (interfejs) · J
- Domknięcie handoff DONE→TRACKING→benefits/KPI/ROI (M15/M16) — weryfikacja interfejsu, nie przebudowa.
- **DoD:** DONE→TRACKING tworzy benefits register + KPI; testy handoff (część już w 92/92).

### F7 — Raport realizacji + domknięcie
- System testów L1/L2/L3 dla nowych zdolności (generator/kandydaci/silnik/portfel/eksport) — wzorem `TESTY_M13_PROCES_STATUSOW`.
- Raport `WYNIKI_M13_SYSTEM_RUN1.md`.
- **DoD:** wszystkie nowe zdolności zielone + sklasyfikowane.

### Zależności (graf)
```
F0 grunt ──┬──► F1 generator ──► F2 kandydaci
           └──► F4 portfel (dedup)
F3 silnik bloków ──► (karty F1 renderują się ładnie)
F5 M17 eksport ── (niezależny, leveruje M17)
F6 rezultaty ── (interfejs, w dużej części gotowy)
F7 testy+raport ── (po każdej fazie + zbiorczo)
```

### Rekomendacja kolejności dowożenia
**F0 → F1 → F2** (wrzeciono wejście+mózg, największy zysk UX) · równolegle **F3** (silnik bloków) i **F5** (M17 eksport, niezależny) · potem **F4** (portfel) · **F6/F7** domknięcie.
