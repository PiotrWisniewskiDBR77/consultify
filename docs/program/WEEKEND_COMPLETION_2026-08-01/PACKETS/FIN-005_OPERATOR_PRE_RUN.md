---
doc_id: FIN-005-operator-pre-run
truth_type: operations
status: AWAITING_CODEX_REVIEW
owner: claude
process_owner: codex
product_owner: piotr
packet: FIN-005
depends_on: FIN-005-implementation-handoff
last_reviewed: 2026-08-01
---

# FIN-005 — pre-run operatora przed pierwszym `--write`

Produkt: Consultify. Target: Railway project `consultify`, environment `demo`,
`https://demo.consultify.ai`, PostgreSQL tego environmentu. **Localhost nie jest
evidence odbiorowym.**

Ten dokument opisuje, co Codex musi wykonać i potwierdzić **zanim** kwarantanna
zostanie uruchomiona z `--write`. Gałąź `fix/fin-005-atelier-coherence` nie
wykonała żadnego zapisu, żadnej migracji i żadnej mutacji stagingu — cały ten
krok jest przed Codexem.

Kolejność jest obowiązkowa. Krok, który nie przeszedł, zatrzymuje procedurę;
nie ma obejścia (`--force-org` został celowo usunięty i jego użycie jest twardym
błędem — sprawa poza allowlistą dostaje własny pakiet, review i narzędzia).

---

## 0. Warunek wstępny — seed przed kwarantanną

**Kanoniczny seed Atelier MUSI wejść przed kwarantanną.** Kwarantanna przenosi
obce rekordy poza tenant demo; uruchomiona wcześniej zostawiłaby Finance puste.
Skrypt sam tego pilnuje: `--write` czyta z bazy dokładny kanoniczny fixture
i odmawia, gdy czegokolwiek brakuje — ale kolejność i tak należy do operatora.

---

## 1. Potwierdź żywy cel Railway (read-only)

Skrypt ma twardą allowlistę fingerprintu i **nie ma domyślnych wartości** —
każde pole musi zostać zadeklarowane jawnie. Wartości w
`FIN005_APPROVED_DEMO_TARGETS` (`server/src/services/demo/financeDemoCoherencePolicy.ts`)
są przepisane z dokumentacji i **nie były potwierdzone na żywym połączeniu**,
bo ta gałąź nie może dotykać Railway.

Potwierdź w dashboardzie/CLI Railway i zapisz jako evidence:

| Pole | Wartość do potwierdzenia |
| --- | --- |
| project | `consultify` |
| environment | `demo` |
| service (Postgres) | ⚠ do potwierdzenia — allowlista zakłada `Postgres` |
| host | `trolley.proxy.rlwy.net` |
| port | `28146` |
| database | ⚠ do potwierdzenia — allowlista zakłada `railway` |
| organization id | `demo-org` (wartość `DEMO_ORG_ID` w tym environmencie) |

Jeżeli którakolwiek wartość różni się od allowlisty — **popraw allowlistę w
osobnym commicie**, nie obchodź bramki. Tryb awarii jest bezpieczny w obie
strony: zła wartość powoduje ODMOWĘ, nigdy uruchomienie w niezatwierdzonym
miejscu.

Bramka odmawia także wtedy, gdy zadeklarowany environment albo host wygląda na
produkcyjny (`centerbeam`, `prod`, `production`, `live`) — **niezależnie od
tego, jakie organizacje tam istnieją**. Organizacja typu `DEMO` w produkcji nie
odblokowuje niczego.

---

## 2. Preflight — wyłącznie do odczytu

Uruchom dry-run. Jest domyślny, nie przyjmuje żadnego zapisu i nie wymaga klucza
HMAC (dry-run nie produkuje manifestu).

```bash
DATABASE_URL="<demo>" npx tsx server/scripts/finance-demo-coherence-cleanup.ts \
  --demo-org-id "<DEMO_ORG_ID>" \
  --railway-project consultify \
  --railway-environment demo \
  --railway-service "<POTWIERDZONY_SERVICE>" \
  --expect-host trolley.proxy.rlwy.net \
  --expect-port 28146 \
  --expect-database "<POTWIERDZONA_BAZA>"
```

Produkuje raport w `server/exports/` z podziałem na wiersze kanoniczne
(zostają) i obce (kandydaci do kwarantanny), z flagami nazw jako materiałem
pomocniczym dla człowieka — **flagi nie decydują**, decyduje dokładny zbiór
kanonicznych ID.

Zapytania walidacyjne (read-only) są w
`FIN-005_IMPLEMENTATION_HANDOFF.md` §8. Uruchom je i zachowaj wynik jako stan
„przed".

**Nie przechodź dalej, dopóki lista obcych rekordów nie zostanie przejrzana
i zaakceptowana przez człowieka.** Prowieniencja tych rekordów nie jest
odtwarzalna z kodu (żaden skrypt w repo ich nie produkuje — patrz handoff §2.5),
więc skrypt niczego nie zakłada.

---

## 3. Potwierdź, że fixture jest READY

`--write` wymaga fixture'u **READY**, nie tylko kompletnego: „kompletny, ale
`pending`" to sygnatura przerwanego seeda, a kontrakt pakietu mówi „najpierw
seed, potem kwarantanna".

Read-only sprawdzenie — musi zwrócić dokładnie jeden wiersz:

```sql
SELECT p.entity_name, p.period_label, p.currency,
       p.pack_status, p.pack_readiness_status,
       a.status  AS analysis_status,
       m.name    AS model_name, m.currency AS model_currency, m.status AS model_status
  FROM financial_statement_packs p
  JOIN financial_analyses a ON a.source_statement_pack_id = p.id
  JOIN financial_models   m ON m.source_statement_pack_id = p.id
 WHERE p.organization_id = '<DEMO_ORG_ID>';
```

Oczekiwane: `Atelier Toys` · `FY2014` · `EUR` · `confirmed` · `ready` ·
`APPROVED` · `Atelier Toys — Transformation 2015 ROI` · `EUR` · `approved`.

Oraz trzy sprawozdania, każde `confirmed` / `pass` / `ready`, z zerem
niezmapowanych wartości:

```sql
SELECT s.statement_type, s.status, s.validation_status, s.readiness_status,
       COUNT(v.id)::int AS values,
       COUNT(*) FILTER (WHERE v.canonical_line_id IS NULL)::int AS unmapped
  FROM financial_statements s
  LEFT JOIN financial_statement_values v ON v.statement_id = s.id
 WHERE s.organization_id = '<DEMO_ORG_ID>'
 GROUP BY s.id, s.statement_type, s.status, s.validation_status, s.readiness_status
 ORDER BY s.statement_type;
```

Jeżeli stan jest **mieszany** (część `ready`, część `pending`) — to ślad po
przerwanym seedzie. Uruchom seed ponownie: faza 0 demotuje mieszany stan i
odbudowuje spójny fixture (zweryfikowane na realnym PostgreSQL, handoff §13.3).
Nie uruchamiaj kwarantanny na mieszanym fixture.

---

## 4. Przygotuj i zabezpiecz klucz HMAC

Manifest rollbacku jest uwierzytelniony **HMAC-SHA256**. Klucz jest **wymagany**
dla `--write` i dla `--rollback` (dry-run go nie potrzebuje).

```bash
# wygeneruj poza repo, nigdy nie commituj
openssl rand -base64 48 > ~/.fin005-manifest-key
chmod 600 ~/.fin005-manifest-key
```

- `FIN005_MANIFEST_HMAC_KEY` — sekret, **minimum 32 znaki**;
- `FIN005_MANIFEST_HMAC_KEY_ID` — publiczny identyfikator wersji klucza
  (np. `fin005-2026-08-a`), zapisywany w manifeście, żeby rotacja była wykrywalna.

Wymagania:

1. **Ten sam klucz musi być dostępny przy rollbacku.** Utrata klucza czyni
   istniejący manifest nieużywalnym przez skrypt — wiersze trzeba by wtedy
   przywrócić ręcznie z zapisanego prior state. To jest realne ryzyko
   operacyjne, nie formalność.
2. Przechowaj sekret w menedżerze sekretów zespołu, **nie** w repo, nie w
   `.env` commitowanym, nie w historii powłoki (użyj `$(cat ~/.fin005-...)`).
3. Sekret nigdy nie trafia do logu, do raportu ani do manifestu — potwierdzone
   testem i grepem po repo. Do manifestu trafia wyłącznie `keyId`.
4. **Brak procedury rotacji** — to świadomie otwarta pozycja (handoff §13.8).
   Ustal ją przed pierwszym `--write`, nie po.

---

## 5. Zachowaj manifest poza maszyną operatora

Manifest jest **jedynym** trwałym planem cofnięcia: nie ma tabeli audit/outbox w
bazie (wymagałaby migracji, poza granicą pakietu — propozycja DDL leży w
skrypcie jako `DURABLE_AUDIT_TABLE_PROPOSAL`).

Skrypt zapisuje go do pliku tymczasowego, robi `fsync` i atomowy `rename`
**przed `COMMIT`**, więc awaria między `COMMIT` a finalnym zapisem nadal
pozostawia odtwarzalny manifest `PREPARED`.

Natychmiast po `--write`:

1. skopiuj `server/exports/fin005-finance-demo-manifest-*.json` do trwałego
   magazynu poza laptopem operatora (bucket zespołowy / sejf);
2. zanotuj `keyId` obok kopii;
3. zweryfikuj kopię (`--rollback` odmówi, jeśli suma HMAC się nie zgadza —
   sprawdź to na kopii, zanim uznasz ją za dobrą);
4. `server/exports/` jest w `.gitignore` — manifest **nie może** trafić do repo.

Rollback dodatkowo odmawia, gdy rekord zmienił się po kwarantannie (fingerprint
per wiersz), gdy manifest był podpisany innym kluczem, oraz gdy manifest
pochodzi z innego hosta/bazy niż podłączony cel.

---

## 6. Dopiero teraz `--write`

```bash
DATABASE_URL="<demo>" \
FIN005_MANIFEST_HMAC_KEY="$(cat ~/.fin005-manifest-key)" \
FIN005_MANIFEST_HMAC_KEY_ID=fin005-2026-08-a \
FINANCE_DEMO_CLEANUP_CONFIRM=QUARANTINE_FOREIGN_FINANCE \
npx tsx server/scripts/finance-demo-coherence-cleanup.ts \
  --demo-org-id "<DEMO_ORG_ID>" \
  --railway-project consultify --railway-environment demo \
  --railway-service "<SERVICE>" \
  --expect-host trolley.proxy.rlwy.net --expect-port 28146 \
  --expect-database "<BAZA>" \
  --write
```

Skrypt powie przed zapisem, co zrobi: utworzy nieaktywną organizację kwarantanny
(typ `DEMO`, bez użytkowników i bez członkostw), przeniesie N wierszy, wyczyści
`statement_pack_id` na przenoszonych sprawozdaniach (zapisane do rollbacku) i
**nie usunie niczego**.

Po zapisie: powtórz zapytania walidacyjne z §2 i porównaj ze stanem „przed".

---

## 7. Odbiór wzrokiem (Finance na `demo.consultify.ai`)

- PERIOD pokazuje `FY2014`, nigdzie `Thu Dec 31 …`;
- Statements: jeden pakiet `Atelier Toys`, READY, komplet P&L / BS / CF;
- Analysis: `Atelier Toys — FY2014 Baseline Financial Analysis`, APPROVED;
- Models: `Atelier Toys — Transformation 2015 ROI`, źródło = pakiet FY2014,
  zero `(kopia)`, zero DBR77/Apator;
- Value Office: jawny komunikat „not available in demo mode" — silnik jest
  zdrowy, blokuje go bramka read-only (allowlista to osobna decyzja, `FIN-006`);
- próba zapisu nadal daje `Demo mode is read-only`.

Werdykt: `GO / FIX / NO-GO`.

---

## 8. Czego ta gałąź NIE zrobiła

Deployu · migracji · `--write` · `--rollback` · żadnej mutacji `demo` ·
żadnego kontaktu z `production` ani `consultify.ai` · pusha ani merge'a.
