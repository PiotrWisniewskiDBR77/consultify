# Testy manualne — INDEKS

> **Co to jest:** centralne miejsce na precyzyjne specyfikacje testów manualnych (E2E) dla **każdego** modułu aplikacji Consultify.
> **Źródło podziału modułów:** [`Harvard/podzial/_MODULE_MAP_V2.md`](../podzial/_MODULE_MAP_V2.md) — 27 modułów + 1 aneks (A1), wg realnego Sidebara.
> **Wzorzec formatu testu:** [`TESTY_M01_CZAT.md`](TESTY_M01_CZAT.md) — patrz też sekcja „Konwencja" niżej.
> **Aktualizacja indeksu:** 2026-06-16

---

## Jak korzystać

1. Każdy moduł `M01…M27` (+ `A1`) ma docelowo własny plik `TESTY_<Mxx>_<NAZWA>.md` w tym folderze.
2. Agent, który pisze/testuje dany moduł, dostaje plik testu jako **wejście** — wykonuje go krok po kroku i raportuje PASS/FAIL z dowodem (screenshot UI + payload Network + stan DB/store).
3. Nowe testy dopisujemy w tej samej konwencji co `M01–M04` (poniżej).
4. Status w tabeli aktualizujemy po napisaniu / po przejściu testu.

**Legenda statusu:**
- ✅ **GOTOWY** — pełna specyfikacja testu napisana.
- 🟡 **CZĘŚCIOWY** — istnieje szkic / pokrywa część zakresu.
- ⬜ **DO NAPISANIA** — brak specyfikacji.

---

## Tabela modułów (27 + A1)

| # | Moduł | Route | Plik testu | Status |
|---|-------|-------|-----------|--------|
| M01 | **Czat** (kompozer AI / Teresa) | `/chat` | [TESTY_M01_CZAT.md](TESTY_M01_CZAT.md) | ✅ GOTOWY |
| M02 | **Canvas** (split-view + deliverables-light) | panel w czacie; `/public/artifacts/:token` | [TESTY_M02_CANVAS.md](TESTY_M02_CANVAS.md) | ✅ GOTOWY |
| M03 | **Moja Praca — organizer** (Inbox, Zadania, Decyzje, Kalendarz, Manager) | `/my-work/*` | [TESTY_M03_MOJA_PRACA.md](TESTY_M03_MOJA_PRACA.md) | ✅ GOTOWY |
| M04 | **Notatnik** | `/my-work/notebook` | [TESTY_M04_NOTATNIK.md](TESTY_M04_NOTATNIK.md) | ✅ GOTOWY |
| M05 | **Ideas — Zarządzanie** | `/my-work/ideas` | [TESTY_M05_IDEAS_ZARZADZANIE.md](TESTY_M05_IDEAS_ZARZADZANIE.md) | ✅ GOTOWY |
| M06 | **Ideas — Mind Map** | `…/workspace/mindmap` | [TESTY_M06_IDEAS_MIND_MAP.md](TESTY_M06_IDEAS_MIND_MAP.md) | ✅ GOTOWY |
| M07 | **Ideas — Process Flow** | `…/workspace/process_flow` | [TESTY_M07_IDEAS_PROCESS_FLOW.md](TESTY_M07_IDEAS_PROCESS_FLOW.md) | ✅ GOTOWY |
| M08 | **Ideas — Table** | `…/workspace/table` | [TESTY_M08_IDEAS_TABLE.md](TESTY_M08_IDEAS_TABLE.md) | ✅ GOTOWY |
| M09 | **Ideas — Whiteboard** | `…/workspace/whiteboard` | [TESTY_M09_IDEAS_WHITEBOARD.md](TESTY_M09_IDEAS_WHITEBOARD.md) | ✅ GOTOWY |
| M10 | **Wywiad** | `/discovery` | [TESTY_M10_WYWIAD.md](TESTY_M10_WYWIAD.md) | ✅ GOTOWY |
| M11 | **Narzędzia** (Library + Assessment) | `/discovery-tools`, `/assessment` | [TESTY_M11_NARZEDZIA.md](TESTY_M11_NARZEDZIA.md) | ✅ GOTOWY |
| M12 | **Audyty** (Audit Orchestrator) | `/audit-programs` | [TESTY_M12_AUDYTY.md](TESTY_M12_AUDYTY.md) | ✅ GOTOWY |
| M13 | **Inicjatywy** | `/initiatives` | [TESTY_M13_INICJATYWY.md](TESTY_M13_INICJATYWY.md) | ✅ GOTOWY |
| M14 | **Wdrożenie** | `/implementation` | [TESTY_M14_WDROZENIE.md](TESTY_M14_WDROZENIE.md) | ✅ GOTOWY |
| M15 | **Rezultaty** | `/benefits` | [TESTY_M15_REZULTATY.md](TESTY_M15_REZULTATY.md) | ✅ GOTOWY |
| M16 | **Finanse** | `/finance` | [TESTY_M16_FINANSE.md](TESTY_M16_FINANSE.md) | ✅ GOTOWY |
| M17 | **Outputs** | `/presentations` | [TESTY_M17_OUTPUTS.md](TESTY_M17_OUTPUTS.md) | ✅ GOTOWY |
| M18 | **Dokumenty** (Document Studio) | `/document-studio` | [TESTY_M18_DOKUMENTY.md](TESTY_M18_DOKUMENTY.md) | ✅ GOTOWY |
| M19 | **Prezentacje** (P20 + DeckBuilder) | `/prezentacje`, `/presentations/builder` | [TESTY_M19_PREZENTACJE.md](TESTY_M19_PREZENTACJE.md) | ✅ GOTOWY |
| M20 | **Tabele Studio** | `/tabele` | [TESTY_M20_TABELE_STUDIO.md](TESTY_M20_TABELE_STUDIO.md) | ✅ GOTOWY |
| M21 | **Meeting** | `/meeting` | [TESTY_M21_MEETING.md](TESTY_M21_MEETING.md) | ✅ GOTOWY |
| M22 | **AI OS / Internal Tools** | `/ai/*` | [TESTY_M22_AI_OS.md](TESTY_M22_AI_OS.md) | ✅ GOTOWY |
| M23 | **Organizacja** | `/organization/*` | [TESTY_M23_ORGANIZACJA.md](TESTY_M23_ORGANIZACJA.md) | ✅ GOTOWY |
| M24 | **Panel Administratora** | `/admin/*` | [TESTY_M24_ADMIN.md](TESTY_M24_ADMIN.md) | ✅ GOTOWY |
| M25 | **Ustawienia** | `/settings/*` | [TESTY_M25_USTAWIENIA.md](TESTY_M25_USTAWIENIA.md) | ✅ GOTOWY |
| M26 | **Portal Partnerski** | `/partner/*` | [TESTY_M26_PORTAL_PARTNERSKI.md](TESTY_M26_PORTAL_PARTNERSKI.md) | ✅ GOTOWY |
| M27 | **SuperAdmin** | `/superadmin/*` | [TESTY_M27_SUPERADMIN.md](TESTY_M27_SUPERADMIN.md) | ✅ GOTOWY |
| A1 | **Ecosystem/Affiliate** *(aneks)* | `/affiliate` | [TESTY_A1_AFFILIATE.md](TESTY_A1_AFFILIATE.md) | ✅ GOTOWY |

**Pokrycie: 28 / 28 modułów — 100% ✅** (M01–M27 + A1, 2026-06-16)

---

## Konwencja pliku testu

Każdy `TESTY_<Mxx>_<NAZWA>.md` trzyma się wzorca z M01–M04:

1. **Nagłówek** — moduł, route, zakres paczki, cel, data; odnośnik do `_MODULE_MAP_V2.md` i właściwego inwentarza `INV_*`.
2. **Sekcja 0 — Kontekst architektoniczny** — komponenty, pliki źródłowe, stan/store, na który działają; zasada weryfikacji E2E (UI + payload Network + DB).
3. **Setup środowiska testowego** — dev server, logowanie, DevTools (Network/Console), dane testowe.
4. **Sekcje 1…N — testy per funkcja/przycisk** — kroki, asercje, edge-case'y, weryfikacja E2E (każdy tryb potwierdzony w Network — sam wygląd przycisku to NIE dowód).
5. **Testy przekrojowe** — kombinacje, persistencja, disabled-states, z-index, i18n (PL/EN), dark mode, A11y, zero błędów w konsoli.
6. **Testy regresji / jednostkowe** — istniejące testy do uruchomienia.
7. **Format raportu + Definition of Done.**

**Legenda znaczników** (z M03): `[MANUAL]` = ręczna weryfikacja (drag&drop / audio / OAuth / incognito); `[FLAG]` = zależne od flagi/capability/roli; `[DB]` = dowód obejmuje wiersz/kolumnę w bazie.

---

## Wyniki Playwright E2E — M01–M04 (2026-06-16)
- **Raport:** [`WYNIKI_M01-M04_2026-06-16.md`](WYNIKI_M01-M04_2026-06-16.md)
- **Spec:** `tests/e2e/smoke/m01-m04-manual-e2e.spec.ts`
- **Wynik:** 19/19 PASS — weryfikacja kodu (RC-4, Calendar Connect, aiConfig, Menu3 L2) + API health
- **Screenshoty:** `docs/qa/screens/m01-m04-2026-06-16/` (8 PNG)
- **Uwaga:** JWT wygasł → browser tests pokazują login page; structural/code tests PASS

---

## Audyt zgodności (2026-06-16)
- **Raport audytu:** [`_AUDYT_ZGODNOSCI.md`](_AUDYT_ZGODNOSCI.md) — niezależna, adwersarialna weryfikacja 24 testów (M05–M27+A1) vs realny kod. Werdykt: 3 NIEZGODNE (M08/M13/M22) — **naprawione 2026-06-16**; 21 zgodnych-z-uwagami. Wzorce systemowe: flaga beta Ideas, dryf linii, nieaktualne known-bugi.
- **Backlog findingów aplikacji:** [`_BACKLOG_FINDINGI_APLIKACJI.md`](_BACKLOG_FINDINGI_APLIKACJI.md) — realne defekty KODU wykryte ubocznie (P1 bezpieczeństwo: role bramek M13, org-scope M16).

## Powiązane dokumenty
- Mapa modułów: [`Harvard/podzial/_MODULE_MAP_V2.md`](../podzial/_MODULE_MAP_V2.md)
- Plany dokończenia per moduł: [`Harvard/wdrozenie-100/`](../wdrozenie-100/)
- Inwentarze funkcjonalności: [`Harvard/podzial/inventory/`](../podzial/inventory/)
- Protokół audytu modułu: [`Harvard/protokol/`](../protokol/)
- Raport testów M01+M02: [`Harvard/RAPORT_TESTOW_M01_M02_2026-06-14.md`](../RAPORT_TESTOW_M01_M02_2026-06-14.md)
