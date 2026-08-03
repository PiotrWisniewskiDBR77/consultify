---
doc_kind: UI_COMPONENT_DOCUMENTATION_STANDARD
status: canonical_control_layer
owner: Piotr Wisniewski
last_updated: 2026-07-31
authority: docs/ui-standards/CANON.md
---

# Standard opisu pojedynczego komponentu UI/UX

## 1. Po co istnieje karta

Każda ważna rodzina komponentów otrzymuje kartę według poniższego szablonu. Karta opisuje kontrakt, a nie pojedynczy screenshot. Dzięki niej projektant, programista i agent AI rozumieją tę samą funkcję, stany i granice.

## 2. Obowiązkowa metryka

```yaml
component_id: UI-...
name: ...
family: ...
spec_status: DRAFT | NEEDS_OWNER_DECISION | APPROVED_SPEC | DEPRECATED | ARCHIVED
runtime_status: MISSING | PARTIAL | IMPLEMENTED | REFERENCE_READY | CANONICAL | DOMAIN_CANONICAL | DUPLICATE | LEGACY
contract_version: 1.0
product_owner: ...
code_owner: ...
canonical_docs: []
reference_implementations: []
known_consumers: []
last_runtime_audit: YYYY-MM-DD
```

`spec_status` opisuje wyłącznie dojrzałość kontraktu projektowego. `runtime_status` opisuje wyłącznie stan produktu. Nie wolno wyciągać wniosku o jakości implementacji z faktu zatwierdzenia dokumentu ani odwrotnie.

## 3. Obowiązkowe sekcje karty

1. **Job to be done** — problem użytkownika i wynik, nie nazwa kontrolki.
2. **Kiedy używać / kiedy nie używać** — granica wobec podobnych komponentów.
3. **Anatomia** — stałe regiony, kolejność i ich odpowiedzialność.
4. **Warianty** — tylko warianty semantyczne; zakaz wariantu nazwanego modułem bez uzasadnienia.
5. **Dane i kontrakt props/schema** — pola wymagane, opcjonalne, identyfikatory, źródło prawdy.
6. **Akcje i zdarzenia** — trigger, precondition, skutek, confirmation, read-back, audit.
7. **Stany** — initial, loading/skeleton, empty, populated, selected, editing, saving, success, partial, error, offline/degraded, read-only, no-access, archived oraz streaming, jeśli dotyczy.
8. **AI/Teresa** — dozwolone operacje, proposal/diff, źródła, approval, undo i komunikat błędu.
9. **Nawigacja** — wejście, wyjście, deep link, back, Esc, historia przeglądarki i ochrona niezapisanych zmian.
10. **Responsive** — desktop, tablet i mobile fallback; elementu nie wolno po prostu zgubić.
11. **Accessibility** — semantyka, nazwy, focus order, keyboard, screen reader/live region, kontrast i reduced motion.
12. **Visual tokens** — wyłącznie odwołania do kanonu; bez lokalnych magic values.
13. **Security/privacy** — capabilities, tenant scope, redakcja, sekrety i dane wrażliwe.
14. **Performance** — limity danych, wirtualizacja, latency budget, optimistic behavior i anulowanie.
15. **Telemetry** — zdarzenia jakości oraz zakazane vanity/employee metrics.
16. **Miejsca użycia** — moduły i ekrany; różnice domenowe muszą być jawne.
17. **Known gaps/duplicates** — implementacje konkurencyjne i plan konsolidacji.
18. **Acceptance tests** — zachowanie, visual regression dark/light, a11y, API/E2E, błędy i recovery.
19. **Evidence** — screenshoty referencyjne, testy, story/fixture i data ostatniego odbioru.
20. **Change log** — kompatybilność i migracja konsumentów.

## 3a. Wspólna podstawa sekcji 10, 12, 13 i 15 (ustanowione 2026-08-02)

Cztery sekcje karty mają **uniwersalną część wspólną**, identyczną dla każdej rodziny. Dotąd była kopiowana do wszystkich 26 kart, przez co karta wyglądała na kompletną, nie niosąc informacji specyficznej — panel adwersaryjny wykrył, że w tych sekcjach 60–100% słów było tym samym tekstem powielonym 26 razy.

**Reguła:** poniższa podstawa obowiązuje każdą rodzinę z mocy tego dokumentu. Karta **nie powtarza jej treści** — odwołuje się do niej jednym zdaniem i dopisuje **wyłącznie to, co dla tej rodziny jest inne**. Jeśli rodzina nie ma nic specyficznego do dodania w danej sekcji, karta pisze to wprost („poza podstawą z §3a brak wymagań specyficznych") zamiast wypełniać miejsce ogólnikami.

### Podstawa §10 — Responsive i zoom
Viewporty odbiorowe 1920 / 1600 / 1440 / 1280 px; 1024 px w trybie compact. 125% — obowiązkowa visual regression. 200% — pełny reflow funkcjonalny bez utraty funkcji. Przy 400% złożona powierzchnia może scrollować w dwóch osiach, ale musi oferować alternatywny widok list/detail. Żadna krytyczna akcja nie znika bez alternatywnego wejścia.

### Podstawa §12 — Visual tokens
Wyłącznie wartości z [`../00-foundation/FOUNDATION_TOKEN_CONTRACT.md`](../00-foundation/FOUNDATION_TOKEN_CONTRACT.md): Inter, skala spacingu 4 px, zdefiniowane wysokości kontrolek, radiusy, elevation, ikony Lucide i kolory semantyczne. Zero magic values. Informacja nigdy nie opiera się wyłącznie na kolorze. Crimson (`primary-*` = `#85182F`) tylko jako znak marki, Teresa albo semantyka destrukcyjna — **nigdy** fokus, stan aktywny, zaznaczenie ani CTA zwykłego modułu; fokus zawsze `--c-focus`. Uwaga interpretacyjna: nazwy rodzin kolorów Tailwinda w tym projekcie są zremapowane — patrz `FOUNDATION_TOKEN_CONTRACT.md` §7.1 (CENTRAL REMAP).

### Podstawa §13 — Security i privacy
Capability i tenant scope są egzekwowane **po stronie serwera**; UI nigdy nie jest jedyną bramką. UI nie ujawnia nazw ani istnienia obiektów, do których użytkownik nie ma dostępu. Logi i telemetryka nie przechowują sekretów ani treści klienta bez jawnej polityki.

### Podstawa §15 — Telemetry
Mierzymy: load, error, retry, completion, abandonment, undo, validation failure i latency. Event niesie component ID i action ID — **nigdy** treść klienta. Zakazane: vanity metrics oraz jakiekolwiek mierzenie produktywności pracowników.

**Co należy do karty, a nie tutaj:** progi liczbowe właściwe rodzinie (np. próg wirtualizacji, limit węzłów), konkretne role ARIA i skróty klawiszowe, nazwy zdarzeń telemetrycznych tej rodziny, dane wrażliwe, które akurat ta rodzina wyświetla, oraz zachowanie przy zoomie, jeśli różni się od podstawy.

---

## 4. Definition of Ready

Komponent może trafić do zadania, jeśli ma określony job, stan danych, capabilities, wszystkie istotne stany, istniejący wzorzec lub świadomie zatwierdzony brak oraz kryteria odbioru. Sformułowanie „ma wyglądać ładnie” nie jest wymaganiem.

## 5. Definition of Done

Komponent otrzymuje `runtime_status: CANONICAL`, gdy:

- ma jedno publiczne API i jedną implementację referencyjną;
- istnieje fixture/story dla wariantów i stanów;
- przechodzi test keyboard/screen reader oraz dark/light;
- ma visual regression dla stanów kluczowych;
- akcje mutujące potwierdzają server read-back;
- nie zawiera atrap ani cichych no-opów;
- co najmniej dwa moduły używają go bez lokalnego forka albo jest świadomie domenowy;
- migracja duplikatów ma właściciela i termin.

## 6. Reguła zmian

Zmiana additive może podnieść minor wersji. Usunięcie pola, zmiana anatomii, skrótu lub semantyki akcji jest breaking change: wymaga nowej wersji, listy konsumentów, migracji i odbioru właściciela produktu. Wyjątek wizualny nie może być ukryty w klasach Tailwind jednego ekranu.
