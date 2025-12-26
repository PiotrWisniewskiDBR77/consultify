# Assessment Module API Documentation

## Overview
The Assessment Module API provides endpoints for managing multi-framework assessments including RapidLean, External Digital (SIRI/ADMA/CMMI), and Generic Reports.

**Base URL:** `/api`  
**Authentication:** Required (Bearer token)  
**Rate Limit:** 100 requests/15 minutes

---

## Endpoints

### RapidLean Assessments

#### Create RapidLean Assessment
```http
POST /rapidlean
```

**Request Body:**
```json
{
  "projectId": "uuid",
  "responses": {
    "value_stream_1": 4,
    "value_stream_2": 3,
    ...
  }
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "overall_score": 3.5,
  "value_stream_score": 3.7,
  "top_gaps": ["continuous_improvement", "waste_elimination"]
}
```

#### Get RapidLean Assessment
```http
GET /rapidlean/:id
```

**Response (200):**
```json
{
  "id": "uuid",
  "organization_id": "uuid",
  "overall_score": 3.5,
  "dimensions": {...},
  "ai_recommendations": [...],
  "created_at": "2024-01-15T10:00:00Z"
}
```

#### Get Benchmark Comparison
```http
GET /rapidlean/:id/benchmark?industry=MANUFACTURING
```

**Response (200):**
```json
{
  "yourScore": 3.5,
  "industryAverage": 3.8,
  "percentile": 45,
  "gap": -0.3
}
```

#### Save Production Floor Observations
```http
POST /rapidlean/observations
Content-Type: multipart/form-data
```

**Form Data:**
- `projectId`: uuid (optional)
- `observations`: JSON string (array of observation objects)
- `photos`: File[] (multiple image files, max 10 files, 5MB each)

**Observation Object Structure:**
```json
{
  "templateId": "value_stream_template",
  "location": "Production Line A",
  "timestamp": "2024-01-15T10:00:00Z",
  "answers": {
    "vs_1": true,
    "vs_2": false,
    "vs_3": 45.5,
    "vs_4": true,
    "vs_6": "Observed delays at station 3"
  },
  "photos": ["photo_url_1", "photo_url_2"],
  "notes": "Additional observations..."
}
```

**Response (201):**
```json
{
  "assessment": {
    "id": "uuid",
    "overall_score": 3.5,
    "value_stream_score": 3.7,
    "observation_count": 6
  },
  "report": {
    "id": "uuid",
    "summary": {...},
    "observations": [...],
    "drdMapping": {
      "processes": 4.2,
      "culture": 3.8
    }
  },
  "pdfUrl": "/uploads/organizations/{orgId}/rapidlean/reports/report.pdf",
  "message": "Observations saved and report generated successfully"
}
```

#### Get Observations for Assessment
```http
GET /rapidlean/observations/:assessmentId
```

**Response (200):**
```json
{
  "observations": [
    {
      "id": "uuid",
      "templateId": "value_stream_template",
      "location": "Production Line A",
      "timestamp": "2024-01-15T10:00:00Z",
      "answers": {...},
      "photos": ["url1", "url2"],
      "notes": "..."
    }
  ]
}
```

#### Generate Report
```http
POST /rapidlean/:id/report
```

**Request Body:**
```json
{
  "format": "pdf",
  "template": "detailed",
  "includeCharts": true,
  "compareWithPrevious": true
}
```

**Response (200):**
```json
{
  "reportId": "uuid",
  "fileUrl": "/uploads/organizations/{orgId}/rapidlean/reports/report.pdf",
  "reportData": {
    "summary": {...},
    "dimensions": [...],
    "observations": [...],
    "drdMapping": {...},
    "recommendations": [...]
  }
}
```

#### Get Observation Templates
```http
GET /rapidlean/templates
```

**Response (200):**
```json
{
  "templates": [
    {
      "id": "value_stream_template",
      "dimension": "value_stream",
      "drdAxis": "processes",
      "drdArea": "1A",
      "name": "Value Stream Observation",
      "description": "...",
      "checklist": [...],
      "photoRequired": true,
      "notesRequired": true,
      "estimatedTime": 15
    }
  ]
}
```

#### Get DRD Mapping with Observations
```http
GET /rapidlean/:id/drd-mapping
```

**Response (200):**
```json
{
  "drdMapping": {
    "processes": 4.2,
    "culture": 3.8
  },
  "gaps": {
    "processes": {
      "current": 4.2,
      "target": 7,
      "gap": 2.8,
      "priority": "HIGH"
    }
  },
  "pathways": {
    "processes": {
      "current": 4.2,
      "target": 7,
      "steps": [...],
      "estimatedTime": 9
    }
  },
  "observationsCount": 6
}
```

---

### External Digital Assessments

#### Upload External Assessment
```http
POST /external-assessments
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: PDF file (max 10MB)
- `frameworkType`: SIRI | ADMA | CMMI | DIGITAL_OTHER
- `frameworkVersion`: string (optional)
- `assessmentDate`: ISO date (optional)
- `projectId`: uuid (optional)

**Response (201):**
```json
{
  "id": "uuid",
  "processing_status": "uploaded",
  "message": "Assessment uploaded. Processing in background..."
}
```

#### Get External Assessment
```http
GET /external-assessments/:id
```

**Response (200):**
```json
{
  "id": "uuid",
  "framework_type": "SIRI",
  "processing_status": "mapped",
  "mapping_confidence": 0.89,
  "drd_axis_mapping": {
    "processes": 4.2,
    "dataManagement": 3.8
  },
  "raw_scores_json": {...},
  "normalized_scores_json": {...}
}
```

#### List External Assessments
```http
GET /external-assessments/organization/:orgId?framework=SIRI
```

**Response (200):**
```json
{
  "assessments": [
    {
      "id": "uuid",
      "framework_type": "SIRI",
      "processing_status": "mapped",
      "uploaded_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 5
}
```

---

### Generic Reports

#### Upload Generic Report
```http
POST /generic-reports
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: PDF/Word/Excel (max 10MB)
- `reportType`: ISO_AUDIT | CONSULTING | COMPLIANCE | LEAN | OTHER
- `title`: string (optional)
- `consultantName`: string (optional)
- `reportDate`: ISO date (optional)
- `tags`: string (optional)

**Response (201):**
```json
{
  "id": "uuid",
  "title": "ISO 9001 Audit Report",
  "processing_status": "uploaded"
}
```

#### Search Reports
```http
GET /generic-reports/organization/:orgId?search=ISO&type=ISO_AUDIT
```

**Query Parameters:**
- `search`: Full-text search term
- `type`: Report type filter
- `limit`: Number of results (default 50)
- `offset`: Pagination offset

**Response (200):**
```json
{
  "reports": [
    {
      "id": "uuid",
      "title": "ISO 9001 Audit Report",
      "report_type": "ISO_AUDIT",
      "ai_summary": "...",
      "tags_json": ["ISO", "Quality"],
      "uploaded_at": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 23
}
```

#### Delete Report
```http
DELETE /generic-reports/:id
```

**Response (204):** No content

---

### Assessment Overview

#### Get Assessment Overview
```http
GET /sessions/:projectId/assessment-overview
```

**Response (200):**
```json
{
  "consolidated": {
    "totalAssessments": 3,
    "completedModules": 4,
    "overallReadiness": 3.8,
    "strongestAreas": ["digitalProducts", "cybersecurity"],
    "weakestAreas": ["culture", "dataManagement"]
  },
  "drd": {
    "exists": true,
    "overallScore": 4.1,
    "gap": 1.2
  },
  "rapidLean": {
    "exists": true,
    "overallScore": 3.5,
    "benchmark": 3.8
  },
  "externalDigital": {
    "exists": true,
    "totalCount": 2,
    "frameworks": ["SIRI", "ADMA"]
  },
  "genericReports": {
    "exists": true,
    "totalCount": 5
  }
}
```

---

### Initiative Generation

#### Generate Initiatives from Assessments
```http
POST /initiatives/generate-from-assessments
```

**Request Body:**
```json
{
  "projectId": "uuid",
  "drdAssessmentId": "uuid",
  "leanAssessmentId": "uuid",
  "externalAssessmentIds": ["uuid1", "uuid2"]
}
```

**Response (200):**
```json
{
  "initiatives": [
    {
      "name": "Master Data Management Platform",
      "priority": "High",
      "gap_justification": "Addresses gaps in data management across DRD (4.5), Lean (3.0), and SIRI (2.8)",
      "derived_from_assessments": [
        {"source": "DRD", "dimension": "dataManagement", "gap": 4.5},
        {"source": "LEAN", "dimension": "waste_elimination", "gap": 3.0}
      ]
    }
  ],
  "count": 5,
  "savedIds": ["uuid1", "uuid2", "uuid3"]
}
```

#### Get Single Initiative
```http
GET /initiatives/:id
```

**Response (200):**
```json
{
  "id": "uuid",
  "name": "Master Data Management Platform",
  "axis": "dataManagement",
  "area": "3A",
  "summary": "...",
  "description": "...",
  "status": "APPROVED",
  "progress": 45,
  "businessValue": "HIGH",
  "costCapex": 50000,
  "costOpex": 15000,
  "expectedRoi": 2.5,
  "plannedStartDate": "2025-01-15",
  "plannedEndDate": "2025-06-30",
  "ownerBusiness": {
    "id": "uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  },
  "ownerExecution": {
    "id": "uuid",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com"
  },
  "sourceAssessmentId": "uuid",
  "assessmentName": "DRD Assessment Q4 2024",
  "taskCount": 12,
  "createdAt": "2024-12-15T10:00:00Z",
  "updatedAt": "2024-12-20T14:30:00Z"
}
```

#### Transfer Initiative to Roadmap
```http
POST /initiatives/:id/transfer-to-roadmap
```

**Request Body:**
```json
{
  "plannedStartDate": "2025-01-15",
  "plannedEndDate": "2025-06-30",
  "roadmapId": "uuid",
  "quarter": "Q1 2025"
}
```

**Response (200):**
```json
{
  "message": "Initiative transferred to roadmap successfully",
  "initiativeId": "uuid"
}
```

---

### Assessment Reviews (SLA Tracking)

#### Get Pending Reviews
```http
GET /assessment-workflow/pending-reviews
```

**Response (200):**
```json
{
  "reviews": [
    {
      "id": "uuid",
      "assessmentId": "uuid",
      "assessmentName": "DRD Assessment Q4",
      "projectName": "Digital Transformation",
      "status": "PENDING",
      "requestedAt": "2024-12-20T10:00:00Z",
      "dueDate": "2024-12-22T10:00:00Z",
      "isOverdue": false,
      "hoursRemaining": 36
    }
  ]
}
```

**Note:** Reviews have a default SLA of 48 hours. The `isOverdue` flag and `hoursRemaining` fields help track SLA compliance.

---

### Stage Gates

#### Check Stage Gate Status
```http
GET /stage-gates/:projectId/check?from=Assessment&to=Reports
```

**Response (200):**
```json
{
  "status": "READY",
  "completionCriteria": [
    {
      "id": "1",
      "criterion": "Assessment w statusie APPROVED",
      "isMet": true,
      "evidence": "Status sprawdzony"
    },
    {
      "id": "2",
      "criterion": "Wszystkie osie ocenione (7/7)",
      "isMet": true,
      "evidence": "Postęp 100%"
    }
  ],
  "missingElements": []
}
```

#### Pass Stage Gate
```http
POST /stage-gates/:projectId/pass
```

**Request Body:**
```json
{
  "from": "Assessment",
  "to": "Reports"
}
```

**Response (200):**
```json
{
  "message": "Gate passed successfully",
  "nextPhase": "Reports"
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 413 | Payload Too Large - File exceeds 10MB |
| 415 | Unsupported Media Type - Invalid file type |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Rate Limiting

All endpoints are rate-limited:
- **API routes:** 100 requests per 15 minutes
- **File uploads:** 10 uploads per hour

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642257600
```

---

## Pagination

List endpoints support pagination:
```http
GET /generic-reports/organization/:orgId?limit=20&offset=40
```

Response includes:
```json
{
  "results": [...],
  "total": 123,
  "limit": 20,
  "offset": 40
}
```

---

## File Upload Restrictions

**Supported Formats:**
- PDFs: `.pdf`
- Word: `.docx`, `.doc`
- Excel: `.xlsx`, `.xls`

**Max Size:** 10MB  
**Validation:** File type checked by MIME type and extension
