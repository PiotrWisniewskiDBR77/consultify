# VIDEO_ENABLEMENT_V3 — Video help & education system (SSOT)

> **Status:** draft  
> **Owner:** Product / Platform  
> **Scope:** v3 (WS‑A cross‑cutting)  
> **Related:** `docs/videos/README.md`, `docs/ui-standards/00-foundation/visual-language.md`, `docs/ui-standards/00-foundation/color-system.md`, `DEMO_TRIAL_V3.md`

## 1) Cel (dlaczego)

Wideo w Consultify ma mieć dwa cele, które współistnieją bez konfliktu:

- **Edukacja użytkownika (time‑to‑value)**: w 30–90 sekund tłumaczymy “co tu zrobić” i “co dostanę”.
- **Promocja platformy (value moments)**: sugerujemy kolejne filmy, które pokazują “co dalej” i budują przekonanie o spójności platformy.

Wideo NIE jest “marketingowym overlayem”. Jest **narzędziem pracy**: krótkie, kontekstowe, mierzalne.

## 2) Surfaces (gdzie wideo żyje)

### 2.1 Micro‑Video Prompt (kontekstowy modal)

**Cel:** 1 krótki film “tu i teraz” + lista “co dalej” (2–4 rekomendacje).

- **Wyzwalanie (default):**
  - pierwszy raz w danym module (per user, per module)
  - opcjonalnie: po kluczowym “first value moment” (R1+)
- **Akcje:**
  - `Watch`
  - `Skip`
  - `Don’t show again` (dla tego modułu)
  - wybór innego wideo z listy rekomendacji (bez wychodzenia z modala)
- **Warstwa UI (MUST):**
  - Modal = **Layer 3**, chrome monochromatyczny, **1 primary CTA**
  - brak “D‑mode vibe” (brak dekoracyjnych gradientów w chrome)

### 2.2 Help Center (Side Panel)

**Cel:** kontekstowa dokumentacja + onboarding playbooks + “pełna baza wiedzy”.

- Side panel jest **zawsze dostępny** (prawy panel).
- Wideo w help systemie jest “treścią” obok: overview / FAQ / KB.

### 2.3 Knowledge Base (pełna strona / portal)

**Cel:** pełna biblioteka (moduły, karty, FAQ, wideo), wyszukiwalna.

### 2.4 Onboarding nudge (first login CTA)

**Cel:** popchnąć usera do “pierwszych 30 minut” bez ściany tekstu (playbook).

> Wideo onboardingowe może być elementem playbooka (R1+), ale w R0 minimalnie wystarcza nudge + deep linki.

## 3) Content model (co opisujemy)

Każde wideo ma metadane (registry) + assety (skrypt, miniatura, mp4):

- **Metadane (MUST):**
  - `id`, `moduleId`
  - `title` + `titlePl`
  - `description` + `descriptionPl`
  - `videoUrl`, opcjonalnie `thumbnailUrl`
  - `duration` + `durationSeconds`
  - `tags`
- **Assety (MUST):** zgodnie z `docs/videos/README.md` (skrypt + mp4, naming convention).

## 4) Rekomendacje (“inne filmy”)

Micro‑Video Prompt ma zawsze sekcję “More to explore” (jeśli są kandydaci), ale:

- **MUST:** max 4 pozycje (żeby nie spamować).
- **MUST:** deterministyczne (te same wejścia → te same rekomendacje).
- **SHOULD:** preferować krótkie treści (≤ 2–3 min) dla micro‑help.

### 4.1 Minimalny algorytm (R0)

Skoring kandydatów (przykładowo):

- +100 gdy `candidate.moduleId === moduleId` (lokalne tutoriale)
- +20 gdy `tags` zawiera `moduleId`
- +12 `fundamentals`, +10 `getting-started`, +6 `education`
- +6 jeśli `durationSeconds ≤ 120`, +3 jeśli `≤ 180`
- +4 jeśli `videoUrl` wskazuje na realny asset (np. `/videos/...`)

## 5) Gating i częstotliwość (anti‑spam)

- **Per user, per module**: prompt pokazuje się domyślnie 1 raz, dopóki user nie:
  - obejrzy (tracked jako completed / watched)
  - wybierze “don’t show again”
  - pominie (skip) — w R0 traktujemy jak “dismiss” dla tego modułu (żeby nie męczyć)
- **Global switch (settings, R1+):** możliwość wyłączenia micro‑video promptów globalnie dla usera (preferencje).

## 6) Telemetria (MUST)

Wideo jest mierzalne, bo inaczej nie wiemy czy edukuje czy przeszkadza.

Minimalny zestaw eventów:

- `help_video_prompt_shown` (moduleId, videoId)
- `help_video_view_started` (moduleId, videoId)
- `help_video_view_completed` (moduleId, videoId, watchTimeSeconds, progressPercent)
- `help_video_skipped` (moduleId, videoId)
- `help_video_dont_show` (moduleId, videoId)

## 7) DoD (R0)

- Micro‑Video Prompt jest “tech sexy” i spójny z DBR77 visual language.
- Prompt pokazuje wideo kontekstowe + 2–4 rekomendacje innych filmów.
- “Skip / Don’t show again / Completed” poprawnie zapisują stan per user+module.
- Telemetria rejestruje pokazanie promptu + start/complete/skips.

## 8) Roadmap (R1+)

- Personalizacja rekomendacji na podstawie roli / org type / poprzednich akcji.
- Wideo jako kroki w playbookach onboardingowych.
- Deep links z wideo do konkretnych “value moments” (wizard start, create artifact).

