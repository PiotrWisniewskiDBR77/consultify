# HeyGen — plan produkcji (lokalny, niegitowany)

Ten katalog jest **lokalny** i jest ignorowany przez git (`_local_production/`). Możesz go spakować i wysłać Tomkowi.

## Cel

- Dostarczyć spójny zestaw filmów HeyGen z udziałem **Teresy (avatar)** + screeny z aplikacji.
- Zrobić to w falach, tak aby **najpierw** powstały filmy o najwyższym wpływie na: zrozumienie produktu → decyzja → trial.

## Źródła skryptów już w repo

### Knowledge episodes (docs/knowledge/*)
- Foldery typu `docs/knowledge/**/SCRIPT_EN.md`, `SCRIPT_PL.md`, czasem `TEASER_SCRIPT.md`.
- Statusy/priorytety: `docs/knowledge/README.md` (Wave 1).

### Tutoriale produktowe (Help/Onboarding)
- Skrypty: `docs/videos/scripts/**`
- Lista tutoriali w kodzie: `config/videoTutorialsContent.ts` (ma `scriptPath` i docelowy `filename`).
- Workflow produkcji: `docs/videos/README.md`.

## Standard produkcji (rekomendowany)

- **Format master**: 16:9, 1080p (lub 4K jeśli masz łatwo), 25/30 fps.
- **Audio**: -14 LUFS (web standard), bez przesterów.
- **Montaż**: Teresa (talking head) jako “anchor”, między scenami **cięcia do screencastu**.
- **Warstwy**:
  - A) Teresa (HeyGen): intro, przejścia, podsumowanie, CTA
  - B) Screen recording: konkretne kroki w UI
  - C) Overlay text (krótkie): 1–2 linie, nie więcej niż 4–6 słów na overlay

## Gdzie “aktorzy”

- **Teresa (avatar)**:
  - otwarcie (hook + promise)
  - przejścia między krokami
  - podsumowanie + CTA
  - wyjaśnienie “dlaczego” (metodologia, sens, decyzje)
- **Screeny z aplikacji**: cała “procedura” (kroki, kliknięcia, wyniki).
- **Opcjonalnie (B-roll / stock / grafiki)**:
  - 2–4 krótkie przebitki na film (max 1–2s), tylko tam gdzie “nie ma czego pokazać” w UI.

## Kolejność produkcji (fala 1)

1) `01_getting-started.md` (EN+PL) — najwyższy wpływ na onboarding i trial  
2) `02_drd-overview.md` (EN; PL do dorobienia) — uwiarygadnia metodę  
3) `03_ai-chat-basics.md` (EN) — “aha moment” (jak korzystać)  
4) `04_oee-best-practices.md` (EN+PL) — konkret + ROI  
5) `05_10-dimension-audit.md` (EN) — metodologia + demo assessmentu  
6) `06_automotive-case-study.md` (EN) — proof layer  
7) `07_lean-manufacturing.md` (EN) — biblioteka best practices

## Checklisty globalne

### Checklist screen recording (aplikacja)
- Ten sam tenant / demo workspace dla wszystkich nagrań (spójność UI).
- Jedna wersja motywu (rekomendacja: **light**, bo czytelniej na wideo).
- Ukryj dane wrażliwe: fikcyjne nazwy firm, brak prawdziwych maili, brak tokenów, brak list userów.
- Cursor/klik: widoczny (ring/pulse), ale nie agresywny.
- Nagrywaj “czyste” ujęcia bez lagów: powtórz kroki 2–3 razy i wybierz najlepsze.

### Checklist HeyGen (Teresa)
- Stały background (brandowy, neutralny).
- Stały styl: środkowy kadr, bez nadmiernej gestykulacji.
- Dla PL/EN: osobne rendery (nie mieszamy języków).

