# Consultify — reguły pracy (dla każdej sesji i agenta)

Consultify to AI-native system realizacji doradztwa (nie generyczny SaaS-dashboard).
Właściciel: Piotr (product/strategy, nie-koder, komunikacja PO POLSKU, krótko, obrazkami).

## UI — PRAWO NADRZĘDNE
1. **Standard jest KODEM, nie opisem**: ekrany listowe budujemy WYŁĄCZNIE komponentami
   `src/components/standard/` (StandardModuleBar · StandardTable · StandardPreview).
   Moduł deklaruje treść, komponent narzuca wygląd. Zakaz własnych tabel/menu/preview per ekran.
2. **SSOT wyglądu: `docs/ui-standards/TRIADA_KANON.md`** (opis + twarde wartości + 40-punktowa
   lista czekowania + fotki referencyjne). Surowe słowa właściciela:
   `Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md`. Przy każdej pracy nad ekranem listowym
   użyj skilla `consultify-triada`.
3. **Pułapka nr 1: `primary` w tailwind = crimson #85182F.** Czerwień TYLKO semantyka krytyczna.
   CTA/stany aktywne = neutralne; fokus = niebieski `c-focus` (hook `check-triada.sh` blokuje naruszenia).
4. **Odbiór ekranu = lista czekowania część B, literalnie, ZA KAŻDYM RAZEM** (menu, tabela,
   pstryczek, kebab, preview, kanban, dark+light). Weryfikacja WZROKIEM (zrzuty), nigdy „testy przeszły".
5. **Nic nie wchodzi na demo bez akceptacji właściciela na zrzutach.** `origin/demo` = święta baza;
   push/deploy tylko nadzorca sesji głównej.

## STRUKTURA PRAC (2026-07)
- Program 7 rozbudów narzędzi = mechanika NAJPIERW; artefakty (frontend) dorabiamy PO gotowej
  mechanice — patrz `Harvard/wdrozenie-100/_STRUKTURA_PRAC_UI.md`.
- Rollout triady tabel: `Harvard/wdrozenie-100/_ROLLOUT_TRIADA_INWENTARZ.md` (fale, statusy).

## HIGIENA WYKONANIA
Robotnicy: modele tanie (Sonnet/Haiku) do mechaniki, Opus tylko trudny kod; świeża gałąź per krok
z `origin/feat/deliverables-w1`; isolation worktree; commit-per-krok; NIE push; zero sub-agentów;
zakaz pełnego tsc/vitest u robotników (esbuild per plik); NOWE pliki w `tests/` wymagają `git add -f`.
Dane demo = twarz produktu: probe'y sprzątają po sobie, zero rekordów testowych.
