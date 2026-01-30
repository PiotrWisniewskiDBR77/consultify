# Assessment – Level Attachments System

## Status: ✅ ZAIMPLEMENTOWANY

**Ostatnia aktualizacja:** 2026-01-29

---

## 🎯 Cel

System zarządzania załącznikami (evidence files) dla każdego poziomu assessmentu, umożliwiający dodawanie dowodów w formie plików.

---

## 📋 Przegląd Funkcjonalności

### Typy Załączników

System obsługuje 5 typów załączników:

1. **Evidence** - ogólny dowód implementacji poziomu
2. **Screenshot** - zrzut ekranu systemu/interfejsu
3. **Document** - dokument (PDF, Word, etc.)
4. **Report** - raport (analiza, KPI, etc.)
5. **Other** - inne typy plików

### Funkcjonalności

- ✅ **Upload plików** - dodawanie załączników per poziom
- ✅ **Lista załączników** - wyświetlanie wszystkich załączników dla poziomu
- ✅ **Podgląd** - otwieranie plików w nowej karcie
- ✅ **Pobieranie** - download załączników
- ✅ **Edycja opisu** - aktualizacja opisu załącznika
- ✅ **Usuwanie** - usuwanie załączników z potwierdzeniem
- ✅ **Typy plików** - obsługa wszystkich typów (images, PDFs, documents, etc.)
- ✅ **Ograniczenia** - maksymalny rozmiar pliku: 25MB

---

## 🎨 Interfejs Użytkownika

### Komponent LevelAttachments

**Lokalizacja:** `src/components/assessment/LevelAttachments.tsx`

#### Props

```typescript
{
  assessmentId: string;
  axisId: string;
  levelNumber: number;
  areaId?: string;        // opcjonalne dla obszarów DRD
  readOnly?: boolean;     // tryb tylko do odczytu
  compact?: boolean;      // kompaktowy widok
}
```

#### Wygląd

1. **Sekcja załączników:**
   - Header: "Attachments" z licznikiem
   - Przycisk "Add attachment" (jeśli nie readOnly)
   - Lista załączników (jeśli istnieją)

2. **Formularz uploadu:**
   - Dropdown wyboru typu załącznika
   - Pole opisu (opcjonalne)
   - Przycisk "Choose file" / drag & drop
   - Status uploadu (uploading spinner)

3. **Karta załącznika:**
   - Ikona typu pliku (Image/FileText/File)
   - Nazwa pliku
   - Rozmiar pliku (KB/MB)
   - Opis (jeśli istnieje)
   - Akcje:
     - Eye icon - podgląd
     - Download icon - pobieranie
     - Edit icon - edycja opisu
     - Trash icon - usuwanie

#### Stany

- **Empty state:** "No attachments for this level"
- **Loading:** spinner podczas ładowania
- **Error:** komunikat błędu z możliwością retry
- **Uploading:** spinner i "Uploading..." text

---

## 🔧 Backend API

### Endpoints

#### 1. Upload Załącznika

```
POST /api/assessment-level-attachments
Content-Type: multipart/form-data
```

**Body:**
- `file` (File) - plik do uploadu
- `assessmentId` (string) - ID assessmentu
- `axisId` (string) - ID osi
- `levelNumber` (number) - numer poziomu
- `areaId` (string, optional) - ID obszaru (dla DRD)
- `attachmentType` (string) - typ załącznika
- `description` (string, optional) - opis

**Response:**
```json
{
  "id": "uuid",
  "fileName": "example.pdf",
  "fileSize": 12345,
  "mimeType": "application/pdf",
  "attachmentType": "EVIDENCE",
  "description": "Optional description"
}
```

#### 2. Lista Załączników dla Poziomu

```
GET /api/assessment-level-attachments/level/:assessmentId/:axisId/:levelNumber?areaId=...
```

**Query params:**
- `areaId` (optional) - ID obszaru

**Response:**
```json
{
  "attachments": [
    {
      "id": "uuid",
      "fileName": "example.pdf",
      "fileSize": 12345,
      "mimeType": "application/pdf",
      "attachmentType": "EVIDENCE",
      "description": "Description",
      "createdAt": "2026-01-29T10:00:00Z"
    }
  ]
}
```

#### 3. Pobieranie Załącznika

```
GET /api/assessment-level-attachments/download/:attachmentId
```

**Response:**
- File stream z odpowiednimi headers (`Content-Type`, `Content-Disposition`)

#### 4. Aktualizacja Opisu

```
PUT /api/assessment-level-attachments/:attachmentId/description
Content-Type: application/json
```

**Body:**
```json
{
  "description": "New description"
}
```

**Response:**
```json
{
  "id": "uuid",
  "description": "New description"
}
```

#### 5. Usuwanie Załącznika

```
DELETE /api/assessment-level-attachments/:attachmentId
```

**Response:**
```json
{
  "success": true
}
```

---

## 💾 Storage

### Struktura Plików

Pliki są przechowywane na dysku w strukturze:

```
/uploads/assessment-level-attachments/
  └── <organizationId>/
      └── <timestamp>-<random>-<sanitized-filename>
```

**Przykład:**
```
/uploads/assessment-level-attachments/
  └── org-123/
      └── 1706524800000-123456789-evidence_report.pdf
```

### Baza Danych

Tabela `assessment_level_attachments`:

```sql
CREATE TABLE assessment_level_attachments (
  id TEXT PRIMARY KEY,
  assessment_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  axis_id TEXT NOT NULL,
  area_id TEXT,                    -- optional dla DRD
  level_number INTEGER NOT NULL,
  attachment_type TEXT DEFAULT 'EVIDENCE',
  description TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ala_assessment ON assessment_level_attachments(assessment_id);
CREATE INDEX idx_ala_axis_level ON assessment_level_attachments(axis_id, level_number);
CREATE INDEX idx_ala_area ON assessment_level_attachments(area_id);
```

### Indeksy

- `assessment_id` - szybkie pobieranie wszystkich załączników dla assessmentu
- `axis_id, level_number` - szybkie pobieranie załączników dla poziomu
- `area_id` - szybkie pobieranie załączników dla obszaru (DRD)

---

## 🔐 Bezpieczeństwo

### Middleware

Wszystkie endpointy używają:

1. **authRateLimiter** - rate limiting
2. **verifyToken** - weryfikacja tokenu JWT
3. **demoContextMiddleware** - kontekst demo (jeśli dotyczy)

### Walidacja

- **File size:** maksymalnie 25MB
- **File type:** wszystkie typy dozwolone (walidacja po stronie klienta)
- **Organization isolation:** pliki są izolowane per organizacja
- **Sanitization:** nazwy plików są sanitizowane (usuwanie niebezpiecznych znaków)

### Permissions

- Tylko użytkownicy z dostępem do assessmentu mogą:
  - Uploadować załączniki
  - Pobierać załączniki
  - Edytować/usuwanie załączniki

---

## 🎯 User Flow

1. **Dodawanie załącznika:**
   - Użytkownik klika "Add attachment"
   - Wybiera typ załącznika (dropdown)
   - (Opcjonalnie) Dodaje opis
   - Wybiera plik (file picker lub drag & drop)
   - Kliknięcie "Upload"
   - Spinner podczas uploadu
   - Załącznik pojawia się na liście

2. **Podgląd załącznika:**
   - Kliknięcie ikony Eye
   - Otwarcie pliku w nowej karcie przeglądarki

3. **Pobieranie załącznika:**
   - Kliknięcie ikony Download
   - Automatyczne pobranie pliku

4. **Edycja opisu:**
   - Kliknięcie ikony Edit
   - Modal z formularzem
   - Wprowadzenie nowego opisu
   - Zapisanie zmian

5. **Usuwanie załącznika:**
   - Kliknięcie ikony Trash
   - Potwierdzenie w dialogu
   - Usunięcie z bazy danych i dysku
   - Aktualizacja listy

---

## 🔧 Implementacja Techniczna

### Hook: useAssessmentAttachments

**Lokalizacja:** `src/hooks/useAssessmentAttachments.ts`

**API:**
```typescript
{
  uploadAttachment: (file, axisId, levelNumber, options) => Promise<Attachment>;
  getAttachments: (axisId, levelNumber, areaId?) => Promise<{attachments: Attachment[]}>;
  deleteAttachment: (attachmentId) => Promise<void>;
  getDownloadUrl: (attachmentId) => string;
  updateDescription: (attachmentId, description) => Promise<void>;
  isUploading: boolean;
  isDeleting: boolean;
  error: string | null;
}
```

### Backend Route

**Lokalizacja:** `server/src/routes/assessment/assessment-level-attachments.routes.ts`

**Funkcjonalności:**
- Multer middleware dla multipart/form-data
- Disk storage z organizacją per folder
- Auto-create schema (tabela `assessment_level_attachments`)
- Error handling i logging

### File Handling

- **Multer:** middleware do obsługi uploadów
- **Disk Storage:** przechowywanie na dysku (nie w bazie danych)
- **Unique filenames:** timestamp + random + sanitized original name
- **MIME type detection:** automatyczne wykrywanie typu pliku

---

## 📊 Przykłady Użycia

### Upload Evidence

```typescript
const { uploadAttachment } = useAssessmentAttachments({ assessmentId: '123' });

await uploadAttachment(
  file,
  '1',           // axisId
  3,             // levelNumber
  {
    areaId: '1A',
    attachmentType: 'EVIDENCE',
    description: 'Screenshot of ERP system'
  }
);
```

### Lista Załączników

```typescript
const { getAttachments } = useAssessmentAttachments({ assessmentId: '123' });

const result = await getAttachments('1', 3, '1A');
// result.attachments = [...]
```

### Pobieranie

```typescript
const { getDownloadUrl } = useAssessmentAttachments({ assessmentId: '123' });

const url = getDownloadUrl(attachmentId);
window.open(url, '_blank');
```

---

## 🚀 Przyszłe Ulepszenia

1. **Drag & Drop:**
   - Drag & drop plików bezpośrednio na komponent
   - Wizualny feedback podczas przeciągania

2. **Image Preview:**
   - Podgląd obrazów bezpośrednio w komponencie
   - Lightbox dla większych obrazów

3. **Bulk Upload:**
   - Upload wielu plików naraz
   - Progress bar dla każdego pliku

4. **Versioning:**
   - Wersjonowanie załączników
   - Historia zmian

5. **Cloud Storage:**
   - Integracja z S3/Azure Blob Storage
   - CDN dla szybkiego dostępu

6. **OCR & AI:**
   - Automatyczne wyciąganie tekstu z obrazów
   - AI-powered tagging i kategoryzacja

---

## 📚 Powiązane Dokumenty

- `00-OVERVIEW.md` - przegląd modułu Assessment
- `07-drd-editor.md` - dokumentacja edytora DRD
- `wdrozenia/standards/entities/05-ASSESSMENT-REPORT.md` - standard artefaktu
