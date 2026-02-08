# Assessment – DRD Editor (Nowy Interaktywny Edytor)

## Status: ✅ ZAIMPLEMENTOWANY

**Ostatnia aktualizacja:** 2026-01-29

---

## 🎯 Cel

Nowy, interaktywny edytor DRD (Digital Readiness Diagnosis) umożliwiający szczegółową ocenę dojrzałości cyfrowej firmy na poziomie każdego obszaru i poziomu.

---

## 📋 Przegląd Funkcjonalności

### 1. Struktura Hierarchiczna

Edytor obsługuje pełną strukturę DRD:

- **7 Osí** (Axes):
  1. Digital Processes (9 obszarów, 7 poziomów)
  2. Digital Products (5 obszarów, 5 poziomów)
  3. Digital Business Models (5 obszarów, 5 poziomów)
  4. Data & Analytics (5 obszarów, 7 poziomów)
  5. Organizational Culture (5 obszarów, 5 poziomów)
  6. Cybersecurity (5 obszarów, 5 poziomów)
  7. AI Maturity (5 obszarów, 5 poziomów)

- **34 Obszary** (Areas): każda oś zawiera 5-9 obszarów oceny (np. 1A, 1B, ..., 7E)

- **Poziomy** (Levels): każdy obszar ma 5-7 poziomów w zależności od osi

### 2. Logika Oceny

#### Monotoniczność Poziomów

- Jeśli poziom wyższy jest osiągnięty, wszystkie niższe są **automatycznie osiągnięte**
- Przykład: jeśli osiągnięto poziom 3, poziomy 1 i 2 są automatycznie zaznaczone jako osiągnięte
- Użytkownik może odznaczyć poziom niższy, co automatycznie odznacza wszystkie wyższe

#### Achieved Level vs Target Level

- **Achieved Level** (`achievedLevel`): aktualny osiągnięty poziom (0-7)
  - 0 = brak oceny
  - 1-7 = osiągnięty poziom
- **Target Level** (`targetLevel`): docelowy poziom (opcjonalny, 1-7)

### 3. Baza Wiedzy per Poziom

Każdy poziom ma przypisaną bazę wiedzy z:

#### 3 Pytania Walidacyjne (Yes/No)

Pytania pozwalające na jednoznaczną odpowiedź TAK/NIE:

1. Czy poziom jest zaimplementowany zgodnie z opisem?
2. Czy możemy pokazać dowód dla poziomu (system, raport, procedura)?
3. Czy działa w praktyce i jest używany regularnie (nie tylko pilot)?

**Źródło:** `src/services/assessmentKnowledge/drdKnowledge.ts`

#### Opis Poziomu

- Tytuł poziomu
- Szczegółowy opis
- Przykład (example) pokazujący jak wygląda implementacja

#### Sugerowane Technologie

Lista technologii sugerowanych dla danego poziomu, np.:
- ERP, Master Data Management (MDM), API Integration
- MES, OEE Dashboard, SCADA
- BI Dashboard, Data Warehouse, ETL/ELT
- GenAI Assistant, ML Models, MLOps

**Uwaga:** W przyszłości technologie będą sugerowane przez AI w kontekście klienta.

### 4. Komentarze per Poziom

- Każdy poziom może mieć przypisany komentarz (`levelNotes`)
- Komentarz można dodać niezależnie od odpowiedzi TAK/NIE
- Przydatne gdy:
  - Poziom nie jest osiągnięty, ale są plany
  - Poziom jest osiągnięty częściowo
  - Trzeba dodać kontekst lub wyjaśnienie

### 5. Załączniki per Poziom

Każdy poziom może mieć wiele załączników jako dowód (evidence):

- **Typy załączników:**
  - Evidence (dowód)
  - Screenshot (zrzut ekranu)
  - Document (dokument)
  - Report (raport)
  - Other (inne)

- **Funkcjonalności:**
  - Upload plików (max 25MB)
  - Podgląd załączników
  - Pobieranie plików
  - Edycja opisu załącznika
  - Usuwanie załączników

**Szczegóły:** Zobacz `08-level-attachments.md`

---

## 🎨 Interfejs Użytkownika

### Top Header

Główny nagłówek zawiera:

1. **Przycisk "Back"** - powrót do listy assessmentów
2. **Tytuł assessmentu** - nazwa sesji
3. **Metadata** - framework, status, completion %
4. **Overall Progress Bar** - wizualny pasek postępu
5. **Status zapisu:**
   - "Saving..." (spinner) podczas zapisu
   - "Saved [time]" (checkmark) po zapisie
6. **Przycisk "Save"** - manual save (również Ctrl+S/Cmd+S)

### Axis Navigation Tabs (DRD)

Poziome zakładki dla każdej z 7 osi:

- **Wygląd:**
  - Aktywna oś: fioletowe tło, biały tekst
  - Nieaktywne: białe tło, szary tekst
- **Informacje:**
  - ID osi i nazwa (np. "1. Digital Processes")
  - Progress badge: `completed/total` areas
- **Interakcja:**
  - Kliknięcie zmienia aktywną oś
  - Tooltip z pełną informacją o postępie
  - Automatyczne przewijanie do góry przy zmianie

### Sidebar z Obszarami

Lewy panel z listą obszarów dla aktualnej osi:

- **Elementy:**
  - Wyszukiwarka obszarów (search)
  - Lista obszarów z:
    - ID obszaru (np. "1A")
    - Nazwa obszaru
    - Progress bar (wizualny wskaźnik ukończenia)
    - CheckCircle icon dla w pełni ukończonych obszarów
- **Responsywność:**
  - Na mobile: collapsible sidebar z przyciskiem Menu/X
  - Przycisk "Areas" pokazuje/ukrywa sidebar

### Główny Panel Edycji

Centralny panel wyświetlający poziomy dla wybranego obszaru:

#### Karta Poziomu

Każdy poziom jest wyświetlany jako karta z:

1. **Header poziomu:**
   - Numer poziomu i tytuł
   - Checkbox "Yes (in place)" / "No"
   - CheckCircle icon (jeśli osiągnięty)

2. **Opis poziomu:**
   - Szczegółowy opis
   - Przykład (example)

3. **3 Pytania Walidacyjne:**
   - Lista 3 pytań yes/no
   - "Verified" badge (jeśli poziom osiągnięty)

4. **Sugerowane Technologie:**
   - Lista technologii jako chips/badges

5. **Komentarz:**
   - Textarea do dodania notatki

6. **Załączniki:**
   - Sekcja z listą załączników
   - Przycisk "Add attachment"
   - Podgląd, pobieranie, usuwanie

#### Wizualne Wskaźniki

- **Osiągnięty poziom:**
  - Zielona ramka (`border-green-500`)
  - Jasnozielone tło (`bg-green-50`)
  - CheckCircle icon przy "Yes (in place)"
  - "Verified" badge przy pytaniach

- **Nieosiągnięty poziom:**
  - Standardowa ramka i tło
  - Brak dodatkowych wskaźników

---

## 💾 Zapisywanie Danych

### Auto-save

- Automatyczne zapisywanie po **600ms debounce**
- Działa po każdej zmianie odpowiedzi, komentarza, target level
- **Silent save** - bez toast notifications (tylko status w headerze)

### Manual Save

- Przycisk "Save" w headerze
- Keyboard shortcut: **Ctrl+S** (Windows/Linux) lub **Cmd+S** (Mac)
- **Toast notification** po zapisie (sukces/błąd)

### Format Danych

```typescript
{
  drd: {
    areas: {
      "1A": {
        achievedLevel: 3,        // 0-7
        targetLevel: 5,         // optional, 1-7
        levelNotes: {
          "1": "Comment for level 1",
          "3": "Comment for level 3"
        }
      },
      "1B": { ... },
      // ... wszystkie 34 obszary
    }
  }
}
```

### Completion Percent

Completion jest obliczany jako:
- Liczba obszarów z `achievedLevel > 0` lub `targetLevel` ustawiony
- Podzielone przez całkowitą liczbę obszarów (34)
- Wyrażone w procentach (0-100%)

---

## 🔧 Komponenty Techniczne

### DRDAssessmentEditor

**Lokalizacja:** `src/components/assessment/drd/DRDAssessmentEditor.tsx`

**Props:**
```typescript
{
  assessmentId: string;
  readOnly?: boolean;
  value: DRDEditorAnswers;
  onChange: (next: DRDEditorAnswers) => void;
  onAxisChange?: (axisId: number) => void;
  currentAxisId?: number;
}
```

**Funkcjonalności:**
- Zarządzanie stanem osi i obszaru
- Filtrowanie obszarów (search)
- Renderowanie poziomów
- Integracja z `LevelAttachments`
- Wywoływanie `onChange` przy każdej zmianie

### AssessmentSessionEditorView

**Lokalizacja:** `src/views/AssessmentSessionEditorView.tsx`

**Funkcjonalności:**
- Host dla różnych edytorów (DRD, SIRI, etc.)
- Top header z nawigacją i akcjami
- Axis navigation tabs (tylko DRD)
- Auto-save i manual save
- Progress tracking
- Integracja z breadcrumbs (`useAppStore`)

### drdKnowledge.ts

**Lokalizacja:** `src/services/assessmentKnowledge/drdKnowledge.ts`

**Funkcjonalności:**
- Generowanie domyślnych pytań dla wszystkich poziomów
- Generowanie przykładów
- Sugerowanie technologii na podstawie słów kluczowych
- System override dla konkretnych poziomów

**API:**
```typescript
getDRDKnowledge(areaId: string, levelNumber: number): DRDLevelKnowledge
```

---

## 🎯 User Flow

1. **Otwarcie assessmentu:**
   - Użytkownik klika na assessment w `AssessmentHub`
   - Przekierowanie do `/assessment/drd/:assessmentId`
   - Ładowanie danych z API

2. **Wybór osi:**
   - Kliknięcie na zakładkę osi w top navigation
   - Automatyczne przejście do pierwszego obszaru osi
   - Scroll do góry

3. **Wybór obszaru:**
   - Kliknięcie na obszar w sidebarze
   - Wyświetlenie poziomów dla obszaru

4. **Ocena poziomu:**
   - Przeczytanie opisu poziomu
   - Odpowiedź na 3 pytania walidacyjne (mentalnie)
   - Zaznaczenie "Yes (in place)" lub pozostawienie "No"
   - (Opcjonalnie) Dodanie komentarza
   - (Opcjonalnie) Upload załączników jako dowód

5. **Zapisywanie:**
   - Auto-save po 600ms
   - Lub manual save (Ctrl+S / przycisk Save)

6. **Przejście do następnego obszaru:**
   - Kliknięcie następnego obszaru w sidebarze
   - Powtórzenie procesu

---

## 📊 Progress Tracking

### Overall Progress

- Obliczany jako: `(answered areas / total areas) * 100`
- Wyświetlany w headerze jako progress bar i procent

### Per-Axis Progress

- Dla każdej osi: `completed/total` areas
- Wyświetlany w axis navigation tabs jako badge

### Per-Area Progress

- Wizualny progress bar w sidebarze
- CheckCircle icon dla w pełni ukończonych obszarów

---

## 🔗 Integracja z Systemem

### Routing

- Route: `/assessment/:framework/:assessmentId`
- Framework: `drd`, `siri`, `adma`, `cmmi`, `lean`
- Przekierowanie z `AssessmentHub` po kliknięciu na assessment

### Breadcrumbs

- Integracja z `useAppStore` (`setCurrentView`)
- Ustawienie `AppView.ASSESSMENT_DRD` dla DRD
- Dynamiczne menu pokazuje odpowiednią ścieżkę

### API Integration

- `GET /api/assessment-workflow-v2/:id` - pobranie assessmentu
- `PUT /api/assessment-workflow-v2/:id` - zapis odpowiedzi
- Attachment API: zobacz `08-level-attachments.md`

---

## 🚀 Przyszłe Ulepszenia

1. **AI-powered suggestions:**
   - Technologie sugerowane przez AI w kontekście klienta
   - Automatyczne propozycje poziomów na podstawie kontekstu

2. **Bulk operations:**
   - Zaznaczanie wielu poziomów naraz
   - Copy-paste odpowiedzi między obszarami

3. **Export/Import:**
   - Export do PDF/Excel
   - Import z zewnętrznych źródeł

4. **Collaboration:**
   - Komentarze między użytkownikami
   - Review workflow

5. **Analytics:**
   - Wizualizacja gaps
   - Porównanie z benchmarkami branżowymi

---

## 📚 Powiązane Dokumenty

- `00-OVERVIEW.md` - przegląd modułu Assessment
- `08-level-attachments.md` - dokumentacja systemu załączników
- `11-DRD-METHOD.md` - szczegółowy opis metodyki DRD
- `wdrozenia/standards/entities/05-ASSESSMENT-REPORT.md` - standard artefaktu
