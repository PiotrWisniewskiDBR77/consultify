# M16 — Finanse — Log wdrożenia

Wypełniany PO audycie, w trakcie realizacji planu dokończenia (Faza 8 karty).

| Data | Fala | Pozycja planu | Commit | Weryfikacja (dowód) | Status |
|---|---|---|---|---|---|
| 2026-06-12 | **FAZA 4-deep API (Fala 17)** | S1/S2/S3/S4/S5/S6 — billing bigint sweep | `a26c119d7a` | **S1 GETs PASS**: `/admin/stats` 200 (mrr/arr/invoiceCount/subscriber_count/trends = `Number()` poprawione `01e12bb0e7`+`a26c119d7a`). **S2 invoices PASS**: total bigint `Number()` OK. **S3 tax-rates PASS**: `is_active/automatic_tax/inclusive = bool`, `percentage = Number()`. **S4 credit-notes PASS**: amounts `Number()`. **BUG-M16-04b naprawiony** (`a26c119d7a`): `/admin/credit-notes/stats` — `totalCount/issuedCount/appliedCount/partiallyAppliedCount/refundedCount/voidedCount/totalValue/totalApplied/totalRefunded/totalRemaining/thisMonth.count/thisMonth.value` — wszystkie COUNT/SUM z PG bigint string → `Number()`. **BUG-M16-05** (schema): `billing_webhook_events` — tabela brakuje, migracja oddzielna (task_ddd92117). tsc zielony. | ZROBIONE (API-deep, bigint sweep domknięty) |
