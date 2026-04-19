# Execution packs — przegląd i sposób użycia

Ten dokument zbiera **wszystkie Marketing Execution Packi** (landing / LinkedIn / pitch / messaging) w jednym miejscu i pokazuje, jak ich używać razem z handbookiem, playbookami i checklistą publikacji.

**Źródła nadrzędne:**

- [`marketing-sales-handbook.md`](./marketing-sales-handbook.md) — jak cały GTM działa razem.
- [`playbooks/`](./playbooks/) — operacja: outreach, discovery, objections, handoff.
- [`assets/PUBLISH-CHECKLIST.md`](./assets/PUBLISH-CHECKLIST.md) — przed wysyłką na zewnątrz.

---

## 1. Co to jest execution pack

Execution pack to **gotowy zestaw treści** (Markdown) pod jedną personę lub typ partnera: narracja landingowa, posty LinkedIn, szkielet pitchu, core messaging (headlines / hooks / CTA). Służy do:

- rozmów sprzedażowych i partnerskich,
- adaptacji pod konto (język, branża, dowody),
- eksportu do decku/PDF poza repo.

Nie zastępuje profili person ani `client-message-house` — tylko **warstwę wykonawczą** nad nimi.

---

## 2. Indeks — Client GTM (buy-side)

| Plik | Persona | Jednozdaniowa rola |
|---|---|---|
| [`assets/client/06-ceo-marketing-execution-pack.md`](./assets/client/06-ceo-marketing-execution-pack.md) | CEO | Wynik, tempo, kontrola, jakość decyzji |
| [`assets/client/07-cfo-marketing-execution-pack.md`](./assets/client/07-cfo-marketing-execution-pack.md) | CFO | ROI, accountability, kontrola finansowa |
| [`assets/client/08-coo-marketing-execution-pack.md`](./assets/client/08-coo-marketing-execution-pack.md) | COO | Wykonanie, dostawa, widoczność |
| [`assets/client/09-owner-marketing-execution-pack.md`](./assets/client/09-owner-marketing-execution-pack.md) | Owner | Wzrost, wartość firmy, przewaga |
| [`assets/client/10-it-cybersecurity-marketing-execution-pack.md`](./assets/client/10-it-cybersecurity-marketing-execution-pack.md) | IT / Cybersecurity | Kontrola, bezpieczeństwo, własność danych |
| [`assets/client/11-transformation-officer-marketing-execution-pack.md`](./assets/client/11-transformation-officer-marketing-execution-pack.md) | Transformation Officer | Struktura, wykonanie, alignment, widoczność |

**Powiązania operacyjne:** [`playbooks/02-sales-outreach-playbook-clients.md`](./playbooks/02-sales-outreach-playbook-clients.md), [`client-touchpoint-sequences.md`](./client-touchpoint-sequences.md).

---

## 3. Indeks — Ecosystem / Partner GTM

| Plik | Typ partnera | Jednozdaniowa rola |
|---|---|---|
| [`assets/partner/06-consulting-owner-marketing-execution-pack.md`](./assets/partner/06-consulting-owner-marketing-execution-pack.md) | Consulting Owner | Leverage, marża, skalowanie modelu |
| [`assets/partner/07-consultant-marketing-execution-pack.md`](./assets/partner/07-consultant-marketing-execution-pack.md) | Individual Consultant | Niezależność, income, leverage osobisty |
| [`assets/partner/08-software-house-marketing-execution-pack.md`](./assets/partner/08-software-house-marketing-execution-pack.md) | Software House | Nowa warstwa revenue, upsell, pozycja |
| [`assets/partner/09-system-integrator-marketing-execution-pack.md`](./assets/partner/09-system-integrator-marketing-execution-pack.md) | System Integrator | Wejście wyżej, większy deal, wpływ |
| [`assets/partner/10-boutique-consultancy-marketing-execution-pack.md`](./assets/partner/10-boutique-consultancy-marketing-execution-pack.md) | Boutique Consultancy | Skala outputu, credibility vs duzi gracze |
| [`assets/partner/11-financial-institution-marketing-execution-pack.md`](./assets/partner/11-financial-institution-marketing-execution-pack.md) | Financial Institution | Ryzyko portfela, performance klientów, stabilność |

**Powiązania operacyjne:** [`playbooks/03-sales-outreach-playbook-partners.md`](./playbooks/03-sales-outreach-playbook-partners.md), [`partner-motion-playbook.md`](./partner-motion-playbook.md).

Szablony partnerskie `01`–`05` (pakiety motion, nie execution packi) są w [`assets/partner/README.md`](./assets/partner/README.md).

---

## 4. Indeks — Investor (VC)

| Plik | Rola |
|---|---|
| [`assets/investor/04-investor-vc-marketing-execution-pack.md`](./assets/investor/04-investor-vc-marketing-execution-pack.md) | Landing narrative, LinkedIn, pitch deck spine, key messaging: kategoria, skala, moat |

**Pełny opis ścieżki inwestorskiej (narracja → memo → DD):** sekcja [Investor messaging system](#investor-messaging-system) poniżej oraz [`assets/investor/investor-messaging-system.md`](./assets/investor/investor-messaging-system.md).

---

## 5. Jak wybrać pack (krótka reguła)

| Jeśli rozmawiasz z… | Zacznij od |
|---|---|
| decydentem po stronie klienta końcowego | odpowiedniego pliku w `assets/client/*-marketing-execution-pack.md` |
| partnerem ekosystemowym | odpowiedniego pliku w `assets/partner/*-marketing-execution-pack.md` |
| VC / inwestorem strategicznym | [`assets/investor/04-investor-vc-marketing-execution-pack.md`](./assets/investor/04-investor-vc-marketing-execution-pack.md) + [`investor-narrative.md`](./investor-narrative.md) |

Zawsze trzymaj spójność z [`client-message-house.md`](./client-message-house.md) (client) albo z tezą z [`investor-narrative.md`](./investor-narrative.md) (investor).

---

## 6. Workflow przed wysyłką zewnętrzną

1. Dopasuj pack do persony i kanału.
2. Uzupełnij dane konta, dowody, liczby — tylko jeśli są zatwierdzone (patrz [`assets/PUBLISH-CHECKLIST.md`](./assets/PUBLISH-CHECKLIST.md)).
3. Eksport do PDF/deck poza repo; opcjonalnie oznacz w [`asset-gap-map.md`](./asset-gap-map.md) jako **Gotowe (materiał zewnętrzny)**.

---

<a id="investor-messaging-system"></a>

## Investor messaging system

Ścieżka inwestorska jest **osobna od Client i Partner GTM**: inwestor kupuje tezę kategorii, skalowalność modelu i moat — nie feature listę.

**Kolejność materiałów (od intro do DD):**

| Etap | Co czytać / używać |
|---|---|
| **Teza i spójność** | [`investor-narrative.md`](./investor-narrative.md) |
| **Operacja komunikacji** | [`playbooks/04-investor-communications-playbook.md`](./playbooks/04-investor-communications-playbook.md) |
| **Execution (copy + deck spine)** | [`assets/investor/04-investor-vc-marketing-execution-pack.md`](./assets/investor/04-investor-vc-marketing-execution-pack.md) |
| **Struktura memo** | [`assets/investor/01-investment-memo-outline.md`](./assets/investor/01-investment-memo-outline.md) |
| **Moat — załącznik** | [`assets/investor/03-moat-appendix-template.md`](./assets/investor/03-moat-appendix-template.md) |
| **Data room** | [`assets/investor/02-data-room-checklist.md`](./assets/investor/02-data-room-checklist.md) |
| **Profil persony** | [`personas/ecosystem/13-investor-vc.md`](./personas/ecosystem/13-investor-vc.md) |

**Zasady spójności:** narracja do inwestora musi dać się złożyć z tym, co mówicie do klientów (execution, ROI, bezpieczeństwo) i do partnerów (leverage, scope) — bez sprzecznych obietnic. Szczegóły: [`playbooks/04-investor-communications-playbook.md`](./playbooks/04-investor-communications-playbook.md) (sekcja spójności).

**Skrót wejścia:** [`assets/investor/investor-messaging-system.md`](./assets/investor/investor-messaging-system.md).

---

## Powiązane

- Indeks assetów: [`assets/README.md`](./assets/README.md)
- Handoff marketing–sales: [`playbooks/06-sales-marketing-handoff.md`](./playbooks/06-sales-marketing-handoff.md)
