# Tabela (Ideas) — Handoff Master

**Data:** 2026-07-04 · **Status:** SSOT dla agentów przejmujących narzędzie Tabela/Ideas (tablePlatform + IdeaTableTool)
**Poprzedzające dokumenty (przeczytaj jeśli chcesz pełny detal):**
- [`_AUDYT_I_PLAN_DOKONCZENIA.md`](./_AUDYT_I_PLAN_DOKONCZENIA.md) — audyt wyjściowy (0-2), plan fal F0–F5 (3), postęp §3bis, ryzyka (4)
- [`PRZEWODNIK_TESTOW_MANUALNYCH.md`](./PRZEWODNIK_TESTOW_MANUALNYCH.md) — scenariusze testów manualnych B/C/D + setup środowiska

Ten dokument jest **wejściem jednopunktowym** — nie musisz czytać dwóch powyższych od zera, chyba że potrzebujesz dowodów źródłowych/commitów per zadanie.

---

## 1. Stan na 2026-07-04

- Gałąź robocza: `feat/tp-fala1`, HEAD `8e268467a7`, pin startowy `ef56f42092` (= `integration/harvard-noc`).
- **NIEZDEPLOYOWANE** — czeka na akceptację Piotra. Demo (`origin/demo`) i prod (centerbeam) **NIETKNIĘTE**.
- Testy: **1721/1721 zielone** (140 plików: FE `src/components/MyWork/table/__tests__` + BE `server/src/services/tablePlatform/__tests__` + `server/src/routes/__tests__` + `tests/integration/table-platform`).
  Komenda:
  ```
  npx vitest run src/components/MyWork/table/__tests__ server/src/services/tablePlatform/__tests__ server/src/routes/__tests__ tests/integration/table-platform --testTimeout=25000
  ```
- Skala: 56 commitów, +~12,4k linii, 38 nowych plików testowych.

---

## 2. Architektura (2 stosy)

- **IdeaTableTool (M08)** = narzędzie w kanwie Ideas/My Work (`src/components/MyWork/table/`, ~146 plików). Persystencja **LEGACY** = blob JSON w `my_ideas`/`my_idea_maps.extensions_json` (przez map-sync `useTablePersistence.ts`). To dlatego tabele-idee **NIE mają wiersza w `tp_tables`**.
- **tablePlatform (tp_*)** = backend klasy Airtable (`server/src/services/tablePlatform/`, ~41k linii, 44+ tabel `tp_*`, trasy `/api/table-platform` w `server/src/routes/table-platform*.routes.ts`).
- **Most:** `useTablePlatformBridge` za flagą `ENABLE_TABLE_PLATFORM_METADATA_FIRST` (domyślnie OFF) — Decyzja #5 „dual-stack zostaje". Panele AuditTrail/ActivityFeed są **UKRYTE** w trybie legacy (prop `isPlatformTable=false`), bo endpointy audytu wymagają `tp_tables.id`, którego idea nie ma → było 403.

Szczegóły inwentarza (pola/widoki/serwisy/dokumentacja) — patrz §1 audytu.

---

## 3. Co dostarczono — Fale 1-4

**Fala 1 (BE/bezpieczeństwo):**
- Weryfikacja adwersaryjna P1-P6 (**Opus**) — potwierdziła solidność P2/P1b/P3/P5, wykryła 5 realnych luk (2× wyciek danych P0).
- P7 inbox `tp_notifications` + dzwonek NotificationBell (**Opus**).
- Storage S3-za-flagą + fix cichego buga miniatur = kolumna `thumbnails` (**Opus**).
- 145 testów bezpieczeństwa (**Sonnet**).
- 88 testów HTTP tras (**Sonnet**).
- FIX 2× wyciek P0 `filterByFormula` + `executeQuery` maskowanie (**Opus**).
- userRole na WSZYSTKICH mutacjach create/delete/batch/bulk + kaskada dat create/delete (**Sonnet**).
- Tranzytywna kaskada rollup A→B→C (**Opus**).

**Fala 2 (UI):**
- Realtime→stan z echo-protection (**Opus**).
- Automatyzacje „Uruchom teraz" naprawione dla wszystkich typów triggera = był tylko cron (**Sonnet**).
- 4 przyciski M08 — Import naprawiony (zły mount API) / AuditTrail+ActivityFeed ukryte legacy / Snapshot martwy (**Sonnet**).
- UI komentarzy + bug `author_id` = fałszywy alarm (**Sonnet**).

**Fala 3 (widoki/formularze):**
- Matrix crosstab + Chart podpięty + StickyNote odpięty + Galeria filtr/sort (**Sonnet**).
- Publiczny widok honoruje config + serwerowe cięcie ukrytych pól (**Sonnet**).
- Lookup UI + lightbox załączników (**Sonnet**).
- Naprawa 4 testów grida (root cause = fixture bez `formatRules`, NIE regresja) + undo/redo platform (**Sonnet**).
- Formularze redirect+styling — pierwotnie **Haiku ODRZUCONY** (false-green), przepisany **Sonnetem**.

**Fala 4 (domknięcie):**
- `buildGroupQuery` leak — projekcja `jsonb_build_object` + maskowanie per grupa (**Opus**).
- `useMemo` freeze w bridge (**Sonnet**).
- Test-pollution = realny race asercji bez `waitFor` pod `fileParallelism` (**Sonnet**, `8e268467a7`).

Pełna tabela commitów per zadanie fali 1 (P1-P6, tabela SHA) — §1.1 i §3bis audytu.

---

## 4. E2E na staging — ZWERYFIKOWANE

Pełny stack `feat/tp-fala1` × staging DB (trolley.proxy.rlwy.net, **NIE prod**). Migracja `788_tp_notifications` realnie utworzyła tabelę (SQL: 10 kolumn `id/org_id/user_id/base_id/table_id/record_id/type/payload/read_at/created_at`).

Endpointy P7 zweryfikowane:
- `GET /api/table-platform/notifications` → 200 `{notifications:[],total:0,unreadCount:0}`
- `POST /read-all` → 200
- auth bez tokenu → 401

Login: `piotr.wisniewski@dbr77.com` / `123456`.

---

## 5. Jak wznowić środowisko testowe (dokładne komendy)

**Backend:**
```
WT=<worktree>/tp-fala1
cp <main>/.env <main>/.env.staging.local "$WT/"        # sekrety — usuń po testach
cd "$WT/server" && PORT=3001 DB_TYPE=postgres DB_MANAGED_SCHEMA=off \
  DOTENV_IGNORE_LOCAL=1 ENV_FILE="$WT/.env.staging.local" DISABLE_SCHEDULER=true \
  npx tsx watch src/index.ts
```
Czekaj na: `✅ Server running on http://0.0.0.0:3001` + `Table Platform migrations: … applied`.
**USUWAJ skopiowane `.env`/`.env.staging.local` z worktree po testach (sekrety).**

**Frontend:** launch.json konfiguracja `tp-fala1-fe-local` (FE → localhost:3001).

**Dojście do tabeli:** sidebar My Work → Ideas → idea `M08-Manual-Test-Table-2026-06-21` → Open → narzędzie Table.

Pełny zestaw scenariuszy testowych B (regresja)/C (nowe funkcje)/D (bezpieczeństwo) + kryteria zamknięcia — patrz `PRZEWODNIK_TESTOW_MANUALNYCH.md` w całości; nie duplikuję tu tabel scenariuszy, tylko wskazuję gdzie są.

---

## 6. Decyzje oczekujące na Piotra (BLOKUJĄ promocję)

- **D-A**: most Ideas↔tablePlatform (flaga `ENABLE_TABLE_PLATFORM_METADATA_FIRST`) — włączyć platform-first? Od tego zależy odblokowanie paneli audytu (AuditTrail/ActivityFeed obecnie ukryte w trybie legacy, bo idea nie ma wiersza `tp_tables`).
- **D-B**: zakres enterprise (SCIM/SSO/service accounts/governed models) — rozwijać czy zamrozić jako „latent".
- **D-C**: zgoda na promocję `feat/tp-fala1` → `demo` (cherry-pick zakresowy `server/src/services/tablePlatform` + `src/components/MyWork/table`). **Demo = ŚWIĘTE**, tylko po akceptacji Piotra na zrzutach (protokół nocy 3/4.07).

---

## 7. Backlog (nie-blokery)

- 2 równoległe ViewRoutery (`views/` vs top-level).
- PAT scope method-based (nie per-endpoint).
- Osierocony reverse-field przy `deleteField`.
- Niespójny ownership-guard w trasach (część lokalny+serwis, część tylko serwis).
- `testConnection` konektorów bez endpointu serwerowego.

(Rozszerzona lista długu technicznego wykrytego po drodze — §3bis audytu, akapit „Backlog wykryty po drodze".)

---

## 8. Zasady pracy (lekcje tej sesji)

**Model:**
- Opus = trudne/bezpieczeństwo/współbieżność.
- Sonnet = wiring/testy.
- Haiku = **NIE UŻYWAĆ** do niczego wymagającego weryfikacji (dał false-green na F3-B formularze).
- Fable = nadzór.

**Twarde zasady:**
- Izolacja worktree per robotnik.
- **ZAKAZ `git stash`** (współdzielony między worktree = incydent).
- **ZAKAZ subagentów u robotników**.
- Rozłączna własność plików per zadanie.
- Merge-base audyt każdego robotnika przed scaleniem.
- Skopowane testy (nie pełny `vitest`/`tsc` — maszyna Piotra obciążona).
- `git add -f` dla nowych plików pod `tests/` (gitignored — patrz `.gitignore:209`).
- **Zawsze self-audit na realnych danych** (anty-false-green) — nigdy nie uznawaj zadania za zamknięte tylko dlatego, że testy jednostkowe przechodzą; sprawdź efekt na prawdziwych rekordach/requestach.

---

## 9. Nawigacja po dokumentach źródłowych

| Potrzebujesz | Idź do |
|---|---|
| Pełny inwentarz kodu (pola, widoki, serwisy, 28 dok.) | `_AUDYT_I_PLAN_DOKONCZENIA.md` §1 |
| Lista luk krytyczne/wysokie/średnie/decyzyjne (B1-B21, D-A/B/C) | `_AUDYT_I_PLAN_DOKONCZENIA.md` §2 |
| Plan fal F0-F5 + macierz przydziału agentów | `_AUDYT_I_PLAN_DOKONCZENIA.md` §3 |
| Postęp fala po fali z commitami/liczbą testów | `_AUDYT_I_PLAN_DOKONCZENIA.md` §3bis |
| Ryzyka programu | `_AUDYT_I_PLAN_DOKONCZENIA.md` §4 |
| Scenariusze testów manualnych B/C/D krok po kroku | `PRZEWODNIK_TESTOW_MANUALNYCH.md` §B/C/D |
| Setup środowiska testowego (komendy) | `PRZEWODNIK_TESTOW_MANUALNYCH.md` §A |
| Kryteria zamknięcia + znane ograniczenia | `PRZEWODNIK_TESTOW_MANUALNYCH.md` §E/F |
