---
doc_id: funkcje-odbior-177
status: canonical
truth_type: acceptance
established: 2026-08-30
---

# ODBIÓR 177 — Partner G08 · STOP CZĘŚCIOWO ZASADNY, wznowienie tanie

0/25 ekranów, 0/50 zrzutów — dyżur stanął na starcie runtime. Odbiór odtworzył
blokadę SAM i poszedł dalej: przyczyną NIE jest port ani seeder, tylko
**niespójność dwóch skryptów** — seeder od 28.08 przyjmuje dowolną bazę
(`--confirm-db`), ale `scripts/dev/start-wave3-owner-runtime.mjs:82` w trybie
adopt-existing nadal wymaga `^consultify_w3_partner_owner_…`. Dyżur użył `cx177`.

**Dowód odbioru:** z bazą `consultify_w3_partner_owner_odbior177` cały łańcuch
(migracje 869 → seed → manifest → runtime 6090/6091) przeszedł end-to-end w 5 minut,
ZERO zmian kodu. Zalecenie raportu („zmienić kontrakt") było cięższe niż potrzeba.

Na plus: zakaz zmian kodu dotrzymany (diff = 2 pliki docs); pierwszy commit błędnie
obwinił port, drugi po 3 minutach **sam się sprostował do przodu** — wzorowo.

## ★ DEFEKT SZKIELETU — dotyczy WSZYSTKICH 16 rodzin
`adoptedFixtureContracts` w `start-wave3-owner-runtime.mjs` ma sztywny prefiks-regex
per moduł, niezsynchronizowany z odpiętymi seederami. **Bezpiecznik od dziś:
generator instrukcji wydaje nazwę bazy Z WBUDOWANYM prefiksem modułu**
(np. `consultify_w3_partner_owner_cx177`), nie gołe `cxNNN`.

## Wznowienie
Ten sam worktree/gałąź, ta sama instrukcja; jedyna zmiana: baza
`consultify_w3_partner_owner_cx177`. Wklejka wydana właścicielowi.


## ★ WZNOWIENIE WYKONANE — przejazd odebrany (ocena pomiaru: B), SCALONO

50/50 zrzutów (SHA-256 zgodne), 25/25 DOM-ów `active+pl+theme`, liczby raportu
odtworzone z surowych logów (24× accrual-500, 28× uuid=text). Zero rozjazdu
tabela↔zrzut na 9 obejrzanych. Żadna bramka G08-G20 nie podniesiona — uczciwie.

**Potwierdzone defekty backendu (kandydaci na dyżur 188):**
- PRT-D62-005: `readApprovedPartnerAccrualPolicy` → 500 (`partnerCommissionService.ts:191`,
  `partner.routes.ts:1098`) — 4 ekrany rozliczeń za banerem blokady;
- PRT-D62-006: `partner_attributions.organization_id` (text) łączone z `organizations.id`
  (uuid) — cichy 500 na `projects` przebrany za „Brak aktywnych projektów".

**Sekcje NIE do pokazania właścicielowi** (przekazane do KOORDYNACJA): learning-path
(SUROWE ENUMY `not_required`/`prerequisite_incomplete` jako pigułki UI!), metrics
(6+ ang. etykiet KPI), earnings/statements/payouts/payout-settings (ang. breadcrumb nad
polskim banerem), organizations/users (ang. statusy). **Każdy z 25 ekranów ma co
najmniej angielski breadcrumb** — defekt rozlany, kandydat na dyżur 189 (i18n Partnera).
Drobiazg do grafiki: czerwona kropka przy `Model ▾` w topbarze na wszystkich ekranach.
