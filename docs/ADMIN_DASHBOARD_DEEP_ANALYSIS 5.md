# Admin Dashboard - Deep Analysis Report

**Data:** 2025-01-27  
**Moduł:** Admin > Overview > Dashboard

---

## 1. Przegląd Funkcjonalności

Dashboard wyświetla:

- **Total Users** - liczba użytkowników (z props)
- **Active Projects** - aktywne projekty (z props)
- **Pending Invites** - oczekujące zaproszenia (z props)
- **Est. Revenue** - szacowane przychody
- **Quick Actions** - szybkie akcje
- **Recent Activity** - ostatnia aktywność
- **System Health** - stan systemu
- **Upcoming Events** - nadchodzące wydarzenia

---

## 2. Analiza Endpointów

### ✅ Endpointy podłączone do bazy danych:

| Endpoint                                       | Tabela                                  | Status     |
| ---------------------------------------------- | --------------------------------------- | ---------- |
| `/api/admin-data/recent-activity/:orgId`       | `audit_events`, `users`                 | ✅ Real DB |
| `/api/admin-data/scheduled-events/:orgId`      | `scheduled_events`, `projects`, `users` | ✅ Real DB |
| POST `/api/admin-data/scheduled-events/:orgId` | `scheduled_events`                      | ✅ Real DB |

### ⚠️ Endpointy z częściowymi mockami:

| Endpoint                        | Problem                                                  | Status          |
| ------------------------------- | -------------------------------------------------------- | --------------- |
| `/api/admin-data/system-health` | `uptime` zawsze "99.9%", AI Services/Storage zawsze "up" | ⚠️ Partial Mock |

---

## 3. ❌ PROBLEMY DO NAPRAWY

### Problem 1: Est. Revenue jest hardcoded

**Lokalizacja:** `src/views/admin/AdminDashboard.tsx` linia 280

```typescript
// ❌ PROBLEM: Hardcoded value
<p className="admin-metric-value">$0.00</p>
<p className="admin-metric-subtitle">this month</p>
```

**Rozwiązanie:** Podłączyć do API billing lub usunąć jeśli nie jest potrzebne.

---

### Problem 2: Quick Actions mają puste handlery

**Lokalizacja:** `src/views/admin/AdminDashboard.tsx` linie 185-190

```typescript
// ❌ PROBLEM: Empty actions
const quickActions = [
  { icon: UserPlus, label: 'Invite User', action: () => {} }, // ← puste!
  { icon: Plus, label: 'New Project', action: () => {} }, // ← puste!
  { icon: FileText, label: 'View Reports', action: () => {} }, // ← puste!
  { icon: Settings, label: 'Settings', action: () => {} }, // ← puste!
];
```

**Rozwiązanie:** Dodać nawigację do odpowiednich widoków.

---

### Problem 3: Dziwna kalkulacja growth

**Lokalizacja:** `src/views/admin/AdminDashboard.tsx` linie 93-94

```typescript
// ❌ PROBLEM: Arbitralne odejmowanie 88 i 95
const userGrowth = users.length > 0 ? Math.round((activeUsers / users.length) * 100) - 88 : 0;
const projectGrowth =
  projects.length > 0 ? Math.round((activeProjects / projects.length) * 100) - 95 : 0;
```

**Rozwiązanie:** Pobierać rzeczywiste dane o wzroście z API porównującego okresy.

---

### Problem 4: System Health - częściowe mocki

**Lokalizacja:** `server/src/routes/admin-data.routes.ts` linie 359-369

```typescript
// ⚠️ Tylko Database jest sprawdzany, reszta hardcoded
const health = {
  status: dbHealthy ? 'healthy' : 'degraded',
  uptime: '99.9%', // ← zawsze to samo
  lastCheck: 'Just now',
  services: [
    { name: 'API', status: 'up' }, // ← zawsze up
    { name: 'Database', status: dbHealthy ? 'up' : 'down' }, // ✅ sprawdzane
    { name: 'AI Services', status: 'up' }, // ← zawsze up
    { name: 'Storage', status: 'up' }, // ← zawsze up
  ],
};
```

**Rozwiązanie:** Dodać prawdziwe health checks dla każdego serwisu.

---

## 4. Połączenia z SuperAdmin

| Element       | Admin                             | SuperAdmin                  | Czy współdzielone? |
| ------------- | --------------------------------- | --------------------------- | ------------------ |
| System Health | `/api/admin-data/system-health`   | `/api/superadmin/dashboard` | ❌ Różne endpointy |
| Activity      | `/api/admin-data/recent-activity` | `activity` w dashboard      | ❌ Różne źródła    |
| Users count   | Props (users.length)              | `counts.total_users`        | ❌ Różne źródła    |

**Rekomendacja:** Rozważyć unifikację endpointów lub współdzielenie serwisów.

---

## 5. Połączenia z Settings

Brak bezpośrednich połączeń. Quick Action "Settings" powinien nawigować do `/settings`.

---

## 6. Plan Naprawy

### Priorytet 1 (Krytyczne):

1. [ ] Naprawić Quick Actions - dodać nawigację
2. [ ] Usunąć lub podłączyć Est. Revenue do API

### Priorytet 2 (Wysoki):

3. [ ] Naprawić kalkulację userGrowth/projectGrowth
4. [ ] Dodać prawdziwe health checks dla AI Services i Storage

### Priorytet 3 (Średni):

5. [ ] Unifikować endpointy z SuperAdmin gdzie to możliwe
6. [ ] Dodać uptime tracking (prawdziwy)

---

## 7. Status Gotowości

| Obszar         | Status | Procent |
| -------------- | ------ | ------- |
| Endpointy DB   | ✅     | 90%     |
| UI/UX          | ✅     | 95%     |
| Quick Actions  | ❌     | 0%      |
| Est. Revenue   | ❌     | 0%      |
| Growth Metrics | ⚠️     | 50%     |
| System Health  | ⚠️     | 60%     |

**Ogólny status Dashboard:** 🟡 **70%**

---

**Następne kroki:** Naprawić Quick Actions i podłączyć lub usunąć Est. Revenue.
