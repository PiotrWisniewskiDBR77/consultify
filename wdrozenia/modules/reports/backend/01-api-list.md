# Reports Module – API List

## Status: ✅ ZAIMPLEMENTOWANY (MVP+)

---

## 📋 Przegląd

Kompletna lista endpointów API dla modułu Report Builder.

**Base path:** `/api/report-builder`

---

## 🔌 Endpoints

### Invocation Profiles

| Method | Endpoint                               | Opis                                  | Auth |
| ------ | -------------------------------------- | ------------------------------------- | ---- |
| `GET`  | `/profiles`                            | List dostępnych profili invokacji     | ✅   |
| `GET`  | `/profiles/:profileId`                 | Szczegóły profilu invokacji           | ✅   |
| `GET`  | `/profiles/for-source/:sourceType`     | Profile dostępne dla danego sourceType| ✅   |

### Report CRUD

| Method   | Endpoint         | Opis                        | Auth |
| -------- | ---------------- | --------------------------- | ---- |
| `POST`   | `/`              | Create new report           | ✅   |
| `GET`    | `/`              | List reports (with filters) | ✅   |
| `GET`    | `/:id`           | Get report details          | ✅   |
| `PUT`    | `/:id`           | Update report metadata      | ✅   |
| `DELETE` | `/:id`           | Delete report               | ✅   |
| `POST`   | `/:id/duplicate` | Duplicate report            | ✅   |

### Source Discovery

| Method | Endpoint                  | Opis                        | Auth |
| ------ | ------------------------- | --------------------------- | ---- |
| `GET`  | `/sources/assessment`     | List approved assessments   | ✅   |
| `GET`  | `/sources/assessment/:id` | Get assessment source data  | ✅   |
| `GET`  | `/sources/interview`      | (TODO) List completed interviews   | ✅   |
| `GET`  | `/sources/interview/:id`  | (TODO) Get interview source data   | ✅   |
| `GET`  | `/sources/tool`           | (TODO) List approved tool sessions | ✅   |
| `GET`  | `/sources/tool/:id`       | (TODO) Get tool source data        | ✅   |

### Templates

| Method   | Endpoint                         | Opis                                       | Auth |
| -------- | -------------------------------- | ------------------------------------------ | ---- |
| `GET`    | `/templates`                     | List templates (system + org + public)     | ✅   |
| `POST`   | `/templates`                     | Create template                            | ✅   |
| `GET`    | `/templates/:templateId/details` | Get template details (incl. parsed sections)| ✅  |
| `PUT`    | `/templates/:templateId`         | Update template (non-system, org only)     | ✅   |
| `DELETE` | `/templates/:templateId`         | Delete template (non-system, org only)     | ✅   |
| `POST`   | `/templates/:templateId/duplicate` | Duplicate template                         | ✅   |
| `POST`   | `/templates/import`              | Import template JSON                       | ✅   |
| `GET`    | `/templates/:templateId/export`  | Export template JSON                       | ✅   |
| `GET`    | `/templates/:sourceType`         | Get default template for sourceType (+ optional `?framework=`) | ✅ |

### Block Types (Library)

| Method   | Endpoint                      | Opis                               | Auth |
| -------- | ----------------------------- | ---------------------------------- | ---- |
| `GET`    | `/block-types`                | List block types (system + org)    | ✅   |
| `POST`   | `/block-types`                | Create org block type              | ✅   |
| `PUT`    | `/block-types/:blockTypeId`   | Update org block type              | ✅   |
| `DELETE` | `/block-types/:blockTypeId`   | Deactivate org block type (soft)   | ✅   |

### Section Configuration

| Method   | Endpoint                           | Opis                         | Auth |
| -------- | ---------------------------------- | ---------------------------- | ---- |
| `PUT`    | `/:id/config`                      | Update section configuration | ✅   |
| `POST`   | `/:id/sections`                    | Add custom section           | ✅   |
| `DELETE` | `/:id/sections/:sectionId`         | Remove custom section        | ✅   |
| `PUT`    | `/:id/sections/:sectionId/content` | Update section content       | ✅   |

### Generation

| Method | Endpoint                            | Opis                      | Auth |
| ------ | ----------------------------------- | ------------------------- | ---- |
| `POST` | `/:id/generate`                     | Generate all sections     | ✅   |
| `POST` | `/:id/generate-section/:sectionKey` | Regenerate single section | ✅   |

### Workflow

| Method | Endpoint        | Opis                                    | Auth       |
| ------ | --------------- | --------------------------------------- | ---------- |
| `POST` | `/:id/finalize` | Finalize report (GENERATED → IN_REVIEW) | ✅         |
| `POST` | `/:id/approve`  | Approve report                          | ✅ Manager |
| `POST` | `/:id/send-back`| Send report back (IN_REVIEW → GENERATED)| ✅         |
| `POST` | `/:id/reject`   | (TODO) Reject with comments             | ✅ Manager |
| `POST` | `/:id/utilize`  | (TODO) Mark as utilized                 | ✅         |

### Export

| Method | Endpoint            | Opis                         | Auth |
| ------ | ------------------- | ---------------------------- | ---- |
| `GET`  | `/:id/export/pdf`   | Generate + download PDF      | ✅   |
| `GET`  | `/:id/export/pptx`  | Generate + download PPTX     | ✅   |
| `GET`  | `/:id/export/doc`   | Generate + download Word (.doc) | ✅ |
| `GET`  | `/:id/exports`      | List export records          | ✅   |

**Uwagi (Word):**
- Endpoint `/:id/export/doc` zwraca plik **`.doc` (HTML)** z nagłówkiem `Content-Type: application/msword`.
- To jest „Word-compatible” eksport na dziś (łatwy i stabilny). Jeśli potrzebujemy „prawdziwego” `DOCX`, dodamy osobny format `docx` w przyszłości.

### Public Share Links

| Method   | Endpoint                 | Opis                         | Auth |
| -------- | ------------------------ | ---------------------------- | ---- |
| `POST`   | `/:id/share`             | Create share link            | ✅   |
| `GET`    | `/:id/share`             | List share links             | ✅   |
| `DELETE` | `/:id/share/:linkId`     | Revoke share link            | ✅   |

### Version History

| Method | Endpoint                                      | Opis              | Auth |
| ------ | --------------------------------------------- | ----------------- | ---- |
| `GET`  | `/:id/versions`                               | List versions     | ✅   |
| `POST` | `/:id/versions`                               | Create snapshot   | ✅   |
| `GET`  | `/versions/:versionId`                        | Get version       | ✅   |
| `GET`  | `/versions/:versionId1/compare/:versionId2`   | Compare versions  | ✅   |
| `POST` | `/versions/:versionId/rollback`               | Rollback          | ✅   |

### Public Access (no auth)

To jest osobny router:

- `GET /api/public/report/:token`
- `GET /api/public/report/:token/pdf`
- `POST /api/public/report/:token/verify-password`

### Activity & Comments

| Method   | Endpoint                           | Opis             | Auth |
| -------- | ---------------------------------- | ---------------- | ---- |
| `GET`    | `/:id/activity`                    | Get activity log | ✅   |
| `GET`    | `/:id/comments`                    | Get comments     | ✅   |
| `POST`   | `/:id/comments`                    | Add comment      | ✅   |
| `PUT`    | `/:id/comments/:commentId`         | Update comment   | ✅   |
| `DELETE` | `/:id/comments/:commentId`         | Delete comment   | ✅   |
| `POST`   | `/:id/comments/:commentId/resolve` | Resolve comment  | ✅   |

---

## 📝 Request/Response Examples

### POST `/` - Create Report

**Request:**

```json
{
  "sourceType": "ASSESSMENT",
  "sourceId": "assess-123",
  "title": "DRD Assessment Report Q1 2026",
  "description": "Digital maturity assessment for Company XYZ",
  "templateId": "template-assessment-standard"
}
```

**Response:**

```json
{
  "success": true,
  "report": {
    "id": "report-456",
    "organizationId": "org-789",
    "sourceType": "ASSESSMENT",
    "sourceId": "assess-123",
    "sourceName": "DRD Assessment - Company XYZ",
    "sourceFramework": "DRD",
    "title": "DRD Assessment Report Q1 2026",
    "description": "Digital maturity assessment for Company XYZ",
    "reportType": "ASSESSMENT_DRD",
    "status": "DRAFT",
    "createdBy": "user-abc",
    "createdAt": "2026-01-31T10:00:00Z",
    "version": 1
  },
  "sections": [
    {
      "id": "section-1",
      "sectionKey": "cover",
      "sectionType": "cover",
      "title": "Cover Page",
      "orderIndex": 0,
      "enabled": true,
      "required": true,
      "length": "short",
      "language": "business"
    },
    {
      "id": "section-2",
      "sectionKey": "executive_summary",
      "sectionType": "summary",
      "title": "Executive Summary",
      "orderIndex": 1,
      "enabled": true,
      "required": true,
      "length": "medium",
      "language": "business"
    }
    // ... more sections
  ]
}
```

---

### GET `/` - List Reports

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |
| `status` | string | - | Filter by status |
| `sourceType` | string | - | Filter by source type |
| `search` | string | - | Search in title |
| `sortBy` | string | `createdAt` | Sort field |
| `sortOrder` | string | `desc` | Sort order |

**Response:**

```json
{
  "reports": [
    {
      "id": "report-456",
      "title": "DRD Assessment Report Q1 2026",
      "status": "APPROVED",
      "sourceType": "ASSESSMENT",
      "sourceFramework": "DRD",
      "createdAt": "2026-01-31T10:00:00Z",
      "createdByName": "John Doe",
      "approvedAt": "2026-01-31T15:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

---

### PUT `/:id/config` - Update Section Config

**Request:**

```json
{
  "sections": [
    {
      "sectionKey": "executive_summary",
      "length": "long",
      "language": "business",
      "customPrompt": "Focus on ROI and quick wins"
    },
    {
      "sectionKey": "axis_1",
      "enabled": true,
      "orderIndex": 5
    },
    {
      "sectionKey": "appendix",
      "enabled": false
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "sections": [
    // Updated sections
  ]
}
```

---

### POST `/:id/generate` - Generate Report

**Request:**

```json
{
  "regenerateSections": [] // Empty = generate all, or specify section keys
}
```

**Response:**

```json
{
  "success": true,
  "jobId": "job-789",
  "status": "in_progress",
  "message": "Generation started. Poll /generate/status for progress."
}
```

---

### GET `/:id/generate/status` - Generation Progress

**Response:**

```json
{
  "reportId": "report-456",
  "status": "in_progress",
  "progress": 45,
  "currentSection": "axis_2",
  "completedSections": ["cover", "executive_summary", "methodology", "maturity_matrix", "axis_1"],
  "totalSections": 12,
  "estimatedTimeRemaining": 60,
  "tokensUsed": 3500
}
```

---

### POST `/:id/export/pdf` - Export to PDF

**Request:**

```json
{
  "options": {
    "template": "professional",
    "includeComments": false,
    "headerFooter": true,
    "pageNumbers": true
  }
}
```

**Response:**

```json
{
  "success": true,
  "jobId": "export-job-123",
  "status": "processing",
  "message": "PDF generation started. Poll /export/pdf/status for progress."
}
```

---

### GET `/:id/export/pdf/download` - Download PDF

**Response:**

- Content-Type: `application/pdf`
- Content-Disposition: `attachment; filename="report-456.pdf"`
- Body: Binary PDF data

---

### GET `/sessions` - Get Open Sessions

**Response:**

```json
{
  "sessions": [
    {
      "id": "session-1",
      "reportId": "report-456",
      "reportTitle": "DRD Assessment Report Q1 2026",
      "reportStatus": "GENERATED",
      "sourceType": "ASSESSMENT",
      "sourceFramework": "DRD",
      "openedAt": "2026-01-31T09:00:00Z",
      "lastActivityAt": "2026-01-31T10:30:00Z"
    }
  ],
  "maxSessions": 6
}
```

---

## 🔒 Authorization

### Permission Matrix

| Endpoint           | User | Editor | Manager | Admin |
| ------------------ | ---- | ------ | ------- | ----- |
| Create report      | ✅   | ✅     | ✅      | ✅    |
| View own reports   | ✅   | ✅     | ✅      | ✅    |
| View all reports   | ❌   | ❌     | ✅      | ✅    |
| Edit own reports   | ✅   | ✅     | ✅      | ✅    |
| Edit all reports   | ❌   | ❌     | ✅      | ✅    |
| Delete own reports | ✅   | ✅     | ✅      | ✅    |
| Delete all reports | ❌   | ❌     | ❌      | ✅    |
| Approve reports    | ❌   | ❌     | ✅      | ✅    |
| Manage templates   | ❌   | ❌     | ❌      | ✅    |

---

## ⚠️ Error Responses

### Standard Error Format

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    // Additional error details
  }
}
```

### Error Codes

| Code                        | HTTP Status | Description                       |
| --------------------------- | ----------- | --------------------------------- |
| `REPORT_NOT_FOUND`          | 404         | Report does not exist             |
| `SOURCE_NOT_FOUND`          | 404         | Source does not exist             |
| `SOURCE_NOT_APPROVED`       | 400         | Source is not approved yet        |
| `INVALID_STATUS_TRANSITION` | 400         | Invalid workflow transition       |
| `GENERATION_IN_PROGRESS`    | 409         | Report is already being generated |
| `UNAUTHORIZED`              | 401         | Not authenticated                 |
| `FORBIDDEN`                 | 403         | Not authorized for this action    |
| `TEMPLATE_NOT_FOUND`        | 404         | Template does not exist           |
| `EXPORT_FAILED`             | 500         | Export generation failed          |

---

## 📚 Referencje

- `00-OVERVIEW.md` - Przegląd modułu
- `02-api-detail.md` - Szczegółowa dokumentacja API
- `03-generation-service.md` - Serwis generowania
- `04-export-service.md` - Serwis eksportu
