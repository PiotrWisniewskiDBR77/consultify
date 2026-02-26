# Consultinity — Operating Model v3 (SSOT)

> **Status:** Draft (v3 kick-off)  
> **Scope:** Jak aplikacja pracuje z klientem (flow + role visibility + output packages)  
> **Źródła prawdy (as-is code):**
> - Routing i moduły: `docs/modules/MODULE_ROUTING_ARCHITECTURE.md`
> - System axis: `docs/product/SYSTEM_ARCHITECTURE_BRIEF.md`
> - UI shell (module hub): `docs/ui-standards/03-modules/module-hub-standard.md`
> - View modes (table/grid/kanban/timeline/calendar): `src/components/shared/ModuleHub/types.ts`

## 1) Kontrakt produktu (oś systemu)

- **Centralny obiekt:** Initiative (jeden obiekt, jeden lifecycle).  
- **Dwa równorzędne źródła inicjatyw:** Tools oraz Assessments (z `SYSTEM_ARCHITECTURE_BRIEF.md`).  
- **Insighty** są artefaktem kontekstu (Interview) — nie są źródłem inicjatyw.

## 2) Moduły w osi pracy klienta (flow)

Sekwencja (kanoniczna):

1. **Chat** → rozmowa, kontekst, szybkie działania (nie jest artefaktem governance)
2. **MyWork** → praca własna użytkownika (personal hub)
3. **Interview** → zbieranie kontekstu organizacji (discovery)
4. **Tools** → diagnoza / metodyki / narzędzia (consulting + licensed) i ich output packages
5. **Initiatives** → planowanie portfela i governance
6. **Execution** → realizacja (wdrożenie), operacyjne zarządzanie pracą
7. **Realization / Benefits** → KPI/ROI i rozliczenie efektów
8. **Financial Analysis** → analizy finansowe (osobny obszar v3)
9. **Reports & Presentations** → biblioteki + generatory

> Uwaga: w kodzie istnieją dziś osobne moduły `Discovery Tools` i `Licensed Tools (Assessment)` w sidebarze.
> Model v3 łączy je konceptualnie w jeden obszar “Tools” (UI/UX), bez negowania stanu as-is.

## 3) Role visibility (kanon v3)

W Operating Model v3 rozróżniamy **dwa poziomy**:

- **(A) System roles** (Owner/Admin/User) — opis w `SYSTEM_ARCHITECTURE_BRIEF.md` oraz `docs/product/ROLES_MODEL.md`
- **(B) Work roles** w kontekście flow (Manager/Owner vs Respondent/User)

### 3.1 MyWork — pierwszy ekran zależny od roli

- **Manager/Owner:** startuje w **Executive** (kontrola, przegląd, zarządzanie)
- **Pozostali użytkownicy:** startują w **Focus** (wykonanie, “dzień pracy”)
- Pozostałe zakładki (Tasks/Decisions/Notebook/Ideas/Inbox itd.) są analogiczne dla wszystkich (różnią się zakresem danych).

### 3.2 Interview — praca “konsultant → respondent”

Zakładki (kanon):

- `Inbox`
- `Sessions`
- `Templates`
- `Assessment`
- `Assignments` (rename z “Assigned”)
- `Insights`

Widoczność:

- **Manager/Owner:** widzi wszystko (Templates, Sessions, pełny obraz).
- **Respondent/User:** nie widzi Templates ani Sessions; widzi Inbox/Assignments i odpowiada.

## 4) Tools (v3) — biblioteka + sesje + output packages

Model v3 scala dwa obszary:

- narzędzia konsultingowe (Discovery Tools)
- narzędzia licencjonowane (Assessments)

### 4.1 Zakładki Tools (kanon)

1. **Library** — wszystkie dostępne narzędzia (karty + filtry)
2. **Sessions** — narzędzia “w pracy” (uruchomienia, workflow, akceptacje)
3. **Reports** — raporty z narzędzi
4. **Presentations** — prezentacje z narzędzi
5. **Initiatives** — inicjatywy wygenerowane z narzędzi (kontrola źródeł)

### 4.2 Kluczowe reguły

- **Każdy output** (report/presentation/initiative) ma *source traceability* i wskazuje **kanoniczne źródło**:
  - `ToolSession` lub `AssessmentReport` (SSOT: `docs/product/SOURCE_TRACEABILITY_SPEC.md`)
- MyWork (Idea/Notebook) może być **punktem startowym** (seed), ale jeśli kończy się outputem “projektowym”,
  system materializuje to jako **MyWork ToolSession** (typ `MYWORK`) i dopiero z niego powstaje output.
- Jeśli Idea (MyWork) skończy się raportem/prezentacją/inicjatywą, te outputy pojawiają się też w Tools
  jako elementy biblioteki outputów — powiązane ze swoim `ToolSession` (żeby mieć pełną kontrolę źródeł).

## 5) Initiatives (v3) — zestawienia + Analysis tab

Zestawienia (view modes): tabela / karty / kanban / gantt(timeline) / kalendarz (tam, gdzie ma sens).

Nowa zakładka:

- **Analysis** — analiza zasobów, wykonalności, logiki inicjatyw, timeline racjonalności, kompletności przygotowania.

## 6) Execution (v3) — realizacja + raportowanie + zarządzanie zmianą

Zestawienia analogiczne do Initiatives, ale z naciskiem na operacyjne zarządzanie.

Nowe obszary:

- **Reporting**: postępy, zużyte zasoby, zagrożenia (ryzyka realizacji)
- **Management**: propozycje zmian terminów, workarounds, plan obejścia ryzyk, “co robimy gdy jest czerwono”.

## 7) Realization / Benefits (v3)

Fokus na:

- KPI
- analiza ROI / zwrotu
- zestawienia tabelaryczne (standard “interactive table”)

## 8) Financial Analysis (v3) — 5 submodułów

Zakładki:

1. Modelowanie finansowe
2. Analiza finansowa (biblioteka analiz)
3. Predykcje finansowe (scenariusze/założenia)
4. Wycena przedsiębiorstwa
5. Analiza inwestycyjna (CAPEX)

SSOT (szczegół): `docs/product/FINANCIAL_ANALYSIS_V3.md`

## 9) Reports & Presentations (v3) — biblioteki + generatory

W obu obszarach:

- biblioteka templatek
- biblioteka “finalnych” sztuk
- widoki: lista + karty (karty = okładki)
- CTA: “Dodaj raport” / “Dodaj prezentację” → generator (template lub final).

SSOT (UX): `docs/product/PRESENTATIONS_AND_REPORTS_V3.md`

## 10) Out of scope v3

- MCP analiza operacyjna
- MCP analiza automatyzacji

Te elementy są częścią planu v4+ i w v3 występują wyłącznie jako “future”.

