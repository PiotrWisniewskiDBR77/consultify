# Tabela (Ideas) — Przewodnik testów manualnych całości

**Wersja:** feat/tp-fala1 (Fale 1–4) · **Data:** 2026-07-04 · **Dla:** Piotr
**Cel:** przetestować całość narzędzia Tabela po dokończeniu — nowe funkcje, naprawy, bezpieczeństwo.

> Legenda: 🆕 = nowa funkcja tej pracy · 🔧 = naprawiona · 🔒 = bezpieczeństwo · [BE] wymaga naszego backendu (nie demo).

---

## A. Uruchomienie środowiska testowego

Środowisko = frontend z naszej gałęzi + nasz backend + staging DB (NIE prod, NIE demo). Migracja `788_tp_notifications` jest już na staging.

**Backend** (jeden terminal):
```
WT=<worktree>/tp-fala1
cp <main>/.env <main>/.env.staging.local "$WT/"        # sekrety — usuń po testach
cd "$WT/server" && PORT=3001 DB_TYPE=postgres DB_MANAGED_SCHEMA=off \
  DOTENV_IGNORE_LOCAL=1 ENV_FILE="$WT/.env.staging.local" DISABLE_SCHEDULER=true \
  npx tsx watch src/index.ts
```
Czekaj na: `✅ Server running on http://0.0.0.0:3001` + `Table Platform migrations: … applied`.

**Frontend:** uruchom konfigurację `tp-fala1-fe-local` (launch.json — FE → localhost:3001).

**Logowanie:** `piotr.wisniewski@dbr77.com` / `123456`. Badge w rogu musi pokazywać `LOCAL @<sha naszego commita>` (potwierdza, że to nasz kod, nie demo).

**Dojście do tabeli:** sidebar **My Work** → zakładka **Ideas** → otwórz ideę `M08-Manual-Test-Table-2026-06-21` → **Open** → w kanwie wybierz narzędzie **Table**.

---

## B. Scenariusze — rdzeń tabeli (regresja)

| # | Scenariusz | Kroki | Oczekiwane |
|---|---|---|---|
| B1 | Grid renderuje dane | Otwórz tabelę | 5 wierszy (Alpha…Epsilon), kolumny #/Type/Label/Status/Priority |
| B2 | Conditional formatting | Popatrz na Status/Priority | Kolory: Done=zielony, Blocked=czerwony, In Progress=żółty; high/low zróżnicowane |
| B3 | Edycja komórki | Zmień Status wiersza, odczekaj | „Saved …s ago"; po reloadzie zmiana trwa |
| B4 | Dodaj wiersz | „+ New" | Nowy wiersz, zapisuje się |
| B5 | Filtry/sort/grupy | Panel filtrów | Lista respektuje filtr; sort działa |

---

## C. Scenariusze — nowe funkcje

### C1 🆕 Widok Matrix (crosstab)
1. Dodaj/przełącz widok typu **Matrix**. 2. Wybierz pole osi X i Y (np. Status × Priority). 3. Kliknij niepustą komórkę.
**Oczekiwane:** siatka przecięć z licznikami rekordów; klik komórki → popover z listą rekordów w tym przecięciu.

### C2 🆕 Widok Chart
1. Dodaj widok typu **Chart** (był wcześniej niepodpięty). 2. Skonfiguruj oś/serię.
**Oczekiwane:** wykres (bar/line/pie) renderuje dane tabeli; typ widoku zapisuje się.

### C3 🆕 Galeria — filtr i sort
1. Widok **Gallery**. 2. Użyj przycisku Filter + selektu sortowania.
**Oczekiwane:** karty filtrowane/sortowane; osobny komunikat „brak wyników dla filtrów" vs „brak rekordów".

### C4 🆕 [BE] Inbox powiadomień (dzwonek)
1. Znajdź dzwonek w pasku tabeli (badge z liczbą nieprzeczytanych). 2. Rozwiń listę. 3. „Oznacz wszystkie jako przeczytane".
**Oczekiwane:** dropdown listy; badge znika po mark-all. (Pusty inbox = 0 to poprawny stan startowy.)
**Dowód API (opcjonalnie):** `GET /api/table-platform/notifications` → 200 `{notifications, total, unreadCount}`.

### C5 🆕 [BE] Komentarze + @mention
1. Otwórz szczegóły rekordu (RowDetailPanel). 2. Sekcja Komentarze → dodaj komentarz z `@`. 3. Edytuj/usuń własny.
**Oczekiwane:** komentarz na liście (autor, czas); edycja/usuwanie tylko własnych; @mention zasila inbox (C4).

### C6 🆕 [BE] Automatyzacje — „Uruchom teraz" + historia
1. Automations → utwórz automatyzację typu record_updated. 2. „Uruchom teraz". 3. Otwórz Historię uruchomień.
**Oczekiwane:** toast wyniku; **działa dla WSZYSTKICH typów** (wcześniej tylko cron); historia pokazuje status/czas/błąd. 🔧

### C7 🆕 Realtime sync (2 sesje)
1. Otwórz tę samą tabelę w 2 kartach (obie zalogowane). 2. W karcie A zmień komórkę.
**Oczekiwane:** karta B aktualizuje się **bez odświeżania**; brak dublowania własnych zmian (echo-protection).

### C8 🆕 Undo/redo
1. Dodaj/zmień/usuń wiersz. 2. Undo (Ctrl+Z / przycisk). 3. Redo.
**Oczekiwane:** undo cofa operację (create→delete, delete→recreate, update→poprzednia wartość); redo przywraca.

### C9 🆕 Lookup — konfiguracja pola
1. Dodaj pole typu **Lookup**. 2. Wybierz pole linkujące + pole docelowe.
**Oczekiwane:** kreator jak przy rollup; wartość lookup pojawia się w kolumnie.

### C10 🆕 Załączniki — podgląd/lightbox
1. Rekord z załącznikiem-obrazem. 2. Kliknij miniaturę.
**Oczekiwane:** miniatura dla obrazów; klik → lightbox (ESC/klik zamyka); PDF → ikona + otwórz w nowej karcie.

### C11 🆕 Formularz publiczny — redirect + styling
1. Formularz z `redirectUrl` (http/https) i `accentColor`. 2. Wyślij.
**Oczekiwane:** po ~1,5 s przekierowanie na URL; `javascript:`/`data:` ignorowane 🔒; kolor akcentu i logo zastosowane.

### C12 🆕 Import (naprawiony)
1. Toolbar → Import (CSV/Sheets).
**Oczekiwane:** brak 404 (był zły mount API); konektory ładują się. 🔧

---

## D. Scenariusze — bezpieczeństwo 🔒 [BE]

| # | Scenariusz | Oczekiwane |
|---|---|---|
| D1 | Panele audytu w trybie legacy | AuditTrail/ActivityFeed **ukryte** w tabeli-idei (nie pokazują błędu 403 — idea nie ma wiersza tp_tables) 🔧 |
| D2 | Inbox bez tokenu | `GET /notifications` bez auth → **401** (nie 200, nie wyciek) |
| D3 | Uprawnienia pola | Widok/lista z rolą bez odczytu pola X → pole X **nieobecne** w danych (maskowanie na wszystkich ścieżkach: get/list/**widok**/**grupowanie**) |
| D4 | Uprawnienia mutacji | Zapis w zabronione pole przez create/delete/batch/bulk → **odrzucony** (wcześniej tylko pojedynczy PATCH pilnował) |
| D5 | filterByFormula | Błędna składniowo formuła filtra → **błąd 400**, NIE zwraca całej tabeli (fail-closed) |
| D6 | Publiczny widok współdzielony | Ukryte pola widoku **nie wyciekają** w odpowiedzi publicznej; filtry/sorty/grupy widoku respektowane |
| D7 | SAML / run_script | SAML bez podpisu odrzucony; automatyzacja run_script wyłączona (flaga OFF) |

---

## E. Kryteria zamknięcia
- Wszystkie B (regresja) zielone.
- C1–C12: każda funkcja zadziałała wg „Oczekiwane" (zrzut + krótka notatka).
- D1–D7: bezpieczeństwo potwierdzone.
- Automatyczna siatka: **testy jednostkowe/integracyjne 100% zielone** (patrz _AUDYT_I_PLAN §3bis).

## F. Znane ograniczenia (nie-blokery)
- Test-pollution w suite naprawiany osobno (funkcja undo/redo działa).
- Dług: dwa równoległe ViewRoutery, PAT scope method-based, osierocony reverse-field @deleteField — w backlogu, nie blokuje testów.
- Most Ideas↔tablePlatform (flaga OFF) — panele audytu odblokują się dopiero po decyzji D-A.
