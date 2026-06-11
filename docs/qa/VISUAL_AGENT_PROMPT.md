# Visual Audit Agent — Prompt startowy

Wklej poniższy blok do agenta i powiedz mu "start".

---

## Twoje zadanie

Przeprowadź wizualny audyt aplikacji Consultify na środowisku staging.  
To jest **Faza 1** — capture + describe + oczywiste błędy.  
**Nie naprawiasz niczego.** Tylko fotografujesz i opisujesz.

Rano właściciel przejrzy Twoje screenshoty i oceni co OK / nie OK.  
Te decyzje staną się standardem wizualnym produktu.

---

## Środowisko

```
Aplikacja:  https://demo.consultify.ai
Login:      piotr.wisniewski@dbr77.com
Hasło:      odczytaj z pliku .env.staging.secrets → pole STAGING_ADMIN_PASSWORD
            plik: /Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/.env.staging.secrets
Rola:       OWNER organizacji DBR77
Viewport:   1440×900
Motyw:      ciemny (domyślny)
```

**Narzędzia których używasz:**
- `mcp__Claude_in_Chrome__computer` → screenshot, left_click, scroll, hover, type
- `mcp__Claude_in_Chrome__navigate` → nawigacja
- `mcp__Claude_in_Chrome__javascript_tool` → odczyt DOM, stanu komponentów
- `mcp__Claude_in_Chrome__resize_window` → zmiana viewportu
- `Bash` → logi Railway: `railway logs --environment staging -n 20`
- `Write` / `Edit` → zapisywanie raportu

---

## Struktura plików wyjściowych

```
docs/qa/runs/2026-06-12/
  visual/
    screenshots/     ← tu zapisujesz opisy ID screenshotów (nie pliki, tylko IDs)
    VISUAL_AUDIT_PHASE1.md   ← główny raport
```

Utwórz folder `docs/qa/runs/2026-06-12/visual/` jeśli nie istnieje.

---

## Format każdego wpisu w raporcie

```markdown
### VIS-001 — [Moduł] — [Krótki opis co widzisz]

**Screenshot ID:** ss_xxxxxxx  
**URL:** https://demo.consultify.ai/...  
**Stan:** (np. lista pusta / po kliknięciu / error / loading)

**Opis:**  
Co dokładnie widzę na screenshocie. Jakie kolory, czcionki, układ, ikony.  
Piszę konkretnie — nie "wygląda OK" ale "przycisk primary ma tło #7C3AED, biały tekst, border-radius ~8px".

**Czy coś jest obiektywnie złe?**  
TAK / NIE — jeśli TAK, opisz co: (tekst ucięty, brak etykiety, dwa różne rozmiary tego samego komponentu na tej samej stronie, console error widoczny, brakujący stan hover/disabled na interaktywnym elemencie, pusta lista bez opisu)

**Do decyzji właściciela:** (opcjonalnie)  
Jeśli coś wygląda niespójnie ale nie wiesz czy jest złe — opisz tu i zostaw do oceny.
```

---

## Lista modułów — co zrobić dla każdego

Dla każdego modułu: nawiguj → screenshot bazowy → sprawdź każdy stan → zapisz wpis w raporcie.

### 1. Chat (`/chat`)
Stany: pusty chat (nowa rozmowa), chat z odpowiedzią Teresy (wpisz "Cześć Teresa"), loading podczas generowania, OUTPUT tabs (Auto / Documents / Tables / Presentations) — kliknij każdy.

### 2. My Work — Inbox (`/my-work`)
Stany: lista z elementami, filtr "All / Overdue / Critical", klik na element (detail panel), przyciski akcji w detail panelu.

### 3. My Work — Decisions (`/my-work` → tab Decisions)
Stany: lista decyzji, detail panel (klik na decyzję), AI tabs w detail (Summarize context / Propose options / Assess risk), przyciski Approve/Reject/Delegate.

### 4. My Work — Notebook (`/my-work` → tab Notebook)
Stany: lista notebooków, otwarty notebook (tabs: Inbox / Active / All), otwarta notatka — toolbar edytora, sekcja CANONICAL NOTEBOOK PATH (4 kroki), SEND TO: Radar / Initiatives, empty state ("No pages yet" + template cards).

### 5. My Work — Tasks (`/my-work` → tab Tasks)
Stany: lista zadań, detail zadania.

### 6. My Work — Calendar (`/my-work` → tab Calendar)
Stany: widok kalendarza.

### 7. Interview — Inbox (`/interview`)
Stany: lista z kolumnami (Template / Assignee / Status / Progress / Days to due), grid view vs list view, status badges (Submitted/Assigned), progress bar 100% vs 0%.

### 8. Interview — Insights (`/interview` → tab Insights)
Stany: lista insightów, badges (cross-role / divergences), detail panel, AI tabs, "What next" sekcja.

### 9. Interview — Sessions (`/interview` → tab Sessions)
Stany: lista sesji.

### 10. Interview — Templates (`/interview` → tab Templates)
Stany: lista szablonów.

### 11. Initiatives Hub (`/initiatives`)
Stany: Kanban view (wszystkie kolumny widoczne), karta inicjatywy (priority badge, owner, status, NEXT GATE), detail panel, filter bar (V8 snapshot / V8 WBS / V8 critical path), "New initiative — COMING SOON" button, Analysis tab.

### 12. Document Studio (`/document-studio`)
Stany: formularz pusty (Generate tab), Plan template tab, wypełniony formularz przed kliknięciem "Plan document".  
*Opcjonalnie* jeśli masz czas: wygeneruj jeden dokument i sfotografuj widok z outline + treścią + ASSUMPTION badges + export bar (Markdown/DOCX/PDF).

### 13. Settings (`/settings`)
Stany: strona główna settings, każda z widocznych sekcji/tabs.

### 14. Sidebar nawigacja (sprawdź na dowolnym ekranie)
Stany: sidebar rozwinięty, ikona aktywna (wyróżniona), ikony nieaktywne, Teresa chat sidebar po lewej (jeśli otwarty).

### 15. Viewport 1280px (zmień i zrób screenshoty)
Użyj `mcp__Claude_in_Chrome__resize_window` → 1280×800.  
Sprawdź: Chat, Initiatives (Kanban), Notebook, Document Studio.  
Szukasz: overflow tekstu, kart wypadających poza siatkę, zepsutych layoutów.  
Po teście wróć do 1440×900.

---

## Komponenty globalne (sprawdź niezależnie od modułu)

Kiedy w trakcie pracy natkniesz się na te elementy, sfotografuj i opisz:

- **Toast sukcesu** — wywołaj dowolną akcję która powinna dać toast (np. zapisz coś)
- **Toast błędu** — wywołaj błąd jeśli możesz
- **Modal / dialog** — otwórz dowolny modal i sfotografuj backdrop + container + X button
- **Dropdown / select** — otwórz dowolny select (np. Language w Document Studio)
- **Status badges** — zgromadź w jednym wpisie wszystkie kolory statusów jakie widziałeś (Open/Approved/Escalated/Failed/Completed/Critical/High/Medium)
- **Empty states** — każdy moduł gdzie widzisz pustą listę z komunikatem
- **Loading states** — spinner vs skeleton — gdzie co się pojawia

---

## Logi Railway — sprawdzaj co 3-4 moduły

```bash
railway logs --environment staging -n 20
```

Jeśli widzisz linie `[31merror[39m` (czerwone) — zanotuj w raporcie jako:

```markdown
### LOG-001 — Błąd w logach podczas testu [Moduł]
**Zapytanie:** (ścieżka z logów)
**Błąd:** (treść error)
**Wpływ:** widoczny w UI / niewidoczny w UI
```

---

## Czego NIE rób

- Nie naprawiaj kodu
- Nie zmieniaj danych w aplikacji (nie twórz inicjatyw, nie usuwaj decyzji)
- Nie oceniaj estetyki subiektywnie ("ładne" / "brzydkie") — tylko fakty
- Nie blokuj się na jednym module dłużej niż 20 minut

---

## Na koniec raportu dodaj sekcję

```markdown
## Podsumowanie Fazy 1

**Data:** 2026-06-12  
**Modułów przejrzanych:** X  
**Screenshotów wykonanych:** X  
**Obiektywnych błędów:** X  
**Elementów do decyzji właściciela:** X  
**Błędów w logach Railway:** X  

### Top 10 najciekawszych znalezisk (Twój ranking)
1. ...
2. ...
```

---

*Rano właściciel przejrzy raport i każdy wpis "Do decyzji właściciela" oceni jako OK lub NIE OK.  
Te decyzje staną się plikiem `docs/standards/VISUAL_STANDARD.md`.*
