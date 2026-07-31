---
document_id: SETTINGS-IA-OWNERSHIP-INHERITANCE
module: Settings
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Settings — IA, własność i dziedziczenie

## 1. Proponowana nawigacja

Obecna lista jest zbyt długa i miesza ustawienia częste, techniczne oraz
administracyjne. Docelowa lewa nawigacja:

1. **My profile** — Profile, Avatar, Availability, Working hours, Signatures.
2. **Work & appearance** — Dashboard, Work preferences, Language & region,
   Theme, Accessibility.
3. **Teresa & AI** — Behavior, Models, Suggestions, Memory, Privacy, Voice,
   Prompt library, Usage.
4. **Notifications** — Channels & categories, Digest, Desktop & sounds,
   Availability/DND.
5. **Connections** — Connected apps, Calendar, API access, Webhooks.
6. **Security & privacy** — Security overview, Authentication, Sessions,
   Privacy & consent, Data controls.
7. **Account** — Plan/billing handoff, Export, Delete account.
8. **Advanced** — Templates, History, Import/export, Developer/Beta.

Sekcje mają strony zbiorcze tylko wtedy, gdy dają realny status i next actions.
Nie budujemy overview będącego listą tych samych linków.

## 2. Minimalistyczny ekran

Layout: sidebar z wyszukiwaniem, header z tytułem/opisem, content o kontrolowanej
szerokości. Jedna karta odpowiada jednemu obszarowi mentalnemu. Switch ma label,
krótkie wyjaśnienie i stan; opis krytyczny nie może być ukryty tylko w tooltipie.
Mobile używa listy kategorii i osobnego ekranu sekcji.

## 3. Macierz właścicieli

| Obszar | Settings | Admin Panel | Superadmin |
| --- | --- | --- | --- |
| profil osobisty | write user | wybrane pola/provisioning | brak zwykłej edycji |
| godziny/dostępność | write user | default/requirement | — |
| wygląd/język | write user | allowed/default | platform languages |
| Teresa style | write user | policy/default | model platform limits |
| pamięć osobista | manage user | org memory policy | platform safety |
| modele | preference w allowlist | allowlist/routing/budget | providers/keys |
| powiadomienia | personal channels/rules | mandatory events/defaults | system incidents |
| connector account | personal authorize | connector catalog/policy | platform connector infra |
| MFA/session | własne konto | org enforcement | platform IAM |
| retencja | dozwolony wybór | tenant policy | legal/platform limits |
| billing | osobisty plan/read-only | tenant subscription | platform billing ops |
| feature flags | dopuszczone beta opt-in | tenant rollout | global rollout |

## 4. Effective settings API

Frontend nie powinien sam scalać pięciu źródeł. Endpoint zwraca:

```ts
interface EffectiveSetting<T> {
  key: string;
  value: T;
  source: 'platform' | 'organization' | 'project' | 'user' | 'session';
  editable: boolean;
  lockedBy?: { layer: string; policyId?: string; reason: string };
  allowedValues?: T[];
  updatedAt?: string;
  version: number;
}
```

Write przyjmuje expected version, waliduje policy i zwraca effective read-back.
Zmiana polityki admina invaliduje cache użytkowników oraz publikuje event.

## 5. Settings history

Historia pokazuje actor, klucz/grupę, before/after, source surface, czas i wynik.
Sekrety są redagowane. Restore tworzy nową zmianę po walidacji obecnej polityki;
nie przywraca starej wartości, która jest już zabroniona.

## 6. Import/export template

Eksport preferencji nie zawiera tokenów, haseł, kluczy, sesji, OAuth grants ani
pełnych danych prywatnych. Import najpierw pokazuje diff i elementy pominięte
przez politykę/wersję. Template ma kompatybilność schema i nie modyfikuje
security/account settings.
