# ★ TEST ZAUFANIA — TRZY FILARY (dokument koncepcyjny)

> **Data:** 2026-07-01 · **Status:** ŻYWY — kryterium jakości całego finiszu
> **Zlecenie Piotra:** zanim dokończymy, sprawdzić czy HARVARD+VEGAS prowadzą do właściwego celu.
> **Podstawa:** 2 głębokie audyty agentowe (merytoryka: 41 wejść w kod/doktryny · przepływy: 44 wejścia, mapa 11 przejść) + wyniki żywych odbiorów Piotra.

---

## 1. GWIAZDA PÓŁNOCNA

**Consultify = Harvey dla consultingu × Spotify dla dostępu.**
Nie soft *wspierający* konsultanta — narzędzie, które **przejmuje pracę konsultanta** i daje ją każdej firmie, tak jak Spotify dał każdemu muzykę.

Warunek: **ZAUFANIE**, które stoi na trzech filarach naraz — i one się **mnożą, nie sumują** (świetny tool × brzydkie opakowanie = 0):

| Filar | Pytanie testowe klienta |
|---|---|
| **ŁADNI** | „Czy to wygląda jak produkt premium 2026?" |
| **NIEZAWODNI** | „Czy moja praca płynie od rozmowy do rezultatu bez strat i zgrzytów?" |
| **KOMPETENTNI** | „Czy dostaję pracę, za którą płaciłbym konsultantowi?" |

## 2. WERDYKT PER FILAR

### FILAR 1 — ŁADNI: ~40% · plan VEGAS **WYSTARCZA** (po korekcie „pełna apka")
Zdiagnozowane w odbiorach („grafika sprzed 10 lat", motyw rozjechany, chrome chaos). Fundament tokenów znakomity, problem = ~4% adherencji. **VEGAS w pełnym zakresie (~115 ekranów, fale 0-5) + D-I Editor Shell domykają ten filar.** Nic nie dokładamy — tylko dowozimy.

### FILAR 2 — NIEZAWODNI: ~60% · plan HARVARD **POKRYWA CZĘŚCIOWO** — 4 dziury BEZ planu
Mapa 11 przejść łańcucha *rozmowa→diagnoza→inicjatywa→wdrożenie→rezultat→materiał*:
- ✅ auto-spięte: **3/11** (Wywiad→Insights · Insights→Inicjatywy · Czat→Canvas-deliverable)
- 🟡 ręczne: **3/11** (Assessment→Inicjatywy · Ideas→convert · Inicjatywy→Execution)
- 🔴 martwe/stub: **3/11** (Execution→Rezultaty [B1b przyjęte, kod nie istnieje] · Tools→Inicjatywy [callback bez handlera] · rejestr M17)
- 🔴 brak: **2/11** (Statements→Model grounding · Rezultaty↔Finanse reconciliation [stąd absurd OEE])

**Obietnica „system prowadzi od rozmowy do rezultatu" = dziś dostarczana w ~60%; od M13 w dół łańcuch rozpada się na wyspy.**

**4 dziury, których NIE MA w żadnym planie (nowe):**
1. **Split-brain deliverables** — czat generuje artefakt, ale nie rejestruje go w M17 z odnośnikiem do źródła (`registerChatDeliverable` = stub donikąd). Teresa „kłamie o lokalizacji" właśnie przez to.
2. **Tools→Inicjatywy** — SWOT produkuje rekomendacje, ale nie ma przycisku/handoffa tworzącego z nich inicjatywy (callback bez implementacji). Tool „pomaga planować", wynik zostaje offline.
3. **M17 rejestr + dedup** — artefakty bez pamięci pochodzenia; brak filtra draft/test → 80 pozycji z duplikatami.
4. **Finance grounding pipeline** — model ma pole `source_statement_id`, ale nikt go nie ustawia i nie ma endpointu „zaciągnij historię ze Statement" → scenariusze to wróżby, nie prognozy.

### FILAR 3 — KOMPETENTNI: 2.5-3.5/5 · **W OGÓLE NIEZAADRESOWANY w planach** (największe odkrycie audytu)
| Obszar | Ocena | Diagnoza jednym zdaniem |
|---|---|---|
| Tools (M12A) | 3/5 | Dobra doktryna i mechanika propose→accept, ale pytania płytkie (3-4 tak/nie zamiast drabinki poziomów z rozgałęzieniami), rekomendacje = formułki bez business case. „Ruch konsultanta to przycisk, nie decyzja." |
| Assessmenty (M12B) | 2.5-3.5/5 | SIRI/ADMA solidne; **DRD (flagowiec!) bez raportu i mapy — klient nie dostaje dokumentu**; raporty opisowe („masz 2.8") zamiast wnioskowych („napraw X najpierw, bo→"); brak ścieżki poziom N→N+1; CMMI/LEAN = wydmuszki (picker obiecuje). |
| Finanse (M16) | 2.5/5 | Silnik liczy poprawnie (NPV/IRR/warianty), ale to **kalkulator, nie analiza**: liczby bez narracji, scenariusze mechaniczne ±15% zamiast biznesowych dźwigni, zero współzależności inicjatyw, defaulty bez strategii. |

**Wspólny wzorzec (kluczowy wniosek):** fundamenty koncepcyjne dobre, silniki liczą — ale wykonanie kończy się na **„pokaż liczby"** zamiast **„powiedz, co znaczą i co robić"**. Ta ostatnia mila — wnioskowanie, priorytetyzacja impact×effort, ścieżka działania — **to jest dokładnie praca, za którą klient płaci konsultantowi.** Bez niej nie ma „Harvey dla consultingu", jest ładny formularz.

## 3. KOREKTA PLANU FINISZU (co dokładamy)

HARVARD rozszerza się o **dwa nowe strumienie** (6 i 7):

### STRUMIEŃ 6 — SPINY ŁAŃCUCHA (filar NIEZAWODNI do 100%)
S6.1 Rejestr deliverables: każdy artefakt (czat/tool/inicjatywa) rejestrowany w M17 z back-reference do źródła; implementacja `registerChatDeliverable` end-to-end. · S6.2 Tools→Inicjatywy handoff (wzorzec = istniejący promoteWorkbench assessmentów). · S6.3 M17 dedup + filtr draft/test. · S6.4 Finance grounding: „utwórz model ze Statement" + endpoint refresh-from-source. · (S6.5 = B1b handoff M14→M15 — już w kolejce Cloud.)

### STRUMIEŃ 7 — WARSTWA WNIOSKÓW (filar KOMPETENTNI: z 2.5-3.5 na 4+)
Priorytety wg ryzyka reputacyjnego i dźwigni:
1. **DRD raport + mapa** (P0 — flagowiec bez outputu) — executive summary wnioskowe + radar + roadmapa transformacji.
2. **Raporty wnioskowe wszędzie** (assessmenty + finanse): szablon „co jest → co to znaczy → co robić najpierw i dlaczego (impact×effort) → z jakim efektem" zamiast tabel z wynikami. Jeden standard: **CONCLUSION_LAYER_STANDARD** (nowy SSOT, rodzeństwo CARD_CONTENT_FORMULA).
3. **Q-bank deepening** (Tools): drabinki poziomów z rozgałęzieniami zamiast tak/nie; wzorzec na Dynamic SWOT → rozjazd na 19.
4. **Business case w finansach**: assumptions→model→scenariusze nazwane biznesowo→rekomendacja; rozkład benefitu (savings/growth/risk); współzależności inicjatyw.
5. **Higiena uczciwości**: CMMI/LEAN wyraźnie „wkrótce" (bez startu sesji) — zgodne z D-B.

### Decyzje domyślne CTO (spójne z wcześniejszymi decyzjami Piotra; obowiązują, chyba że Piotr zmieni):
- **DEC-1:** Deliverable z czatu/toola → **auto-rejestracja w M17 z back-reference** (wynika z gwiazdy „jeden deliverable, zero duplikatów").
- **DEC-2:** Moment handoffu benefits = **DONE** (już przyjęte w B1b).
- **DEC-3:** Nowy model finansowy → **domyślnie zaciąga zatwierdzony Statement** (grounding), z możliwością „start od zera" jako świadomy wybór.
- **DEC-4:** M17 pokazuje **tylko realne outputs** (drafty/testy odfiltrowane; robocze w osobnym widoku „Robocze").

## 4. ZAKTUALIZOWANA DEFINICJA KOŃCA (test zaufania zamiast listy tasków)
Projekt jest skończony, gdy na demo przechodzi **TEST ZAUFANIA**:
1. **ŁADNI:** Piotr przechodzi całą apkę i nigdzie nie mówi „to nie jest 2026". (VEGAS fale 0-5 + D-I)
2. **NIEZAWODNI:** 11/11 przejść łańcucha działa (auto lub jawnie ręcznie z sensem), z dowodami działania (D-J); zero martwych stubów.
3. **KOMPETENTNI:** DRD/SIRI/ADMA + top-5 tooli + analiza finansowa produkują dokument, który Piotr — jako właściciel firmy konsultingowej — **podpisałby własnym nazwiskiem przed klientem.** To jest ostateczna miara: „czy pokazałbym to klientowi jako moją pracę?"

## 5. WPŁYW NA PROGNOZĘ
Strumienie 6-7 to realna dodatkowa praca (~30-40% więcej niż sam backlog HARVARD). Uczciwa prognoza całości: **~3-4 tygodnie** przy rytmie 4 sprintów/dzień (zamiast 2-3). Alternatywa świadoma: wersja „bez strumienia 7" byłaby szybsza, ale oblałaby test „czy pokazałbym to klientowi" — czyli nie byłaby końcem.
