# Marketing

Katalog roboczy dla strategii marketingowej Consultify / DRD.

## Struktura

- [`personas-overview-clients.md`](./personas-overview-clients.md) — **persony klienckie** (buy-side): OWNER, CEO, CFO, COO, Transformation Officer, IT/Cybersecurity.
- [`personas-overview-ecosystem.md`](./personas-overview-ecosystem.md) — **persony ekosystemowe** (partnerzy, kanały, inwestorzy): Consulting Owner, Individual Consultant, Software House, System Integrator, Boutique Consultancy, Financial Institution, Investor/VC.
- `personas/` — szczegółowe profile 13 person, już uzupełnione o warstwę GTM.
- [`client-message-house.md`](./client-message-house.md) — **źródło prawdy messagingu** (Client GTM).
- [`asset-gap-map.md`](./asset-gap-map.md) — mapa materiałów i statusów produkcji.
- [`assets/`](./assets/) — **szablony materiałów** (Markdown: client deal room, persona × stage, partner, investor); indeks: [`assets/README.md`](./assets/README.md).
- [`marketing-sales-handbook.md`](./marketing-sales-handbook.md) — nadrzędny handbook spinający product marketing, outreach i fundraising communications.
- [`playbooks/`](./playbooks/) — moduły wykonawcze dla marketingu i sprzedaży: framework, outreach, discovery, objections, handoff.
- [`execution-packs-overview.md`](./execution-packs-overview.md) — **zbiorczy przegląd** wszystkich Marketing Execution Packów (client, partner, investor) + sekcja *Investor messaging system*.
- [`client-touchpoint-sequences.md`](./client-touchpoint-sequences.md) — sekwencje touchpointów dla kluczowych person.
- [`partner-motion-playbook.md`](./partner-motion-playbook.md) — partner motion i enablement.
- [`investor-narrative.md`](./investor-narrative.md) — narracja fundraisingowa / IR.
- `communication-plan/` — **mapa systemu** komunikacji (linkuje powyższe dokumenty).

## Dwie ścieżki komunikacji

Marketing Consultify ma **dwie równoległe narracje**:

1. **Client GTM** — sprzedaż transformacji do klientów końcowych (sterowana przez persony kliencie).
2. **Ecosystem / Partner GTM** — skalowanie przez partnerów (consulting, software house, SI, butik, bank), plus investor narrative.

Każda ścieżka ma inny lejek, inne key messages i inne triggery — nie mieszać w jednym kanale / jednej kampanii.

## Status

Aktualny stan:

1. Wszystkie 13 person ma pełne profile narracyjne + GTM layer.
2. Warstwa operacyjna: `client-message-house`, `asset-gap-map`, `client-touchpoint-sequences`, `partner-motion-playbook`, `investor-narrative`.
3. `communication-plan/README.md` jest mapą systemu i linkuje powyższe pliki.
4. `personas-overview-*.md` są zsynchronizowane z rolami i 1-linerami.
5. Katalog `assets/` zawiera komplet źródeł Markdown; [`asset-gap-map.md`](./asset-gap-map.md) oznacza je jako **Gotowe (źródło MD)** (eksport do PDF/deck i linki zewnętrzne — wg [`assets/PUBLISH-CHECKLIST.md`](./assets/PUBLISH-CHECKLIST.md)).
6. Warstwa handoffowa jest opisana w [`marketing-sales-handbook.md`](./marketing-sales-handbook.md) i modułach w [`playbooks/`](./playbooks/).

Najbliższe kolejne kroki:

1. Korzystać z [`marketing-sales-handbook.md`](./marketing-sales-handbook.md) jako wejścia nadrzędnego, a z [`playbooks/`](./playbooks/) jako warstwy operacyjnej dla marketingu i sales.
2. Przejść checklistę publikacji: [`assets/PUBLISH-CHECKLIST.md`](./assets/PUBLISH-CHECKLIST.md) przed wysyłką materiałów do klienta lub inwestorów (dopisanie danych konta, review ROI/security, zgody).
3. Eksport wybranych plików z `assets/` do decków/PDF poza repo; opcjonalnie podlinkować gotowe pliki zewnętrzne w `asset-gap-map.md` (status **Gotowe (materiał zewnętrzny)**) i w `client-touchpoint-sequences.md`.
4. Uzupełnienie traction i finansów w `investor-narrative.md` oraz pól TBD w `assets/investor/` — wyłącznie realnymi danymi zespołu przed rundą.
