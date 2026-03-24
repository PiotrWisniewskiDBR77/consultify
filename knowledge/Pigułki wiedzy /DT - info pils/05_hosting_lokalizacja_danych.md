## Hosting i lokalizacja danych

### Środowiska chmurowe: AWS / Azure

- **AWS**:
  - usługi typu EC2, RDS, S3, EKS (lub równoważne),
  - zarządzanie dostępem przez IAM, szyfrowanie KMS.
- **Azure**:
  - usługi typu VM Scale Sets, Azure SQL, Blob Storage, AKS,
  - zarządzanie dostępem przez Azure AD, szyfrowanie Key Vault.
- **Architektura**:
  - wielowarstwowa (warstwa prezentacji, API, warstwa symulacji, warstwa danych),
  - oparcie o kontenery (Docker/Kubernetes) umożliwiające skalowanie i izolację.

---

### Regiony danych (UE / USA)

- **Region UE**:
  - preferowany dla klientów europejskich ze względu na RODO/GDPR,
  - centra danych w krajach UE (np. Irlandia, Niemcy, Holandia).
- **Region USA**:
  - dla klientów z Ameryki Północnej lub o globalnym zasięgu.
- **Wybór regionu**:
  - określany na etapie wdrożenia i zapisany umownie,
  - brak transferu danych poza wskazany region bez zgody klienta.

---

### Separacja danych (multi‑tenant)

- **Model multi‑tenant**:
  - logiczna separacja danych poszczególnych klientów w ramach współdzielonej infrastruktury,
  - osobne schematy baz danych / bazy / kontenery dla organizacji.
- **Dodatkowe opcje**:
  - możliwość dedykowanej instancji (single‑tenant) dla klientów o podwyższonych wymaganiach (za dopłatą),
  - wsparcie dla środowisk test/QA/PROD oddzielnie na życzenie.

---

### Polityka backupu

- **Częstotliwość**:
  - backupy dzienne (pełne) i przyrostowe w ciągu dnia (np. co 4 godziny),
  - dodatkowe snapshoty przy istotnych aktualizacjach systemu.
- **Przechowywanie**:
  - backupy przechowywane w szyfrowanej postaci w tym samym regionie lub regionie zapasowym (cross‑region),
  - testy odtwarzania backupów w regularnych odstępach czasu.
- **Zakres**:
  - bazy danych,
  - pliki modeli, konfiguracje,
  - metadane i ustawienia organizacji.

---

### Retencja danych

- **Okres retencji operacyjnej**:
  - dane bieżące i modele utrzymywane przez cały okres trwania umowy.
- **Retencja backupów**:
  - standardowo np. 30–90 dni (do uzgodnienia w SLA),
  - możliwość wydłużenia retencji za dodatkową opłatą.
- **Po zakończeniu współpracy**:
  - dane usuwane zgodnie z zapisami umowy i DPA,
  - możliwość przekazania klientowi pełnego eksportu danych przed usunięciem.

---

### SLA dostępności systemu

- **Poziom dostępności**:
  - typowo ≥99,5% miesięcznie (do uzgodnienia w umowie),
  - wyłączenia: planowane prace serwisowe z wyprzedzeniem, siła wyższa.
- **Monitorowanie**:
  - 24/7 monitoring infrastruktury,
  - automatyczne alerty w przypadku degradacji lub niedostępności usług.
- **Raportowanie**:
  - okresowe raporty SLA dostępne dla klientów na życzenie,
  - ścieżka eskalacji w przypadku przekroczeń.

---

### Disaster Recovery (DR)

- **Strategia DR**:
  - replikacja danych do zapasowego regionu lub strefy dostępności (w zależności od konfiguracji),
  - zdefiniowane RPO (Recovery Point Objective) i RTO (Recovery Time Objective) w umowie.
- **Procedury**:
  - scenariusze odtwarzania w przypadku awarii całego regionu / kluczowych komponentów,
  - okresowe testy DR z pełnym odtworzeniem środowiska testowego.
- **Komunikacja z klientem**:
  - jasne procedury informowania klientów o incydentach,
  - harmonogram przywracania usług i priorytety.

---

### Regiony geograficzne (wg dt-website)

- **EU** – preferowane dla klientów europejskich (RODO/GDPR).
- **US** – dla klientów z Ameryki Północnej.
- **GCC** – region Zatoki Perskiej.
- **JP** – Japonia.

