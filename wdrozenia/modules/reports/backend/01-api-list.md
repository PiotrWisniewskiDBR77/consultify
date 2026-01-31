# Reports Module – API List

## Status: 🔨 W PLANOWANIU

---

## 📋 Przegląd

Kompletna lista endpointów API dla modułu Report Builder.

**Base path:** `/api/report-builder`

---

## 🔌 Endpoints

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
| `GET`  | `/sources/interview`      | List completed interviews   | ✅   |
| `GET`  | `/sources/interview/:id`  | Get interview source data   | ✅   |
| `GET`  | `/sources/tool`           | List approved tool sessions | ✅   |
| `GET`  | `/sources/tool/:id`       | Get tool source data        | ✅   |

### Templates

| Method   | Endpoint           | Opis                                 | Auth     |
| -------- | ------------------ | ------------------------------------ | -------- |
| `GET`    | `/templates`       | List all templates                   | ✅       |
| `GET`    | `/templates/:type` | Get default template for source type | ✅       |
| `POST`   | `/templates`       | Create custom template               | ✅ Admin |
| `PUT`    | `/templates/:id`   | Update template                      | ✅ Admin |
| `DELETE` | `/templates/:id`   | Delete template                      | ✅ Admin |

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
| `GET`  | `/:id/generate/status`              | Get generation progress   | ✅   |
| `POST` | `/:id/generate-section/:sectionKey` | Regenerate single section | ✅   |

### Workflow

| Method | Endpoint        | Opis                                    | Auth       |
| ------ | --------------- | --------------------------------------- | ---------- |
| `POST` | `/:id/finalize` | Finalize report (GENERATED → IN_REVIEW) | ✅         |
| `POST` | `/:id/submit`   | Submit for review                       | ✅         |
| `POST` | `/:id/approve`  | Approve report                          | ✅ Manager |
| `POST` | `/:id/reject`   | Reject with comments                    | ✅ Manager |
| `POST` | `/:id/utilize`  | Mark as utilized                        | ✅         |

### Export

| Method | Endpoint                       | Opis                   | Auth |
| ------ | ------------------------------ | ---------------------- | ---- |
| `POST` | `/:id/export/pdf`              | Generate PDF           | ✅   |
| `POST` | `/:id/export/pptx`             | Generate PPTX          | ✅   |
| `GET`  | `/:id/export/:format/download` | Download exported file | ✅   |
| `GET`  | `/:id/export/:format/status`   | Check export status    | ✅   |

### Sessions (Dynamic Menu)

| Method | Endpoint             | Opis                     | Auth |
| ------ | -------------------- | ------------------------ | ---- |
| `GET`  | `/sessions`          | Get open reports (max 6) | ✅   |
| `POST` | `/:id/session/open`  | Open report in menu      | ✅   |
| `POST` | `/:id/session/close` | Close report from menu   | ✅   |

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
