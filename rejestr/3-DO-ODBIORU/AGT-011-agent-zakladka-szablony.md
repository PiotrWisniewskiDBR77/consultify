---
id: AGT-011
tytul: Run agent — zakładka „Szablony" (biblioteka procesów)
typ: zadanie
waga: srednia
obszar: AGT
stan: do-odbioru
wlasciciel: wykonawca
blokuje: []
zablokowane_przez: []
zrodlo: "Piotr 2026-07-24 (decyzja: Agent = Moje procesy + Szablony)"
utworzone: 2026-07-24
---

## 1. PROBLEM

Druga pod-zakładka Agenta — biblioteka szablonów procesów, z której uruchamiasz nowy proces.

## 2. PRZYCZYNA

Zadanie budowlane. Źródła szablonów istnieją: `processLibraryService.ts` (classic-5 + drd, AGT-006) oraz 31 gotowych manifestów (`discoveryToolsRegistry.ts` / `GET /api/ai/agent-manifests`).

## 3. ROZWIĄZANIE

Zakładka **„Szablony"** (w powłoce z AGT-010) = tabela szablonów procesów:
- **Klasyczny 5-fazowy** (domyślny) + **DRD 4-krokowy** (z `processLibraryService`),
- 31 gotowych analiz jako szablony (z katalogu manifestów).
Kolumny: nazwa, typ/opis, liczba kroków. Wybór szablonu → tworzy **nowy proces z tego szablonu** (draft → canvas, jak „Nowy proces" w AGT-010, ale ze wskazanym `processId`/`manifestId`).

## 4. KRYTERIUM ODBIORU

Master zrzut: zakładka „Szablony" pokazuje bibliotekę (klasyczny 5-fazowy wyróżniony jako domyślny + DRD + gotowce); wybór szablonu tworzy proces i otwiera go w canvas w trybie edycji. Dark+light. Dopiero potem Piotr.

## 5. DOWODY

**ADOPTOWANE** — praca wykonana 2026-07-24 i scalona na demo inną ścieżką
(merge „AGT-010 powłoka + AGT-011 szablony" `28745c56cb`; tip gałęzi
`feat/agt-011-szablony` = `0b238982e3` jest przodkiem `origin/demo` —
potwierdzone `git merge-base --is-ancestor`, audyt podłączenia 2026-07-26).

- Kod zakładki: `src/components/AIChat/AgentHubShell.tsx` (handleCreatePlan,
  `processId`/`manifestId`, tabela biblioteki) — obecny i nienaruszony po
  scaleniu kanonu triady (demo `1992061ad7`).
- Zrzut Mastera (dev-render, kod identyczny z demo `1992061ad7`, bez logowania
  Piotra): zakładka „Szablony" pokazuje **Klasyczny konsulting (5 faz,
  Kubr/ILO)** z badge „Domyślny", **DRD (4 kroki)**, gotowe analizy z katalogu
  Discovery Tools (Siły Rynkowe, Ansoff, Priorytetyzacja Portfela…), kolumny
  nazwa/typ/opis/liczba kroków, czytelne nazwy faz w opisie
  (Wejście/Kontraktowanie → Diagnoza → Rekomendacje → Wdrożenie → Zamknięcie).
- Kanon triady tej tabeli (Menu 2 segmented, kebab, pstryczek) dołożony przez
  `fix/triada-agent-sejfy`, wdrożone na demo `1992061ad7` (health 200,
  gitSha potwierdzony 2026-07-26).

## 6. DZIENNIK

**2026-07-24** — utworzone przez Mastera. Zależne od AGT-010 (powłoka 2 zakładek). Reużywa processLibrary + katalog manifestów.

**2026-07-26** — Master: audyt podłączenia wykrył, że wpis był FANTOMEM
(zadanie zrealizowane i zmergowane na demo 2026-07-24, a rejestr dalej
pokazywał „zablokowane, dowody puste"). Adopcja wg protokołu: test z kryterium
odbioru przeszedł (zrzut zakładki Szablony z biblioteka + domyślny klasyczny),
stan → do-odbioru. Blokada AGT-010 zdjęta (AGT-010 też czeka na odbiór).
