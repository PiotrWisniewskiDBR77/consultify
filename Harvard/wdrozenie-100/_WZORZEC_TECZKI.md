# WZORZEC TECZKI MODUŁU — kanoniczny SSOT dokumentacji

**Status:** SSOT. Każdy moduł (`Harvard/wdrozenie-100/MXX-*.md`) MUSI mieć komplet 8 warstw wg tego wzoru.
**Po co:** Harvard wyprodukował dokumenty (karta + log), ale „nie dowiózł", bo brakowało stanu docelowego i wymuszenia kompletności — uwagi z testów żywych wypadały poza plan. Ten wzór to naprawia.

---

## 0. Zasada nadrzędna

**LUKA = STAN DOCELOWY − STAN OBECNY.** Najpierw definiujemy docelowy (warstwy A–E), dopiero wtedy luka liczy się sama. Dokumentacja luk bez docelowego = liczenie „na oko".

**Łańcuch śledzenia (traceability) — zero sierot:**
> INTENCJA (A) → STAN DOCELOWY (B–E) → EPIK/STORY (F) → LUKA (H) → KRYTERIUM DoD (G) → DOWÓD (G)

Każde ogniwo linkuje do następnego. Każde wejście ma lukę (lub jawne „odrzucone, bo…"); każda luka ma kryterium odbioru; każde kryterium ma dowód.

## 0a. Reguły kompletności (bramka teczki — R1–R6)

- **R1 — Pełne wejścia:** przejrzane i podpisane WSZYSTKIE źródła: karta audytu · uwagi z testów żywych · SPEC-i · formuły/standardy · feedback prod · decyzje produktowe.
- **R2 — Zero sierot:** wejście→luka (lub odrzucone), luka→DoD, DoD→dowód.
- **R3 — Dowód > dziedziczenie:** status „naprawione/STALE" ważny TYLKO po weryfikacji w kodzie/żywo (karty zawyżają ~1 na 7).
- **R4 — DoD mierzalne:** liczby/testy, nie przymiotniki.
- **R5 — Decyzje z właścicielem i terminem.**
- **R6 — Pętla odkrywania:** po wykonaniu → sesja żywa → nowe uwagi wracają do Rejestru Wejść. 100% to stan utrzymywany, nie jednorazowy przebieg.

---

# STRUKTURA TECZKI — 8 WARSTW (szkielet do skopiowania)

> Skopiuj poniższe do `MXX-nazwa.md`. Wypełnij każdą sekcję. Puste „TODO" = teczka niekompletna.

## 00 · Nagłówek / metryka
```
Moduł · Pula · Ocena /100 · Tier · Status (faza) · WŁAŚCICIEL · Daty · Linki do kodu i teczek powiązanych
```

---

## A · INTENCJA / PRODUKT
*Po co ten moduł istnieje. Bez tego optymalizujemy nie to co trzeba.*
- **Job-to-be-done** (1 zdanie): jaką pracę użytkownika wykonuje.
- **Persony i role**: kto używa (konsultant / klient / admin / superadmin) i co każda rola może.
- **Zakres v1** (lista) **vs POZA zakresem** (jawna lista „tego nie robimy").
- **Metryka wartości**: po czym poznamy, że moduł daje wartość klientowi.

## B · UI/UX — STAN DOCELOWY
*Jak skończony moduł wygląda i zachowuje się. Nie „co zepsute" — „jak ma być".*
- **Layout / wireframe** głównego ekranu (opis lub szkic).
- **Stany ekranu**: pusty · ładowanie · błąd · pełny · brak-uprawnień (każdy z komunikatem, koniec „cichych pustek").
- **Interakcje / mikro-flow**: Menu 1/2/3, skróty, drag&drop, undo, preview.
- **Treść i język**: copy PL/EN, ton Teresy, komunikaty błędu/pustki.
- **Zgodność z systemem**: Visual Standard · tokeny · `EntityStatusChip` · §27 (`TABLE_AND_PREVIEW_CANON.md`).
- **Dostępność (a11y)**: kontrast, klawiatura, ARIA. **Responsywność + dark mode.**

## C · DANE + API + REGUŁY (kontrakt)
*Twarda warstwa techniczna stanu docelowego.*
- **Model danych**: encje, tabele/migracje, pola, typy (pułapki bigint/jsonb → `pgFlags.ts`).
- **Kontrakt API**: endpointy (metoda, ścieżka), request/response, kody błędów, **auth/RBAC + org-scope** (na każdym endpoincie — żeby IDOR nie wracał).
- **Reguły biznesowe**: maszyna stanów + przejścia, **bramki, kto-co-zatwierdza**, walidacja.

## D · AI / TERESA
*Co AI robi w tym module i według jakiego standardu.*
- **Co generuje** i wg jakiej **formuły** (`CARD_CONTENT_FORMULA` / `INITIATIVE_FORMULA`).
- **Sterowanie**: function-calling / intencje (kręgosłup), granice persony („nie udawaj wykonania").
- **Wejścia kontekstu**: co Teresa widzi (sourceRefs, workspaceContext, RAG).

## E · INTEGRACJE — mapa połączeń
*Jak moduł jest spięty z resztą platformy.*
- **Wejścia ←** (z których modułów) / **Wyjścia →** (do których).
- **Kontrakt zdarzeń / deep-linki / handoffy**: `deliverables:draft-ready`, `?open=…`, ścieżki konwersji.
- **Wspólna warstwa (kręgosłup)**: czy używa `UnifiedChatPanel` / `WorkCanvasDocumentPanel` / `RightRail` / wspólnych store'ów.
- **Zależności blokujące**: co musi być pierwej (z innych teczek).

## F · EPIKI → STORIES → ZADANIA
*Most między stanem docelowym (A–E) a robotą.*
```
EPIK 1: <blok wartości realizujący fragment A–E>
  Story 1.1: jako <rola> chcę <cel>, aby <wartość>
     Kryteria akceptacji (Gherkin): dane <X> · gdy <Y> · wtedy <Z>
     Zadania: [Z-01 → luka L-…], [Z-02 → luka L-…]
```
Każda story domyka fragment docelowego; każde zadanie linkuje do ID luki (warstwa H).

## G · JAKOŚĆ / WERYFIKACJA
*Jak udowadniamy „gotowe".*
- **DoD skwantyfikowane** (6 kryteriów z liczbami):

  | # | Kryterium | Miara dla TEGO modułu |
  |---|-----------|----------------------|
  | 1 | Front↔back | 0 fasad, 0 martwych CTA (lista) |
  | 2 | Bezpieczeństwo | 0 żywych P0/P1; testy IDOR: … |
  | 3 | i18n | 0 z **N** `isPolish`/hardkodów |
  | 4 | Tokeny | 0 z **N** hex / korupcji rose |
  | 5 | §27 | **X/Y** tabel przez FilterableTable |
  | 6 | E2E w PR-gate | scenariusze S… zielone na Londyn |
- **Scenariusze testowe S1…Sn** + plan E2E + gdzie dowody (`evidence/f4_*`).
- **Bezpieczeństwo/prywatność**: cross-org, PII, szyfrowanie sekretów, share/revoke.
- **Wydajność/limity**: N+1, paginacja, budżety AI, rozmiary uploadów.
- **Telemetria / metryki sukcesu**: jak poznamy, że działa u klienta.

## H · GOVERNANCE / STEROWANIE
*Wymusza kompletność i utrzymanie.*

**01 · Rejestr wejść** (R1):

| ID | Źródło | Data | Treść (1 zd.) | → Luka? |
|----|--------|------|----------------|---------|
| W-01 | Karta audytu | … | … | L-… |
| W-02 | **Uwaga żywa #N** | 2026-06-13 | … | L-… / odrzucone, bo… |
| W-03 | SPEC_ZADANIE_… | … | … | L-… |
| W-04 | Formuła/standard | … | … | L-… |
| W-05 | Feedback prod | … | … | L-… |

**02 · Stan obecny (prawda kodu)** — co realne vs fasada/mock/martwe, z `plik:linia`.

**03 · Rejestr luk** (= docelowy − obecny):

| ID | Opis | Źródło (W-…) | Dowód `plik:linia` | Klasa | Warstwa | Faza | **Status** | Zweryf. dnia |
|----|------|--------------|--------------------|-------|---------|------|-----------|-------------|

Status ∈ {otwarta · naprawiona (commit) · STALE-zweryfikowane}. R3 obowiązuje.

**04 · Rejestr decyzji** (R5):

| ID | Pytanie | Opcje | **Właściciel** | **Termin** | Status |
|----|---------|-------|----------------|-----------|--------|

**05 · Flagi / rollout / beta-gating** — kto ma dostęp, kiedy włączamy.
**06 · Ryzyka i założenia.**
**07 · Log wdrożenia + re-ocena** — co zrobione, commit, data, deploy staging/prod.

---

# BRAMKA TECZKI (checklist kompletności)

- [ ] R1 — wszystkie 6 źródeł wejść przejrzane (Rejestr wejść pełny)
- [ ] R2 — zero sierot: każde wejście→luka, luka→DoD, DoD→dowód
- [ ] R3 — każdy status „naprawione/STALE" ma dowód (nie odziedziczony)
- [ ] R4 — DoD ma liczby/testy (nie przymiotniki)
- [ ] R5 — każda decyzja ma właściciela i termin
- [ ] A–E wypełnione (stan docelowy zdefiniowany, nie tylko luki)
- [ ] F — epiki/stories z kryteriami akceptacji, zadania linkują do luk
- [ ] G — DoD + scenariusze S + bezpieczeństwo + wydajność + telemetria
- [ ] R6 — zaplanowana sesja żywa po wykonaniu (nowe uwagi → Rejestr wejść)

Teczka jest „gotowa do egzekucji" dopiero przy 9/9.

---

## Jak używać
1. Skopiuj sekcje 00 + A–H do `MXX-nazwa.md`.
2. Wypełnij A–E (docelowy) → potem H/03 (luka = docelowy − obecny) policzy się sama.
3. Przejdź bramkę 9/9 przed startem implementacji.
4. Po wykonaniu: sesja żywa → nowe uwagi do H/01 → pętla (R6).
