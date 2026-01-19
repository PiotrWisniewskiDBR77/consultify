# Production Deployment - Resource Allocation Management

**Dla:** Konrad (DevOps)  
**Czas:** ~30 min  
**Cel:** Podłączyć rzeczy które nie działają lokalnie

---

## 1. Database Migration (REQUIRED)

```bash
# Połącz się z produkcyjną bazą
psql -h $PROD_DB_HOST -U $PROD_DB_USER -d consultify

# Uruchom migrację
\i server/src/database/migrations/add_resource_tables.sql

# Sprawdź czy się udało
\dt budget_expenses
\dt user_quotas
```

**Zweryfikuj:**

- [ ] Tabele `budget_expenses` i `user_quotas` utworzone
- [ ] Kolumny w `organizations`: `monthly_budget_usd`, `budget_spent_current_period`, etc.
- [ ] Kolumny w `subscription_plans`: `memory_limit_mb`, `cpu_quota_percent`, `max_concurrent_ai_jobs`

---

## 2. Seed Subscription Plans

```sql
UPDATE subscription_plans SET memory_limit_mb = 512, cpu_quota_percent = 20, max_concurrent_ai_jobs = 2 WHERE LOWER(name) = 'free';
UPDATE subscription_plans SET memory_limit_mb = 2048, cpu_quota_percent = 50, max_concurrent_ai_jobs = 10 WHERE LOWER(name) = 'pro';
UPDATE subscription_plans SET memory_limit_mb = 8192, cpu_quota_percent = 100, max_concurrent_ai_jobs = 50 WHERE LOWER(name) = 'enterprise';

-- Sprawdź
SELECT name, memory_limit_mb, cpu_quota_percent, max_concurrent_ai_jobs FROM subscription_plans;
```

---

## 3. Deploy Backend

```bash
cd server
git pull origin main
npm ci --production
npm run build
pm2 restart consultify-api

# Sprawdź logi
pm2 logs consultify-api --lines 50
```

---

## 4. Deploy Frontend

```bash
cd /path/to/consultify
git pull origin main
npm ci
npm run build

# Wrzuć na CDN/hosting (zależnie od setupu)
# aws s3 sync dist/ s3://consultify-frontend/ --delete
# LUB
# pm2 restart consultify-frontend
```

---

## 5. Quick Smoke Test

```bash
# Test API
curl https://api.consultify.com/api/superadmin/subscription-plans -H "Authorization: Bearer $TOKEN"
# Powinno zwrócić 200 OK

# Test UI
# Otwórz: https://app.consultify.com/superadmin/subscription-plans
# Sprawdź czy tabela się ładuje
```

---

## 6. Optional - Monitoring (jeśli masz czas)

**Budget Reset Cron (1. dzień miesiąca):**

```bash
# Dodaj do crontab
crontab -e

# Wklej:
0 0 1 * * /usr/bin/node /path/to/consultify/server/scripts/cron/reset-budget-periods.js >> /var/log/budget-reset.log 2>&1
```

**Email Alerts (jeśli już mamy SendGrid):**

```bash
# Dodaj do .env.production
SENDGRID_API_KEY=twój_klucz
ALERT_EMAIL_FROM=alerts@consultify.com
```

---

## ✅ Deployment Complete Checklist

- [ ] Migracje uruchomione
- [ ] Plany zaktualizowane
- [ ] Backend zdeployowany
- [ ] Frontend zdeployowany
- [ ] Testy API przeszły
- [ ] UI działa

**Czas:** ~30 min  
**Rollback:** Jeśli coś nie działa, git checkout do poprzedniego commita i pm2 restart

---

**Pytania?** Sprawdź: `/Users/piotrwisniewski/.gemini/antigravity/brain/278efd97-9128-4d39-b8a5-227dc6cb37c0/deployment_checklist.md` (pełna wersja)
