# Implementation Module API Reference

## Overview

The Implementation Module (Module 4 - Wdrożenie) provides comprehensive PMO functionality for executing and tracking initiatives. This document covers all API endpoints for Budget Management, Status Reports, and related features.

## PMO Standards Compliance

All endpoints comply with:
- **ISO 21500:2021** - Cost Management, Progress Reporting
- **PMI PMBOK 7th Edition** - Cost Performance Domain, Measurement Performance Domain
- **PRINCE2** - Business Case, Highlight Report

---

## Budget Management API

Base URL: `/api/budget`

### Get Budget for Initiative

```
GET /api/budget/initiative/:initiativeId
```

Returns budget data for a specific initiative including line items, transactions, and calculated totals.

**Response:**
```json
{
  "budget": {
    "id": "string",
    "initiativeId": "string",
    "initiativeName": "string",
    "budgetType": "COMBINED | CAPEX | OPEX",
    "plannedAmount": 100000,
    "currency": "PLN",
    "lineItems": [...],
    "transactions": [...],
    "totals": {
      "totalPlanned": 100000,
      "totalActual": 50000,
      "remaining": 50000,
      "consumedPercent": 50,
      "status": "ON_TRACK | WARNING | CRITICAL | OVERRUN"
    }
  }
}
```

### Create Budget

```
POST /api/budget/initiative/:initiativeId
```

**Request Body:**
```json
{
  "plannedAmount": 100000,
  "budgetType": "COMBINED",
  "contingencyPercent": 10,
  "currency": "PLN"
}
```

### Add Transaction

```
POST /api/budget/:budgetId/transactions
```

**Request Body:**
```json
{
  "amount": 5000,
  "transactionType": "EXPENSE",
  "description": "Software license",
  "vendor": "Microsoft",
  "transactionDate": "2024-12-28"
}
```

### Get Budget Summary

```
GET /api/budget/:budgetId/summary
```

Returns totals, burn rate, forecast, and alerts.

### Get Burn Rate

```
GET /api/budget/:budgetId/burn-rate
```

**Response:**
```json
{
  "burnRate": {
    "monthlyBurnRate": 15000,
    "averageMonthly": 12000,
    "trend": "STABLE | INCREASING | DECREASING"
  }
}
```

### Get Forecast

```
GET /api/budget/:budgetId/forecast
```

**Response:**
```json
{
  "forecast": {
    "estimateToComplete": 50000,
    "estimateAtCompletion": 105000,
    "varianceAtCompletion": 5000,
    "costPerformanceIndex": 0.95,
    "isProjectedOverrun": true,
    "recommendation": "REVIEW_SPENDING | MONITOR_CLOSELY | ON_TRACK"
  }
}
```

### Portfolio Summary

```
GET /api/budget/portfolio/summary
```

Aggregated budget data across all initiatives.

---

## Status Reports API

Base URL: `/api/status-reports`

### Generate Report

```
POST /api/status-reports/initiative/:initiativeId/generate
```

**Request Body:**
```json
{
  "periodType": "WEEKLY | MONTHLY | QUARTERLY"
}
```

**Response:**
```json
{
  "report": {
    "id": "string",
    "initiativeId": "string",
    "periodLabel": "Week 52, 2024",
    "overallStatus": "GREEN | AMBER | RED",
    "sections": {
      "SCHEDULE": { "status": "GREEN", "content": "..." },
      "BUDGET": { "status": "AMBER", "content": "..." }
    },
    "accomplishments": [...],
    "nextSteps": [...],
    "escalations": [...]
  }
}
```

### List Reports

```
GET /api/status-reports/initiative/:initiativeId
```

### Get Single Report

```
GET /api/status-reports/:reportId
```

### Approve Report

```
POST /api/status-reports/:reportId/approve
```

### Publish Report

```
POST /api/status-reports/:reportId/publish
```

### Distribute Report

```
POST /api/status-reports/:reportId/distribute
```

**Request Body:**
```json
{
  "recipients": [
    {
      "recipientEmail": "stakeholder@company.com",
      "recipientType": "STAKEHOLDER"
    }
  ]
}
```

### Export Report

```
GET /api/status-reports/:reportId/export/:format
```

Formats: `pdf`, `pptx`

---

## Data Models

### Budget Status

| Status | Description | Threshold |
|--------|-------------|-----------|
| ON_TRACK | Budget healthy | < 80% consumed |
| WARNING | Approaching limit | 80-95% consumed |
| CRITICAL | Near limit | 95-100% consumed |
| OVERRUN | Over budget | > 100% consumed |

### RAG Status (Reports)

| Status | Description |
|--------|-------------|
| GREEN | On track |
| AMBER | At risk |
| RED | Off track |

### Budget Categories

- PERSONNEL
- TECHNOLOGY
- CONSULTING
- TRAINING
- INFRASTRUCTURE
- SOFTWARE
- HARDWARE
- TRAVEL
- OTHER

### Report Sections

- SCHEDULE
- BUDGET
- SCOPE
- QUALITY
- RISKS
- RESOURCES

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common HTTP Status Codes:
- 200: Success
- 201: Created
- 400: Bad Request
- 404: Not Found
- 500: Internal Server Error

---

## Rate Limits

- Standard endpoints: 100 requests/minute
- Report generation: 10 requests/minute
- Export: 20 requests/minute

