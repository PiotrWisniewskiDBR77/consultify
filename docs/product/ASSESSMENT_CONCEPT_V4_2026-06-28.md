# Koncepcja rozwoju modułu Assessment (M12 Audyty) — V4

> **Status:** Koncepcja w realizacji · **Data:** 2026-06-28 · **Autor:** Claude (CTO)
> **🎯 ZAKRES TEJ FALI (decyzja Piotra 2026-06-28):** robimy **SIRI + DRD + ADMA**. **CMMI i LEAN → później** (oznaczone „wkrótce/beta" w pickerze, żeby nie kłamał). Reszta dokumentu opisuje wszystkie 5 dla kompletności; aktywny zakres = 3 flagowce.
> **Relacja do V3:** nadbudowuje `ASSESSMENT_WORKBENCH_STANDARD_V3.md`. Standard V3 ujednolicił **proces i mechanikę** i świadomie pominął dwie rzeczy, które są teraz priorytetem: (1) **merytorykę** („nie standaryzujemy merytoryki"), (2) **klasę wizualną** outputów. V3 obejmuje tylko DRD/SIRI/ADMA. V4 domyka oba braki i wciąga **CMMI + LEAN**.
> **Źródła metodyk:** sekcja §10 (autorytatywne, cytowane).

---

## 0. Po co to robimy (diagnoza)

Assessment to **najstarsze narzędzie Consultify** — i dziś jest **wyraźnie słabsze od reszty platformy**. Raport stanu z 12.06 skwitował M12 jednym słowem „Gotowy", a rzeczywistość (5 frameworków w pickerze: DRD/SIRI/ADMA/CMMI/LEAN, lanes, AI Triage, Interpretation Draft) jest dużo bogatsza — i dużo bardziej dziurawa — niż dokumentacja.

**Twardy stan z kodu (audyt AS-IS, 2026-06-28):**

| Warstwa | DRD | SIRI | ADMA | CMMI | LEAN |
|---|:--:|:--:|:--:|:--:|:--:|
| Picker + Forma (input) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Backend enum/walidator | ✅ | ✅ | ✅ | ✅ | ✅ |
| Scoring / agregacja | ✅ | ✅ (16→8→3) | ✅ (dims→pillars + T1–T7) | ⚠️ częściowy | ❌ brak |
| Qbank (grounding AI) | ✅ PL+EN | ✅ PL+EN | ✅ PL+EN+method | ❌ | ❌ |
| Help pack (coach/wideo) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Szablon raportu | ❌ **brak** | ✅ | ✅ | ✅ | ✅ |
| Mapa/wizualizacja | ❌ **brak** | ✅ | ✅ | ✅ | ✅ |
| Generator inicjatyw | ✅ | ✅ | ✅ | ❌ | ❌ |
| AI coach / evidence | ✅ | ✅ | ✅ | ❌ | ⚠️ kod, brak packów |

**Wniosek diagnostyczny — trzy klasy narzędzi:**
- **SIRI, ADMA — pierwsza klasa, ~95% end-to-end.** Działają od assessmentu po raport+inicjatywy.
- **DRD — pierwsza klasa metodycznie, ale niedowieziona: brak raportu i mapy.** Paradoks — to **nasz** flagowy framework (marka DBR77/Consultify), a użytkownik nie dostaje z niego formalnego dokumentu.
- **CMMI, LEAN — wydmuszki.** Picker obiecuje, ładna forma jest, ale brak mózgu: bez qbanku (AI halucynuje/pusto), bez scoringu (utknie na 0%), bez inicjatyw. **Picker kłamie użytkownikowi.**

**Cel V4:** podnieść Assessment do (i ponad) poziom reszty platformy, z dwoma równorzędnymi filarami:
1. **Wierność metodyce realnego świata** — narzędzia mają odwzorowywać, jak SIRI/ADMA/CMMI/Lean **faktycznie działają** u konsultantów i w przemyśle, nie nasze uproszczenia.
2. **Klasa wizualna outputów** — raport/deck/mapy na poziomie konsultanta premium (bić Gamma, zob. program Materiały M17).

---

## 1. Zasady przewodnie

1. **Fidelity-first.** Każdy framework odwzorowuje oryginalną strukturę (wymiary, poziomy, agregację) zgodnie z autorytatywnym źródłem (§10). Żadnych „mniej więcej".
2. **Substancja = wizualizacja.** Output nie jest „dobry", dopóki nie jest jednocześnie metodycznie poprawny **i** piękny. Dwa odbiory, nie jeden.
3. **IP-aware (krytyczne).** SIRI (treść 6 band-ów, oficjalna ocena = Certified Assessor/INCIT) i CMMI (treść praktyk, appraisal = ISACA) są **zastrzeżone/płatne**. Odwzorowujemy **strukturę i mechanikę**, treść piszemy **własnymi słowami**, z jawnym disclaimerem „narzędzie inspirowane metodyką X; nie jest oficjalną oceną X". ADMA (EU) i Lean (publiczny) — pełna swoboda. DRD — nasze.
4. **Evidence discipline.** Żadnego „score by opinion" — każdy poziom ma dowód albo jawny stan „needs evidence" (kontynuacja V3 §2.3).
5. **Propose→accept.** AI nigdy nie finalizuje wyniku bez akceptacji człowieka (kontynuacja V3 §5).
6. **Jeden Workbench, pięć kanonów.** Wspólna powłoka (nawigacja/scoring/evidence/grafika/coach/export), wymienny rdzeń metodyczny per framework.

---

## 2. Architektura docelowa — „Jeden Workbench, pięć kanonów"

Warstwy (od dołu):

```
┌─────────────────────────────────────────────────────────────┐
│  WSPÓLNY WORKBENCH (powłoka, identyczna dla 5 frameworków)    │
│  • Setup sesji  • Nawigacja obszarów + progress              │
│  • Scoring + evidence + notatki  • Graphic mirror (live)     │
│  • Chat Coach (propose→accept)  • Export (raport/deck)        │
├─────────────────────────────────────────────────────────────┤
│  KANON METODYCZNY (wymienny rdzeń per framework)             │
│  struktura wymiarów │ skala/poziomy │ agregacja │ qbank │     │
│  signature-visual │ prioritisation │ initiative-mapping      │
├─────────────────────────────────────────────────────────────┤
│  WSPÓLNY SILNIK WYNIKU I PRIORYTETYZACJI                      │
│  radar • gap (as-is/to-be) • benchmark • prioritisation      │
│  matrix (impact × effort) • roadmapa inicjatyw fazowana      │
└─────────────────────────────────────────────────────────────┘
```

**Konsekwencja:** dodanie/uzupełnienie frameworka = wypełnienie 7 pól kanonu, a nie budowa od zera. To definiuje zarówno domknięcie CMMI/LEAN, jak i przyszłe frameworki (np. ISO, TISAX).

---

## 3. Kanon metodyczny per framework

> Pełne struktury źródłowe w §10. Tu — co odwzorowujemy i status.

### 3.1 SIRI — Smart Industry Readiness Index (licencjonowany)
- **Struktura (fakt z whitepaper EDB):** 3 building blocks → 8 pillars → **16 dimensions**. Wymiary 4–12 to macierz 3 aspekty (Automation/Connectivity/Intelligence) × 3 warstwy (Shop Floor/Enterprise/Facility).
- **Skala:** 6 pasm, **Band 0–5** per wymiar (zakresy, nie punkty). Zestaw 16 band-ów = Assessment Matrix Score.
- **Agregacja:** SIRI **nie uśrednia** do jednej liczby — daje profil 16. Priorytetyzacja w osobnym **Prioritisation Matrix**: `Impact Value = W_c·Cost + W_k·KPI + W_p·(BIC − AMS)` (BIC = best-in-class, AMS = obecny band). To gotowy, cytowalny algorytm naszego silnika priorytetyzacji (§4).
- **Frameworki proceduralne:** **TIER** (Today's state / Impact / Essential objectives / References) + **LEAD** (Learn→Evaluate→Architect→Deliver).
- **Nasz status:** struktura i runtime ✅; **do poprawy:** jawne wyświetlenie 16→8 w raporcie, mapowanie band-ów na **własną** treść (IP), wdrożenie Impact Value jako silnika priorytetyzacji, disclaimer prawny.

### 3.2 ADMA — EU Advanced Manufacturing (publiczny, darmowy)
- **Struktura:** **7 transformacji** — T1 Advanced Mfg Tech, T2 Digital Factory, T3 Eco Factory, T4 End-to-End Customer-Focused, T5 Human-Centred, T6 Smart Mfg, T7 Value-Chain Open Factory. (W naszym runtime dodatkowo 5 pillars × 12 dims jako warstwa robocza — utrzymać mapowanie na 7T.)
- **Skala:** **5 poziomów** (1 very basic → 5 self-improving). „Factory of the Future" = średnia ≥4 w każdej z 7 transformacji.
- **Outputy znak rozpoznawczy:** **benchmark vs peers** + Transformation Plan.
- **Nasz status:** ✅ kompletny (raport z T1–T7 + FoF). **Do poprawy:** potwierdzić próg ≥4 i liczbę pytań na oficjalnym adma.ec; benchmark vs baza.

### 3.3 CMMI — Capability Maturity Model Integration (licencjonowany — ISACA)
- **Struktura:** Practice Areas w kategoriach (Doing/Managing/Enabling…), opcjonalne Safety/Security.
- **Dwie skale:** **5 Maturity Levels** (1 Initial→5 Optimizing, staged, dla organizacji) **+ Capability Levels 0–3** (Incomplete/Performed/Managed/Defined, continuous, per obszar).
- **Ocena:** to **appraisal (SCAMPI/Benchmark)**, nie certyfikat; oficjalny rating tylko Certified Lead Appraiser.
- **Nasz status:** ❌ wydmuszka (jest report+map, brak qbank/coach/scoring/inicjatyw). **Do zrobienia:** kanon Practice Areas własnymi słowami, mapowanie pytania→capability→maturity level, disclaimer „nie jest oficjalnym appraisalem CMMI".

### 3.4 LEAN — Lean 4.0 (publiczny, bez kanonu dojrzałości)
- **Struktura:** 5 zasad Lean (Value→Value Stream→Flow→Pull→Perfection), **8 marnotrawstw** (TIMWOOD + Non-Utilized Talent). Nasz runtime DBR77: 3 fazy (POMIERZ/ZOPTYMALIZUJ/AUTOMATYZUJ) × 2 wymiary (Procesy/Stanowiska) + automation potential.
- **Skala:** **brak oficjalnej** — definiujemy autorsko (rekomendacja: 5 poziomów w stylu CMMI: ad-hoc→standaryzacja→kultura kaizen→self-improving).
- **Outputy znak rozpoznawczy:** **Value Stream Map** (current/future), Lean House.
- **Nasz status:** ❌ wydmuszka. **Do zrobienia:** autorska skala + qbank + scoring + inicjatywy; VSM jako signature-visual.

### 3.5 DRD — Digital Readiness Diagnosis (nasze, autorskie)
- **Ustalenie:** DRD to **autorskie narzędzie DBR77/Consultify** — brak zewnętrznego pierwowzoru. To zaleta: pełna swoboda, ale **kanon trzeba zamrozić po naszej stronie**.
- **Stan w kodzie:** 7 osi × 34 obszary (skale 5–7 per oś). **Konflikt z marketingiem** „8 key dimensions" (picker). → **Decyzja D2** poniżej.
- **Inspiracja (legalna):** Deloitte 7 Digital Pivots + rdzeń SIRI Organisation/Process; typowy rdzeń 6–8 wymiarów cyfrowej dojrzałości.
- **Nasz status:** metodyka + qbank + coach ✅; **brak raportu i mapy** (krytyczne — flagowy framework bez outputu).

---

## 4. Wspólny silnik wyniku i priorytetyzacji

Pięć frameworków, jeden silnik (różne wejścia, ten sam aparat):

1. **Profil (radar/spider)** — kształt wyniku po wymiarach. Wspólny komponent, etykiety z kanonu.
2. **Gap as-is → to-be** — current vs target, gap liczony deterministycznie (V3 §2.4).
3. **Benchmark** — vs branża/best-in-class (SIRI BIC, ADMA peers); dla DRD/CMMI/LEAN — baza referencyjna budowana z naszych ocen.
4. **Prioritisation Matrix** — uogólniona formuła SIRI: `Impact = w₁·wpływ_biznesowy + w₂·proximity(BIC−AS_IS) + w₃·koszt/effort`. Wynik: ranking obszarów do działania (impact × effort).
5. **Roadmapa inicjatyw fazowana** — foundation→value, z traceability do sesji, ownerem, KPI do Results, ryzykami (V3 §1.5). **Domknąć mapping inicjatyw dla CMMI/LEAN.**

---

## 5. Język wizualny (waga równa merytoryce)

**Zasada:** wspólna baza wizualna + **jeden „signature visual" rozpoznawalny dla każdego frameworka** (oryginały mają charakterystyczną grafikę — odwzorowujemy ją, bo to buduje wiarygodność konsultancką).

| Framework | Signature visual (wg oryginału) | Wspólna baza |
|---|---|---|
| SIRI | **Donut 3-8-16** (building blocks→pillars→dims) + macierz band-ów + Prioritisation Matrix heatmap | radar, gap-bars, top-gaps, prioritisation matrix, roadmapa |
| ADMA | **Radar 7 transformacji** + bar benchmark vs peers + „FoF ≥4" overlay | ↑ |
| CMMI | **Schody 5 poziomów** (Initial→Optimizing) + profil capability per PA + gap map | ↑ |
| LEAN | **Value Stream Map** (current/future) + Lean House + tablica 8 muda | ↑ |
| DRD | **Radar 8 wymiarów** + macierz obszar×poziom + roadmapa cyfrowa | ↑ |

**Standard jakości:** poziom decku premium (Materiały/M17) — typografia, hierarchia, branding, layout compos-by-AI (nie szablon). Raport i deck = ten sam SoT, dwa formaty. Export min. PDF/print-friendly + PPTX/OOXML.

**Spójny system:** paleta per framework (SIRI granat/niebieski/turkus wg oryginału; ADMA, CMMI, LEAN, DRD — własne), ale wspólny grid, ikonografia i komponenty wykresów.

---

## 6. AI Coach i evidence (wyróżnik produktowy)

Coach prowadzi jak konsultant przez 6 etapów (V3 §5): Kickoff → Area loop (pytania→evidence→propose→accept) → Consistency check → Summary → Initiatives → Export. **Grounding z qbanku per framework** (toolSlug filter) — dlatego CMMI/LEAN bez qbanku dziś halucynują. V4 wymaga qbanku PL+EN dla **wszystkich pięciu**.

---

## 7. Plan domknięcia (fazowany)

> Kolejność do potwierdzenia (Decyzja D3). Rekomendacja: najpierw **DRD do flagowca** (nasze, marka, brak outputu = największa dziura wartości), potem **CMMI/LEAN do parytetu**, równolegle **warstwa wizualna** jako przekrojowy skok jakości.

- **Faza 0 — Higiena (szybkie):** wyczyścić śmieci E2E z demo-orgu; oznaczyć CMMI/LEAN „wkrótce/beta" w pickerze do czasu domknięcia (picker nie kłamie). Zamrozić kanon DRD (D2).
- **Faza 1 — DRD flagowiec:** report template + mapa (radar 8D + macierz) + dopięcie 16→8 wzorca; signature visual; deck premium.
- **Faza 2 — Warstwa wizualna przekrojowo:** signature-visuals dla SIRI/ADMA + ujednolicony system wykresów; raport/deck premium-grade (bić Gamma).
- **Faza 3 — Silnik priorytetyzacji:** uogólniona Prioritisation Matrix (Impact Value) wpięta do 5 frameworków + roadmapa fazowana.
- **Faza 4 — CMMI do 1. klasy:** kanon PA własnymi słowami + qbank PL/EN + help + scoring (pytania→capability→maturity) + inicjatywy + disclaimer.
- **Faza 5 — LEAN do 1. klasy:** autorska skala + qbank/help + scoring + VSM signature + inicjatywy.
- **Faza 6 — Coach + evidence przekrojowo + governance:** propose→accept dopięte na 5, video enablement, audyt.

Każda faza: kod→tsc/vitest→demo→odbiór Piotra (efekt: demo/screen/mockup, nie kod).

---

## 8. Decyzje do podjęcia (Piotr)

- **D1 — IP/pozycjonowanie SIRI i CMMI.** Rekomendacja: **„inspired-by"** — odwzorowanie struktury, własna treść, disclaimer „nie jest oficjalną oceną SIRI/CMMI". (Alternatywa: dążyć do oficjalnego partnerstwa INCIT/ISACA — długie, płatne.)
- **D2 — Kanon DRD.** Pogodzić kod (7 osi × 34 obszary) z obietnicą „8 wymiarów". Rekomendacja: zdefiniować **kanoniczne 8 wymiarów DRD** (np. Strategia, Procesy, Dane, Technologia/Infra, AI, Cyberbezpieczeństwo, Ludzie/Kultura, Modele biznesowe) + skala 0–5; zmapować istniejące 34 obszary pod 8 wymiarów.
- **D3 — Kolejność faz (w zakresie SIRI/DRD/ADMA).** Rekomendacja: DRD flagowiec (brak outputu = największa dziura) → wizualizacja przekrojowa SIRI/ADMA. **[OTWARTE]**
- **D4 — Ambicja wizualna.** Rekomendacja: per-framework signature-visuals (drożej, ale wiarygodność konsultancka). (Alternatywa: jeden generyczny radar dla wszystkich — taniej, mniej „wow".) **[OTWARTE]**
- **D5 — CMMI/LEAN.** ✅ **ROZSTRZYGNIĘTE 2026-06-28: później**, w międzyczasie „wkrótce/beta" w pickerze.

---

## 9. Definition of Done (rozszerza V3 §7)

Narzędzie jest „pierwszej klasy", gdy spełnia DoD V3 (UX/outputy/coach/SSOT) **plus**:
- **Fidelity:** struktura/skala/agregacja zgodne z §10, z cytowanym źródłem i (jeśli licencjonowane) disclaimerem.
- **Wizualnie:** signature-visual + raport i deck premium-grade (odbiór wizualny Piotra).
- **End-to-end na demo:** assessment → scoring → raport+deck → inicjatywy, na realnych danych, bez wydmuszek.

---

## 10. Załącznik — metodyki realnego świata (autorytatywne)

### SIRI (EDB/INCIT, bazuje na RAMI 4.0)
3 building blocks → 8 pillars → 16 dimensions; Band 0–5. Pełna lista 16:
Process: (1) Vertical Integration, (2) Horizontal Integration, (3) Integrated Product Lifecycle.
Technology — Automation: (4) Shop Floor, (5) Enterprise, (6) Facility; Connectivity: (7) Shop Floor, (8) Enterprise, (9) Facility; Intelligence: (10) Shop Floor, (11) Enterprise, (12) Facility.
Organisation — Talent Readiness: (13) Workforce Learning & Development, (14) Leadership Competency; Structure & Management: (15) Inter-/Intra-Company Collaboration, (16) Strategy & Governance.
Prioritisation: `Impact Value = W_c·[DOR_c·Cost] + W_k·[DOR_k·KPI] + W_p·[BIC − AMS]`. Frameworki: TIER, LEAD.
Źródła: INCIT (incit.org/what-we-do/siri), EDB SIRI Whitepaper (2017, PDF), EDB Prioritisation Matrix Whitepaper (2020, PDF). **Status: struktura publiczna; treść band-ów + ocena licencjonowane (Certified Assessor).**

### ADMA (European Commission)
7 transformacji (T1–T7, zob. §3.2); 5 poziomów (1–5); FoF = średnia ≥4 w każdej z 7; Quick scan ~30 pytań / Full ~58; output: Preliminary Report + benchmark vs peers + Transformation Plan.
Źródła: ADMA (North Sea Region/Interreg), ImFactory ADMA Scan, ADMA TranS4MErs. **Status: publiczny/darmowy (EU). Potwierdzić próg/liczbę pytań na adma.ec.**

### CMMI (SEI→ISACA, v3.0)
5 Maturity Levels (1 Initial, 2 Managed, 3 Defined, 4 Quantitatively Managed, 5 Optimizing) + Capability Levels 0–3 (Incomplete/Performed/Managed/Defined). Practice Areas w kategoriach. Ocena = appraisal SCAMPI/Benchmark (Certified Lead Appraiser), nie certyfikat.
Źródła: Wikipedia CMMI, ISACA Performance Improvement Solutions. **Status: model i appraisal komercyjne (ISACA); koncepcje poziomów publiczne, treść praktyk licencjonowana.**

### Lean 4.0 (Womack & Jones / TPS + Industry 4.0)
5 zasad: Value, Value Stream, Flow, Pull, Perfection. 8 muda: Transport, Inventory, Motion, Waiting, Overproduction, Over-processing, Defects, Non-Utilized Talent. Brak kanonicznej skali dojrzałości — definicja autorska. Artefakty: VSM (current/future), Lean House, A3, OEE.
Źródła: The Lean Way (5 zasad), LearnLeanSigma (8 wastes), Womack & Jones „Lean Thinking" (MIT PDF). **Status: koncepcje publiczne; brak jednego modelu dojrzałości.**

### DRD (DBR77/Consultify — autorskie)
Brak zewnętrznego pierwowzoru (dbr77.com/drd → 301 → consultify.ai). Stan w kodzie: 7 osi × 34 obszary. Inspiracja legalna: Deloitte 7 Digital Pivots, MIT CISR (strategy/org/process/tech), Gartner (5), typowy rdzeń 6–8 wymiarów.
Źródła: DBR77 DRD, DBR77 Digital Maturity Comparison, Deloitte Digital Maturity Model. **Status: nasze — kanon do zamrożenia wewnętrznie (D2).**
