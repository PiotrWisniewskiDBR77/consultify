# Security brief — architektura, data flow, FAQ

**Dla:** IT / Cybersecurity (Consideration–Decision)  
**Cel:** Dać **defensible decision** — wiadomo, gdzie są dane, kto ma kontrolę, jakie są opcje wdrożenia.

*Uwaga: poniżej jest szablon do dopasowania do realnej architektury wdrożenia Consultify u klienta. Konkretne regiony chmury, nazwy subprocessorów i certyfikaty — **uzupełnia produkt / legal** przed wysyłką do CISO.*

---

## 1. Kontekst klienta

| Pole | Wartość |
|---|---|
| Wymagania compliance | *Np. RODO + polityka grupy; opcjonalnie ISO 27001 / SOC 2 — wpisz wymagane przez klienta.* |
| Model deployment | *Np. SaaS multi-tenant / dedykowany tenant / VPC / hybrid — wybór po assessment.* |
| Środowiska | *Np. sandbox (POC) → staging → produkcja; osobne konta IAM.* |

---

## 2. High-level architecture (opis)

**Jedno zdanie:** *Aplikacja Consultify działa jako usługa zarządzana; dane wejściowe klienta są przetwarzane w kontrolowanym środowisku; integracje z systemami klienta odbywają się przez uzgodnione konektory / API z minimalnym zakresem uprawnień.*

### Diagram (miejsce na diagram)

*Wklej diagram z Figmy / Confluence lub dodaj link do repozytorium diagramów (warstwa: użytkownik → Consultify → LLM/subprocesory → systemy klienta).*

---

## 3. Data flow

| Etap | Opis | Dane w spoczynku / w tranzycie | Kontrola klienta |
|---|---|---|---|
| Wejście danych | Upload / integracja / tekst w aplikacji | Szyfrowanie w tranzycie (TLS); at-rest wg polityki środowiska | Polityka klasyfikacji; zakaz wrażliwych klas bez DPIA |
| Przetwarzanie | Logika produktu, orkiestracja, logi | Segmentacja środowisk; retencja logów wg polityki | RBAC; minimalne uprawnienia |
| Wyjście / raportowanie | Raporty, eksporty | Eksport tylko dla ról uprawnionych | Akceptacja eksportu przez ownera danych |
| Logi / audyt | Dostęp, zmiany konfiguracji, incydenty | Przechowywanie zgodnie z retencją | Dostęp „break-glass” wg procedury |

**Klasyfikacja danych:** *PII / dane finansowe / IP — dopasujcie do klasyfikacji klienta; dla każdej klasy: czy dozwolone w pilocie i jakie dodatkowe środki.*

---

## 4. Granice zaufania (trust boundaries)

- Co pozostaje **wyłącznie po stronie klienta:** *tożsamość użytkowników (jeśli IdP klienta), źródła prawdy w ERP/HR (jeśli nie integrujecie), klucze do systemów lokalnych.*
- Co jest po stronie Consultify / subprocessora: *hosting aplikacji, część logiki, konfiguracja modeli zgodnie z polityką — **doprecyzować w DPA**.*
- **Subprocesorzy:** *lista aktualna + mechanizm powiadomień o zmianie + możliwość sprzeciwu (wg umowy).*

---

## 5. Identity & access

- Model uwierzytelniania: *SSO (SAML/OIDC) jeśli dostępne; w przeciwnym razie MFA w standardzie produktu.*
- RBAC: *np. Admin / Program lead / Viewer — dopasujcie do realnych ról w produkcie.*
- Polityka haseł / MFA: *MFA włączone dla kont administracyjnych; polityka haseł zgodna z best practice.*

---

## 6. FAQ (typowe obiekcje IT/CISO)

| Pytanie | Odpowiedź (szkic) |
|---|---|
| Gdzie fizycznie są dane? | *Region hostingu [wpisz]; możliwość dedykowanego regionu / tenant — wg oferty.* |
| Czy trenujecie modele na danych klienta? | *Domyślnie: **nie** do treningu ogólnego bez umowy; szczegóły w DPA i product policy.* |
| Jak wygląda retencja i usuwanie danych? | *Okres przechowywania [wpisz]; procedura usuwania po zakończeniu umowy; eksport na żądanie.* |
| Jak reagujecie na incydent? | *Procedura: wykrycie → klasyfikacja → informacja klienta wg SLA i prawa; link do runbooka [wewnętrzny].* |
| Czy jest penetration test / DPA? | *Pen test: [cykl / na żądanie]; DPA: standardowa pod RODO + załączniki techniczne.* |

---

## 7. Deployment options (Decision)

| Opcja | Kiedy ma sens | Wymagania | Uwagi |
|---|---|---|---|
| Cloud (multi-tenant) | Szybki start, standardowe wymagania | SSO, polityka danych | Najniższy TCO operacyjny |
| Dedicated tenant / VPC | Silniejsza izolacja, polityka grupy | Sieć, IAM, monitoring | Wyższy koszt i czas |
| Hybrid / edge (jeśli w roadmapzie) | Ograniczenia wyjścia danych z lokalizacji | Architektura integracji | Wymaga joint design |

---

## 8. Sign-off (szablon)

- **CISO/CIO:** *imię, data* — warunki: *np. akceptacja po uzupełnieniu diagramu, DPIA dla klasy X, pen test przed produkcją.*
- **Data obowiązywania review:** *co 12 miesięcy lub po każdej istotnej zmianie architektury / subprocessora.*
