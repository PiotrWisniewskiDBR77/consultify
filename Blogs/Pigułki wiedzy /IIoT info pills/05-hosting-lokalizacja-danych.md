# DBR77 IIoT — Hosting i Lokalizacja Danych

## 1. Dostawca i region

| Region | Dostawca / Lokalizacja |
|--------|------------------------|
| **Europa** | AWS / Azure — region np. Frankfurt, Warszawa (w zależności od konfiguracji) |
| **USA** | AWS / Azure — region US (np. us-east-1) |
| **Inne** | Do ustalenia w zależności od wymagań klienta |

## 2. Polityka kopii zapasowych

| Element | Wartość |
|---------|---------|
| **Częstotliwość backupu** | Dzienna (standard) |
| **Retencja** | Min. 30 dni; możliwość wydłużenia |
| **RPO** | Określone w SLA |
| **RTO** | Określone w SLA |

## 3. SLA (dostępność systemu)

| Poziom | Dostępność |
|--------|------------|
| **Standard** | 99,5% rocznie |
| **Premium** | 99,9% rocznie (do negocjacji) |
| **Komunikacja awarii** | Powiadomienia; status page |

## 4. Zgodność z przepisami

- **GDPR** — dane osobowe przetwarzane zgodnie z RODO.
- **Lokalizacja danych** — możliwość wyboru regionu w UE dla klientów europejskich.
