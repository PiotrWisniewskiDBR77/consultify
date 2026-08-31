---
doc_id: funkcje-odbior-140
status: evidence
truth_type: work-status
established: 2026-08-30
---

# Odbiór adwersaryjny — dyżur 140 (zapis komentarzy)

**Werdykt: `B` — działa z nazwanymi ograniczeniami. SCALONY.**

## Co potwierdził nadzorca własnymi rękami

Mutacja **odtworzona co do liczby**: `HEAD` **5/5**; cofnięcie samego
`TaskDetailView.tsx` → **3 czerwone / 2 zielone**; cofnięcie samego
`DecisionDetailView.tsx` → **2 czerwone / 3 zielone**. Zgadza się z raportem.
Licencja dotrzymana — pięć plików, wszystkie z tabeli, zero `Initiatives/**`.

## Co realnie się zmieniło

**Komentarze Decyzji zapisują się na serwer** — z odczytem po zapisie i uczciwym
błędem przy porażce. Kontrakt wyniku dyskryminowanego z dyżuru 133 jest **wypełniony**,
a nie zmieniony.

## ★★ Ograniczenie — Zadanie zablokowane TĄ SAMĄ bramą co RAID

Wykonawca **nie wpisał `FIXED` dla Zadania** i miał rację: realna brama odrzuca
`POST` kodem **`409`**, a `task_comments` przed i po ma **zero wierszy**.
Zgłosił to jako `STOP MERYTORYCZNY` wewnątrz pozycji.

**To jest ten sam wzorzec, na który stanął dyżur 141 przy RAID.** Dwa niezależne
dyżury, dwie różne powierzchnie, **ta sama przyczyna**: kanoniczna ścieżka zapisu
nie ma polecenia dla tego obiektu. To już nie jest przypadek — to **luka
architektoniczna o szerokim zasięgu**, i tak wchodzi do rejestru.

**Dodatkowo:** odpowiedź i polubienie komentarza **nie mają kontraktu na serwerze** —
wykonawca zwraca dla nich uczciwy błąd zamiast udawać sukces.

## Co z tego wynika

Kolejny dyżur nie może być „podepnij wołacza" — musi **rozstrzygnąć bramę**:
albo dodać polecenia do kanonicznej ścieżki, albo wskazać, że komentarze i RAID
mają iść inną, jawnie dozwoloną drogą. **Decyzja architektoniczna, nie okablowanie.**
