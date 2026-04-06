# 05: Hosting i Lokalizacja Danych — DBR77 Marketplace

Gdzie fizycznie mieszkają dane? Dostawca, region, polityka kopii zapasowych i gwarantowane SLA.

---

## Architektura hostingu

### Stack technologiczny

| Komponent | Technologia |
|-----------|-------------|
| **Aplikacja** | Laravel 12 (PHP 8.2+), Vue 3, Inertia.js |
| **Baza danych** | PostgreSQL |
| **Vector DB** | Qdrant (AI matching) |
| **Cache / Queue** | Database (domyślnie) lub Redis (opcjonalnie) |
| **Web server** | Nginx lub Apache + PHP-FPM |
| **Admin panel** | Filament v3 (`/admin`) |

### Schemat architektury

```
Browser/Client
      │ HTTPS
      ▼
Nginx/Apache (SSL termination, static assets, IP ACL)
      │
      ▼
Laravel + PHP-FPM
  ├── Inertia (Vue)
  ├── Filament (/admin)
  └── API (/api/*)
      │
      ├── PostgreSQL (primary data)
      ├── Redis (optional)
      └── Qdrant (vector embeddings)
            │
            ▼
      Queue Worker (background jobs)
```

---

## Dostawca i region

### Obecna konfiguracja

- Infrastruktura w **chmurze** (szczegóły dostawcy w dokumentacji wewnętrznej)
- Możliwe opcje: **AWS**, **Azure**, **GCP** lub dostawcy europejscy (OVH, Hetzner, etc.)

### Lokalizacja danych

| Region | Obszary zastosowania |
|--------|----------------------|
| **EU (Frankfurt, Warszawa)** | Klienci UE, zgodność z GDPR, data residency |
| **USA** | Klienci amerykańscy (jeśli oferowane) |
| **Inne** | W zależności od strategii DBR77 i wymagań klientów |

### Data residency (GDPR)

- Dla klientów UE zalecane utrzymanie danych w regionach UE (np. Frankfurt, Warszawa)
- Konkretny region i dostawca definiowani w umowach i dokumentacji operacyjnej
- Dla enterprise — możliwość negocjacji dedykowanego regionu i data residency

---

## Polityka kopii zapasowych

### Retencja

- Zgodność z **Disaster Recovery Plan** i wymogami ISO 27001
- Docelowa retencja kopii zapasowych zgodna z polityką DBR77 (np. 30–90 dni, wersjonowanie)

### Backup strategy

| Typ danych | Częstotliwość | Przechowywanie |
|------------|--------------|----------------|
| **PostgreSQL** | Zgodnie z polityką DR | Off-site, encrypted |
| **Pliki (S3/storage)** | Zgodnie z polityką DR | Redundant storage |
| **Qdrant** | Zgodnie z polityką DR | Persistent volume |

### Recovery

- **RTO (Recovery Time Objective)** — określone w Disaster Recovery Plan
- **RPO (Recovery Point Objective)** — określone w Disaster Recovery Plan
- Testy odtworzenia wykonywane według harmonogramu polityki DR

---

## Środowiska

| Środowisko | Przeznaczenie | Różnice |
|------------|---------------|---------|
| **local** | Pracownie deweloperów | Debug, seeded test data |
| **staging** | Weryfikacja przed produkcją | Konfiguracja zbliżona do prod, test data |
| **production** | Platforma live | Debug wyłączony, IP whitelist dla admina |

---

## SLA (dostępność systemu)

### Docelowe parametry (do weryfikacji w umowie)

| Metryka | Docelowa wartość* |
|---------|---------------------|
| **Uptime** | 99.5–99.9% (do potwierdzenia) |
| **Maintenance windows** | Planowane w niskim ruchu, z wcześniejszą informacją |
| **Support** | Zgodnie z ofertą (np. e-mail, portal, KAM dla enterprise) |

*Konkretne wartości SLA należy potwierdzić w umowie lub ofercie DBR77.

### Monitoring

- Logowanie i monitoring infrastruktury
- Alerty przy awariach i anomaliach
- Compliance Dashboard w adminie — widoczność zdarzeń bezpieczeństwa

---

## Ograniczenia i uwagi

1. **Shared vs. dedicated** — standardowo infrastruktura może być współdzielona (multi-tenant); enterprise może mieć opcje dedykowane
2. **IP whitelisting** — panel admina ograniczony do zdefiniowanych adresów IP
3. **Zmiany** — szczegóły hostingu i regionu mogą się zmieniać; aktualne informacje w dokumentacji DBR77 i umowach

---

## Podsumowanie dla klienta

| Pytanie | Odpowiedź |
|---------|-----------|
| **Gdzie są dane?** | W chmurze, z opcją regionu UE (np. Frankfurt, Warszawa) dla GDPR |
| **Backupy?** | Tak, zgodnie z polityką DR, off-site, encrypted |
| **SLA?** | Do ustalenia w umowie (np. 99.5–99.9% uptime) |
| **Data sovereignty?** | Dla enterprise — negocjowalne wymagania data residency |

Dla szczegółów dotyczących regionu, dostawcy i SLA w Twoim przypadku — skontaktuj się z DBR77.
