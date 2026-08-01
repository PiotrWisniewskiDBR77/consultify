---
doc_id: FIN-005
truth_type: operations
status: BLOCKED
owner: codex
product_owner: piotr
priority: P0
depends_on: FIN-001
last_reviewed: 2026-08-01
---

# FIN-005 — spójność Finance golden flow w Atelier Toys

## Cel

Finance na `demo.consultify.ai` ma opowiadać jedną historię Atelier Toys:
statement → analysis → model → prediction/valuation → investment case → plan vs actual,
bez danych innych tenantów, surowych rekordów testowych i atrap wartości.

## Próba stagingowa 2026-08-01

Środowisko: Railway `demo`, revision
`9917d25c75f7447289517a0cef3981b3b4c4789f`, kontekst UI
`Demo Mode · Atelier Toys`.

Werdykt: **NO-GO / BLOCKED**.

### Statements

- tabela otwiera się i renderuje sześć rekordów;
- pięć rekordów jest sklasyfikowanych jako `Rejected Imports`;
- cztery rekordy pokazują surową wartość daty
  `Thu Dec 31 2026 00:00:00 GMT+0000 (Coordinated Universal Time)`;
- jedyny zatwierdzony statement nazywa się `DBR77 Manufacturing`, a nie Atelier Toys;
- readiness pokazuje brakujące P&L/BS/CF dla większości rekordów.

### Analysis

- istnieje jedna analiza `DBR77 Staging Financial Analysis`;
- dane oraz nazwa nie należą do kanonicznej historii Atelier Toys;
- kalkulator wskaźników jest widoczny, lecz nie stanowi powiązanego golden flow.

### Models

- widocznych jest osiem modeli, w tym DBR77, Apator i techniczne seedy;
- cztery rekordy `DBR77 Staging Finance Model (kopia)` są duplikatami;
- ekran zgłasza `Value engine temporarily unavailable — the cockpit works normally`;
- formularze driver tree, value ledger i value capture są wyświetlane, ale nie mają
  wiarygodnego powiązania z wybraną historią Atelier Toys;
- globalna warstwa demo blokuje zapis (`Demo mode is read-only`), co jest prawidłowe.

## Granica naprawy

1. odseparować albo usunąć z demo-tenant dane DBR77, Apator i techniczne kopie;
2. zmaterializować jeden kompletny statement Atelier Toys z P&L, BS i CF;
3. połączyć z nim jedną zatwierdzoną analizę oraz kanoniczny model
   `Atelier Toys — Transformation 2015 ROI`;
4. poprawić serializację okresu tak, aby UI nigdy nie wyświetlało surowego obiektu Date;
5. przywrócić value engine albo pokazać jawny stan niedostępności, który nie sugeruje
   ukończonego golden flow;
6. dodać idempotency test seedów i test zakazujący obcych nazw organizacji w
   kanonicznym demo-tenant;
7. powtórzyć staging E2E od statement do actual-vs-plan, bez mutowania danych wspólnych.

## Kryteria GO

- wszystkie rekordy widoczne w podstawowym demo należą do Atelier Toys;
- brak duplikatów i surowych dat;
- co najmniej jeden kompletny statement i model otwierają się z kanonicznym read-back;
- kalkulacje mają reprodukowalne wejście, wynik i źródło;
- investment case może utworzyć draft inicjatywy, a actuals dają się porównać z baseline;
- tryb demo nadal blokuje trwałe mutacje.
