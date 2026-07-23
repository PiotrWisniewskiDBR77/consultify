# Decyzje właściciela + propozycja wspólnego kanonu prawego panelu

**Data:** 2026-07-23 · **Kontekst:** standard OpenAI (`00_MASTER_DEEP_STANDARD.md` + 01–11) × audyt kodu (`docs/audits/idea-workspace-completeness-2026-07-23/`).

## A. Decyzje podjęte przez właściciela

| # | Decyzja | Wybór | Konsekwencja |
|---|---|---|---|
| D1 | Kanon prawego panelu | **UJEDNOLICIĆ oba kanony** (jeden zestaw dla całego produktu) | dotyka Idea **oraz** 7 kart N (już odebranych, na demo) — patrz §B |
| D2 | Przełącznik 4 reprezentacji | **Od razu do prawego dolnego rogu** (bez prototypu) | rail przestaje być przełącznikiem; róg = zoom · fit · minimapa · widok |
| D3 | Mapowanie semantyczne między reprezentacjami (master §1) | **Osobny projekt, nazwany wprost** | standard zapisuje jako cel kierunkowy, poza obecną naprawą |
| D4 | Kolejność prac | **P0 (integralność danych) + standard równolegle** | naprawy danych startują natychmiast, nie czekają na dokument |

Wcześniej rozstrzygnięte przez standard OpenAI (przyjęte): Table → **P15 docelowy, legacy wygaszany**; Convert = akcja (nie zakładka); Export = wyłącznie plik; `Create from map` zakazane.

---

## B. Propozycja WSPÓLNEGO KANONU prawego panelu (konsekwencja D1)

### Punkt wyjścia — co mamy dziś
| Kanon | Zakładki | Gdzie używany |
|---|---|---|
| **SPEC-A** (`ARTIFACT_ANATOMY_STANDARD §708`) | Akcje · Właściwości · Powiązania · Komentarze · Historia/AI | 7 kart N (Task/Decision/Insight/Notification/Initiative/Interview/Tool), komponent `ArtifactRightPanel.tsx` |
| **OpenAI** (dla Idea) | Przegląd · Inspektor · Powiązania · Komentarze · Historia | propozycja dla Idea Workspace |

**Kluczowa obserwacja: 3 z 5 zakładek są już identyczne** — Powiązania · Komentarze · Historia. Spór dotyczy wyłącznie dwóch pierwszych.

### Analiza dwóch spornych
- **SPEC-A „Akcje"** (eksport/udostępnij) — to nie jest *informacja*, tylko czynność. Standard OpenAI słusznie mówi, że panel służy informacji, a akcje globalne mieszkają w Menu 1.
- **SPEC-A „Właściwości"** ↔ **OpenAI „Inspektor"** — to *ta sama rzecz na dwóch typach obiektu*: dla rekordu to tabela pól rekordu, dla płótna to właściwości zaznaczonego elementu. Różni się treść, nie funkcja.
- **OpenAI „Przegląd"** — czym obiekt JEST jako całość. Dla Idea: brief/etap/health/statystyki. Dla rekordu: streszczenie + kluczowe pola na wierzchu. Karty N tego dziś nie mają jako osobnej zakładki (mają rozproszone).

### PROPOZYCJA — jeden kanon, 5 zakładek

| # | Zakładka | Odpowiada na pytanie | Idea (płótno) | Karta N (rekord) |
|---|---|---|---|---|
| 1 | **Przegląd** | Czym jest ten obiekt jako całość? | brief, etap, health, statystyki, rekomendowany krok | streszczenie, status, właściciel, kluczowe pola, następny krok |
| 2 | **Właściwości** | Jakie są szczegóły tego, co mam pod ręką? | właściwości zaznaczenia (element/krawędź/lane/wiersz); gdy brak zaznaczenia → ustawienia widoku | tabela właściwości rekordu (`ArtifactPropertiesTable` — **komponent już istnieje i został odebrany**) |
| 3 | **Powiązania** | Z czym to jest połączone? | identycznie (artefakty, źródła, backlinks, załączniki) | identycznie |
| 4 | **Komentarze** | Co mówi zespół? | identycznie | identycznie |
| 5 | **Historia** | Co się z tym działo? (AI = typ zdarzenia, nie osobna zakładka) | identycznie | identycznie |

**Co znika:** zakładka „Akcje" — jej zawartość (eksport, udostępnij) przenosi się do **Menu 1 / kebab**, spójnie z tym, jak Idea trzyma Convert i Export. Akcje kontekstowe wynikające z zakładki zostają wewnątrz niej (np. „Odłącz" w Powiązaniach, „Przywróć wersję" w Historii) — to standard OpenAI dopuszcza wprost.

**Nazwa zakładki 2:** proponuję **„Właściwości"**, nie „Inspektor" — bo:
- termin już jest w produkcie i w SPEC-A (mniejszy koszt zmiany dla kart N),
- „Inspektor" jest żargonem narzędzi graficznych; „Właściwości" rozumie konsultant,
- funkcja jest ta sama; dla płótna zachowuje się jak inspektor zaznaczenia.

### Dlaczego to działa
- **3 z 5 zakładek już są wspólne** → realna zmiana dotyczy dwóch.
- **Karty N zachowują `ArtifactPropertiesTable`** (odebrany komponent) — ląduje pod zakładką „Właściwości". Zero straconej pracy.
- **Idea zyskuje Powiązania i Komentarze**, których dziś nie ma, a dane pod nie już istnieją (`link-graph`, `NodeCommentThread`).
- Jeden kanon = jeden komponent powłoki panelu dla całego produktu.

### Koszt — uczciwie
| Obszar | Zmiana | Ciężar |
|---|---|---|
| Idea Workspace | przebudowa panelu z Problem/Status/Inspector/Convert/Health → nowy kanon; dopięcie przełączania zakładek | duży (i tak planowany) |
| 7 kart N | dodać zakładkę **Przegląd**; przenieść **Akcje** do Menu 1/kebab; reszta bez zmian | **średni** — 2 zmiany na kartę, nie przebudowa |
| `ArtifactRightPanel.tsx` | rozszerzyć o tryb „Przegląd" + wsparcie dla scope zaznaczenia (płótno) | średni |
| `ARTIFACT_ANATOMY_STANDARD.md` | aktualizacja §708 + §1213 (lista czekowania DoD) | mały |

⚠ **Ryzyko do świadomej akceptacji:** 7 kart N jest już odebranych i działa na demo. Zmiana ich panelu = ponowny odbiór. Rekomenduję zrobić to **jedną partią** po zamknięciu Idea, żeby nie odbierać dwa razy.

---

## C. Co z tego wynika dla standardu (zapisy do finalnego dokumentu)
1. Rozdział o prawym panelu opisuje **jeden kanon** i pokazuje, jak ta sama zakładka wygląda dla płótna i dla rekordu.
2. Rozdział „Menu 1" przejmuje Akcje 2rz. (eksport/udostępnij) dla obu typów obiektu.
3. Backlog dostaje osobną pozycję: **migracja 7 kart N na wspólny kanon** (po Idea, jedną partią).
4. `ARTIFACT_ANATOMY_STANDARD.md` wymaga aktualizacji — inaczej dwa dokumenty będą mówić różne rzeczy.
