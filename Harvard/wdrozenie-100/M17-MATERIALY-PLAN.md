# M17 „Materiały" — PLAN WDROŻENIA (SSOT)

**Moduł:** M17 Materiały (konsolidacja M17 Outputs + M18 Document Studio + M19 Presentations + M20 Tables) · **Właściciel:** CTO · **Status:** w realizacji (F0 done) · **Daty:** start 2026-06-24 · **Linki:** [`MATERIALS_MODULE_MASTER_SPEC`](../../docs/product/MATERIALS_MODULE_MASTER_SPEC.md) · [`DELIVERABLE_FORMATTING_SPEC`](../../docs/product/DELIVERABLE_FORMATTING_SPEC.md) · [`BUSINESS_PLAN_GENERATOR_SPEC`](../../docs/product/BUSINESS_PLAN_GENERATOR_SPEC.md) · [`DELIVERABLE_STANDARDS_AND_TOOLING`](../../docs/qa/deliverables/DELIVERABLE_STANDARDS_AND_TOOLING.md)

## Decyzje zamknięte (Piotr, 2026-06-24)
- **Nazwa:** „Materiały" (jeden moduł, 4 sidebar-wpisy → 1). Format (deck/raport/tabela) = **wybór** (system podpowiada), nie nawigacja.
- **Jednostka:** jeden materiał. Pakiet (1 zestaw info → kilka materiałów) = opcja, nie domyślne.
- **Artefakt = źródło prawdy:** insight z wywiadu · inicjatywa · decyzja · task · raport finansowy · tabela KPI · 4 typy idei · notatki. (Otwarte na dokładanie.)
- **Live = dane, nie narracja.** Cykl życia: Draft→Review→Authorized→Sent (wysłane=auto-lock). Edycja warstwowa (generowana + nadpisania). Monetyzacja: kredyty/pakiety + dokup. Brand-ingestion: paleta+fonty teraz, klon layoutu v2. Harmonogram/email = rola uprzywilejowana.
- **Sposób:** scalamy istniejące, mózg premium ON; nowy obok za flagą tam gdzie ryzyko; deploy demo→odbiór→prod osobno; PROD nietknięty bez zgody.

## Teza
Każdy projekt w końcu trzeba pokazać światu — moment, gdy konsultant składa wiedzę w Excel/PPT/raport. „Materiały" = jeden dom: **biblioteka utworzonych materiałów + tworzenie (3 wejścia) + zarządzanie**, zasilane artefaktami, w jakości konsultanta, piękne. Trzy wymagania: współpraca modułów · najlepsze dane+przekaz · piękno (bramka).

---

## FALE ROZWOJU

### F0 — Konsolidacja + fundament założeń · ✅ ZROBIONE (`ce5a96ee56`)
Sidebar 4→1 „Materiały" → hub-biblioteka (taby + tabela + „Nowy"). Założenia startowe (treść+grafika). Backbone wiązki (route + generateBundle). Fixy żywe: timeout materialize, deck 4→10, Table Studio generuje, tytuły. Eksport DOCX/XLSX. Flaga premium = OFF (klienci nietknięci).

### F1 — Wpięcie założeń + premium jako jakość bazowa
Defaulty realnie sterują generacją; flaga premium ON na demo → koniec placeholderów; beauty/content gate.

### F2 — „Nowy" → trzy wejścia kontekstu
Zunifikowany ekran „Nowy" z wyborem formatu; (1) czysty input→retrieval z org, (2) upload pliku→parse, (3) przycisk „Przygotuj narzędzie" z modułów→handoff kontekstu.

### F3 — Template × Motyw × Formatowanie
Biblioteka template'ów (struktura) per format; motywy (para fontów + paleta) wymienne; pogłębione formatowanie (H1-3/listy/tabele) w 4 rendererach.

### F4 — Trzy powierzchnie wyjścia
Eksport natywny (.docx/.pptx/.xlsx — PPTX domknąć) + publiczny share-link viewer + in-app viewer; jeden materiał → 3 powierzchnie.

### F5 — Źródła danych (wyprzeć Power BI)
Konektory do baz + generowane formularze (link-share) zasilające tabele.

### F6 — Tryby życia + edycja + wersjonowanie
Static/Live(bind danych)/Authorized; edycja warstwowa (merge, nie clobber); RBAC kto/kiedy; historia+rollback; Sent=immutable.

### F7 — Harmonogram + dostawa (subskrypcja raportu)
Cron (np. pon 8:00) → template+artefakty → biblioteka + e-mail do odbiorców; governance odbiorców.

### F8 — Brand-ingestion klienta
Upload .pptx/.docx → ekstrakcja palety+fontów → motyw klienta nadpisuje default. (Klon layoutu = v2.)

### F9 — Image Router (tiery) + monetyzacja
Router per typ treści: stock/budget/premium/wyspecjalizowane (Ideogram-tekst, Recraft-wektor); pakiety Lite vs Pro (kredyty); VisionQA gate.

### F10 — Inteligencja konsultanta
Księga faktów (zero sprzecznych liczb) · provenance na twierdzeniach · warianty audytorium (1 źródło → board/working cut) · pętla zwrotna (materiał→artefakty).

---

## ROZWÓJ PER OBSZAR (funkcjonalność → fale)
| Obszar | Fale |
|---|---|
| **Sidebar/IA + biblioteka „Materiały"** | F0 (konsolidacja, tabela, taby) → F4 (share/viewer) |
| **Tworzenie („Nowy")** | F2 (3 wejścia, wybór formatu) → F1 (defaulty+premium) |
| **Generacja treści (B1/B3/B4)** | F0 (działa) → F1 (defaulty+premium) → F10 (księga faktów/provenance/warianty) |
| **Template/Motyw/Formatowanie** | F3 (struktura+kolory+typografia, 4 renderery) |
| **Wyjścia (plik/share/viewer)** | F4 (DOCX/PPTX/XLSX + share-link + viewer) |
| **Dane wejściowe** | F5 (konektory + formularze) |
| **Cykl życia / edycja / wersje** | F6 (static/live/authorized, warstwy, RBAC) |
| **Automatyzacja** | F7 (cron + email) |
| **Brand** | F8 (ingestion klienta) |
| **Grafika** | F9 (router tierów + pakiety) |
| **Pętla wiedzy** | F10 (materiał→artefakty) |

---

## TASKI (per faza: Kroki realizacji · Epik/Story · DoD mierzalne · Testy · UI · Status)

### F0 — Konsolidacja + założenia · ✅
| ID | Task | Kroki realizacji | Epik/Story | DoD (liczby/testy) | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F0.1 | Sidebar 4→1 „Materiały" | edit menuConfig (relabel #9, usuń #10-12) + breadcrumb | „Jeden moduł zamiast 4" | sidebar ma 1 wpis „Materiały"; route'y studiów żyją | tsc | ✅ | ✅ live |
| F0.2 | Założenia startowe (treść+grafika) | `deliverableDefaults.ts` + resolver merge | „Sensowny default bez briefu" | 3 formaty pokryte; override per pole | 6/6 unit | — | ✅ |
| F0.3 | Backbone wiązki | route `/business-plan` + `generateBundle` (SPINE→B4/B3/B1) | „Jeden brief → spójny komplet" | 3/3 artefakty live; hero-numbers identyczne | 8/8 + e2e | — | ✅ |
| F0.4 | Fixy żywe demo | timeout materialize (120s), deck 4→10, Table generuje, czyste tytuły | „Generuje się i jest pełne" | deck 10 slajdów; table 8/8; raport 7 sekcji | live demo | ✅ | ✅ |
| F0.5 | Eksport DOCX+XLSX | `bundleExportRuntime` (ContentSection→DocumentSchema; tableSchema→workbook) | „Realne pliki Office" | PK-zip >2KB, parsuje się | 4/4 unit | — | ✅ |

### F1 — Defaulty + premium jako baza
| ID | Task | Kroki realizacji | Epik/Story | DoD | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F1.1 | Wpiąć `deliverableDefaults` w B1/B3/B4 | generatory czytają defaulty gdy brief skąpy | „Default steruje treścią+grafiką" | każdy generator konsumuje resolver; brak hardcode | unit per generator | — | ⬜ |
| F1.2 | Flaga premium ON na demo | Railway env `ENABLE_DELIVERABLES_PREMIUM=true` + klucze | „Koniec placeholderów" | deck/raport/tabela = realna treść (nie „awaiting content") | live demo | ✅ | ⛔ Piotr (Railway) |
| F1.3 | Beauty gate (VisionQA) | render→VisionQA→regen/fallback | „Brzydkie nie wychodzi" | gate odrzuca <próg; regen ≤2 | unit + live | ✅ | ⬜ |
| F1.4 | Content gate | zero placeholderów, zero sprzecznych liczb, CFO-review fin. | „Pusty/sprzeczny nie wychodzi" | 0 placeholderów w outputcie; liczby zgodne | unit | — | 🟡 (CFO-review jest) |

### F2 — „Nowy" → trzy wejścia
| ID | Task | Kroki realizacji | Epik/Story | DoD | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F2.1 | Panel „Nowy" + wybór formatu | unified start screen (makieta) → format → studio | „Jedno wejście, wybór formatu" | „Nowy" otwiera panel; 3 formaty | e2e + wizual | ✅ | ⬜ |
| F2.2 | Wejście 1: czysty input → retrieval | jedno zdanie → szukaj w org/projektach/artefaktach → generuj | „Gamma-style z naszą wiedzą" | brief „o projekcie X" pobiera artefakty X | e2e | ✅ | ⬜ |
| F2.3 | Wejście 2: upload pliku → parse | .docx/.pptx/.pdf → rozbij → buduj | „Wrzuć i przerób" | upload → materiał z treścią pliku | e2e | ✅ | ⬜ |
| F2.4 | Wejście 3: „Przygotuj narzędzie" z modułów | przycisk w inicjatywie/idei/raporcie → handoff kontekstu → Materiały | „Most moduły↔materiały" | klik w module → Materiały z zaznaczonym kontekstem | e2e | ✅ | ⬜ |

### F3 — Template × Motyw × Formatowanie
| ID | Task | Kroki realizacji | Epik/Story | DoD | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F3.1 | Rejestr motywów (para fontów+paleta) | `theme` SSOT → 4 renderery | „Jeden motyw, każda powierzchnia" | 5 par + 10 fontów; spójne w docx/pptx/xlsx/web | unit | ✅ | ⬜ |
| F3.2 | Biblioteka template'ów per format | struktura (slajdy/sekcje/kolumny) edytowalna | „Predefiniowana struktura" | ≥3 template'y/format; tworzone w module | unit + e2e | ✅ | 🟡 (galerie istnieją) |
| F3.3 | Pogłębione formatowanie | H1-3/listy/tabele wg `DELIVERABLE_FORMATTING_SPEC` w rendererach | „Jak natywny Word" | hierarchia+listy+tabele per format | unit (parse) | ✅ | ⬜ |

### F4 — Trzy powierzchnie wyjścia
| ID | Task | Kroki realizacji | Epik/Story | DoD | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F4.1 | PPTX render z wiązki | deck plans → pptx pipeline | „Deck jako .pptx" | realny .pptx, parsuje się | unit | — | ⬜ |
| F4.2 | „Pobierz komplet" (3 pliki) | docx+xlsx+pptx z jednego materiału | „Teczka do wysłania" | 3 pliki spójne | unit + e2e | ✅ | 🟡 (docx/xlsx są) |
| F4.3 | Publiczny share-link viewer | render online + link (opcja live) | „Share jak Gamma" | link otwiera viewer bez logowania | e2e | ✅ | ⬜ |
| F4.4 | In-app viewer | podgląd w platformie + share wewn. | „Oglądanie u nas" | viewer renderuje 3 formaty | e2e + wizual | ✅ | 🟡 (preview istnieje) |

### F5 — Źródła danych
| ID | Task | Kroki realizacji | Epik/Story | DoD | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F5.1 | Konektory do baz | definicja źródła + mapowanie kolumn → tabela | „BI-style live data" | tabela zasilana z DB; refresh | unit + e2e | ✅ | ⬜ |
| F5.2 | Generowane formularze | builder → link-share → wypełnienia → tabela | „Zbieraj dane formularzem" | formularz publiczny → wiersze w tabeli | e2e | ✅ | 🟡 (intake istnieje) |

### F6 — Cykl życia + edycja + wersje
| ID | Task | Kroki realizacji | Epik/Story | DoD | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F6.1 | Stany Draft→Review→Authorized→Sent | maszyna stanów + auto-lock przy Sent | „Bezpieczny do wysłania" | przejścia + Sent=immutable | unit | ✅ | ⬜ |
| F6.2 | Edycja warstwowa (merge) | warstwa generowana + nadpisania usera | „Regeneracja nie kasuje edycji" | regen zachowuje override (test) | unit | ✅ | ⬜ |
| F6.3 | RBAC + wersjonowanie | role kto/kiedy edytuje; historia+rollback | „Kontrola + cofnięcie" | role egzekwowane; rollback działa | unit + e2e | ✅ | ⬜ |
| F6.4 | Tryb Live (bind danych) | bind KPI/statusów/liczb/wierszy → odświeżanie przy otwarciu | „Żywy deck/raport" | otwarcie pobiera aktualne dane | unit + e2e | ✅ | ⬜ |

### F7 — Harmonogram + dostawa
| ID | Task | Kroki realizacji | Epik/Story | DoD | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F7.1 | Scheduler subskrypcji raportu | cron + przypięte źródło (artefakty) + template | „Pon 8:00 sam się robi" | zaplanowany → wygenerowany do biblioteki | unit + e2e | ✅ | ⬜ |
| F7.2 | Dostawa e-mail | lista odbiorców + wysyłka + governance/zgoda | „Auto-doręczenie" | wysyłka na adres; opt-out; rola | unit | ✅ | ⬜ |

### F8 — Brand-ingestion
| ID | Task | Kroki realizacji | Epik/Story | DoD | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F8.1 | Ekstrakcja motywu z .pptx/.docx | parse OOXML (theme1.xml, fonty) → motyw klienta | „Twój brand" | upload → paleta+fonty wyciągnięte+stosowane | unit (parse) | ✅ | ⬜ |

### F9 — Image Router + monetyzacja
| ID | Task | Kroki realizacji | Epik/Story | DoD | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F9.1 | Image Router (tiery) | router per typ×brand×tier + fallback | „Właściwy model do treści" | stock/budget/premium routing; VisionQA | unit | — | 🟡 (deckVisuals: nano/qwen/unsplash) |
| F9.2 | Wyspecjalizowane | Ideogram (tekst), Recraft (wektor/brand), Pexels | „Tekst+wektor pro" | obraz-z-tekstem przez Ideogram; wektor Recraft | unit + live | — | ⬜ |
| F9.3 | Pakiety Lite/Pro + kredyty | gating darmowe vs premium; licznik tokenów | „Dokup" | premium za kredyty; licznik | unit | ✅ | ⬜ |

### F10 — Inteligencja konsultanta
| ID | Task | Kroki realizacji | Epik/Story | DoD | Testy | UI | Status |
|---|---|---|---|---|---|---|---|
| F10.1 | Księga faktów | liczby = referencje do artefaktów (nie kopie) | „Zero sprzecznych liczb" | ta sama liczba w 3 artefaktach (auto-test) | unit | — | 🟡 (hero-numbers w SPINE) |
| F10.2 | Provenance na twierdzeniach | źródło/artefakt przy liczbie; przypisy | „Skąd to wiesz" | każda kluczowa liczba ma źródło | unit | ✅ | 🟡 (cytowania doc) |
| F10.3 | Warianty audytorium | 1 SPINE → board cut / working cut | „5-slajdowy cut dla zarządu" | z jednego źródła 2 warianty | unit + e2e | ✅ | ⬜ |
| F10.4 | Pętla zwrotna materiał→artefakty | rekomendacje z decka → śledzone inicjatywy | „System się uczy" | rekomendacja → artefakt inicjatywy | e2e | ✅ | ⬜ |

Legenda statusu: ✅ done+live · 🟡 częściowo/fundament jest · ⬜ do zrobienia · ⛔ wymaga Piotra.

---

## DoD MODUŁU (bramka „consultant-grade")
1. Jeden wpis „Materiały" → biblioteka (tabela+statystyki) + „Nowy" (3 wejścia, wybór formatu).
2. Premium ON: 3 formaty z realną treścią (0 placeholderów), beauty+content gate zielony.
3. Eksport .docx/.xlsx/.pptx + share-link + in-app viewer — z jednego materiału.
4. Template×motyw×formatowanie spójne na 4 powierzchniach; brand klienta nadpisuje.
5. Cykl życia (Draft→Sent=lock) + edycja warstwowa + wersje + RBAC.
6. Live-binding (dane), harmonogram+email, formularze+konektory.
7. Księga faktów (zero sprzecznych liczb, auto-test) + provenance + warianty audytorium.
8. Pętla zwrotna materiał→artefakty.
Każdy DoD mierzalny (liczby/testy), nie przymiotniki. Test żywy na demo + ≥1 golden (DBR77/VTS).

## Governance / sposób pracy
Commity chirurgiczne na `deliverables/`+`KimiWorkspace/`+`ReportsAndPresentations/` (branch współdzielony — git races realne). Flaga OFF=byte-identyczne. Deploy: feat→demo (merge w worktree)→Railway→weryfikacja żywa→prod osobno (zgoda). Każda faza: kod+test+tsc→commit→deploy demo→odbiór Piotra→następna.

## Otwarte (do nodu)
- F1.2 flip flagi premium (Railway) — Twój ruch, odblokowuje całą jakość.
- Domyślny motyw „Executive"? · zestaw 10 fontów OK? · kolejność faz po F1 (proponuję F1→F2→F3→F4, potem F5-F10).
