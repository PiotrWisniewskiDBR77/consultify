---
tool_slug: dynamic-swot
pack_type: initiatives
version: 1
language: pl
source_kind: tool_pack
source_name: "Consultify Dynamic SWOT initiative patterns"
created_at: 2026-03-18
---

# Dynamic SWOT — wzorce inicjatyw (v1, PL)

## 0) Jak używać tego packa

Ten pack służy do przejścia:

- od kart SWOT,
- przez napięcia strategiczne,
- do rekomendowanych ruchów,
- i dalej do inicjatyw lub pomysłów.

Reguły:

- **napięcie przed inicjatywą**: nie twórz inicjatywy bez linked tension lub wyraźnego powodu biznesowego.
- **source summary jest nadrzędne**: inicjatywa ma dać się obronić z poziomu final source summary.
- **foundation przed scale**: jeśli problem dotyczy danych, procesu, governance lub kompetencji, najpierw inicjatywa fundamentów.
- **idea zamiast initiative**: jeśli kierunek jest obiecujący, ale dowody są słabe, zapisz go jako idea candidate.

---

## 1) Kategorie ruchów i ich domyślna logika

### MOVE-01 — Quick Win

- **Kiedy**: istnieje wysoka szansa i niski wysiłek wdrożeniowy.
- **Co zwykle oznacza**: szybka korekta procesu, pakietu, komunikacji, pricingu lub kanału.
- **Output default**: initiative albo idea, jeśli potrzebny jest szybki pilot.

### MOVE-02 — Big Bet

- **Kiedy**: istnieje silna szansa, ale wymaga inwestycji i zgody interesariuszy.
- **Co zwykle oznacza**: nowy kanał, nową ofertę, nową capability albo zmianę modelu.
- **Output default**: initiative + report/presentation.

### MOVE-03 — Defensive Move

- **Kiedy**: zagrożenie jest pilne, a brak reakcji jest kosztowny.
- **Co zwykle oznacza**: obronę marży, retencji, SLA, jakości lub pozycji konkurencyjnej.
- **Output default**: initiative albo report dla szybkiej decyzji.

### MOVE-04 — Capability Build

- **Kiedy**: organizacja nie ma jeszcze zdolności, by wykorzystać szansę albo obronić się przed ryzykiem.
- **Co zwykle oznacza**: data, governance, enablement, playbook, proces, zespół.
- **Output default**: initiative; czasem najpierw idea lub discovery sprint.

---

## 2) Wzorce per typ napięcia

### [pattern_id:so_attack_offer] SO / Attack — przewaga + szansa = nowy pakiet rynkowy

- **Gap signal / tension**:
  - mocna relacja z klientem lub jakość delivery,
  - jednocześnie rośnie nowy segment lub kanał.
- **Likely root causes**:
  - organizacja nie zmaterializowała jeszcze przewagi w ofercie albo GTM.
- **Recommended move**:
  - zaprojektować ofertę lub pakiet dedykowany pod nową okazję.
- **Initiative pattern**:
  - `Launch package / go-to-market sprint`
- **Why now**:
  - okno rynkowe jest dostępne, ale nie będzie trwało wiecznie.
- **KPIs to track**:
  - pipeline z nowego segmentu,
  - win rate,
  - time-to-value,
  - marża.
- **Dependencies**:
  - owner oferty,
  - messaging,
  - enablement sprzedaży,
  - prosty playbook wdrożenia.
- **First step**:
  - zdefiniować segment, ofertę MVP i pilotaż u 3-5 klientów.

### [pattern_id:so_attack_channel] SO / Attack — przewaga operacyjna + wzrost kanału = skalowanie kanału

- **Gap signal / tension**:
  - firma działa szybciej lub lepiej niż konkurencja,
  - ale nie ma skalowalnego kanału wejścia.
- **Likely root causes**:
  - brak dedykowanego procesu, partner enablement albo self-serve.
- **Recommended move**:
  - zbudować standaryzowany kanał lub onboarding.
- **Initiative pattern**:
  - `Partner/self-serve enablement program`
- **Why now**:
  - przewaga wewnętrzna bez kanału nie monetyzuje się.
- **KPIs to track**:
  - konwersja kanału,
  - aktywacja partnerów,
  - onboarding cycle time.
- **Dependencies**:
  - playbook,
  - content enablement,
  - narzędzia CRM / routing.
- **First step**:
  - opisać aktualny lejek i zidentyfikować największe tarcie w pierwszych 30 dniach.

### [pattern_id:wo_repair_capability] WO / Repair — słabość + szansa = capability build

- **Gap signal / tension**:
  - rynek się otwiera,
  - ale organizacja nie ma zdolności lub procesu, by skorzystać.
- **Likely root causes**:
  - brak ownera,
  - brak narzędzi,
  - brak standardu pracy.
- **Recommended move**:
  - zbudować capability przed skalowaniem.
- **Initiative pattern**:
  - `Capability build program`
- **Why now**:
  - bez tej inicjatywy szansa zostanie utracona albo skonsumowana niską jakością.
- **KPIs to track**:
  - gotowość procesu,
  - czas wdrożenia capability,
  - wykorzystanie nowego standardu,
  - liczba przypadków użycia.
- **Dependencies**:
  - sponsor,
  - owner procesu,
  - budżet,
  - szkolenia.
- **First step**:
  - zrobić krótki discovery sprint i opisać minimalny operating model.

### [pattern_id:wo_repair_process] WO / Repair — słabość procesu + szansa sprzedażowa = standaryzacja procesu

- **Gap signal / tension**:
  - widoczna szansa wzrostu,
  - ale proces sprzedaży, wdrożenia lub obsługi jest niestabilny.
- **Likely root causes**:
  - brak standardów, fragmentacja procesu, ręczne przejścia.
- **Recommended move**:
  - uprościć i ustandaryzować proces krytyczny.
- **Initiative pattern**:
  - `Critical process standardization`
- **Why now**:
  - wzrost bez standaryzacji zwiększy chaos i koszt obsługi.
- **KPIs to track**:
  - cycle time,
  - conversion,
  - error rate,
  - SLA adherence.
- **Dependencies**:
  - proces owner,
  - mierniki,
  - mapa obecnego procesu.
- **First step**:
  - zmapować obecny proces end-to-end i wskazać 3 największe straty.

### [pattern_id:st_defend_margin] ST / Defend — przewaga + zagrożenie = obrona marży / pozycji

- **Gap signal / tension**:
  - organizacja ma przewagi jakościowe lub relacyjne,
  - rynek wywiera presję cenową lub konkurencyjną.
- **Likely root causes**:
  - brak czytelnego value proposition,
  - przewaga nie jest wystarczająco opakowana i zakomunikowana.
- **Recommended move**:
  - przetłumaczyć przewagę na obronę marży i pozycjonowanie.
- **Initiative pattern**:
  - `Value defense / positioning upgrade`
- **Why now**:
  - bez aktywnej obrony przewaga rozpuści się w wojnie cenowej.
- **KPIs to track**:
  - average selling price,
  - marża brutto,
  - win rate premium,
  - churn klientów kluczowych.
- **Dependencies**:
  - marketing,
  - sales enablement,
  - pricing governance.
- **First step**:
  - ustalić 3 najważniejsze przewagi, które muszą być widoczne w ofercie i rozmowie handlowej.

### [pattern_id:st_defend_service] ST / Defend — przewaga jakościowa + zagrożenie operacyjne = tarcza service excellence

- **Gap signal / tension**:
  - marka opiera się na jakości,
  - ale rośnie zagrożenie spadku SLA, jakości albo zdolności delivery.
- **Likely root causes**:
  - przeciążenie zespołu,
  - brak priorytetyzacji,
  - niewidoczność ryzyk.
- **Recommended move**:
  - zbudować system kontroli jakości / capacity / early warning.
- **Initiative pattern**:
  - `Service resilience and quality guardrails`
- **Why now**:
  - utrata jakości może szybko zniszczyć najsilniejszą przewagę wewnętrzną.
- **KPIs to track**:
  - SLA,
  - reklamacje,
  - NPS/CSAT,
  - utilization.
- **Dependencies**:
  - dane operacyjne,
  - rytm review,
  - właściciel jakości.
- **First step**:
  - zidentyfikować krytyczne punkty failure i ustawić tygodniowy przegląd sygnałów jakości.

### [pattern_id:wt_protect_risk] WT / Protect — słabość + zagrożenie = risk containment

- **Gap signal / tension**:
  - wewnętrzna słabość wzmacnia zewnętrzne ryzyko.
- **Likely root causes**:
  - brak zabezpieczeń, brak procesu, niski poziom kontroli.
- **Recommended move**:
  - ograniczyć ekspozycję i zamknąć największe luki.
- **Initiative pattern**:
  - `Risk containment sprint`
- **Why now**:
  - koszt braku działania jest większy niż koszt szybkiej ochrony.
- **KPIs to track**:
  - liczba incydentów,
  - czas reakcji,
  - poziom zgodności,
  - ekspozycja na ryzyko.
- **Dependencies**:
  - owner ryzyka,
  - minimalny plan działań,
  - monitoring.
- **First step**:
  - opisać 3 największe scenariusze szkody i zabezpieczenia minimalne.

### [pattern_id:wt_protect_foundation] WT / Protect — brak capability + zagrożenie rynkowe = foundation first

- **Gap signal / tension**:
  - organizacja nie ma podstaw, by bronić się przed zmianą na rynku.
- **Likely root causes**:
  - brak danych,
  - brak governance,
  - brak właściciela obszaru.
- **Recommended move**:
  - zacząć od fundamentów zamiast od dużej transformacji.
- **Initiative pattern**:
  - `Foundation stabilization`
- **Why now**:
  - duży program bez fundamentów nie domknie ryzyka.
- **KPIs to track**:
  - completeness danych,
  - regularność review,
  - poziom wdrożenia nowych standardów.
- **Dependencies**:
  - sponsor,
  - RACI,
  - podstawowy workflow.
- **First step**:
  - ustalić minimum governance i wskaźniki gotowości.

---

## 3) Wzorce przekrojowe

### [pattern_id:discovery_sprint] Gdy evidence jest za słabe

- **Gap signal / tension**:
  - ważny kierunek istnieje, ale dowody są niepełne lub sprzeczne.
- **Likely root causes**:
  - brak danych,
  - rozbieżne opinie,
  - brak benchmarku.
- **Recommended move**:
  - zamiast pełnej inicjatywy uruchomić discovery sprint.
- **Initiative pattern**:
  - `Evidence / discovery sprint`
- **Why now**:
  - pozwala szybko podnieść jakość decyzji bez overcommitu.
- **KPIs to track**:
  - liczba zamkniętych pytań krytycznych,
  - czas do decyzji,
  - poziom confidence w kolejnym review.
- **Dependencies**:
  - dostęp do danych,
  - właściciel discovery,
  - ramy czasu 2-4 tygodnie.
- **First step**:
  - spisać 3 najważniejsze niewiadome blokujące decyzję.

### [pattern_id:report_before_initiative] Gdy najpierw potrzeba buy-in

- **Gap signal / tension**:
  - ruch jest sensowny, ale wymaga akceptacji zarządczej lub klienta.
- **Likely root causes**:
  - duży wpływ,
  - duży wysiłek,
  - potrzeba uzasadnienia.
- **Recommended move**:
  - wygenerować report lub presentation przed inicjatywą.
- **Initiative pattern**:
  - `Executive alignment package`
- **Why now**:
  - skraca drogę od insightu do decyzji sponsorskiej.
- **KPIs to track**:
  - czas do decyzji,
  - liczba rund feedbacku,
  - approval rate.
- **Dependencies**:
  - final source summary,
  - jasny recommendation ask,
  - sponsor.
- **First step**:
  - określić, jaki rodzaj decyzji ma zapaść po decku lub raporcie.

### [pattern_id:idea_parking] Gdy kierunek jest obiecujący, ale jeszcze niedojrzały

- **Gap signal / tension**:
  - pojawia się ciekawy ruch, ale nie ma wystarczającej gotowości na wdrożenie.
- **Likely root causes**:
  - niski confidence,
  - za mało danych,
  - brak ownera.
- **Recommended move**:
  - zapisać kierunek jako idea z pytaniem eksploracyjnym.
- **Initiative pattern**:
  - `Idea parking with next question`
- **Why now**:
  - chroni insight przed utratą, ale nie udaje gotowości.
- **KPIs to track**:
  - liczba idei wracających do walidacji,
  - czas od idei do decyzji o pilocie.
- **Dependencies**:
  - linked evidence,
  - next exploration question,
  - owner dalszego sprawdzenia.
- **First step**:
  - sformułować jedno pytanie, które musi zostać rozstrzygnięte, aby pomysł awansował do inicjatywy.

---

## 4) Pola obowiązkowe dobrej inicjatywy z Dynamic SWOT

- tytuł,
- opis,
- `why now`,
- linked tension lub linked move,
- oczekiwany wpływ,
- wysiłek,
- ryzyko,
- pierwszy krok,
- właściciel lub typ właściciela,
- KPI outcome,
- KPI leading,
- zależności.

---

## 5) Zasady jakości

- nie twórz dwóch dużych inicjatyw, jeśli jedna capability foundation jest warunkiem obu,
- jeśli napięcie nie ma dowodów, najpierw discovery,
- jeśli ruch jest polityczny lub wymaga buy-in, najpierw report/deck,
- jeśli kierunek jest inspirujący, ale niedojrzały, wybierz idea,
- zawsze zachowaj związek:
  - `signal -> swot card -> tension -> move -> output`.
