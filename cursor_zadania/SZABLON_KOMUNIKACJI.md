# 📊 KOMUNIKACJA ZESPOŁU - SZABLON

**Ostatnia aktualizacja**: 2026-01-03 21:31

---

## 📝 JAK RAPORTOWAĆ POSTĘP

### Format dla WSZYSTKICH agentów:

```markdown
## [TWOJE_IMIĘ] - [DATA] [GODZINA]

### Ukończone:
- ✅ [Nazwa zadania] - [Szczegóły]

### W trakcie:
- 🔄 [Nazwa zadania] - [% ukończenia]

### Następne:
- ⏳ [Nazwa zadania]

### Problemy/Blokady:
- ❌ [Opis problemu] - potrzebuję pomocy z [X]

### Pytania do koordynatora:
- ❓ [Pytanie]
```

---

## 📋 PRZYKŁAD RAPORTU

```markdown
## CURSOR - 2026-01-03 21:35

### Ukończone:
- ✅ EnterpriseSecurityPanel.tsx - 9 errors fixed
- ✅ Studio/nodes/index.ts - 8 errors fixed

### W trakcie:
- 🔄 ProjectTeamPanel.tsx - 50% (3/7 errors fixed)

### Następne:
- ⏳ Tooltip.tsx - 6 errors

### Problemy/Blokady:
- ❌ Nie mogę znaleźć typu `ProjectMember` w types.ts

### Pytania do koordynatora:
- ❓ Czy mogę dodać nowy interface do types.ts?
```

---

## 🚨 KIEDY ZGŁASZAĆ PROBLEM

1. **Blokada > 15 minut** - zgłoś natychmiast
2. **Nie wiesz jak naprawić** - poproś o przykład
3. **Konflikt z innym agentem** - zgłoś do koordynatora
4. **Znalazłeś bug** - opisz szczegółowo

---

## ✅ KIEDY AKTUALIZOWAĆ MASTER PLAN

1. **Po każdym ukończonym pliku** - oznacz checkbox [x]
2. **Po ukończeniu batcha** - zaktualizuj status
3. **Gdy zmienia się scope** - dodaj notatkę

---

## 📁 GDZIE RAPORTOWAĆ

- **Postęp**: `cursor_zadania/[TWOJE_IMIĘ]_PROGRESS.txt`
- **Problemy**: `cursor_zadania/TEAM_COORDINATION.md`
- **Master Plan**: `cursor_zadania/MASTER_PLAN.md`

---

**Raportuj regularnie! Komunikacja = sukces zespołu!** 🚀
