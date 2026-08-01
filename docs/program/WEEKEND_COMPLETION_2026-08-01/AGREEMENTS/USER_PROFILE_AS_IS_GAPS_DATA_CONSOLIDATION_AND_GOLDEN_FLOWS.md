---
document_id: USER-PROFILE-AS-IS-GAPS-CONSOLIDATION
module: Settings
function: User Profile
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Profil użytkownika — remanent, konsolidacja i golden flows

## 1. Werdykt

Stan: **UI BROAD / DATA FRAGMENTED / BACKEND PARTLY DEGRADED / NOT YET ONE
PROFILE**.

Frontend posiada dużo potrzebnych pól i dojrzałe formularze. Problemem jest
rozproszenie odpowiedzialności oraz brak jednego potwierdzonego modelu. Nie można
uznać profilu za kompletny wyłącznie na podstawie widocznych komponentów.

## 2. Co istnieje

| Obszar | Dowód | Stan |
| --- | --- | --- |
| podstawowy profil | `ProfileSettings.tsx` | real/partial |
| avatar | `AvatarPhotoSettings.tsx` | real/partial |
| bio/skills/certifications/education/experience/links | `ProfessionalProfileSection.tsx` | UI real, backend degraded risk |
| working hours | `WorkingHoursSettings.tsx` | real |
| drugi model working hours/OOO | `ProfileWorkHoursSettings.tsx` | duplikacja |
| availability/DND/quiet hours | `AvailabilitySettings.tsx` | real/partial |
| visibility | `PrivacySettings.tsx` | zbyt gruba: profile-level zamiast per field |
| completeness | `user-profile-completeness.routes.ts` | real/partial, scoring do zmiany |
| professional/extended backend | `user-professional-profile.routes.ts`, `user-profile-extended.routes.ts` | degraded empty contracts |

## 3. Najważniejsze luki

### P0

1. Jeden `UserProfile` aggregate i jeden owner map dla każdego pola.
2. Scalić dwa modele working hours; Availability ma tylko status/DND/wyjątki.
3. Zastąpić degraded empty professional/extended routes realną persistence albo
   ukryć pola do czasu jej wdrożenia.
4. Organization-derived title, department, team, manager i roles jako read-only.
5. Per-field visibility i jeden policy resolver dla Profile Card, Teresa, API,
   search i export.
6. Wspólna Profile Card używana w całej aplikacji.
7. `View as` z realnym ACL.
8. Profile completeness bez nagradzania za ujawnianie pól wrażliwych.
9. Stabilne verified contact methods i preferred contact.
10. E2E `edit -> read-back -> reload -> view as another role`.

### P1

- confirmed/inferred skills i skill provenance;
- name pronunciation/recording;
- working location i next available time;
- portfolio/project showcase z evidence;
- contact verification;
- profile change request do admina;
- staffing/search po kompetencjach;
- project-specific role display;
- profile audit/history.

## 4. Proponowany aggregate

```ts
interface UserProfileAggregate {
  identity: IdentityProfile;
  contact: ContactProfile;
  organizationProjection: OrganizationUserProjection;
  professional: ProfessionalProfile;
  availability: AvailabilityProfile;
  aiPreferencesRef: string;
  fieldVisibility: Record<string, VisibilityRule>;
  verification: Record<string, VerificationState>;
  schemaVersion: number;
  updatedAt: string;
}
```

Nie musi to być jedna tabela. Musi to być jeden wersjonowany kontrakt read modelu
i jednoznaczne command endpointy do warstw user-owned.

## 5. Golden flows

### GF-PRO-01 — pierwszy profil

Zaproszony użytkownik ustawia display name, avatar, język, timezone, working
hours i About me. Organization fields są już wypełnione i zablokowane. Po
zapisie karta jest identyczna w Tasks i Meeting.

### GF-PRO-02 — widoczność

Użytkownik ustawia telefon jako only me, About jako organization, a timezone
jako project members. `View as` pokazuje trzy różne rezultaty, identyczne z API
i realną kartą viewerów.

### GF-PRO-03 — rola projektowa

Admin/Project Lead przypisuje osobę do projektu i rolę projektową. Profil
pokazuje ją read-only w tym projekcie; w innym projekcie użytkownik może mieć
inną rolę. Użytkownik nie może zmienić jej w Settings.

### GF-PRO-04 — dostępność

Użytkownik ustawia tygodniowe godziny i OOO. Calendar, Meeting, Manager capacity
i powiadomienia odczytują ten sam model czasu, nie cztery kopie.

### GF-PRO-05 — skill AI

Teresa sugeruje skill z dowodami pracy. Jest oznaczony `inferred` i prywatny do
czasu potwierdzenia. Po akceptacji staje się self-confirmed; manager może nadać
status organization-confirmed według polityki.

### GF-PRO-06 — managed field

Użytkownik widzi błędny department, klika „Request correction”, Admin zmienia
Organization record, a profil i wszystkie karty aktualizują się bez ręcznej
duplikacji.

## 6. Bramka odbioru

Profil jest gotowy, gdy nie istnieją dwa konkurencyjne źródła working hours,
każde widoczne pole ma trwały read-back, role organizacyjne/projektowe są
niemutowalne przez użytkownika, a visibility jest egzekwowana w UI, API,
Teresie, wyszukiwaniu i eksporcie.
